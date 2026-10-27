import {
  manifest,
  processIntent,
  publicSnapshot,
  Rejection,
  validateRequest,
} from "./engine.mjs";
const encode = (body, status = 200, origin = "") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin
        ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" }
        : {}),
    },
  });
/**
 * @param {{enabled?: boolean, origins?: string[], auth: (token: string) => Promise<any>,
 * verifySession: (token: string, session: string) => Promise<boolean>,
 * rpc: (name: string, args: any) => Promise<any>, maxEvaluations?: number}} options
 */
export function createHandler(
  {
    enabled = false,
    origins = [],
    auth,
    verifySession,
    rpc,
    maxEvaluations = 64,
  },
) {
  return async function handler(request) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !origins.includes(origin)) {
      return encode({ error: "origin_not_allowed" }, 403);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Vary": "Origin",
        },
      });
    }
    if (!enabled) {
      return encode({ error: "central_economy_disabled" }, 503, origin);
    }
    if (request.method !== "POST") {
      return encode({ error: "method_not_allowed" }, 405, origin);
    }
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
      return encode({ error: "json_required" }, 415, origin);
    }
    if (Number(request.headers.get("Content-Length") || 0) > 4096) {
      return encode({ error: "request_too_large" }, 413, origin);
    }
    try {
      const token = /^Bearer ([^\s]+)$/.exec(
        request.headers.get("Authorization") || "",
      )?.[1];
      if (!token || token.length > 8192) {
        throw new Rejection("authentication_required", 401);
      }
      const actor = await auth(token);
      if (!actor?.id || !actor.email_confirmed_at) {
        throw new Rejection("verified_account_required", 403);
      }
      // Bound body even when transfer encoding omits Content-Length.
      const reader = request.body?.getReader();
      let text = "", bytes = 0;
      if (!reader) throw new Rejection("invalid_body");
      const decoder = new TextDecoder();
      let deadline;
      try {
        await Promise.race([
          (async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 4096) throw new Rejection("request_too_large", 413);
              text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
          })(),
          new Promise((_, reject) => {
            deadline = setTimeout(
              () => reject(new Rejection("request_body_timeout", 408)),
              5000,
            );
          }),
        ]);
      } finally {
        clearTimeout(deadline);
        await reader.cancel().catch(() => {});
      }
      let input;
      try {
        input = JSON.parse(text);
      } catch (_) {
        throw new Rejection("invalid_json");
      }
      if (input?.action === "region" || input?.action === "status") {
        const region = input.action === "region";
        if (
          Object.keys(input).some((k) =>
            !(region
              ? ["action", "territoryId", "sessionId"]
              : ["action", "sessionId"]).includes(k)
          ) || (region && !/^T_\d{1,3}_\d{1,3}$/.test(input.territoryId || ""))
        ) throw new Rejection("invalid_read_request");
        validateRequest({
          action: "settle",
          operationId: input.sessionId,
          sessionId: input.sessionId,
        });
        if (!await verifySession(token, input.sessionId)) {
          throw new Rejection("central_session_required", 403);
        }
        const result = await rpc(region ? "cw041_region" : "cw041_status", {
          p_actor: actor.id,
          ...(region ? { p_territory: input.territoryId } : {}),
        });
        return encode(region ? { buildings: result } : result, 200, origin);
      }
      const intent = validateRequest(input);
      if (!await verifySession(token, intent.sessionId)) {
        throw new Rejection("central_session_required", 403);
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const context = await rpc("cw041_context", {
          p_actor: actor.id,
          p_operation: intent.operationId,
          p_intent: intent.intent,
        });
        if (context.receipt) {
          return encode(context.receipt, context.receipt.status, origin);
        }
        const result = processIntent(context, intent, actor.id, {
          maxEvaluations,
        });
        result.receipt.snapshot = publicSnapshot(result.state);
        const committed = await rpc("cw041_commit", {
          p_actor: actor.id,
          p_operation: intent.operationId,
          p_revision: context.revision,
          p_release: manifest.hash,
          p_state: result.state,
          p_complete: result.complete,
          p_target: result.remainingTarget,
          p_receipt: result.receipt,
          p_building: result.building,
        });
        if (committed.conflict) continue;
        return encode(committed.receipt, committed.receipt.status, origin);
      }
      return encode(
        { error: "concurrent_change_retry", retry: true },
        409,
        origin,
      );
    } catch (error) {
      if (error instanceof Rejection) {
        return encode({ error: error.code }, error.status, origin);
      }
      // Never leak SQL text, actor state, tokens or credentials to callers/logs.
      const code = error.code;
      if (code === "42501") {
        return encode({ error: "permission_denied" }, 403, origin);
      }
      if (code === "55000") {
        return encode({ error: "backend_not_configured" }, 503, origin);
      }
      if (code === "54000") {
        return encode({ error: "request_limit", retry: true }, 429, origin);
      }
      if (code === "22023") {
        return encode({ error: "operation_intent_mismatch" }, 409, origin);
      }
      if (code === "40001" || code === "40P01") {
        return encode({ error: "transaction_retry", retry: true }, 409, origin);
      }
      return encode({ error: "backend_request_failed" }, 503, origin);
    }
  };
}
