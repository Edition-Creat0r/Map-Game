# Industrial Atelier — modular factory prototype

An isolated visual prototype for Map Game 0.4.2. **Functional review build, not approved for live integration: software-WebGL city benchmarks miss targets, and the art remains stylized.** **No live renderer replacement.** Open `graphics-prototype/modular-factories/index.html` from the same local HTTP server as the game. The main game remains Basic 2D; Regular 3D stays paused.

## What is implemented

- Steel Mill → existing `steelMill`, footprint **118×92**: sawtooth production hall, tall chimney grouping, crane, pipework, processing machinery, conveyors, loading doors, architectural ribs and clerestory glazing.
- Electronics Plant → `precisionElectronicsWorks`, **80×66**: connected industrial shells, glazed front, articulated static robot cells, rooftop ventilation, scanner, delivery/storage area and solar detail.
- Machinery Works → `machineWorks`, **64×54**: workshop, crane, machine bed, gears, conveyor, storage, façade framing and a **separate animated piston**.
- Optional suburban check → existing `smallHouse`, **18×22**. No new houses, buildings, purchases or economic IDs were added.
- Three GLB geometry LODs (Meshoptimizer build-time reduction for Low/Medium; full geometry for High), cached scene templates, hardware instances for repeated static batches, shared palettes/materials, built-in frustum culling and hysteresis. Geometry is preassembled at build time; camera movement only selects cached groups. Moving piston geometry is not merged. Its three original animation clips remain intact; Ultra plays only `toggle` for at most eight nearby props, and respects reduced motion.
- Low / Medium / High / Ultra are **showroom-only** presentation budgets, not new saved preferences. Low retains silhouettes; Medium adds major production components; High adds architectural details; Ultra enables the limited piston animation. Medium/far LODs use shared lower-cost diffuse/specular materials with the same palettes and normals; close High/Ultra retains PBR/glazing. The optional `?materials=pbr` comparison forces full PBR at every distance for profiling, not a saved game setting. Existing game settings/storage are unchanged.
- Separate placement workshop: real economy-model footprint/terrain/overlap validator against a clearly marked **synthetic flat-terrain/water fixture**. It supports cursor-follow, green/red outlines, rotation, drag-versus-click, blur/cancel and unsaved example placements. The blue strip is an explicit test fixture, not a drainage overlay or live-world hydrology. No economy transaction or saved-world mutation occurs there.
- Settings links to the isolated factory review and explicitly distinguishes imported studies from enabled gameplay visuals; no new preference system was added.
- In actual Basic gameplay, the existing preview now follows each input event, retains its existing throttled validation and uses green/red outlines. Existing purchase, rotation, camera gestures, terrain authority, collision buffers and cancellation rules are retained. No snapping grid is invented.

## Visual quality and limitations

Kenney supplies real **low-poly** modular assets with 512×512 palette atlases. Their style is not equivalent to a high-resolution semi-realistic building pack. To improve the result, this build adds authored architectural geometry, restrained/desaturated **derived Kenney palettes**, PBR paint/metal/glazing, a warm directional/ambient lighting rig, tone mapping and a shared soft-contact-shadow texture. Robot arm joints are posed before static merging; most machinery props preserve source proportions inside their assigned envelopes. Original source files and palettes are retained unchanged.

These are quality-review prototypes, not a claim of finished photorealistic art. Close-ups are in `evidence/`. They must be reviewed before any gameplay integration. Contact shadows are an economical approximation; there is no expensive dynamic city shadow-map pass. There is no smoke/particle simulation, dynamic crane operation or animated conveyor belt. Smooth orbit and zoom are available in the showroom; the placement workshop uses left-drag panning.

For greater fidelity, supply appropriately licensed factory shells with modeled roof/wall thickness, panel seams and bevels; detailed cranes/furnaces/rolling mills/robot work cells; tileable metal, corrugated cladding, brick, concrete and asphalt **base-color/normal/roughness/AO maps** (typically 1K–2K); and an optional licensed HDR environment for physically meaningful reflections. Such assets need measured LODs and agreed browser budgets. No resource icons were stretched onto surfaces. `ModernResource_Free.zip` was not supplied or integrated. Approved game/laboratory terrain textures and the original Credits icon are unchanged.

## Source provenance, manifest and build

The three user-supplied archive fingerprints are pinned in `tools/packlib.py`. `asset-audit.json` records **all 220 GLBs** (143 factory, 37 industrial, 40 suburban), their bounds, triangles, materials, image references, sizes and SHA-256 hashes. Every archive contains a CC0 notice; see `source/factory/License.txt`, `source/industrial/License.txt`, and `source/suburban/License.txt`. Kenney attribution is retained even though the licenses do not require it. Original FBX/OBJ variants are present in the supplied archives, but only selected GLBs, their palette and licenses are copied into this repository. HTML, URL files and other executable/nonessential content are not extracted or run.

`assemblies.json` is the versioned assembly specification: canonical ID, logical footprint, source part IDs, dimensions/envelopes, base positions, rotations, static joint poses and detail memberships. `manifest.json` records generated GLB fingerprints, byte sizes, per-LOD triangle counts, mesh batches, simplifier error limits and separate animated components. Low/Medium simplification retains original vertex positions, normals and UVs rather than moving or stretching the geometry; small disconnected details can be pruned. A requested triangle target is not guaranteed when topology/UV seams prevent it. High geometry is not simplified. Inventory vertex counts sum primitive attribute records and can count shared accessor arrays more than once; triangle counts sum actual primitive indices. The static GLBs embed their own palettes; the retained piston resolves only its local `source/factory/Textures/colormap.png`.

The importer validates entire ZIP directories first, rejecting traversal, absolute/Windows paths, canonical/case collisions, symlinks, special/encrypted files and excessive counts/sizes. It verifies the exact reviewed fingerprints and license notices, audits GLB buffers/accessors/indices/transforms, and writes only the allowlist after all archive audits pass. It never performs unrestricted extraction, remote downloads or execution. Unknown animation/compression/material semantics fail closed in the builder; the animated piston is an explicit exception kept separate.

Build prerequisites tested: Python 3.12, NumPy 2.3.5, Pillow 12.3.0, Node.js and pinned MIT `meshoptimizer@0.25.0`. The npm lockfile records the package integrity; its license is retained in `tools/meshoptimizer-LICENSE.txt`. Meshoptimizer runs only in the build tool and is never loaded by the game. The prebuilt models can be served without Python. Rebuild and verification:

```powershell
npm ci --prefix graphics-prototype/modular-factories/tools --ignore-scripts --no-audit --no-fund
python -m pip install numpy==2.3.5 Pillow==12.3.0
python graphics-prototype/modular-factories/tools/import_packs.py --factory "C:\private-assets\kenney_factory-kit_3.0.zip" --industrial "C:\private-assets\kenney_city-kit-industrial_2.0 (1).zip" --suburban "C:\private-assets\kenney_city-kit-suburban_20.zip"
python graphics-prototype/modular-factories/tools/build.py
python graphics-prototype/modular-factories/tools/test_modular.py
```

Do not put private exports, credentials or unrelated downloads into the repository. The importer accepts only these pinned reviewed archive versions. A different pack version needs a new audit, not a silently changed fingerprint. Repeated builds are byte-identical in the tested toolchain; cross-platform/toolchain output must be checked before committing rebuilt assets.

## Coordinate and gameplay contracts

Source GLBs are glTF +Y-up. The build applies source hierarchy matrices and poses, fits parts to declared envelopes, and merges static batches by material. Generated assets use a **base-center pivot**, X width and Z depth. Babylon performs its normal glTF-to-left-handed conversion at import. The outer instance root is placed at existing world X/Z and rotated with the existing quarter-turn convention. All static LOD geometry and runtime hierarchy bounds are tested against original footprints, including all quarter turns. Decorative meshes are non-pickable and do not register collision/economy objects. Placement relies on the existing logical footprint, not the model's decorative mesh bounds.

The showroom loads the real catalog and solver definitions for IDs and validation, but neither authentication nor the economy adapter. It does not write localStorage, contact Supabase or bypass research/ownership gates. Its original-renderer comparison invokes the existing `legacyBuilding` renderer for the same three canonical factory IDs and positions. Import errors are shown clearly and leave the main game untouched.

## Validation and performance

See `VALIDATION.md` and the machine-readable files in `evidence/`. Performance targets of 60 FPS on capable hardware and 30+ on weaker hardware are **targets, not certifications**. Cloud SwiftShader measurements do not establish Lenovo GPU performance. Main-game performance and prototype performance are separate gates.

## Windows preview

Once this branch is transferred by an explicitly authorized method, open its isolated worktree and run:

```powershell
npx --yes http-server . -a 127.0.0.1 -p 8019 -c-1
```

Open `http://127.0.0.1:8019/graphics-prototype/modular-factories/` for factory/house inspection, or append `?placement=1` for the unsaved workshop. A local server is required; do not open `file://` HTML. The page uses the existing Babylon CDN; the cloud tests use verified cached libraries, so fully offline startup is not certified. Port 8019 is a separate save origin from 8017: reviewing the showroom does not move your existing Singleplayer save. The existing main-game route is `/`. Do not import these files into the multiplayer release candidate or replace your active saved-world origin just to review graphics. Nothing is pushed, deployed or enabled remotely by this prototype.
