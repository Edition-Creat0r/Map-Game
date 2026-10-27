// Sequential release validation: avoid overlapping browser/solver benchmarks.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const output = process.argv[2] || "/tmp/map-game-c1-release";
fs.mkdirSync(output, { recursive: true });
const root = path.resolve(__dirname, ".."),
  steps = [
    [
      "automated",
      [
        "--test",
        ...fs
          .readdirSync(__dirname)
          .filter((f) => f.endsWith(".test.cjs"))
          .map((f) => "tests/" + f),
      ],
    ],
    [
      "c1-browser",
      ["tests/phase-c1-browser.cjs", path.join(output, "c1-browser")],
    ],
    ["starter", ["tests/economy-browser.cjs", path.join(output, "starter")]],
    [
      "phase-b-regression",
      ["tests/phase-b-browser.cjs", path.join(output, "phase-b-regression")],
    ],
    ["forest", ["tests/forest-browser.cjs", path.join(output, "forest")]],
    [
      "environment",
      ["tests/environment-browser.cjs", path.join(output, "environment")],
    ],
    [
      "large-starter",
      ["tests/industrial-browser.cjs", path.join(output, "large-starter")],
    ],
    [
      "large-industry",
      ["tests/industrial-browser.cjs", path.join(output, "large-industry")],
      { INDUSTRIAL_FIXTURE: "phase_b" },
    ],
    [
      "comparison",
      ["tests/economy-performance.cjs", path.join(output, "comparison")],
      { MAP_GAME_BASELINE_REF: "03adac1" },
    ],
    [
      "shop-comparison",
      [
        "tests/progression-shop-performance.cjs",
        path.join(output, "shop-comparison"),
      ],
    ],
    ["model", ["tests/phase-c1-benchmark.cjs", path.join(output, "model")]],
    [
      "rc-performance",
      ["tests/economy-rc-benchmark.cjs", path.join(output, "rc-performance")],
    ],
  ];
(async () => {
  const results = [];
  for (const [name, args, extra] of steps) {
    console.log("START " + name);
    const start = Date.now(),
      log = fs.openSync(path.join(output, name + ".log"), "w");
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, {
        cwd: root,
        env: { ...process.env, ...extra },
        stdio: ["ignore", log, log],
      });
      child.on("exit", resolve);
      child.on("error", (e) => {
        fs.writeSync(log, String(e));
        resolve(-1);
      });
    });
    fs.closeSync(log);
    results.push({ name, code, ms: Date.now() - start });
    fs.writeFileSync(
      path.join(output, "release-results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log("END " + name + " code=" + code);
    if (code !== 0) throw Error("Release gate failed: " + name);
  }
  // Some inherited browser tools report rather than assert their error arrays.
  function inspect(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) inspect(p);
      else if (name.endsWith(".json")) {
        const data = JSON.parse(fs.readFileSync(p));
        for (const r of Array.isArray(data) ? data : [data])
          for (const key of ["errors", "http", "failed"])
            if (Array.isArray(r[key]) && r[key].length)
              throw Error(p + " " + key + ": " + JSON.stringify(r[key]));
      }
    }
  }
  inspect(output);
  console.log("All release suites and browser error-array gates passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
