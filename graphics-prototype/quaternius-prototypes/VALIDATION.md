# Validation — Quaternius review prototypes

**Checkpoint complete: source audit, three isolated pilots, screenshots and tests. Performance release gate NOT passed. Gameplay integration is disabled. This is not a final 24-building release.**

2026-11-07; branch `feature/0.4.2-quaternius-replacements`. No push, merge, deployment, live Supabase access or player-data use. All gameplay, catalog, economy, save, terrain, forest, road, authentication, multiplayer and protected candidate files remain byte-identical to the inherited baseline. Existing Kenney assets and renderer are preserved for explicit comparison.

## Actual tests

| Command / check | Result |
|---|---|
| `node --test tests/*.test.cjs` | 163 passed, 0 failed, 0 skipped; solver, research, migrations, placement, saves, forest continuity, UI and new canonical/artifact tests |
| `python .../tools/test_audit.py` | 19 passed |
| `python .../tools/test_downtown.py` | 20 passed; accessor safety, transforms/winding, cycles, missing/external dependencies, unsupported animation, primitive bounds, model/texture hashes, normalized normal maps |
| `node tests/quaternius-browser.cjs` | 11 check groups passed, 0 uncaught errors / failed HTTP requests; 9 documented **baseline-only** texture warnings |
| `node tests/premium-fixes-browser.cjs` | 7 gameplay groups passed; guest launch, three sizes, drag/zoom, native placement/one charge, concurrent tabs, reload, genuine renderer crash recovery, terrain loading |
| `node tests/graphics-prototype-sp-browser.cjs` | 5 groups passed; Singleplayer/territory entry, preference/unknown-field preservation, unchanged balance bytes, Basic allocating no prototype meshes, World Map return |
| Two complete offline asset rebuilds | All 19 output files byte-identical to the committed artifacts |
| JS syntax checks + `git diff --check` | Passed |

These are 163 Node tests, 39 Python tests and 23 browser **check groups**, not an invented count of browser test cases. Other historical browser scripts were not all rerun; the selected suites cover this isolated renderer and relevant main-game regressions. Raw logs/results: [Node](evidence/node-results.txt), [showroom](evidence/browser-results.json), [gameplay](evidence/gameplay-regression.json), [Singleplayer](evidence/singleplayer-regression.json), [rebuild hashes](evidence/rebuild-results.json).

Browser tests use actual local Chromium/WebGL and local GLB/PNG files. The managed test environment serves hash-verified cached official Babylon 9.32 and Supabase SDK files through test-only interception. This is **not** a live CDN, Supabase, deployment or Lenovo verification. TLS verification was not disabled. SDK endpoints were blocked by the test harness; Singleplayer tests made no backend transactions.

## Close-ups and comparison

All new images show the **isolated showroom**, not Central World or a deployed game. The three original/Quaternius pairs use the same 1920×1080 viewport, canonical ID, camera alpha/beta/radius/target, ground, lighting and optional real-time shadow configuration. Camera reset clears pointer inertia; the browser test asserts matching camera values. Original industrial machinery is simple authored geometry, not a finished detailed furnace/robot asset.

| Factory | Original catalog renderer | Quaternius pilot | Close inspection |
|---|---|---|---|
| Steel Mill | [Before](evidence/steelMill-before.png) | [After](evidence/steelMill-after.png) | [Close-up](evidence/steelMill-close.png) |
| Electronics Plant | [Before](evidence/precisionElectronicsWorks-before.png) | [After](evidence/precisionElectronicsWorks-after.png) | [Close-up](evidence/precisionElectronicsWorks-close.png) |
| Machinery Works | [Before](evidence/machineWorks-before.png) | [After](evidence/machineWorks-after.png) | [Close-up](evidence/machineWorks-close.png) |

The preserved [Kenney showroom](../modular-factories/index.html) remains available for visual comparison. It is not loaded by or silently substituted into the new pilots. The three-way performance fixture below uses that separate scene explicitly.

**Pre-existing asset issue:** the tracked `assets/textures/buildings/concrete_01/{albedo,normal,roughness}.webp` files are zero bytes in baseline commit `9b8e552`, too. Original-renderer comparisons produce nine decode/fallback warnings; HTTP status is 200, not a missing-path 404. They are recorded, not hidden or repaired using unrelated textures. New Quaternius variants emit no such warnings. Because the current renderer uses fallback colors here, it is a valid **actual branch** baseline but not an equal-fidelity texture comparison. Approved existing textures were not replaced.

## Matched performance

[Raw measurements and ranges](evidence/performance.json). 24 cases = 4 counts × 3 sources × 2 alternating runs; fresh page for each case. Same 1366×768 viewport, three-ID round-robin layout, 160-unit grid, High cap with adaptive LOD, camera, lighting, approved concrete/asphalt ground and contact shadows. Optional real-time shadows are OFF for all sources. Ready time includes assets/scene readiness, before warm-up; each case then warms 24 frames and measures 24 static and 24 gentle-orbit intervals. No concurrent browser/CPU benchmark ran.

SwiftShader is software WebGL. These short two-run samples show significant variability, especially startup and 250-building tails. They are exploratory comparisons, not a hardware certification or statistically tight performance bound. FPS is derived from mean measured frame interval; table values are medians of the two runs. Full per-run ranges and orbit measurements are retained.

| Count | Source | FPS median [range] | p95 interval ms | Ready ms median [range] | Static long tasks / max ms | Draws |
|---:|---|---:|---:|---:|---:|---:|
| 10 | Current game | 10.44 [10.39–10.48] | 195.8 | 2052 [1482–2621] | 0 / 0 | 85 |
| 10 | Kenney comparison | 7.91 [7.67–8.15] | 295.5 | 2498 [2382–2613] | 0 / 0 | 10 |
| 10 | Quaternius pilot | 6.38 [5.68–7.08] | 387.3 | 2575 [2574–2577] | 0 / 0 | 23 |
| 50 | Current game | 9.07 [8.37–9.77] | 179.7 | 1911 [1872–1950] | 0 / 0 | 400 |
| 50 | Kenney comparison | 5.63 [5.44–5.82] | 344.8 | 4028 [3885–4172] | 0 / 0 | 9 |
| 50 | Quaternius pilot | 7.50 [7.37–7.63] | 288.1 | 9776 [2750–16803] | 0 / 0 | 18 |
| 100 | Current game | 7.24 [6.83–7.66] | 201.6 | 3183 [2207–4159] | 0 / 0 | 790 |
| 100 | Kenney comparison | 3.65 [3.28–4.02] | 577.3 | 4151 [4136–4165] | 1 / 215 | 9 |
| 100 | Quaternius pilot | 5.52 [4.75–6.29] | 341.9 | 4496 [4123–4869] | 3 / 242 | 18 |
| 250 | Current game | 4.54 [3.13–5.95] | 639.8 | 5007 [4329–5684] | 6 / 544 | 1958 |
| 250 | Kenney comparison | 1.57 [1.33–1.81] | 1749.6 | 9188 [6657–11718] | 6 / 252 | 9 |
| 250 | Quaternius pilot | 3.44 [3.01–3.87] | 510.8 | 7647 [7560–7734] | 8 / 98 | 18 |

Static long-task counts aggregate the two measured segments; observer data through startup **and warm-up** is separately labeled in the raw report. It is not a pure startup-only task list.

| Count | Current orbit FPS / p95 ms | Kenney orbit FPS / p95 ms | Quaternius orbit FPS / p95 ms |
|---:|---:|---:|---:|
| 10 | 9.63 / 232.2 | 8.35 / 401.2 | 7.38 / 269.4 |
| 50 | 8.90 / 139.7 | 5.57 / 339.3 | 6.55 / 324.4 |
| 100 | 6.91 / 201.5 | 3.58 / 542.8 | 5.80 / 340.3 |
| 250 | 5.05 / 364.8 | 2.04 / 1307.6 | 3.38 / 604.2 |

The Quaternius 250-building orbit segments recorded 9 long tasks combined (maximum 228 ms); current-game orbit segments recorded 4 (maximum 276 ms). Quaternius startup-through-warm-up reached a 2,127 ms task in the slow 50-building run, with ready time 16.80 s versus 2.75 s in its paired run. The report preserves this outlier. Lower draw calls alone are not a performance pass.

At 250 buildings the pilot has 6,672 scene mesh objects (6,668 instances), with all 250 records at Low LOD and 158,758 configured triangles. The library shares 27 material variants and 15 texture files. Decoded RGBA+mipmap texture estimate is 41,943,035 bytes (~40 MiB), **not measured GPU VRAM**; geometry, driver and other scene resources add memory. All LOD instance objects are currently retained even when disabled.

**Verdict:** the pilot's median FPS is below the current renderer at all four counts. It improves on the preserved Kenney scene at 50/100/250, but that does not satisfy the actual gameplay baseline. Static p95 improves at 250 while orbit tails and startup still regress. No 30/60 FPS claim or completed performance gate is made.

## Remaining work / approval gates

- Review the three close-ups before broadening the visual style. Standard Downtown supplies real surface maps, but the industrial machinery is still low-detail and the paid fake-interior/wear shaders are absent. Detailed furnace/rolling-line machinery, pipe fittings/valves, robotic cells and licensed industrial wear PBR sets would improve fidelity. Resource icons are never stretched onto surfaces.
- Profile the material/filtering/fill cost versus transform/instance traversal, initial High-LOD creation and retained disabled LOD objects. These are concrete investigation targets, **not a proven attribution** of the whole FPS loss. A camera-aware initial LOD, fewer distant material variants, cached far imagery or thin-instance batching may help; no appearance-reducing architecture change was silently introduced to claim a pass.
- Repeat longer benchmarks on Lenovo hardware, including GPU/CPU traces, startup, camera motion and memory. Software-WebGL numbers alone do not establish the hardware outcome.
- 17 additional non-residential designs remain planned. Four residential designs await the additional Quaternius house pack. The 24-design target and all canonical IDs remain in `design-plan.json`; no design is marked final.
- The older 2019 textured OBJ material bindings still need explicit review before any future conversion. This does not block or contaminate the Downtown-only pilots.
- Resolve performance and visual gates, then obtain separate gameplay-integration permission. Existing Kenney comparisons remain untouched. No multiplayer, economy, save or gameplay changes are part of this checkpoint.
