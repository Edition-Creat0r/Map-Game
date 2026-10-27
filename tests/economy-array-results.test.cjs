const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  { Module } = require("node:module"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  M = require("../economy_model.js"),
  P = require("../industrial/progression.js"),
  R = require("../industrial/registry.js"),
  ref = new Module(path.join(root, "pre-array-c1.cjs"));
ref.filename = path.join(root, "pre-array-c1.cjs");
ref.paths = module.paths;
ref._compile(
  execFileSync("git", ["show", "122e575:economy_model.js"], {
    cwd: root,
    encoding: "utf8",
  }),
  ref.filename,
);
const before = ref.exports;
const c = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
for (const f of ["buildings.js", "industrial/integration.js"])
  vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), c);
const defs = M.clone(c.window.mapGameBuildings.CATALOG),
  epoch = 1800000000000;
function city() {
  const types = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "cornerStore",
    "ironMine",
    "coalMine",
    "ironSmelter",
    "cokeWorks",
    "steelFoundry",
  ];
  const s = M.normalize(
    {
      money: 1e9,
      steel: 100,
      carbon: 40,
      iron: 0,
      inventory: { ironOre: 3, coal: 2, unknown: 17 },
      custom: { keep: true },
      placedIncomeItems: Array.from({ length: 144 }, (_, i) => ({
        id: "a" + i,
        type: types[i % types.length],
        level: 1 + (i % 3),
      })),
      economy: {
        version: 3,
        population: 40,
        lastTick: epoch,
        pendingMs: 1537,
        pendingBoostMs: 123,
        unknown: "keep",
      },
    },
    epoch,
  );
  M.bindContracts(s, defs, 3);
  P.init(s, defs, { legacy: true });
  return s;
}
test("array construction preserves complete pre-optimization results with mixed visibility, sparse resources, shortages and automatic order", () => {
  for (const automatic of [false, true]) {
    const a = city();
    if (automatic) P.priorities(a, defs, "automatic", M);
    const b = M.clone(a);
    for (const [elapsed, online] of [
      [500, true],
      [8000, false],
      [14567, true],
      [22345, false],
      [600000, true],
    ]) {
      assert.deepEqual(
        M.advance(a, epoch + elapsed, online, defs),
        before.advance(b, epoch + elapsed, online, defs),
      );
      assert.deepEqual(a, b);
      assert.deepEqual(
        M.summary(a, defs, online),
        before.summary(b, defs, online),
      );
    }
    M.flushPending(a, defs);
    before.flushPending(b, defs);
    assert.deepEqual(a, b);
  }
});
test("fixed resource/population slots retain exact long offline cycles, clamps and empty-city behavior", () => {
  for (const types of [
    [],
    ["smallHouse", "powerPlant", "cornerStore"],
    ["smallHouse", "powerPlant", "steelMill", "carbonPlant"],
  ]) {
    const a = M.normalize(
      {
        money: 1e12,
        steel: 1e12 - 1,
        carbon: 1e12 - 1,
        placedIncomeItems: types.map((type, i) => ({
          id: "b" + i,
          type,
          level: 1,
        })),
        economy: { version: 3, lastTick: epoch, population: 100 },
      },
      epoch,
    );
    M.bindContracts(a, defs, 3);
    P.init(a, defs, { legacy: true });
    const b = M.clone(a);
    const options = { maxEvaluations: 2 };
    let x, y;
    do {
      x = M.advance(a, epoch + 1000 * 365.25 * 86400000, false, defs, options);
      y = before.advance(
        b,
        epoch + 1000 * 365.25 * 86400000,
        false,
        defs,
        options,
      );
      assert.deepEqual(x, y);
      assert.deepEqual(a, b);
    } while (!x.complete);
    assert.deepEqual(M.summary(a, defs), before.summary(b, defs));
  }
});
