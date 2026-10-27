const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { execFileSync } = require("node:child_process"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
function load(code) {
  const c = {
    window: { mapGameWorldConfig: { WORLD_ROWS: 316 } },
    localStorage: { getItem: () => "734221" },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "world_terrain.js"), "utf8"),
    c,
  );
  vm.runInNewContext(code, c);
  return c.window.mapGameForest;
}
const current = load(fs.readFileSync(path.join(root, "forest.js"), "utf8")),
  before = load(
    execFileSync("git", ["show", "dfbe4ff:forest.js"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
test("visual restoration preserves all deterministic tree records across real biome territories", () => {
  for (const [tx, tz] of [
    [140, 180],
    [48, 160],
    [256, 64],
    [260, 108],
    [168, 75],
  ])
    for (let j = 0; j < 400; j++) {
      const ix = Math.floor((tx * 32768 + 15000) / 72) + (j % 20),
        iz = Math.floor((tz * 32768 + 15000) / 72) + Math.floor(j / 20);
      assert.deepEqual(
        JSON.parse(JSON.stringify(current.treeAt(ix, iz))),
        JSON.parse(JSON.stringify(before.treeAt(ix, iz))),
      );
    }
});
test("default local zoom now displays tree detail with continuous presentation transitions", () => {
  assert.ok(current.lod(0.32).medium > 0.9);
  assert.ok(current.lod(0.32).close > 0.9);
  for (let zoom = 0.18; zoom < 2; zoom += 0.001) {
    const a = current.lod(zoom),
      b = current.lod(zoom + 0.0001);
    for (const id of ["medium", "close"])
      assert.ok(a[id] >= 0 && a[id] <= 1 && Math.abs(a[id] - b[id]) < 0.002);
  }
});
