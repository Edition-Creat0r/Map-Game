import { kinds } from "./policy.mjs";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons = [
  "inappropriate",
  "impersonation",
  "privacy",
  "other",
  "correction",
  "appeal",
];
const response = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
    },
  });
export function validateIntent(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw Error("invalid");
  }
  const extra = {
    rename: ["kind", "entity", "name"],
    report: ["kind", "entity", "reason"],
    hide: ["kind", "entity", "reason", "revision"],
    force_rename: ["kind", "entity", "name", "reason", "revision"],
    review: ["reviewId", "decision"],
    resolve_report: ["reportId", "resolution"],
    queue: [],
  }[data.action];
  if (
    !extra ||
    Object.keys(data).some((k) =>
      !["action", ...(data.action === "queue" ? [] : ["operationId"]), ...extra]
        .includes(k)
    ) || extra.some((k) => !Object.hasOwn(data, k)) ||
    (data.action !== "queue" && !uuid.test(data.operationId || ""))
  ) throw Error("invalid");
  if (
    data.kind !== undefined &&
    (!kinds.includes(data.kind) || typeof data.entity !== "string" ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(data.entity))
  ) throw Error("invalid");
  if (
    ["hide", "force_rename"].includes(data.action) &&
    (!Number.isSafeInteger(data.revision) || data.revision < 0)
  ) throw Error("invalid");
  if (
    data.name !== undefined &&
    (typeof data.name !== "string" || data.name.length > 256)
  ) throw Error("invalid");
  if (data.reason !== undefined && !reasons.includes(data.reason)) {
    throw Error("invalid");
  }
  if (
    data.action === "review" &&
    (!uuid.test(data.reviewId || "") ||
      !["approve", "reject"].includes(data.decision))
  ) throw Error("invalid");
  if (
    data.action === "resolve_report" &&
    (!uuid.test(data.reportId || "") ||
      !["resolved", "dismissed"].includes(data.resolution))
  ) throw Error("invalid");
  const { operationId, ...intent } = data;
  if (["username", "city"].includes(intent.kind)) {
    if (!uuid.test(intent.entity)) throw Error("invalid");
    intent.entity = intent.entity.toLowerCase();
  } else if (intent.kind === "building") {
    const parts = intent.entity.split(":");
    if (parts.length !== 2 || parts.some((p) => !uuid.test(p))) {
      throw Error("invalid");
    }
    intent.entity = parts.map((p) => p.toLowerCase()).join(":");
  }
  if (intent.reviewId) intent.reviewId = intent.reviewId.toLowerCase();
  if (intent.reportId) intent.reportId = intent.reportId.toLowerCase();
  return { operationId: operationId?.toLowerCase(), intent };
}
/** @param {{enabled?:boolean,origins?:string[],auth:(token:string)=>Promise<any>,rpc:(name:string,args:any)=>Promise<any>,policy:any}} options */
export function createNamingHandler(
  { enabled = false, origins = [], auth, rpc, policy },
) {
  return async (req) => {
    const origin = req.headers.get("Origin") || "";
    if (origin && !origins.includes(origin)) {
      return response({ error: "origin_not_allowed" }, 403, "");
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          Vary: "Origin",
        },
      });
    }
    if (!enabled || !policy) {
      return response({ error: "public_naming_disabled" }, 503, origin);
    }
    if (req.method !== "POST") {
      return response({ error: "method_not_allowed" }, 405, origin);
    }
    if (!req.headers.get("Content-Type")?.startsWith("application/json")) {
      return response({ error: "json_required" }, 415, origin);
    }
    try {
      const token = /^Bearer (\S+)$/.exec(
        req.headers.get("Authorization") || "",
      )?.[1];
      if (!token || token.length > 8192) {
        return response({ error: "authentication_required" }, 401, origin);
      }
      const user = await auth(token);
      if (!user?.id || !user.email_confirmed_at) {
        return response({ error: "verified_account_required" }, 403, origin);
      }
      const reader = req.body?.getReader();
      if (!reader) return response({ error: "invalid_request" }, 400, origin);
      let text = "", count = 0, timer;
      const decoder = new TextDecoder();
      try {
        await Promise.race([
          (async () => {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              count += value.length;
              if (count > 4096) throw Error("body_limit");
              text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error("body_timeout")), 5000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        await reader.cancel().catch(() => {});
      }
      let op;
      try {
        op = validateIntent(JSON.parse(text));
      } catch (_) {
        return response({ error: "invalid_request" }, 400, origin);
      }
      if (op.intent.action === "queue") {
        const data = await rpc("cw041_names_queue", { p_actor: user.id });
        return data.limited
          ? response({ error: "name_attempt_limit" }, 429, origin)
          : response(data, 200, origin);
      }
      const context = await rpc("cw041_names_begin", {
        p_actor: user.id,
        p_operation: op.operationId,
        p_intent: op.intent,
      });
      if (context.receipt) {
        return response(context.receipt, context.receipt.status, origin);
      }
      if (context.policyHash !== policy.hash) {
        return response({ error: "public_naming_unavailable" }, 503, origin);
      }
      let assessment = { decision: "approve" };
      if (["rename", "force_rename"].includes(op.intent.action)) {
        assessment = policy.assess(op.intent.name, op.intent.kind);
      }
      if (op.intent.action === "review" && op.intent.decision === "approve") {
        if (!context.review) {
          return response({ error: "review_unavailable" }, 409, origin);
        }
        assessment = policy.assess(
          context.review.candidate.display,
          context.review.kind,
        );
        // Manual review can resolve ambiguity, never override a hard policy rejection.
        if (assessment.decision === "review") {
          assessment = { ...assessment, decision: "approve" };
        }
      }
      const result = await rpc("cw041_names_finish", {
        p_actor: user.id,
        p_operation: op.operationId,
        p_hash: policy.hash,
        p_decision: assessment.decision,
        p_value: assessment.display ? assessment : null,
      });
      return response(result, result.status, origin);
    } catch (e) {
      if (e.code === "42501") {
        return response({ error: "permission_denied" }, 403, origin);
      }
      if (e.code === "22023" || e.code === "22P02" || e.code === "P0002") {
        return response({ error: "request_unavailable" }, 409, origin);
      }
      if (e.code === "40001" || e.code === "40P01") {
        return response(
          { error: "transaction_retry", retry: true },
          409,
          origin,
        );
      }
      if (e.message === "body_limit") {
        return response({ error: "request_too_large" }, 413, origin);
      }
      if (e.message === "body_timeout") {
        return response({ error: "request_timeout" }, 408, origin);
      }
      return response({ error: "public_naming_unavailable" }, 503, origin);
    }
  };
}
