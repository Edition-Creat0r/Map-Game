const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.join(__dirname, "..");
function load(seed = 734221) {
  const c = {
    window: { mapGameWorldConfig: { WORLD_ROWS: 316 } },
    localStorage: { getItem: () => String(seed) },
    performance,
    setTimeout,
  };
  for (const f of [
    "world_terrain.js",
    "forest.js",
    "environment.js",
    "hydrology.js",
  ])
    vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), c);
  return c.window;
}
const w = load(),
  terrain = w.mapGameSharedTerrain,
  env = w.mapGameEnvironment,
  hydro = w.mapGameHydrology;
test("raster world coordinates match local samples without a half-cell offset", () => {
  for (let x = 0; x < 316; x += 7) {
    const y = (x * 71) % 316;
    assert.equal(
      env.sampleWorld(x + 0.25, y + 0.75).elevation,
      terrain.local(x, y, 8192, 24576).elevation,
    );
  }
});
test("height halos give identical shade at shared chunk and territory boundaries", async () => {
  for (const boundary of [512, 32768]) {
    const step = 512 / 63;
    const a = await env.grid(
        64,
        4,
        boundary - 512,
        10000,
        step,
        terrain.sample,
        () => true,
      ),
      b = await env.grid(
        64,
        4,
        boundary,
        10000,
        step,
        terrain.sample,
        () => true,
      );
    function shade(g, x, y) {
      const i = (y + 1) * g.stride + x + 1,
        h = g.heights;
      return env.shade(
        h[i - 1],
        h[i + 1],
        h[i - g.stride],
        h[i + g.stride],
        h[i],
        g.step,
      );
    }
    assert.ok(Math.abs(shade(a, 63, 2) - shade(b, 0, 2)) < 1e-9);
  }
});
test("incremental raster jobs cancel before publication", async () => {
  assert.equal(
    await env.grid(64, 64, 0, 0, 10, terrain.sample, () => false),
    null,
  );
});
test("drainage is deterministic, descending, joining by node ID and non-narrowing", () => {
  let count = 0,
    joined = 0;
  for (const [tx, tz] of [
    [38, 38],
    [75, 18],
    [2, 20],
  ]) {
    const tile = hydro.tile(tx, tz),
      again = hydro.tile(tx, tz);
    assert.equal(JSON.stringify(tile), JSON.stringify(again));
    const ids = new Set();
    for (const e of tile.edges) {
      assert.ok(!ids.has(e.id));
      ids.add(e.id);
      for (let i = 1; i < e.points.length; i++) {
        const a = e.points[i - 1],
          b = e.points[i];
        assert.ok(b.h <= a.h + 1e-12);
        assert.ok(b.width >= a.width - 1e-9);
        assert.equal(b.h, terrain.elevationAt(b.x, b.z));
      }
      const next = hydro.edge(e.ix, e.iz);
      if (next) {
        joined++;
        assert.equal(
          JSON.stringify(e.points.at(-1)),
          JSON.stringify(next.points[0]),
        );
      }
      count++;
    }
  }
  assert.ok(count > 0);
  assert.ok(joined > 0);
});
test("query halos include every possible bounded source, including territory borders", () => {
  const a = hydro.sourceTiles(0, 0, 32768, 32768),
    b = hydro.sourceTiles(32768, 0, 65536, 32768);
  assert.ok(a.some((x) => b.some((y) => x.key === y.key)));
  assert.ok(hydro.HALO >= hydro.MAX_STEPS * hydro.GRID);
  assert.ok(hydro.cacheStats().nodes <= 65536);
});

test("all 5000 frozen 0.3.3B forest candidates retain IDs, positions, sizes and species", () => {
  const expected = require("./forest-033b-fingerprint.json"),
    records = [];
  for (let i = 0; i < expected.count; i++) {
    const ix = (i * 193) % 143000,
      iz = (i * 719) % 143000;
    records.push([ix, iz, w.mapGameForest.treeAt(ix, iz)]);
  }
  assert.equal(
    crypto.createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    expected.sha256,
  );
});
test("packed rasters match retained samples without retaining biome objects", async () => {
  const alive = () => true,
    color = (s) => [s.elevation * 100, s.moisture * 100, s.temperature * 100];
  const raw = await env.grid(8, 8, 1000, 2000, 20, terrain.sample, alive),
    packed = await env.grid(8, 8, 1000, 2000, 20, terrain.sample, alive, color);
  assert.equal(packed.samples, null);
  assert.deepEqual(
    Array.from(await env.paint(raw, color, alive)),
    Array.from(await env.paint(packed, null, alive)),
  );
});

test("padded chunk rasters agree exactly in their shared color texels", async () => {
  const color = (s) => env.color(s, 110, 145, 95),
    alive = () => true;
  const a = await env.grid(
      66,
      4,
      32768 - 512 - 4,
      10000,
      8,
      terrain.sample,
      alive,
      color,
    ),
    b = await env.grid(
      66,
      4,
      32768 - 4,
      10000,
      8,
      terrain.sample,
      alive,
      color,
    );
  const ca = await env.paint(a, null, alive),
    cb = await env.paint(b, null, alive);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 2; x++)
      assert.deepEqual(
        Array.from(ca.slice((y * 66 + 64 + x) * 4, (y * 66 + 65 + x) * 4)),
        Array.from(cb.slice((y * 66 + x) * 4, (y * 66 + x + 1) * 4)),
      );
});

test("drainage survives reloads and query partitions across a territory boundary", () => {
  const reference = hydro.tile(38, 38);
  assert.equal(
    JSON.stringify(reference),
    JSON.stringify(load().mapGameHydrology.tile(38, 38)),
  );
  const crossing = reference.edges.find(
    (e) =>
      Math.floor(e.points[0].x / 32768) !==
      Math.floor(e.points.at(-1).x / 32768),
  );
  assert.ok(crossing);
  const a = crossing.points[0],
    b = crossing.points.at(-1),
    cut = (Math.floor(Math.min(a.x, b.x) / 32768) + 1) * 32768,
    z = (a.z + b.z) / 2;
  function query(left, right) {
    const result = new Map();
    for (const tile of hydro.sourceTiles(left, z - 4096, right, z + 4096))
      for (const e of hydro.tile(tile.tx, tile.tz).edges) {
        const p = e.points[0],
          q = e.points.at(-1);
        if (
          e.bounds.right >= left &&
          e.bounds.left < right &&
          e.bounds.bottom >= z - 4096 &&
          e.bounds.top < z + 4096
        )
          result.set(e.id, e);
      }
    return result;
  }
  const left = query(cut - 4096, cut),
    right = query(cut, cut + 4096),
    all = query(cut - 4096, cut + 4096);
  assert.ok(left.has(crossing.id) && right.has(crossing.id));
  assert.equal(
    JSON.stringify(left.get(crossing.id)),
    JSON.stringify(right.get(crossing.id)),
  );
  assert.deepEqual(
    [...new Set([...left.keys(), ...right.keys()])].sort(),
    [...all.keys()].sort(),
  );
});

test("published channels terminate naturally instead of at trace-budget cutoffs", () => {
  const tile = hydro.tile(38, 38),
    byId = new Map(tile.edges.map((e) => [e.id, e]));
  for (const source of tile.sources) {
    assert.notEqual(source.termination, "budget");
    assert.ok(source.edges.length <= hydro.MAX_STEPS);
  }
  for (const e of tile.edges) {
    const next = hydro.edge(e.ix, e.iz);
    if (next) assert.ok(byId.has(next.id), "missing downstream continuation");
  }
});
