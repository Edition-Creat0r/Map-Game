const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  { Module } = require("node:module"),
  { execFileSync } = require("node:child_process"),
  { performance } = require("node:perf_hooks");
const M = require("../economy_model.js"),
  R = require("../industrial/registry.js"),
  root = path.resolve(__dirname, ".."),
  output = process.argv[2] || "/tmp/phase-b-benchmark";
fs.mkdirSync(output, { recursive: true });
const c = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
for (const file of ["buildings.js", "industrial/integration.js"])
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), c);
const defs = JSON.parse(JSON.stringify(c.window.mapGameBuildings.CATALOG)),
  baseFile = path.join(root, "phase-a-reference.cjs"),
  base = new Module(baseFile);
base._compile(
  execFileSync("git", ["show", "3069890:economy_model.js"], {
    cwd: root,
    encoding: "utf8",
  }),
  baseFile,
);
const A = base.exports;
const epoch = 1800000000000,
  year = 365.25 * 86400000,
  starter = [
    "smallHouse",
    "powerPlant",
    "steelMill",
    "carbonPlant",
    "cornerStore",
    "smallHouse",
  ],
  chain = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "ironMine",
    "coalMine",
    "ironSmelter",
    "cokeWorks",
    "steelFoundry",
    "cornerStore",
  ];
const wide = [
  "smallHouse",
  "smallHouse",
  "powerPlant",
  "powerPlant",
  "cornerStore",
  ...R.data.buildings
    .filter((d) => d.availability === "playable")
    .map((d) => d.id),
];
function raw(count, pattern, growing) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: "p" + i,
    type: pattern[i % pattern.length],
  }));
  return {
    money: 1e12,
    steel: 100,
    carbon: 40,
    placedIncomeItems: rows,
    economy: {
      version: 2,
      population: growing
        ? 0
        : rows.filter((r) => r.type === "smallHouse").length * 20,
      lastTick: epoch,
    },
  };
}
function run(model, raw, target, allDefs, variant, scenario) {
  const state = model.normalize(raw, epoch);
  const start = performance.now();
  let result,
    evaluations = 0,
    steps = 0,
    passes = 0;
  do {
    result = model.advance(state, target, false, allDefs, {
      maxEvaluations: 64,
    });
    evaluations += result.evaluations;
    steps += result.steps;
    if (++passes > 10000) throw Error(`Excessive evaluations ${scenario}`);
  } while (!result.complete);
  return {
    record: {
      variant,
      scenario,
      count: raw.placedIncomeItems.length,
      years: (target - epoch) / year,
      ms: performance.now() - start,
      evaluations,
      steps,
      passes,
      population: state.economy.population,
    },
    state,
  };
}
const records = [];
for (const count of [100, 1000, 10000]) {
  const fixture = raw(count, starter, false),
    a = run(
      A,
      fixture,
      epoch + 1000 * year,
      defs.filter((d) => !d.industrial),
      "Phase A",
      "starter compatibility",
    ),
    b = run(
      M,
      fixture,
      epoch + 1000 * year,
      defs,
      "Phase B",
      "starter compatibility",
    );
  for (const key of [
    "money",
    "steel",
    "carbon",
    "iron",
    "concrete",
    "glass",
    "population",
    "totalEarned",
  ])
    if (a.state.economy.precision[key] !== b.state.economy.precision[key])
      throw Error(`Baseline accounting changed: ${key}`);
  records.push(a.record, b.record);
  console.log(JSON.stringify(a.record));
  console.log(JSON.stringify(b.record));
  for (const [scenario, pattern] of [
    ["balanced chain", chain],
    ["wide scarce inputs", wide],
    ["power shortage", [...chain, ...chain.filter((v) => v !== "powerPlant")]],
  ])
    for (const growing of [false, true]) {
      const result = run(
        M,
        raw(count, pattern, growing),
        epoch + 1000 * year,
        defs,
        "Phase B",
        scenario + (growing ? " / growth" : " / housed"),
      );
      records.push(result.record);
      console.log(JSON.stringify(result.record));
      fs.writeFileSync(
        path.join(output, "phase-b-benchmark.json"),
        JSON.stringify(records, null, 2),
      );
    }
}
