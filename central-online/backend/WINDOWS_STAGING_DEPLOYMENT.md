# Checkpoint 1 staging deployment from Windows

Prepared from `feature/0.4.1-central-world-online`, baseline HEAD
`48a881c3d35707c7512626cf9fe49654114b45d5`. Checkpoint 1 was completed at
`db1bec5f3d0da80624acf395c7351baad82c6333`. Its backend runtime/migrations are
unchanged at this HEAD; the backend test has a quota-window determinism fix.
Checkpoint 2 also exists on this branch, but **its naming package and migrations
004/005 are not part of this deployment**.

The separate [staging security package](staging-only/README.md) adds an offline
dependency review, all-five-table preflight, synthetic security tests and a
**DRAFT** hardening migration. It is not an approved production export/baseline
and is not automatically copied into the CLI migration folder below.

This is an operator guide, not evidence of deployment. No Windows commands,
remote migrations, two-account tests or Edge deployment were executed while
preparing it. Do not use the broken Codex Cloud deployment path.

## 1. Targets, tools and credentials

Use **PowerShell 7** on your Lenovo. Install Git for Windows and, for the existing
automated tests, Node.js LTS and Docker Desktop using Linux containers. Docker is
not needed for the API-based Edge deployment below, but is needed for the
isolated database suite. Do not run the commands as a single unattended script.
Stop at each checkpoint and on every unexpected result.

| Role | Project / endpoint |
| --- | --- |
| Only permitted deployment target | `upcrdvdspypoyferpuxe` |
| Staging API | `https://upcrdvdspypoyferpuxe.supabase.co` |
| Staging session pooler | `aws-1-us-west-2.pooler.supabase.com:5432`, user `postgres.upcrdvdspypoyferpuxe`, database `postgres` |
| Existing application project — never link/deploy here | `vjwvhtsjdsbcorszzldk` |

The pooler host is shared: its hostname alone does **not** identify the project.
Verify the project reference in Dashboard and the pooler username. Leave
production connection strings and credentials out of this working session.

Install Scoop using its [official installation instructions](https://scoop.sh/)
if it is not already installed, then install the official Supabase package:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
if ($LASTEXITCODE -ne 0) { throw 'Scoop bucket setup failed' }
scoop install supabase
if ($LASTEXITCODE -ne 0) { throw 'CLI installation failed' }
supabase --version
git --version
$PSVersionTable.PSVersion
```

If the bucket/package already exists, verify it rather than blindly reinstalling.
Record the CLI version used. The CLI changes over time: confirm `link --help`,
`db push --help`, `migration list --help`, and `functions deploy --help` support
the flags below. Do not install the CLI with `npm install -g supabase`.

Run `supabase login` interactively. Use the normal browser/hidden-input login;
do not put a token in `--token`, shell history, scripts, chat or Git. Reuse your
existing personal access token if the CLI requires it; do not regenerate it just
for this workflow. Do not use `Start-Transcript`, shell debugging, `--debug`,
verbose HTTP tracing or screen recording during credential entry/testing.
The CLI may save login/database credentials in Windows credential storage;
use your own Windows account and do not share that profile.

No `CP1_STAGING_DATABASE_URL` is required. Prefer the CLI's interactive database
password prompt. Never put a real database URI/password in command arguments,
source files or an `.env` under the web repository. Preserve TLS verification;
do not use certificate-check bypasses. If local tools cannot validate the
provider certificate, stop and resolve trusted CA configuration first.

## 2. Check out and inspect the real feature branch

From a directory where you keep source checkouts:

```powershell
git clone https://github.com/Edition-Creat0r/Map-Game.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location .\Map-Game
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }
git switch --track origin/feature/0.4.1-central-world-online
if ($LASTEXITCODE -ne 0) { throw 'Branch checkout failed' }
$RepoRoot = (Get-Location).Path
git status --short
git log -3 --oneline
git merge-base --is-ancestor db1bec5f3d0da80624acf395c7351baad82c6333 HEAD
if ($LASTEXITCODE -ne 0) { throw 'Checkpoint 1 is missing' }
git diff db1bec5 -- central-online/backend
```

For an existing checkout, first inspect `git status`; preserve local changes and
switch to the existing local feature branch instead of recreating it. Do not
reset, force-push or switch to `main`. At the prepared HEAD the last diff shows
only the test-only quota fix (and this guide if present). If the branch advances,
review its actual diff before following this release recipe. Do not assume an
updated branch is still the reviewed candidate.

Read `central-online/backend/README.md`, `preflight.sql`, all three migrations,
`generated/manifest.json`, the handler and the Edge entry. The existing browser
`auth.js` still points to the original application project. **Do not sign into
that browser client for staging tests.** Use the explicit staging API below or
a separately reviewed staging-only client; do not modify production auth config.

## 3. Review the actual legacy schema — a blocking prerequisite

Follow [Windows schema export, review and staging-only import](staging-only/WINDOWS_SCHEMA_REVIEW.md)
before preparing the CLI migration folder. That supplement covers complete
schema-only collection, private files, draft acknowledgement, migration order
and fail-closed rollback. Neither document authorizes remote execution today.

The new staging project was reported empty. Checkpoint 1 is **not a complete
bootstrap of the legacy application**. Do not use `tests/bootstrap.sql` on
Supabase; it creates synthetic roles/auth tables for isolated tests only.

Privately retain the two schema-metadata exports already supplied by the owner.
Together they describe `worlds`, `world_members`, `territory_claims`, `capitals`,
`world_sessions`, constraints/indexes, table/column grants, RLS, four session
function definitions (including two start-session overloads), and Realtime
publication metadata. They contain definitions, not a complete executable dump
or a copy of player data. No live independent audit has certified them.

The reviewed exports establish these staging blockers:

| Finding | Required staging review / acceptance test |
| --- | --- |
| Authenticated users can INSERT/UPDATE their own `world_sessions`, including timestamps and state | Protect session creation/refresh with the intended server-controlled API. Direct row writes must not manufacture or revive a valid protected session. Test with real user JWTs. |
| Both SECURITY DEFINER start-session overloads reassign `user_id` on `ON CONFLICT(session_id)` | Reject another actor's conflicting ID atomically, including concurrency. Do not leave the older overload as a bypass. |
| No unique `(world_id,user_id)` session constraint | Define and test concurrent newest-session-wins behavior; concurrent starts must not leave two valid sessions. |
| Heartbeat has no explicit expiry rejection | Decide and test server-controlled expiry/reconnect rules; a stale row must not bypass them. |
| Capital self-owner policy does not check ownership of its territory | Direct insert/move to another player's territory must fail. A foreign key proves existence, not matching ownership. |
| Membership/claim self-insert policies do not establish eligibility or territory validity | Review verified-account/session requirements, valid 316×316 IDs, protected center and claim/recovery authority. Preserve intended ownership behavior. |
| Broad client grants include TRUNCATE/REFERENCES/TRIGGER | Review least privilege at both table and column level; RLS does not protect TRUNCATE. A remotely exploitable REST truncate path has not been demonstrated. |

Positive findings: session SELECT is self-only; sessions are not in the exported
Realtime publication; client roles cannot CREATE in `public`. A known-session-ID
conflict remains a concern, but the exports did not establish an ID disclosure
path. FORCE RLS being off on postgres-owned legacy tables alone is not a finding
of client bypass.

**Stop gate:** prepare and obtain explicit review/approval of a staging-only
legacy baseline and the [hardening draft](staging-only/draft/000_staging_legacy_security.DRAFT.sql).
Neither is approved for deployment. Do not blindly clone unsafe grants or
invent replacement ownership rules. Resolve dependencies from the real exports;
do not copy production auth users, sessions, ownership rows or player balances.
Create only fresh staging fixtures/accounts after approval. Do not change
production while correcting staging.

Before any remote apply, open staging Dashboard and run `backend/preflight.sql`
as a read-only inspection, retaining each result set (the SQL Editor may show
only the final one). Also inspect the five tables, column grants and all session
overloads above; the existing preflight's table checks cover only the three
legacy economy dependencies. On empty staging, missing objects are expected and
are a **failed prerequisite**, not permission to apply 001 anyway.

An additional read-only staging query is:

```sql
SELECT name, to_regclass('public.' || name) AS present
FROM unnest(ARRAY['worlds','world_members','territory_claims',
                  'capitals','world_sessions']) AS names(name);
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('worlds','world_members','territory_claims',
                    'capitals','world_sessions');
```

## 4. Prepare a separate local CLI deployment folder

The committed migrations are in `backend/migrations`, whereas the CLI looks in
`<workdir>/supabase/migrations`. Do not run a raw `db push` from the repo and
assume it sees them. Use a new folder outside the checkout, with the existing
modules in their original relative layout. This prevents accidentally staging
Checkpoint 2. These commands copy public source only, never secrets:

```powershell
$StagingRef = 'upcrdvdspypoyferpuxe'
$StagingUrl = "https://$StagingRef.supabase.co"
$SourceBackend = Join-Path $RepoRoot 'central-online\backend'
$DeployRoot = Join-Path $env:LOCALAPPDATA 'MapGame\cp1-staging-review'
if (Test-Path $DeployRoot) { throw 'Review existing deployment folder; do not overwrite it' }
$WorkDir = Join-Path $DeployRoot 'backend'
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
Copy-Item -Path (Join-Path $SourceBackend '*') -Destination $WorkDir -Recurse
$MigrationDir = Join-Path $WorkDir 'supabase\migrations'
New-Item -ItemType Directory -Path $MigrationDir -Force | Out-Null
$MigrationMap = [ordered]@{
    '001_backend.sql' = '20261028000100_cp1_backend.sql'
    '002_pin_rules.sql' = '20261028000200_cp1_pin_rules.sql'
    '003_legacy_coordination.sql' = '20261028000300_cp1_legacy_coordination.sql'
}
foreach ($entry in $MigrationMap.GetEnumerator()) {
    $source = Join-Path $SourceBackend ("migrations\" + $entry.Key)
    $target = Join-Path $MigrationDir $entry.Value
    Copy-Item -LiteralPath $source -Destination $target
    if ((Get-FileHash $source).Hash -ne (Get-FileHash $target).Hash) {
        throw 'Migration copy changed'
    }
}
Get-ChildItem $MigrationDir -File | Select-Object Name
```

The timestamp names are local CLI wrappers for the unchanged SQL content, not a
new migration implementation. Use the same reviewed mapping for subsequent
runs; don't rename applied versions. The copied `supabase/config.toml` still
references `functions/central-economy/index.ts`, whose relative imports reach
the copied handler, engine and `generated/rules.mjs`. Do not flatten the layout.

Approved legacy baseline/hardening migrations must precede these three and have
their own reviewed filenames/history. **They are deliberately not supplied by
the copy script.** The hardening draft is outside the normal migration folder.
Before remote apply, reconcile their application method/history
with the local list. Do not use `migration repair` to disguise missing changes.

## 5. Link staging only; preview without applying

Confirm the staging project reference in Dashboard **before** linking. Enter only
its database password at the CLI's interactive prompt. Do not use `--password`
or `--db-url` containing a credential.

```powershell
supabase link --project-ref $StagingRef --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Staging link failed' }

function Assert-StagingLink {
    if ($StagingRef -cne 'upcrdvdspypoyferpuxe') { throw 'Unexpected target' }
    $refFile = Join-Path $WorkDir 'supabase\.temp\project-ref'
    if (-not (Test-Path $refFile)) { throw 'No verified local link' }
    if ((Get-Content -LiteralPath $refFile -Raw).Trim() -cne $StagingRef) {
        throw 'Linked project is not staging'
    }
}
Assert-StagingLink
supabase migration list --linked --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Migration-history read failed' }
supabase db push --linked --dry-run --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Migration preview failed' }
```

Review every pending filename and local/remote version. Unexpected history,
missing baseline or any 004/005 naming migration is a stop. Do not use
`--include-all`, `--include-seed`, `db reset --linked`, `db pull`, automatic
confirmation flags or `migration repair` to get past a discrepancy.

`--dry-run` previews pending migrations; **it does not execute SQL or prove
dependencies, RLS or security correctness**. Linking can cache local credentials
and fetch metadata, but is not a schema migration. Record metadata/history
privately; do not record passwords or raw account JWTs.

## 6. Migration dependency order and explicit approval

| Order | Change | Preconditions / outcome |
| --- | --- | --- |
| Prerequisite | Separately reviewed legacy baseline + session/ownership hardening | Real `worlds`, membership, claims, capitals and sessions; safe roles/RLS/RPCs; fresh staging data only |
| 001 | `001_backend.sql` | Supabase roles and `auth.users` exist; creates private FORCE-RLS economy schema, service-only RPCs; settings OFF |
| 002 | `002_pin_rules.sql` | 001 exists; pins seed 734221, 125 contracts, 121 materials, release hash; settings remain OFF |
| 003 | `003_legacy_coordination.sql` | Actual `public.capitals` exists; adds coordination trigger; context/commit require it; trigger is a no-op while OFF |
| Function | Existing `central-economy` | Matching frozen rules, origins, JWT/session compatibility, server flags OFF |

Expected release fingerprint:
`25c746599779e833aacb5d08821faf2a6bc16418c2d35e2a71bb37928c1b7b11`.
Do not regenerate or reprice contracts just to make a mismatch disappear.

**STOP HERE until the owner explicitly approves this exact staging plan:** legacy
baseline/hardening diff, migration hashes/history, session and ownership test
results, backup/recovery plan, canonical seed alignment, origins, function
package and this release fingerprint. Preparation or a successful preview is
not approval. There are known unresolved blockers today.

Only after that approval, repeat `Assert-StagingLink` and preview, then run the
following separately (this is a remote write, not a preview):

```powershell
# APPROVED STAGING APPLY ONLY — do not run during preparation.
Assert-StagingLink
supabase db push --linked --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Migration apply failed; inspect history before retrying' }
```

The files have individual transactions; the three-file set is not one atomic
transaction. If a later migration fails, earlier ones may remain committed.
Inspect actual history/state before any retry; do not blindly replay CREATEs.
After apply, verify `cw041.settings.enabled=false`, the release hash/seed, private
table/RPC grants, FORCE RLS and the enabled `cw041_capital_guard` trigger. Never
apply naming migrations or enable the game frontend as part of this step.

## 7. Deploy the existing function disabled — approval required

Supabase hosted Edge Functions provide the reserved `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
Verify their availability without printing them; do not try to upload real
`SUPABASE_*` secrets from the example file. Service keys must never be browser
keys. Missing/changed platform defaults are a stop, not a reason to weaken auth.

Use only these nonsecret custom settings for the initial disabled deployment:

```powershell
# APPROVED STAGING DEPLOYMENT ONLY.
Assert-StagingLink
supabase secrets set CENTRAL_ECONOMY_ENABLED=false CENTRAL_ALLOWED_ORIGINS=http://localhost:8000 --project-ref $StagingRef --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Staging settings update failed' }
supabase functions deploy central-economy --use-api --project-ref $StagingRef --workdir $WorkDir
if ($LASTEXITCODE -ne 0) { throw 'Edge deployment failed' }
```

Use an approved staging HTTPS origin instead of localhost when appropriate;
origins have no path or trailing slash and must exactly match requests. Do not
add the production site to make staging tests pass. Keep `verify_jwt=true` in
the copied TOML. Never pass `--no-verify-jwt`. `--use-api` asks the CLI to bundle
through the deployment API; verify that its installed version supports it and
that all existing static relative imports are included.

Gateway JWT compatibility with the staging project's signing configuration is
a test gate. A new publishable/secret API key is not a user JWT. If a genuinely
signed-in user's JWT fails gateway validation, stop and review supported gateway
configuration; do not disable JWT verification to obtain a passing test.

## 8. Two staging accounts and disabled-function smoke tests

After approved staging provisioning, create **two disposable users A and B** in
staging Authentication, verify/confirm their emails and establish fresh staging
memberships/claims through the reviewed legacy flow. Never import production
users, passwords, saves or ledgers. Use different owned valid buildable
territories outside the protected center, and record fixture IDs privately.

Use PowerShell 7 and `Get-Credential` for hidden password entry. The following
keeps auth responses/JWTs in process memory and prints only HTTP status, not
tokens. Do not run inside a transcript/debugger or paste raw response objects.
Account credentials necessarily exist briefly in memory during HTTPS sign-in;
this is not a claim of guaranteed memory zeroization.

```powershell
$Origin = 'http://localhost:8000' # must match the configured staging allowlist
$PublicKey = Read-Host 'Staging public/publishable API key (NOT a service key)'
function Get-StagingUserToken {
    $cred = Get-Credential -Message 'Disposable STAGING account email and password'
    if ($null -eq $cred) { throw 'Sign-in cancelled' }
    try {
        $body = @{ email=$cred.UserName; password=$cred.GetNetworkCredential().Password } | ConvertTo-Json -Compress
        $auth = Invoke-RestMethod -Method Post -Uri "$StagingUrl/auth/v1/token?grant_type=password" -Headers @{apikey=$PublicKey} -ContentType 'application/json' -Body $body
        if (-not $auth.access_token) { throw 'No user token' }
        return $auth.access_token
    } catch { throw 'Staging sign-in failed; do not print the raw auth response' }
    finally { $body=$null; $auth=$null; $cred.Password.Dispose() }
}
$UserAToken = Get-StagingUserToken
$UserBToken = Get-StagingUserToken

function Invoke-StagingIntent {
    param([string]$Token, [hashtable]$Intent)
    if ($StagingUrl -cne 'https://upcrdvdspypoyferpuxe.supabase.co') { throw 'Wrong endpoint' }
    try {
        $response = Invoke-WebRequest -Method Post -Uri "$StagingUrl/functions/v1/central-economy" -Headers @{Authorization="Bearer $Token"; apikey=$PublicKey; Origin=$Origin} -ContentType 'application/json' -Body ($Intent | ConvertTo-Json -Compress) -SkipHttpErrorCheck
        return @{Status=[int]$response.StatusCode; Data=($response.Content | ConvertFrom-Json)}
    } catch { throw 'Staging request failed; inspect locally without exposing headers/tokens' }
}
$SessionA = [guid]::NewGuid().ToString()
$SessionB = [guid]::NewGuid().ToString()
$OffA = Invoke-StagingIntent $UserAToken @{action='settle';operationId=[guid]::NewGuid().ToString();sessionId=$SessionA}
$OffB = Invoke-StagingIntent $UserBToken @{action='settle';operationId=[guid]::NewGuid().ToString();sessionId=$SessionB}
foreach ($result in @($OffA,$OffB)) {
    if ($result.Status -ne 503 -or $result.Data.error -ne 'central_economy_disabled') {
        throw 'Disabled-state gate failed; do not enable the backend'
    }
}
'Both staging users received the expected disabled response.'
```

These generated session IDs are **not valid protected sessions** until the
reviewed start-session RPC succeeds; the disabled handler deliberately returns
before session checks. Thus the smoke test proves disabled behavior and gateway
acceptance, **not** session authorization or production correctness. Also test
missing/invalid auth at the gateway and unapproved origins. Record the layer
that rejected the request; a gateway 401 is not proof of handler validation.

## 9. Security and economy acceptance matrix — no player spending yet

Keep the game frontend's multiplayer economy disabled throughout. First run
session/ownership negative tests against the approved staging baseline, using
A/B's user JWTs rather than an administrative service key:

- Direct REST session INSERT/UPDATE, timestamp forgery, expired-session revive,
  missing/unverified user, cross-user read/write, wrong world and wrong UUID.
- Start-session collision with B's known test ID must not take over B's row;
  test both overloads. Concurrent starts for A must implement the approved
  newest-session-wins rule. Heartbeat/end must bind account, world and session.
- A cannot claim as B, move its capital onto B's territory, change ownership,
  bypass protected-center/grid restrictions or manufacture another membership.
- Direct private economy REST/RPC reads/writes must fail for both users.
  Read-only region projection must not expose private ledgers/contracts.

Stop on any unexpected success. Preserve sanitized evidence; do not promote or
patch production as a side effect. The repository's isolated tests do not run
this genuine Supabase matrix automatically.

Successful purchase/production tests necessarily create **test-only staging
transactions**. They cannot pass while both backend switches remain OFF.
After the initial security gates pass, obtain **separate explicit approval for
temporary staging-only backend activation**. No activation command is supplied
in this guide; no approval is implied by linking, migration approval or the
disabled smoke test. If no such activation is permitted, report these tests as
blocked and keep OFF. Player-facing spending remains disabled until *all* gates
pass and a separate release approval is given.

In that approved test window, start real protected sessions through the reviewed
`map_game_start_session` API. Its three-argument signature is `p_world_id`,
`p_session_id`, `p_username`; the older four-argument overload also needs review.
Use `Invoke-StagingIntent` with those actual sessions and immutable operation
IDs. The exact intent contract is in [README.md](README.md):

```powershell
# Test-window example ONLY, after all preceding approvals and fixture checks.
# $TerritoryA, $BuildableX and $BuildableZ must come from reviewed staging fixtures.
$PurchaseA = @{
    action='place'; operationId=[guid]::NewGuid().ToString(); sessionId=$SessionA
    buildingId='smallHouse'; territoryId=$TerritoryA
    x=$BuildableX; z=$BuildableZ; rotation=0
}
# Keep the returned receipt private; inspect selected noncredential fields only.
$ReceiptA = Invoke-StagingIntent $UserAToken $PurchaseA
```

Never assume README example coordinates `(500,500)` are buildable. Obtain sites
from the authoritative frozen seed/terrain, avoiding water, slope, capitals and
collisions. Test this full matrix, recording expected vs actual exact ledger
strings, operation IDs, revisions, building count and audit deltas:

| Scenario | Required result |
| --- | --- |
| A/B buy on their own land; A tries B's land | Valid construction pays once; unauthorized purchase pays no construction cost |
| Same immutable ID replay, including simultaneous requests | One building and one purchase debit; same terminal receipt |
| Same ID with changed intent | Rejected; no second transaction |
| Distinct concurrent purchases, including insufficient combined funds/overlap | Correct serialization; no negative ledger, duplicate building or double-spend |
| Factory production over known elapsed time with steel/carbon inputs, money upkeep, energy and workers | Exact constrained accounting; inputs consumed proportionally, shortages stop/limit the right output |
| Long offline catch-up/interrupted 202 settlement | No 12-hour elapsed cap; bounded computation resumes the same durable target with no lost time/double earnings |
| Research-locked building / forged cost, actor, time, balance or unlock | Rejected according to the actual API; client fields cannot become authority |
| Reconnect/status and cross-user status/private reads | A sees only A's pending IDs/receipts; B cannot recover A's private state |
| Capital/factory concurrent collision and lost ownership | No overlapping committed site; settlement fails closed if ownership is missing/changed |
| Rate-limit and rollback failures | Predictable backoff; injected failures leave no partial debit/build/receipt |

For simultaneous requests, use two independent PowerShell processes/jobs with a
barrier and the same copied intent. Pass tokens only through in-memory job
arguments, never literal command text or files. Collect only sanitized outcomes;
do not print jobs' argument lists. Reusing a finished request sequentially is
not a concurrent test. Use the existing deterministic solver as the expected
accounting reference, not rounded UI totals. Owner SQL inspection is evidence
only; successful service-role writes cannot prove user permission enforcement.

HTTP 202 means retry **the same** operation/intent; preserve its ID until terminal.
Use bounded backoff for 409 concurrency/429 quota responses. Do not invent a new
ID on every retry. Ordinary elapsed production/upkeep may settle even when a
construction attempt fails; distinguish it from the construction debit.

**Multiplier limitation:** this Checkpoint 1 Central backend deliberately uses
1×. Singleplayer's tested 1.2× remains unchanged. Do not claim a multiplayer 1.2×
bonus or enable it using untrusted presence/visibility. A trusted active-bonus
policy is a separate review item. Canonical seed 734221 must also be independent
of a player's custom Singleplayer seed before any browser capability is enabled.

## 10. Evidence, safe stop and current release status

Run the existing isolated suite on the Lenovo with Docker Desktop/Node:

```powershell
Set-Location $RepoRoot
node central-online/backend/tests/run-postgres.cjs (Join-Path $env:TEMP 'mapgame-cp1-tests')
if ($LASTEXITCODE -ne 0) { throw 'Isolated backend tests failed' }
$GameTests = @(Get-ChildItem .\tests\*.test.cjs | ForEach-Object { $_.FullName })
node --test @GameTests
if ($LASTEXITCODE -ne 0) { throw 'Existing game tests failed' }
```

The baseline previously reported 17 isolated backend tests and 101 game tests;
rerun and record actual counts. The isolated runner creates synthetic local
fixtures and never points at Supabase. Do not run build-bundle/build-release
merely to deploy an already frozen candidate; they regenerate reviewed outputs.

Capture the release SHA, CLI version, migration names/hashes/history, pre/post
metadata, both OFF settings, gateway/handler results, two-account security and
transaction outcomes, exact ledger comparisons, and unresolved issues. Store
account IDs and detailed audits privately. Never publish passwords, auth
responses, refresh/access tokens, service credentials or real player data.
Do not claim Windows, live-CDN, browser or deployed-account validation from
isolated/cloud cached-library results. Existing browser suites target SP unless
a staging-only client/test fixture is separately reviewed.

After an approved temporary test window, restore the Edge flag OFF and verify
the database setting is OFF. `rollback-disable.sql` is an emergency **write**
procedure requiring its own approval: it disables settings and revokes service
RPC grants while retaining balances, buildings, receipts and audit. It is not
a destructive schema rollback, and resumption needs reviewed re-grants. Never
drop receipts or reset the remote database to hide a failing test.

Clear `$UserAToken`/`$UserBToken` and auth/receipt variables and close the test
PowerShell process. Remove CLI login credentials with the supported logout
flow when no longer needed. No automatic promotion or merge into `main`.

**Current status:** guide prepared only. Staging baseline/security hardening,
explicit apply/deployment approval, actual Windows CLI bundling and genuine
two-account acceptance remain outstanding. Multiplayer spending stays disabled.

CLI reference: [installation](https://github.com/supabase/cli#install-the-cli),
[link](https://supabase.com/docs/reference/cli/supabase-link),
[migration preview](https://supabase.com/docs/reference/cli/supabase-db-push),
[Edge deployment](https://supabase.com/docs/reference/cli/supabase-functions-deploy).
