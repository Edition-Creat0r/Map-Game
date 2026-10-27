# Phase C1 RC investigation — release remains blocked

This follow-up starts from `122e575bb82d19b9f4f2c15a3e73b0059f5701de`. It adds **no gameplay features and no retained runtime optimization**. All 47 application/data files remain byte-identical to that commit. Changes are limited to profiling/benchmark tools, release-runner coverage and review/deployment documentation. Two experimental caches were measured and reverted because neither improved elapsed timing reliably.

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

The historical 42% is not consistently reproduced, but a repeatable slowdown **was** observed in the release gate. The earlier near-parity run is insufficient to clear it. **Performance clearance is withheld.** These results do not establish a single deterministic C1-only source; claiming that GC alone, progression alone or one function caused the historical 42% would exceed the evidence. Further isolation under a stable profiling environment is needed before calling this resolved.

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

No model, script cache-bust, save-format, multiplier, research, priority or gameplay-rule changes from these experiments remain. The original runtime is retained exactly.

## Retained benchmark fixes and final candidate

The broader 100/1,000/10,000-record, scarce-input, power-shortage, population-growth and automatic-priority benchmark now warms both variants equally for each scenario, collects five samples instead of three and saves raw samples. The release runner includes the independent-process performance gate after all inherited suites. These changes expose variability instead of suppressing failed samples.

After the final documentation commit, fetch main, construct a separate local two-parent merge candidate and run the complete release runner on that exact tree/server. Results, source/main/candidate hashes, all suite exits and raw data are recorded under `/workspace/industrial-c1-rc/final-exact-merge/` and `/workspace/industrial-c1-rc/FINAL_RELEASE_REPORT.md`. Earlier failing data is preserved separately under `exact-merge/`; a later passing batch must not be presented as erasing that unresolved concern.

Reproduction:

```sh
node tests/economy-rc-benchmark.cjs /tmp/c1-isolated
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-stage-b
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-stage-c1
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-cpu-b
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-cpu-c1
GC_PROFILE=1 node tests/economy-rc-profile.cjs C1-original /tmp/c1-natural-gc
# Exact candidate static server and Chromium's existing trusted CA, TLS enabled:
NODE_PATH=/workspace/.onboarding-tools/node_modules MAP_GAME_TEST_URL=http://127.0.0.1:8004 node tests/run-c1-release.cjs /tmp/c1-final-exact
```

## PR/deployment blockers

Authorized PR creation returns `Post https://api.github.com/graphql: Forbidden`; Pages settings API returns `Forbidden`. The deployed-site request fails before reaching the application: `curl (56): CONNECT tunnel failed, response 403`, HTTP 000. No bypass or alternate identity is used. Git push works through the existing authorized transport but does not establish API permissions.

Manual PR: https://github.com/Edition-Creat0r/Map-Game/pull/new/feature/0.3.4-industrial-revolution . Copyable prepared body: `industrial/PR_BODY.md`.

Fetched main has a root static entry point but no Pages workflow, CNAME, `.nojekyll` or package/build configuration. Repository files alone do not establish whether Pages is enabled or its source branch/folder/workflow. The exact manual source, deployment-SHA and deployed-site verification steps are in `PAGES_VERIFICATION.md`. No deployment success is claimed. Main must remain unchanged while performance or external release gates remain unresolved. C2 is not started.
