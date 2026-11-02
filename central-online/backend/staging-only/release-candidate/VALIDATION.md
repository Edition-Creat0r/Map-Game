# Offline release-candidate validation

Historical RC1 evidence at 5f742f2. Current source/approval state and test counts
are in [REVIEW_RC2.md](REVIEW_RC2.md). The old unqualified source check intentionally
fails on RC2; use the explicit RC2 command in NEXT_COMMANDS_RC2.md.


Base `7f7517a8f21daf83db4893f577e14ad95fd6f1df` on a new dedicated
`feature/0.4.1-multiplayer-economy-rc` branch. No Supabase access, private export,
credentials, deployment, hosted SQL, main merge or player activation occurred.
This evidence is local/synthetic, **not genuine two-account staging validation**.

| Suite | Final result |
| --- | --- |
| Existing security/constraint/cleanup matrix | 63 passed |
| New owner-only maintenance cases | 7 passed |
| New two-player handler + real SQL journeys | 5 passed |
| **Isolated SQL/HTTP integration total** | **75 passed** |
| Existing PowerShell 7.4.6 scanner | 18 passed |
| Source-lock/sequence/target tests | 3 passed |
| Existing Checkpoint 1 SQL/economy suite | 17 passed |
| Existing deterministic game/Singleplayer suite | 101 passed |
| Deno check actual Edge entry | Passed |
| Actual Deno entry default-OFF/origin and wrong-project startup | 2 passed |
| Windows run of the new RC | NOT RUN |
| Genuine JWT/REST/Realtime/Edge/CLI deployment | NOT RUN |

No skips or final failures. PostgreSQL uses the cached pinned PG16 image with
`--pull=never --network=none`, no host ports/mounts, synthetic auth.uid()/users and
mocked GoTrue verification. SQL RLS, role grants, locks, transactions, ownership,
concurrent debits, replay receipts and exact frozen economy execution are real.
Temporary enabled settings exist only inside disposable test containers; each
fixture resets/ends OFF, and the runner destroys the container.

The expanded journeys create separate sessions/memberships/claims/capitals for A/B,
place paid buildings concurrently (including identical per-account UUIDs), reject
foreign land/session/actor/balance/token and direct SQL/RPC spending attacks,
prove one-charge concurrency, renew sessions/recreate handlers, discover/replay
only own durable receipts, settle actual purchased production chains from a
trusted elapsed-time fixture with exact model agreement, and test stop/recovery/
explicit isolated resumption without changing paid contracts, balances or history.
The elapsed-time fixture is local SQL test setup, never accepted client input.

Maintenance tests verify permissions for anon/authenticated/service roles, denial even after an accidental
schema/EXECUTE grant to a player role,
OFF-only operation, strict targets/reasons, scoped Central revocation, preserved
memberships/economy/other-world sessions, idempotent receipt binding, harmless
replay after rejoin, concurrent one-audit behavior and full transactional rollback.
The original hard-deletion blockers remain explicitly asserted; they are not
resolved or misrepresented as working cleanup.

Deno runs in the cached pinned image
`denoland/deno:alpine@sha256:75749604f68aea01d39bead15fd1c86343639e44eb8c58ab051da8a924799d01`
with network NONE and read-only `/backend` source mount. Test HTTP uses only that
container's loopback; the production-URL negative fixture exits before serving
or fetching. Synthetic keys are not real credentials. Gateway/GoTrue deployment
compatibility still requires the real staging gate.

Reproduction from repository root:

```powershell
node central-online/backend/staging-only/release-candidate/build-plan.cjs --check
node --test central-online/backend/staging-only/tests/candidate-plan.test.cjs
node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-rc')
node --test central-online/backend/staging-only/tests/local-schema.test.cjs
node central-online/backend/tests/run-postgres.cjs (Join-Path $env:TEMP 'mapgame-rc-core')
$GameTests = @(Get-ChildItem .\tests\*.test.cjs | ForEach-Object { $_.FullName })
node --test @GameTests
```

Deno reproduction is the previously documented offline container command, with
`deno check /backend/supabase/functions/central-economy/index.ts` and
`deno test --allow-env --allow-run --allow-net /backend/tests/deno-entry.test.ts`.
Keep the container network NONE. The image entrypoint requires the explicit deno
executable argument. An initial invocation omitted it; corrected commands above
passed and did not require any source/security change.

Local evidence: `/tmp/mapgame-rc-final.log`, `/tmp/mapgame-rc-final/`,
`/tmp/mapgame-rc-static.log`, `/tmp/mapgame-rc-core.log`,
`/tmp/mapgame-rc-game.log`, `/tmp/mapgame-rc-deno-check.log`,
`/tmp/mapgame-rc-deno-entry.log`. These are not committed.

## Source scope and remaining release blockers

The only runtime change is the staging-target guard in the server Edge entry.
The only SQL change is the new private audited OFF-only session-recovery function
and table in the opt-in hardening draft. Economy 001/002/003, frozen rules/hash,
handler/engine, all Singleplayer/render/auth/ownership client sources are unchanged.
No new public RPC, role, grant, DELETE exemption, transfer or destructive cleanup
is introduced. Existing permission/expiry/constraint defenses remain.

The source lock intentionally has NO approved private baseline hash or compiled
hardening-wrapper approval. These cannot be manufactured from test fixtures.
Actual function owners/defaults/grants, effective role graph and all alternate
write paths require private real metadata review. The candidate is blocked until
those are resolved and genuine deployed two-account tests pass.

Hard deletion/retirement, ledger-retention policy and instant in-flight revocation
remain out of scope. Public-name moderation is not deployed by this C1 package.
There is no new player-facing multiplayer shop wiring or capacity/UI/loading
certification. [RELEASE_SCOPE.md](RELEASE_SCOPE.md) defines this trial;
[WINDOWS_ACCEPTANCE.md](WINDOWS_ACCEPTANCE.md) gives approvals and the actual
JWT/REST/Realtime/Edge matrix and non-destructive stop/recovery steps.
