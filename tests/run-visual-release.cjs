const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const out = process.argv[2] || "/tmp/map-game-visual-release";
fs.mkdirSync(out, { recursive: true });
const env = {
    ...process.env,
    MAP_GAME_VISUAL_BASELINE: "dfbe4ff",
    MAP_GAME_BASELINE_REF: "dfbe4ff",
  },
  steps = [
    ["release", ["tests/run-c1-release.cjs", path.join(out, "release")]],
    ["visual-ui", ["tests/visual-ui-browser.cjs", path.join(out, "visual-ui")]],
    [
      "screenshots",
      ["tests/visual-restoration-browser.cjs", path.join(out, "screenshots")],
    ],
  ],
  results = [];
for (const [name, args] of steps) {
  console.log("START " + name);
  const log = fs.openSync(path.join(out, name + ".log"), "w"),
    r = spawnSync(process.execPath, args, {
      cwd: path.resolve(__dirname, ".."),
      env,
      stdio: ["ignore", log, log],
    });
  fs.closeSync(log);
  results.push({ name, code: r.status });
  fs.writeFileSync(
    path.join(out, "visual-release-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("END " + name + " " + r.status);
  if (r.status !== 0) process.exit(r.status || 1);
}
