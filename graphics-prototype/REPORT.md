# Graphics prototype validation and handoff

Branch: `feature/0.4.1-graphics-prototype`; base `0a2e157`. Local checkpoint 1: `fbf9728` (spec, original tiles, bounded ZIP workflow); checkpoint 2: `fca33ac` (renderer, showroom, existing settings integration). This report/evidence/tests form checkpoint 3. No push, upload, deployment or main merge was performed. The multiplayer RC ref remains `dcfb5dc` and its files were not touched.

[Catalog mapping, GLB contract, pack format and safety limits](SPEC.md) · [Actual paired screenshots](evidence/index.html) · [Interactive showroom](index.html)

## What works

- Three render-only replacements: smallHouse, steelMill, officeLow. Office Campus already exists as a visual catalog entry; it is not a new economic contract or purchasable starter. Footprints, data coordinates, rotations, ownership metadata and recipes remain unchanged.
- Three prebuilt LODs, material merging and per-scene texture/material reuse. Hysteresis and 100 ms checks keep coordinates stable. Disposal removes roots from the LOD registry. Basic and preference-off calls retain the original renderer.
- A road2 four-arm near-orthogonal, same-level visual delegates from the existing junction renderer. Unsupported/skewed/graded junctions retain the old visual. Width 14 m; patch/marking heights match existing road-tool surfaces. No graph/serialization/access/elevation rules change.
- Five original 128² tiles: grass, dirt, gravel, asphalt and concrete. Only prototype grounds, swatches, foundations and junctions use them. No terrain/biome/forest generation or Basic texture path is changed.
- The existing Modern Frontier preference key gains graphicsPrototype=false by default. The existing Settings → Gameplay & graphics section contains the checkbox and showroom link. Unknown preference fields survive reload. Regular gameplay remains paused; existing meshes are not rebuilt when the preference changes.
- ZIP v1 validates/builds exactly one manifest and five PNGs, with only whitelisted built-in procedural model references. Import/build is local-only and never executes pack scripts or performs unrestricted extraction. Invalid/missing textures use neutral materials, including cloned showroom surfaces.

## Actual tests

| Test | Result |
| --- | --- |
| Baseline deterministic suite | 129 passed |
| Final deterministic/game suite | **135 passed, 0 failed, 0 skipped** |
| ZIP/PNG/manifest adversarial Python tests | **16 passed** |
| Matched 3D showroom browser suite | Passed: six fresh pages, three samples per variant; all three LODs; repeated zoom; stable positions; footprint bounds; opt-in wrapper; disposal; intentionally missing-texture fallback |
| Singleplayer/settings browser | Passed: local entry, setting persistence, unchanged stopped balances, retained unknown preferences, reload, pan/zoom and World Map return; zero prototype texture requests in Basic |
| Existing Modern Frontier browser suite | Passed at 1366, 1440 and 1920 widths: construction, research, preferences, backups/import/restore, achievements, navigation and persistence |
| Existing 0.4.2A industrial browser suite | Passed: archived saves, all twelve purchases, resource-funded research, capstone, prior recipes/unknown fields and reload |
| Actual Basic matched-source performance | Passed four alternating fresh contexts; same territory, camera, seed and assets; zero prototype material requests |
| Normal-loading console/errors/missing resources | Empty error/request-failure/HTTP-failure arrays across final suites |
| Intentional texture failure | grass.png 404 injected in a separate negative test; reported and neutral ground fallback verified |

Browser libraries were explicitly substituted in tests only: verified official npm Babylon 9.32.0 (cached provenance/file SHA checks) and a HTTPS-downloaded copy of the existing jsDelivr Supabase SDK, SHA256 bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af. Libraries stay outside Git. Supabase project requests were blocked; no auth/network writes or uploads were attempted. These are real Chromium/Babylon renders, not mocked meshes, but they do not certify live CDN startup, deployed authentication, Windows execution or hardware GPU capacity.

Initial iterations caught a missing main-page script include, an overly slow frame-count LOD cadence, and a test trying to click a hidden advanced-menu button. These were corrected before final passing runs. Generated Python bytecode was removed from the final tree and ignored.

## Matched performance

3D: alternating order, three fresh contexts per variant, 1440×1000, same camera/lighting/catalog coordinates, 1.5 s warm-up and at least 120 measured intervals. No other browser workload ran during the final comparison. Baseline buildings call the real original renderer. Baseline ground is flat; prototype ground adds textures, so the full visual-change cost is included. The crossing control is two legacy-sized road strips, not the private original junction-builder function.

| 3D showroom | Baseline | Prototype |
| --- | ---: | ---: |
| Median ready time | 2463 ms | 1471 ms |
| Median FPS | 15.04 | 13.66 |
| FPS sample range | 14.90–15.24 | 12.78–13.74 |
| Median p95 interval | 75.4 ms | 81.7 ms |
| Active meshes | 64 | 27 |
| Materials | 41 | 21 |

The software-rendered 3D scene is not 60 FPS: measured frames produce about 120–121 >50 ms tasks per sample in both variants. Startup/warm-up maximum tasks were 251–323 ms baseline and 212–227 ms prototype. Prototype has fewer active meshes and faster ready time, but its textured ground costs roughly 9% median FPS in this environment. A separate diagnostic measured 11.80 FPS full, 14.52 with only the ground texture disabled, and 12.26 replacing building PBR with StandardMaterials: texture sampling was the larger cost. Trilinear filtering was retained; anisotropy was limited to 1. No texture was removed just to improve the final result.

Basic: exact committed 0a2e157 HTML/UI/road-tool responses versus current source, same libraries and fresh contexts, alternating order, two samples each. Camera (16384,16384), zoom .32, territory T_190_27, seed 734221.

| Actual Basic game | Baseline | Prototype branch |
| --- | ---: | ---: |
| FPS | 60.00 | 60.00 |
| p95 interval | 16.8 ms | 16.7–16.8 ms |
| Ready time range | 1262–1360 ms | 1275–1296 ms |
| Territory entry range | 1006–1265 ms | 1027–1251 ms |
| Startup long tasks | 2–3; max 183–185 ms | 2–3; max 173–220 ms |
| Prototype texture requests | 0 | 0 |

Two Basic samples do not establish a startup speedup/regression; ranges overlap. They show no frame-rate regression in this check. Full measurements and camera coordinates are in evidence/showroom-results.json and evidence/basic-performance.json.

## Remaining limitations / next steps

- These are low-detail procedural shapes, not finished GLB assets, production art or photorealism. One prototype style per mapped ID; saved style selections survive and the original renderer remains available. No architectural-style catalog expansion.
- GLB dimensions/pivots/PBR/LOD budgets are specified, but v1 deliberately rejects GLB payloads. A reviewed embedded-resource GLB loader and pack v2, custom-pack activation UI and production model instancing are future work. No placeholder is named or advertised as a completed GLB.
- Texture variation is original tiled noise, not scanned PBR terrain; no normal/height maps are supplied. Terrain swatches do not replace world generation. Dynamic shadows, weather, interiors, traffic signals, road simulation and economy changes are not included.
- This is a three-building prototype. Large-city 3D memory/streaming, mobile GPUs and live Regular-world performance have not been certified. Keep Basic active and the prototype opt-in until finished assets/performance are reviewed.
- Only one preexisting GLB was found (a sedan), with no applicable building/license catalog. No third-party model/texture was repackaged; old baseline assets retain their existing terms.
- No automatic uploads, branch push, deployment or main merge. Next: review the showroom/art direction; then authorize any publication and a separate GLB v2 integration scope.

## Reproduce locally

```sh
python -m http.server 8017 --bind 127.0.0.1
# Open http://127.0.0.1:8017/graphics-prototype/index.html
node --test tests/*.test.cjs
python graphics-prototype/tools/test_pack.py
node tests/graphics-prototype-browser.cjs /tmp/graphics-browser
node tests/graphics-prototype-sp-browser.cjs /tmp/graphics-sp
node tests/graphics-main-performance.cjs /tmp/graphics-main
```

Browser scripts require Playwright-core, Chromium, accessible external libraries or an explicitly supplied verified test preload; no dependency download is performed by the tests. This environment used NODE_OPTIONS preload files outside Git. Full Git history is required for archived baseline/migration tests. Pack generation/build commands are in SPEC.md.

## Files changed

- `graphics-prototype/.gitignore`
- `graphics-prototype/REPORT.md`
- `graphics-prototype/SPEC.md`
- `graphics-prototype/assets/stock/manifest.json`
- `graphics-prototype/assets/stock/textures/asphalt.png`
- `graphics-prototype/assets/stock/textures/concrete.png`
- `graphics-prototype/assets/stock/textures/dirt.png`
- `graphics-prototype/assets/stock/textures/grass.png`
- `graphics-prototype/assets/stock/textures/gravel.png`
- `graphics-prototype/evidence/baseline-intersection.png`
- `graphics-prototype/evidence/baseline-officeLow.png`
- `graphics-prototype/evidence/baseline-overview.png`
- `graphics-prototype/evidence/baseline-smallHouse.png`
- `graphics-prototype/evidence/baseline-steelMill.png`
- `graphics-prototype/evidence/baseline-surfaces.png`
- `graphics-prototype/evidence/basic-performance.json`
- `graphics-prototype/evidence/index.html`
- `graphics-prototype/evidence/prototype-intersection.png`
- `graphics-prototype/evidence/prototype-officeLow.png`
- `graphics-prototype/evidence/prototype-overview.png`
- `graphics-prototype/evidence/prototype-smallHouse.png`
- `graphics-prototype/evidence/prototype-steelMill.png`
- `graphics-prototype/evidence/prototype-surfaces.png`
- `graphics-prototype/evidence/settings.png`
- `graphics-prototype/evidence/showroom-results.json`
- `graphics-prototype/evidence/singleplayer-results.json`
- `graphics-prototype/index.html`
- `graphics-prototype/prototype.js`
- `graphics-prototype/showroom.css`
- `graphics-prototype/showroom.js`
- `graphics-prototype/tools/create_pack.py`
- `graphics-prototype/tools/pack.py`
- `graphics-prototype/tools/test_pack.py`
- `index.html`
- `modern-frontier/ui.js`
- `road_tool.js`
- `tests/graphics-main-performance.cjs`
- `tests/graphics-prototype-browser.cjs`
- `tests/graphics-prototype-sp-browser.cjs`
- `tests/graphics-prototype.test.cjs`
