# 0.4.2A validation — retain and extend

Parent: `d62525eedbd66c829880376c2c3e9fc8c5599ab2`; branch `feature/0.4.2-industrial-expansion`.
No reset/revert or loss of the previous expansion. No main merge, hosted database,
server/authentication/ownership changes or deployment.

**Verified: 139 internal materials, 140 industrial definitions, 5 unchanged starters,
118 player-facing materials, 21 unchanged exclusions and 14 distinct research nodes.**

[Actual recipes, consumers, research and migration](042A_DESIGN.md).
[Minigame Studio requirements](MINIGAME_STUDIO_REQUIREMENTS.md) are planning only.

## Tests

| Check | Actual result |
| --- | --- |
| d62525e baseline suite | 114 passed |
| Final complete numerical/game suite | **129 passed, 0 failed, 0 skipped** |
| New cases | 15: retained definitions; immutable manifest composition; acquisition/research/construction bootstrap; invalid references/amounts/cycles; exact research prices and replay; shortages; 1.2× input/output conservation; mixed bounded-reference parity; 1,000-year reload/replay; archived-save/upgrade metadata migration; future-version rejection; original input detachment; purchases/overlap/storage rollback; worker parity |
| Original C1 browser suite | Passed: organic introductory research, original 100-material progression, construction, save/reload, World Map navigation |
| Retained expansion browser suite | Passed: all eight prior factories, existing licenses, offline production and reload |
| Modern Frontier browser suite | Passed at 1366×768, 1440×900 and 1920×1080: shop, research/advancements, backups, preferences, placement and navigation |
| New 0.4.2A browser suite | Passed: actual archived-format save, no re-purchase of Metallurgy, twelve canvas purchases, four material-funded research purchases from produced stocks, capstone consumption, all 118 materials and repeated reload |
| Console errors / missing assets in final four suites | Empty errors, failed-request and HTTP-failure arrays |
| Existing solver benchmark | 18 city scenarios and three operating-priority cases passed exact-ledger reference checks |
| Mixed expansion benchmark | Six 100/1,000/10,000-record stocked/scarce cases passed bounded reference and uncapped 1,000-year runs |
| Paired archived/candidate benchmark | Three city sizes; alternating order, three warm-ups, nine measured samples; exact original-ledger agreement and zero absent new stock |

The initial full-chain browser fixture correctly blocked Optical Engineering because
it had too few workers for thermal-component production. It now provides twelve
homes/240 residents, yielding 144 workers under the unchanged 60% workforce rule.
No workforce, price, input, time horizon or power constraint was bypassed. Shortage
rejections remain explicitly tested. No correctness/security failures remain in
the tested Singleplayer scope.

Browser qualification: a fresh live Babylon HEAD request still fails with proxy
**CONNECT HTTP 403**. Tests explicitly substitute Babylon 9.32.0 npm bundles whose
package integrity was verified against official registry SHA-512 metadata and
whose file hashes are checked at launch. No TLS bypass, application URL change,
third-party bundle, credential or real save is committed. These results are not
live-CDN or deployed-site validation.

## Paired performance versus d62525e

Identical saved city and 1,000-year target; actual archived model/progression/data
modules versus the candidate. Three warm-ups and nine samples, alternating order.
No work/constraints omitted. Original exact ledger results match on every pair;
new absent material slots remain zero. Times exclude fixture preparation.

| Records | Baseline median ms (range) | Candidate median ms (range) |
| ---: | ---: | ---: |
| 100 | 0.68 (0.52–1.34) | 0.59 (0.44–1.45) |
| 1,000 | 3.92 (2.92–11.04) | 3.51 (2.31–6.07) |
| 10,000 | 53.38 (47.53–90.29) | 52.11 (48.26–57.90) |

No consistent speedup or slowdown is established within the observed variability.
The numerical model source is unchanged. Separate unpaired classic runs measured
74.73 → 79.92 ms at 10,000 records with broad overlapping ranges; the alternating
experiment above addresses run-order/JIT/GC confounding rather than claiming
those independent medians prove a regression or improvement.

## All-twenty-factory workload

Eight retained and twelve new factories, twelve homes/eight power plants per
40-record pattern. Purchased flags and all 14 licenses are explicit fixtures;
actual inputs, upkeep, workers and power remain enforced. Two warm-ups/five samples,
1,000-year elapsed target; ten-minute bounded references match exactly.

| Records | Stocked median ms (range) | Scarce median ms (range) |
| ---: | ---: | ---: |
| 100 | 3.29 (2.76–3.87) | 2.12 (1.92–2.38) |
| 1,000 | 27.88 (25.90–34.19) | 7.80 (6.81–13.67) |
| 10,000 | 91.48 (83.61–126.36) | 54.45 (43.83–86.66) |

Final software-rendered Chromium city pan/zoom: **59.0 FPS**, p50 **16.7 ms**, p95 **16.7 ms**, 120 intervals. Final page lifecycle: 3 long tasks, maximum **150 ms**. This is not a Lenovo-capacity or matched cold-start comparison; existing cold-render performance limitations are not declared solved.

## Compatibility and limits

The original 100-material source is byte-identical to Modern Frontier; the six
retained entries and twelve new entries are ordered extensions. Manifest marker 1
saves (100 or 106 materials) upgrade to marker 2 without recharging research,
changing old exact balances/contracts, resetting progress or dropping unknown
fields. Saved levels/styles/specialization metadata and priorities are retained.
Absent new stock is zero. Unsupported future versions fail closed. Initialization
detaches progression JSON so later research cannot mutate the caller's old save.

No new upgrade effects, warehouse networks, material-sale market, geology/biomass
simulation or multiplayer authority is claimed. Frames/cable have implemented
finite capstone research demand; Telecommunications records completion rather
than providing a hidden output bonus/network simulator. Bio-resin is the documented
existing-input gas-fermentation abstraction.

The Studio document covers real multi-file projects/assets, isolated responsive
and fullscreen play, accurate source diagnostics, AI Debug Reports, reviewed
patches/restore points, safe publication/discovery/donations and optional
sarcastic/secret/high-difficulty advancements. **No Studio implementation or
reward integration was added.** Existing minigame rewards remain disabled.

## Evidence and reproduction

```sh
node industrial/build-data.cjs
node industrial/build-progression.cjs
node industrial/export-catalog.cjs
node --test tests/*.test.cjs
node tests/phase-c1-benchmark.cjs /tmp/042a-classic
node tests/industrial-042a-benchmark.cjs /tmp/042a-mixed
# Playwright + Chromium + local server + available external libraries required:
node tests/industrial-042a-browser.cjs /tmp/042a-browser
```

Tests loading archived models require full Git history. Local evidence:
`/workspace/industrial-042a/results/`: `final-tests.log`, `baseline-performance/`,
`candidate-performance/`, `mixed-paired-performance/`, and `final-browsers/`
(four suites, screenshots and results). Test preload/libraries stay outside Git.
No hosted deployment or Windows execution was performed.

## Files changed

- `economy.js`
- `economy_worker.js`
- `index.html`
- `industrial/042A_DESIGN.md`
- `industrial/042A_VALIDATION.md`
- `industrial/042_PHASE1.md`
- `industrial/042_VALIDATION.md`
- `industrial/AVAILABILITY.md`
- `industrial/MINIGAME_STUDIO_REQUIREMENTS.md`
- `industrial/PRODUCTION_GRAPH.md`
- `industrial/balance.csv`
- `industrial/build-progression.cjs`
- `industrial/catalog-data.js`
- `industrial/catalog-reference.html`
- `industrial/catalog.json`
- `industrial/catalog.schema.json`
- `industrial/dependency-graph.json`
- `industrial/export-catalog.cjs`
- `industrial/player-materials-042-data.js`
- `industrial/player-materials-042.json`
- `industrial/player-materials-042a-data.js`
- `industrial/player-materials-042a.json`
- `industrial/player-materials-data.js`
- `industrial/player-materials.json`
- `industrial/progression-ui.js`
- `industrial/progression.js`
- `industrial/registry.js`
- `industrial/research-data.js`
- `industrial/research.json`
- `modern-frontier/updates.json`
- `tests/helpers/industrial-042a.cjs`
- `tests/industrial-042a-benchmark.cjs`
- `tests/industrial-042a-browser.cjs`
- `tests/industrial-042a.test.cjs`
- `tests/industrial-catalog.test.cjs`
- `tests/industrial-expansion-browser.cjs`
- `tests/industrial-expansion.test.cjs`
- `tests/progression.test.cjs`

Protected numerical engine, terrain/forest, authentication, ownership and server/migration sources remain unchanged. No main merge or automatic next phase.
