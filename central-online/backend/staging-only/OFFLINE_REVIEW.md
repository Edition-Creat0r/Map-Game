# Offline staging preparation results

Branch: `feature/0.4.1-central-world-online`; starting commit `48a881c`.
Only documentation, an opt-in SQL **draft** and isolated tests were added.
No hosted database, Supabase credential, remote SQL, Edge deployment or spending
activation was used. No production data/dump/credential is committed. Main and
Singleplayer source/save formats are unchanged.

## Delivered

- [Dependency/security review](README.md) of five legacy tables, both session
  start overloads, heartbeat/end, grants/RLS, recovery and economy integration.
- [Expanded read-only metadata preflight](preflight.sql): one JSON result,
  including column grants, role memberships/default privileges and public views.
- [Staging-only draft](draft/000_staging_legacy_security.DRAFT.sql): guarded
  schema contract, no direct client session writes, database timestamps/expiry,
  foreign-session collision rejection, serialized/unique per-actor sessions,
  least-privilege cleanup and membership/claim/capital identity checks. It is
  deliberately outside the normal migration directory and never auto-enabled.
- [Windows CLI guide](../WINDOWS_STAGING_DEPLOYMENT.md) and
  [schema export/review/import supplement](WINDOWS_SCHEMA_REVIEW.md): private
  schema-only collection, certificate verification, reviewed staging baseline,
  draft-before-001/002/003 order, previews, explicit approvals and safe suspension.
- Hand-authored synthetic five-table fixture, local-only runner, vulnerability
  reproductions and two-identity real PostgreSQL security/economy integration.
  Neither fixture is a deployable baseline.

## Actual validation

| Check | Result |
| --- | --- |
| Original unsafe session behavior in synthetic fixture | **2 reproductions passed**: forged session/heartbeat and known-ID takeover |
| Draft security/preflight/economy integration | **18 passed**, 0 failed/skipped |
| Existing Checkpoint 1 SQL/economy suite | **17 passed**, 0 failed |
| Existing game deterministic suite | **101 passed**, 0 failed/skipped |
| Existing naming suite | **31 passed**, plus 17 backend tests before and after naming migrations |
| JavaScript syntax and frozen source/hash review | Passed; existing game/runtime/migrations unchanged |
| Windows PowerShell/CLI execution | **Not run** in this Linux environment |
| Real Supabase users, REST/RLS, gateway, Realtime or deployment | **Not run**, prohibited by this offline assignment |
| Browser gameplay regression | **Not run** for this backend draft; no frontend/runtime changes |

PostgreSQL tests run inside a disposable pinned PG16 container with no network,
ports or host mounts. User identities/GoTrue are synthetic; row permissions,
locks, transactions, concurrent starts/purchases and exact ledgers use actual
PostgreSQL and the unchanged Checkpoint 1 engine. This is not live enforcement
or a completed genuine two-account release gate. Central remains 1× and SP
retains its tested 1.2×/uncapped exact simulation.

Logs from this environment: `/workspace/central-online/staging-review/`:
`release.log`, `release/result.json`, `checkpoint1.log`, `existing-game.log`,
`naming-compatibility.log`. These are local evidence, not deployed test results.

## Blockers and exact Windows next steps

1. Check out this feature commit and run both isolated suites and the game suite
   on the Lenovo (PowerShell commands are in the guides).
2. Privately obtain/verify a **complete** public schema-only source export and
   expanded metadata preflight. The previously supplied metadata is useful but
   not certified complete. No player data or managed auth schema import.
3. Review the complete export against the dependency matrix and the draft's
   Central-only/expiry/recovery/ownership decisions. Unknown hooks, policies,
   privileges and deletion/recovery flows remain pending; do not blindly clone.
4. Prepare/review a private staging baseline; verify `upcrdvdspypoyferpuxe`
   independently and link only that reference. Preview the exact migration list.
5. Obtain explicit approval for baseline + draft + 001/002/003 + disabled Edge
   deployment. Apply nothing until that review is complete; test locally first.
6. Run genuine two-account security tests. A separately approved temporary
   staging-only backend activation is necessary for successful transaction and
   production tests. Keep player-facing spending OFF and record blocked tests
   honestly until that window is authorized and every gate passes.

No automatic down migration restores the unsafe session permissions. A failed
transaction rolls back; an operational failure requires approved suspension,
retained receipts/audit and reviewed recovery, never a production reset.
