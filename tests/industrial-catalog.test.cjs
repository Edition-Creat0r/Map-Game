const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const R = require("../industrial/registry.js"),
  M = require("../economy_model.js"),
  root = path.resolve(__dirname, ".."),
  epoch = 1800000000000;
function catalog() {
  const c = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
  for (const f of ["buildings.js", "industrial/integration.js"])
    vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), c);
  return JSON.parse(JSON.stringify(c.window.mapGameBuildings.CATALOG));
}
const defs = catalog(),
  clone = M.clone;
function city(types, extra = {}) {
  const s = M.normalize(
    {
      money: 1e9,
      iron: 0,
      steel: 0,
      carbon: 0,
      ...extra,
      placedIncomeItems: types.map((type, i) => ({ id: "b" + i, type })),
      economy: {
        version: 3,
        population: 40,
        lastTick: epoch,
        ...extra.economy,
      },
    },
    epoch,
  );
  M.bindContracts(s, defs, 3);
  return s;
}
function drain(s, target, online = false, options = {}) {
  let r,
    work = 0,
    passes = 0;
  do {
    r = M.advance(s, target, online, defs, options);
    work += r.evaluations;
    assert.ok(++passes < 2000, "catchup did not converge");
  } while (!r.complete);
  return work;
}
test("canonical JSON and generated browser data agree; sector quotas, IDs, classifications and real model refs validate", () => {
  assert.deepEqual(R.data, require("../industrial/catalog.json"));
  assert.equal(R.materialIds.length, 121);
  assert.equal(R.data.buildings.length, 120);
  assert.deepEqual(
    ["playable", "futureLocked", "definitionsOnly"].map(
      (k) => R.data.buildings.filter((b) => b.availability === k).length,
    ),
    [56, 54, 10],
  );
  assert.equal(
    R.validate(R.data, {
      models: defs.filter((d) => !d.industrial).map((d) => d.id),
    }).valid,
    true,
  );
  assert.equal(defs.filter((d) => d.industrial).length, 120);
  assert.equal(defs.filter((d) => !d.industrial && d.economy).length, 5);
  assert.ok(Object.isFrozen(R.data.buildings[0].recipes[0].inputsPerMinute));
});
test("registry rejects invalid amounts, unknown references, duplicate IDs and aliases", () => {
  const mutations = [
    (d) => d.materials.push(clone(d.materials[0])),
    (d) => (d.buildings[1].id = d.buildings[0].id),
    (d) => (d.buildings[1].recipes[0].id = d.buildings[0].recipes[0].id),
    (d) => d.materials[1].aliases.push("cash"),
    (d) => (d.buildings[0].recipes[0].outputsPerMinute.ironOre = NaN),
    (d) => (d.buildings[0].cost.money = -1),
    (d) => (d.buildings[0].cost.money = Infinity),
    (d) => (d.buildings[0].recipes[0].outputsPerMinute.ironOre = 1e-8),
    (d) => (d.buildings[0].recipes[0].inputsPerMinute.ghost = 1),
    (d) => (d.buildings[0].visual.existingModelId = "missingModel"),
    (d) => (d.buildings[0].technology = "missingTech"),
    (d) => (d.technologies[0].prerequisites = ["missingTech"]),
    (d) => (d.buildings[0].operating.workers = 0),
    (d) => (d.buildings[0].logistics.storageClass = "invalid"),
    (d) => (d.buildings[0].maxLevel = 11),
  ];
  for (const mutate of mutations) {
    const d = clone(R.data);
    mutate(d);
    const v = R.validate(d);
    assert.equal(v.valid, false, v.errors.join());
  }
});
test("cycles, no-input non-extraction and currency minting are rejected", () => {
  for (const mutate of [
    (d) =>
      (d.buildings.find(
        (b) => b.id === "ironMine",
      ).recipes[0].inputsPerMinute.iron = 1),
    (d) =>
      (d.buildings.find(
        (b) => b.id === "ironSmelter",
      ).recipes[0].inputsPerMinute = {}),
    (d) => (d.buildings[0].recipes[0].outputsPerMinute.money = 1),
    (d) => (d.technologies[0].prerequisites = [d.technologies[1].id]),
    (d) =>
      (d.buildings.find((b) => b.id === "processorFab").availability =
        "playable"),
  ]) {
    const d = clone(R.data);
    mutate(d);
    assert.equal(R.validate(d).valid, false);
  }
  assert.equal(R.topological.length, 121);
});
test("legacy aliases are single balances; duplicate alias costs cannot overspend", () => {
  const s = city([], {
    steel: 5,
    inventory: { copper: 10, unknownFuture: { keep: true } },
  });
  assert.equal(R.resolve("Money"), "money");
  assert.equal(M.quantity(s, "Steel"), 5);
  assert.equal(M.spend(s, { steel: 3, Steel: 3 }), false);
  assert.equal(s.steel, 5);
  assert.equal(M.spend(s, { Copper: 1 }), false);
  assert.equal(M.spend(s, { copper: 4 }), true);
  assert.equal(M.quantity(s, "copper"), 6);
  assert.deepEqual(s.inventory.unknownFuture, { keep: true });
});
const chain = [
  "smallHouse",
  "smallHouse",
  "powerPlant",
  "ironMine",
  "coalMine",
  "ironSmelter",
  "cokeWorks",
  "steelFoundry",
];
test("working mine/refinery/foundry chain conserves every input and output online and offline", () => {
  const scale = 300000000000n;
  for (const online of [false, true]) {
    const s = city(chain);
    drain(s, epoch + 3600000, online);
    const p = Object.fromEntries(
      Object.entries(s.economy.precision).map(([k, v]) => [k, BigInt(v)]),
    );
    const extracted = (online ? 864n : 720n) * scale;
    assert.equal(p.ironOre + 2n * (p.iron + 2n * p.steel), extracted);
    assert.equal(p.coal + 2n * (p.carbon + p.steel), extracted);
    assert.ok(s.steel > 100);
    assert.ok(M.quantity(s, "ironOre") >= 0);
    assert.ok(s.money >= 0);
  }
  const first = city(chain);
  drain(first, epoch + 10000);
  assert.equal(first.iron, 0);
  assert.equal(first.steel, 0);
  assert.equal(M.quantity(first, "ironOre"), 2);
});
test("shortage details identify the missing material; power and population shortages block real recipes", () => {
  const noInput = city([
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "ironSmelter",
  ]);
  const a = M.summary(noInput, defs);
  const b = a.buildings.find((b) => b.type === "ironSmelter");
  assert.equal(b.operating, false);
  assert.equal(b.shortages[0].material, "ironOre");
  assert.equal(b.shortages[0].required, 2);
  const noPower = city(["smallHouse", "ironMine"]);
  drain(noPower, epoch + 60000);
  assert.equal(M.quantity(noPower, "ironOre"), 0);
  const noWorkers = city(["smallHouse", "powerPlant", "ironMine"], {
    economy: { population: 0 },
  });
  drain(noWorkers, epoch + 10000);
  assert.equal(M.quantity(noWorkers, "ironOre"), 0);
  assert.ok(noWorkers.economy.population > 0);
});
test("exact accelerated solver agrees with bounded reference and partitions for mixed scarce inputs", () => {
  const types = [
    ...chain,
    "copperMine",
    "copperSmelter",
    "wireMill",
    "limestoneQuarry",
    "cementKiln",
    "silicaQuarry",
    "concreteBatchPlant",
  ];
  for (let n = 0; n < 12; n++) {
    const a = city(types, {
        money: 5000 + n * 100,
        inventory: { ironOre: n / 3, coal: n / 7 },
        economy: { population: n * 3 },
      }),
      b = clone(a),
      c = clone(a);
    const target = epoch + 3600000 + n * 1007;
    drain(a, target, n % 2 === 0);
    drain(b, target, n % 2 === 0, { accelerate: false, maxEvaluations: 1000 });
    for (let t = epoch + 17001; t < target; t += 131071)
      drain(c, t, n % 2 === 0, { maxEvaluations: 2 });
    drain(c, target, n % 2 === 0, { maxEvaluations: 2 });
    assert.deepEqual(a.economy.precision, b.economy.precision);
    assert.deepEqual(a.inventory, b.inventory);
    assert.deepEqual(a.economy.precision, c.economy.precision);
    assert.deepEqual(a.inventory, c.inventory);
  }
});
test("uncapped century catch-up handles real mixed recipes and scarce budgets without losing checkpoints", () => {
  const a = city(chain, { money: 1e9 });
  const work = drain(a, epoch + 100 * 365.25 * 86400000);
  assert.equal(a.economy.lastTick, epoch + 100 * 365.25 * 86400000);
  assert.ok(work < 500);
  assert.ok(a.money >= 0);
  const before = clone(a);
  drain(a, a.economy.lastTick);
  assert.deepEqual(a, before);
});
test("schema-2 migration pins prior economics and preserves unknown fields and exact ledgers", () => {
  const raw = {
    money: 12345,
    steel: 7,
    inventory: { futureStock: 91 },
    unknown: { keep: true },
    placedIncomeItems: [{ id: "old", type: "steelMill", custom: 42 }],
    economy: {
      version: 2,
      lastTick: epoch,
      population: 0,
      future: { x: 1 },
      precision: { steel: String(7n * 300000000000n) },
    },
  };
  const s = M.normalize(raw, epoch);
  M.bindContracts(s, defs, 2);
  assert.equal(s.economy.version, 3);
  assert.equal(s.economy.materialRegistryVersion, 1);
  assert.equal(s.economy.precision.steel, raw.economy.precision.steel);
  assert.equal(s.inventory.futureStock, 91);
  assert.deepEqual(s.unknown, { keep: true });
  assert.equal(s.placedIncomeItems[0].custom, 42);
  assert.equal(
    s.economy.rules[s.placedIncomeItems[0].economyContract].production.steel,
    6,
  );
  const changed = clone(defs);
  changed.find((d) => d.id === "steelMill").economy.production.steel = 999;
  assert.deepEqual(M.summary(s, changed), M.summary(s, defs));
  const reload = M.normalize(JSON.parse(JSON.stringify(s)), epoch);
  assert.deepEqual(reload, s);
});
test("new industrial contracts survive later catalog rate edits; future-locked and definitions-only rows remain inactive", () => {
  const s = city(["smallHouse", "smallHouse", "powerPlant", "ironMine"]);
  const changed = clone(defs);
  changed.find((d) => d.id === "ironMine").economy.production.ironOre = 999;
  M.advance(s, epoch + 60000, false, changed);
  assert.equal(M.quantity(s, "ironOre"), 12);
  const locked = city(
    ["smallHouse", "powerPlant", "processorFab", "fieldSupplyWorks"],
    {
      inventory: {
        semiconductors: 100,
        rareEarths: 100,
        medicalSupplies: 100,
        packaging: 100,
      },
    },
  );
  drain(locked, epoch + 600000);
  assert.equal(M.quantity(locked, "processors"), 0);
  assert.equal(M.quantity(locked, "fieldSupplies"), 0);
  const unknown = M.normalize(
    {
      placedIncomeItems: [{ id: "pre", type: "ironMine", custom: "keep" }],
      economy: { version: 2, lastTick: epoch },
    },
    epoch,
  );
  M.bindContracts(unknown, defs, 2);
  drain(unknown, epoch + 600000);
  assert.equal(M.quantity(unknown, "ironOre"), 0);
  assert.equal(unknown.placedIncomeItems[0].custom, "keep");
  assert.match(M.summary(unknown, defs).buildings[0].reason, /pre-catalog/);
});

test("future registry/schema saves fail closed and unknown inventory/precision fields survive migration", () => {
  for (const economy of [
    { version: 99 },
    { version: 3, materialRegistryVersion: 2 },
    { version: "3" },
  ])
    assert.throws(() => M.normalize({ economy }, epoch), /version/);
  const s = M.normalize(
    {
      inventory: { futureThing: { qty: 42 } },
      economy: {
        version: 2,
        precision: { futurePrecision: "keep" },
        rules: { customFuture: { keep: true } },
        lastTick: epoch,
      },
    },
    epoch,
  );
  assert.deepEqual(s.inventory.futureThing, { qty: 42 });
  assert.equal(s.economy.precision.futurePrecision, "keep");
  assert.deepEqual(s.economy.rules.customFuture, { keep: true });
});

test("registry display order cannot redirect upkeep or production to another stock", () => {
  const c = {
    window: {
      mapGameIndustrialRegistry: {
        ...R,
        materialIds: [...R.materialIds].reverse(),
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "economy_model.js"), "utf8"),
    c,
  );
  const engine = c.window.mapGameEconomyModel,
    s = engine.normalize(
      {
        money: 1000,
        placedIncomeItems: [
          "smallHouse",
          "powerPlant",
          "cornerStore",
          "ironMine",
        ].map((type, i) => ({ id: "o" + i, type })),
        economy: { version: 3, population: 20, lastTick: epoch },
      },
      epoch,
    );
  engine.advance(s, epoch + 60000, false, defs);
  assert.equal(s.money, 1162);
  assert.equal(s.inventory.ironOre, 12);
});

test("a later recipe version receives a new pinned contract without replacing existing factories", () => {
  const s = city(["smallHouse", "smallHouse", "powerPlant", "ironMine"]);
  const old = s.placedIncomeItems.find(
    (r) => r.type === "ironMine",
  ).economyContract;
  const changed = clone(defs.find((d) => d.id === "ironMine"));
  changed.recipeVersion = 2;
  changed.economy.production.ironOre = 24;
  const row = { id: "new-version", type: changed.id, level: 1 };
  M.pinContract(s, row, changed);
  assert.notEqual(row.economyContract, old);
  assert.equal(s.economy.rules[old].production.ironOre, 12);
  assert.equal(s.economy.rules[row.economyContract].production.ironOre, 24);
});

test("collisions with the original catalog fail before registering any industrial entries", () => {
  const bad = clone(R.data);
  bad.buildings[30].id = "smallHouse";
  const c = {
    window: { mapGameIndustrialRegistry: { ...R, data: bad } },
    console: { log() {} },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "buildings.js"), "utf8"),
    c,
  );
  const count = c.window.mapGameBuildings.CATALOG.length;
  assert.throws(
    () =>
      vm.runInNewContext(
        fs.readFileSync(path.join(root, "industrial/integration.js"), "utf8"),
        c,
      ),
    /collides/,
  );
  assert.equal(c.window.mapGameBuildings.CATALOG.length, count);
});

test("unknown rule-table fields do not become a contract for unbound records", () => {
  const s = M.normalize(
    {
      money: 1000,
      placedIncomeItems: [{ id: "kept", type: "smallHouse" }],
      economy: {
        version: 2,
        lastTick: epoch,
        rules: { undefined: { production: { money: 99999 } } },
        population: 0,
      },
    },
    epoch,
  );
  M.advance(s, epoch + 60000, false, defs);
  assert.equal(s.money, 1000);
  assert.equal(s.economy.rules.undefined.production.money, 99999);
});
