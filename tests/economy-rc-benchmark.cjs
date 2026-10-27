// Independent V8 processes prevent one variant's optimization/GC feedback
// from biasing the other's samples. This is the targeted RC performance gate.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process");
const output = process.argv[2] || "/tmp/economy-rc-benchmark",
  root = path.resolve(__dirname, "..");
fs.mkdirSync(output, { recursive: true });
const trials = [];
let ledger, fixture;
for (let trial = 1; trial <= 4; trial++)
  for (const variant of trial % 2 ? ["B", "C1"] : ["C1", "B"]) {
    const dir = path.join(output, trial + "-" + variant),
      log = fs.openSync(path.join(output, trial + "-" + variant + ".log"), "w");
    const env = { ...process.env, WARMUPS: "10", SAMPLES: "25" };
    delete env.CPU_PROFILE;
    delete env.PROFILE_STAGES;
    const result = spawnSync(
      process.execPath,
      [
        "--expose-gc",
        path.join(__dirname, "economy-rc-profile.cjs"),
        variant,
        dir,
      ],
      { cwd: root, env, stdio: ["ignore", log, log] },
    );
    fs.closeSync(log);
    assert.equal(result.status, 0, "Profile child failed");
    const data = JSON.parse(fs.readFileSync(path.join(dir, variant + ".json"))),
      actual = JSON.parse(
        fs.readFileSync(path.join(dir, variant + "-ledger.json")),
      );
    if (!ledger) {
      ledger = actual;
      fixture = data.fixtureSHA256;
    }
    assert.deepEqual(actual, ledger, "Cross-version ledger mismatch");
    assert.equal(data.fixtureSHA256, fixture, "Fixtures differ");
    assert.equal(data.evaluations, 14);
    assert.equal(data.steps, 3155760000);
    trials.push({ trial, ...data });
    console.log(trial, variant, data.medianMs.toFixed(2) + " ms");
  }
const sorted = (a) => a.slice().sort((x, y) => x - y),
  median = (a) => {
    const b = sorted(a);
    return (
      (b[Math.floor((b.length - 1) / 2)] + b[Math.floor(b.length / 2)]) / 2
    );
  };
const stats = {};
for (const variant of ["B", "C1"]) {
  const t = trials.filter((r) => r.variant === variant),
    a = sorted(t.flatMap((r) => r.samples.map((s) => s.ms)));
  stats[variant] = {
    samples: a.length,
    medianMs: median(a),
    p10Ms: a[Math.floor(a.length * 0.1)],
    p90Ms: a[Math.floor(a.length * 0.9)],
    minMs: a[0],
    maxMs: a.at(-1),
    trialMedians: t.map((r) => r.medianMs),
    preparationMedianMs: median(t.map((r) => r.preparationMedianMs)),
  };
}
const regressions = Array.from({ length: 4 }, (_, i) => {
  const b = trials.find((r) => r.trial === i + 1 && r.variant === "B"),
    c = trials.find((r) => r.trial === i + 1 && r.variant === "C1");
  return c.medianMs / b.medianMs > 1.15 && c.medianMs - b.medianMs > 5;
}).filter(Boolean).length;
const report = {
  protocol:
    "Four alternating-order independent-process trials per variant; 10 warmups + 25 samples each; forced GC outside timed solve; identical serialized schema-3 fixture; all ledger strings/evaluations/logical ticks agree",
  fixtureSHA256: fixture,
  stats,
  medianRatio: stats.C1.medianMs / stats.B.medianMs,
  regressionPolicy:
    "Flag >15% and >5 ms median slowdown in at least 3 of 4 trial pairs",
  regressionTrials: regressions,
  significantRegression: regressions >= 3,
  trials,
};
fs.writeFileSync(
  path.join(output, "rc-performance.json"),
  JSON.stringify(report, null, 2),
);
assert.equal(
  report.significantRegression,
  false,
  "Repeatable RC solver regression",
);
console.log(JSON.stringify({ ...report, trials: undefined }, null, 2));
