import { compilePolicy } from "../../../policy.mjs";
import { createNamingHandler } from "../../../handler.mjs";
const enabled = Deno.env.get("PUBLIC_NAMING_ENABLED") === "true";
const url = Deno.env.get("SUPABASE_URL") || "",
  key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const origins = (Deno.env.get("CENTRAL_ALLOWED_ORIGINS") || "").split(",")
  .filter(Boolean);
if (
  enabled &&
  (!url.startsWith("https://") || !key || !publicKey || !origins.length)
) throw Error("Missing server configuration");
for (const origin of origins) {
  const u = new URL(origin);
  if (
    u.origin !== origin ||
    !(u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
  ) throw Error("Explicit origin required");
}
const policy = enabled
  ? await compilePolicy(Deno.env.get("NAMING_POLICY_JSON"))
  : null;
Deno.serve(
  createNamingHandler({
    enabled,
    origins,
    policy,
    auth: async (token: string) => {
      const r = await fetch(url + "/auth/v1/user", {
        headers: { apikey: publicKey, Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(8000),
      });
      return r.ok ? await r.json() : null;
    },
    rpc: async (name: string, args: unknown) => {
      const r = await fetch(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json();
      if (!r.ok) {
        const e = new Error("Backend naming request failed");
        Object.assign(e, { code: data.code });
        throw e;
      }
      return data;
    },
  }),
);
