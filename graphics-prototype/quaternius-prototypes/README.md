# Quaternius direction — asset-readiness checkpoint

**Status: audit and provisional planning only. No Quaternius replacement has been built, rendered, enabled or approved yet.** The Downtown source could not transfer and the additional house pack has not arrived. This checkpoint deliberately does not finalize designs using incomplete primary assets or claim that old palette artwork is detailed PBR.

## Branch and safety

`feature/0.4.2-quaternius-replacements`, isolated worktree, starts at `9b8e5526ff3335d1fac14254542ed1c9cfe7762d`. The existing Kenney showcase is preserved byte-for-byte as a **legacy comparison**, not as an approved source for the final designs. No Kenney exception is approved, and none is silently substituted. Generic rendering/build algorithms may eventually be reused; geometry, textures and accessories in the replacement assets must have explicit approved provenance.

No gameplay, economy, recipes, IDs, footprints, save formats, authentication, multiplayer, Supabase, approved terrain or icon files were changed. No push, merge or deployment is authorized or performed.

## Actual archive findings

`asset-audit.json` records SHA-256 provenance, dimensions in source coordinates, polygon counts, triangulated-count estimates, materials, UV ranges, dependencies and image metadata.

| Supplied source | Readiness | Findings |
|---|---|---|
| Buildings Pack — Jan 2019 | Audited, CC0 notice present | 9 OBJ / FBX / BLEND exports. Two houses are present, but are **not** a substitute for reviewing the forthcoming house pack. OBJ triangle estimates range 5,160–41,788. Color-material definitions; no image map bindings. |
| Ultimate Textured Building Pack — Dec 2019 | Audited, CC0 notice present; textured associations need review | 102 OBJ / FBX / BLEND exports. Includes 26 material-only finished variants, 26 textured finished variants, 18 base modular buildings and 32 modular parts. These are **not 102 distinct finished designs**. OBJ triangle estimates range 10–13,564, including small accessories. |
| Downtown City MegaKit [Standard] | **Not inspected** | The supported attachment download failed because the ZIP exceeds the executor's **32 MiB per-file transfer limit**. License, geometry, textures and formats remain unverified. |
| Additional Quaternius house pack | **Pending attachment** | Residential designs remain explicitly provisional. |
| ModernResource artwork | No new pack/license supplied | Inventory/production icons only after license review; never building-surface textures. Existing icon fallbacks and Credits artwork remain intact. |

The 2019 Textured pack's 12 texture variants are **32×32 palette images**. They are not high-resolution brick, metal or window PBR maps, and no normal/roughness/AO files were found in these available packs. Its 76 OBJ exports under `Textured Models` declare a `Texture` material but omit image bindings in their MTL files. All OBJ MTL libraries and named materials resolve; **missing image association is a source-export issue, not an inferred missing file or scanner bypass**. The audit flags those conversions for explicit mapping review rather than assigning an arbitrary texture.

The Textured pack's `Preview.png` is actually a JPEG (1,920×1,080). It is reported as an extension mismatch, excluded from texture approval and never renamed into an approved material. Required PNG texture files still fail closed if their contents do not match their declared type.

OBJ does not declare real-world units or a universal up axis. Source-coordinate bounds are measured; conversion must verify orientation, normalize the base-center pivot, and fit the exact canonical game footprint. Triangle estimates assume valid polygon triangulation; final GPU triangle counts must come from the converted meshes. BLEND/FBX files were inventoried but **not opened or executed**. No archive HTML, scripts, drivers or instructions were executed, and the audit extracts no files.

## Provisional 24-design allocation

`design-plan.json` reserves **24 distinct existing catalog IDs**, with their exact current footprints:

- 12 industrial / industrial infrastructure: `steelMill`, `precisionElectronicsWorks`, `machineWorks`, `carbonPlant`, `powerPlant`, `warehouse`, `glassWorks`, `concreteBatchPlant`, `steelFoundry`, `cokeWorks`, `beamMill`, `moduleWorks`.
- 3 office / hospitality: `officeLow`, `officeTower`, `hotel`.
- 5 retail: `cornerStore`, `cafe`, `retailStrip`, `grocery`, `mall`.
- 4 residential: `smallHouse`, `townhomes`, `apartmentLow`, `apartmentTower` — **awaiting house-pack inspection**.

No existing named 24-design manifest was found in the available source. This is therefore a **provisional canonical-ID allocation**, preserving the requested count rather than claiming to reproduce an unavailable historical mapping. It creates no buildings, unlocks, prices or economic definitions. All source selections remain `sourceSelectionFinal: false`; residential slots have no approved asset assignment yet. If an earlier exact 24-ID list is supplied, reconcile it before finalizing the assemblies.

Final-source policy is Quaternius shells/modules plus clearly identified original industrial components. The available modular parts include windows, doors, stairs, balconies, pipes, bricks, signage and AC units. Dedicated steel-processing machinery, heavy cranes, furnaces and robotic work cells were **not found in these two available packs**. They require original modeling or additional approved assets; the inaccessible Downtown pack's contents must not be invented. No Kenney geometry may fill those gaps without explicit user approval.

## Implementation and performance gates

1. Obtain inspectable Downtown files and the additional house pack; verify licenses and hashes before importing. Review authoritative texture associations, UVs, axis conventions and dimensions.
2. Build a **separate Quaternius-only showroom**, leaving the old Kenney scene available for explicit comparison. Start with non-residential proof assemblies, shared finishes and reusable original industrial props. Do not finalize residential designs early.
3. Keep a stable versioned visual manifest mapping only genuine catalog IDs. Define per-part provenance, base-center transforms, tight bounds, material roles and reusable geometry. Preserve logical collision/placement footprints and all economic contracts.
4. Test close-up fidelity and texture correctness before broad expansion. Do not infer that the older packs provide photorealistic detail or that the unread Downtown kit solves every gap. Additional licensed PBR maps or detailed industrial components may still be needed.
5. Benchmark original, Kenney comparison and Quaternius replacements with identical maps, cameras, viewports, placements and building counts. Profile 10/50/100/250, startup, FPS/p95, long tasks, draw calls, triangles, mesh objects, approximate texture memory, drag and preview response. Use shared templates/materials, LODs, culling and instances; do not distort palette charts or remove important silhouette details just to hit triangle targets.
6. Keep gameplay integration disabled until visual review, actual target-hardware testing and all regression/performance gates pass. The previous software-WebGL prototype already missed targets; a new publisher is **not evidence of better performance**. The older pack's 41K-triangle models make profiling especially important.

## Offline audit and tests

Run the read-only inspector against the private local copies of the two reviewed ZIPs:

```powershell
python graphics-prototype/quaternius-prototypes/tools/audit_assets.py --buildings "C:\private-assets\Buildings Pack - Jan 2019-20261107T035815Z-1-001.zip" --textured "C:\private-assets\Ultimate Textured Building Pack - Dec 2019-20261107T022502Z-1-001.zip" --output graphics-prototype/quaternius-prototypes/asset-audit.json
python graphics-prototype/quaternius-prototypes/tools/test_audit.py
node --test tests/*.test.cjs
```

The scanner is standard-library based except Pillow header inspection for the known mislabeled preview. It checks reviewed archive fingerprints, canonical/case-safe paths, links, size/count limits, finite numeric data, valid OBJ indices, material references and archive-contained dependencies. Unsupported OBJ directives are flagged and block conversion. Missing texture associations stay blocked rather than guessed. It never runs material instructions or imports binary scenes.

Checkpoint verification: **160 Node tests passed** (157 inherited plus 3 plan/policy/frozen-comparison tests); **19 inspector tests passed**. No new renderer exists in this checkpoint, so no new browser screenshots, appearance comparisons, GLBs or performance results are claimed. Existing renderer files are unchanged.

## Exact next inputs

Please supply the forthcoming Quaternius house pack. For Downtown, upload a smaller normal ZIP containing the needed models, matching textures and license. If it remains above 32 MiB, use separate normal ZIPs under that limit (for example models and texture groups), preserving their relative folder names. Do not omit the license or needed texture files. No passwords, database exports or Supabase access are needed.
