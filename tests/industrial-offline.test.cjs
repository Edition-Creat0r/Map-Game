const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const M = require("../economy_model.js"),
  epoch = 1800000000000,
  year = 365.25 * 86400000;
const context = { window: {}, console: { log() {} } };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../buildings.js"), "utf8"),
  context,
);
const catalog = JSON.parse(
  JSON.stringify(context.window.mapGameBuildings.CATALOG),
);
function city(types, defs = catalog, population = 40) {
  return M.normalize(
    {
      placedIncomeItems: types.map((type, i) => ({ id: String(i), type })),
      economy: { version: 1, population, lastTick: epoch },
    },
    epoch,
  );
}
function drain(s, target, online, defs, options) {
  let work = 0,
    passes = 0,
    result;
  do {
    result = M.advance(s, target, online, defs, options);
    work += result.evaluations;
    assert.ok(++passes < 10000, "catch-up never completes");
  } while (!result.complete);
  return { work, passes, result };
}
function compare(a, b) {
  for (const k of [...M.RESOURCES, "totalEarned"]) assert.equal(a[k], b[k], k);
  assert.deepEqual(a.economy, b.economy);
}
test("1000 years are processed without a cap or tick explosion; same timestamp cannot pay again", () => {
  const s = city([
    "smallHouse",
    "powerPlant",
    "steelMill",
    "carbonPlant",
    "cornerStore",
    "smallHouse",
  ]);
  const r = drain(s, epoch + 1000 * year, false, catalog);
  assert.ok(r.work < 30);
  assert.equal(r.result.complete, true);
  assert.equal(s.economy.lastTick, epoch + 1000 * year);
  assert.ok(s.money > 70e9);
  assert.ok(s.steel > 3e9);
  const before = M.clone(s);
  M.advance(s, epoch + 1000 * year, false, catalog);
  compare(s, before);
});
test("exact ledger makes batching, reload and arbitrary callback partitions identical", () => {
  const a = city(
      [
        "smallHouse",
        "powerPlant",
        "steelMill",
        "carbonPlant",
        "cornerStore",
        "smallHouse",
      ],
      catalog,
      0,
    ),
    b = M.clone(a);
  drain(a, epoch + 3 * 86400000, true, catalog);
  for (let t = 13001; t < 3 * 86400000; t += 79137)
    drain(b, epoch + t, true, catalog);
  drain(b, epoch + 3 * 86400000, true, catalog);
  compare(a, b);
  const reloaded = M.normalize(
    JSON.parse(JSON.stringify(a)),
    a.economy.lastTick,
  );
  compare(a, reloaded);
});
test("cooperative continuation preserves every outstanding millisecond and blocks no time on reload", () => {
  const a = city(
      [
        "smallHouse",
        "powerPlant",
        "steelMill",
        "carbonPlant",
        "cornerStore",
        "smallHouse",
      ],
      catalog,
      0,
    ),
    b = M.clone(a);
  const first = M.advance(b, epoch + 100 * year, false, catalog, {
    maxEvaluations: 1,
  });
  assert.equal(first.complete, false);
  assert.ok(b.economy.lastTick < epoch + 100 * year);
  const reloaded = M.normalize(b, b.economy.lastTick);
  drain(reloaded, epoch + 100 * year, false, catalog, { maxEvaluations: 2 });
  drain(a, epoch + 100 * year, false, catalog);
  compare(a, reloaded);
});
test("money exhaustion and saturated stores stop at the correct operating boundary", () => {
  const a = city(["smallHouse", "powerPlant", "steelMill"], catalog, 20);
  a.money = 4;
  const b = M.clone(a);
  drain(a, epoch + 100 * year, false, catalog);
  drain(b, epoch + 600000, false, catalog, {
    accelerate: false,
    maxEvaluations: 1000,
  });
  assert.equal(a.money, b.money);
  assert.equal(a.steel, b.steel);
  assert.equal(a.economy.population, b.economy.population);
  assert.ok(a.money >= 0);
  const saturated = city(
    ["smallHouse", "powerPlant", "steelMill"],
    catalog,
    20,
  );
  saturated.money = M.LIMIT;
  saturated.steel = M.LIMIT - 1;
  drain(saturated, epoch + 86400000, false, catalog);
  assert.equal(saturated.steel, M.LIMIT);
});
const recipeDefs = [
  { id: "mine", economy: { production: { iron: 6 } } },
  { id: "mill", economy: { inputs: { iron: 6 }, production: { steel: 6 } } },
  {
    id: "carbon",
    economy: { inputs: { steel: 6 }, production: { carbon: 6 } },
  },
];
test("input/output recipes consume starting stocks; future output cannot fund the same tick", () => {
  const a = city(["mill", "mine"], recipeDefs, 0);
  a.iron = 0;
  a.steel = 0;
  M.advance(a, epoch + 10000, false, recipeDefs);
  assert.equal(a.iron, 1);
  assert.equal(a.steel, 0);
  M.advance(a, epoch + 20000, false, recipeDefs);
  assert.equal(a.iron, 1);
  assert.equal(a.steel, 1);
  const blocked = city(["mill"], recipeDefs, 0);
  blocked.iron = 0;
  drain(blocked, epoch + 1000 * year, false, recipeDefs);
  assert.equal(blocked.steel, 100);
});
test("alternating material shortages are cycle-skipped without creating material or waiving inputs", () => {
  const defs = [
    { id: "feed", economy: { production: { iron: 3 } } },
    { id: "mill", economy: { inputs: { iron: 6 }, production: { steel: 6 } } },
  ];
  const a = city(["feed", "mill"], defs, 0);
  a.iron = 0;
  a.steel = 0;
  const b = M.clone(a);
  const short = epoch + 7 * 86400000;
  drain(a, short, false, defs);
  drain(b, short, false, defs, { accelerate: false, maxEvaluations: 100000 });
  compare(a, b);
  const r = drain(a, epoch + 1000 * year, false, defs);
  assert.ok(r.work < 20);
  assert.ok(a.steel > 1e9);
  assert.ok(a.iron <= 1);
});
test("seeded short scenarios match a one-tick reference across cash, inputs, power and population constraints", () => {
  let seed = 8831;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let n = 0; n < 100; n++) {
    const defs = [...catalog, ...recipeDefs],
      types = [];
    for (let i = 0; i < 8; i++)
      types.push(
        [
          "smallHouse",
          "powerPlant",
          "steelMill",
          "carbonPlant",
          "cornerStore",
          "mine",
          "mill",
          "carbon",
        ][Math.floor(rnd() * 8)],
      );
    const a = city(types, defs, rnd() * 40);
    a.money = rnd() * 100;
    a.iron = rnd() * 4;
    a.steel = rnd() * 4;
    a.carbon = rnd() * 4;
    const b = M.clone(a),
      target = epoch + Math.floor(rnd() * 6000000);
    drain(a, target, n % 2 === 0, defs);
    drain(b, target, n % 2 === 0, defs, {
      accelerate: false,
      maxEvaluations: 1000,
    });
    compare(a, b);
  }
});
test("v1 migration preserves unknown state and pending online time; unsafe timestamps fail closed", () => {
  const raw = city(["smallHouse", "powerPlant", "cornerStore"]);
  raw.economy.version = 1;
  raw.economy.future = { custom: 42 };
  raw.economy.pendingMs = 5000;
  raw.economy.pendingBoostMs = 5000;
  raw.future = "keep";
  delete raw.economy.precision;
  const migrated = M.normalize(raw, epoch);
  assert.equal(migrated.economy.version, 2);
  assert.equal(migrated.future, "keep");
  assert.deepEqual(migrated.economy.future, { custom: 42 });
  const before = migrated.money;
  M.advance(migrated, epoch + 5000, false, catalog);
  assert.ok(Math.abs(migrated.money - before - (180 * 1.1 - 15) / 6) < 1e-6);
  assert.throws(() => M.advance(migrated, Infinity, false, catalog), /clock/);
});

test("online recipe throughput consumes 1.2x inputs as well as producing 1.2x outputs", () => {
  const a = city(["mill"], recipeDefs, 0);
  a.iron = 100;
  a.steel = 0;
  drain(a, epoch + 60000, true, recipeDefs);
  assert.equal(a.iron, 92.8);
  assert.equal(a.steel, 7.2);
  const offline = city(["mill"], recipeDefs, 0);
  offline.iron = 100;
  offline.steel = 0;
  drain(offline, epoch + 60000, false, recipeDefs);
  assert.equal(offline.iron, 94);
  assert.equal(offline.steel, 6);
});

test("large integer balances survive numeric projection without artificial fractional drift", () => {
  const a = city([]);
  a.steel = 527011917088;
  const s = M.normalize(a, epoch);
  assert.equal(s.steel, 527011917088);
  assert.equal(
    M.normalize(JSON.parse(JSON.stringify(s)), epoch).steel,
    s.steel,
  );
});
