# Phase C1 final release-candidate investigation

This follow-up starts from `122e575bb82d19b9f4f2c15a3e73b0059f5701de`. It adds no gameplay features. **All application code, catalogs and save rules are byte-identical to that commit.** The only retained changes are profiling/benchmark tools, release-runner coverage and review/deployment documentation. The earlier 60.88/86.28 ms comparison is historical and is superseded by the controlled investigation below.

## What the measurements establish

The original broad benchmark used three measured samples per version/scenario in one V8 process, no scenario-specific warm-up, alternating versions, and retained only medians. It interleaved different city sizes/scenarios. C1 also initialized progression immediately before its timed solve, affecting the shared allocation/GC history. Consequently the historical numbers cannot distinguish a runtime regression from sampling, compiler, heap or host variance. No CPU profile, GC trace or individual samples were retained for that exact historical run; attributing its precise extra 25.4 ms to one function would be unsupported.

`tests/economy-rc-profile.cjs` now runs one model per independent Node process, loads the same serialized schema-3 fixture, normalizes/binds contracts outside the timed solve, applies C1's required migration outside that timer, performs ten warm-ups and collects 25 fresh-state solve samples. Explicit GC, when enabled, runs before preparation and outside the timed solve. Every result includes input/source SHA-256, preparation times, raw samples, evaluations and logical ticks. Every run simulates 10,000 buildings over 1,000 years. No time cap, work budget reduction or constraint bypass was used.

Initial four-trial measurements (100 samples per version, alternating process order; Node v24.19.0, Intel Xeon Platinum 8573C):

| Model | Pooled median ms | p10–p90 ms | Min–max ms | Trial medians ms |
|---|---:|---|---|---|
| Phase B | 63.58 | 52.67–101.99 | 48.75–209.80 | 59.58, 64.66, 61.69, 64.45 |
| Original C1 | 64.26 | 52.64–93.57 | 51.07–122.58 | 60.73, 64.50, 64.79, 64.30 |
| Experimental input-cost cache | 65.50 | 50.74–107.36 | 47.87–126.81 | 68.96, 66.36, 59.58, 64.62 |

Original C1 differs by **+0.69 ms / +1.08%**, with strongly overlapping distributions. All variants produce exactly the same registered-resource/population/earnings BigInt ledger strings, 14 evaluator calls and 3,155,760,000 logical ticks. The original 42% difference is not reproducible under these conditions. The allocation-cache experiment did not provide a consistent timing benefit and was **reverted**; it is not in the release candidate.

An additional natural-GC run without explicit GC measured B median 53.86 ms and C1 median 49.73 ms. There were 57/63 GC events across preparation and timed samples; individual slower solves contained multiple collections (roughly 1–8 ms observed GC duration), but GC alone does not account for all tail latency. These diagnostic runs corroborate variability; they are not substituted for the independent-process release gate.

## Profile and source inspection

- The V8 CPU profiles locate the main cost in the **shared `evaluate` function**, with compilation/map callback, allocation/GC and `advance` secondary. For 40 profiled solves, sampled evaluator self time was approximately 2,803 ms B / 2,027 ms C1; compilation self time approximately 125/123 ms. Profiling includes preparation/explicit GC and adds sampling overhead, so those are diagnostic totals, not unprofiled benchmark medians or a speed claim.
- Inclusive timing wrappers over 15 diagnostic solves attributed B compilation/frame to 190/54 ms and evaluator calls to 811 ms; C1 compilation/frame to 241/65 ms and evaluator calls to 926 ms. Wrapper overhead and host variance are why these times are kept separate from the isolated uninstrumented runs. `frame` is included in `compiled` and must not be added twice.
- Progression's `checkSaved`/`init` occur in preparation, not in the guarded simulation loop. C1 preparation medians were around 8 ms versus B around 7–8 ms. `refresh` is not invoked by the pure solver's per-tick loop. UI/migration logic does not introduce repeated research evaluation there.
- Manual priority setup reads the saved configuration and constructs an empty rank map once per compilation; the original saved-order comparator remains in use. Automatic ranks are constructed once per compilation, with stable saved ID order; there is no repeated priority planning during individual evaluator calls.
- Compiled recipe templates and material-slot maps are already shared per type/level/contract. The shared evaluator still allocates/scales per-building input costs and computes exact BigInt affordability/workforce guards. A prototype cache reduced repeated cost-list construction but did not improve measured runtime consistently, so no production optimization is justified by the current evidence.

The established issue is **an unreliable earlier comparison**, not a demonstrated new 42% simulation cost. We do not claim to know the exact scheduler/compiler event in that untraced historical sample. The revised benchmark retains the evidence necessary to investigate future outliers.

## Revised release protocol

`tests/economy-rc-benchmark.cjs` runs four alternating-order independent-process trials per version, ten warm-ups and 25 samples each (100 measured samples per version). It asserts identical fixture hashes, cross-version exact ledger strings, 14 evaluations and the same full logical-tick count. The predeclared practical regression screen flags a candidate median more than 15% **and** 5 ms slower in at least three of four trial pairs. Raw distributions/per-trial medians are always reported; passing the screen is not a universal latency guarantee.

The broader 100/1,000/10,000-record, scarce-input, power-shortage, population-growth and automatic-priority benchmark now warms both models equally per scenario, collects five samples instead of three, and retains all raw samples. `tests/run-c1-release.cjs` includes the independent-process performance gate after all inherited suites. No economy equations or solver guards were changed.

After the candidate commit, fetch current main, create a separate **local two-parent merge candidate**, verify its tree against the feature tree when main remains an ancestor, and run the complete release runner against that exact worktree and its own static server. Final hashes, all suite exits, fresh benchmark distributions, screenshots and gameplay results are recorded in `/workspace/industrial-c1-rc/exact-merge/` and `/workspace/industrial-c1-rc/FINAL_RELEASE_REPORT.md` rather than adding self-referential commit hashes to this document.

Reproduction:

```sh
node tests/economy-rc-benchmark.cjs /tmp/c1-isolated
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-stage-b
PROFILE_STAGES=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-stage-c1
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs B /tmp/c1-cpu-b
CPU_PROFILE=1 node --expose-gc tests/economy-rc-profile.cjs C1-original /tmp/c1-cpu-c1
GC_PROFILE=1 node tests/economy-rc-profile.cjs C1-original /tmp/c1-natural-gc
# With a static server for the exact candidate on 8003 and trusted Chromium:
NODE_PATH=/workspace/.onboarding-tools/node_modules MAP_GAME_TEST_URL=http://127.0.0.1:8003 node tests/run-c1-release.cjs /tmp/c1-exact-release
```

## GitHub PR and deployment gate

Authorized `gh pr create --repo Edition-Creat0r/Map-Game --base main --head feature/0.3.4-industrial-revolution --body-file ...` returned `Post https://api.github.com/graphql: Forbidden`. `gh api repos/Edition-Creat0r/Map-Game/pages` returned `Forbidden`. This is an access blocker, not authorization to bypass permissions. The feature branch can be pushed through its existing authorized git transport, but that does not establish API/PR/Pages permissions.

Manual PR creation: https://github.com/Edition-Creat0r/Map-Game/pull/new/feature/0.3.4-industrial-revolution . Prepared text: `industrial/PR_BODY.md`.

Fetched main has a root static `index.html` but no `.github` workflow, CNAME, `.nojekyll` or package/build configuration. **That does not establish whether Pages is enabled, its source branch/folder, or whether an external workflow publishes it.** Remote Pages settings must be verified; no deployment success is claimed from local browser tests. Exact manual steps are in `PAGES_VERIFICATION.md`.

Only merge a normal PR after every release gate, including deployment configuration access, is cleared. No force-push, main overwrite, reward workaround or multiplayer changes are authorized here. C2 remains unstarted.
