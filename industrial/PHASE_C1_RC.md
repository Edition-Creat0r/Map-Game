# Phase C1 RC investigation — focused evaluator fix

This follow-up starts from `122e575bb82d19b9f4f2c15a3e73b0059f5701de`. It adds **no gameplay features**. A focused evaluator-array fix is retained after JIT tracing and repeated measurement; two unrelated cost-cache experiments were rejected and reverted. The four application changes are `economy_model.js` plus cache-busting references in `economy.js`, `economy_worker.js` and `index.html`. All other 43 application/data files, resource/recipe catalogs, saves, progression and ownership rules remain byte-identical to validated C1. Profiling, benchmark coverage and documentation are also updated.

## Target benchmark protocol

The historical 60.88/86.28 ms comparison used three samples per model/scenario in one V8 process, without scenario-specific warm-up or retained raw samples/profiles. It mixed city sizes, variants and allocation histories. Therefore the exact extra 25.4 ms in that untraced run cannot be assigned retrospectively to a particular function or GC/compiler event.

`tests/economy-rc-profile.cjs` now runs one model per independent Node process, reads the same serialized schema-3 fixture, normalizes/binds contracts and applies required C1 migration outside the timed solve, warms ten full solves, and collects 25 fresh-state samples. Explicit GC, when enabled, runs before preparation and outside the timer. Input/source SHA-256, preparation timings, raw samples, evaluations and full logical ticks are retained. Every run simulates 10,000 buildings over 1,000 years; no elapsed-time cap, work reduction or constraint bypass was used.

`tests/economy-rc-benchmark.cjs` repeats four alternating-order process pairs (100 measured samples/version). It asserts identical fixture hashes, exact cross-version ledger strings, 14 evaluations and 3,155,760,000 logical ticks. A predeclared practical screen flags >15% **and** >5 ms median slowdown in at least three of four process pairs. Raw distributions and per-process medians are always retained; passing one cohort does not erase an earlier failing cohort or guarantee latency.

## Results: materially inconsistent cohorts

Node v24.19.0, Intel Xeon Platinum 8573C. Each table row has 100 measured samples/version; numbers below are the complete observations at investigation time, including the failure.

| Cohort | B median ms | Original C1 median ms | Outcome |
|---|---:|---:|---|
| Initial independent-process investigation | 63.58 | 64.26 | Near parity, +1.08% |
| Exact merge-candidate release gate | 69.71 | 84.77 | **Failed**, +21.61%, slower in 3/4 process pairs |
| Later three-way experiment control | 67.25 | 66.98 | Near parity |

Initial B p10–p90: 52.67–101.99 ms; C1: 52.64–93.57 ms. Failing exact-candidate B p10–p90: 56.34–110.06 ms, min/max 51.60/146.51; C1: 58.11–188.18 ms, min/max 54.17/550.37. Per-process medians in the failure were B **70.69, 66.43, 67.27, 72.56** versus C1 **103.39, 101.62, 88.98, 73.28**.

The historical 42% is not consistently reproduced, but a repeatable slowdown **was** observed in the release gate. The earlier near-parity run is insufficient to clear it. **The pre-fix performance gate was not cleared.** These results do not establish a single deterministic C1-only source; claiming that GC alone, progression alone or one function caused the historical 42% would exceed the evidence. The subsequent JIT diagnosis and retained fix below address an observed execution mechanism; they do not retrospectively establish the exact events in the untraced historical sample.

## Profile findings and inspected paths

- V8 profiles identify the shared **`evaluate`** function as the largest sampled cost. For 40 profiled solves, evaluator self time was approximately 2,803 ms B / 2,027 ms C1; compilation self time approximately 125/123 ms. Those totals include profiler overhead and surrounding preparation/explicit GC and are not standalone timing medians or a speed claim.
- Inclusive timing wrappers over 15 diagnostic solves attributed B compilation/frame to 190/54 ms and evaluation to 811 ms; C1 to 241/65 and 926 ms. Frame is included in compilation and must not be added twice. Instrumentation changes optimization/overhead, so it is kept separate from the uninstrumented gate.
- Progression `checkSaved`/`init` occur in preparation, not in the pure solver's per-tick loop. Preparation was around 7–9 ms; `refresh` is not called by pure `advance`. There is no repeated research-DAG evaluation during per-building simulation.
- Manual priority preparation reads configuration and constructs an empty rank map once per compilation; the saved-order comparator is unchanged. Automatic ranks are built once per compilation; priority planning is not repeated inside evaluator ticks.
- Compilation already shares recipe templates per type/level/contract and material-slot maps. The evaluator still allocates input-cost arrays and computes exact BigInt balance/workforce guards per building. This is shared Phase B/C1 work, not proof of a new C1-specific hot path.
- Natural-GC diagnostic runs without explicit GC measured B median 53.86 and C1 49.73 ms. Multiple collections contributed roughly 1–8 ms to some slower solves but did not explain all tails. A GC-only explanation is not established.

## Rejected focused optimizations

1. An input-cost-list cache measured median **65.50 ms** versus original C1 **64.26 ms** in its 100-sample trials. It did not improve timing consistently and was reverted.
2. A broader cache shared immutable duration/bonus-dependent input/output, upkeep and growth constants per compiled recipe/level/contract. Every building still executed all original ordering, money/input/workforce/power guards and clamps. Diagnostic counts for one full target solve fell from **140,000 input lists / 62,216 input products / 140,000 upkeep products / 128,893 growth products / 82,217 output products** to **112 / 56 / 112 / 112 / 84**, while all ledgers, 14 evaluations and 3,155,760,000 ticks matched. Three temporary reference tests covering distinct contracts/levels, partial visibility and automatic priorities passed. Nevertheless, its paired 100-sample cohort measured **73.44 ms** versus original C1 **66.98 ms** (B 67.25). It was also reverted. Allocation reduction alone does not justify claiming a performance fix; the temporary implementation-specific tests were removed with the experiment.

No model or cache-bust changes from these two rejected cache experiments remain. The separately measured array-construction fix below is the only retained runtime optimization.

## Observed source: evaluator array-shape deoptimizations

A further V8 `--trace-opt --trace-deopt` run, pinned to CPU 0 with ten warmups and 25 measured solves per version, located **97 evaluator bailouts in original C1 versus 37 in B**. C1 had 58 `wrong map` bailouts at bytecode offset 2714 and 19 at 2759. Printing evaluator bytecode maps these directly to **`flow.push(growth)` and the capacity-array spread/result length** in the old evaluator (original source lines 405–407). These are JavaScript array/object-shape checks. Many repeated optimizer exits/recompilations occurred despite the warmups. CPU-affinity diagnostics recorded no cgroup throttling; elapsed and process CPU time were close, so scheduler waiting/quota throttling alone did not explain those particular slower runs.

The focused change constructs `flow` and `caps` once at their final `keys.length`, fills each resource slot with the exact old `output[i] - use[i]` / `MAX`, and assigns the final population slot to the exact old growth / `min(MAX, housing)`. It removes the map→push/spread result construction without altering any per-building calculation, guard, reservation, priority, clamp or affine cycle. The same pinned JIT diagnostic then recorded **16 evaluator bailouts**, eliminating the two dominant old sites. This is the observed mechanism supporting the change. It does not prove every tail or the exact historical extra 25.4 ms was due to that mechanism.

Four alternating three-way trials (100 samples/version, identical fixture and ten warmups):

| Version | Median ms | p10–p90 ms | Min–max ms | Per-process medians ms |
|---|---:|---|---|---|
| B | 66.61 | 53.27–113.97 | 51.01–139.32 | 67.58, 65.90, 62.84, 69.20 |
| Original C1 | 65.79 | 51.85–100.42 | 49.39–124.54 | 66.83, 57.85, 66.59, 65.50 |
| Fixed-size arrays | 56.16 | 51.01–95.08 | 49.40–158.08 | 62.74, 56.11, 56.13, 55.03 |

Median improvement versus original C1: **14.6%** in this cohort; versus B: 15.7%. The candidate's maximum remained variable and is reported rather than discarded. A separate 100-sample B/candidate cohort measured 65.85/63.45 ms, with zero regression pairs. Do not interpret individual cohorts as a universal speed guarantee. All samples preserve exact ledger strings, 14 evaluations and 3,155,760,000 logical ticks.

Two new deterministic tests in `tests/economy-array-results.test.cjs` compare complete saved state, result counters and summaries against pre-fix C1, including mixed levels/contracts, scarce inputs, partial online/offline visibility, automatic ordering, empty cities, population clamps, near-ceiling stocks, long offline time and cooperative evaluation budgets. The suite now has **89 tests**. Only changed model/adapter/worker URLs are cache-busted to 3404; there is no save-version, multiplier, price, recipe or progression change.

## Retained benchmark improvements and final candidate

The broader 100/1,000/10,000-record, scarce-input, power-shortage, population-growth and automatic-priority benchmark now warms both variants equally for each scenario, collects five samples instead of three and saves raw samples. The release runner includes the independent-process performance screen after all inherited suites. Failed pre-fix data is preserved, not replaced by the faster sample set.

After committing the array fix and cache-bust, fetch main, construct a separate local two-parent merge candidate and run the complete release runner on that exact tree/server. Final source/main/candidate hashes, all suite exits and raw measurements are under `/workspace/industrial-c1-rc/patched-exact-merge/` and `/workspace/industrial-c1-rc/FINAL_RELEASE_REPORT.md`. Earlier unpatched failing/passing cohorts remain under `exact-merge/` and `final-exact-merge/`. No main merge is authorized until the new candidate and external gates pass.

Reproduction:

```sh
node tests/economy-rc-benchmark.cjs /tmp/c1-isolated
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-stage-b
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-stage-c1
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-cpu-b
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-cpu-c1
GC_PROFILE=1 node tests/economy-rc-profile.cjs C1-original /tmp/c1-natural-gc
# Optional JIT diagnostics; source C1-original is pinned to commit 122e575:
taskset -c 0 node --expose-gc --trace-opt --trace-deopt tests/economy-rc-profile.cjs C1-original /tmp/c1-jit-old
taskset -c 0 node --expose-gc --trace-opt --trace-deopt tests/economy-rc-profile.cjs C1 /tmp/c1-jit-fixed
# Exact candidate server; Chromium's existing trusted CA and TLS enabled:
NODE_PATH=/workspace/.onboarding-tools/node_modules MAP_GAME_TEST_URL=http://127.0.0.1:8005 node tests/run-c1-release.cjs /tmp/c1-patched-exact
```

## PR/deployment blockers

Authorized PR creation returns `Post https://api.github.com/graphql: Forbidden`; Pages settings API returns `Forbidden`. The deployed-site request fails before reaching the application: `curl (56): CONNECT tunnel failed, response 403`, HTTP 000. No bypass or alternate identity is used. Git push works through the existing authorized transport but does not establish API permissions.

Manual PR: https://github.com/Edition-Creat0r/Map-Game/pull/new/feature/0.3.4-industrial-revolution . Copyable prepared body: `industrial/PR_BODY.md`.

Fetched main has a root static entry point but no Pages workflow, CNAME, `.nojekyll` or package/build configuration. Repository files alone do not establish whether Pages is enabled or its source branch/folder/workflow. The exact manual source, deployment-SHA and deployed-site verification steps are in `PAGES_VERIFICATION.md`. No deployment success is claimed. Main must remain unchanged while any local or external release gate remains unresolved. C2 is not started.
