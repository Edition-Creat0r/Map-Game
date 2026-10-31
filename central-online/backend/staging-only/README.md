# Offline security review — STAGING DRAFT, not deployable approval

Target: **upcrdvdspypoyferpuxe** only. Original application project
`vjwvhtsjdsbcorszzldk` is never a deployment target. No live databases or
credentials were used to prepare this package. Economy runtime, Singleplayer,
authentication client and ownership renderer are unchanged. Naming/Checkpoint 2
is not deployed by this package.

Latest offline follow-up: [security preparation](SECURITY_PREPARATION.md),
[local-only Windows checklist](WINDOWS_NEXT_SESSION.md), and
[private export scanner](tools/Review-LocalSchema.ps1). These supersede the older
validation counts, not the outstanding deployment approval gates.

## Evidence and dependencies

The owner supplied two metadata exports, not a confirmed complete schema-only
dump. Their reported contracts inform the draft; no raw exports or real records
are committed. All schema-dependent changes remain **DRAFT pending review of
the actual complete export**, even when isolated tests pass.

| Dependency | Known contract used / verification still needed |
| --- | --- |
| `auth.users`, `auth.uid()` | Real Supabase verified user UUID/email confirmation and GoTrue claims; fixture auth is synthetic |
| `worlds` | `id text` primary key, `name text`, timestamps; membership/claim/capital world FKs. Provision fresh approved `central` metadata, not production rows |
| `world_members` | `(world_id,user_id)` PK; username/joined/last_seen columns; auth/world FKs; self INSERT/UPDATE and authenticated SELECT policies |
| `world_sessions` | UUID session PK; world/user/device/username/created/last_seen/conflicted columns; auth FK; exported self CRUD policies; no exported world FK or actor/world uniqueness |
| `territory_claims` | `(world_id,territory_id)` PK; owner UUID, display label, timestamp; global owner unique index and auth/world FKs; self INSERT/authenticated SELECT policies. Do not silently change the one-claim rule |
| `capitals` | `(world_id,owner_id)` PK, territory FK, label length 2–32, float8 x/z and timestamp; self INSERT/UPDATE/authenticated SELECT; matching claim owner is not established by its FK |
| Session RPCs | Three- and four-argument `map_game_start_session`, heartbeat/end `(text,uuid)`, boolean results; exported SECURITY DEFINER grants and search paths |
| Existing triggers | No noninternal triggers reported for five source tables; verify the complete export for unknown hooks, views, RPCs and default privileges |
| Economy 001 | Verified account/membership, owner claim SHARE locks, capital coords, private FORCE-RLS tables/service-only RPCs; does not fix legacy grants |
| Economy 002 | Frozen 125 definitions, 121 materials, seed 734221 and release fingerprint; no repricing |
| Economy 003 | Capital coordination trigger using shared territory locks. No-op when economy OFF; the separate draft ownership guard still checks capitals while OFF |
| Realtime | Claims and capitals published; session table not exported as published. Actual subscription identity and deployed account behavior remain untested |

`preflight.sql` is an additional **read-only** single-JSON metadata bundle for
all five tables, grants (including column grants), policies, functions, triggers
and Realtime. It complements `../preflight.sql`; it is not a baseline importer.
Function bodies/defaults can contain embedded secrets: review output privately.

## Draft fixes and deliberate scope

`draft/000_staging_legacy_security.DRAFT.sql` is intentionally outside the
normal migration directory, with no auto-apply or economy-enable hook.

- Removes direct client session writes at both table and column levels, including
  prior column grants; keeps self-only session reads. Removes unnecessary client
  TRUNCATE/REFERENCES/TRIGGER privileges on the five tables.
- Both start overloads share verified Central identity, immutable foreign-session
  ownership, database timestamps and per-session/per-actor locks. Unique
  `(world_id,user_id)` enforces one session under concurrent joins. Existing
  duplicate rows fail review rather than being deleted automatically.
- Heartbeat binds actor/world/session, honors conflicted state, and refuses
  >90-second stale or future timestamps. Only explicit verified rejoin can start
  a new session. Expiry of 90 seconds follows the exported abandoned-session
  window but is now enforced on heartbeat; this behavior change needs approval.
- Join remains session-first then membership, as in the existing client. Member
  writes require a verified live session; claims/capitals also require membership.
  Grid/protected-center and claim identity are checked server-side; capital
  writes lock/check the actual claimed owner and reject invalid footprint bounds.
- SECURITY DEFINER routines use `search_path=pg_catalog`, fully qualified object
  references, private helpers and explicit grants. No service key/client role
  shortcuts or new ownership-transfer capability are added.

**Behavior requiring schema/product review:** draft is Central-only; DELETEs on
membership/claims/capitals and identity transfers require a future explicitly
reviewed removal/reconciliation path. Admin/service writes without verified user
context also fail these triggers. Existing claim/capital recovery and future
deletion flows must be tested against actual policy. No complete recovery tool,
session abuse-rate limiter or new hydrology/buildability rules are invented.
Capital water/slope semantics remain pending; economy factory placement retains
its existing authoritative terrain validation. Display-name moderation belongs
to Checkpoint 2 and is not supplied here.

Session validation precedes economy processing in the unchanged handler. A
request already in flight when another session supersedes it is not claimed to
be canceled atomically: the service RPCs do not accept session IDs. This package
does not claim strict instantaneous revocation of all in-flight transactions.

The draft refuses absent approval markers, missing/type-mismatched columns,
unexpected session signatures/overloads, duplicate sessions, non-postgres or
non-RLS legacy tables, missing verified-auth column, and an already enabled
economy. These checks are **not a complete schema fingerprint** or proof of
remote identity. Operator review of unknown policies/triggers/RPCs remains
mandatory. Apply only as one transaction after independently checking staging:
the wrapper needs both `SET LOCAL mapgame.reviewed_staging_project =
'upcrdvdspypoyferpuxe'` and `SET LOCAL mapgame.legacy_schema_reviewed = 'yes'`.
Do not add these acknowledgements automatically to normal CLI deployment.

## Isolated tests

```powershell
node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-staging-security')
node central-online/backend/tests/run-postgres.cjs (Join-Path $env:TEMP 'mapgame-cp1')
$GameTests = @(Get-ChildItem .\tests\*.test.cjs | ForEach-Object { $_.FullName })
node --test @GameTests
```

The new runner uses pinned PostgreSQL 16 with **no network, ports, credentials or
host volumes**, a hand-authored synthetic five-table model and fake `auth.uid()`.
The model deliberately starts with the exported unsafe shapes, demonstrates
forged sessions and known-ID takeover, applies the opt-in draft only in that
container, and exercises two synthetic identities with real PostgreSQL RLS,
grants, locks and concurrent transactions. Integration tests use the existing
handler/ledger and real SQL heartbeat but mocked GoTrue authentication. No test
here proves real JWT verification, deployed Supabase gateway/REST/Realtime or
genuine two-account behavior. Neither test fixture is a deployable baseline.

Keep all real staging tests and Windows execution marked **NOT RUN** until the
operator performs them. No test result authorizes deployment or activation.
Central still uses 1×; Singleplayer retains its existing 1.2× and uncapped exact
solver. No ledger or save-format changes are included.

## Deployment order and rollback

See [Windows staging guide](../WINDOWS_STAGING_DEPLOYMENT.md). The prerequisite
order is: reviewed private legacy baseline → reviewed staging draft → existing
001 → 002 → 003 → disabled Edge deployment → real account/security gates.
Existing source dump is not approved for blind execution on staging.

On application failure, the operator's single transaction rolls back the draft,
including function replacements/grants/index/triggers. Do not use an automatic
down migration that restores insecure direct session writes. After an approved
deployment, suspend the staging Edge writer and legacy session RPC access,
retain canonical data/receipts and inspect the failure. Economy emergency stop
is `../rollback-disable.sql`; it revokes service capabilities and retains data.
Resuming requires reviewed grants. Restoring an empty disposable staging project
from an approved baseline is a separate authorized action, never a production
reset or deletion of committed receipts.
