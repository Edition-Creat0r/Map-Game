# Checkpoint 00 — foundation audit

Inspected 2026-10-27. This is a source and prior-evidence audit, not verification of a production backend or deployed website.

## Source provenance

`git ls-remote origin` confirms:

- `main`: `49b7dcac7395c409b2343c42b6efd5924394cb86`.
- `feature/0.3.4-industrial-revolution`: `dfbe4ff66eb5f69179562fa577a156b44dbb424a`.
- `feature/0.3.4-visual-restoration`: `9111c239971fea1a27d11756490593b5cce63b43`.

Created `feature/modern-frontier` directly from the last of these. It includes A/B/C1 and the three visual-restoration commits. Existing remote-tracking industrial metadata was stale (`122e575`); the direct remote query, not that stale local label, establishes the current remote tip. No main merge/deployment is implied.

## Reusable presentation and environmental assets

- `visual.css` / `visual_ui.js`: navy/cyan tokens, resource strip, labels, material badges, deterministic SVG footprint previews, focus trap/return and theme/density preferences (`mapgame_visual_preferences_v1`). Extend these without double-installing handlers or hidden-dialog keyboard traps.
- `economy_ui.js`: actual catalog/cost/recipe rendering, ten-card pagination, search, locked states, Legacy Inventory, unchanged-DOM render signatures. Replace layout incrementally, retaining real adapter transactions.
- `industrial/progression-ui.js`: seven actual prerequisite nodes, SVG links, announcement/focus behavior. This is research, not an advancement reward engine.
- `index.html` static home loads before generation; `game.js` also has a fallback `createHome` template. Home actions currently bind `mgStartSingle` / `mgJoinCentral`; preserve IDs/handlers or explicitly refactor and test both paths. Existing `mgSettingsPanel` is moved outside Home by `visual_ui.js` so entering a world does not destroy Settings.
- `forest.js` / `forest_renderer.js`: fixed global candidate records, continuous LOD and cached atlas/viewport layers. Preserve 120 tiles / 8,192 records and root/species identity; use lightweight existing imagery for home scenery without starting a second terrain renderer.
- `basic_world.js`: medium rasters upgraded incrementally to detail, texture decoding once, bounded cache and stable mirrored sampling. `environment.js`, `world_terrain.js`, `hydrology.js`, `water_renderer.js` remain authoritative/shared as before; drainage decoration is not construction water authority.
- Art: 17 transparent tree PNGs, eight terrain sources including grass/dirt/sand/rock/snow/wet ground/dry plains, building/road JPG/WebP material textures, one sedan GLB. No dedicated evergreen PNG or 120-building thumbnail library. Reuse cached procedural evergreen atlases and coherent 2D footprint/component illustrations; no unrelated stock art.
- No checked-in audio assets or service-worker implementation found. Lightweight optional UI synthesis needs gesture gating/mute. Do not claim app-shell or full-game offline availability based only on cached images. Current home offers no trustworthy live server status or new social features.

## Economy/progression contracts

Inspected `economy.js`, `economy_model.js`, `economy_worker.js`, `buildings.js`, `industrial/registry.js`, catalog/material/research data and A/B/C1 migration/validation documents.

- Registry v1: **121 internal materials**, **120 industrial building definitions** plus **five starter contracts**. Player manifest v1: **100 selections**, **10 initially unlocked**. Progression v1: **six eras**, **seven introductory research nodes**. Existing tests validate references/aliases/DAG/conservation and legacy contracts.
- Current economy schema **4**, exact ledger scale `300000000000n`. Uncapped elapsed-time solver, constrained input/workforce/power/upkeep, stable contracts and online **1.2×** production/input throughput remain the source of truth. No economic rebalancing or save migration in this checkpoint or presentation-only work.
- Canonical origin-local keys: `mapgame_economy_021e` and `mapGame_alpha021_firstPlayable`; preserve `mapgame_world_seed` when set. Unknown fields and legacy records must survive. Economy adapter owns transactions, writer protection, settlement and persistence; home summaries must be read-only, and UI must not manufacture purchases by editing storage.
- `game.js` currently blocks economy construction outside Singleplayer; `economy.js` is enabled only for Singleplayer. Preserve both guards. Actual placement is explicit, terrain/footprint validated, and paid through existing transaction paths. Catalog definition presence is not proof of current playability: retain current availability and technology rules.
- Current C1 research/priority changes settle old-state elapsed time. Full upgrades, warehouse network limits and advancement reward rules are not implemented; disabled foundation UI must not activate them.
- A locally edited save/clock cannot provide multiplayer anti-cheat. Existing clock guards do not establish trusted UTC. Do not extend local-ledger trust into Central World.

## Authentication, ownership and social audit

- `auth.js` wraps Supabase email/password authentication, verification, password reset/update and session subscriptions. The browser key is explicitly publishable; no privileged credentials should be introduced. Live database policy is not represented by that client key.
- `multiplayer.js` tracks `central` membership/presence/claims/capitals with realtime state and RPCs `map_game_start_session`, `map_game_session_heartbeat`, `map_game_end_session`. It reads/writes `world_members`, `territory_claims`, `capitals`, including legacy ownership recovery. Preserve current behavior until a separately tested server contract replaces it.
- Username display comes from user metadata, with an email-prefix fallback. No demonstrated server-enforced case-insensitive uniqueness, reserved-name rules or two-hour rename cooldown exists in this repository. Do not present those as available.
- No implemented friends, private-message, block/report/moderation, account deletion or secure multiplayer economy module found. Presence is not a friends/privacy system. No checked-in SQL migrations, RLS definitions, RPC source or server economy implementation found. Consequently actual authorization cannot be certified from this source checkout.
- Backend checkpoint prerequisites: authorized staging access; current schema/grants/RLS/RPC/realtime policy inspection; reviewed migrations/rollback; account-data retention/deletion policy; two isolated test users and adversarial test environment. Never probe other users' private data or run live schema changes merely to make a frontend work.

## Architecture direction (not implemented here)

UI modules should consume existing immutable/catalog views and adapter methods, with namespaced preference storage and lifecycle cleanup. Static structured update/feature content should cite real source states and distinguish implemented-on-branch from released/deployed; no invented dates, live player counts or shipped status.

Advancements should use a separate, world-specific versioned namespace and stable objective/event/completion IDs. Research remains the technological prerequisite authority. Record verified committed SP events; reconcile only objectively provable historical state and never invent past rewards. Store completion/reward marking atomically with any actual reward; default to no economic rewards until a reviewed rule exists. Cross-tab/replay/import must not grant twice. Review additive persistence before implementation.

Multiplayer economy design should use an authenticated world/account scope, canonical server catalog/contracts, trusted timestamps/checkpoints, operation IDs with unique constraints, serialized account settlement plus placement collision/territory checks, atomic debit+insert, and event auditing. The client sends intent, not balances/output/time. Worker/power/upkeep/input constraints and elapsed time must be conserved by bounded resumable settlement. Online bonus requires an explicitly defined trusted active-session policy, not browser visibility. This is a design direction only; database locks/constraints and authoritative terrain service must be selected and tested against the actual backend. No secure-MP release claim until deployed end-to-end adversarial validation.

World backups should snapshot economy+world+seed consistently while simulation/writers are paused, preserve unknown fields, exclude auth tokens, validate size/schema/references before changes and retain a pre-import backup with failure recovery. Existing single-world saves must not be deleted for a New World button. No fake downgrade by editing schema version.

## Baseline evidence and limitations

The previous frozen visual run at `9111c23` is retained at `/workspace/map-game-visuals/verified/`: all 12 inherited release suites plus visual UI/screenshots passed, 91 automated tests, empty reported browser error/request-failure arrays. Local SP screenshots and exact camera metadata are available in `/workspace/map-game-visuals/COMPARE.html`; these are not Central World or deployment evidence.

Historical software-WebGL medians: startup 1,749 ms, territory entry 969 ms, high-detail ready 1,917 ms; World pan 60 FPS, local pan 59.6, zoom 58.0, detail pan 59.2; p95 approximately 16.8 ms. Recorded maximum long tasks 182–229 ms; 10,000 mixed-industrial-record 1,000-year catch-up 960 ms. These are inherited measurements, not newly rerun metrics for Modern Frontier. Add matched new runs after runtime changes, not unsupported performance claims.

The previous economy-performance review, merge gates and backend/Pages verification limitations remain open requirements. Signed-in Central World was not validated in that visual run. No deployment is tested by this audit. New fresh checkpoint-00 test results are recorded separately in CHECKPOINT_00.md.
