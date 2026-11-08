# Quaternius Expansion Phase 2

Base: `5b51d3e07b1779e964040179ac797234fef77d25`; branch `feature/0.4.2-quaternius-replacements`. **Nine showroom prototypes. No gameplay activation, economy/save/authentication/multiplayer/Supabase changes, 0.4.3 edits, push, merge or deployment. Lenovo performance is not yet tested.**

## Catalog audit and scope

| Requested study | Actual existing ID / canonical name | Footprint | Existing availability |
|---|---|---:|---|
| Chemical Refinery | `acidWorks` — Industrial Reagent Works | 56 × 48 | playable |
| Glassworks | `glassWorks` — Glass Works | 56 × 48 | playable |
| Semiconductor Factory | `semiconductorFab` — Semiconductor Fab | 56 × 48 | playable |
| Vehicle Assembly Plant | `utilityVehicleWorks` — Utility Vehicle Works | 64 × 54 | futureLocked |
| Warehouse | `warehouse` — Warehouse | 92 × 62 | existing starter/infrastructure |
| Battery Factory | `batteryWorks` — Battery Works | 64 × 54 | futureLocked |

There is no exact Chemical Refinery or generic Vehicle Assembly Plant definition. `acidWorks` is the existing chemical-processing contract selected for the refinery-style visual; `utilityVehicleWorks` is the existing general utility-vehicle assembly contract. These mappings are explicit, not new or renamed economy entries. Vehicle and battery contracts remain future-locked in gameplay. Warehouse is existing infrastructure. The laboratory is permitted to preview locked content without unlocking it.

## Existing factory improvements

- Machinery Works: three doors now center at X −20 / −6 / 8, fully inside the actual native facade. Added an original CNC enclosure with glazing/control panel, a horizontal lathe, portal press, guards and shutter details. Actual generated vertex geometry is tested for alignment and equipment presence.
- Electronics Plant: original T-shaped props became articulated, static robot arms. The detailed native metal/glass shell is preserved.
- Steel Mill: its High geometry/material data remains exactly unchanged. Its brick hall, twin stacks and gantry remain distinct from the smaller machining workshop and clean electronics line.
- Detailed Quaternius shell/window/roof geometry and PBR semantics in the original three remain unchanged; only clearly identified original process equipment is revised. All **19 approved texture files** remain byte-identical to 5b51d3e. No icons are stretched onto surfaces, and no Kenney models are used.

## New identities and LOD budgets

Chemical processing uses a compact native control block, twin tanks, tall reactor column and pipe rack. Glass Works adds a warm kiln, stack and glazed sheet racks. Semiconductor Fab has a native clean-facade shell, white cool-roof/vestibule and four rooftop air-handling banks. Utility Vehicle Works has an assembly hall, robot stations and one **static display vehicle**, not a gameplay unit. Warehouse uses four aligned loading docks and rear pallet staging. Battery Works has cell trays, cooling vessels, power cabinets and green process trim.

| ID | Low triangles | Medium triangles | High triangles |
|---|---:|---:|---:|
| `steelMill` | 218 | 742 | 31,716 |
| `precisionElectronicsWorks` | 140 | 876 | 8,384 |
| `machineWorks` | 142 | 714 | 16,498 |
| `acidWorks` | 142 | 702 | 2,344 |
| `glassWorks` | 106 | 562 | 6,848 |
| `semiconductorFab` | 94 | 518 | 2,852 |
| `utilityVehicleWorks` | 130 | 802 | 6,166 |
| `warehouse` | 166 | 622 | 4,772 |
| `batteryWorks` | 94 | 918 | 4,028 |

The architecture is Quaternius Downtown Standard; dedicated machinery is original geometry because the supplied pack does not provide those process assets. These remain stylized browser prototypes, not finished photorealistic industrial models. Roof/wall/body modules retain native uniform scale. Warehouse rear pallets and display-vehicle wheel placement were corrected after visual inspection and recaptured. Those fixes affect High/Medium original props only; measured new-design scenes used Low LODs and the geometry counts/render workload did not change.

## Performance safety checkpoints

The thin-instance/material pools and cached distant facades remain. Batch meshes are now initialized **only when a design is first used**, rather than cloning all nine LOD hierarchies into every scene. The source GLB still contains all nine models: this is lazy scene-batch creation, not asset/network streaming. Source geometry memory and initial parsing therefore still grow with the library.

Candidate screening used 250 buildings, replacing only the Machinery Works slot in the same three-type layout. Stop policy, declared before the screen: >20% loss in combined static/orbit FPS; any failed first screen is repeated with a paired reference before rejection. Frame tails were recorded separately and are not asserted regression-free.

| Candidate | FPS ratio to reference | Result |
|---|---:|---|
| `acidWorks` | 1.040× | Passed |
| `glassWorks` | 1.031× | Passed |
| `semiconductorFab` | 1.021× | Passed |
| `utilityVehicleWorks` | 1.079× | Passed |
| `warehouse` | 0.889× | Passed |
| `batteryWorks` | 0.999× | Passed |

Warehouse was the slowest individual screen, about 11% below reference; its larger facade/dock footprint and variable tails remain a hardware review priority. No candidate crossed the stop threshold. Raw [screening results](evidence/phase2/gate-performance.json).

### Full matched matrix

[32 actual cases](evidence/phase2/matrix-performance.json): 10/50/100/250 buildings, two alternating runs, 24 warm-up frames and 32 static + 32 orbit intervals, 1366×768 Chromium SwiftShader, native resolution, High cap/adaptive LOD. Same grid, spacing, camera and lighting; optional real-time shadows OFF. No other browser/CPU benchmark ran concurrently. This is not Lenovo or live deployment validation.

Four cohorts distinguish content changes from rendering changes: immutable 5b51d3e three-type mix; refined same three IDs; expanded nine-type mix; catalog rendering with the **same nine IDs**. Different mixes have different geometry/coverage, so the nine-mix result is not a claim of doing identical geometry work to the three-mix. Historical FPS from previous turns is not mixed into the new measurements.

| Count | Parent 3 FPS | Refined 3 FPS | Expanded 9 FPS [range] | Catalog 9 FPS | Expanded orbit FPS | Expanded p95 ms | Draws / meshes | Submitted scene triangles |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10.75 | 9.66 | 11.15 [10.83–11.47] | 11.09 | 11.60 | 204.7 | 48 / 222 | 2,544 |
| 50 | 9.01 | 8.51 | 10.11 [9.51–10.71] | 9.81 | 10.76 | 187.7 | 46 / 222 | 7,034 |
| 100 | 8.59 | 8.42 | 9.40 [9.31–9.50] | 8.60 | 9.26 | 158.3 | 46 / 222 | 13,778 |
| 250 | 5.87 | 6.78 | 6.83 [6.70–6.96] | 6.95 | 7.82 | 286.2 | 46 / 222 | 34,096 |

**Tradeoffs:** nine-design static FPS is about even with the catalog at 250 (6.83 vs 6.95), with better orbit FPS (7.82 vs 6.87), but worse static p95 (286 vs 163 ms). The refined original-three scene showed worse 10/50-building static tails than the parent, despite no >20% combined FPS loss; those tails are not declared fixed. Short two-run software samples remain noisy. GPU limitations and target-hardware testing remain blockers to gameplay activation or unrestricted further expansion.

The expanded scene uses 48 draws at 10 buildings and 46 at larger counts, with a bounded **222 scene meshes**, not per-building hierarchies. At 250 it retains all 250 logical records; 246 are conservatively visible at the fixed camera. Culling does not delete buildings or saves. Steady expanded segments reported no >50 ms main-thread long tasks in these samples; GPU/compositor frame tails are still large. Startup-through-warm-up tasks, orbit tails and all variability are retained in the JSON.

Memory estimates for the fully initialized nine-design scene: **6,279,376 bytes (~5.99 MiB)** unique vertex/index data; **43,231,915 bytes (~41.23 MiB)** loaded texture estimate including showroom surfaces; model maps themselves remain ~40.5 MiB. Model matrix capacity is 86,016 bytes at 250 plus 16,000 contact-matrix bytes. Driver, shader, framebuffer and JS allocations are additional, so this is not measured physical VRAM. New geometry memory is higher than the three-design parent (~3.81 MiB); textures did not increase. The GLB is 6,466,384 bytes. Larger catalog expansion should introduce asset streaming before assuming memory stays constant.

## Presets and Lenovo procedure

The live FPS/draw display refreshes about once per second. Low and Medium use cached surfaces and simpler equipment; **High keeps native detailed Quaternius geometry/PBR close up**. Ultra uses the same High assets but extends detail-transition distances by 50%, with hysteresis. It is not a fake fourth geometry LOD or unsupported animation mode. These controls are showroom-only and do not write the main game's preferences.

Follow [WINDOWS_PHASE2.md](WINDOWS_PHASE2.md). It covers the unpushed incremental bundle, prerequisite/hash verification, detached test worktree, local-only Node server, browser GPU checks, four presets, warm-up, 10/50/100/250 counts and copying actual metrics. Codex has not run those Lenovo steps.

## Verified tests and images

- **172 Node tests**, 0 failed/skipped: full repository suite, canonical-ID mapping, native geometry/PBR and all 19 texture hashes, nine footprints/LOD bounds, actual bay alignment, CNC/lathe geometry, pallet/wheel placement and existing numerical/save/research tests. [Log](evidence/phase2/node-results.txt).
- **43 Python tests**, 0 failed: archive/geometry/bake validation and deterministic projection. [Log](evidence/phase2/python-results.txt).
- **14 showroom browser check groups** at 1366×768 / 1440×900 / 1920×1080: nine High assets, four presets including a measured High-vs-Ultra LOD transition, repeated navigation, lazy-cache bounds, pan/zoom, culling/restore, stationary buffers and zero mesh/material/texture objects after full disposal. [Results](evidence/phase2/browser/browser-results.json).
- **12 existing Singleplayer browser groups**: guest entry, purchasing once, placement/cancel, duplicate tabs, save/reload, crash recovery, unchanged preferences/unknown fields, Basic fallback, territory and World Map navigation. [Gameplay](evidence/phase2/gameplay-regression.json), [graphics/navigation](evidence/phase2/singleplayer-regression.json).
- **18 actual PNG captures**, every design at High, close-up and overhead; 0 new warnings/errors/loading failures. [Metadata](evidence/phase2/review/review-results.json).
- Two rebuilds reproduce the same **23 files byte-for-byte**. [Hashes](evidence/phase2/rebuild-results.json).

A stale local HTTP server initially returned an empty response; tests were rerun successfully using a quiet read-only server. A test's fixed 250 ms LOD wait was also replaced with actual camera/LOD-state synchronization to accommodate slow SwiftShader frames. Neither is hidden as a successful first run. The historical catalog comparison still logs the known zero-byte concrete texture fallback warnings; Quaternius captures are clean. Managed browser tests use verified cached Babylon 9.32/SDK distributions and block Supabase: they do not prove live CDN, Supabase or deployment access. Not every historical browser script was rerun.

## PNG index and remaining limitations

All PNGs show the isolated showroom, not Central World or deployed gameplay. High close-ups/overheads are actual rendered screenshots, not generated illustrations. The attached response supplies the PNGs directly; files also remain here:

| ID | Close-up | Overhead |
|---|---|---|
| `steelMill` | [PNG](evidence/phase2/review/steelMill-close.png) | [PNG](evidence/phase2/review/steelMill-overhead.png) |
| `precisionElectronicsWorks` | [PNG](evidence/phase2/review/precisionElectronicsWorks-close.png) | [PNG](evidence/phase2/review/precisionElectronicsWorks-overhead.png) |
| `machineWorks` | [PNG](evidence/phase2/review/machineWorks-close.png) | [PNG](evidence/phase2/review/machineWorks-overhead.png) |
| `acidWorks` | [PNG](evidence/phase2/review/acidWorks-close.png) | [PNG](evidence/phase2/review/acidWorks-overhead.png) |
| `glassWorks` | [PNG](evidence/phase2/review/glassWorks-close.png) | [PNG](evidence/phase2/review/glassWorks-overhead.png) |
| `semiconductorFab` | [PNG](evidence/phase2/review/semiconductorFab-close.png) | [PNG](evidence/phase2/review/semiconductorFab-overhead.png) |
| `utilityVehicleWorks` | [PNG](evidence/phase2/review/utilityVehicleWorks-close.png) | [PNG](evidence/phase2/review/utilityVehicleWorks-overhead.png) |
| `warehouse` | [PNG](evidence/phase2/review/warehouse-close.png) | [PNG](evidence/phase2/review/warehouse-overhead.png) |
| `batteryWorks` | [PNG](evidence/phase2/review/batteryWorks-close.png) | [PNG](evidence/phase2/review/batteryWorks-overhead.png) |

Process props are static, modest-detail original models. Detailed furnaces, enclosed automated production lines and more refined vehicles/piping would improve realism; no finished industrial asset-pack fidelity is claimed. The Vehicle Works display is not a controllable unit. The 24-design roadmap remains provisional; these six requested canonical mappings take precedence over its earlier provisional allocation, and no unrelated remaining designs or residential models were added. The separate house pack remains pending.

No gameplay activation, automatic ownership/economy changes, save migration, multiplayer writes, Supabase work, 0.4.3 edits, merge, push or deployment occurred. Require Lenovo performance and visual review before deciding on further expansion or integration.
