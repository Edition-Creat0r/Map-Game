# 0.3.3C terrain and environment polish

Branch: `feature/0.3.3c-terrain-polish`, based on `feature/0.3.3b-forests` (812e637). No automatic merge.

## Preserved data and compatibility

Elevation, seed, authoritative water mask, biome classifications and forest inputs are unchanged. `world_terrain.js`, `forest.js`, `forest_renderer.js`, `game.js`, ownership/authentication code and existing save handlers are byte-identical to 0.3.3B. A committed SHA-256 fixture verifies 5,000 frozen tree candidates including IDs, positions, species, sizes and colors. Existing terrain fixtures and the 316×316 / 32,768-unit dimensions still pass. The Basic/Regular separation remains intact. No economy features or save migrations were added.

## Surface rendering

`environment.js` supplies shared relief lighting, curvature shading, appearance-only biome adjustments and incremental raster jobs. Normals use actual sampled heights with an 18× visual exaggeration, without changing elevation. Valleys receive restrained curvature shading; exposed rock has a cooler variation. Obsolete ridge-symbol drawing helpers were removed rather than adding repeated glyphs.

`basic_world.js` reuses halo heights for normals instead of repeatedly resampling each detail pixel. Detail images include color overdraw on a globally aligned 8-unit texel grid. Shared edge texels match exactly. Texture luminance is precomputed once from existing images, sampled with periodic bilinear filtering and blended by existing biome weights. Microvariation is now anchored globally rather than resetting at territory borders. Snow peaks remain snow; unsnowed tundra receives muted ground colors. Forest canopy continues using the unchanged shared vegetation engine.

Overview sampling and painting yield between rows. A texture arrival recolors retained samples in the background while the previous image stays visible, without reclassifying the territory or resetting forest caches. Detail/strategic rasters retain only packed colors and heights; full metadata is retained only where overview recoloring needs it. Terrain canvases stay opaque.

`world_map.js` fixes the old half-territory offset in continuous raster sampling; the public `strategic(i,j)` territory-center API remains unchanged. Pixel centers and region overdraw now match the global coordinate transform used by local terrain and waterways. Cached bilinear fallback images replace repeated foreground sampling and blocky fallback rectangles. Loaded regions skip fallback painting. Pending offscreen region jobs are discarded/reprioritized when the camera changes; active keys remain reserved across asynchronous work.

## Rivers, lakes and existing masks

The old sine-wave ribbons did not follow elevation. Before implementation, the chosen contract was to preserve the authoritative `elevation < 0.32` water mask and all forest/save inputs. Lakes remain the existing low basins, with shared depth colors and height-derived shore transitions. Dry basins are not flooded and no elevation is carved.

`hydrology.js` adds a deterministic potential-drainage graph on globally jittered 2,048-unit nodes. Neighbor choices descend existing terrain; curved candidates are accepted only when all eight finer height probes descend. Shared node IDs join tributaries. Width is a downstream elevation proxy, independent of generation/view order, and cannot narrow along a descending edge. It is not calculated discharge or upstream contributing area.

Heads are seeded spatially above the existing lowlands. Each trace has a 16-edge budget. Only routes reaching existing water or a sampled closed basin/barrier are published; unfinished traces are omitted rather than ending at arbitrary budget cutoffs. A proven source halo includes incoming routes across tile/territory borders. Node/edge memoization is bounded at 65,536 entries each. Only requested source tiles are generated, with a soft one-millisecond frame budget, and the display cache holds at most 256 tiles.

`water_renderer.js` shares those paths between views. Strategic cartography caches small rasters with a minimum screen width; subpixel curves are generalized to endpoints. Local views retain the probed curves and physical width profile. Banks are painted before the water pass to avoid endcap artifacts. Padded viewport caches translate during panning; empty transparent layers are not composited. River bounds include curved vertices, preventing missing reaches at view boundaries.

These channels are visual drainage overlays. They do **not** make new land authoritative gameplay water or change buildability/ownership. Existing tree candidates and structures can therefore overlap a new channel. Closed-basin traces represent potential runoff, not guaranteed perennial flow. Subgrid obstructions, rainfall, spill/flood levels, erosion and mass conservation require a future hydrology/data decision. This release performs no full-world hydrology simulation during startup.

## Land-only biome survey and rebalancing decision

Default seed 734221, all 99,856 territory centers: 631 water samples and 99,225 land samples. These are center-sample proportions, not exact polygon areas. Classification counts are identical before and after this release.

| Land biome | Centers | Share |
| --- | ---: | ---: |
| taiga | 3270 | 3.30% |
| tundra snow | 27064 | 27.28% |
| grassland | 34356 | 34.62% |
| dry plains | 8079 | 8.14% |
| coastal | 2716 | 2.74% |
| wetlands | 6170 | 6.22% |
| alpine | 15281 | 15.40% |
| temperate forest | 2289 | 2.31% |

Actual `snow_peak` terrain occurs at 15763 land centers (15.89%), versus 27.28% for the combined tundra/snow family. Tundra is not synonymous with permanent snow. The old tundra palette made that distinction weak.

Temperate forest requires simultaneous moisture, warmth, low rock and low coastal influence; multiplying those factors makes dominance rare. Grassland has a base score and tundra combines cold plus snow. Dominant family proportions also differ from fractional vegetation coverage. Rebalancing those weights would change accepted trees and species, conflicting with the fixed-forest requirement. This release therefore retains the authoritative weights and improves appearance separately.

## Profiling and fixes

The fresh 0.3.3B CPU trace sampled 397 ms in fallback drawing (345 ms in its color sampling) and 248 ms in synchronous overview construction. Final fallback drawing sampled about 57 ms after caching. Async child work is attributed to `grid`/`paint`, so the new overview wrapper's small CPU figure must not be mistaken for the total construction cost.

An early drainage prototype spent about 3.6 seconds restroking the whole visible network and reduced strategic interaction to roughly 21 FPS. Small cached cartographic rasters removed that repeated work; a final trace sampled about 335 ms in strategic water drawing across the workflow.

A high-detail regression exposed lost opaque-canvas flags and unnecessary full-screen transparent blits. Restoring opaque terrain caches and skipping empty water layers recovered approximately 60 FPS in the follow-up trace. Rejected intermediate results remain evidence of problems fixed during development, not readiness claims. Inclusive CPU totals cover similar workflows rather than identical-work microbenchmarks.

## Performance comparison

Chromium 154, headless software WebGL, 1440×1000. Three interleaved baseline/feature gesture runs; the baseline serves core scripts from the validated 0.3.3B branch. The table gives medians. A final profile/full regression also ran after the final queue/fallback fixes. rAF intervals include browser/system scheduling and are not a production GPU benchmark.

| Gesture | 0.3.3B FPS | Polish FPS | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: |
| World Map pan | 60.0 | 60.0 | 16.7 ms | 16.8 ms |
| Local pan | 60.0 | 60.0 | 16.8 ms | 16.8 ms |
| Local zoom | 59.2 | 60.0 | 16.8 ms | 16.7 ms |

Median engine readiness: 1805 → 1671 ms. In the individual full regressions, startup was 2200 → 1584 ms; territory entry was 632 → 826 ms. The extra entry latency is a measurable cost of the richer, frame-budgeted raster pipeline, not a loading failure. Long tasks (>50 ms): 4 → 4; maximum 218 → 223 ms.

Time to at least 12 high-detail cache entries, including identical wheel input: 1918 → 2003 ms (one matched run). High-detail pan: 59.6 → 59.2 FPS, p95 16.8 → 16.8 ms. This is an interaction/caching measure, not a fixed-chunk microbenchmark.

Final repeated forest LOD crossings: 59.6 FPS; maximum-zoom forest pan: 59.1 FPS, p95 16.8 ms. Candidate/tile caches stayed within the inherited limits, all 120 sampled roots stayed identical, and idle candidate builds were zero. Cold frame variability and nonzero long tasks remain; uniform zero-stutter behavior is not established. Detailed terrain/water continues filling progressively.

## Tests and artifacts

23 Node tests passed. Coverage includes raw terrain/height compatibility, all eight biomes, the 0.3.3B forest fingerprint, reload determinism, root stability across zoom, species/density and treeline rules, shared halo/texel continuity at chunks and territories, packed versus retained raster equality, cancellation, descending curved drainage, joins/widths, query partitions, and natural termination.

Browser checks passed Singleplayer, World Map selection/pan, territory entry, local pan/zoom, high-detail generation, repeated forest LOD crossings, rapid queued-stream close/reopen, authentication dialog close, return to the atlas and existing-save unknown-field preservation. Additional image checks confirmed visible river and lake pixels. Final console errors, missing resources, failed requests and HTTP errors: none. Authenticated multiplayer was not exercised; its protocol/ownership files are unchanged.

Affected files: the three new rendering/drainage modules, `basic_world.js`, `world_map.js`, release/cache metadata in `index.html` and `world_config.js`, and the environment test/fixture files. Terrain/forest source models and gameplay/save/auth files are unchanged.

Run `node --test tests/*.test.cjs`. For browser checks, run the existing static server on port 8001 and use `NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/environment-browser.cjs /workspace/terrain-polish`. `MAP_GAME_TEST_URL` and `CHROMIUM_PATH` can override the test origin and browser binary. The inherited forest browser test accepts the same origin override. Chromium needs access to its already approved cloud trust store; TLS verification stays enabled.

Screenshots in `/workspace/terrain-polish`: `mountains.png`, `mountains-detail.png`, `river.png`, `shoreline-lake.png`, `biome-transition.png`, `strategic-environment.png`, and `strategic-lake.png`. Coordinates are reproducible from `tests/environment-sites.json`. The broad original mountain field and coarse overview still limit small-scale relief; no new erosion geometry was invented. Large/high-DPI drainage views prioritize a bounded set of nearby source tiles; performance validation here uses the stated viewport.

Raw artifacts there include `baseline.cpuprofile`, `before.cpuprofile` (final profile), `polish-bench-*.json`, `summary.json`, `detail-bench.json`, the baseline/final `report.json` files, `forest-lod.json`, `environment-browser.json`, and the land/snow surveys. Screenshots are actual browser captures, not generated illustrations. No certificates, private keys or trust-store files are committed.
