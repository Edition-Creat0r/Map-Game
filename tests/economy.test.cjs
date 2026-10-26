const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const M = require("../economy_model.js");
const catalogContext = { window: {}, console: { log() {} } };
vm.createContext(catalogContext);
vm.runInContext(
  fs.readFileSync(require.resolve("../buildings.js"), "utf8"),
  catalogContext,
);
const defs = JSON.parse(
  JSON.stringify(catalogContext.window.mapGameBuildings.CATALOG),
);
const now = 1800000000000;
function state(rows = [], population = 20) {
  return M.normalize(
    {
      placedIncomeItems: rows.map((type, i) => ({
        id: String(i),
        type,
        territoryId: "T_158_158",
        x: 100 + i * 300,
        z: 200,
        footprint: defs.find((d) => d.id === type).footprint,
      })),
      economy: { version: 1, population, lastTick: now },
    },
    now,
  );
}
test("fixed elapsed steps, 1.2 online production and unboosted upkeep", () => {
  const s = state(["smallHouse", "powerPlant", "cornerStore"]);
  const start = s.money;
  M.advance(s, now + 60000, true, defs);
  assert.ok(Math.abs(s.money - start - (180 * 1.2 - 15)) < 1e-6);
  const offline = state(["smallHouse", "powerPlant", "cornerStore"]);
  M.advance(offline, now + 60000, false, defs);
  assert.ok(Math.abs(offline.money - start - (180 - 15)) < 1e-6);
});
test("partitioned ticks and partial visibility boundaries match a continuous deterministic clock", () => {
  const a = state(["smallHouse", "powerPlant", "cornerStore"]),
    b = M.clone(a);
  M.advance(a, now + 120000, true, defs);
  for (let t = 1000; t <= 120000; t += 1000) M.advance(b, now + t, true, defs);
  assert.deepEqual(a, b);
  const mixed = state(["smallHouse", "powerPlant", "cornerStore"]);
  const start = mixed.money;
  M.advance(mixed, now + 5000, true, defs);
  M.advance(mixed, now + 10000, false, defs);
  assert.ok(Math.abs(mixed.money - start - (180 * 1.1 - 15) / 6) < 1e-6);
});
test("offline catchup capped at 12 hours, reload cannot award it twice; backwards clocks do not pay", () => {
  const a = state(["smallHouse", "powerPlant", "cornerStore"]);
  const result = M.advance(a, now + 48 * 3600000, false, defs);
  assert.equal(result.steps, 4320);
  const balance = a.money;
  const reload = M.normalize(a, now + 48 * 3600000);
  M.advance(reload, now + 48 * 3600000, false, defs);
  assert.equal(reload.money, balance);
  M.advance(reload, now, false, defs);
  assert.equal(reload.money, balance);
  const rollback = M.normalize(reload, now);
  assert.equal(rollback.economy.lastTick, now + 48 * 3600000);
});
test("growth, housing and workforce constrain operation deterministically", () => {
  const a = state(
    ["smallHouse", "powerPlant", "steelMill", "carbonPlant", "cornerStore"],
    0,
  );
  let s = M.summary(a, defs);
  assert.equal(s.workforce, 0);
  assert.equal(s.buildings.filter((b) => !b.operating).length, 3);
  M.advance(a, now + 10 * 60000, false, defs);
  s = M.summary(a, defs);
  assert.equal(s.population, 20);
  assert.equal(s.workforce, 12);
  assert.equal(s.workforceUsed, 10);
  assert.equal(
    s.buildings.find((b) => b.type === "cornerStore").reason,
    "Insufficient workforce",
  );
  assert.ok(a.steel > 100 && a.carbon > 40);
});
test("energy deficit pauses consumers; no phantom production in unpowered housing", () => {
  const a = state(["smallHouse", "steelMill"], 0),
    start = a.steel;
  M.advance(a, now + 60000, true, defs);
  assert.equal(a.steel, start);
  assert.equal(a.economy.population, 0);
  assert.ok(M.summary(a, defs).energyDeficit > 0);
});
test("upkeep insolvency, invalid costs and bad numeric balances cannot create debt or NaN", () => {
  const a = state(["smallHouse", "powerPlant", "cornerStore"]);
  a.money = 0;
  M.advance(a, now + 600000, true, defs);
  assert.equal(a.money, 0);
  for (const cost of [
    { money: -1 },
    { money: NaN },
    { money: Infinity },
    { money: "2" },
    { unknown: 2 },
  ])
    assert.equal(M.spend(a, cost), false);
  const b = M.normalize({ money: "bad", steel: -2, carbon: Infinity }, now);
  assert.equal(b.money, 0);
  assert.equal(b.steel, 0);
  assert.equal(b.carbon, 0);
  assert.equal(M.spend(b, { money: 1 }), false);
});
test("legacy and versioned saves preserve unknown fields and deduplicate building records", () => {
  const a = M.normalize(
    {
      custom: { future: true },
      money: 42,
      lastEconomyTick: now,
      placedIncomeItems: [{ id: "a", type: "smallHouse", custom: "keep" }],
    },
    now,
    [
      { id: "a", type: "smallHouse" },
      { id: "b", type: "cornerStore", unknown: 123 },
    ],
  );
  assert.equal(a.money, 42);
  assert.equal(a.carbon, 40);
  assert.equal(a.placedIncomeItems.length, 2);
  assert.equal(a.placedIncomeItems[0].custom, "keep");
  assert.equal(a.custom.future, true);
  const b = M.normalize(
    { ...a, economy: { ...a.economy, future: "retain" } },
    now,
  );
  assert.equal(b.economy.future, "retain");
});
const dry = {
  local: () => ({ water: false, buildability: "GOOD", steepness: 0.1 }),
};
test("construction footprint, border, rotated overlap and authoritative water rules", () => {
  const a = state(["smallHouse"]),
    def = defs.find((d) => d.id === "smallHouse");
  const data = {
    territoryId: "T_158_158",
    x: 500,
    z: 500,
    rotation: Math.PI / 2,
  };
  assert.equal(M.placement(a, def, data, dry).allowed, true);
  assert.equal(
    M.placement(a, def, { ...data, x: 100, z: 200 }, dry).allowed,
    false,
  );
  assert.equal(M.placement(a, def, { ...data, x: 1 }, dry).allowed, false);
  assert.equal(
    M.placement(a, def, data, { local: () => ({ water: true, steepness: 0 }) })
      .allowed,
    false,
  );
  assert.equal(
    M.placement(a, def, data, {
      local: () => ({ water: false, steepness: 0.8 }),
    }).allowed,
    false,
  );
  assert.equal(M.placement(a, def, data, null).allowed, false);
  assert.equal(
    M.placement(a, def, { ...data, territoryId: "T_400_0" }, dry).allowed,
    false,
  );
  assert.equal(M.placement(a, def, { ...data, x: NaN }, dry).allowed, false);
});
async function adapter(saved, options = {}) {
  const records = new Map(Object.entries(saved || {})),
    events = {},
    lock = options.lock !== false;
  let failIn = Infinity;
  const context = {
    window: {
      mapGameBuildings: { CATALOG: defs },
      mapGameEconomyModel: M,
      mapGameSharedTerrain: dry,
      dispatchEvent() {},
      addEventListener(type, fn) {
        events[type] = fn;
      },
    },
    document: {
      hidden: false,
      addEventListener(type, fn) {
        events[type] = fn;
      },
    },
    navigator: { locks: { request: async (n, o, fn) => fn(lock ? {} : null) } },
    Date: { now: () => now },
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: function () {},
    console,
    localStorage: {
      getItem: (k) => records.get(k) ?? null,
      setItem: (k, v) => {
        if (--failIn === 0) throw Error("Storage full");
        records.set(k, v);
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve("../economy.js"), "utf8"),
    context,
  );
  const api = context.window.mapGameEconomy;
  api.setEnabled(true);
  await new Promise(setImmediate);
  return { api, records, events, setFail: (writes = 1) => (failIn = writes) };
}
test("atomic purchase is idempotent, cancellation is free and reload restores complete records", async () => {
  const { api, records } = await adapter();
  const initial = api.snapshot().money;
  // Opening/cancelling placement only checks; no reservation or debit exists.
  const def = defs.find((d) => d.id === "smallHouse"),
    data = {
      id: "txn1",
      territoryId: "T_158_158",
      x: 500,
      z: 500,
      rotation: 0,
      type: def.id,
      custom: "keep",
    };
  assert.equal(api.checkPlacement(def, data).allowed, true);
  assert.equal(api.snapshot().money, initial);
  assert.equal(api.purchaseAndRegisterBuilding(def, data), true);
  assert.equal(api.purchaseAndRegisterBuilding(def, data), true);
  assert.equal(api.snapshot().money, initial - def.cost.money);
  assert.equal(api.listPlacedBuildings().length, 1);
  const reloaded = await adapter(Object.fromEntries(records));
  assert.equal(reloaded.api.snapshot().money, initial - def.cost.money);
  assert.equal(reloaded.api.listPlacedBuildings()[0].custom, "keep");
  assert.equal(
    api.purchaseAndRegisterBuilding(def, { ...data, x: 600 }),
    false,
  );
  api.setEnabled(false);
  assert.equal(
    api.purchaseAndRegisterBuilding(def, { ...data, id: "central" }),
    false,
  );
});
test("failed persistence rolls back both payment and building, without overwriting source saves", async () => {
  const a = await adapter();
  const before = a.api.snapshot().money;
  a.setFail(2);
  const def = defs.find((d) => d.id === "smallHouse");
  assert.equal(
    a.api.purchaseAndRegisterBuilding(def, {
      id: "txn",
      territoryId: "T_158_158",
      x: 500,
      z: 500,
      rotation: 0,
      type: def.id,
    }),
    false,
  );
  assert.equal(a.api.snapshot().money, before);
  assert.equal(a.api.listPlacedBuildings().length, 0);
  assert.match(a.api.snapshot().error, /Storage full/);
});
test("writer lock, future versions, malformed saves and external edits fail closed", async () => {
  const locked = await adapter({}, { lock: false });
  assert.equal(locked.api.snapshot().enabled, false);
  for (const raw of [
    "{broken",
    JSON.stringify({ economy: { version: 99 }, money: 100 }),
  ]) {
    const a = await adapter({ mapgame_economy_021e: raw });
    assert.equal(a.records.get("mapgame_economy_021e"), raw);
    assert.equal(a.api.snapshot().enabled, false);
  }
  const edited = await adapter();
  edited.records.set("mapgame_economy_021e", "{}");
  assert.equal(edited.api.spend({ money: 1 }), false);
  assert.match(edited.api.snapshot().error, /Another tab/);
});

test("construction boundary settles the old partial interval without retroactive production", () => {
  const a = state(["smallHouse", "powerPlant"]);
  M.advance(a, now + 5000, true, defs);
  M.flushPending(a, defs);
  const before = a.money;
  a.placedIncomeItems.push({ id: "new", type: "cornerStore", level: 1 });
  M.advance(a, now + 10000, true, defs);
  M.flushPending(a, defs);
  assert.ok(Math.abs(a.money - before - ((180 * 1.2 - 15) * 5) / 60) < 1e-6);
  assert.equal(a.economy.pendingMs, 0);
});

test("capital reservations, cross-chunk coordinates and old road refund signature remain compatible", async () => {
  const a = await adapter({
    mapGame_alpha021_firstPlayable: JSON.stringify({
      capital: { territoryId: "T_158_158", x: 500, z: 500 },
    }),
  });
  const def = defs.find((d) => d.id === "smallHouse");
  assert.match(
    a.api
      .checkPlacement(def, {
        territoryId: "T_158_158",
        x: 500,
        z: 500,
        rotation: 0,
      })
      .reasons.join(),
    /capital/,
  );
  assert.equal(
    a.api.checkPlacement(def, {
      territoryId: "T_158_158",
      x: 1024,
      z: 1024,
      rotation: 0,
    }).allowed,
    true,
  );
  const balance = a.api.snapshot().money;
  assert.equal(a.api.credit("money", 50), true);
  assert.equal(a.api.snapshot().money, balance + 50);
});

test("legacy migration imports world buildings once, retains legacy rates and unknown data", async () => {
  const a = await adapter({
    mapGame_alpha021_firstPlayable: JSON.stringify({
      buildings: [
        {
          id: "legacy-home",
          type: "smallHouse",
          territoryId: "T_158_158",
          x: 500,
          z: 500,
          custom: "retain",
        },
      ],
      custom: "keep",
    }),
    mapgame_economy_021e: JSON.stringify({
      money: 12345,
      placedIncomeItems: [],
      lastEconomyTick: now,
      custom: "retain",
    }),
  });
  const snap = a.api.snapshot();
  assert.equal(snap.money, 12345);
  assert.equal(snap.economy.population, 4);
  assert.equal(snap.summary.housing, 4);
  assert.equal(snap.placedIncomeItems[0].legacyEconomy, true);
  assert.equal(snap.summary.production.money, 18);
  assert.equal(snap.placedIncomeItems[0].custom, "retain");
  const saved = Object.fromEntries(a.records);
  saved.mapGame_alpha021_firstPlayable = JSON.stringify({
    buildings: [{ id: "stale", type: "smallHouse" }],
  });
  const b = await adapter(saved);
  assert.equal(b.api.listPlacedBuildings().length, 1);
  assert.equal(b.api.snapshot().custom, "retain");
});

test("late matching storage events and Home refresh cannot poison the next writer session", async () => {
  const a = await adapter();
  a.events.storage({ key: "mapgame_economy_021e" });
  assert.equal(a.api.snapshot().error, "");
  a.api.setEnabled(false);
  const record = JSON.parse(a.records.get("mapgame_economy_021e"));
  record.money = 55555;
  a.records.set("mapgame_economy_021e", JSON.stringify(record));
  a.events.storage({ key: "mapgame_economy_021e" });
  assert.equal(a.api.snapshot().money, 55555);
  assert.equal(a.api.snapshot().error, "");
  a.api.setEnabled(true);
  await new Promise(setImmediate);
  assert.equal(a.api.snapshot().enabled, true);
  assert.equal(a.api.snapshot().money, 55555);
  a.records.set("mapgame_economy_021e", "{}");
  a.events.storage({ key: "mapgame_economy_021e" });
  assert.equal(a.api.snapshot().enabled, false);
  assert.match(a.api.snapshot().error, /storage changed/);
});
