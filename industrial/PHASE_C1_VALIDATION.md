# Phase C1 validation and release gate

**RC follow-up:** see `PHASE_C1_RC.md` for controlled profiling, including a failed independent-process gate and rejected experiments. Historical measurements below remain as recorded. The retained fixed-size evaluator-array change is described there; final candidate reports are under `/workspace/industrial-c1-rc/`.

Branch: `feature/0.3.4-industrial-revolution`, based on validated Phase B `03adac1`. The branch contains rendering stabilization, biomes, forests, terrain/hydrology polish, starter economy and Phases A/B. Current remote main `49b7dcac7395c409b2343c42b6efd5924394cb86` is an ancestor, with no conflicting main-only changes when fetched for this review. C1 is an additive implementation of the official amendment; C2–F remain future work.

## Implemented and checked

- Exactly 100 explicitly selected canonical materials: 10 initially unlocked, then 15/20/20/20/15 additions. All 121 internal resources and 120 industrial definitions plus five starter contracts are preserved. Appendix: `PLAYER_MATERIALS.md`.
- Seven fixed-cost, prerequisite-validated research nodes, six introductory eras, available/discover shop views, five-section Singleplayer navigation, Next Goal and Legacy Inventory.
- Optional deterministic automatic priority plan, settled before configuration changes; manual remains the default. No changes to the exact tick/affine-cycle equations, online 1.2× input/output throughput, offline 1× throughput or uncapped elapsed time.
- Schema 4 plus progression/manifest version 1; exact BigInt ledgers, unknown fields, partial checkpoints and pinned rules retained. Legally acquired capabilities are grandfathered individually. Previously inactive future definitions are not activated by migration. Unsupported future versions fail closed. Migration/backup/downgrade policy: `PHASE_C1_GUIDE.md`.
- Disabled future official-minigame contract only: no rewards, grants or multiplayer writes.

Development validation passed **87 automated tests**, including all 70 inherited cases and 17 C1 cases. Browser tests passed fresh Singleplayer, actual shop/canvas placement, all seven research purchases, six-era progression, all 100 unlocks, industrial input/output production, automatic priorities, save/reload and returning to the World Map. The inherited starter, Phase B industrial, forest and environment suites also passed after updating navigation/version expectations. Browser logs reported no uncaught errors, missing resources or failed requests. The initial forest invocation used its historical default port 8000 and could not connect; it passed when pointed at the active port 8001. An incorrect new assertion about inactive rows being absent from the status list was corrected to assert that the preserved row remains nonoperating.

C1 does not change `auth.js`, `multiplayer.js`, territory/streaming/ownership files, terrain, biome, forest, hydrology, water rendering, Basic/Regular building renderers or original catalog prices/recipes. `game.js` and `world_config.js` only receive a release-label update. Full source diff and whitespace review precede the candidate commit. No certificates, private keys, credential files or trust-store changes are included. Chromium uses the environment's previously authorized trust store with TLS verification enabled.

## Measured performance against Phase B

Chromium 154, software WebGL, 1440×1000. Three interleaved fresh-browser runs against exact Phase B `03adac1`, medians shown. Network/JIT/host variance means timing differences do not establish a universal speed improvement.

| Metric | Phase B | C1 |
|---|---:|---:|
| Startup | 1,734 ms | 1,646 ms |
| Territory entry | 799 ms | 771 ms |
| High-detail ready, including wheel gestures | 2,517 ms | 2,520 ms |
| World Map pan FPS / p95 | 60.0 / 16.8 ms | 60.0 / 16.8 ms |
| Local pan FPS / p95 | 60.0 / 16.8 ms | 59.6 / 16.8 ms |
| Zoom FPS / p95 | 60.0 / 16.8 ms | 60.0 / 16.8 ms |
| High-detail pan FPS / p95 | 60.0 / 16.8 ms | 60.0 / 16.8 ms |
| Long tasks, each run | 2 / 2 / 2 | 2 / 2 / 2 |
| Maximum long task by run | 191 / 191 / 194 ms | 190 / 204 / 180 ms |

The closed shop was never constructed in these gesture runs. A separate 50-open/filter test in three interleaved runs measured median per-run median **2.3 ms B / 3.1 ms C1**, median p95 **6.6 / 4.4 ms**, with at most ten rendered rows. Discovery and purchase gating add a small user-action cost; no catalog work is inserted into per-pixel rendering.

Mixed industrial browser fixtures resumed **1,000 years / 3,155,760,000 logical ticks**:

| Records | Phase B historical resume / pan FPS / p95 | C1 resume / pan FPS / p95 | C1 resume long tasks |
|---|---|---|---|
| 1,000 | 344 ms / 57.2 / 16.8 ms | 402 ms / 58.0 / 16.8 ms | 0 |
| 10,000 | 1,262 ms / 50.3 / 33.4 ms | 1,119 ms / 59.2 / 16.8 ms | 3, maximum 114 ms |

These large-city browser numbers are single runs, not a statistically matched speed claim. A separate inherited 10,000 starter-city fixture measured 48.4 FPS and a 150 ms maximum pan frame; JSON commits/drawing still cause occasional stalls. Phase C1 does not claim to solve all large-city rendering costs.

`tests/phase-c1-benchmark.cjs` compares exact Phase B and C1 models in one process at 100/1,000/10,000 records, mixed chains, scarce inputs, power shortage and population growth over 1,000 years, with three interleaved solver samples. All registered-resource ledger strings agree exactly in every manual-order case. Optional automatic plans additionally agree with 60 bounded per-tick online reference ticks at every size. A 10,000-record priority-plan calculation measured 4.7 ms; its 1,000-year automatic solver measured 58.7 ms in the development run.

Some short manual solver scenarios measured slower than B, while others measured faster; host/JIT variance and compilation dominate those samples. Raw tables are retained rather than claiming every solver case is faster. Final exact-candidate measurements below are authoritative for the release gate; significant unresolved performance concerns must prevent merging.

## Exact proposed merge and artifacts

`tests/run-c1-release.cjs` runs the complete release sequence **sequentially**: all automated tests; C1, starter, Phase B, forest and environment browser regressions; both large-city fixtures; three-run navigation and shop comparisons; and exact/reference model benchmarks. It also rejects nonempty error/failure/HTTP arrays from inherited reporting-only scripts. Run this against a local two-parent merge candidate from the freshly fetched main and the completed feature commit, without changing main. The merge-candidate tree must equal the tested feature tree when main remains an ancestor.

Final candidate SHA, feature SHA, tree equality, suite results and raw performance are recorded outside the repository in `/workspace/industrial-phase-c1/exact-merge/` and `/workspace/industrial-phase-c1/merge-candidate.json`, avoiding a self-referential commit hash in this document. Development artifacts are under `/workspace/industrial-phase-c1/`; screenshots include `c1-browser-final/research-completed.png`, `industrial-shop.png`, `all-materials-unlocked.png`, `working-factories.png` and `unlocked-inventory.png`. Forest and environment screenshots are retained there as well.

## Merge/deployment status and blockers

**Do not infer a GitHub merge from a local validation merge.** At preparation, `gh auth status` reports an invalid token and `gh api user` returns Forbidden. PR creation/merge and GitHub Pages settings cannot be verified with this access. Main has not been overwritten or force-pushed. No post-merge deployment smoke test can be claimed before a real PR merge and verified deployment. Public source has a root static entry point and no checked-in Pages workflow; that does not establish the repository's remote Pages configuration. Release authorization remains conditional: unavailable GitHub access, unverified Pages configuration, failing tests or unresolved performance concerns block merging. A reviewable PR body and final results are prepared in the external artifacts folder; C2 is not started.

## Files changed in C1

Runtime: `economy.js`, `economy_model.js`, `economy_ui.js`, `economy_worker.js`, `industrial/progression.js`, `industrial/progression-ui.js`, `index.html`, `styles.css`, and version labels in `game.js`/`world_config.js`.

Data: `industrial/player-materials.json`, `player-materials-data.js`, `research.json`, `research-data.js`, `build-progression.cjs`.

Documentation: `industrial/RELEASE_PLAN.md`, `PHASE_C1_SPECIFICATION.md`, `PHASE_C1_GUIDE.md`, `PHASE_C1_VALIDATION.md`, `PLAYER_MATERIALS.md`.

New tests/tools: `tests/progression.test.cjs`, `phase-c1-browser.cjs`, `phase-c1-benchmark.cjs`, `progression-shop-performance.cjs`, `run-c1-release.cjs`. Existing test updates: `economy.test.cjs`, `economy-browser.cjs`, `industrial-catalog.test.cjs`, `industrial-browser.cjs`, `phase-b-browser.cjs` (new dependency injection, version expectations, explicit detailed catalog and navigation/research steps; prior economic assertions retained).
