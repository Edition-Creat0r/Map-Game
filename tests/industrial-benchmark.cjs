// Baseline is deliberately reported as capped: its fast result loses elapsed time.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  { execFileSync } = require("node:child_process"),
  { performance } = require("node:perf_hooks");
const root = path.resolve(__dirname, ".."),
  output = process.argv[2] || "/tmp/map-game-industrial";
fs.mkdirSync(output, { recursive: true });
const c = { window: {}, console: { log() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, "buildings.js"), "utf8"), c);
const defs = JSON.parse(JSON.stringify(c.window.mapGameBuildings.CATALOG));
const modern = require("../economy_model.js"),
  { Module } = require("node:module");
// Compile both models into the same Node realm; cross-realm callbacks distort costs.
const legacyModule = new Module(path.join(root, "baseline-economy-model.cjs"));
legacyModule._compile(
  execFileSync("git", ["show", "feature/0.3.3d-economy:economy_model.js"], {
    cwd: root,
    encoding: "utf8",
  }),
  path.join(root, "baseline-economy-model.cjs"),
);
const legacy = legacyModule.exports;
const origin = 1800000000000,
  year = 365.25 * 86400000,
  pattern = [
    "smallHouse",
    "powerPlant",
    "steelMill",
    "carbonPlant",
    "cornerStore",
    "smallHouse",
  ];
function fixture(count, growing) {
  const rows = Array.from({ length: count }, (_, i) => ({
      id: "b_" + i,
      type: pattern[i % pattern.length],
      territoryId: "T_190_27",
      x: (i % 100) * 200 + 100,
      z: Math.floor(i / 100) * 200 + 100,
    })),
    housing = rows.filter((v) => v.type === "smallHouse").length * 20;
  return {
    money: 1e12,
    placedIncomeItems: rows,
    economy: {
      version: 1,
      population: growing ? 0 : housing,
      lastTick: origin,
    },
  };
}
const records = [];
for (const count of [6, 1000, 10000]) {
  const state = legacy.normalize(fixture(count, false), origin),
    start = performance.now(),
    result = legacy.advance(state, origin + year, false, defs);
  records.push({
    variant: "0.3.3D-capped",
    count,
    growing: false,
    yearsRequested: 1,
    simulatedHours: result.elapsedMinutes / 60,
    ms: performance.now() - start,
    steps: result.steps || 4320,
  });
  for (const growing of [false, true])
    for (const years of [1, 1000]) {
      const state = modern.normalize(fixture(count, growing), origin),
        start = performance.now();
      let steps = 0,
        evaluations = 0,
        passes = 0,
        result;
      do {
        result = modern.advance(state, origin + years * year, false, defs, {
          maxEvaluations: count > 1000 ? 2 : 32,
        });
        steps += result.steps;
        evaluations += result.evaluations;
        passes++;
      } while (!result.complete);
      const row = {
        variant: "0.3.4A",
        count,
        growing,
        yearsRequested: years,
        simulatedHours: (years * year) / 3600000,
        ms: performance.now() - start,
        steps,
        evaluations,
        passes,
        population: state.economy.population,
        money: state.money,
      };
      records.push(row);
      console.log(JSON.stringify(row));
    }
  fs.writeFileSync(
    path.join(output, "industrial-benchmark.json"),
    JSON.stringify(records, null, 2),
  );
}
