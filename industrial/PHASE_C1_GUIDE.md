# Phase C1: beginner progression and compatibility

The approved amendment is recorded in `PHASE_C1_SPECIFICATION.md` and `RELEASE_PLAN.md`. C2–F are not implemented.

## Architecture and catalog

`player-materials.json` is the frozen version-1 manifest, listing all 100 selected canonical IDs, acquisition buildings, explicit research requirements, eras and visibility. `PLAYER_MATERIALS.md` lists the selection and all 21 exclusions with reasons. All 121 internal IDs, aliases, Phase B prices and recipes are unchanged. No casing corrections were needed. Selection is fixed data, never sorted by translations or inferred by the running game. The excluded products are ten defense products, ten specialized aerospace outputs and industrial robots. Selected production and construction dependencies remain closed; excluding an upstream aerospace component does not break any selected consumer.

`research.json` defines seven nodes with Money costs, prerequisite IDs, material and factory effects and era milestone effects. `build-progression.cjs` generates the two browser mirrors. `progression.js` validates references, counts, quotas, acquisition dependencies and the DAG once at startup; the same policy loads in the worker. It contains no terrain, forest, rendering or Supabase operations.

The original catalog's availability, eras and 60 advanced technology references remain unchanged as historical/planned metadata. The active C1 policy replaces the old static 56-industry purchase policy: selected output materials, every input/purchase material, and the sector's introductory research must be unlocked. All excluded outputs remain future content for fresh purchases. Defense definitions cannot be purchased or simulated. New advanced factories carry a transaction-written `progressionAcquired: 1` marker and an exact pinned contract. Formerly inactive future definitions in old saves stay inactive; C1 does not activate them merely by loading the save.

## Progression and balance

Research is a one-time Money transaction, not a new research currency or timer. Costs are base currency with no production bonus. Replays cannot charge twice. Costs total $12,000, against the unchanged $400,000 fresh balance. Housing, power and commercial income remain available without research. Normal commerce can fund all research; no minigames or privileged rewards are required.

| Research | Prerequisites | Money cost | Factory families |
|---|---|---:|---|
| Basic Industry | None | 500 | Chemicals; prerequisite root |
| Mining and Refining | Basic Industry | 1,000 | Extraction and refining |
| Construction Technology | Basic Industry | 1,000 | Construction materials |
| Electricity | Mining and Refining | 1,500 | Research/era prerequisite |
| Urban Development | Construction Technology | 2,000 | Consumer goods |
| Electronics Foundations | Electricity | 3,000 | Electronics |
| Industrial Machinery | Mining and Refining, Electricity | 3,000 | Machinery and vehicles |

Era milestones are cumulative, permanent once earned, and use population, constructed buildings and research. Constructed counts include housing and utilities, deliberately making every milestone achievable through starter gameplay. They are introductory goals, not the final Phase D civilization balance. All 100 acquisition paths are tested without assuming free dependency goods.

| Era | Additional / cumulative materials | Residents | Buildings | Required research | Selected industry licenses with all introductory research |
|---|---:|---:|---:|---|---:|
| Settlement | 10 / 10 | 0 | 0 | None for initial materials | 6 |
| Industrialization | 15 / 25 | 10 | 2 | Basic Industry | 24 |
| Electrification | 20 / 45 | 20 | 4 | Electricity | 44 |
| Mass Production | 20 / 65 | 30 | 6 | Industrial Machinery | 64 |
| Information Age | 20 / 85 | 40 | 8 | Electronics Foundations | 84 |
| Global Superpower | 15 / 100 | 50 | 10 | Urban Development | 99 |

Actual visibility also requires each material's own research. Reaching an era does not grant referenced materials, stocks or research. The five starter contracts are additional to the industry counts. Fresh saves initially unlock exactly the ten specified IDs; initial inherited Iron stock is retained in Legacy Inventory until Iron is unlocked.

## UI and priorities

Singleplayer navigation is Build, Industry, Research, World and More. More preserves the original planner, roads, capital, settings, economy and other actions. The existing Home authentication and Singleplayer interfaces remain available. Default shop views show available entries; Discover/Research, search, sector filters and optional details expose locked definitions. The shop renders at most ten entries, with cached search strings. Closed panels do not rebuild catalogs. The Next Goal panel keeps Money, Steel, Carbon, Energy and Population visible and leads through housing, power, commerce, research and growth.

Ordinary inventory lists unlocked selected materials, including zero balances. Legacy Inventory exposes positive excluded or still-locked balances. Returning players' acquired selected materials remain visible through their explicit legacy capability exception. Discover explains future research/era and acquisition requirements.

Manual operating order is the default and preserves prior simulation order. Applying the optional automatic plan settles elapsed time and pending partial production first, then stores a deterministic row-ID order. It favors power, housing and money production, then factories with current inputs and lower worker/power/upkeep burden. The plan is a snapshot: it does not repeatedly reorder during rendering or every tick. Reapply after changing a city, or choose Manual and apply to restore saved construction order. The guarded exact solver still enforces actual inputs, money, workforce and power every tick; a priority is never permission to fabricate goods. New rows follow existing plan IDs in stable construction order. Warehouses and throughput constraints do not yet exist.

## Migration and rollback

Economy schema is 4, material registry remains 1, progression and manifest versions are 1. This is an additive migration from schema 3 and older. All exact ledger strings, stocks, unknown fields, building coordinates/IDs/styles, pinned contracts, checkpoints, pending visibility time and Singleplayer claims remain intact. No save keys or world formats change. Schema-2 industrial-ID collisions keep their inherited inactive flag. Legal pre-progression factories grant only their required material and repurchase capabilities; positive acquired stocks grant only their own material capability. No unrelated technology or higher era is granted. Progression starts in Settlement with no completed research; current construction/population can satisfy future milestones once research is acquired. Era awards never withdraw after a later population loss.

Known legally acquired Phase B factories continue operating under their original pinned recipes even when the new player's research is incomplete. New factories cannot use that exception through spoofed UI data: the API resolves the registered definition, verifies the policy, charges exact actual costs, and pins the actual recipe. Unknown future economy/progression/manifest versions and malformed prerequisites fail closed without overwriting source saves. Local storage remains editable by its owner and provides no multiplayer authority.

**Back up before upgrading or downgrading.** Export both origin-local storage values `mapgame_economy_021e` and `mapGame_alpha021_firstPlayable` (also preserve `mapgame_world_seed` if set) through browser developer tools while the game is stopped. Keep the exports outside the repository. There is no automatic destructive conversion or silent rollback. To downgrade to Phase B, restore the complete pre-C1 economy and world backups together after stopping/closing all game tabs; do not simply change the schema number. Phase B deliberately refuses schema-4 saves. Changes made since that backup will not be available after restoration. Backups can contain ownership/profile information and should remain private.

## Explicit limitations

No warehouse capacity, transport, services, upgrade levels/effects, specialization effects, advanced research, achievements, district/style selection or defense activation was added. Seven research nodes and small era thresholds are an introductory fixed-cost layer. No minigame was implemented: the frozen disabled future interface has no reward callback or economy write. No multiplayer transactions, SQL, ownership, auth or server permissions changed. The inherited 10^12 stock safety ceiling still applies; offline elapsed time has no cap. Local clock manipulation cannot be authenticated offline. Large-city JSON commit/drawing work still causes occasional main-thread stalls. Basic/Regular rendering separation and all terrain geography/forest candidate identities are retained.
