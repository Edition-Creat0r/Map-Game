# Resource interface, graphics audit and performance follow-up

Branch: `feature/0.4.1-graphics-prototype`. Previous `dba4aac` and its three
checkpoints were preserved. New checkpoints: `f4c51a5` (audit/tooling), `34283c2`
(resource presentation/planner), `cbc7a4a` (measured graphics optimization), plus
this final compatibility/evidence checkpoint. All commits are local. No push,
upload, merge, deployment, Supabase operation or multiplayer spending activation.

[Paired screenshots](evidence/index.html) · [Windows transfer/checklist](WINDOWS.md)
· [139-ID mapping review](mapping-review.json) · [Original graphics spec](../graphics-prototype/SPEC.md)

## Audit and asset blocker

The actual source contains three procedural buildings (smallHouse, steelMill,
officeLow), four-way junctions, five 128² PNG surfaces, three hysteretic LODs,
opt-in preferences, Basic fallback and bounded terrain ZIP tooling. Existing
screenshots and JSON support the prior report; fresh baseline tests passed
135 Node / 16 terrain-pack cases. No finished building GLB exists. Office Campus
is a visual entry, not a newly purchasable economy contract. Regular stays paused.
The committed five stock images also passed manifest checksums/PNG validation.

Actual unchanged catalog: **139 internal materials, 140 industrial definitions,
five starter contracts, 118 player-facing materials, 21 excluded IDs, 14 research
nodes**. The older 121-material count is not the current branch's registry.

**ModernResource_Free.zip is absent from available workspace files.** Actual pack
PNGs validated/imported: **0**. Its claimed 124 files, source, visual meanings and
commercial redistribution rights remain unverified. No pack artwork is included,
no icon_1…124 assignments were invented, and all 139 pack mappings explicitly
remain pending. Existing text tokens/names are retained. Attach the real ZIP and
authoritative source/license evidence before selection and public import.

The original `assets/resource-icons/credit.svg` is offered under CC0-1.0. It is
new vector artwork for the existing **Money** resource, not an imported PNG,
new currency/balance, pricing or trading system. The supplied pack's license is
not inferred from this asset's license.

## Working interface changes

- Shared icon output now supports reviewed same-origin artwork with escaped
  labels and existing token fallbacks. Invalid IDs, aliases, duplicate mappings,
  non-string fields, remote/traversal paths and unsupported SVGs are rejected.
  Only the original Money artwork is activated. Failed image decoding removes
  the image and reveals the token; there are no inline event handlers.
- Resource bar: 32 px icons (23 px on narrow screens). Unlocked inventory: 48 px;
  Easy Craft hero: 64 px. Shop costs, input/output displays and research costs
  reuse the same renderer. Existing quantities, progression and purchase rules
  are unchanged. No new settings store or decorative animation.
- Collapsible **Easy Craft** is a read-only factory planner using existing
  approved catalog recipes, available inventory, base rates, operating status,
  construction navigation and saved contract variants. Existing factories keep
  operating status even if research locks new construction. Production remains
  automatic; there is no manual crafting transaction or new recipe.
- Central World crafting explicitly says unavailable and has no spending path.
  Changing client presentation cannot create a transaction: no crafting write
  endpoint or resource mutation API was added.
- Closed planner reuses existing `mapgame:economy` event snapshots. It performs
  no recipe rendering and avoids subscribe()'s extra eager full-city clone.

## Resource ZIP audit safety

The new **read-only** Pillow-based audit never extracts/imports, creates public
assets or executes pack code. It expects exactly the declared 124 PNG paths and
an optional directory; checks filenames/case collisions, encryption/symlinks,
compression, CRC, static 64×64 images, transparency, decoding and SHA-256. Bounds:
256 KiB/file, 32 MiB archive/total, 100× ZIP ratio, independent 64 KiB PNG image
stream expansion limit. Fully invisible, wrong-format, animated, corrupted and
trailing-content images fail closed. Report filenames are whitelisted; private
local archive paths and arbitrary embedded text are not copied into reports.
Licensing always remains unapproved. Existing terrain-pack validation was not
relaxed. Test icons are synthetic temporary fixtures, never public substitute art.

## Graphics measurements

Exact `dba4aac` prototype.js versus current renderer, identical procedural art,
Babylon version, camera, lighting and 1440×1000 viewport. Three fresh pages per
variant, alternating order, 1.5 s warm-up, ≥120 measured frame intervals. Software
WebGL; no concurrent browser/solver workload during the matched comparisons.

| Matched 3D showroom | Before | After |
| --- | ---: | ---: |
| Median FPS | 14.06 | **15.23** |
| FPS range | 13.85–14.09 | 15.04–15.27 |
| Median p95 frame interval | 79.2 ms | **74.4 ms** |
| Ready time median | 1417 ms | 1584 ms |
| Active meshes / draw calls | 27 / 27 | 27 / 27 |
| Total meshes / vertices | 55 / 5876 | 55 / 5876 |
| Materials / texture wrappers / GPU internals | 21 / 23 / 7 | 21 / 23 / 7 |
| Median p95 during forced pan/zoom jumps | 158.7 ms | 149.9 ms |

Optimization: bilinear sampling within the nearest mip instead of trilinear
blending between mips. Original pixels, geometry, world data and anisotropy 1
remain. This can slightly change mip transitions; paired images are included.
Material freezing alone did not show benefit in a separate probe, so it was not
adopted. An earlier nearest-minification trial was superseded by the final
bilinear variant above. No economic work or saved records were removed.

Identical surface/name/dimensions now reuse one per-scene material and texture
wrapper; 10,000 repeated requests created **zero additional materials or texture wrappers**. Different
UV dimensions remain distinct. Disposal invalidates that entry; subsequent calls
recreate it. Camera motions preserved mesh/material counts, so LODs do not rebuild
models during navigation. Existing missing-texture fallback still passes.

Actual GPU allocation bytes/upload timing are not exposed by this software
runner. Estimated RGBA8+mips size from seven loaded internals is ~747 KiB in both
variants; that is a format-based estimate, not measured driver memory. There is
no demonstrated startup improvement in the final matched sample. Long tasks
remain: measured-frame maxima 87–140 ms before and 77–140 ms after; forced large
camera jumps still spike. Three-building software 3D is far from 60 FPS.
**Keep improved graphics off by default and Basic active.**

## Actual large-city and offline checks

Twelve fresh Basic Singleplayer pages: 100, 1,000 and 10,000 saved buildings, two
samples/variant/count, same fixed clock and scarce mixed industrial fixture.
Baseline overrides use exact committed dba4aac sources; library caches and all
other assets match. Every saved building remains; visible rendering still uses
the game's existing culling/LOD. This is not 10,000 simultaneously visible GLBs.

| Saved buildings | Before / after mean FPS | Before / after p95 | 1,000-year catch-up before / after |
| --- | ---: | ---: | --- |
| 100 | 60.00 / 59.51 | 16.7–16.8 / 16.8 ms | 272–281 / 226–280 ms |
| 1,000 | 60.00 / 60.00 | 16.7–16.8 / 16.7 ms | 447–461 / 406–408 ms |
| 10,000 | 60.00 / 60.00 | 16.7–16.8 / 16.7–16.8 ms | 754–845 / 714–750 ms |

Both variants have exactly equal BigInt ledgers after the **full 1,000 years**.
Fixtures use a positive 2027 start and an artificial 3027 clock; assertions verify
the original timestamp, final settled timestamp, saved count and unknown field.
An earlier invalid negative-timestamp trial was discarded: normalization replaced
its start time, so it did not prove offline catch-up. Only corrected results are
included here. Two samples do not establish a startup speedup. Startup long-task
maxima at 10,000 were 205–237 ms before and 207–223 ms after.

The unchanged solver also passed five existing benchmark programs. Current mixed
industrial 1,000-year median execution (2 warm-ups, 5 samples): stocked
3.75 / 23.11 / 86.05 ms; scarce 1.92 / 8.29 / 42.23 ms at 100 / 1,000 / 10,000.
The tests compare accelerated results with bounded reference simulation and
preserve 1.2× visible-online inputs/outputs. These solver timings are not GPU
frame measurements; economy/registry/progression source is unchanged from dba4aac.

## Test results and corrections

- **146 Node tests passed, 0 failed, 0 skipped** (baseline 135 + 11 icon/planner).
- **16 terrain-pack + 15 resource-audit Python tests passed**.
- Fifteen functional browser scenarios passed: resource interface, graphics SP,
  Modern Frontier, 0.4.2A industry, retained expansion, visual UI, restoration,
  C1, Phase B, starter economy, forests, environment, industrial starter and
  industrial Phase B fixtures, full graphics showroom. Screenshots include
  matched resources/inventory/shop/research and actual 3D before/after views.
- Two additional matched performance programs passed: six 3D showroom pages and
  twelve actual Basic city pages; exact ledger agreement, cache/disposal checks,
  pan/zoom, all LODs and coordinate/footprint preservation.
- Five solver benchmark scripts passed: industrial-042a, phase-c1, economy-rc,
  phase-b and industrial. Construction, shortages, reload, legacy contracts,
  unknown save fields, future locks and numerical safety remain covered.
- Initial broad run: 21/23 programs passed. Old visual UI assumed 7 research
  links; current graph has 21. Old Phase B assumed 4 remaining mining and 12
  refining rows; current catalog has 8 and 18. Assertions now require the actual
  complete edge count and exact expected catalog IDs. Fixed suites were rerun,
  including all legacy production/purchase/reload checks. Original failure logs
  and resolved results are retained; no runtime rules were changed to pass tests.
- Normal successful suites report no uncaught errors, failed requests or missing
  assets. Separate expected-negative tests verify corrupt-credit decoding and
  missing terrain texture fallback. No supplied-pack decode claim is possible.

Tests use real Chromium and Babylon with explicitly verified cached official npm
Babylon 9.32.0/loaders and HTTPS jsDelivr SDK SHA-256
`bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`.
Caches stay outside Git. Supabase project traffic is blocked in test preloads.
No TLS verification is disabled. This does not certify live CDN/deployment,
Windows execution, multiplayer enforcement or hardware GPU behavior.

## Compatibility / remaining gates

Economy model, ledger rules, canonical registry/recipes/manifests, research rules,
world generation, terrain, forests, saves, auth, ownership, multiplayer code and
all 14 protected RC files are unchanged. RC ref remains dcfb5dc. No new currency,
recipe, price, building definition, transaction, migration or setting is added.

Blocked: actual pack/rights/image review and PNG integration. Deferred: finished
GLBs, custom-pack activation, hardware/mobile profiling, large-city Regular 3D
and remaining software camera spikes. This is not an entire-game release gate
or approval. Next: review paired visuals, transfer the local review bundle with
WINDOWS.md, then attach the resource ZIP and source/license evidence. Do not
publish the pack or enable multiplayer spending based on these offline tests.

## Exact changed files

- `assets/resource-icons/credit.svg`
- `economy_ui.js`
- `graphics-prototype/SPEC.md`
- `graphics-prototype/prototype.js`
- `index.html`
- `industrial/progression-ui.js`
- `resource-icons/.gitignore`
- `resource-icons/README.md`
- `resource-icons/REPORT.md`
- `resource-icons/WINDOWS.md`
- `resource-icons/evidence/baseline-inventory.png`
- `resource-icons/evidence/baseline-research.png`
- `resource-icons/evidence/baseline-resources.png`
- `resource-icons/evidence/baseline-shop.png`
- `resource-icons/evidence/city-comparison.json`
- `resource-icons/evidence/current-inventory.png`
- `resource-icons/evidence/current-research.png`
- `resource-icons/evidence/current-resources.png`
- `resource-icons/evidence/current-shop.png`
- `resource-icons/evidence/easy-craft.png`
- `resource-icons/evidence/final-checks.json`
- `resource-icons/evidence/graphics-after-overview.png`
- `resource-icons/evidence/graphics-after-smallHouse.png`
- `resource-icons/evidence/graphics-after-surfaces.png`
- `resource-icons/evidence/graphics-before-overview.png`
- `resource-icons/evidence/graphics-before-smallHouse.png`
- `resource-icons/evidence/graphics-before-surfaces.png`
- `resource-icons/evidence/graphics-comparison.json`
- `resource-icons/evidence/index.html`
- `resource-icons/evidence/initial-checks.json`
- `resource-icons/evidence/interface.json`
- `resource-icons/evidence/phase-b-resolved.json`
- `resource-icons/evidence/runtime-sha256.json`
- `resource-icons/evidence/solver.json`
- `resource-icons/icons.js`
- `resource-icons/mapping-review.json`
- `resource-icons/recipe-sidebar.js`
- `resource-icons/tools/audit_zip.py`
- `resource-icons/tools/test_audit_zip.py`
- `tests/graphics-city-comparison.cjs`
- `tests/graphics-update-performance.cjs`
- `tests/phase-b-browser.cjs`
- `tests/resource-icons-browser.cjs`
- `tests/resource-icons.test.cjs`
- `tests/visual-ui-browser.cjs`
- `visual.css`
- `visual_ui.js`
