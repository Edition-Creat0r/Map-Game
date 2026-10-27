# Map Game visual restoration

Branch `feature/0.3.4-visual-restoration`, based on validated `dfbe4ff66eb5f69179562fa577a156b44dbb424a` from `feature/0.3.4-industrial-revolution`. This is a presentation branch. Do not merge automatically; the existing release gates, outstanding GitHub/Pages access and performance review remain applicable. No C2 work or economic changes are authorized here.

## Historical audit

| Revision | Finding | Treatment |
|---|---|---|
| `bd5bd91` / older 0.3.2 | Ground image patches were drawn directly into chunks, providing stronger photographic detail but exposing square patch edges. | Reuse the images with globally aligned, mirrored sampling and continuous existing biome weights. Do not restore square patches. |
| `49b7dca` (last pre-Codex base) | Deliberately disabled the square texture overlays; its source says the seamless compositor was still forthcoming. Flat ground therefore partly predates Codex. | Retain coherent geography; improve the compositor, not the terrain model. |
| `49b7dca` trees | PNGs were visible above zoom .28, with a minimum sprite height. They disappeared while dragging, changed candidate spacing at .65 (105 m vs 72 m), and stopped after 95 traversal-order sprites. | Restore normal-zoom PNG visibility without restoring unstable positions, disappearing-on-drag behavior or traversal cutoffs. |
| `62781e1` | Performance stabilization removed per-frame sampling/pattern costs and retained progressive terrain work. | Preserve caches, generation queues and existing soft work budgets. |
| `2a1f104` / `812e637` | Shared biomes and deterministic forests replaced the old local decorative grids. Forest medium LOD began at .58 and sprite blending at .72–.92. At the actual default zoom **.32**, both weights were zero. | Change only presentation weights. Keep every candidate ID, position, family, species, size and generation rule. |
| `53911ac` / current `dfbe4ff` | A normal .32 viewport usually exceeded the 32-visible-chunk threshold, stretching a 160-pixel territory overview across the local view. Texture JPGs were reduced to 16×16 luminance and multiplied by only .07; canopy merely tinted the ground by a few percent. | Stream bounded 32-pixel medium chunks at normal zoom, upgrade to 64 as needed, and use stronger 64×64 source luminance. |
| Old interface | Navy/cyan branding, labeled command rail, resource chips and richer building previews had useful visual hierarchy. The full 3D shop is inappropriate while Regular rendering is paused. | Reuse the identity and hierarchy with compact resource chips, a side sheet, dimensioned 2D previews and the existing actions. |

Baseline browser captures at .32 reported **zero drawn detail trees** in all eight photographed territories; close zoom showed hundreds. The four original sprite paths loaded successfully, with no HTTP failures. All 17 tree PNGs have genuine alpha transparency. The repository has **no conifer/evergreen PNGs**, despite having multiple ornamental deciduous variants. PNG availability is not the cause of default-zoom invisibility. Existing procedural spruce/pine fallback imagery was visible only at close zoom.

No external historical screenshot was supplied with this request; its deployment/branch/world cannot be inferred. All supplied before/after captures here are explicitly **Singleplayer**, seed 734221, served locally from an isolated baseline worktree (`dfbe4ff`, port 8010) and this branch. Camera metadata is retained in each `visuals.json`. They are not Central World or deployed GitHub Pages screenshots.

## Environmental changes

- `forest.js`: only continuous visual LOD thresholds change. Medium detail now blends over .18–.28; sprites over .22–.32, reaching full sprite presentation at the existing default .32. The deterministic generator, density, candidate spacing, IDs, species and sizes are unchanged; 2,000 real-biome candidate comparisons against the base confirm equality.
- `forest_renderer.js`: reuse existing broadleaf/olive/mint/cherry PNGs; scrub reuses olive imagery. Evergreen fallback atlases get layered, shaded branch silhouettes because no conifer PNG exists. World-anchored roots remain fixed; crown presentation is 16% larger. Subtle cached shadows respect the existing shadow setting. The reusable viewport image uses 128-pixel padding and a 96-pixel reuse margin, keeping default-view tile requests within the **120-tile / 8,192-record** cache bounds. No tree randomization occurs in drawing.
- `basic_world.js`: decode existing JPG materials once to mean-centered 64×64 luminance tiles. Global mirrored coordinates avoid source-edge jumps; existing biome weights blend material detail. Soil texture/color follows existing dry/rock/snow masks, with no new terrain or hydrology. Existing canopy potential is more legible in the fallback raster.
- Existing terrain chunk queues now serve 32-pixel rasters at normal zoom, upgrade to 64 only when required, retain usable low-detail imagery during upgrades and reuse higher-detail tiles when zooming out. No ordinary camera motion clears the cache. A visible-footprint check uses no normal-view overscan and never schedules beyond the existing 120-cache fit. The generation worker remains one job at a time with the inherited incremental environment budgets. Wide/high-DPI views still fall back to the bounded overview/canopy rather than thrashing.
- The authoritative shared terrain, elevation geography, biome weights, waterways, local coordinates and buildability are untouched. Water rendering remains separate. Mountain peaks retain their original snow and treelessness.

The before/after image pairs were checked for exact territory, cameraX, cameraZ and zoom equality. Normal temperate, grassland, taiga and wetlands sites now show sprites; the sampled snowy mountain peak correctly remains treeless. Drawn counts include the padded viewport image and are not a change to world forest density.

## Interface

- `visual.css` / `visual_ui.js`: navy/cyan design tokens, compact Money/Steel/Carbon/Energy/Population bar, explicit world badge, labeled navigation, consistent focus rings/tooltips, three dark themes and two density settings. Preferences use only `mapgame_visual_preferences_v1`; they do not migrate or alter economy/world records. The existing Home settings panel is preserved when Home is removed, and renderer/interface buttons remain accessible in Settings. Regular 3D stays paused.
- `economy_ui.js`: right-hand construction sheet with at most ten compact visual cards, real costs/recipes/requirements, material badges and dimensioned schematic footprint previews. These are lightweight SVG plan views, not new 3D models. Available/Discover filtering and all API purchase checks remain intact. Cached search metadata and render signatures avoid rebuilding unchanged card DOM every tick, preserving keyboard focus and expanded recipes. Inventory preserves unlocked and Legacy sections.
- `industrial/progression-ui.js`: real prerequisite links behind seven accessible research cards, fixed labels/costs and completion feedback. Rendering is keyed to actual progression/affordability changes instead of replacing the whole panel every second. Keyboard navigation/focus restoration, reduced-motion behavior and polite unlock announcements are supported. Discovery and advanced operating priorities are collapsible; all underlying research/automation rules are unchanged.
- Terrain inspection is collapsible. World Atlas selection/ownership/entry controls keep their original IDs and handlers; presentation and explanatory text are modernized. Laptop 1280×800 and larger 1920×1080 layouts are tested. No development branch IDs, model IDs or diagnostics are inserted into normal player flows.

## Compatibility and limits

All 121 internal material IDs, the frozen 100-player-material manifest, five starter plus 120 industrial definitions, recipe contracts, technology/migration rules, exact BigInt accounting, uncapped offline solver and 1.2× online throughput remain unchanged. Economy state, claims, unknown fields, ownership/authentication and Supabase permissions/schema are not modified. Basic remains 2D and the 3D scene frame counter stays paused. No new noise sampling is added to rendering loops; additional grain uses decoded cached texture samples and existing material masks.

Art limits: no conifer PNGs, photoreal willow collection or building thumbnail catalog exists. Evergreens therefore use cached procedural atlases; willow uses the existing mint deciduous PNG; building previews are dimensioned schematics matching the current Basic footprint representation. The photo assets are blended as luminance to preserve the shared biome palette. Far/high-DPI fallback represents coarse forest potential rather than every individual tree. Small/shadowed details and large-city spikes still depend on browser/GPU and cache warm-up. Do not claim a complete forest-art pack or universal performance improvement.

## Validation and artifacts

The inherited full release runner is retained. For this branch, use `MAP_GAME_VISUAL_BASELINE=dfbe4ff` to compare against the exact requested base; its default C1 baseline/gates are unchanged. Browser benchmark routing now includes nested JS/HTML/CSS so a baseline cannot accidentally load a new nested UI module. High-detail readiness checks actual 64-pixel chunks when that metadata is available, rather than mistaking new medium chunks for completed high detail.

Additional validation:

- `tests/visual-forest.test.cjs`: unchanged deterministic records in five real biome territories; continuous default-zoom presentation.
- `tests/visual-ui-browser.cjs`: actual normal trees, inspector, non-rebuilt cards, text input, focus/Escape, real research feedback, theme/density persistence without economy/world save changes, paused 3D and laptop/large-screen bounds.
- `tests/visual-restoration-browser.cjs`: fixed-camera environment/world/shop/research/inventory screenshots plus texture availability and console/network checks. The ordinary C1 browser suite explicitly opens the now-collapsible operating-priority control.

All logs, before/after PNGs, camera metadata, final source/branch hashes, exact suite statuses and measured performance are saved under `/workspace/map-game-visuals/`. The final report is `/workspace/map-game-visuals/FINAL_REPORT.md`; artifact locations in this document are local review files, not published deployment results. No merge, GitHub Pages deployment or new economy release approval is implied by local browser validation.

## Issues caught during validation

A preliminary high-detail readiness check exposed a real upgrade-queue bug: the old unconditional “already cached” return prevented 32→64 upgrades. The queue now compares resolution, retains the old image and reserves the one in-flight chunk key. The corrected release run is under `validated/`; the failed preliminary run remains under `final/`. Wide-view testing also added an exact tile-footprint guard: partial-detail views omit viewport-cache padding and fall back to the coarse cover before exceeding 120 forest tiles. This prevents endless visible-tile eviction/rebuilding on large viewports. Both are presentation-cache fixes, with no world or economy changes.
