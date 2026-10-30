const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  vm = require("vm");
const M = require("../economy_model.js"),
  P = require("../industrial/progression.js"),
  R = require("../industrial/registry.js");
const c = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
for (const f of ["buildings.js", "industrial/integration.js"])
  vm.runInNewContext(fs.readFileSync(require.resolve("../" + f), "utf8"), c);
const defs = M.clone(c.window.mapGameBuildings.CATALOG),
  now = 1800000000000;
function state(raw = {}, legacy = false) {
  const s = M.normalize(
    { ...raw, economy: { lastTick: now, ...raw.economy } },
    now,
  );
  M.bindContracts(s, defs, raw.economy?.version || 3);
  P.init(s, defs, { legacy });
  return s;
}
function rows(types) {
  return types.map((type, i) => ({
    id: "b" + i,
    type,
    level: 1,
    territoryId: "T_190_27",
    x: 500 + i * 200,
    z: 500,
    custom: "keep",
  }));
}
test("frozen JSON and browser mirrors validate exact 118/10/108/21 and six era quotas", () => {
  assert.deepEqual(P.baseManifest, require("../industrial/player-materials.json"));
  assert.deepEqual(P.manifest, P.composeManifests(P.baseManifest,P.extensions));
  assert.deepEqual(P.research, require("../industrial/research.json"));
  assert.equal(P.validate().valid, true);
  const s = state();
  assert.equal(
    P.manifest.materials.filter((m) => P.unlocked(s, m.id)).length,
    10,
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(
      (era) => P.manifest.materials.filter((m) => m.unlockEra <= era).length,
    ),
    [10, 25, 53, 80, 103, 118],
  );
  assert.equal(R.materialIds.length, 139);
});
test("invalid manifest IDs, quotas, undefined acquisition and research cycles fail validation", () => {
  for (const mutate of [
    (m) => (m.materials[20].id = m.materials[0].id),
    (m) => (m.materials[20].id = "missing"),
    (m) => (m.materials[20].unlockEra = 1),
    (m) => (m.materials[20].acquisition.building = "missing"),
    (m) => (m.materials[20].unlockRequirements = ["missing"]),
  ]) {
    const m = M.clone(P.manifest);
    mutate(m);
    assert.equal(P.validate(m).valid, false);
  }
  const r = M.clone(P.research);
  r.nodes[0].prerequisites = [r.nodes.at(-1).id];
  assert.equal(P.validate(P.manifest, r).valid, false);
});
test("research DAG costs, prerequisites and repeated completion are exact and idempotent", () => {
  const s = state({inventory:Object.fromEntries(R.materialIds.filter(id=>!M.RESOURCES.includes(id)).map(id=>[id,1000]))});
  assert.equal(P.complete(s, "electricity", M), false);
  assert.equal(P.complete(s, "invalid", M), false);
  s.economy.progression.era = 6; // exercise all ten licenses independently of era milestones
  let paid = 0;
  for (const n of P.research.nodes) {
    const before = s.money;
    assert.equal(P.complete(s, n.id, M), true);
    assert.equal(s.money, before - n.cost.money);
    paid += n.cost.money;
    const precision = s.economy.precision.money;
    assert.equal(P.complete(s, n.id, M), true);
    assert.equal(s.economy.precision.money, precision);
  }
  assert.equal(s.money, 400000 - paid);
  assert.equal(new Set(s.economy.progression.completed).size, 14);
});
test("research cannot overdraw balances or fabricate material inputs", () => {
  const s = state({ money: 100 });
  const before = M.clone(s);
  assert.equal(P.complete(s, "basicIndustry", M), false);
  assert.deepEqual(s, before);
});
test("starter economy has reachable next goals and acquisition includes research cost dependencies", () => {
  const s = state();
  for (const n of P.research.nodes.filter(n=>!n.minimumEra)) assert.equal(P.complete(s,n.id,M),true);
  s.placedIncomeItems=rows(Array(10).fill('smallHouse'));s.economy.population=50;P.refresh(s);
  assert.equal(s.economy.progression.era,6);
  const acquired=new Set(['money','steel','carbon','concrete','glass']);
  let passes=0;
  while ((acquired.size<118 || s.economy.progression.completed.length<14) && passes++<139) {
    for (const n of P.research.nodes) {
      if (!P.researchReason(s,n.id) && Object.keys(n.cost).every(id=>acquired.has(id))) {
        // Symbolic production availability, with real research transactions.
        for(const [id,amount] of Object.entries(n.cost)) if(!M.RESOURCES.includes(id)) s.inventory[id]=Math.max(s.inventory[id]||0,amount);
        assert.equal(P.complete(s,n.id,M),true);
      }
    }
    for (const m of P.manifest.materials) {
      if (acquired.has(m.id)) continue;
      const d=defs.find(d=>d.id===m.acquisition.building);
      if (!P.reason(s,d) && [...Object.keys(d.cost),...Object.keys(d.economy.inputs||{})].every(id=>acquired.has(id))) acquired.add(m.id);
    }
  }
  assert.equal(acquired.size,118);assert.equal(s.economy.progression.completed.length,14);
  assert.equal(P.manifest.materials.filter(m=>P.unlocked(s,m.id)).length,118);
  assert.ok(P.nextGoal(state()).includes('Build Residential'));
});
test("research does not implicitly unlock referenced dependencies or bypass era gates", () => {
  const s = state();
  P.complete(s, "basicIndustry", M);
  P.complete(s, "miningRefining", M);
  assert.equal(P.unlocked(s, "iron"), false);
  assert.match(
    P.reason(
      s,
      defs.find((d) => d.id === "ironSmelter"),
    ),
    /Unlock materials/,
  );
  assert.equal(
    P.reason(
      s,
      defs.find((d) => d.id === "ironMine"),
    ),
    "",
  );
  s.placedIncomeItems = rows(["smallHouse", "powerPlant"]);
  s.economy.population = 10;
  P.refresh(s);
  assert.equal(P.unlocked(s, "iron"), true);
});
test("all five starter contracts remain available, defense and excluded outputs remain future content", () => {
  const s = state();
  for (const d of defs.filter((d) => d.economy && !d.industrial))
    assert.equal(P.reason(s, d), "");
  for (const d of defs.filter((d) => d.sector === "defense"))
    assert.match(P.reason(s, d), /Future defense/);
  assert.match(
    P.reason(
      s,
      defs.find((d) => d.id === "robotWorks"),
    ),
    /specialized/,
  );
});
test("migration preserves all exact balances, pending time, unknown fields and legal factory capabilities without unrelated research", () => {
  const raw = state({
    placedIncomeItems: rows(["smallHouse", "powerPlant", "semiconductorFab"]),
    custom: { keep: true },
    inventory: { quantumModules: 18, strategicEquipment: 11, unknown: 123 },
    economy: {
      population: 20,
      pendingMs: 7213,
      pendingBoostMs: 700,
      unknown: { keep: 19 },
    },
  });
  delete raw.economy.progression;
  const before = M.clone(raw);
  P.init(raw, defs, { legacy: true });
  assert.deepEqual(raw.economy.precision, before.economy.precision);
  assert.deepEqual(raw.placedIncomeItems, before.placedIncomeItems);
  assert.deepEqual(raw.inventory, before.inventory);
  assert.equal(raw.economy.pendingMs, 7213);
  assert.equal(raw.economy.pendingBoostMs, 700);
  assert.deepEqual(raw.economy.progression.completed, []);
  assert.equal(raw.economy.progression.era, 1);
  assert.equal(
    P.reason(
      raw,
      defs.find((d) => d.id === "semiconductorFab"),
    ),
    "",
  );
  assert.equal(P.unlocked(raw, "quantumModules"), true);
  assert.equal(P.unlocked(raw, "processors"), false);
  const repeated = M.clone(raw);
  P.init(raw, defs, { legacy: true });
  assert.deepEqual(raw, repeated);
});
test("future progression and economy saves fail closed; no silent downgrade", () => {
  for (const patch of [
    { version: 2 },
    { manifestVersion: 3 },
    { era: 7 },
    { completed: ["invalid"] },
    { priorities: { mode: "invalid", order: [] } },
  ]) {
    const s = state();
    Object.assign(s.economy.progression, patch);
    assert.throws(() => M.normalize(s, now), /progression save/);
  }
  assert.throws(
    () => M.normalize({ economy: { version: 5 } }, now),
    /save version/,
  );
});
test("legal pinned factories operate despite new research locks and unmodified legacy economics", () => {
  const s = state({
    money: 1e7,
    placedIncomeItems: rows(["smallHouse", "powerPlant", "steelMill"]),
    economy: { population: 20 },
  });
  const d = defs.find((d) => d.id === "steelMill"),
    contract = M.clone(s.economy.rules[s.placedIncomeItems[2].economyContract]);
  M.advance(s, now + 60000, false, defs);
  assert.equal(s.steel, 106);
  assert.deepEqual(
    s.economy.rules[s.placedIncomeItems[2].economyContract],
    contract,
  );
  assert.deepEqual(contract, d.economy);
});
test("automatic priority is optional deterministic persisted configuration, without changing rows/contracts", () => {
  const types = [
    "steelMill",
    "carbonPlant",
    "smallHouse",
    "powerPlant",
    "cornerStore",
  ];
  const s = state({
      placedIncomeItems: rows(types),
      economy: { population: 20 },
    }),
    before = M.clone(s.placedIncomeItems),
    rules = M.clone(s.economy.rules);
  assert.equal(P.priorities(s, defs, "automatic", M), true);
  assert.equal(s.economy.progression.priorities.order[0], "b3");
  assert.equal(s.economy.progression.priorities.order[1], "b2");
  assert.equal(s.economy.progression.priorities.order[2], "b4");
  assert.deepEqual(s.placedIncomeItems, before);
  assert.deepEqual(s.economy.rules, rules);
  const snap = M.normalize(s, now);
  assert.deepEqual(snap.economy.progression, s.economy.progression);
  assert.equal(P.priorities(s, defs, "manual", M), true);
  assert.deepEqual(s.economy.progression.priorities.order, []);
  assert.equal(P.priorities(s, defs, "invalid", M), false);
});
test("automatic priority honors workers power upkeep and scarce input constraints under exact accelerated solver", () => {
  for (const online of [true, false]) {
    const a = state({
      money: 1e6,
      iron: 0,
      placedIncomeItems: rows([
        "steelFoundry",
        "ironSmelter",
        "coalMine",
        "cokeWorks",
        "ironMine",
        "smallHouse",
        "smallHouse",
        "powerPlant",
        "cornerStore",
      ]),
      economy: { population: 20 },
      inventory: { ironOre: 3, coal: 2 },
    });
    P.priorities(a, defs, "automatic", M);
    const b = M.clone(a);
    M.advance(a, now + 3600000, online, defs);
    for (let t = 10000; t <= 3600000; t += 10000)
      M.advance(b, now + t, online, defs);
    assert.deepEqual(a.economy.precision, b.economy.precision);
    for (const id of M.MATERIALS) assert.ok(M.quantity(a, id) >= 0);
    const s = M.summary(a, defs);
    assert.ok(s.workforceUsed <= s.workforce);
    assert.ok(s.energyUsed <= s.energySupply);
  }
});
test("long offline remains uncapped with exact online 1.2 input and output conservation", () => {
  for (const online of [false, true]) {
    const s = state({
      money: 1e9,
      placedIncomeItems: rows(["smallHouse", "powerPlant", "cokeWorks"]),
      economy: { population: 20 },
      inventory: { coal: 200 },
    });
    const coal = s.inventory.coal;
    M.advance(s, now + 600000, online, defs);
    assert.equal(s.inventory.coal, coal - 120 * (online ? 1.2 : 1));
    assert.equal(s.carbon, 40 + 60 * (online ? 1.2 : 1));
  }
  const s = state({
    money: 1e10,
    placedIncomeItems: rows(["smallHouse", "powerPlant", "cornerStore"]),
    economy: { population: 20 },
  });
  const r = M.advance(s, now + 100 * 365.25 * 86400000, false, defs);
  assert.equal(r.steps, 315576000);
  assert.ok(r.evaluations < 100);
});
test("minigame reservation cannot award rewards or mint Singleplayer or multiplayer resources", () => {
  assert.equal(P.officialMinigames.enabled, false);
  assert.equal(P.officialMinigames.playerCreatedRewards, false);
  assert.equal(typeof P.officialMinigames.reward, "undefined");
});
async function adapter(raw) {
  const key = "mapgame_economy_021e",
    records = new Map(raw ? [[key, JSON.stringify(raw)]] : []);
  let fail = false;
  const listeners = {};
  const context = {
    window: {
      mapGameEconomyModel: M,
      mapGameProgression: P,
      mapGameBuildings: { CATALOG: defs },
      mapGameSharedTerrain: {
        local: () => ({
          water: false,
          steepness: 0,
          buildability: "BUILDABLE",
        }),
      },
      addEventListener: (n, f) => {
        listeners[n] = f;
      },
      dispatchEvent() {},
    },
    document: { hidden: false, addEventListener() {} },
    navigator: { locks: { request: async (n, o, fn) => fn({}) } },
    localStorage: {
      getItem: (k) => records.get(k) ?? null,
      setItem: (k, v) => {
        if (fail) throw Error("Storage full");
        records.set(k, v);
      },
    },
    Date: { now: () => now },
    performance: { now: () => 0 },
    setInterval: () => 1,
    clearInterval() {},
    setTimeout,
    clearTimeout,
    CustomEvent: function () {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve("../economy.js"), "utf8"),
    context,
  );
  const api = context.window.mapGameEconomy;
  api.start();
  await new Promise(setImmediate);
  return {
    api,
    records,
    fail: () => {
      fail = true;
    },
  };
}
test("economy API rejects locked factories and spoofed definitions, then permits legitimate research unlocks", async () => {
  const { api } = await adapter();
  const d = defs.find((d) => d.id === "ironMine"),
    data = { id: "x", territoryId: "T_190_27", x: 500, z: 500 };
  const before = api.snapshot().money;
  assert.equal(
    api.purchaseAndRegisterBuilding(
      { ...d, availability: "playable", economy: {}, cost: {} },
      data,
    ),
    false,
  );
  assert.match(api.checkPlacement(d, data).reasons[0], /Research/);
  assert.equal(api.snapshot().money, before);
  assert.equal(api.completeResearch("basicIndustry"), true);
  assert.equal(api.completeResearch("miningRefining"), true);
  assert.equal(api.purchaseAndRegisterBuilding(d, data), true);
  assert.equal(api.purchaseAndRegisterBuilding(d, data), true);
  assert.equal(api.listPlacedBuildings().length, 1);
  assert.equal(api.snapshot().money, before - 1500 - d.cost.money);
  const defense = defs.find((d) => d.sector === "defense");
  assert.equal(
    api.purchaseAndRegisterBuilding(defense, {
      ...data,
      id: "defense",
      x: 1500,
    }),
    false,
  );
  api.stop();
  assert.equal(api.completeResearch("constructionTechnology"), false);
  assert.equal(api.setOperatingPriority("automatic"), false);
});
test("research and priority transactions persist, replay safely, roll back on storage errors and preserve original future data", async () => {
  const a = await adapter();
  assert.equal(a.api.completeResearch("basicIndustry"), true);
  assert.equal(a.api.setOperatingPriority("automatic"), true);
  const saved = JSON.parse(a.records.get("mapgame_economy_021e"));
  a.api.stop();
  const b = await adapter(saved);
  const money = b.api.snapshot().money;
  assert.equal(b.api.completeResearch("basicIndustry"), true);
  assert.equal(b.api.snapshot().money, money);
  assert.equal(
    b.api.snapshot().economy.progression.priorities.mode,
    "automatic",
  );
  b.fail();
  assert.equal(b.api.completeResearch("miningRefining"), false);
  assert.equal(b.api.snapshot().money, money);
  assert.deepEqual(
    JSON.parse(b.records.get("mapgame_economy_021e")).economy.progression
      .completed,
    ["basicIndustry"],
  );
  assert.match(b.api.snapshot().error, /Storage full/);
  b.api.stop();
  const bad = M.clone(saved);
  bad.economy.progression.version = 2;
  const x = await adapter(bad);
  assert.equal(x.api.getStatus().enabled, false);
  assert.equal(x.records.get("mapgame_economy_021e"), JSON.stringify(bad));
});
test("previously inactive future definitions stay inactive; only paid C1 advanced rows gain operational eligibility", async () => {
  const raw = state({
    money: 1e8,
    inventory: {
      processors: 4,
      semiconductors: 200,
      plastic: 200,
      copper: 200,
      silicon: 200,
    },
    placedIncomeItems: rows(["smallHouse", "powerPlant", "processorFab"]),
    economy: { population: 20 },
  });
  delete raw.economy.progression;
  const old = M.clone(raw.economy.precision);
  P.init(raw, defs, { legacy: true });
  M.advance(raw, now + 60000, false, defs);
  assert.equal(raw.inventory.processors, 4);
  assert.ok(
    !M.summary(raw, defs).buildings.find((b) => b.type === "processorFab")
      .operating,
  );
  assert.ok(!raw.economy.progression.legacyBuildings.includes("processorFab"));
  const fixture = state({
    money: 1e8,
    placedIncomeItems: rows(["smallHouse", "powerPlant"]),
    economy: { population: 20 },
  });
  fixture.economy.progression.era = 6;
  fixture.economy.progression.completed = P.research.nodes.map((n) => n.id);
  for (const id of R.materialIds)
    if (!M.RESOURCES.includes(id)) fixture.inventory[id] = 1000;
  const a = await adapter(fixture),
    def = defs.find((d) => d.id === "processorFab");
  assert.equal(a.api.purchaseReason(def.id), "");
  assert.equal(
    a.api.purchaseAndRegisterBuilding(def, {
      id: "advanced",
      territoryId: "T_190_27",
      x: 1500,
      z: 1500,
    }),
    true,
  );
  assert.equal(
    a.api.listPlacedBuildings().find((b) => b.id === "advanced")
      .progressionAcquired,
    1,
  );
  assert.ok(
    a.api
      .snapshot()
      .summary.buildings.some((b) => b.id === "advanced" && b.operating),
  );
  a.api.stop();
});
