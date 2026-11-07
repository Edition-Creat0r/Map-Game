# Quaternius optimization and visual review

2026-11-07. Base `de493cdc95d43d9e03b4e3c077b51b9f25204381`; branch `feature/0.4.2-quaternius-replacements`. **Three review prototypes only. Gameplay integration stays OFF. No remaining designs, 0.4.3 changes, push, merge, deployment or Supabase activity.**

## What changed and why

The existing renderer already issued only 18 draw calls at 250 buildings, but retained 6,672 scene mesh objects, including disabled LOD hierarchies. Profiling identified active-mesh traversal as the largest named CPU cost. Its distant geometry also retained repeated native wall/roof tiles and thousands of window-frame triangles.

- `renderer.js`: 69 reusable thin-instance batches by building/LOD/material, with one logical anchor per building. No per-building mesh hierarchy or material copies. Source handedness is retained through conjugated instance matrices. Matrices/buffers are cached; capacity grows geometrically. Stationary cameras upload no buffers; unchanged membership/poses do not upload during motion. Conservative sphere/frustum culling retains logical records, with subpixel-distance hysteresis. Culling/LOD updates use a 150 ms sampling cadence and dirty invalidation. Fast edge-entry behavior still needs target-hardware review.
- `tools/far_lod.py` and `tools/build_downtown.py`: Medium caches native window panels; Low caches plain wall panels and merges repeated wall/roof geometry. Four additive 128×192 PNGs bake actual Quaternius module UVs/base colors; no resource icons, Kenney data, paid shaders or unrelated artwork. Distant façades flatten relief and simplify glazing, while keeping 3D major equipment. The bakes are deliberate distant approximations, not replacement High textures.
- `showroom.js`: shared thin-instance contact shadows, camera-aware initial detail selection, earlier camera setup, active-triangle/memory counters, and capture-only URL options. Generation remains incremental. New batching is not a drop-in gameplay/placement adapter; logical roots intentionally do not contain their own child meshes. No main-game renderer or construction path is changed.
- `comparison.html` / `comparison.js`: actual three-panel renderer capture at identical distance, camera, lighting and viewport. Each scene is prepared and paused in sequence to avoid unnecessary simultaneous rendering.
- Regression/profiling scripts: `tests/quaternius-browser.cjs`, `quaternius-review-browser.cjs`, `quaternius-profile.cjs`, `quaternius-optimization-performance.cjs`, `quaternius-lod-preservation.test.cjs`; `tools/test_far_lod.py`. Generated manifest, audit, GLB, four caches, documentation and evidence were updated in this prototype folder.

## Quality and source preservation

Automated tests compare **High positions, normals, UVs, indices and normalized PBR material descriptors** against the parent commit; they match exactly. Every one of the 15 original texture files retains its SHA-256. Footprints, catalog IDs and source archives are unchanged. High appearance was not reduced to improve benchmark numbers. Existing Kenney assets/code remain byte-identical and are comparison-only. Existing approved ground/material texture files are untouched.

| Canonical ID | Footprint | Low triangles | Medium triangles | High triangles |
|---|---:|---:|---:|---:|
| `steelMill` | 118 × 92 | 218 | 742 | 31,716 |
| `precisionElectronicsWorks` | 80 × 66 | 140 | 876 | 7,964 |
| `machineWorks` | 64 × 54 | 142 | 550 | 15,850 |

## Measured bottlenecks

[Paired CPU/GPU profile](evidence/optimization/paired-profile.json) uses 250 buildings, native 1366×768, 24 warm-up frames and 36 sampled callbacks, same camera/layout/lighting. GPU timings are resolved WebGL timer queries on **SwiftShader**, not Lenovo measurements. CPU/GPU durations overlap and must not be added.

| Measurement | de493cd | Optimized |
|---|---:|---:|
| CPU scene time, ms | 19.11 | 1.44 |
| Active-mesh evaluation, ms | 14.76 | 0.22 |
| CPU render portion, ms | 4.03 | 1.05 |
| GPU query average, ms | 234.36 | 134.33 |
| Resolved GPU queries | 10.00 | 11.00 |
| Scene mesh objects | 6,672.00 | 73.00 |
| Submitted scene triangles | 155,988.00 | 41,604.00 |

CPU sampling confirms `_evaluateActiveMeshes` and parent/frustum/instance-buffer work in the original scene; pooled batches remove most of it. GPU time remains much larger than CPU scene time after optimization. Reducing resolution in a **diagnostic only** improved FPS (about 7.32 → 12.01 in that probe), while removing distant albedo textures or freezing matrices did not produce a comparable gain. Those appearance-changing probes were not committed as rendering behavior. Fragment/raster/resolve work remains a likely GPU cost; these whole-scene timer queries do not isolate an individual shader or driver operation. [Before probes](evidence/optimization/profile-before.json), [after probes](evidence/optimization/profile-after.json).

## Matched performance

[All 24 measured cases and variability](evidence/optimization/matched-performance.json). Two alternating runs per source/count, fresh pages, 24 warm-up frames, 32 static and 32 orbit frame intervals. Three sources: original catalog in the same fixture; immutable `de493cd` prototypes served from a detached worktree; optimized prototypes. Same native resolution, High cap/adaptive LOD, layout/IDs, camera and lighting. Real-time shadows OFF; same approved ground and contact-shadow appearance. The catalog fixture also uses pooled contact shadows, making it a conservative reference; its game renderer code is unchanged.

The historical 3.44/4.54 FPS values are **not** mixed into this fresh comparison. Short software-rendering samples remain variable and do not certify hardware performance.

| Count | Catalog FPS | de493cd FPS | Optimized FPS [range] | Optimized p95 ms | Draws old → new | New submitted scene triangles | Meshes old → new |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10.59 | 6.87 | 10.62 [10.51–10.73] | 211.5 | 23 → 20 | 3,860 | 272 → 73 |
| 50 | 8.96 | 7.63 | 10.02 [9.36–10.68] | 254.6 | 18 → 18 | 8,484 | 1,336 → 73 |
| 100 | 7.86 | 6.00 | 8.42 [8.02–8.82] | 325.3 | 18 → 18 | 16,726 | 2,672 → 73 |
| 250 | 5.90 | 3.98 | 7.11 [6.91–7.31] | 263.2 | 18 → 18 | 41,604 | 6,672 → 73 |

Scene triangles include ground/road/contact surfaces; building-only budgets and culling counts are in the raw report. All 250 logical records remain present; 246 are in the conservative visible set at the static camera. Unculled Low geometry falls from 158,758 to 41,718 triangles; the change is not removal of buildings or economy work.

| Count | Catalog orbit FPS / p95 ms | de493cd orbit FPS / p95 ms | Optimized orbit FPS / p95 ms | Ready ms: old → new |
|---:|---:|---:|---:|---:|
| 10 | 10.86 / 179.5 | 6.86 / 320.8 | 10.25 / 219.8 | 2485 → 2481 |
| 50 | 9.34 / 248.1 | 7.37 / 281.0 | 9.10 / 241.5 | 2787 → 3023 |
| 100 | 7.52 / 171.3 | 6.16 / 322.0 | 8.39 / 270.5 | 4105 → 3720 |
| 250 | 5.85 / 202.7 | 3.95 / 494.1 | 6.36 / 438.7 | 7228 → 4734 |

Steady segments recorded zero >50 ms main-thread long tasks for old/new prototypes in this run. This does **not** mean smooth 60 FPS: the GPU/compositor frame intervals remain large. Startup-through-warm-up tasks are retained separately in the raw report. Frame-tail results are mixed: 10-building static p95 rose ~192 → 212 ms; 250-building orbit p95 improved ~494 → 439 ms but remains much worse than the catalog's ~203 ms. The 50-building median ready time increased ~2.79 → 3.02 s. No blanket regression-free or production-readiness claim is made.

## Memory and cleanup

- Unique scene vertex/index data estimate: **5,992,296 → 3,993,560 bytes** (~5.71 → 3.81 MiB), deduplicating shared geometry rather than multiplying by instances.
- The 19 model textures estimate **42,467,323 bytes** (~40.5 MiB RGBA+mips). The four façade caches add ~0.5 MiB; all 15 original maps are unchanged. Including showroom surfaces, the loaded texture estimate is ~41.23 MiB. This is not measured driver VRAM.
- At 250 records, model matrix-buffer capacity is **114,688 bytes**; contact matrices add 16,000 bytes. Capacity and uploads are observable in pool statistics. CPU logical nodes, shaders, browser allocations and framebuffer/MSAA storage are additional and not included.
- Repeated count/quality changes keep the mesh pool fixed at 73; stationary buffers do not upload. Full disposal is tested to leave zero scene meshes, materials and textures. GPU deletion completion is browser/driver-controlled; object disposal is not a physical VRAM reading.

## Actual tests and captures

- **166 Node tests passed**, zero failed/skipped: full repository `node --test tests/*.test.cjs`, including High fidelity/texture preservation and LOD reductions. [Log](evidence/optimization/node-results.txt).
- **43 Python tests passed**: existing archive/geometry validation plus deterministic bake, UV density, winding and fail-closed coverage tests. [Log](evidence/optimization/python-results.txt).
- **13 showroom browser check groups passed**: actual assets, LOD hysteresis, repeated zoom, quality/count changes, overlapping selections, three target resolutions, pointer/wheel navigation, no persistence, stationary uploads, cull/restore, full resource cleanup. [Results](evidence/optimization/browser/browser-results.json).
- **12 existing Singleplayer browser groups passed**: guest entry, construction/one charge, drag/zoom/cancel, duplicate-tab exclusion, save/reload, crash recovery, preference/unknown-field preservation, Basic fallback, territory and World Map navigation. [Gameplay](evidence/optimization/gameplay-regression.json), [graphics/navigation](evidence/optimization/singleplayer-regression.json).
- Actual review capture verifies three High close-ups and an equal-camera composite: all three cameras at **200.6 units**, alpha −2.136283, beta 1.02, target [0,8,0], identical 770×660 embedded viewports. No new console warnings/errors or loading failures. [Capture metadata](evidence/optimization/review/review-results.json).
- Two complete offline rebuilds reproduce **23 files byte-for-byte**. [Hashes](evidence/optimization/rebuild-results.json).

The original catalog comparison still emits nine known warnings from the three pre-existing zero-byte concrete WebP files. They were not hidden or replaced. Quaternius variants have zero new warnings/loading failures. Automated browsers use the managed environment's verified cached Babylon 9.32/SDK, with Supabase blocked; this is not live CDN/deployment/Supabase verification. Other historical browser scripts were not all rerun.

## Visual review and PNGs

| Building | Review | Remaining visual work |
|---|---|---|
| Steel Mill | Strongest identity: tall twin stacks, large brick hall and gantry distinguish heavy industry. Native brick/trim scale is consistent. | Furnace block and roller equipment are still simple original shapes; flat slab and stacks need richer authored detail for a semi-realistic finish. |
| Electronics Plant | Clean glazed metal wings read as a different architectural family. Same native module/story scale. | Currently resembles an office/assembly block; exposed T-shaped work cells do not communicate detailed electronics production. Better HVAC/service and enclosed equipment assets would help. |
| Machinery Works | Compact brick workshop, gantry and fabrication beds are recognizable at shared scale. | Shares much of the steel-mill vocabulary; loading-bay alignment/door detailing needs refinement. High geometry was intentionally kept unchanged during the optimization, so this pre-existing issue is visible in the review. |

All three remain **stylized prototypes**, not finished semi-realistic industrial assets. Additional approved industrial models or original furnace/conveyor/pipe/robot modeling would improve them; no Kenney substitution is made. No icon artwork is stretched onto surfaces. The four PNGs were captured from the actual renderer, not generated illustrations or resized models:

- [Steel Mill PNG](evidence/optimization/review/steelMill-close.png)
- [Electronics Plant PNG](evidence/optimization/review/precisionElectronicsWorks-close.png)
- [Machinery Works PNG](evidence/optimization/review/machineWorks-close.png)
- [Equal-distance comparison PNG](evidence/optimization/review/three-factories-same-distance.png)

## Reproduce / next gates

Use the README's asset/build prerequisites. Serve the detached baseline on port 8022 and this branch on 8023, then run `tests/quaternius-optimization-performance.cjs` and `tests/quaternius-profile.cjs`. `BEFORE_URL`, `BASE_URL`, `OUT_DIR`, `CHROMIUM`, `BENCH_RUNS` and `FRAME_SAMPLES` provide test configuration. The baseline object must be available for the immutable High-data regression test. Run `tests/quaternius-review-browser.cjs` to recreate the four PNGs; open `comparison.html` for the paused, shared-camera review.

Software performance is substantially improved, but native-resolution GPU time, frame tails, 150 ms culling/LOD cadence under very fast camera motion, and startup variation still need Lenovo hardware testing. No 30/60 FPS guarantee is made. Keep gameplay integration OFF, obtain visual review, and do not add the remaining 17 designs yet. Residential designs still await the separate house pack. No 0.4.3 branch, main, Supabase, economy rules, saves, multiplayer or protected release-candidate source was modified.
