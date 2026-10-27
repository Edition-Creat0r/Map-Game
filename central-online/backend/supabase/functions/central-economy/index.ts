// Supabase Edge entry point. Deploy ONLY after staging review; off by default.
import { createHandler } from "../../../handler.mjs";
const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const origins = (Deno.env.get("CENTRAL_ALLOWED_ORIGINS") || "").split(",")
  .filter(Boolean);
const enabled = Deno.env.get("CENTRAL_ECONOMY_ENABLED") === "true";
if (
  enabled &&
  (!url.startsWith("https://") || !key || !publicKey || !origins.length)
) throw Error("Missing trusted backend configuration");
for (const origin of origins) {
  const u = new URL(origin);
  if (
    u.origin !== origin ||
    !(u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
  ) {
    throw Error(
      "Origins must be explicit HTTPS origins (or local development loopback)",
    );
  }
}
async function rpc(name: string, args: unknown, token = key) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: token === key ? key : publicKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json();
  if (!r.ok) {
    const error = new Error("Backend RPC failed");
    Object.assign(error, { code: data.code });
    throw error;
  }
  return data;
}
Deno.serve(createHandler({
  enabled,
  origins,
  auth: async (token: string) => {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? await r.json() : null;
  },
  verifySession: async (token: string, session: string) =>
    (await rpc("map_game_session_heartbeat", {
      p_world_id: "central",
      p_session_id: session,
    }, token)) === true,
  rpc,
}));
