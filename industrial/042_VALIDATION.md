# 0.4.2 Industrial Expansion — Phase 1 validation

Base: `feature/modern-frontier` at
`bc8945d3deeb99d1074d341c1eccd11ad59a6d82`.
Feature: `feature/0.4.2-industrial-expansion`.
The unpushed 0.4.1 security commit `559b20d` is not an ancestor; its branch is
preserved. No Supabase, server/authentication, ownership or migration changes.
No merge into main and no deployment is performed.

## Content and architecture

[Audit, connected production graph, balancing and migration notes](042_PHASE1.md).
Six materials, eight factories and three research licenses are added to the
existing catalog/progression. Three optional cosmetic goals recognize those
specific licenses. The original seven-introductory-research goal still counts
only the original seven licenses, preventing premature completion.

Totals: **127 internal materials, 106 player-facing materials, 128 industrial
factories plus five starters, 10 research nodes and 16 advancement goals**.
The ten initial materials, all 21 excluded internal IDs and every original
catalog, recipe, price, unlock and advancement definition remain unchanged.

Sources and deterministic browser mirrors are updated together. Registry/schema
validation supports explicit extra research requirements; progression enforces
new era/licensing gates. Shop/inventory/research use existing adapters and display
dynamic totals. Worker imports and page cache tags match the new catalog.
The exact simulation engine `economy_model.js` is unchanged. Terrain, forests,
hydrology, cameras and Singleplayer storage formats remain unchanged.

## Automated and browser results

| Check | Result |
| --- | --- |
| Gameplay baseline deterministic suite | 101 passed |
| Final complete deterministic suite | **114 passed, 0 failed, 0 skipped** |
| New expansion coverage | 13 cases: unchanged old records, reachable/used materials, invalid recipes/numbers, licensing, exact online/offline accounting, shortages, bounded-reference agreement, 1,000-year catch-up/replay, worker parity, saved contracts/inventories/unknown fields, old advancement semantics |
| Existing C1 browser regression | Passed: organic introductory research, construction, original 100-material progression, priorities, saves and territory navigation |
| Existing Modern Frontier browser regression | Passed at 1366×768, 1440×900 and 1920×1080: shop, placement, advancement graph, private preferences, export/import/reload and writer recovery |
| New expansion browser regression | Passed: prepared legacy save, three actual paid research purchases, all eight actual canvas factory purchases, synthetic ten-minute offline reload and working production chains |
| Missing assets / JS console errors in successful browser runs | Empty error/failed-request/HTTP-failure arrays |
| Existing large-city solver benchmark | Passed all 18 scenarios (100/1,000/10,000 buildings, scarce inputs, power and population variants) and three automatic-priority cases with exact reference agreement |
| Live Babylon CDN loading | **Blocked: proxy CONNECT HTTP 403** |
| Deployed website / multiplayer tests | Not run; outside this Singleplayer branch's scope |

Browser qualification: tests used an **explicit** Babylon 9.32.0 npm-package
fallback because the original CDN is blocked. Official npm tarballs were checked
against registry SHA-512 integrity; browser-file hashes were checked against
those package contents. The npm engine bundle differs from the historical CDN
bundle, so the old cache helper correctly rejected it. No checksum expectation
was weakened, TLS verification disabled or application CDN URL replaced.
This is not proof of live-CDN or deployed-site startup. Third-party bundles and
local test preload files are not committed.

The shop benchmark's baseline route needed `route.fallback()` instead of
`continue()` for non-baseline requests so it could cooperate with the explicit
verified-library route. That test-only correction changes no game behavior.
Initial test-fixture/count assertions were corrected for the expanded content;
the final suite has no unresolved failures.

## Performance evidence

Existing solver benchmark, identical balanced/housed fixture shape, 1,000-year
offline target, two warm-ups and five measured samples per variant:

| Buildings | Baseline median ms (range) | Candidate median ms (range) |
| ---: | ---: | ---: |
| 100 | 1.09 (0.62–1.59) | 0.84 (0.55–1.73) |
| 1,000 | 5.07 (3.02–8.50) | 3.31 (2.82–6.29) |
| 10,000 | 72.34 (57.92–121.86) | 54.61 (49.97–103.38) |

No observed slowdown in these samples; the substantial shared-environment
variability prevents a claim of solver speed improvement. The solver was not
changed. These large-city cases use the existing foundation chains; expanded
recipe correctness/shortages and long catch-up are separately tested, rather
than claiming this measures 10,000 newly added advanced factories.

Matched browser shop benchmark against `bc8945d`: three runs × 50 open/filter/
close cycles, median of per-run medians **0.30 ms baseline / 0.30 ms candidate**.
Per-run p95 range: baseline 0.50–2.20 ms; candidate 0.70–0.90 ms. Both render
bounded ten-card pages.

Final prepared expansion city pan/zoom sample: **59.0 FPS**, p50 **16.7 ms**,
p95 **16.8 ms**, 120 frame intervals. Across that page lifecycle there were two
long tasks, maximum **287 ms**. This is a software-rendered Chromium test scene,
not a Lenovo/device-capacity claim; there is no matched baseline startup/long-
task sample. Existing startup/cold-render performance limitations remain open.

Local artifacts: `/workspace/industrial-042/`: `final-tests.log`,
`candidate-benchmark/`, `baseline-phase-c1-benchmark.json`, `performance-summary.json`,
`shop-comparison-final/`, `browser-c1/`, `browser-frontier-final/`, and
`browser-expansion-final/` (screenshots and results). These are local evidence,
not a release deployment.

## Compatibility and remaining limitations

- The baseline-save test executes the real archived baseline model and compares
  all original exact ledger values after operating an old steel factory. Pinned
  contracts, inventory, unknown fields, research, era and original save input
  are preserved. New absent materials start at zero; no schema-format migration
  or old-factory repricing occurs.
- New factories are Singleplayer progression content. Existing multiplayer
  spending guards, authentication and ownership are untouched. The 0.4.1 work
  must be integrated through a separate reviewed branch later.
- Existing reusable building visuals are used. New unique art, research effects
  beyond licensing, upgrades, warehouse-network limits and economy sale/trade
  systems are not implemented.
- Back up saves before switching builds. Older releases are not promised to
  understand newly completed research IDs. Live external startup and any actual
  deployment still need verification from an allowed environment.

Stop after Phase 1. No automatic next phase or merge into main.
