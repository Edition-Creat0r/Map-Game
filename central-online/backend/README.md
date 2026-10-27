# Checkpoint 1 — review-only Central economy backend

**Not deployed. Multiplayer purchases remain disabled in the game.** This package is for an authorized maintainer's isolated staging review. Existing Singleplayer UI, saves, economy and authentication/ownership clients are unchanged. Checkpoints 2–6 have not started.

## What exists

- Server-only frozen copy of the exact validated 125 starter/industrial contracts, 121 canonical materials, six-era/seven-node progression and shared authoritative terrain. Generated sources are trusted repository code, not client-provided executable input. `generated/manifest.json` records each source SHA-256 and a rules fingerprint.
- Fresh account-linked Central ledgers, completely separate from origin-local SP saves, with exact BigInt ledger strings and pinned contracts. Initial stocks/costs follow existing defaults; no client save import.
- Intent-only HTTPS Edge handler: GoTrue user verification, confirmed email, existing protected Central-session heartbeat, explicit origins, bounded JSON, body/network deadlines. Only privileged server code can call the new service RPCs.
- Trusted database time, capped **computation per request**, uncapped **elapsed-time settlement**, durable pending target, compare-and-swap retries, atomic debit/build/index/receipt/audit and stable operation identity. Failed construction consumes no purchase cost; ordinary elapsed production/input/upkeep still settles under the existing rules.
- Authoritative ownership recheck/row locks, shared building collision coordination, existing capital reservations, protected 3×3 central district, canonical quarter-turn footprints, authoritative water/slope checks and unlock/stock constraints.
- Read-only shared territorial building projection for verified Central members; it excludes private ledgers/contracts. Exact resource deltas/audit records and idempotency tombstones are private.

**Online policy:** Central settlement currently uses 1× only. No unverified browser visibility or heartbeat is treated as proof of active production. The SP 1.2× multiplier remains unchanged and tested. A trusted multiplayer-active-bonus policy remains a reviewed deployment prerequisite if that bonus is required for the playtest; this package does not silently invent one.

## Actual audit/access status

This environment has no Supabase administration connector, project/database credentials, schema dump, deployed RPC definitions or RLS policy source. The client supplies expected names/columns (`world_members`, `territory_claims`, `capitals`, protected-session RPCs), not proof of their actual deployed constraints/authorization. **No live metadata or user rows were queried.** Local PostgreSQL uses an explicitly synthetic compatibility schema; local HTTP tests inject authentication/session results. They are not real Supabase accounts or staging security certification.

An authorized maintainer must run `preflight.sql` against an isolated authorized staging clone, privately review its output and reconcile every expected legacy contract before applying migrations. In particular, confirm claims cannot be created/transferred/recovered for another account; membership cannot be used to bypass eligibility; heartbeat binds the session and world to `auth.uid()`; function search paths/grants are safe; realtime/REST cannot leak private records; and service keys never reach browser bundles.

## Files / deployment order

1. `preflight.sql` — metadata-only inspection of columns, RLS, grants, ownership, triggers and the three legacy RPC definitions. This is a maintainer action, **not executed against the real project here**.
2. `migrations/001_backend.sql` — private FORCE-RLS tables and service-only context/commit/region/status RPCs. Run as `postgres` in reviewed Supabase staging; `anon`, `authenticated`, `service_role` and `auth.users` must already exist. No existing policy is changed.
3. `migrations/002_pin_rules.sql` — generated canonical materials/footprints and fingerprint; leaves the backend disabled. Re-pinning while enabled is rejected. No old contract is re-priced.
4. `migrations/003_legacy_coordination.sql` — reviewed trigger for legacy capital insert/move/delete, using the same territorial advisory lock and rejecting overlap with committed industrial buildings. It is a no-op while this economy is disabled. Context/commit refuse operation if the expected trigger is absent/disabled. This is a real proposed legacy integration change: review it before deployment, not an assumed safe live patch.
5. `supabase/config.toml` and `supabase/functions/central-economy/index.ts` — Edge entry; existing shared modules are static imports included by the bundler. Gateway JWT verification stays **on**, in addition to explicit GoTrue/session checks. Never deploy with `--no-verify-jwt`.

From the repository root, an authorized maintainer may stage the function using a reviewed Supabase CLI installation:

```sh
supabase functions deploy central-economy \
  --workdir central-online/backend \
  --project-ref YOUR_AUTHORIZED_STAGING_PROJECT
```

Apply SQL through your established reviewed migration tooling in the order above. Do not point test scripts at production. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CENTRAL_ALLOWED_ORIGINS` and `CENTRAL_ECONOMY_ENABLED=false` through **server-side** secrets (see `.env.example`; no real key belongs in git or client assets). Verify the CLI's bundled entry/imports in staging. The actual Supabase CLI deployment/bundler was not available/tested here; standard Deno compilation and the disabled entry point were checked locally.

Both the DB settings row and the Edge flag default OFF. Enable only on authorized staging after schema/policy/session/seed/legacy data review: match `generated/manifest.json`, confirm the capital trigger and private grants, set the Edge flag and DB `cw041.settings.enabled` deliberately, then perform the security matrix below. **Do not enable the frontend or production as part of applying these files.**

## Intent API (server endpoint only; game frontend not wired)

POST JSON, verified user Bearer token, explicit allowed browser origin:

```json
{"operationId":"a-new-uuid-v4","sessionId":"current-protected-central-session-uuid","action":"place","buildingId":"smallHouse","territoryId":"T_190_27","x":500,"z":500,"rotation":0}
```

`rotation` is a quarter-turn integer 0–3; coordinates are stable local units. `research` takes `technologyId`; `settle` takes no gameplay fields. `region` takes `territoryId` and `sessionId` and returns a public building projection. `status` takes only `sessionId` and returns this authenticated account’s pending intents and up to 50 completed receipts, so reconnect can discover and resume the original operation IDs. Actor, balances, ownership, costs, output amounts, time, terrain, footprint and unlock claims are never accepted from clients. UUID placeholders above must be replaced with real UUIDs.

A 202 `settling` response means a durable computation checkpoint, not a lost purchase. Retry **the same operation/intent** until terminal. The original database target is retained; no absence is discarded. Completed operations return exactly the stored receipt on retries, even after reconnect/session renewal. Same operation ID with different gameplay intent is rejected. Failed terminal operations have stable receipts and no purchase debit. Use a new ID for a genuinely new intent. 409 concurrency retry and 429 request-limit responses need bounded client backoff; never loop on every rendered frame.

## Transaction / authority notes

The Edge computation reads a database revision then computes using only stored state plus the trusted rules. Commit locks the account, validates its revision, verifies ownership and canonical footprint, serializes the territory, rechecks shared/capital collisions, and atomically commits exact state, building, operation receipt and delta audit. A conflicting stale computation is discarded and recalculated. SQL prevents unindexed building mutations, removed/replaced existing contracts, missing/negative/oversized ledger units and future/reversed checkpoints. Direct client calls/reads/writes are denied. Regional reads, status and economic requests share a 120-per-minute authenticated request limit. At most 32 pending economic intents are retained per account; reconnect should use status to resume them rather than inventing fresh IDs repeatedly.

Existing claims are SHARE-locked when checked, preventing simultaneous ownership mutation during commit. Accounts with a building whose land has transferred/disappeared fail closed for settlement instead of generating unverified income or changing ownership. An authorized historical ownership-transfer reconciliation policy/tool is **not implemented**; do not allow transfers around unreviewed checkpoints and then assume past entitlement can be reconstructed. Existing claim/recovery permissions remain a release blocker until audited.

All server actors are tied to one `central` account ledger across their Central territories. Shared records do not transfer SP money or ownership. Existing capitals reserve the same 150×150 area. Decorative drainage is never construction water authority. The server seed is pinned to 734221; before a live client capability can be enabled, Central rendering must be verified to use that canonical seed independently of a user's custom SP seed. This checkpoint does not change the existing renderer or activate client purchases.

## Reproduce isolated checks

Docker is required; no host ports, production URL, credential or host volume is used for PostgreSQL. The test runner starts a disposable network-isolated PostgreSQL 16 container, creates synthetic legacy/auth fixtures, applies all three migrations with ON_ERROR_STOP, verifies default-OFF, runs real SQL role/transaction/concurrency tests, then removes the container.

```sh
node central-online/backend/build-bundle.cjs
node central-online/backend/build-release.mjs
node central-online/backend/tests/run-postgres.cjs /tmp/mapgame041-checkpoint1
node --test tests/*.test.cjs
```

The PostgreSQL image is pinned in the runner by digest. Its test-only `trust` authentication is confined to a container with **no network, ports or volumes**; it is not a deployment configuration. The Deno check image/digest and exact command are recorded in `CHECKPOINT_1.md`. No certificate verification is disabled.

## Required staging gates still NOT RUN

- Actual schema/RLS/grants/RPC/trigger review, legacy capital/backfill/claim-recovery compatibility, canonical seed alignment and protected-session identity.
- Two genuinely authenticated accounts: replayed and concurrent purchases, insufficient combined funds, footprints/capitals/ownership races, rollback, reconnect, research bypass and read/write isolation, RPC/REST/realtime attacks.
- Long offline interruptions, exact input/upkeep/worker/power accounting and database crash/restart recovery with durable target/receipt consistency.
- Authorized staging load and real Chromebook FPS. Regional reads currently return one whole territory rather than a paged streaming protocol. No 25/60/100-player capacity or p95 claim is made here; that is checkpoint 5. Existing cold-render performance review remains open.
- Privileged secret configuration, request/session limits, operational monitoring/backoff and backups. Operations/receipts must not expire in a way that permits recharging old IDs. Review audit retention separately without removing idempotency tombstones.

Use `rollback-disable.sql` plus Edge flag OFF to stop safely. It revokes the service RPC capability and retains all balances, buildings, checkpoints, receipts and audit. Never drop the schema/receipts as an emergency rollback. Any later data or rules migration requires a reviewed compatibility path.

## Current browser-network limitation

The environment proxy currently rejects `https://cdn.babylonjs.com/babylon.js` with CONNECT HTTP 403. A normal browser regression run timed out at engine startup; this is not a TLS-trust failure, and no verification bypass was used. Supabase's jsDelivr SDK endpoint remained reachable. An explicit test-only preload (`tests/cached-browser.cjs`) reran the unchanged SP UI with existing SHA-256-identified Babylon 9.32.0/loader files from an earlier authorized download. Those cached-library checks passed but **do not certify current live-CDN or deployed-site startup**. The helper requires explicit paths, checks fingerprints and never rewrites application URLs or commits cached libraries. Live external loading must be rechecked from an allowed environment before release.
