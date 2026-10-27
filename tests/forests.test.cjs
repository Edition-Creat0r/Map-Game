const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.join(__dirname, "..");
function load(seed = 734221, sampleOverride, zeroHash = false) {
  const c = {
    window: { mapGameWorldConfig: { WORLD_ROWS: 316 } },
    localStorage: { getItem: () => String(seed) },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "world_terrain.js"), "utf8"),
    c,
  );
  if (zeroHash) vm.runInNewContext("Math.imul = () => 0", c);
  if (sampleOverride) c.window.mapGameSharedTerrain.sample = sampleOverride;
  vm.runInNewContext(fs.readFileSync(path.join(root, "forest.js"), "utf8"), c);
  return c.window;
}
const w = load(),
  f = w.mapGameForest,
  t = w.mapGameSharedTerrain,
  plain = (v) => JSON.parse(JSON.stringify(v));
test("tree IDs, world positions, species and sizes survive reloads and LOD changes", () => {
  const again = load().mapGameForest;
  for (let z = 100; z < 125; z++)
    for (let x = 100; x < 125; x++) {
      const a = plain(f.treeAt(x, z));
      for (const zoom of [0.24, 0.32, 0.38, 0.44, 0.65, 0.72, 0.8, 0.92, 2]) {
        f.lod(zoom);
        assert.deepEqual(plain(again.treeAt(x, z)), a);
      }
    }
});
test("half-open chunk queries form a partition with no duplicate or missing roots", () => {
  const all = f.treesInBounds(0, 0, 2048, 1024),
    left = f.treesInBounds(0, 0, 512, 1024),
    right = f.treesInBounds(512, 0, 2048, 1024);
  const ids = (a) => Array.from(a, (t) => t.id).sort();
  assert.deepEqual(ids([...left, ...right]), ids(all));
  assert.equal(new Set(ids(all)).size, all.length);
  for (const tree of all) {
    assert.ok(tree.x >= 0 && tree.x < 2048 && tree.z >= 0 && tree.z < 1024);
  }
});
test("strategic/local cover potential agrees at identical coordinates", () => {
  for (let i = 0; i < 316; i += 3) {
    const j = (i * 71) % 316;
    assert.equal(
      f.coverage(t.strategic(i, j)),
      f.coverage(t.local(i, j, 16384, 16384)),
    );
    assert.equal(
      f.densityAt(t.strategic(i, j), (i + 0.5) * 32768, (j + 0.5) * 32768),
      f.densityAt(
        t.local(i, j, 16384, 16384),
        (i + 0.5) * 32768,
        (j + 0.5) * 32768,
      ),
    );
  }
});
test("all families have stable species and differentiated density, with water/slope/treeline exclusion", () => {
  const rates = {};
  for (const id of Object.keys(f.families)) {
    const s = {
      water: false,
      elevation: 0.45,
      steepness: 0.1,
      forest: 0.7,
      biome: {
        temperature: id === "tundra_snow" ? 0.27 : 0.6,
        weights: { [id]: 1 },
      },
    };
    const g = load(734221, () => s).mapGameForest;
    let count = 0;
    for (let z = 0; z < 40; z++)
      for (let x = 0; x < 40; x++) {
        const tree = g.treeAt(x, z);
        if (tree) {
          count++;
          assert.equal(tree.family, id);
          if (id === "taiga") assert.equal(tree.species, "spruce");
          if (id === "wetlands") assert.equal(tree.species, "willow");
          if (id === "alpine") assert.equal(tree.species, "pine");
          if (id === "tundra_snow") assert.equal(tree.species, "scrub");
        }
      }
    rates[id] = count;
    for (const patch of [
      { water: true },
      { elevation: 0.99 },
      { steepness: 0.7 },
    ])
      assert.equal(g.coverage({ ...s, ...patch }), 0);
  }
  assert.ok(rates.temperate_forest > rates.grassland * 3);
  assert.ok(rates.taiga > rates.tundra_snow * 5);
  assert.ok(rates.wetlands > rates.dry_plains * 3);
  console.log("Controlled 1600-candidate biome counts:", rates);
});
test("LOD weights are continuous and never depend on panning or candidate identities", () => {
  for (let zoom = 0.24; zoom < 2; zoom += 0.001) {
    const a = f.lod(zoom),
      b = f.lod(zoom + 0.0001);
    for (const key of ["medium", "close"]) {
      assert.ok(a[key] >= 0 && a[key] <= 1);
      assert.ok(Math.abs(a[key] - b[key]) < 0.002);
    }
  }
});

test("real trees respect water and treeline; territory partitions do not lose roots", () => {
  for (let iz = 0; iz < 120; iz += 3)
    for (let ix = 0; ix < 120; ix += 3) {
      const tree = f.treeAt(ix, iz);
      if (tree) {
        const s = t.sample(tree.x, tree.z);
        assert.equal(s.water, false);
        assert.ok(s.steepness < 0.69);
        assert.ok(s.elevation < 0.7 + s.biome.temperature * 0.24);
      }
    }
  const whole = f.treesInBounds(32000, 1000, 33500, 2500),
    parts = [
      ...f.treesInBounds(32000, 1000, 32768, 2500),
      ...f.treesInBounds(32768, 1000, 33500, 2500),
    ];
  assert.deepEqual(
    Array.from(whole, (t) => t.id).sort(),
    Array.from(parts, (t) => t.id).sort(),
  );
});

test("a zero-valued hash never selects a zero-weight biome family", () => {
  const sample = {
    water: false,
    elevation: 0.45,
    steepness: 0.1,
    forest: 0.7,
    biome: { temperature: 0.6, weights: { taiga: 1 } },
  };
  const tree = load(734221, () => sample, true).mapGameForest.treeAt(0, 0);
  assert.equal(tree.family, "taiga");
  assert.equal(tree.species, "spruce");
});
