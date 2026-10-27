const { spawn, spawnSync } = require("node:child_process");
const container = process.env.CW041_TEST_CONTAINER || "mapgame041-checkpoint1";
function query(sql) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "mapgame",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => out += d);
    p.stderr.on("data", (d) => err += d);
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code) {
        const e = Error(err.trim());
        e.code = /42501|permission denied/.test(err)
          ? "42501"
          : /economy_disabled|release_mismatch|coordination_required|reconciliation_required/
              .test(err)
          ? "55000"
          : /operation_intent_mismatch/.test(err)
          ? "22023"
          : /rate_limited|too_many_pending/.test(err)
          ? "54000"
          : /not_territory_owner|not_world_member|unverified_actor|unowned_territory|invalid_or_protected/
              .test(err)
          ? "42501"
          : undefined;
        reject(e);
      } else resolve(out.trim());
    });
    p.stdin.end(sql);
  });
}
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
async function rpc(name, args) {
  const fields = {
    cw041_context: ["p_actor", "p_operation", "p_intent"],
    cw041_commit: [
      "p_actor",
      "p_operation",
      "p_revision",
      "p_release",
      "p_state",
      "p_complete",
      "p_target",
      "p_receipt",
      "p_building",
    ],
    cw041_region: ["p_actor", "p_territory"],
    cw041_status: ["p_actor"],
  }[name];
  const values = fields.map((k) =>
    args[k] === null
      ? "null"
      : typeof args[k] === "object"
      ? quote(JSON.stringify(args[k])) + "::jsonb"
      : typeof args[k] === "number" || typeof args[k] === "boolean"
      ? String(args[k])
      : quote(args[k])
  );
  return JSON.parse(
    await query(
      `SET ROLE service_role; SELECT public.${name}(${values.join(",")});`,
    ),
  );
}
module.exports = { query, rpc, quote, container };
