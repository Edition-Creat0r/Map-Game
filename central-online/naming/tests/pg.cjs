const { spawn } = require("node:child_process");
const container = process.env.CW041_TEST_CONTAINER;
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
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
    p.stdout.on("data", (b) => out += b);
    p.stderr.on("data", (b) => err += b);
    p.on("error", reject);
    p.on("exit", (c) => {
      if (c) {
        const e = Error(err);
        e.code = /ERROR:\s+([A-Z0-9]{5}):/.exec(err)?.[1];
        reject(e);
      } else resolve(out.trim());
    });
    p.stdin.end("\\set VERBOSITY verbose\n" + sql);
  });
}
const signatures = {
  cw041_names_begin: ["p_actor", "p_operation", "p_intent"],
  cw041_names_finish: [
    "p_actor",
    "p_operation",
    "p_hash",
    "p_decision",
    "p_value",
  ],
  cw041_names_queue: ["p_actor"],
  cw041_names_public: ["p_kind", "p_entity"],
};
async function rpc(name, args) {
  const values = signatures[name].map((k) =>
    args[k] === null
      ? "null"
      : typeof args[k] === "object"
      ? quote(JSON.stringify(args[k])) + "::jsonb"
      : quote(args[k])
  );
  return JSON.parse(
    await query(
      `SET ROLE service_role; SELECT public.${name}(${values.join(",")});`,
    ),
  );
}
module.exports = { query, rpc, quote };
