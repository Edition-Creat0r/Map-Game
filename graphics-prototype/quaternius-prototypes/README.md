# Quaternius industrial showroom — Expansion Phase 2

Nine **review prototypes**, isolated from gameplay. **Current models, matrix, test evidence and images: [PHASE2.md](PHASE2.md). Windows launch/transfer: [WINDOWS_PHASE2.md](WINDOWS_PHASE2.md).** Historical three-design profiling: [OPTIMIZATION.md](OPTIMIZATION.md). The 24-design allocation remains provisional; the original three and six requested industrial studies have Quaternius builds. Residential work waits for the additional house pack. No replacement is enabled in the game. Nothing has been pushed, merged or deployed.

Branch: `feature/0.4.2-quaternius-replacements`, based on `9b8e5526ff3335d1fac14254542ed1c9cfe7762d`. The previous Kenney showroom is preserved byte-for-byte for comparison, and is **not** an approved source for these pilots. No Kenney exception is approved or used.

## Inspect the studies

From this branch's repository folder in Windows PowerShell 7:

```powershell
npx --yes http-server . -a 127.0.0.1 -p 8021 -c-1
```

Open `http://127.0.0.1:8021/graphics-prototype/quaternius-prototypes/?shadows=1` for close inspection. Drag to orbit, wheel to zoom; select a factory, count and detail budget. Presentation can switch to the original catalog renderer. `?shadows=1` enables optional 1024px real-time shadows for this showroom only; omit it for the matched performance fixture. Lighting/controls do not change game preferences. The header links to the preserved Kenney comparison.

The main game does not reference this folder. Economy, research, placement, footprints, saves, approved terrain, ModernResource icons, authentication, multiplayer and Supabase remain untouched. No settings system or player data is added. Showroom components do not call economy or purchase methods.

## Verified source and license

The five newly supplied normal ZIPs resolve the original Downtown transfer blocker. `downtown-audit.json` records all five SHA-256 fingerprints, **153 glTF + matching BIN models**, **29 PNGs**, per-file dependencies, source-coordinate bounds and triangle counts. All dependencies resolve within the virtual combined archive. Identical duplicate license/readme files are allowed; conflicting or case-ambiguous duplicates fail. `License_Standard.txt` is the supplied CC0-1.0 notice.

This Standard pack contains genuine 1K–2K base-color, normal and ORM maps. Its paid SOURCE edition's custom fake-interior and wear shaders are **not included or implemented**. Actual glTF texture semantics are preserved; the ORM is used as the source metallic/roughness texture. No synthetic AO or paid shader is inferred from the file name. The source's gray `MI_FakeInterior` color is explicitly replaced with an original dark interior finish, not a simulated parallax interior. Exterior shells omit internal wall faces and use single-sided rendering.

The earlier 2019 packs remain audited in `asset-audit.json`: 9 color-material OBJ exports, plus 102 material/textured/modular OBJ exports (not 102 unique finished buildings). Their texture variants are only 32×32 palettes. 76 textured OBJ files lack MTL image bindings and remain blocked from conversion. Their mislabeled JPEG `Preview.png` is excluded as a surface texture. Neither pack is used in these pilots. BLEND, FBX, archive scripts, URLs and readme instructions are never executed.

## Original-three core mappings (six additions: PHASE2.md)

| Existing catalog ID | Canonical footprint | Quaternius structure | Original static components |
|---|---:|---|---|
| `steelMill` | 118 × 92 | Red-brick modular shell, double/single windows, asphalt roof, AC | Stacks, furnace block, loading shutters, gantry, roller bed, plinth |
| `precisionElectronicsWorks` | 80 × 66 | Metal/window modules, two wings, roof, AC | Clean plant covers, conveyor/work cells, articulated static robot arms, plinth |
| `machineWorks` | 64 × 54 | Red-brick workshop, windows, roof, AC | Aligned loading doors, CNC enclosure, horizontal lathe, portal press, gantry and plinth |

These are visual-only mappings, **not new buildings**. Every LOD is checked against the unchanged footprint, with Y-up source geometry and a base-center pivot. Native wall/window/roof tiles scale uniformly by 3; brick UVs are not stretched to fit whole walls. GLB loader coordinate conversion is retained by the instance wrapper. Original machinery consists of authored simple boxes/cylinders, not hidden Kenney imports or finished detailed industrial models. No 2D resource icons are placed on surfaces.

## Pipeline and budgets

`tools/build_downtown.py` reads the five fingerprint-pinned ZIPs in memory. It does not extract an arbitrary tree, open binary scenes, download dependencies or run supplied code. Archive links, special files, unsafe paths, ambiguous duplicates, missing dependencies, unsupported animated/skinned geometry, invalid numeric data and footprint overflow fail the build. Outputs are restricted to this folder's `generated/`, audit/license and manifest files.

`generated/pilots.glb` is one shared library: nine roots × Low/Medium/High groups, merged by material. High retains the exact native architectural geometry and PBR material/texture data from `de493cd`. Medium caches native window modules into four shared 128×192 façade tiles while retaining 3D equipment; Low merges whole walls/roofs, uses plain-wall caches and drops window detail. Source UVs and geometry determine the bakes; no resource icons or Kenney data are used. No destructive texture-island mesh simplification is used. Medium and High brick shells both use brick modules. Distance thresholds have hysteresis; quality is a maximum LOD budget. No physics, animated machinery or Ultra setting is claimed.

`renderer.js` loads one container and batches thin instances by catalog ID, LOD and material; it does not import or rebuild geometry during orbit/zoom. Logical record anchors retain coordinates; `record.update()` invalidates cached matrices. Conservative frustum/subpixel-distance culling and LOD updates run only when dirty or the sampled camera matrix changes. GPU buffers upload only when batch membership or poses change. Shared textures/materials and the container are disposed with the scene. The count fixture builds incrementally, yielding every 12 records. No code is added to terrain or world-map frame loops.

All 19 approved PNG maps, including the four small façade caches, remain byte-identical to 5b51d3e. Base color is at most 1024px; normals/ORM at most 512px. Normal vectors are renormalized after resizing. Source hashes, derived hashes, dimensions, byte estimates and explicit provenance are in `manifest.json`. Source archives are untouched. Estimated decoded RGBA+mipmap storage is approximately **40.5 MiB**, not a GPU measurement; driver/shader/mesh memory is additional. Originals remain in the supplied ZIPs and are not bulk-committed.

| Factory | Low triangles | Medium triangles | High triangles |
|---|---:|---:|---:|
| Steel Mill | 218 | 742 | 31,716 |
| Electronics Plant | 140 | 876 | 8,384 |
| Machinery Works | 142 | 714 | 16,498 |
| Industrial Reagent Works | 142 | 702 | 2,344 |
| Glass Works | 106 | 562 | 6,848 |
| Semiconductor Fab | 94 | 518 | 2,852 |
| Utility Vehicle Works | 130 | 802 | 6,166 |
| Warehouse | 166 | 622 | 4,772 |
| Battery Works | 94 | 918 | 4,028 |

## Offline rebuild and tests

Dependencies: Python 3 + NumPy + Pillow (`tools/requirements.txt` pins the tested versions); Node.js; Playwright Core + Chromium for browser tests. Use your own private asset folder. The five arguments must be the exact reviewed parts in numerical order.

```powershell
python graphics-prototype/quaternius-prototypes/tools/build_downtown.py --parts "C:\private-assets\mapgame_downtown_gltf_part_1_of_5.zip" "C:\private-assets\mapgame_downtown_gltf_part_2_of_5.zip" "C:\private-assets\mapgame_downtown_gltf_part_3_of_5.zip" "C:\private-assets\mapgame_downtown_gltf_part_4_of_5.zip" "C:\private-assets\mapgame_downtown_gltf_part_5_of_5.zip"
python graphics-prototype/quaternius-prototypes/tools/test_audit.py
python graphics-prototype/quaternius-prototypes/tools/test_downtown.py
python graphics-prototype/quaternius-prototypes/tools/test_far_lod.py
node --test tests/*.test.cjs
```

With the HTTP server still running, set browser paths for your machine (the repository browser scripts otherwise default to Linux Chromium):

```powershell
$env:BASE_URL = 'http://127.0.0.1:8021'
$env:CHROMIUM = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/quaternius-browser.cjs
node tests/quaternius-performance.cjs
```

The supplied browser scripts request SwiftShader for a repeatable software-rendering comparison. They do **not** certify Lenovo hardware acceleration. Screenshots and raw benchmark data are in `evidence/`; historical baseline results are in `VALIDATION.md`; current results and remaining gates are in `OPTIMIZATION.md`. The shared-camera review page is `comparison.html`.

## Remaining quality and release gates

Nine prototypes exist. The previous 24-design allocation remains provisional and must be reconciled with the six newly requested IDs. No additional designs beyond these nine were implemented; residential designs await the house pack. Source/design selections are not final. The older 2019 palette packs are not substitutes for missing detailed industrial equipment.

These modules provide much clearer architectural surface detail, but the original equipment is intentionally low detail. Detailed furnace/rolling-mill assets, industrial pipe joints/valves, realistic robot arms/conveyors, loading/loading-dock accessories and licensed worn-metal/concrete PBR sets would improve close-up fidelity. The paid custom shaders are not silently substituted. No final semi-realistic or photorealistic quality claim is made.

Visual approval of all nine close-up/overhead pairs, target-hardware performance, LOD transition review, additional house-pack inspection and separate gameplay-integration permission remain required before live replacement. The supplied source changes are isolated; user approval is not inferred from file upload.
