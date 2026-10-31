// No remote DB options, credentials, published ports, volumes, or network.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "../../../..");
const dir = path.resolve(__dirname, "..");
const out = path.resolve(process.argv[2] || "/tmp/mapgame-staging-hardening");
fs.mkdirSync(out, { recursive: true });
const name = "mapgame-staging-draft-" + process.pid;
const image =
  "postgres:16-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab";
function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", input });
  if (r.status !== 0) throw Error(r.stderr || r.stdout || `${cmd} failed`);
  return r.stdout;
}
const sql = (s) =>
  run("docker", [
    "exec",
    "-i",
    name,
    "psql",
    "-U",
    "postgres",
    "-d",
    "mapgame",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
  ], s);
(async () => {
  try {
    run("docker", [
      "run",
      "-d",
      "--rm",
      "--pull=never",
      "--network",
      "none",
      "--name",
      name,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-e",
      "POSTGRES_DB=mapgame",
      image,
    ]);
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (
        spawnSync("docker", ["exec", name, "cat", "/proc/1/comm"], {
            encoding: "utf8",
          }).stdout?.trim() === "postgres" &&
        spawnSync("docker", [
            "exec",
            name,
            "pg_isready",
            "-U",
            "postgres",
            "-d",
            "mapgame",
          ]).status === 0
      ) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) throw Error("Isolated PostgreSQL not ready");
    sql(
      fs.readFileSync(path.join(__dirname, "legacy-model.fixture.sql"), "utf8"),
    );
    const draft = fs.readFileSync(
      path.join(dir, "draft/000_staging_legacy_security.DRAFT.sql"),
      "utf8",
    );
    // First prove the draft is inert without explicit acknowledgements.
    let guarded = false;
    try {
      sql("BEGIN;" + draft + "COMMIT;");
    } catch (e) {
      guarded = /staging identity and real schema approval required/.test(
        e.message,
      );
    }
    if (!guarded) throw Error("Draft approval guard did not fail closed");
    const tests = (f) => {
      const r = spawnSync(process.execPath, [
        "--test",
        "--test-concurrency=1",
        path.join(__dirname, f),
      ], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CW041_TEST_CONTAINER: name },
      });
      fs.writeFileSync(path.join(out, f + ".log"), r.stdout + "\n" + r.stderr);
      process.stdout.write(r.stdout);
      if (r.status !== 0) throw Error(f + " failed");
    };
    tests("exposure.test.cjs");
    tests("draft-contract.test.cjs");
    sql(
      "BEGIN;SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';SET LOCAL mapgame.legacy_schema_reviewed='yes';" +
        draft + "COMMIT;",
    );
    for (
      const f of [
        "001_backend.sql",
        "002_pin_rules.sql",
        "003_legacy_coordination.sql",
      ]
    ) sql(fs.readFileSync(path.join(dir, "../migrations", f), "utf8"));
    if (sql("SELECT enabled FROM cw041.settings").trim() !== "f") {
      throw Error("Draft enabled economy");
    }
    tests("security.test.cjs");
    fs.writeFileSync(
      path.join(out, "result.json"),
      JSON.stringify(
        {
          mode:
            "network-isolated synthetic schema + real PostgreSQL; NOT live Supabase",
          image,
          approvalGuardPassed: true,
          order: ["synthetic baseline", "hardening draft", "001", "002", "003"],
          defaultEnabled: false,
          passed: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    spawnSync("docker", ["stop", name], { stdio: "ignore" });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
