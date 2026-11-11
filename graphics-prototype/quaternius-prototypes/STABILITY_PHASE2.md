# Phase 2 — graphics stability and performance

Branch: `phase2/graphics-stability-0533adf` in `/workspace/Map-Game-phase1-0533adf-20261111`.
Starting checkpoint: `0533adfe03225cbf9d3eeb4dc57b29a86d343d10`.

## Result and scope

Corrected and validated the capture test, added reproducible diagnostic profiling and cohort selection, and preserved the approved rendering path. No renderer optimization is retained: the measured dominant constraint is software rendering, and the explored shortcuts either reduce image resolution or require a broader asynchronous loading/lifecycle change without benefiting the full nine-design fixture. This is a capture/validation improvement, not a claimed FPS fix.

The original protected checkouts and Lenovo folders were not accessed during Phase 2. No quarantined assets, residential reconstruction, Kenney integration, gameplay activation, economy/save/backend changes, pushes, merges or deployment occurred. The GLB, all 19 approved texture files, manifest, footprints, IDs, renderer.js and showroom.js remain byte-identical to the starting checkpoint. All nine close-up images are pixel-identical to Phase 1.

## Capture correction

`ArcRotateCamera.setTarget()` rebuilds angles from the existing position. The old test set beta/alpha first and then called setTarget, producing oblique views mislabeled as overhead. The corrected test sets the target first, permits beta zero, then sets the overhead pose. Before each screenshot it asserts beta, azimuth, target, actual camera view-ray direction, and High LOD. The test also runs the same orientation assertion against the real initial oblique pose and requires rejection for all nine designs.

All nine overhead captures record beta = 0 and forward direction approximately `[0, -0.999999995, 0.0001]`; Babylon retains a tiny pole-stability epsilon. All 18 fresh close/overhead PNGs were produced with no errors, warnings, failed requests or HTTP failures. See the [comparison gallery](evidence/stability-phase2/comparison.html). Each row shows the starting checkpoint close-up, Phase 2 close-up and corrected overhead.

## Matched benchmark comparison

Same conditions as Phase 1: Linux Chromium 156.0.8078.79 SwiftShader, Babylon 9.32.0, 1366×768 native resolution, High cap with adaptive LOD, shadows OFF, identical nine IDs/grid/spacing/camera/lighting. Four counts, two alternating runs each of expanded9 and catalog9: 16 cases completed. Each case waits for readiness and 24 warm-up frames, then measures 32 static and 32 orbit intervals. No competing browser benchmark ran concurrently. The new BENCH_COHORTS selector preserves the existing default matrix and lets this isolated workflow exclude historical parent and Kenney cohorts without rewriting scripts or creating additional checkouts.

“Before” is the retained Phase 1 run, “after” is the Phase 2 rerun. Renderer code is unchanged. These are temporally separated short software samples, not interleaved A/B measurements of a renderer change. Their differences demonstrate variability, not an optimization effect. p95 values are medians of the two per-run p95 values, not a pooled percentile. No statistical improvement or regression claim is made.

| Buildings | Static FPS before → after | Orbit FPS before → after | Static p95 ms before → after | After p95 range (two runs) | Draws before / after | Scene triangles before / after |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 14.70 → 14.71 | 15.06 → 15.39 | 136.8 → 101.2 | 83.0–119.5 | 48 / 48 | 2,544 / 2,544 |
| 50 | 14.03 → 14.49 | 13.53 → 14.33 | 203.5 → 118.9 | 109.6–128.2 | 46 / 46 | 7,034 / 7,034 |
| 100 | 12.68 → 11.91 | 12.20 → 12.46 | 212.8 → 230.6 | 182.7–278.6 | 46 / 46 | 13,778 / 13,778 |
| 250 | 9.67 → 10.61 | 9.91 → 9.87 | 287.2 → 143.0 | 123.0–163.1 | 46 / 46 | 34,096 / 34,096 |

Geometry remains 6,279,376 bytes (~5.99 MiB), estimated decoded textures 43,231,915 bytes (~41.23 MiB), and scene meshes 222 at all four counts, before and after. At 250 buildings all 250 logical records remain, with 246 visible and four conservatively culled; visible records use Low LOD. The 50/100/250 fixed distant fixtures use Low LOD, so they do not establish close-up High/Ultra or shadows-on city performance. The 10-building fixture uses eight Low and two Medium models. The rerun includes the same-nine catalog comparison; raw summary retains all its values.

## Frame-time, loading and allocation investigation

Diagnostic profiles are separate from the matched FPS benchmark and include CPU/heap sampling overhead. Each count uses 48 static and 48 orbit intervals after warm-up.

| Buildings | Ready ms | Startup long tasks ms | Main-thread scene frame ms | Renderer query ms / samples | Heap growth during sampled segments MiB |
|---:|---:|---|---:|---:|---:|
| 10 | 2785 | 590 | 1.60 | 60.3 / 13 | 3.28 |
| 50 | 2348 | 270 | 1.91 | 70.5 / 13 | 2.88 |
| 100 | 2740 | 249 | 1.93 | 68.8 / 13 | 3.66 |
| 250 | 3497 | 262 | 2.64 | 90.3 / 12 | 4.38 |

Stationary scenes performed zero matrix-buffer uploads during measured segments. No >50 ms main-thread long task occurred in the measured static/orbit segments. CPU profiles are dominated by idle/program time, not the custom pool update loop. Engine timers indicate the rendering side is substantially slower than main-thread scene evaluation on SwiftShader. GPU timer results are asynchronous, limited samples and software-renderer measurements; they are not physical GPU measurements, and overlapping CPU/renderer times must not be added.

Initial loading does incur 249–590 ms main-thread long tasks in these diagnostic pages. This identifies startup work as a separate responsiveness issue; steady-segment CPU sampling does not attribute those startup tasks to a specific parser or shader function. Heap used at readiness ranges approximately 43–56 MiB across pages. Measured-segment heap growth is about 2.9–4.4 MiB including browser/test instrumentation; surviving-allocation sampling mostly points to Babylon/instrumentation routines. These short, unforced-GC samples do not establish a memory leak or total allocation volume. The browser regression suite separately checks that scene meshes/materials/textures are all disposed.

A 250-building half-resolution diagnostic increased static FPS from 10.33 to 19.17 in its profiled page; it is explicitly not part of the matched benchmark. Its delayed renderer queries averaged 72.8 ms versus 90.3 ms at native resolution. This supports a pixel/rendering-cost contribution, but does not isolate shaders, compositing, driver scheduling or tail-latency causes. Resolution reduction was rejected as a shipped optimization because it changes visual fidelity. No settings or renderer resolution changes are retained.

## Lazy loading and texture residency

The current pool imports the full monolithic GLB; lazy batch cloning is not streaming. A read-only `ImportMeshAsync` probe compared the full library with two named-root imports in fresh engines:

| Fresh import probe | Load ms | Geometry MiB | Texture estimate MiB | Meshes |
|---|---:|---:|---:|---:|
| all | 454.3 | 5.99 | 40.75 | 219 |
| steelMill | 314.6 | 2.18 | 40.50 | 25 |
| acidWorks | 232.5 | 0.22 | 32.50 | 23 |

These are cached/local loader probes, not paired network benchmarks or replacements enabled in the showroom. Selective import still downloads the entire 6,466,384-byte GLB. Steel Mill selection saves substantial geometry but only ~0.25 MiB of the probe's texture estimate because many maps are shared. Reagent Works saves more textures, but a scene containing all nine designs still needs the union of those resources. Direct-import counts differ from the renderer's batch meshes; they are not after-optimization scene metrics.

A production selective loader would need asynchronous template requests, bounded cache/eviction, cancellation of overlapping selections, correct shared-texture ownership and disposal, and verified LOD/count switching. Adding that lifecycle is larger than a minimal safe change and would not remove the full-nine fixture's rendering stalls. It is deferred rather than represented as an implemented memory optimization. No texture resizing, map substitution, GLB rewrite or new generated model is included. Texture and geometry sizes are API estimates; physical VRAM, driver/shader/framebuffer memory and real residency were not measured.

## Tests and evidence

- 15 focused Quaternius Node tests passed, zero failed/skipped.
- 43 Python archive/geometry/bake tests passed, zero failed.
- Corrected capture suite passed: 18 captures, nine positive top-down assertions and nine negative oblique checks.
- Four-count profiling, three loader probes and one resolution diagnostic completed.
- Matched benchmark completed all 16 cases without page errors or failed requests.
- All 14 existing showroom browser regression groups passed again, with zero browser errors, failed requests or HTTP failures. The known nine catalog-only warnings remain.
- All 20 manifest artifact hashes (GLB plus 19 maps) match; existing canonical mapping, footprint, High geometry/PBR and source-policy checks pass.

The known nine empty-concrete-map warnings belong to the original catalog comparison, not the Quaternius assets. No gameplay/economy/save/network test suite was invoked. No artifact rebuild was needed. Python used NumPy 2.3.5 and Pillow 13.0.0; the latter differs from the deterministic rebuild pin 12.3.0, so no rebuild reproducibility claim is made.

Compact results are committed in [stability-phase2-results.json](evidence/stability-phase2-results.json). Full logs, raw profiles, pinned browser distributions, gallery and PNGs are retained locally under `evidence/stability-phase2/` and intentionally excluded from Git to avoid committing duplicate distributions and large captures. The raw directory is not remotely published. The matching Phase 1 JSON is copied into it for comparison.

## Reproduction

Run from this checkout. Dependencies already present: Node 24.22.1, Python, NumPy, Pillow, Playwright Core and Chromium. Start a local server in a separate command session:

```sh
python3 -m http.server 8025 --bind 127.0.0.1 --directory /workspace/Map-Game-phase1-0533adf-20261111
```

The tracked preload helper `tests/helpers/quaternius-browser-isolation.cjs` verifies the exact cached Babylon 9.32.0 distribution hashes, serves the two scripts locally, blocks service workers, and aborts all other external browser requests. Set BABYLON_VENDOR_DIR to the prepared cache when using another results folder. It never relaxes TLS verification or contacts Supabase. Cache sources, fetched with verified TLS during Phase 1:

- `https://cdn.jsdelivr.net/npm/babylonjs@9.32.0/babylon.js`
- `https://cdn.jsdelivr.net/npm/babylonjs-loaders@9.32.0/babylonjs.loaders.min.js`

```sh
node --test tests/quaternius-*.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s graphics-prototype/quaternius-prototypes/tools -p 'test_*.py'
export BASE_URL=http://127.0.0.1:8025
export BABYLON_VENDOR_DIR=graphics-prototype/quaternius-prototypes/evidence/stability-phase2/vendor
export OUT_DIR=graphics-prototype/quaternius-prototypes/evidence/stability-phase2/review-new
node --require ./tests/helpers/quaternius-browser-isolation.cjs tests/quaternius-phase2-review.cjs
export OUT_DIR=graphics-prototype/quaternius-prototypes/evidence/stability-phase2/browser-new
node --require ./tests/helpers/quaternius-browser-isolation.cjs tests/quaternius-browser.cjs
export OUT_DIR=graphics-prototype/quaternius-prototypes/evidence/stability-phase2/profile-new
FRAME_SAMPLES=48 node --require ./tests/helpers/quaternius-browser-isolation.cjs tests/quaternius-stability-profile.cjs
export OUT_DIR=graphics-prototype/quaternius-prototypes/evidence/stability-phase2/benchmark-new
BENCH_COHORTS=expanded9,catalog9 BENCH_RUNS=2 FRAME_SAMPLES=32 CHECKPOINT_COMMIT=0533adfe03225cbf9d3eeb4dc57b29a86d343d10 node --require ./tests/helpers/quaternius-browser-isolation.cjs tests/quaternius-phase2-performance.cjs
```

Do not run browser benchmarks concurrently. Full phase-2-matrix defaults still require their documented historical parent server; the selected-cohort command above requires only this isolated checkout.

## Remaining blockers and next proposal

1. Native target-hardware validation is outstanding. **Lenovo performance is not validated.** Do not approve gameplay integration from SwiftShader results.
2. Large static/orbit frame tails remain unexplained at driver/shader/compositor granularity. Collect a controlled native-GPU trace before choosing a rendering optimization.
3. Full-library loading has a startup pause and fixed memory floor. A separately reviewed selective-loader design could improve single-design inspection, but must preserve cache lifetime, images and switching behavior.
4. No new machinery or residential visual work was started. Approved designs, textures and IDs remain intact.

Stop after Phase 2. Further implementation requires user approval.
