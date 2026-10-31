# Confirmed foreign-key deletion review — offline only

Parent: `9ba8c2d` on `feature/0.4.1-security-preparation`. No Supabase access,
private export, real identities, credentials or live database were used. This
report is **not deployment approval**. All deletes were disposable local test
probes, rolled back; no player-facing spending was enabled.

## Exact modeled relationships

The owner explicitly confirmed the following deletion actions. The hand-authored
`tests/legacy-model.fixture.sql` now reproduces all eight, and
`tests/cleanup.test.cjs` asserts their source/target columns and `pg_constraint`
actions, validation and nondeferrability using real pinned PostgreSQL 16.
Constraint/table creation order is synthetic; this is not the complete real schema.

| Child | Parent | ON DELETE |
| --- | --- | --- |
| capitals.owner_id | auth.users.id | CASCADE |
| capitals.world_id | worlds.id | CASCADE |
| capitals.(world_id,territory_id) | territory_claims.(world_id,territory_id) | RESTRICT |
| territory_claims.owner_id | auth.users.id | CASCADE |
| territory_claims.world_id | worlds.id | CASCADE |
| world_members.user_id | auth.users.id | CASCADE |
| world_members.world_id | worlds.id | CASCADE |
| world_sessions.user_id | auth.users.id | CASCADE |

No session-to-world FK was supplied or invented. These eight actions alone do not
establish that the real project has no additional constraints or triggers.

## Actual results

Two users each own a different claim and capital, plus membership and a session.
The same probes run before hardening and after hardening + 001/002/003, settings OFF.

| Probe | Baseline, without hardening | Hardened |
| --- | --- | --- |
| Delete auth user owning claim/capital | Succeeds; that user's four legacy child sets are removed; other account survives | Rejected: `reviewed_removal_required`; all changes roll back |
| Delete world with claims/capitals/members | Succeeds; claims, capitals and members cascade; auth users survive | Rejected: same trigger error; all changes roll back |
| Direct delete of claim with referencing capital, as postgres | Rejected by FK RESTRICT | Rejected first by removal guard; FK remains RESTRICT |
| Explicitly delete capital, then account/world | Succeeds in the rollback probe | Rejected on capital DELETE, including postgres |
| Delete capital, then its now-unreferenced claim | Succeeds in rollback probe | Rejected by removal guard |
| Self-update own capital to other user's claim | **Succeeds: legacy ownership gap reproduced** | Rejected: `not_territory_owner` |
| Other user edits victim's capital | Filtered by RLS; no change | Same |
| BYPASSRLS service write without user context | Not a new permission model | Rejected by verified-actor gate |
| Permissive test UPDATE policy attempts owner transfer | Not part of actual baseline | Identity triggers still reject claim/capital transfer |
| Auth deletion with economy account, no legacy rows for that user | Economy schema absent | Independently rejected by `cw041.accounts.actor` FK RESTRICT |

The direct baseline parent deletions do **not** fail merely because a claim has a
capital: PostgreSQL handles both cascade paths in this modeled schema. Direct
claim deletion still fails. These distinctions were measured, not inferred from
the word RESTRICT. Each successful probe asserts affected row sets and rolls back;
each rejected probe compares the full legacy snapshot to prove atomicity.

World deletion leaves two stale session rows in the model: the supplied session
FK targets the user, not the world. This is a cleanup-design gap under the supplied
relationships, **not proof about omitted live constraints**. Hardening currently
prevents the world deletion, so it does not newly create these orphans.

## Confirmed blockers and safe code changes

1. **Hardening breaks administrative account/world cleanup.** Its unconditional
   DELETE guard (`draft/000_staging_legacy_security.DRAFT.sql`,
   `guard_legacy_write`) fires for cascade child DELETEs as well as direct writes,
   including postgres/service maintenance. Economy OFF does not relax it. These
   failures are intentional assertions in the tests, not passing cleanup gates.
   No removal authorization exception was silently added.
2. **Economy retention is a separate blocker.** `migrations/001_backend.sql:11`
   keeps an auth-user FK with ON DELETE RESTRICT; operations/buildings/audit also
   reference the retained economy account. Fixing the legacy DELETE guard alone
   cannot authorize or safely complete account deletion after economic activity.
3. **Legacy capital FKs do not bind the claim owner.** The original self-update
   policy permits a capital to point at another user's existing claim. The tested
   hardened INSERT/UPDATE paths reject this, including service/accidental-policy
   cases. Unknown real RPCs/views/hooks remain outside this fixture's guarantees.
4. **Preexisting mismatches must block hardening.** Added a fail-closed draft
   precondition that refuses an existing capital/claim owner mismatch. It does
   not repair, delete or transfer rows. A synthetic regression proves rejection
   and rollback. The draft also now checks the eight confirmed delete actions
   rather than treating NO ACTION, RESTRICT and CASCADE as interchangeable.
   Wrong-action regressions pass. No deployed constraints or triggers were changed.

## Proposed fixes — design/review required, not implemented

- Define separate authorized account cleanup, world retirement and claim removal
  workflows. Use a private, audited maintenance entry point with explicit actor,
  target and ownership checks, grants unavailable to anon/authenticated, and
  locking/quiescence coordinated with all writers. Keep ordinary client DELETEs
  denied. Review how only this trusted operation can satisfy the row guard.
- Preserve capital-to-claim RESTRICT. Deliberate claim removal must remove or
  explicitly relocate its capital first in the same authorized transaction.
  World retirement must explicitly handle sessions if no real world FK exists.
- Decide economy retention/anonymization/archival before enabling auth deletion.
  Preserve exact ledgers, idempotency receipts and ownership evidence. Do not
  casually convert the economy-account FK to CASCADE or delete audit receipts.
- Review legacy inconsistencies privately and reconcile them manually under an
  approved ownership procedure. If owner agreement must be structural across
  every privileged path, evaluate a composite owner-aware FK in a separately
  reviewed migration; do not infer/rewrite the real schema now.
- Do not use blanket postgres/service_role exceptions, `pg_trigger_depth()`, a
  client-settable GUC, trigger disabling or replication-role changes as cleanup
  authorization. Do not change real FK actions to make a test pass.

Until those decisions and genuine two-account staging tests pass, cleanup remains
blocked, the SQL remains a draft, and player-facing Central spending remains OFF.

## Reproduction and validation

```powershell
node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-fk-cleanup')
node --test central-online/backend/staging-only/tests/local-schema.test.cjs
$GameTests = @(Get-ChildItem .\tests\*.test.cjs | ForEach-Object { $_.FullName })
node --test @GameTests
```

The isolated runner requires the already cached pinned image and uses
`--pull=never --network=none`, no ports/volumes. It now records separate baseline
and hardened cleanup test logs. Order remains baseline -> draft -> 001 -> 002 ->
003. Neither synthetic fixture is a deployable baseline.

Final results: 63 isolated cases (2 exposure, 9 baseline cleanup, 20 draft-contract,
20 security/integration, 12 hardened cleanup), 18 PowerShell scanner tests and 101
game tests passed, no skips. Scanner ran under PowerShell 7.4.6 on Linux; no Windows
or live two-account verification is claimed. Local-only evidence:
`/tmp/mapgame-fk-cleanup-final.log`, `/tmp/mapgame-fk-cleanup-final/`,
`/tmp/mapgame-fk-cleanup-scanner.log`, `/tmp/mapgame-fk-cleanup-game.log`.
