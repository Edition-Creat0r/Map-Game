# 0.3.4 — Phase A results

Phase A is implemented on `feature/0.3.4-industrial-revolution`, from `feature/0.3.3d-economy` (8042c84). **Phase B has not started.** There is no automatic merge. The A–F boundaries, 120-building catalog specification, planned production graph and active balancing table are in [RELEASE_PLAN.md](RELEASE_PLAN.md); [catalog.schema.json](catalog.schema.json) specifies the future registry. [MIGRATION.md](MIGRATION.md) explains exact accounting, save compatibility, interruption and clock limits.

## Implementation

The 12-hour elapsed cap has been removed, without substituting a longer time cap. `economy_model.js` now evaluates operating inequalities and skips provably equivalent affine cycles. It stops at cash, input, workforce, housing and stock boundaries rather than looping over every elapsed tick. A steady six-building, 1,000-year case accounts for 3,155,760,000 logical ten-second steps in two evaluations. A growing 10,000-building case requires 50 evaluations, including later stock saturation.

Version-2 exact ledgers use JSON-safe integer strings and BigInt arithmetic internally. Callback partitioning, batching and reload no longer introduce cumulative floating-point differences. Upkeep, energy and workers retain their existing operating rules. Input/output support is tested on prototype recipes using the six current resources, including alternating shortages and boosted input consumption. **The five live starter recipes, prices, footprints and legacy behavior are unchanged**; the 120-building graph is a Phase B specification, not a claim of shipped industrial content.

Large offline jobs use `economy_worker.js`; the worker cannot access storage or ownership. The owning tab commits the completed balances and checkpoint atomically. Cancellation, stale messages, failure fallback, competing tabs and a purchase attempting to race settlement are tested. A bounded cooperative fallback preserves every remaining millisecond. Partial checkpoints are not misrepresented as completed catch-up. Economic mutations are blocked while catch-up runs.

Ordinary sub-tick callbacks skip city compilation. Summaries are cached until balances/layout or rate mode change, and catch-up does not repeatedly rebuild the full UI between passes. A lightweight `getStatus()` avoids materializing a 10,000-building snapshot merely to ask whether work finished. No economy computation was added to terrain/forest pixel or drawing loops.

Live wall/monotonic skew receives offline 1× and a notice; it is not discarded, since genuine system suspension can look like a clock edit. Backward timestamps cannot repay time, and saved checkpoints prevent repeated awards. A locally edited save or forward date while the game is closed cannot be authenticated without an external authority. No anti-cheat or multiplayer-economy security is claimed.

## Automated and browser validation

**55 Node tests pass.** These include all existing terrain/biome/forest cases and the starter economy regression, plus long horizons, exact callback/reload equivalence, cooperative continuation, input conservation, cycle acceleration, seeded differential comparisons with a one-tick reference, worker cancellation/late messages/fallback, purchase/catch-up races, suspension policy, large-integer projection and competing-tab status persistence.

Browser suites pass:

- All five starter purchases, free cancellation, keyboard rotation, workforce/growth/production recovery, disabled unaffordable purchases and real terrain/overlap rejection.
- Migration and complete save/reload, unknown fields and legacy claims, Home closure and exclusive competing-tab behavior.
- Worker resumes for 1,000 and 10,000 records over a simulated 1,000-year closed-game interval; engine selection is asserted, and clock/suspension/reload checks pass.
- Singleplayer, strategic map, local territory entry, pan/zoom, building restoration and return to World Map.
- Existing forest LOD, 120 stable roots, cache bounds, zero idle candidate builds, queued-stream reopening, terrain continuity and visible rivers/lakes.

Final checked browser reports have **no console errors, failed requests or HTTP failures**. Babylon.js and Supabase scripts load with TLS verification enabled. No real authenticated multiplayer economy was exercised or added. Tests use fresh isolated browser contexts; the long-absence fixture shifts its test clock only inside that context.

## Model benchmarks

Single Node runs, same JavaScript realm and definitions for baseline/current. Normalize/load and browser persistence are excluded from the timed simulation. Results depend on JIT and host scheduling; they are not medians or equal-work speedup claims. The baseline receives a one-year request but accounts for only its capped 12 hours. Current cases account for the full requested duration.

| Buildings | 0.3.3D: capped 12h (ms) | A: full 1y, filled housing (ms) | A: full 1,000y, filled (ms) | A: full 1,000y, growing (ms) | Growing evaluations |
| --- | ---: | ---: | ---: | ---: | ---: |
| 6 | 17.94 | 2.06 | 0.30 | 0.56 | 17 |
| 1,000 | 628.53 | 6.77 | 3.52 | 34.86 | 41 |
| 10,000 | 7,330.58 | 49.98 | 144.86 | 516.85 | 50 |

A preliminary VM-based baseline distorted cross-realm callback cost (110 seconds for 10,000 records). It was rejected and rerun with both models loaded in the same Node realm; use the `fair-benchmark` results above. Prototype recipe/reference tests independently verify amounts and constraints; timing alone is not correctness evidence.

## Browser performance versus 0.3.3D

Chromium 154, 1440×1000, headless software WebGL. Three interleaved fresh-browser runs against the exact base branch HTML/JS/CSS and Phase A. Table entries are medians; full per-run data is retained. These representative gesture comparisons have the shop closed and an empty starter save. They do not describe 10,000-building rendering.

| Measurement | 0.3.3D | Phase A |
| --- | ---: | ---: |
| Engine ready | 1,680 ms | 1,796 ms |
| Territory entry | 802 ms | 752 ms |
| World Map pan FPS / p95 | 60.0 / 16.8 ms | 59.6 / 16.8 ms |
| Local pan FPS / p95 | 60.0 / 16.8 ms | 60.0 / 16.8 ms |
| Zoom FPS / p95 | 59.6 / 16.8 ms | 60.0 / 16.8 ms |
| Detailed pan FPS / p95 | 60.0 / 16.8 ms | 58.8 / 16.8 ms |
| At least 12 detail chunks, including wheel input | 2,517 ms | 2,617 ms |
| Long tasks (>50 ms) per run | 2, 2, 4 | 2, 3, 6 |
| Maximum long task per run | 209, 178, 186 ms | 154, 186, 189 ms |

The 116 ms startup increase, 100 ms detail-ready increase and extra streaming long tasks are retained in the results. Do not read the slightly faster entry median as a renderer optimization. Individual slow gestures occurred: feature local pan reached 46.9 FPS/p95 33.4 ms in one run, and baseline local pan reached 50.7 FPS in another. Uniform 60 FPS and zero startup stalls are not established. A preliminary comparison overlapped unit-test activity and is not used for this table.

## Large-city browser stress

These are hand-seeded stress fixtures, not construction layouts generated by buying 10,000 buildings through the shop. Terrain streaming can still be active during the pan. Resource and population ceilings/shortages are applied by the actual model; no placement exemption was added to gameplay.

Latest final worker/suspension-policy runs:

| Records | Full 1,000-year resume | Resume long tasks / max | Resume p95 interval | Local pan FPS / p95 |
| --- | ---: | --- | ---: | --- |
| 1,000 | 337 ms | 0 / — | 50.1 ms | 48.0 / 33.4 ms |
| 10,000 | 2,009 ms | 5 / 184 ms | 200.0 ms | 52.0 / 33.4 ms |

Other lightweight-status runs measured 10,000-record resume at 810 ms with zero >50 ms tasks and pan at 54.4 FPS. Thus observed resume spans roughly 0.81–2.01 seconds; the final slower result is not omitted. Snapshot serialization, worker transfer/commit, summary/UI work and software rendering still cause stalls. A worker removes the repeated simulation/save passes from the main thread; it does not guarantee a free final commit. Earlier test polling materialized full snapshots every animation frame; the final harness uses the cheap status API, and those intrusive preliminary figures are excluded.

Large-city readiness is improved substantially, but this is **not** a polished 10,000-building UI. Open statistics still lists every building; paging and spatial display indexing remain relevant C/E work. Long/nonrepeating future recipe graphs need new profiling. No cap is used to hide that workload: fallback cursors retain outstanding time and workers can be cancelled safely.

## Compatibility and exact files

The strategic grid remains 316×316 and local territories 32,768 units. `world_terrain.js`, `forest.js`, `forest_renderer.js`, `environment.js`, `hydrology.js`, `water_renderer.js`, `world_map.js`, `basic_world.js`, `buildings.js`, `building_styles.js`, roads, `auth.js` and `multiplayer.js` remain unchanged. Existing Basic/Regular separation, terrain geography, hydrology overlays, forest IDs/species/positions, rendering caches and placement representations remain intact. No economy, permission or ownership writes are sent to Supabase.

Changed runtime files: `economy_model.js`, `economy.js`, `economy_ui.js`, plus phase/cache metadata in `game.js`, `world_config.js`, `index.html`.

Added runtime file: `economy_worker.js`.

Updated tests: `tests/economy.test.cjs`, `tests/economy-browser.cjs`, `tests/economy-performance.cjs` (selectable baseline ref).

Added tests/benchmarks: `tests/industrial-offline.test.cjs`, `tests/industrial-browser.cjs`, `tests/industrial-benchmark.cjs`.

Added specifications/reports: `industrial/catalog.schema.json`, `industrial/RELEASE_PLAN.md`, `industrial/MIGRATION.md`, this report.

## Reproduction and artifacts

Run `node --test tests/*.test.cjs` and `node tests/industrial-benchmark.cjs /tmp/industrial-model`. The benchmark intentionally runs the old capped baseline too; its 10,000-record case can take several seconds. A static server on port 8001 is used here. With Playwright Core available:

```sh
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/economy-performance.cjs /workspace/industrial-phase-a/comparison
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/industrial-browser.cjs /workspace/industrial-phase-a/cities
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/economy-browser.cjs /workspace/industrial-phase-a/economy
MAP_GAME_TEST_URL=http://127.0.0.1:8001 NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/forest-browser.cjs /workspace/industrial-phase-a/forest
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/environment-browser.cjs /workspace/industrial-phase-a/environment
```

The economy/industrial scripts accept `MAP_GAME_TEST_URL` and `CHROMIUM_PATH`; performance also accepts `MAP_GAME_BASELINE_REF`. Chromium needs the existing approved isolated trust store; there are no TLS bypass flags or certificate files in the branch.

Raw data under `/workspace/industrial-phase-a`: `tests.log`, `fair-benchmark/industrial-benchmark.json`, `quiet-comparison/summary.json` and its per-run JSONs, `release-cities/industrial-browser.json`, `final-economy/economy-browser.json`, `verified-forest/forest-lod.json`, and `verified-environment/environment-browser.json`.

Actual screenshots: `release-cities/city-1000.png`, `release-cities/city-10000.png`, `final-economy/economy-shop.png`, `final-economy/economy-town.png`, `final-economy/economy-close.png`; terrain/forest screenshots remain under the corresponding verified directories. No certificates, private keys or trust-store files are committed.
