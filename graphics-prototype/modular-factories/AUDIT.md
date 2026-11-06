# Modular factories: Phase A source audit and blocked asset inspection

Historical checkpoint (before the subsequent upload): source audit complete; archive audit was blocked. The three packs have since been supplied and audited; see [README.md](README.md), `asset-audit.json` and `manifest.json`. No Kenney assembly, renderer integration or performance claim is made by this checkpoint.

## Source and branch safety

Isolated branch: `feature/0.4.2-modular-factories`.
Base: `072e07fbebe9830d8c41c74d68cdb5b5e455d347`, the validated Premium UI gameplay fix, descended from graphics base `f21fb98cbe3c055e2c766733d113cf2e56b5f027`.
Separate worktree: `/workspace/Map-Game-modular-factories`. Existing graphics and Premium-fix worktrees were clean before branching and remain unchanged. No multiplayer branch, Supabase, database, economy definitions, main, remote refs or production renderer changed.

## Missing inputs

The request text was delivered, but these archives are not in the accessible attachments, workspace downloads, shared files or repository:

- Required: `kenney_city-kit-industrial_2.0 (1).zip`
- Required: `kenney_factory-kit_3.0.zip`
- Optional: `kenney_city-kit-suburban_20.zip`
- Optional: `ModernResource_Free.zip`

`/workspace/downloads/mapgame-graphics-prototype-v1.zip` is the earlier authored Map Game procedural prototype pack, not either Kenney pack. Existing source contains only the sedan GLB and procedural building prototypes. Neither those prototypes nor screenshots constitute imported Kenney assets.

Archive versions, SHA-256 digests, redistribution licenses, actual part names, model formats, geometry counts, dimensions, texture dependencies and material properties are **unverified**. Do not infer them from product names or manufacture a manifest listing nonexistent meshes. No substitute pack was downloaded.

## Audited canonical catalog mapping

The runtime catalog is assembled from `buildings.js` plus `industrial/integration.js` and `industrial/registry.js`; `industrial/catalog.json` alone omits starter contracts. Runtime definitions were evaluated using the existing isolated test helper.

| Showroom label | Existing canonical ID | Runtime name | Logical X×Z footprint |
|---|---|---|---|
| Steel Mill | `steelMill` | Steel Factory | 118×92 |
| Electronics Plant | `precisionElectronicsWorks` | Precision Electronics Works | 80×66 |
| Machinery Works | `machineWorks` | Industrial Machine Works | 64×54 |

`steelFoundry` (56×48), `powerElectronicsWorks` (64×54) and `heavyMachineWorks` (72×60) are distinct existing contracts, not aliases to overwrite. Do not add an `electronicsPlant` ID or change research locks just to make a showroom item purchasable. The showroom must be free of economy transactions; any later game integration must use each original ID, recipe, logical footprint and save record unchanged.

## Current renderer and placement

- `game.js` deliberately starts Basic; Regular 3D is paused. Basic renders terrain imagery and 2D building footprints.
- `graphics-prototype/prototype.js` is opt-in for Regular/Deep; the separate laboratory forces previews. It currently supports procedural `smallHouse`, `steelMill`, and visual-only `officeLow`, not imported factory modules. It uses shared scene materials, material-group merging, three detail groups and a throttled distance check.
- Preserve the five original laboratory surface textures and existing approved game terrain textures. Kenney source materials must first be inspected; recoloring or material substitution should be documented rather than described as supplied semi-realistic art.
- `basic_world.js` already has cursor-follow placement, quarter-turn rotation, colored valid/invalid fills, authoritative `checkPlacement` feedback, cancellation and drag-versus-click handling from the validated fix. Its ghost outline is currently white; a later focused placement change can color the outline without changing validation.
- Do not invent a snap grid. Continue using existing world coordinates and authoritative terrain/overlap rules unless an actual tool already requires snapping.

## Assembly specification to validate after upload

Use local +Y up, base-center pivot, X width/Z depth, original quarter-turn orientation, and explicit source-to-game transforms. Inspect imported axis conventions and negative scales first. Keep the whole decorative assembly within its mapped logical footprint, including cranes and pipes. Imported props must be non-pickable and create no economic/collision objects.

Planned silhouettes (conditional on real archive contents):

- Steel: broad low steelworks shell, tall chimney grouping, exterior pipe runs, crane/loading edge and conveyor processing area.
- Electronics: cleaner stepped shell, restrained glazing, roof vents, precision/robot cell and separate delivery edge.
- Machinery: workshop hall, heavier equipment yard, gantry crane, mechanical/conveyor components and storage.

These are assembly intentions, not verified available components. If a requested component is absent, report it before substituting unrelated geometry.

## Planned validation gates

1. Inspect ZIP directory entries without executing scripts. Reject absolute/traversal paths, links, duplicate/case-colliding names, encrypted entries and excessive expanded sizes. Extract only approved asset types into a bounded staging folder using the existing safe pack tooling where applicable. Review licenses before committing redistributed art.
2. Inventory source meshes, accessors/primitives, triangles, decoded textures, materials, local/world bounds, dependencies and hashes. Reject broken/external references. Record source archive and part names in a versioned manifest.
3. Build reusable scene templates, shared materials/textures and three LODs before placing city instances. Avoid per-frame model reconstruction. Evaluate Babylon instances/merged static geometry and explicit distance culling; keep animated parts separate. Dispose per-instance resources without disposing shared assets still in use.
4. Create a separate rotatable/zoomable showroom and placement sandbox. Initially register no live renderer replacement. Reuse the actual placement validator for valid/invalid fixtures; no duplicate permissive rules.
5. Reuse the existing graphics preference system. Basic remains intact. Low/Medium/High/Ultra are proposed presentation budgets only until implemented and tested; do not expose unsupported toggles or enable experimental 3D by default.
6. Benchmark original and modular visuals at identical browser, viewport, placement fixture, camera path and quality: 10/50/100 and 250 factories if feasible. Report FPS, p95, startup, draw calls, triangles, meshes, approximate texture memory, drag and preview latency. State unavailable GPU memory metrics and software-rendering limits. No Lenovo hardware claims.
7. Run deterministic geometry/footprint/LOD/disposal/manifest tests and browser placement/rotation/cancellation tests, followed by existing game/industrial/session regressions. Only validated prototypes can be considered for later opt-in live integration.

## Checkpoint verification and next input

This checkpoint changes documentation only. The inherited Node suite passed **154/154**, with zero failures or skips. No new models exist, so no new showroom screenshots or model performance measurements are available. Browser benchmarks from earlier commits are historical evidence, not tests of nonexistent Kenney assemblies.

Next action: attach the two required Kenney ZIP archives. The suburban and resource-icon packs are optional and must not block the three factory prototypes. After attachment, resume Phase A archive inspection on this branch, then proceed through B–E. No push, merge or deployment is authorized.
