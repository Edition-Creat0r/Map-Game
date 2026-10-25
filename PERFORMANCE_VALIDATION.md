# Performance stabilization before 0.3.3

Branch: `fix/performance-stabilization`, based on the validated checkout and its stylesheet fix. No biome, save-format, ownership, or economy changes.

## Defects corrected

- Sand normal references now use the existing `sand.normal.jpg`.
- Concrete references now use `albedo.webp`, `normal.webp`, and `roughness.webp`.
- The authentication close button has a stacking level above the heading; its appearance is unchanged.
- A small inline SVG favicon prevents an undeclared favicon request.
- Retains removal of the nonexistent `phase2.css` link; its styles are already in `styles.css`.

## Profile first, then optimize

Chromium 154, headless, 1440×1000, software WebGL. Existing external Playwright checks were extended to collect Chrome DevTools CPU profiles. All TLS verification remained enabled.

Baseline inclusive sampled CPU times: strategic `renderRegion` 2,028 ms, `colorForTerrain` 1,007 ms, shared local `terrainSample` 35 ms, `buildOverview` 65 ms, tree sprites 10 ms. Babylon's render callback consumed 436 ms of sampled CPU while its canvas was hidden; software graphics work is not fully represented by CPU sampling. The hidden scene rendered every frame even though Basic uses another canvas. Removing that work was the strongest local interaction improvement.

The previously recorded 12.571-second main-thread task did not recur in the new baseline profiling run. Its original stack was not captured, so its exact cause remains unproven; it must not be described as conclusively diagnosed. Repeated final launches succeeded, but this does not prove that a rare startup stall is impossible.

Changes:

- Skip `scene.render()` while Basic is active; retain day/night updates and the existing Regular render path.
- Reuse the strategic palette and iterate weights without allocating a palette and entries array per terrain pixel. Arithmetic/order and colors are preserved. 10,000 deterministic comparisons against the original color function matched exactly.
- Cache exact tree samples by world grid coordinate and tree grid spacing, capped at 8,192 entries and cleared on territory change/invalidation. Noise and tree placement are unchanged.
- Split detail chunk generation into row batches, yielding after approximately 4 ms. The budget is checked between rows, not a hard real-time guarantee. Preserve the same per-pixel samples and hillshade. Only one build runs at once; territory revision checks discard stale results.
- Drop queued offscreen chunks. Retain the existing 120-chunk LRU bound. No eviction-policy or terrain-resolution changes.

The overview already caches its raster; ordinary pan/zoom did not regenerate it. Normal-view tests had zero detail chunks because the existing visible-chunk threshold selected the overview. High zoom exercised the actual detail path: 17 cached chunks at zoom 2, then successful panning and return to map while generation was pending. Full 120-entry eviction stress was not run. Chunk generation still makes five terrain samples per pixel for hillshade; it now yields rather than blocking for the entire chunk. No Canvas pattern creation exists in this renderer. Tree drawing was a minor measured cost. No worker or broad renderer rewrite was needed.

## Comparable gesture measurements

Short requestAnimationFrame scheduling samples with CPU profiling enabled, same gestures, sequential browser runs. These are not production GPU benchmarks. Other repetitions varied, especially during strategic streaming.

| Gesture | Before FPS | After FPS | Before p95 | After p95 | Before max interval | After max interval |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Strategic pan | 30.2 | 60.0 | 66.6 ms | 16.8 ms | 83.3 ms | 16.8 ms |
| Local pan | 27.0 | 60.0 | 66.7 ms | 16.7 ms | 316.7 ms | 16.8 ms |
| Local zoom | 37.0 | 60.0 | 49.9 ms | 16.7 ms | 50.0 ms | 16.8 ms |

Separate high-detail pan: 55.6 FPS, p95 16.8 ms, max 83.4 ms. That run's strategic pan was 44.8 FPS with a 200 ms maximum, showing remaining streaming variability. Final profiled startup: 1.619 seconds versus 2.735 baseline. Final full gameplay run: engine ready in 1.676 seconds, territory entered in 537 ms.

After-profile inclusive CPU: `renderRegion` 800 ms, `colorForTerrain` 105 ms, local samples 16 ms, overview 55 ms, trees 7 ms. These are aggregate samples over similar workflows, not equal-work microbenchmarks. Historic full validation recorded 16 long tasks with maximum 12,571 ms; final full regression recorded three, maximum 200 ms. Startup overview and strategic region generation remain synchronous; further work should profile their remaining spikes before changing geography or resolution.

## Regression results

- Singleplayer launches; 316×316 strategic map renders, selects, and pans. Fixed map scale remains intentional; wheel pans rather than zooms.
- Entered a 32,768×32,768 territory through the map UI. Terrain and all six tree sprites display; local pan/zoom work; return to map succeeds.
- Authentication dialog opens and its close button accepts a normal click. No player credentials used or hosted state changed; authenticated multiplayer remains untested.
- Final captured console errors, failed requests, and HTTP errors: none. All required external scripts loaded. Concrete paths additionally verified against existing files.
- All JavaScript syntax checks and `git diff --check` passed.

Detailed CPU profiles, JSON measurements, browser scripts, screenshots, and prior CA verification/rollback notes remain outside the repository in `/workspace/map-validation`. No certificates, keys, or trust-store databases are committed. TLS verification stays enabled.
