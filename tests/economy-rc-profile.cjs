// Isolated-process, matched-warmup profiling. No production instrumentation.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  { Module } = require("node:module"),
  { execFileSync } = require("node:child_process"),
  { performance, PerformanceObserver } = require("node:perf_hooks"),
  inspector = require("node:inspector"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  variant = process.argv[2] || "C1",
  output = process.argv[3] || "/tmp/economy-rc-profile";
fs.mkdirSync(output, { recursive: true });
const R = require("../industrial/registry.js"),
  P = require("../industrial/progression.js");
const ctx = { window: { mapGameIndustrialRegistry: R }, console: { log() {} } };
for (const f of ["buildings.js", "industrial/integration.js"])
  vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const defs = JSON.parse(JSON.stringify(ctx.window.mapGameBuildings.CATALOG));
const source =
  variant === "B"
    ? execFileSync("git", ["show", "03adac1:economy_model.js"], {
        cwd: root,
        encoding: "utf8",
      })
    : variant === "C1-original"
      ? execFileSync("git", ["show", "122e575:economy_model.js"], {
          cwd: root,
          encoding: "utf8",
        })
      : fs.readFileSync(path.join(root, "economy_model.js"), "utf8");
const mod = new Module(path.join(root, "rc-" + variant + ".cjs"));
mod.filename = path.join(root, "rc-" + variant + ".cjs");
mod.paths = module.paths;
let code = source;
if (process.env.PROFILE_STAGES) {
  code = code.replace(
    "  const api = {",
    `  const rcStats={};
  function rcWrap(name,fn){return function(...args){const start=performance.now();try{return fn(...args)}finally{const s=rcStats[name]||(rcStats[name]={ms:0,calls:0});s.ms+=performance.now()-start;s.calls++}}}
  compiled=rcWrap('compiled',compiled);frame=rcWrap('frame',frame);evaluate=rcWrap('evaluate',evaluate);repetitions=rcWrap('repetitions',repetitions);apply=rcWrap('apply',apply);
  const api = {rcStats,`,
  );
}
mod._compile(code, mod.filename);
const M = mod.exports,
  epoch = 1800000000000,
  target = epoch + 1000 * 365.25 * 86400000,
  types = [
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
const fixturePath = path.join(output, "fixture.json");
if (!fs.existsSync(fixturePath))
  fs.writeFileSync(
    fixturePath,
    JSON.stringify({
      money: 1e12,
      steel: 100,
      carbon: 40,
      iron: 0,
      inventory: { ironOre: 3, coal: 2 },
      placedIncomeItems: Array.from({ length: 10000 }, (_, i) => ({
        id: "b" + i,
        type: types[i % types.length],
        level: 1,
      })),
      economy: { version: 3, population: 100000, lastTick: epoch },
    }),
  );
const raw = JSON.parse(fs.readFileSync(fixturePath));
function prepare() {
  const state = M.normalize(raw, epoch);
  M.bindContracts(state, defs, 3);
  if (variant !== "B") P.init(state, defs, { legacy: true });
  return state;
}
function solve(state) {
  let r,
    total = 0,
    steps = 0;
  do {
    r = M.advance(state, target, false, defs, { maxEvaluations: 64 });
    total += r.evaluations;
    steps += r.steps;
  } while (!r.complete);
  return { evaluations: total, steps };
}
const warms = Number(process.env.WARMUPS || 10),
  runs = Number(process.env.SAMPLES || 25);
for (let i = 0; i < warms; i++) solve(prepare());
(async () => {
  const session = new inspector.Session();
  session.connect();
  const post = (cmd, args = {}) =>
    new Promise((resolve, reject) =>
      session.post(cmd, args, (err, res) => (err ? reject(err) : resolve(res))),
    );
  if (process.env.CPU_PROFILE) {
    await post("Profiler.enable");
    await post("Profiler.setSamplingInterval", { interval: 500 });
    await post("Profiler.start");
  }
  if (M.rcStats) for (const k of Object.keys(M.rcStats)) delete M.rcStats[k];
  const gcEvents = [];
  const gcObserver = process.env.GC_PROFILE
    ? new PerformanceObserver((list) =>
        gcEvents.push(
          ...list
            .getEntries()
            .map((e) => ({
              start: e.startTime,
              duration: e.duration,
              kind: e.detail?.kind,
            })),
        ),
      )
    : null;
  gcObserver?.observe({ entryTypes: ["gc"] });
  const samples = [],
    prep = [];
  let ledger;
  for (let i = 0; i < runs; i++) {
    if (global.gc) global.gc();
    let start = performance.now();
    const state = prepare();
    prep.push(performance.now() - start);
    start = performance.now();
    const result = solve(state);
    samples.push({
      start,
      end: performance.now(),
      ms: performance.now() - start,
      ...result,
    });
    if (!ledger) ledger = state.economy.precision;
    assert.deepEqual(state.economy.precision, ledger);
  }
  if (process.env.CPU_PROFILE) {
    const { profile } = await post("Profiler.stop");
    fs.writeFileSync(
      path.join(output, variant + ".cpuprofile"),
      JSON.stringify(profile),
    );
  }
  session.disconnect();
  if (gcObserver) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    gcObserver.disconnect();
  }
  const values = samples.map((r) => r.ms).sort((a, b) => a - b),
    median = (a) => a.slice().sort((a, b) => a - b)[Math.floor(a.length / 2)];
  const record = {
    variant,
    fixtureSHA256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(fixturePath))
      .digest("hex"),
    sourceSHA256: crypto.createHash("sha256").update(source).digest("hex"),
    warmups: warms,
    runs,
    explicitGC: !!global.gc,
    instrumented: !!process.env.PROFILE_STAGES,
    medianMs: median(values),
    p10Ms: values[Math.floor(values.length * 0.1)],
    p90Ms: values[Math.floor(values.length * 0.9)],
    minMs: values[0],
    maxMs: values.at(-1),
    preparationMedianMs: median(prep),
    evaluations: samples[0].evaluations,
    steps: samples[0].steps,
    samples,
    stages: M.rcStats,
    gcEvents,
  };
  fs.writeFileSync(
    path.join(output, variant + ".json"),
    JSON.stringify(record, null, 2),
  );
  fs.writeFileSync(
    path.join(output, variant + "-ledger.json"),
    JSON.stringify(ledger),
  );
  console.log(JSON.stringify({ ...record, samples: undefined }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
