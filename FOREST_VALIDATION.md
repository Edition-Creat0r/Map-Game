# 0.3.3B forest and tree engine

Branch: `feature/0.3.3b-forests`, based on `feature/0.3.3a-biomes` (2a1f104). No automatic merge, economy changes, new hydrology, ownership changes or save migration.

## Architecture and affected files

- `forest.js`: pure, deterministic global vegetation model. A fixed 72 m candidate grid supplies one jittered root per cell. IDs are global cell indices, not visual chunk IDs. Two cheap, coherent hash fields create 1.5 km stands and 420 m clearings; isolated trees remain outside dense interiors. Biome blend weights control cover, species probabilities and sizes. Water, slope, temperature and a climate-scaled normalized treeline suppress unsuitable roots. Zero-weight families cannot be selected even by a zero-valued hash.
- Public API: `mapGameForest.treeAt(ix, iz)` takes integer global cell indices; `treesInBounds(left, top, right, bottom)` takes half-open global meter bounds. `coverage(sample)` returns coarse cover potential without another terrain sample; `densityAt(sample, x, z)` adds clustered cover at global meter coordinates. `families`, `CELL`, and `TILE_SIZE` expose metadata for future consumers. No harvesting, resources, building rules or economy are implemented.
- `forest_renderer.js`: bounded candidate cache (8,192 entries, including rejected cells), 120 cached canopy tiles and one reusable close-view image with padding. New candidates are generated under a soft 2 ms frame budget. Tiles reuse records rather than reclassifying terrain during drawing. The close image is translated during small pans and rebuilt only when needed. Sprite arrivals invalidate that image without changing roots. Trees are sorted by global depth; no viewport-dependent 95-tree cutoff remains.
- `basic_world.js`: integrates the renderer and bakes coarse clustered canopy into existing cached terrain imagery. Removes the old camera/zoom-dependent grids, drawing cutoff and drag-time tree hiding. Roots/species/world sizes stay fixed. Old decorative placements were not serialized; replacing them does not change saves. Also resets stale inspector text on entering another territory.
- `world_map.js`: uses the same cover rules for strategic forest shading and metrics. Region rasterization now yields between row batches (soft 4 ms budget). In-flight keys remain reserved across yields, avoiding duplicate jobs when panning or closing/reopening the map. Completed cache images and all geographic sampling positions are unchanged.
- `world_terrain.js`: adds `elevationAt()` for normal/slope queries without allocating climate or biome metadata. Existing sampling functions and fields remain unchanged. Height-only arithmetic exactly matches the full sampler.
- `index.html` / `world_config.js`: load the two new modules in dependency order and update release/cache versions. Seed, 316×316 grid and 32,768×32,768 territories are unchanged. Stabilization fixes remain inherited.

## Appearance and LOD

Far views use the cached clustered canopy raster. The medium blend starts at zoom 0.58 and completes at 0.72, when crowns reach a useful screen size; lower-detail tree shapes share the exact close-view roots. PNG/evergreen detail crossfades between 0.72 and 0.92. Smooth weights replace hard swaps; the old zoom-0.65 grid change is gone. Wide/high-DPI views smoothly favor coarse cover when detail would exceed the bounded tile cache. This changes rendering quality, not candidates.

Broadleaf, olive, mint-deciduous/willow and rare cherry sprites reuse four existing PNGs. Spruce and pine use small cached, shaded evergreen graphics because the pack has no conifers; tundra uses small scrub shapes. Flowering trees have a 0.4% chance only after selecting a temperate-forest family. No purple decorative species are added. Blended families naturally produce mixed stands.

Strategic pixels represent coarse cover potential; local views resolve individual roots and sub-pixel-scale clearings. The same sample and global coordinate produce identical cover/density queries in both interfaces. Strategic views do not attempt to draw every local tree or alias 420 m clearings into multi-kilometer pixels.

## Profiling before architecture changes

Initial inclusive CPU samples: biome classification 595 ms, old tree drawing 14 ms, strategic region generation 1,658 ms. The old renderer changed candidate grid spacing at zoom 0.65 and hid trees while dragging, independently causing instability.

A later trace of the cold maximum-zoom slowdown showed chunk generation 877 ms, hillshade 459 ms and drawing 27 ms; candidate generation was already finished. Hillshade was requesting full biome-bearing samples solely for elevation. The height-only path removes four unnecessary biome allocations/classifications per detail pixel. A matching camera scenario then sampled 279 ms in chunk generation and 90 ms in hillshade, with cold pan improving from 50.7 to 59.0 FPS (p95 33.4 → 16.7 ms). These are inclusive workflow totals with changing cache completion, not equal-work microbenchmarks. All 1,500 tested height queries across three seeds match the original sampler exactly.

No extra biome classification occurs in per-frame tree drawing. Cluster fields are evaluated only for uncached candidates and cached terrain raster generation, not every camera frame.

## Performance results

Chromium 154, headless, software WebGL, 1440×1000. Three interleaved baseline/feature runs use identical standard camera gestures. Baseline core scripts are served from the validated biome branch. Values below are medians of the three runs; rAF scheduling measures responsiveness, not a production GPU benchmark. Standard gestures remain in coarse-canopy LOD; separate tests exercise every detail transition and maximum zoom.

| Gesture | Before FPS | After FPS | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: |
| Strategic pan | 47.8 | 60.0 | 33.4 ms | 16.8 ms |
| Local pan | 58.8 | 56.4 | 16.8 ms | 33.3 ms |
| Local zoom | 54.0 | 57.6 | 33.3 ms | 16.8 ms |

Median engine readiness: 2101 → 1747 ms. Final full regression: 1708 → 1735 ms startup, 545 → 536 ms territory entry. Long tasks (>50 ms) in those full runs: 5 → 5; maximum 276 → 191 ms.

Final repeated LOD test: 59.1 FPS, p95 16.8 ms. Maximum local zoom after repeated transitions: 60.0 FPS, p95 16.7 ms. A separate matched warm maximum-zoom comparison measured 56.0 FPS / 33.3 ms p95 for the original renderer and about 60 FPS / 16.8 ms for the forest renderer.

Ordinary local pan has a slightly lower median FPS and worse p95 in the three-run sample. One cold feature run had a 466.7 ms rAF interval; that isolated spike was not attributed to a tree-rendering stack. Earlier intermediate configurations also showed cold spikes and are retained in the artifacts. Uniform stutter-free performance is not established. Full-run long-task figures and gesture rAF outliers come from different captures and should not be conflated. The original historic 12.571-second task did not recur.

## Forest density examples

Default seed 734221. Each region samples 1,024 fixed candidates around a representative biome center (about 5.31 km²), not the entire world's distribution. Values vary within each biome because of clearings, terrain and blended families.

| Representative region | Trees | Candidate occupancy | Trees/km² |
| --- | ---: | ---: | ---: |
| temperate forest | 456 | 44.5% | 85.9 |
| grassland | 43 | 4.2% | 8.1 |
| dry plains | 9 | 0.9% | 1.7 |
| taiga | 245 | 23.9% | 46.2 |
| alpine | 0 | 0.0% | 0.0 |
| tundra snow | 0 | 0.0% | 0.0 |
| wetlands | 301 | 29.4% | 56.7 |
| coastal | 63 | 6.2% | 11.9 |

The selected extreme alpine and tundra sites are above their limits and are intentionally treeless. Controlled suitable-climate tests also verify sparse alpine pines and tundra scrub, with denser temperate/taiga/wetland stands. Wetland samples mix willow-like and broadleaf forms. Density figures describe stylized map vegetation, not a forestry survey.

## Regression evidence

13 Node tests passed: deterministic reloads and roots/sizes/species across LOD, chunk and territory partitions, no duplicate/missing roots, normalized biome classifications, all eight species/density rules, water/slope/treeline exclusion, strategic/local cover and clustered-density agreement, height parity and zero-weight selection. Existing geography fixtures still match.

Browser tests passed Singleplayer, strategic navigation, 32K territory entry, repeated far/medium/close zoom, maximum-zoom pan, terrain/tree display, normal authentication-dialog close, return to World Map and rapid strategic close/reopen while generation was queued. Final observed cache: 1,280 candidate records and 20 tiles; no candidate builds while idle. All 120 sampled roots retained identical IDs, positions, species and sizes across repeated zooms. The zero-hash review fix was also checked against that final browser snapshot and preserved every root.

Final console errors, failed requests and HTTP errors: none. Existing-save test preserved an unknown saved field through the normal save handler. No save format, multiplayer API, ownership or authenticated remote state was modified. Real authenticated multiplayer sessions were not exercised.

Water exclusion uses the existing authoritative terrain mask. Decorative waterway ribbons still have no authoritative hydrology mask; this update does not reinterpret them as simulated rivers. Conifers are intentionally simplified. First-visit detail continues to stream progressively. Full eviction/high-DPI stress and production GPU profiling remain future validation beyond the measured viewport.

## Reproduce and inspect

- Unit tests: `node --test tests/*.test.cjs`.
- Start the existing Python static server on port 8000. With Chromium installed and Playwright Core available, run `node tests/forest-browser.cjs /tmp/map-game-forest-validation`. `MAP_GAME_TEST_URL` can override the internal test origin. For this cloud environment: `NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/forest-browser.cjs /workspace/map-validation`.
- Browser execution requires access to the already approved Chromium NSS trust stores in this isolated environment. TLS verification remains enabled; no certificates, private keys or trust databases are committed.
- `/workspace/map-validation/forest-summary.json`, `forest-bench-*.json`, `forest-lod.json`, `forest-distribution.json`, `report.json`, `biome-gallery.json` and CPU profiles retain raw evidence. Earlier intermediate runs are in `forest-pre-height/` and `forest-intermediate.json`.
- Screenshots: `forest-temperate-close.png`, `forest-taiga.png`, `forest-wetlands.png`, `forest-grassland.png`, `forest-tundra.png`, and `world.png` in that artifact directory.
