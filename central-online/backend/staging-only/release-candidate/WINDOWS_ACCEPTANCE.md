# Windows staging acceptance — explicit approvals, never production

Target **upcrdvdspypoyferpuxe** only. Forbidden target **vjwvhtsjdsbcorszzldk**.
No action below has been run against Supabase by Codex. STOP at every unmet gate.
This is a backend staging trial; player-facing Central spending remains disabled.

## 1. Offline next Lenovo session

In PowerShell 7.2+, preserve any local changes, then fetch/switch the dedicated
`feature/0.4.1-multiplayer-economy-rc` branch. Compare `git rev-parse HEAD` with the
reported candidate SHA. Do not reset other branches or merge main.

```powershell
node central-online/backend/staging-only/release-candidate/build-plan.cjs --check
node --test central-online/backend/staging-only/tests/candidate-plan.test.cjs
node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-staging-rc')
node --test central-online/backend/staging-only/tests/local-schema.test.cjs
```

Run the existing local export scanner using your unchanged private paths (see
`../WINDOWS_NEXT_SESSION.md`). Exit 2 still means review required. Keep export and
reports outside Git/served folders/OneDrive, private to your Windows account.
Do not upload exports, keys, tokens, SQL function text or auth responses to chat.

## 2. Private metadata and baseline gate — no approval yet

Reconcile the complete schema-only export with both metadata preflights and
RELEASE_SCOPE.md. Review owners, all four session signatures, PK/FK actions,
role memberships, privileges/column ACLs, RLS, extra RPCs/views/triggers and
Realtime. Function text can contain secrets: inspect privately. No live metadata
collection is authorized by this document alone; use separately approved owner
access when available. Resolve every draft rejection without weakening checks.

Prepare a private reviewed baseline, containing five application tables and
reviewed dependencies, not managed auth schemas/roles or player data. Never use
backend/tests/bootstrap.sql or staging-only/tests/legacy-model.fixture.sql.
No raw unreviewed dump import. Record its SHA256 and reviewer approval privately.

## 3. Exact provisioning plan — requires written staging deployment approval

Only after section 2 is approved: independently verify Dashboard reference,
project name/organization and staging connection host+username. The pooler hostname
alone is not identity. Link only `upcrdvdspypoyferpuxe` in a fresh private CLI
workdir; preserve TLS verify-full and the previous Windows secure-access guide.
Do not paste credentials in terminal commands/transcripts, source, screenshots
or chat. Do not borrow production keys or export real users.

Use exactly the five filenames/sources in CANDIDATE.json. The baseline has no
committed hash because it has not been reviewed here. The hardening source hash
is committed, but its approved migration wrapper must also be reviewed and hashed:

```sql
-- TEMPLATE FOR FUTURE REVIEW ONLY; not authorization or identity proof.
BEGIN;
SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';
SET LOCAL mapgame.legacy_schema_reviewed='yes';
-- exact reviewed contents of 000_staging_legacy_security.DRAFT.sql here
COMMIT;
```

Do not execute this empty template or auto-insert acknowledgements in a normal
CLI run. Review the complete compiled file locally and record its hash. Prefer
baseline + hardening in one approved provisioning transaction. If your workflow
uses separate migration commits, prevent all client access in between. Inspect
CLI history and `db push --dry-run` against the exact five-step list; these are
not SQL/security tests. Stop on extra naming 004/005, missing baseline, changed
hashes, preexisting history or unexpected hooks. No --include-all, repair, reset
or forced history. Apply only after the exact SQL and deployment window approval.

After approved migration execution, independently verify settings OFF, frozen
release hash/seed 734221, expected triggers, private FORCE RLS, constraints and
all user/column/function permissions. Record sanitized pass/fail evidence.

## 4. Disabled Edge deployment — still no spending

After separately approved deployment only: deploy central-economy from the locked
entry and imports using reviewed CLI bundling. Keep gateway verify_jwt=true; never
use --no-verify-jwt. Server-only secrets must bind to staging, correct public/service
keys, explicit staging/loopback test origins and CENTRAL_ECONOMY_ENABLED=false.
Service keys never belong in the browser, console snippets or reports.

Prove the deployed endpoint is OFF (503), unapproved Origin is rejected, and no
DB operations/receipts change. Match deployed source hashes/bundle and staging URL;
wrong project enabled configuration must fail startup. CLI/Deno offline checks do
not prove deployment or provider gateway behavior. If the Edge function cannot
start with these settings, STOP rather than disabling JWT/TLS checks.

## 5. Genuine two-account negative matrix — no economic activation

Before testing, approve how the staging project is limited to the two testers
(including signup/invitation/exposure controls). Session RPC abuse limits are not
implemented here. Do not silently change provider auth settings or open a public
trial; record an unmet gate instead.

Use two **real, verified, disposable staging users A and B** in separate browser
profiles, pointed explicitly at staging. Acquire their JWTs through normal staging
sign-in. Keep them in memory only; no logs/console dumps/clipboard reports. Never
use the production-connected Map Game deployment for these tests.

Test actual public-key + user-Bearer requests through PostgREST, not owner SQL:
- A/B start distinct Central sessions using both start overloads; then insert their
  own membership. Each claims an unprotected valid territory and founds its own
  capital. Use real terrain-valid sites and keep the 150x150 capital reservation.
- B cannot take A's session UUID, heartbeat/end A's session, update A's membership,
  claim identity or capital owner/territory. Direct table/column session writes
  and forged future heartbeats fail. Expired/future/conflicted heartbeat fails;
  explicit own rejoin succeeds. A sees only A's session rows.
- anon/missing/expired/forged JWTs cannot obtain private economy data or write it.
  Test GET/POST/PATCH/DELETE against cw041 (if exposed), and all public cw041 RPCs,
  as anon and A/B. Test column writes and extra exposed views/RPCs; 0 affected rows
  is not proof of a rejected row write unless original data is checked afterward.
- Recovery function/schema/audit cannot be accessed by A/B, anon or service APIs.
  Ordinary capital/claim/account/world deletion is deliberately unsupported; do
  not delete auth users in the Dashboard to "clean up" this retained trial.

REST claims/capitals may be public game state by policy. Realtime checks must use
real WebSocket subscriptions with user JWTs: subscribe A/B to legitimate public
territory/capital changes, verify expected events without private ledger fields.
Attempt subscriptions to cw041 accounts/operations/audit/rate_limits/buildings,
world_sessions of another actor and private recovery audit. No private rows or
JWT/session identifiers may leak. Publication/RLS behavior must be checked on
actual INSERT/UPDATE/DELETE event payloads; receiving no idle event proves nothing.
If the expected publication is absent, mark blocked; don't enable it ad hoc.

## 6. Temporary staging-spending gate — new explicit approval required

STOP here and obtain written approval for a limited two-account test window after
all earlier gates pass. Record project ref, candidate SHA/hashes, tester identities
privately, allowed origins, start/stop plan and responsible operator. No approval
is implied by deployment, linking, test success or this checklist.

Only then authorize both server DB settings and Edge flag for staging. Keep the
normal game frontend/production OFF. Verify the database matches the frozen rules
hash and all sessions/claims/ownership remain the approved ones. No client clocks,
balances, actor IDs or costs may be imported or trusted.

## 7. Positive Edge transaction matrix during the approved window

POST to `https://upcrdvdspypoyferpuxe.supabase.co/functions/v1/central-economy` with
the real staging public key, A/B's own Bearer JWT, JSON Content-Type and approved
Origin. Never use the service key for player acceptance. Use the documented
intent fields in backend/README.md; generate UUIDs locally with New-Guid. Do not
send actor IDs, stock, prices or timestamps. Record operation IDs privately.

- Both players place starter houses at valid, different owned sites. Confirm
  actor/territory, one debit, exact ledger strings, building index and audit. Swap
  territories/sessions, forge actor/balance fields, overlap capitals/buildings or
  submit locked/unknown factories: no unauthorized debit or placement.
- Replay one UUID concurrently six times: identical terminal receipt, one charge,
  one building. Same UUID with changed gameplay intent rejects. Reuse a UUID across
  A/B: distinct per-account operations; no cross-account receipt or stock leak.
- Disconnect after submission; re-sign in/rejoin and call status with the new
  protected session. Discover the original pending/receipt ID and resend unchanged
  intent. Verify original receipt and no second charge. 202 settling uses the
  SAME ID until terminal; 409/429 use bounded backoff, never frame-loop requests.
- Build house/power/commercial/carbon starter chains through purchases. Let real
  server time elapse, settle and compare exact before/after inputs, output, upkeep,
  population/workforce/power constraints and audit deltas with frozen rules. Central
  uses 1x; do not promise SP's 1.2x without a trusted activity policy. A's settlement
  must not change B's ledger. Test shortages, long absence, server restarts and
  incomplete catch-up without manipulating a client/server clock.
- Verify research bypass denial, read projections, limits and RLS isolation through
  real deployed JWT/gateway/REST/Edge paths. No console errors or leaked credentials.

No browser UI integration is claimed: if a staging game client is supplied later,
verify startup, canonical seed/terrain, World Map/territory navigation, placement,
return and SP saves separately before any player-facing release.

## 8. Stop, recovery and rollback — approval before any write

At test-window end or any failure: set Edge flag OFF/stop its writer; run the
previously approved staging-only backend/rollback-disable.sql (DB OFF + service
RPC EXECUTE revoked). Drain requests and verify a new intent cannot charge.
Preserve accounts, claims/capitals, building rows, pending targets, receipts and
both economy/recovery audits. Do not DROP/TRUNCATE, restore unsafe session grants,
change FK actions or delete completed operation IDs as rollback.

If session recovery is needed, first verify both DB and Edge OFF and the correct
staging target. Obtain target-specific owner approval and retain the operation
UUID and fixed reason privately. Only a genuine owner connection with current_user
AND session_user postgres can call the private invoker routine. For the approved
actor UUID, the reviewed SQL shape is:

```sql
-- FUTURE APPROVED OWNER OPERATION ONLY. UUID placeholders are not runnable.
SELECT cw041_staging_security.recover_sessions_offline(
 'APPROVED-OPERATION-UUID'::uuid, 'APPROVED-ACTOR-UUID'::uuid, 'operator_recovery');
```

Verify one private audit/receipt, only that actor's Central sessions removed, and
all economy/ownership records unchanged. Retrying the same ID returns the original
receipt and must not remove a replacement session. Rejoin is allowed; this is not
an account ban or hard-deletion workflow. Do not grant service/client execution if
provider owner context is incompatible; mark recovery blocked and stop.

Restart/regrant/enable requires another review and explicit approval, not an
automatic rollback script. Re-test idempotent receipt recovery after approved
resumption. Keep the real baseline, auth metadata, JWTs and reports private.

Final acceptance must list actual test results, deployed SHA/hashes and every
blocked/unrun check. Until all required gates pass, this remains a backend staging
candidate, with production and player-facing Central spending OFF.
