# 0.3.4 — Phase B release gate

Phase B continues on `feature/0.3.4-industrial-revolution` from Phase A commit **3069890**. Phase A's **55 existing tests passed before implementation**. **Phases C–F have not begun; no automatic merge.**

## Delivered catalog and gameplay

The runtime now has **120 industrial definitions across all ten contracted sectors**, **121 unique material IDs**, 120 versioned fixed recipes, and 60 technology-reference nodes. All entries carry purchase/operating costs, footprint, renderer reference, recipe, era/prerequisites, storage/logistics metadata, style and future-upgrade metadata.

**56 industrial entries are playable, 54 future-locked, and 10 defense definitions only.** The five starter contracts remain playable separately. Exact IDs are in [AVAILABILITY.md](AVAILABILITY.md). Foundational era 1–2 technologies are licensed by this release policy; there is no research/unlock mechanism pretending to be implemented. API purchases and simulation both reject/inactivate locked entries. Defense definitions produce no equipment or combat effects.

The catalog is connected to the actual Singleplayer economy, placement and paged shop. Registered inputs are consumed from stock; registered outputs accumulate in exact inventories. New manufactured materials also appear in construction costs. Search and sector/status filters expose the full catalog, including disabled future content. Money, Steel and Carbon remain the prominent statistics; other stocks have an expandable inventory. Operation statuses identify missing materials and quantities. All building statuses remain accessible through pagination.

The existing model catalog is reused: warehouse, steel-mill and carbon-plant procedural components. Basic mode still draws lightweight footprints and labels, without mounting a new 3D shop engine. The only Basic drawing change is a cached definition lookup; terrain/forest calculation loops do not perform economy work.

## Data, graph and balance deliverables

- [catalog.json](catalog.json): canonical 120-building/121-material data. `build-data.cjs` regenerates `catalog-data.js`, the synchronous browser/worker mirror.
- [catalog.schema.json](catalog.schema.json): JSON Schema contract. Draft 2020-12 validation passes; runtime semantic validation also passes.
- `registry.js`: IDs, aliases, amounts, technology DAG, model references, sector quotas, output classes, availability/reachability, and acyclic material recipes. Integration checks against real existing model/building IDs before registering any entries.
- [balance.csv](balance.csv): complete purchase, operating, input/output, technology, recipe/version, model, style/upgrade summary table.
- [dependency-graph.json](dependency-graph.json) and [PRODUCTION_GRAPH.md](PRODUCTION_GRAPH.md): full material/recipe graph, including inactive definitions.
- [catalog-reference.html](catalog-reference.html): interactive read-only catalog and upstream recipe explorer. It never reads/writes a game save.
- [PHASE_B_CATALOG.md](PHASE_B_CATALOG.md): sector totals, actual supported manufacturing chains, balance examples and limitations.

The validator rejects undefined materials, duplicate IDs/aliases, invalid/non-finite/negative/over-precision amounts, missing model/technology references, material/technology cycles, industrial money minting and no-input non-extraction recipes. Paid extraction requires workers, electricity and upkeep. All recipe cycles are currently rejected; no recycling loop is implicitly allowed. Playable recipe/construction requirements have reachable playable suppliers.

## Working manufacturing and migration

The browser bought and placed mines, iron smelting, carbon processing and steel manufacturing through the real shop/canvas. It observed a shortage (`Iron`, required 2.4 / available 2 for the online tick), then added a second mine/smelter pair and a home. Steel increased from 114 to approximately 226 after further production, and the foundry resumed full operation. The balanced 12-building example uses 26 workers and 36/40 power, produces 6 Steel/min offline or 7.2 online, and earns net $130/$166 per minute with one commercial store, once fully staffed and buffered. See the catalog guide for the full bill of materials.

A separate browser loaded a schema-2, pre-catalog steel factory with zero Iron/Carbon. It retained its original input-free starter contract: **360 Steel over one offline hour**, with money **200,000 → 198,860** from the original upkeep. IDs, variant and custom fields survived. The five starter definitions are deliberately unchanged, including their feedstock abstraction, so existing economics are not silently replaced by the new catalog.

Economy schema **3** adds material-registry version **1**, non-core `inventory` stocks and pinned production contracts. Core aliases/balances stay at the old root keys; duplicate alias costs are combined before debit. Rule snapshots preserve old factories and separate later recipe versions. Unknown root/economy/inventory/precision/building fields remain. Unknown pre-catalog types colliding with a new industrial ID are retained inactive. Future economy/registry versions fail closed rather than being downgraded. Full details: [PHASE_B_MIGRATION.md](PHASE_B_MIGRATION.md).

The Phase A BigInt scale, partial ticks, upfront reserves, no same-tick output spending, exact cycle acceleration, uncapped positive elapsed time, worker/fallback checkpoint discipline, writer lease and cancellation/replay protection remain. Online throughput increases **both inputs and outputs by 1.2×**. Energy/workers/capacity/growth/upkeep are unboosted. The inherited 10^12 amount ceiling remains; output above that ceiling is clamped under the existing rule, not a new warehouse or time cap. Conservation tests operate below that ceiling and compare exact ledger strings.

## Automated validation

**70 Node tests pass**, including all 55 Phase A tests. New cases cover:

- Generated browser data equals canonical JSON; exact sector/status counts, real model references and all prior starter entries.
- Invalid amounts/IDs/aliases/references; material and technology cycles; no-input non-extraction and currency minting rejection.
- Alias cost aggregation without negative balances or double-counting.
- Real mine/refinery/foundry conservation, online input/output scaling, missing-material details, power/workforce constraints and startup latency.
- Exact accelerated versus bounded one-tick reference execution, scarce inputs, population changes, varied callback partitions and reloads.
- Century catch-up without losing checkpoints; version-2 migration, pinned old/new recipe versions and unknown fields.
- Future registry/schema refusal, inactive locked/definition-only rows, material-order independence and atomic collision rejection.

Browser gates pass industrial purchasing, input starvation/recovery, shop pagination/search/locks, inventory persistence, grandfathered factories, the interactive graph, competing tabs, cancellation/rotation, Singleplayer entry/return, terrain, waterways, forest LOD/cache behavior and queued strategic streaming. Forest checks retain 120 sampled roots and zero idle candidate builds. No new console errors, HTTP failures or failed requests remain in final checked reports. A favicon 404 on the new reference page was found during development and fixed with an inline icon.

No authenticated multiplayer economy was tested or introduced. Supabase/auth/ownership code is unchanged. Existing approved Chromium trust is used with TLS verification enabled.

## Model and offline benchmarks

Single Node runs, both kernels loaded into the same JavaScript realm. Normalization/registry load and browser persistence are excluded. JIT/host variation is visible; these numbers are not medians or a claim of universal speedup. All cases account for **1,000 full years** (3,155,760,000 logical ten-second ticks). The starter compatibility control asserts identical old/core exact balances against Phase A.

| Total records | Phase A starter (ms) | Phase B same starter (ms) | B balanced chain + growth (ms / evaluations) | B wide scarce inputs + growth | B partial power shortage + growth |
| --- | ---: | ---: | --- | --- | --- |
| 100 | 5.90 | 10.17 | 18.16 / 52 | 12.52 / 73 | 3.92 / 48 |
| 1,000 | 7.81 | 3.81 | 21.63 / 54 | 137.23 / 109 | 128.15 / 45 |
| 10,000 | 363.49 | 68.14 | 320.51 / 63 | 348.06 / 92 | 175.19 / 54 |

The wide workload includes the playable multi-sector catalog with scarce stock/workforce; the power case supplies only part of requested electricity. Funding/inputs can halt factories before the end, as required. Fully housed counterparts are retained in the raw JSON. Work scales with operating boundaries/cycles rather than elapsed ticks. Sparse material slots avoid a 121-material array traversal for every building/tick. Future recipe revisions still need differential and long-horizon profiling; this does not prove constant-time execution for arbitrary production programs.

## Matched browser comparison

Three interleaved runs against exact Phase A HTML/JS/CSS and Phase B, Chromium 154, 1440×1000, headless software WebGL. Shop closed and an empty starter save. Medians:

| Measurement | Phase A | Phase B |
| --- | ---: | ---: |
| Engine ready | 1,931 ms | 1,542 ms |
| Territory entry | 789 ms | 776 ms |
| World Map pan FPS / p95 | 59.6 / 16.7 ms | 60.0 / 16.7 ms |
| Local pan FPS / p95 | 60.0 / 16.7 ms | 60.0 / 16.8 ms |
| Zoom FPS / p95 | 60.0 / 16.8 ms | 60.0 / 16.7 ms |
| Detailed pan FPS / p95 | 60.0 / 16.7 ms | 60.0 / 16.8 ms |
| At least 12 detail chunks, including wheel input | 2,534 ms | 2,533 ms |
| Long tasks (>50 ms), each run | 2, 2, 2 | 2, 2, 2 |
| Maximum long task, each run | 203, 166, 189 ms | 166, 194, 201 ms |

Startup includes external-script/network scheduling; the faster measured median is not attributed to adding the catalog. Streaming/startup long tasks remain. These are software-rendered observations, not a production GPU guarantee.

### Real industrial worker-city stress

Actual browser worker resumes use mines/refineries/foundries, not only the old starters. Fixtures are pre-seeded performance layouts rather than thousands of manual shop actions. They test migration markers, exact inventory persistence, engine selection, clock notices and reload as well as performance.

| Records | Full 1,000-year resume | Resume long tasks / max | Resume p95 | Subsequent local pan FPS / p95 |
| --- | ---: | --- | ---: | --- |
| 1,000 | 344 ms | 1 / 51 ms | 66.7 ms | 57.2 / 16.8 ms |
| 10,000 | 1,262 ms | 4 / 118 ms | 66.6 ms | 50.3 / 33.4 ms |

After catch-up, Iron Ore/Coal stocks are positive and Steel production is verified; locked definitions are not used to fake throughput. Serialization, worker transfer/commit, summaries and dense drawing still cost main-thread time. This is not a claim of 60 FPS for 10,000 factories. No time cap hides slow work. Statistics and shop are paginated, but a full spatial building index remains future rendering work.

## Compatibility, scope and changed files

The 316×316 world, local 32,768-unit maps, saves, forest IDs/species/positions, terrain sampling, hydrology overlays and camera behavior remain. Terrain/biome/forest/water/strategic-map/auth/ownership/roads source is unchanged. Building rendering only gains validated industrial model aliases; Basic uses a cached catalog lookup. No 3D preview engine is added to Basic.

Runtime changes: `economy_model.js`, `economy.js`, `economy_worker.js`, `economy_ui.js`, `basic_world.js`, `buildings.js`, `styles.css`; cache/phase metadata in `index.html`, `game.js`, `world_config.js`. Added runtime data/registry/adapter: `industrial/catalog.json`, `industrial/catalog-data.js`, `industrial/registry.js`, `industrial/integration.js`.

Tests: added `tests/industrial-catalog.test.cjs`, `tests/phase-b-browser.cjs`, `tests/phase-b-benchmark.cjs`; updated the inherited `tests/industrial-browser.cjs` to support an industrial fixture and current schema, and `tests/industrial-offline.test.cjs` for the new schema version.

Specifications/review artifacts: updated `industrial/catalog.schema.json`, `industrial/RELEASE_PLAN.md`; added `industrial/build-data.cjs`, `industrial/export-catalog.cjs`, `industrial/AVAILABILITY.md`, `industrial/balance.csv`, `industrial/dependency-graph.json`, `industrial/PRODUCTION_GRAPH.md`, `industrial/catalog-reference.html`, `industrial/PHASE_B_CATALOG.md`, `industrial/PHASE_B_MIGRATION.md` and this report.

**Unimplemented:** warehouse networks/capacities, logistics limits, services, research/era progression, new upgrades/specialization effects, style selection/industrial districts, markets, deposits/depletion, equipment consumers and combat. Styles, levels, storage classes and logistics are metadata only. Most late/final goods have no current consumer beyond their declared recipe graph; consumer goods are stored, not sold by a new market. Local save/date edits remain unverifiable. Persistence and transactions are Singleplayer-only, with no client-authoritative multiplayer resource writes. Phases C–F remain untouched.

## Reproduce and inspect

```sh
node industrial/build-data.cjs
node industrial/export-catalog.cjs
node --test tests/*.test.cjs
node tests/phase-b-benchmark.cjs /tmp/phase-b-model
MAP_GAME_BASELINE_REF=3069890 NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/economy-performance.cjs /tmp/phase-b-comparison
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/phase-b-browser.cjs /tmp/phase-b-browser
INDUSTRIAL_FIXTURE=phase_b NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/industrial-browser.cjs /tmp/phase-b-cities
```

Serve the repository on port 8001 or set `MAP_GAME_TEST_URL`; browser scripts support `CHROMIUM_PATH` where applicable. Existing starter, forest and terrain browser suites also ran. The reference page is at `industrial/catalog-reference.html` on the same static server.

Raw artifacts are in `/workspace/industrial-phase-b`: `all-tests.log`, `final-model-benchmark/phase-b-benchmark.json`, `comparison/summary.json` and individual runs, `industrial-cities/industrial-browser.json`, `final-starter/economy-browser.json`, `forest/forest-lod.json`, `environment/environment-browser.json`, and `release-browser/phase-b-browser.json`.

Actual screenshots under `release-browser`: `mining-catalog.png`, `steel-recipe.png`, `future-locked.png`, `defense-definitions.png`, `working-factories.png`, `industrial-inventory.png`, `catalog-reference.png`. No certificates, private keys or trust-store data are committed.
