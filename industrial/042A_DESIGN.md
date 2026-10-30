# 0.4.2A — Retain and extend industrial design

Branch `feature/0.4.2-industrial-expansion`; parent release `d62525e` is retained, not reset or reverted. Singleplayer only. No Supabase, authentication, server, ownership or main changes.

## Verified catalog and immutable manifests

| Content | Retained release | Additional | Active total |
| --- | ---: | ---: | ---: |
| Internal materials | 127 | 12 | **139** |
| Industrial definitions | 128 | 12 | **140** |
| Starter contracts | 5 | 0 | **5** |
| Player-facing materials | 106 | 12 | **118** |
| Excluded internal IDs | 21 | 0 | **21** |
| Distinct research nodes | 10 | 4 | **14** |

All original 121 material identities, 120 factories and seven research records are preserved, as are the six materials, eight factories and three licenses from d62525e. New IDs have no material/alias/building collisions. Carbon is not renamed to graphite; ordinary glass/copper cable/resin/chassis/optical-equipment entries remain distinct and unchanged. Defense and other excluded content remain locked under the existing policy.

The exact original 100-material `player-materials.json` is restored byte-for-byte from Modern Frontier. Its six retained additions are moved unchanged to `player-materials-042.json`; the twelve new entries live in `player-materials-042a.json`. Generated browser mirrors are loaded in that fixed order in both page and worker. `composeManifests` rejects duplicates, unsupported versions and order/count mismatches. No prior material is discarded: the active immutable manifest is **100 + 6 + 12 = 118**, with the original excluded list.

## Research reconciliation

`advancedMetallurgy` is reused **unchanged**: original ID, $8,000 cost, prerequisites, era and prior purchased/completed state. There is no second purchase, refund or extra steel/carbon charge from the superseded initial draft. Nickel/manganese sites reference that existing license; their four materials become available to its existing owners at the proper era. The original ten research records stay identical; effective UI license counts are derived from the current manifest/factory requirements rather than rewriting the old records.

Four IDs are appended: `advancedMaterialsScience`, `precisionManufacturing`, `opticalEngineering`, `telecommunications`. Mechanical Precision Manufacturing is distinct from the retained electronic Precision Fabrication.

| License | Earliest era | Prerequisites | One-time cost |
| --- | ---: | --- | --- |
| Advanced Metallurgy | 3 | miningRefining, constructionTechnology | 8000 money |
| Advanced Materials Science | 3 | advancedMetallurgy, basicIndustry | 12000 money, 6 nickel, 6 manganese |
| Precision Manufacturing | 4 | advancedMaterialsScience, industrialMachinery | 18000 money, 12 graphite, 6 bioResin |
| Optical Engineering | 4 | precisionManufacturing, electronicsFoundations | 18000 money, 6 thermalComponents, 6 precisionCastings |
| Telecommunications | 5 | opticalEngineering, urbanDevelopment | 30000 money, 20 fiberOpticCable, 8 machineFrames, 8 thermalComponents |

Bootstrap order: old Metallurgy → nickel/manganese production → Advanced Materials Science → graphite/bio-resin → Precision Manufacturing → castings/thermal components → Optical Engineering → optical glass/cable; frames become available at era 5. Telecommunications is a material-funded capstone recording completion, not a new networking simulation or hidden production multiplier. Pilot cable production is licensed by Optical Engineering first, preventing a self-funding research deadlock. Research and construction costs are included in the load-time reachability validator, not just recipe cycles. Later-era prerequisite/cost inconsistencies are rejected.

## Twelve fixed version-1 recipes

Rates below are per minute offline. Visible-online Singleplayer multiplies **both inputs and outputs** by 1.2. Power, workers and upkeep retain existing unboosted semantics. Each site additionally costs 6 steel, 2 carbon, 12 concrete and 6 glass; further component costs are listed separately. Existing renderer/model references are reused.

| Factory | Era | Money | Inputs/min → outputs/min | Power | Workers | Upkeep/min | Footprint |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| Nickel Mine | 3 | 42000 | paid extraction → 12 nickelOre | 4 | 4 | 5 | 56×48 |
| Nickel Refinery | 3 | 85000 | 12 nickelOre, 3 carbon → 6 nickel | 8 | 6 | 8 | 64×54 |
| Manganese Mine | 3 | 40000 | paid extraction → 12 manganeseOre | 4 | 4 | 5 | 56×48 |
| Manganese Refinery | 3 | 80000 | 12 manganeseOre, 3 industrialAcid → 6 manganese | 7 | 6 | 7 | 64×54 |
| Graphite Mine | 3 | 45000 | paid extraction → 12 graphiteOre | 4 | 4 | 5 | 56×48 |
| Graphite Purification Works | 3 | 90000 | 12 graphiteOre, 3 industrialAcid → 6 graphite | 8 | 6 | 8 | 64×54 |
| Bio-resin Works | 4 | 130000 | 4 naturalGas, 2 fertilizer, 1 industrialSolvent → 3 bioResin | 9 | 6 | 9 | 64×54 |
| Precision Casting Works | 4 | 160000 | 6 steel, 2 nickel, 2 manganese, 1 bioResin → 3 precisionCastings | 10 | 8 | 10 | 64×54 |
| Machine Frame Works | 5 | 210000 | 3 precisionCastings, 3 beams → 3 machineFrames | 10 | 6 | 10 | 72×60 |
| Thermal Component Works | 4 | 150000 | 3 graphite, 3 copper, 3 aluminum → 3 thermalComponents | 10 | 6 | 10 | 64×54 |
| Optical Glass Works | 4 | 180000 | 6 glass, 3 silica, 1 thermalComponents → 3 opticalGlass | 12 | 8 | 12 | 64×54 |
| Fiber-optic Cable Works | 5 | 240000 | 3 opticalGlass, 3 plastic, 2 copper → 3 fiberOpticCable | 10 | 6 | 10 | 72×60 |

Additional construction components: casting works 4 nickel; frame works 6 precision castings; thermal works 6 graphite; optical glass works 4 thermal components; fiber-optic works 6 optical glass. Those costs are bootstrappable from earlier licensed sites. Material units are game units, not a claim of chemical mass equivalence. Bio-resin explicitly approximates gas fermentation using natural gas carbon feedstock, fertilizer nutrients and solvent processing; no unavailable biomass, agriculture or hydrology is invented. Thermal components represent consumable furnace/process parts. Mining follows the existing paid extraction abstraction, not new geological/per-pixel simulation.

## Actual consumers

| New material | Producer | Production, construction or research consumers |
| --- | --- | --- |
| nickelOre | Nickel Mine | Nickel Refinery (production) |
| nickel | Nickel Refinery | Precision Casting Works (production); Precision Casting Works (construction); Advanced Materials Science (research) |
| manganeseOre | Manganese Mine | Manganese Refinery (production) |
| manganese | Manganese Refinery | Precision Casting Works (production); Advanced Materials Science (research) |
| graphiteOre | Graphite Mine | Graphite Purification Works (production) |
| graphite | Graphite Purification Works | Thermal Component Works (production); Thermal Component Works (construction); Precision Manufacturing (research) |
| bioResin | Bio-resin Works | Precision Casting Works (production); Precision Manufacturing (research) |
| precisionCastings | Precision Casting Works | Machine Frame Works (production); Machine Frame Works (construction); Optical Engineering (research) |
| machineFrames | Machine Frame Works | Telecommunications (research) |
| thermalComponents | Thermal Component Works | Optical Glass Works (production); Optical Glass Works (construction); Optical Engineering (research); Telecommunications (research) |
| opticalGlass | Optical Glass Works | Fiber-optic Cable Works (production); Fiber-optic Cable Works (construction) |
| fiberOpticCable | Fiber-optic Cable Works | Telecommunications (research) |

Frames and fiber cable currently have finite capstone research demand, not an implemented market or infinite sale income. This purpose is implemented via actual stock consumption, not a future-only definition. The exported dependency graph now includes research consumers, so these leaves are not silently shown as unused.

## Save/upgrade compatibility and rendering safety

- Economy schema stays v4 and catalog/registry schema v1. The **composed progression manifest** is version 2; original base/extension source schemas remain version 1.
- Both original 100-material and d62525e 106-material saves use the supported old manifest marker 1. Initialization validates and upgrades that marker to 2, detaching the progression JSON before later mutation. Completed research, era, priorities, unknown fields, all existing exact ledgers and pinned recipes are retained; no earned progress is reset. Missing new stock starts at zero.
- Unsupported manifest markers (>2), unknown research and new research masquerading as an old marker fail closed. Older builds are not promised to load new-version saves: keep a backup before switching builds.
- Factory recipe IDs/versions and all prior prices remain unchanged. New recipes use unique version-1 IDs. Saved levels, styles and specialization metadata are preserved; no new upgrade effects are implemented or retroactively applied.
- The exact numerical engine is unchanged. Incremental catch-up, offline elapsed time, input/upkeep/worker/power constraints, online bonus and atomic purchases continue through existing APIs.
- Page/worker imports and cache tags are updated together. Validation/composition and effective license metadata are computed at module load. No new world/terrain/forest frame-loop code, assets, noise sampling or Supabase writes.

## Studio scope

[Minigame Studio requirements](MINIGAME_STUDIO_REQUIREMENTS.md) are planning only: multi-file projects/assets, isolated responsive/fullscreen player, accurate diagnostics and Debug Reports, reviewed patches/history, safe publishing/discovery/donations and optional sarcastic/secret/high-difficulty advancements. None of that editor, hosting, payments or sandbox code is implemented here. Existing minigame reward reservation remains disabled.

See [validation and performance](042A_VALIDATION.md) for actual test evidence and limitations.
