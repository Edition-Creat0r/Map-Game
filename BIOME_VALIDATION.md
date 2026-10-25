# 0.3.3A biome engine validation

Branch: `feature/0.3.3a-biomes`, based on `fix/performance-stabilization` (62781e1). No merge into main.

## Architecture and files

- `world_terrain.js` adds eight immutable family definitions and a `biome` object to each shared terrain sample. Public `sample`, `local`, and `strategic` interfaces and all existing fields remain intact. `biome` exposes ID, label, normalized blend weights, blended color, latitude, climate temperature and a provisional water-proximity score. Metadata includes reusable texture keys for future systems. No new noise samples are needed.
- `world_map.js` blends the shared palette into strategic colors and displays the shared family label.
- `basic_world.js` uses the same blend, retaining rocky/snowy shading. Existing JPG terrain images are decoded once into 16×16 texture tiles; low-amplitude texture variation is mixed by biome weights only when generating cached rasters. No per-frame patterns or decoding. Texture availability invalidates the raster once. Existing terrain assets are reused; no new downloads or inappropriate building textures are introduced.
- `game.js` displays the shared territory-center biome through a new runtime-only `biomeInfo` field; the legacy biome value remains unchanged for compatibility. The terrain inspector shows the biome at the hovered point.
- `world_config.js` and `index.html` update the visible release and script cache versions. Grid dimensions are unchanged.
- `tests/biomes.test.cjs` and `tests/terrain-baseline.json` provide deterministic tests and fixed snapshots from the stabilization sampler.

Biomes derive from existing elevation, temperature, moisture, steepness, rock/snow masks, plus a symmetric latitude term. Classification uses smooth continuous weights in global meters. The dominant ID may change at a boundary, while rendered weights remain continuous. Strategic territory-center samples equal local samples at (16384,16384); actual pixels sample the same continuous field. No territory-wide biome is painted as a rectangular patch.

Elevation, mountain structures, original terrain labels, forest density, seeds, coordinates, tree candidates/positions and save format are unchanged. Five tests verify deterministic reloads and multiple seeds, exact baseline fields, strategic/local agreement, chunk and territory borders, normalized blends, geographic continuity and eight representative climate classifications. Run `node --test tests/biomes.test.cjs` from the checkout (also works by absolute path).

## Provisional climate limits

Latitude is relative to the existing 316-row world, not real-world degrees. Coastal influence is an elevation band above the existing water threshold, attenuated by steepness. Wetlands use moisture and low elevation. Neither is a measured shoreline distance, river network, drainage model or new hydrology simulation. Existing decorative waterways remain unchanged and may not match the proxy. Water continues using its existing rendering. The old tree engine is intentionally preserved, so biome-specific vegetation is future work.

## Distribution

Default seed 734221, every second territory center (24,964 points); percentages describe dominant families, not exact land area, and include water points classified as coastal. Different seeds differ.

| Family | Points | Percent |
| --- | ---: | ---: |
| Temperate forest | 580 | 2.3% |
| Grassland | 8606 | 34.5% |
| Dry plains | 1990 | 8.0% |
| Taiga | 797 | 3.2% |
| Alpine | 3760 | 15.1% |
| Tundra / snow | 6842 | 27.4% |
| Wetlands | 1562 | 6.3% |
| Coastal | 827 | 3.3% |

## Performance and browser regression

Chromium 154, headless, software WebGL, 1440×1000. Baseline was profiled before edits; the same Playwright gestures were repeated sequentially. Short rAF scheduling measurements are not production GPU benchmarks. Streaming/cache timing and external network startup vary between runs.

| Gesture | Baseline FPS | Biome FPS | Baseline p95 | Biome p95 |
| --- | ---: | ---: | ---: | ---: |
| World Map pan | 44.3 | 60.0 | 33.3 ms | 16.7 ms |
| Local pan | 60.0 | 60.0 | 16.8 ms | 16.8 ms |
| Local zoom | 60.0 | 59.2 | 16.7 ms | 16.7 ms |

Profiled engine readiness: 2431 ms baseline, 2598 ms biome. Full regression engine readiness: 1676 → 1708 ms; territory entry: 537 → 545 ms. Long tasks (>50 ms): 3 → 5; maximum 200 → 276 ms. No startup/loading failure observed. More short long tasks are a limitation, not a claim of zero rendering overhead.

CPU sampling shows aggregate strategic region generation increasing from approximately 837 to 1446 ms, including 549 ms in classification. Local overview sampling/building increased from 41 to 145 ms. These are workflow totals, not equal-work microbenchmarks. No additional procedural noise calls are made, and local camera movement reuses imagery/tree samples rather than regenerating the biome field. Future optimization should target classification allocations or streaming scheduling before expanding per-pixel features.

The high-detail regression reached zoom 2, generated 17 chunks incrementally and returned to the World Map. Detail panning: 59.6 FPS, p95 16.8 ms. Chunk cancellation, bounded caching, hidden-3D suppression and stabilization bug fixes remain intact.

Final browser checks passed Singleplayer, 316×316 strategic map selection/panning, 32K territory entry, terrain and all six existing tree images, pan/zoom, return to map, and normal authentication close-button interaction. Captured errors, failed requests and HTTP errors: none. No real multiplayer credentials or hosted state mutations were used. A separate gallery/save test entered all eight representative families and preserved an existing custom local-save field through the game's save handler. No save migration is needed. All JavaScript syntax and diff whitespace checks passed.

## Artifacts

Outside the checkout in `/workspace/map-validation`: `biome-baseline.json`, `biome-after.json`, matching `.cpuprofile` files, final `report.json`, `deep.json`, `biome-gallery.json`, and existing Playwright scripts. Screenshots: `world.png`, `territory.png`, `territory-zoom.png`, and `biome-<family>.png` for all eight families. These captures show the current low-resolution overview and existing tree positions; this update does not add a forest engine, richer terrain geometry, economy, construction rules, ownership changes or water simulation.
