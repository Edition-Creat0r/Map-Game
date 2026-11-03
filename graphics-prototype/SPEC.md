# Semi-realistic graphics prototype v1

Baseline: `0a2e157` (latest committed Modern Frontier Singleplayer expansion).
Branch: `feature/0.4.1-graphics-prototype`. The multiplayer RC branch and every
central-online file are untouched; no RC manifest or approved hash is rewritten.
The existing 139 materials, 140 industrial definitions, five starter contracts,
118 player materials and 14 research nodes remain the baseline, not new content.

## Catalog mapping / GLB authoring contract

| Actual ID / label | Existing footprint X/Z | Proposed GLB envelope X/Y/Z metres | Prototype |
| --- | --- | --- | --- |
| smallHouse / Single-Family Home | 18 × 22 | 18 × 12 × 22 | Render-only masonry house, pitched roof, framed windows, porch |
| steelMill / Steel Mill | 118 × 92 | 118 × 32 × 92 | Render-only corrugated factory, loading bays, sawtooth roof, stacks |
| officeLow / Office Campus | 86 × 72 | 86 × 24 × 72 | Render-only office volumes, curtain wall, roof plant |

Office Campus is an existing visual catalog entry, **not an added economy/shop
contract**. No IDs, recipes, prices, footprint or saved placed-building data change.
The steel mill's existing pinned economy footprint/recipe remains authoritative.

Future finished GLBs must use glTF 2.0 binary, metres, +Y up, base-centre origin,
identity transforms, front facing -Z, and fit their footprint; Babylon's default
left-handed scene conversion must be checked on import. No root mirror/scale in
saves. Mesh names are not gameplay IDs. Preserve placement root metadata/rotation.
PBR metallic/roughness, opaque plaster/masonry, metal trim and tinted glass;
no transmission, live lights, animation, cameras, scripts or external URIs.
Use embedded PNG/WebP where supported by a future reviewed loader. Near budget
12k/24k/18k triangles, medium <= 35%, far <= 10%; <= 8 materials, 1024px shared
textures preferred. No completed GLBs are supplied or loaded by this prototype.

Procedural v1 uses prebuilt, material-merged meshes and three distance LODs with
20% hysteresis. No positions/styles are randomized per frame. A scene owns shared
materials/textures; disposed roots leave the LOD registry. Prototype construction
is opt-in for Regular/Deep; Basic calls the original renderer and loads no tiles.
The existing paused Regular loop is not activated. The showroom is a separate
3D scene, not a replacement world renderer or new save format.

Four-way intersection uses existing road2 width 14m. Only four same-level,
near-orthogonal road2 arms qualify; other graph nodes fall back to the old visual.
Graph IDs, elevations, curves, lane/access rules and saved roads are unchanged.
Grass/dirt/gravel/asphalt/concrete are material swatches and prototype surfaces;
they never replace authoritative water, height, biome, forest or buildability data.

## Versioned ZIP format / safe workflow

ZIP v1 contains exactly manifest.json plus five PNGs. Manifest specifies
format=map-game-graphics, version=1, packId, declared CC0-1.0 license, three
whitelisted procedural-v1 model references (dimensions/pivot above), five named
surfaces with 1–16m tiling, and path/bytes/SHA256/kind for every file. Unknown fields,
IDs, versions, file types, scripts, GLBs, remote URIs and extra payloads fail closed.
GLB file loading is **future work**, not quietly accepted or executed in v1.

Tooling uses Python 3 standard library only, never extractall, shell execution or
uploads. ASCII relative allowlisted paths, exact entry count, duplicate/casefold
checks, symlink/special/encrypted-entry rejection, method/ratio/byte limits,
manifest integrity, PNG CRC/dimensions/channel/filter/decompression bounds all run
before output. 1 MiB/file, 8 MiB total ZIP, 1024² maximum PNG. Only RGB/RGBA8,
noninterlaced IHDR/IDAT/IEND PNGs are supported. Re-encode other valid images first.
JSON duplicate keys and nonfinite constants reject. A declaration cannot prove
asset licensing; inspect provenance yourself. Use a trusted, private local build
folder; no browser ZIP parser or automatic network/download/install path exists.

From the repo root:

```sh
python graphics-prototype/tools/create_pack.py /tmp/frontier-prototype-v1.zip
python graphics-prototype/tools/pack.py validate /tmp/frontier-prototype-v1.zip
python graphics-prototype/tools/pack.py build /tmp/frontier-prototype-v1.zip /tmp/my-reviewed-pack
```

Destination must be NEW; no merging/overwrite of an existing pack. Never point it
at production deployment folders. Review generated files before copying them into
a new versioned static folder. Runtime uses only the bundled stock folder; custom
pack activation is not implemented. Invalid/missing tiles fall back to neutral
materials. Original procedural shapes and original game renderer remain fallbacks.
All five new generated tiles and prototype geometry are original contributions
under CC0-1.0; code uses repository terms. No third-party assets were downloaded or
redistributed. Existing repo assets keep their existing licenses; licensing of old
textures/models was not established, so they are not bundled into this ZIP.
