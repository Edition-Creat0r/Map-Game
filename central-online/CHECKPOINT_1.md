# Checkpoint 1 — backend prepared; deployment gate blocked

Branch: `feature/0.4.1-central-world-online`, from Modern Frontier `bc8945d3deeb99d1074d341c1eccd11ad59a6d82`. This delivery stops at Checkpoint 1. **No main merge, no live database write, no activated multiplayer spending.**

## Implemented

- Reviewable three-step Supabase/PostgreSQL migrations: private persistent accounts, exact ledgers, shared buildings, operation receipts, resumable targets, request limits and exact delta audit history; canonical rule pinning; coordination with legacy capital writes.
- Privileged context/commit/region/status RPCs; no direct anonymous/authenticated table or RPC access. New tables use FORCE RLS. Existing auth/claims/capitals/membership policies are not rewritten.
- Intent-only Edge backend with genuine JWT verification planned through GoTrue, email verification and existing protected Central-session heartbeat; explicit origins, size/deadline limits, service-only writes and safe error responses. The production adapter is implemented but not connected to a live project here.
- Existing server-isolated rules: 121 material IDs, 125 economy definitions (120 industrial + five starters), six eras/seven research nodes, exact BigInt accounting, authoritative terrain, input/worker/power/upkeep constraints. All are frozen from the unchanged validated game sources, with individual hashes in `backend/generated/manifest.json`.
- Atomic purchase+building+index+receipt+audit, same-ID replay, immutable intent, compare-and-swap retries, serialized collision checks, ownership rechecks, canonical footprints and capital reservations. Request-supplied balances/production/time/ownership/terrain are rejected.
- Durable bounded computation with **no elapsed-time cap**; HTTP 202 resumes the same trusted target. Reconnect status discovers only the caller's pending intents and recent completed receipts. Different accounts cannot read each other's ledgers/history.
- Separate Central account scope; no SP save imports or transactions. Central production currently stays at 1× until a trusted active-bonus policy is reviewed; **SP 1.2× is preserved**, including proportional recipe inputs.

## Actual access and deployment status

No Supabase admin tool, project/database credentials, deployed schema/RLS/RPC source or authorized staging endpoint/account set was available. Consequently **the actual project schema and security policies were not inspected or certified**, no migrations were applied there, and no two genuinely authenticated staging accounts were tested. Client source only establishes expected legacy names and columns. Prepared scripts fail closed on incompatible or unconfigured backend conditions.

The SQL tests run in real PostgreSQL 16, but their legacy tables and auth users are explicitly synthetic. HTTP tests inject auth/session results. This validates the new SQL transaction/role behavior and protocol implementation, **not GoTrue, deployed legacy policies or a secure production multiplayer system**. Both Edge and database enable flags default OFF; the game still has its existing SP-only economy guards.

## Tests

| Check | Actual result |
|---|---|
| Fresh PostgreSQL migration application | Three migrations apply with ON_ERROR_STOP; default enabled=false |
| Backend/SQL/protocol suite | **17 passed, 0 failed** |
| Existing deterministic game suite | **101 passed, 0 failed, 0 skipped** |
| Deno TypeScript/entry module check | Passed |
| Actual Deno server entry, disabled mode | Passed: 503 by default, unapproved origin rejected |
| Normal live-CDN browser startup | **Blocked**: Babylon CDN CONNECT HTTP 403 from environment proxy; startup timed out |
| Explicit cached-library Modern Frontier browser | Passed at 1366×768, 1440×900 and 1920×1080; errors/HTTP-failure/request-failure arrays empty |
| Explicit cached-library C1 gameplay browser | Passed; research/materials, construction, persistence and navigation regressions retained |
| Real staging, signed-in two-user security, deployment | **Not run / blocked** |
| Capacity / p95 server actions / Chromebook FPS | **Not measured**; Checkpoints 5–6 |

The 17 backend cases cover disabled/auth/session/origin/body limits; real SQL permissions; catalog/grid references; exact purchase and immutable replay; ownership and research bypass; concurrent duplicate/overlap/spending; insufficient resources; capital exclusion/ownership loss/missing trigger; shared projection privacy; uncapped constrained reference agreement; injected transaction rollback; capital-vs-factory races; stale/null revisions, invalid receipts/ledger and future checkpoints; mixed scarce-input exact reference; partial target persistence; combined read/write rate limiting; and reconnect/history isolation.

The existing constrained solver's 1.2× behavior remains covered, while the new Central handler does not trust client activity to award it. No renderer/economy performance improvement or 100-player capability is claimed. The Modern Frontier cold-pan/zoom performance review remains open.

## Browser dependency failure and fallback

The proxy rejects the existing Babylon origin with HTTP 403; normal TLS checks were retained. Supabase's jsDelivr SDK remained reachable. No application URL, CA, personal trust store or TLS setting was changed.

The cached tests explicitly use previously downloaded **Babylon 9.32.0** and loaders, with recorded SHA-256 fingerprints. They validate unchanged application behavior and do not prove current live-library compatibility or deployed loading. Test preloader is opt-in and never silently replaces CDN loading. Cached JS files are not committed. See `backend/tests/cached-browser.cjs` and `backend/README.md`.

## Files and maintainer deployment steps

[Full implementation, API, isolation, migration, rollout and rollback instructions](backend/README.md).

1. Obtain an authorized isolated staging project and two real verified test accounts. Run `backend/preflight.sql` privately as its owner. Review actual legacy columns, roles/memberships, FORCE/RLS/grants, realtime access, claim/recovery permissions and all three protected-session RPCs. Resolve differences first; do not weaken RLS or authentication.
2. Review and apply `backend/migrations/001_backend.sql`, `002_pin_rules.sql`, `003_legacy_coordination.sql` in order through established migration tooling. Keep settings OFF. The third migration adds a real capital coordination trigger and must be reviewed against actual legacy behavior.
3. Deploy `central-economy` from `backend/supabase/functions/central-economy/index.ts` with `backend/supabase/config.toml`; retain gateway JWT checks. Configure only server-side staging URL/public key/service key/explicit origins; leave `CENTRAL_ECONOMY_ENABLED=false`. No real secrets belong in git or browser assets. Actual Supabase CLI bundling/deployment is not tested here; local Deno compilation/entry is.
4. Review canonical seed alignment, legacy capital/backfill and ownership-transfer reconciliation. Missing/moved ownership pauses settlement rather than fabricating entitlement. Historical transfer reconciliation is not implemented. Verify Central clients independently use the server seed rather than a custom SP seed before enabling any client capability.
5. Deliberately enable only authorized staging after those checks; test real users, concurrent/replayed purchases, permission/collision/research/clock attacks, request retries and interrupted catch-up. Review exact database receipts/deltas, and repeat denied REST/RPC/realtime cross-user requests. No frontend switch is enabled by this delivery.
6. Use `backend/rollback-disable.sql` and Edge flag OFF to stop without deleting any committed balances/buildings/receipts/audit. Preserve idempotency tombstones. No destructive production rollback is supplied.

New code files: `backend/engine.mjs`, `handler.mjs`, `build-bundle.cjs`, `build-release.mjs`, `generated/rules.mjs`, `generated/manifest.json`, `supabase/config.toml`, `supabase/functions/central-economy/index.ts`, `.env.example`, the three migrations, `preflight.sql`, `rollback-disable.sql`, `README.md`, and `tests/{bootstrap.sql,postgres.cjs,backend.test.cjs,run-postgres.cjs,deno-entry.test.ts,cached-browser.cjs}`. Only checkpoint status/report documents change outside that new backend directory. Existing Modern Frontier/runtime/save/asset files remain byte-identical.

## Reproduction / local artifacts

```sh
node central-online/backend/build-bundle.cjs
node central-online/backend/build-release.mjs
node central-online/backend/tests/run-postgres.cjs /tmp/mapgame041-postgres
node --test tests/*.test.cjs
```

The local runner uses a disposable PostgreSQL container with no network, published ports or host volumes. Test-only `trust` configuration is never a Supabase deployment setting. It waits for the final server after image initialization, applies synthetic fixtures and migrations, runs the tests, and cleans up.

Deno check image: `denoland/deno:alpine@sha256:75749604f68aea01d39bead15fd1c86343639e44eb8c58ab051da8a924799d01`. Run `deno check backend/supabase/functions/central-economy/index.ts`; `deno test` for `backend/tests/deno-entry.test.ts` requires the read-only package mounted at `/backend`, with run/env/net permission within a network-isolated container. No external dependency/TLS bypass is needed for these native-runtime checks.

Artifacts: `/workspace/central-online/checkpoint1/`. Final SQL suite: `verified/tests.log`; existing suite: `existing-automated.log`; Deno: `deno-check-final.log`, `deno-entry-final.log`; cached browsers: `browser-cached/results.json`, `c1-cached/phase-c1-browser.json`; failed normal startup: `browser.log`; unchanged-source audit: `source-audit.json`. Earlier failed/corrected test iterations remain separate. An ambiguous SQL variable and Docker temporary-server readiness race were caught and corrected before the final runs.

**Outcome:** Checkpoint 1 implementation/preparation completed for review; deployment/security/normal startup gates remain blocked. Main unchanged. Checkpoints 2–6 not started.
