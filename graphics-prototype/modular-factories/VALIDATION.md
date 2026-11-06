# Validation and integration gate

**Outcome: functional graphics prototypes ready for visual review; not approved for live 3D integration.** Cloud software-WebGL performance is below target and slower than the simpler original renderer. The existing Basic game retains its measured performance. No push, deployment, merge, Supabase access or multiplayer change was performed.

## Source and assets

Branch: `feature/0.4.2-modular-factories`. Baseline: validated Premium-fix commit `072e07fbebe9830d8c41c74d68cdb5b5e455d347`, descended from `f21fb98`. The prior Phase A audit is commit `a9d0b4bf6454ca9058881a479be13c69f7199b3b`.

Three supplied Kenney archives were fingerprinted, inspected without executing their HTML/URL files and found to contain CC0 notices. All 220 GLBs were audited; only selected components, palettes and licenses are retained. `assemblies.json`, `manifest.json` and `asset-audit.json` provide the mappings, transforms, bounds, triangles, materials, image dependencies and provenance. No 2D resource artwork was used as building textures. Existing terrain files, material catalogs and Credits artwork were not edited.

| Model | Canonical ID | Logical footprint | Low / Medium / High triangles (static) |
|---|---|---|---|
| Steel Mill | `steelMill` | 118×92 | 788 / 2,171 / 4,590 |
| Electronics Plant | `precisionElectronicsWorks` | 80×66 | 2,291 / 3,713 / 7,354 |
| Machinery Works | `machineWorks` | 64×54 | 784 / 1,576 / 3,034 |
| Optional suburban house | `smallHouse` | 18×22 | 594 / 810 / 1,174 |

The machinery piston is an additional separate source asset with three preserved animation clips; it is not included in static triangle totals. Ultra loops only `toggle`, capped at eight nearby active props and disabled under reduced motion. High close-up geometry is unchanged by simplification. Low/Medium reduce fine geometry; island pruning is disabled and UV error has a stronger weight. Targets may be missed when topology/UV constraints prevent further reduction. Visual review also caught transparency sorting artifacts in the placement ghost: the final preview uses Medium geometry and a preview-owned depth-prepass material, disposed on cancellation. The solid fixture also uses Medium detail. These checks go beyond bounding-box tests.

## Automated and browser checks

[Machine-readable summary](evidence/test-summary.json).

- **157/157 Node tests passed**, no failures/skips: existing numerical solver, exact ledger, migration, progression, catalog, terrain/forest and UI tests plus three new canonical mapping/rotated-bounds/LOD-hysteresis tests.
- **45/45 Python tests passed:** 14 new archive/GLB/provenance/reproducibility/footprint/animation tests, 16 existing graphics-pack tests, 15 existing resource ZIP-audit tests.
- **15 browser suites passed:** modular-factories, modular-placement, premium-fixes, premium-ui, Modern Frontier, visual-ui, resource-icons, graphics-prototype-sp, industrial-042a, phase-b, phase-c1, economy, forest and environment, plus graphics-prototype.
- The new model suite verified real loaded hierarchy bounds, all four high-detail views, quality changes, separate animation, reduced motion, repeated zooms across LOD thresholds, stable coordinates, no additional asset requests/mesh creation during camera movement, repeated rebuild cleanup, valid/collision/water/rotation/cancel/blur placement, three viewports and scene disposal. A null terrain hit clears the preview and analysis rather than reusing a stale valid site. A final interaction test also caught and fixed a workshop-only issue where switching model selection hid placed visuals but retained their collision rows. Both now remain visible/consistent; the regression test verifies this. No Singleplayer records were involved.
- The actual main-game test entered guest Singleplayer, bought/placed one canonical house, verified smooth cursor-follow and green/red outline drawing against real overlap checks, reopened placement after the existing automatic cancellation, then cancelled safely. Existing premium-fixes tests additionally exercised outside releases, drag-without-purchase, actual renderer crash recovery, denied second tabs, lock retry and save preservation.
- Premium interfaces were tested at **1366×768, 1440×900 and 1920×1080**. New workshop layouts were also checked at those sizes. Forest/environment tests exercised actual terrain and multiple biomes. Saves, materials, research, ownership, authentication and server files were unchanged.
- The final new showroom and native-placement runs recorded **zero JavaScript/console errors, failed requests or HTTP failures**. The 16-case city benchmark and main-game timing run also recorded zero such errors. Expected deliberate crash tests are identified in their own reports.

One new native test initially expected placement to stay open after purchase. Existing behavior correctly cancels it. The test was corrected to reopen construction before checking the red collision outline; final rerun passed, with no purchase-system rewrite. Exploratory benchmark attempts also exposed a shader-readiness Promise serialization issue and a relative asset-base mistake in the new original-renderer comparison. Both were corrected before the clean measurements below. Failed exploratory runs are not used as passing release evidence.

Browser environment: Linux Chromium with SwiftShader and the existing verified npm Babylon/loader test cache (9.32.0); verified SDK cache for main-game regressions; project Supabase HTTPS blocked. These are genuine local browser tests, **not** live CDN, production, authenticated multiplayer, deployment or Lenovo hardware validation. No TLS verification was disabled.

## Main-game performance versus exact `072e07f`

[Raw main-game timing](evidence/basic-performance.json): alternating order, three fresh contexts per variant, 1440×900, same Basic territory/camera/preferences, four view states.

- Median startup: **1,302 → 1,317 ms** (small sample, not a claimed speedup).
- Median FPS by view: Closed **60.00 → 58.54**, Shop **59.51 → 59.51**, Settings **57.15 → 60.00**, Achievements **59.51 → 57.60**. These small variations do not establish a significant source-caused regression or speedup in this limited sample.
- Median p95 intervals: **16.7–16.8 ms** before and after.
- Sampled idle-view long tasks: **two before / one after** across these windows.
- No new terrain/forest/economy work is added to rendering loops. The Basic change updates a ghost point on input and colors its outline; validation remains throttled at the existing 80 ms budget and is recomputed authoritatively before a purchase. Border color can consequently lag a fast cursor by up to that validation budget.

[Preview timing](evidence/native-placement-results.json): 13 captured pointer-event-to-first-ghost-draw samples had a **1.90 ms median / 5.10 ms max** in Basic. 6 pointer-event-to-next-scene-render samples in the separate 3D workshop had a **3.35 ms median / 93.80 ms max**. These are observed callback/drawing times, not input-to-photon measurements or Lenovo guarantees.

## City rendering: original versus modular

[Raw comparison](evidence/city-performance.json): two fresh contexts per variant and size, alternating order, 1366×768, identical mixed canonical IDs, spacing, camera path, lighting, terrain, contact shadows and High presentation cap. All positions matched exactly. High is a cap; distance LOD automatically selected Low for most large-city objects. The original renderer did not preload modular assets. Startup includes each variant's actual asset loading and readiness. Each scripted camera path sampled 24 frame intervals; tail estimates are coarse and host variability is substantial.

| Factories | Original → modular median FPS | Original → modular median p95 (ms) | Original → modular startup (ms) | Original → modular draw calls |
|---|---|---|---|---|
| 10 | 11.80 → 6.81 | 100.05 → 224.90 | 1,960 → 3,198 | 85 → 10–12 |
| 50 | 9.83 → 5.44 | 125.0 → 266.65 | 2,178 → 4,113 | 400–403 → 9 |
| 100 | 8.25 → 4.25 | 141.65 → 250.05 | 2,775 → 4,825 | 790–799 → 9 |
| 250 | 6.21 → 2.47 | 175.0 → 424.95 | 4,302 → 7,734 | 1,958–1,988 → 9 |

This is a **3D performance regression versus the much simpler original art** in this software renderer. Neither variant meets 30/60 FPS targets here. Do not use the favorable draw-call or texture numbers to claim smooth city rendering. The new models are not enabled in gameplay.

Representative Babylon active-index triangle estimates were about **2,278 → 16.6–18.0K**, **10.8K → 65.0K**, **21.5–21.7K → 127.7–128.1K**, and **53.4–54.2K → 315.0–321.2K** for the four sizes. Scene mesh object counts were **96 → 150**, **454 → 736**, **906 → 1,470**, and **2,256 → 3,670**. Modular instancing reduces draws, but the retained LOD instances, transforms, additional geometry and shading still cost time. Babylon's active counters are renderer estimates, not a hardware GPU pipeline query.

Loaded-texture estimates were about **25.5 MiB original / 11.4 MiB modular**, constant across counts in these fresh contexts. These estimates assume RGBA storage plus mipmaps; exact VRAM, driver allocations and geometry GPU bytes were unavailable. Imported asset-container overhead remains until pool disposal. Main code/palette templates are shared; per-building materials/textures are not rebuilt during camera movements.

Every city path still produced roughly 24–26 >50 ms long tasks in the software renderer. Native five-step camera-gesture wall times (including 100 ms settling and Playwright dispatch) increased from roughly **1.76 → 3.37 s**, **2.10 → 3.31 s**, **2.42 → 4.57 s**, and **3.18 → 7.56 s**. Cameras changed in every test, but these numbers do **not** demonstrate responsive large-city interaction. Full frame arrays, long tasks, counters, gesture times and positions are retained in the JSON.

### Measured optimization decisions

- Initial batching/caching reduced draw calls but kept full source shells and PBR in distant LODs. The controlled 50-factory [material experiment](evidence/material-profile.json) held geometry/positions constant: median **3.62 FPS full PBR → 4.60 FPS** using shared lower-cost distant lighting, with 9 draws in either case. High-detail close-ups retain PBR.
- That profile still rendered approximately 120K triangles at 50 factories. Build-time, attribute-aware Meshoptimizer simplification then reduced it to about **65.0K**, while keeping original vertex coordinates/UVs and full High geometry. The final 50-factory median was **5.44 FPS**. [Before-geometry-reduction measurements](evidence/before-geometry-reduction.json) are retained separately; these experiments are small/noisy and not a statistical hardware certification.
- No economy, terrain sampling, saved coordinates, number of buildings, camera path or benchmark work was reduced to achieve the comparison. Rendering-only detail reduction is explicit and measured.

## Remaining gates and limitations

1. Review the three high-detail close-ups and house preview. Kenney's faceted forms and palette coloring remain visible despite added architecture/materials. Additional detailed industrial assets, UV layouts and PBR maps are needed for the requested higher fidelity; see README.
2. Test actual Lenovo/GPU performance at all four sizes, all quality caps and repeated LOD crossings. Test real target-browser memory/disposal and drag/preview behavior. Consider cheaper authored far shells/impostors or thin-instance batching after hardware profiling; do not replace the live renderer on current evidence.
3. Models/3D ghosts remain isolated. Basic uses its existing 2D footprints; Regular is still paused. No research locks were relaxed and no new factory became purchasable through this task.
4. No new live roads, hydrology, economy, resource icons, multiplayer behavior or cloud saves were implemented. Cranes/robot poses/conveyors are static; only the explicitly separate piston is animated. Real GPU timings/VRAM and live-CDN/deployment behavior were not certified.
5. Before any future deployment, review model/texture budgets, asset cache-versioning, fallbacks and target-browser results. This branch is local only; transferring or pushing it requires the user's authorization.

## Changed files

- Existing live source: `basic_world.js` (cursor-follow and outline color), `index.html` (cache tags), and `modern-frontier/ui.js` (correct the now-outdated missing-pack copy and link the review showroom; no preference/storage changes).
- New isolated graphics code/data: `graphics-prototype/modular-factories/index.html`, `showroom.css`, `showroom.js`, `renderer.js`, `assemblies.json`, `manifest.json`, `asset-audit.json`.
- Licensed source: selected files under `source/factory/`, `source/industrial/`, `source/suburban/`; preassembled GLBs under `generated/`.
- Build/security tools: `tools/packlib.py`, `import_packs.py`, `build.py`, `detailing.py`, `simplify.cjs`, pinned `package.json`/`package-lock.json`, tool license and ignore rules.
- Tests: `tests/modular-factories.test.cjs`, `tests/modular-factories-browser.cjs`, `tests/modular-factories-performance.cjs`, `tests/modular-placement-browser.cjs`.
- Documentation/evidence: this file, README, historical AUDIT update, screenshots and synthetic result JSON in `evidence/`.

No edits to `economy.js`, `economy_model.js`, catalogs/material IDs, recipes, research/progression definitions, authentication, multiplayer, roads, forests, world seed/geography, backend/migrations or protected release-candidate files.

## Screenshots

[Steel close-up](evidence/steelMill-close.png) · [Electronics close-up](evidence/precisionElectronicsWorks-close.png) · [Machinery close-up](evidence/machineWorks-close.png) · [House](evidence/smallHouse-close.png).

[Workshop valid](evidence/placement-valid.png) · [Workshop collision](evidence/placement-collision.png) · [Actual Basic valid outline](evidence/native-valid-preview.png) · [Actual Basic collision outline](evidence/native-overlap-preview.png).
