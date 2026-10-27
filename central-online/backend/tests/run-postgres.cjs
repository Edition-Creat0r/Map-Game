// Disposable local PostgreSQL only. No project URL, credentials, host ports or volumes.
const { spawnSync, execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../../.."),
  out = process.argv[2] || "/tmp/mapgame041-postgres";
fs.mkdirSync(out, { recursive: true });
const name = "mapgame041-test-" + process.pid,
  image =
    "postgres:16-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab";
const run = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...options });
  if (r.status !== 0) throw Error(r.stderr || r.stdout || "Command failed");
  return r.stdout;
};
(async () => {
  try {
    run("docker", [
      "run",
      "-d",
      "--rm",
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
    if (!ready) throw Error("Isolated PostgreSQL did not start");
    const migrationLog = [];
    for (
      const f of [
        "tests/bootstrap.sql",
        "migrations/001_backend.sql",
        "migrations/002_pin_rules.sql",
        "migrations/003_legacy_coordination.sql",
      ]
    ) {
      migrationLog.push(
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
        ], {
          input: fs.readFileSync(
            path.join(root, "central-online/backend", f),
            "utf8",
          ),
        }),
      );
    }
    fs.writeFileSync(path.join(out, "migrations.log"), migrationLog.join("\n"));
    const enabled = run("docker", [
      "exec",
      name,
      "psql",
      "-U",
      "postgres",
      "-d",
      "mapgame",
      "-Atc",
      "SELECT enabled FROM cw041.settings",
    ]);
    if (enabled.trim() !== "f") throw Error("Backend must default OFF");
    const r = spawnSync(process.execPath, [
      "--test",
      "--test-concurrency=1",
      "central-online/backend/tests/backend.test.cjs",
    ], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CW041_TEST_CONTAINER: name },
    });
    fs.writeFileSync(path.join(out, "tests.log"), r.stdout + "\n" + r.stderr);
    fs.writeFileSync(
      path.join(out, "result.json"),
      JSON.stringify(
        {
          mode:
            "isolated PostgreSQL with synthetic legacy/auth fixtures; NOT Supabase staging",
          image,
          defaultEnabled: false,
          testExit: r.status,
        },
        null,
        2,
      ),
    );
    console.log(r.stdout);
    if (r.status !== 0) throw Error("Backend tests failed");
  } finally {
    spawnSync("docker", ["stop", name], { stdio: "ignore" });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
