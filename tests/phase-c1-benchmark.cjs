const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  { performance } = require("node:perf_hooks"),
  { Module } = require("node:module"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  M = require("../economy_model.js"),
  P = require("../industrial/progression.js"),
  R = require("../industrial/registry.js"),
  out = process.argv[2] || "/tmp/phase-c1-benchmark";
fs.mkdirSync(out, { recursive: true });
const c = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
for (const f of ["buildings.js", "industrial/integration.js"])
  vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), c);
const defs = M.clone(c.window.mapGameBuildings.CATALOG);
const base = new Module(path.join(root, "phase-b-model.cjs"));
base.filename = path.join(root, "phase-b-model.cjs");
base.paths = module.paths;
base._compile(
  execFileSync("git", ["show", "03adac1:economy_model.js"], {
    cwd: root,
    encoding: "utf8",
  }),
  base.filename,
);
const B = base.exports,
  epoch = 1800000000000,
  year = 365.25 * 86400000;
const chain = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "ironMine",
    "coalMine",
    "ironSmelter",
    "cokeWorks",
    "steelFoundry",
    "cornerStore",
  ],
  wide = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "powerPlant",
    "cornerStore",
    ...R.data.buildings
      .filter((d) => d.availability === "playable")
      .map((d) => d.id),
  ],
  results = [];
for (const count of [100, 1000, 10000])
  for (const [scenario, pattern] of [
    ["balanced", chain],
    ["scarce-wide", wide],
    [
      "power-shortage",
      [...chain, ...chain.filter((id) => id !== "powerPlant")],
    ],
  ])
    for (const growing of [false, true]) {
      const raw = {
        money: 1e12,
        steel: 100,
        carbon: 40,
        iron: 0,
        inventory: { ironOre: 3, coal: 2 },
        placedIncomeItems: Array.from({ length: count }, (_, i) => ({
          id: "b" + i,
          type: pattern[i % pattern.length],
          level: 1,
        })),
        economy: {
          version: 3,
          population: growing ? 0 : count * 10,
          lastTick: epoch,
        },
      };
      const sets = { B: [], C1: [] },
        init = { B: [], C1: [] };
      let baseline;
      for (let round = 0; round < 3; round++)
        for (const [variant, model] of round % 2
          ? [
              ["C1", M],
              ["B", B],
            ]
          : [
              ["B", B],
              ["C1", M],
            ]) {
          let start = performance.now();
          const s = model.normalize(raw, epoch);
          model.bindContracts(s, defs, 3);
          if (variant === "C1") P.init(s, defs, { legacy: true });
          init[variant].push(performance.now() - start);
          start = performance.now();
          let r,
            evals = 0;
          do {
            r = model.advance(s, epoch + 1000 * year, false, defs, {
              maxEvaluations: 64,
            });
            evals += r.evaluations;
          } while (!r.complete);
          sets[variant].push({ ms: performance.now() - start, evals });
          if (!baseline) baseline = M.clone(s.economy.precision);
          assert.deepEqual(
            s.economy.precision,
            baseline,
            `${count} ${scenario} ${variant}`,
          );
        }
      const median = (a) => a.sort((x, y) => x - y)[1];
      const record = {
        count,
        scenario,
        growing,
        years: 1000,
        B: {
          ms: median(sets.B.map((r) => r.ms)),
          initMs: median(init.B),
          evaluations: sets.B[0].evals,
        },
        C1: {
          ms: median(sets.C1.map((r) => r.ms)),
          initMs: median(init.C1),
          evaluations: sets.C1[0].evals,
        },
        exactLedgerAgreement: true,
      };
      results.push(record);
      console.log(JSON.stringify(record));
      fs.writeFileSync(
        path.join(out, "phase-c1-benchmark.json"),
        JSON.stringify(results, null, 2),
      );
    }
// Optional plan cost and a bounded per-tick reference at every required city size.
const auto = [];
for (const count of [100, 1000, 10000]) {
  const raw = {
    money: 1e12,
    steel: 100,
    carbon: 40,
    iron: 0,
    inventory: { ironOre: 3, coal: 2 },
    placedIncomeItems: Array.from({ length: count }, (_, i) => ({
      id: "a" + i,
      type: chain[i % chain.length],
      level: 1,
    })),
    economy: { version: 3, population: count * 10, lastTick: epoch },
  };
  const s = M.normalize(raw, epoch);
  M.bindContracts(s, defs, 3);
  P.init(s, defs, { legacy: true });
  let t = performance.now();
  P.priorities(s, defs, "automatic", M);
  const planMs = performance.now() - t;
  const a = M.clone(s),
    b = M.clone(s);
  M.advance(a, epoch + 600000, true, defs);
  for (let tick = 1; tick <= 60; tick++)
    M.advance(b, epoch + tick * 10000, true, defs);
  assert.deepEqual(a.economy.precision, b.economy.precision);
  t = performance.now();
  let r;
  do {
    r = M.advance(s, epoch + 1000 * year, false, defs, { maxEvaluations: 64 });
  } while (!r.complete);
  const record = {
    count,
    planMs,
    offline1000YearsMs: performance.now() - t,
    boundedReferenceTicks: 60,
    exactAgreement: true,
  };
  auto.push(record);
  console.log(JSON.stringify({ automatic: record }));
}
fs.writeFileSync(
  path.join(out, "automatic-benchmark.json"),
  JSON.stringify(auto, null, 2),
);
