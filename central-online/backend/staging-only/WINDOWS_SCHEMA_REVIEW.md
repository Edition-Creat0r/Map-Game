# Windows PowerShell 7 — source schema review before staging import

Supplement to [the CLI deployment guide](../WINDOWS_STAGING_DEPLOYMENT.md).
These are future operator instructions, not a claim of live access or approval.
Nothing here was run against a hosted database. **Do not execute remote writes
until the complete schema and the staging plan are explicitly approved.**

## 1. Collect and verify the source export privately

The two owner-provided metadata exports informed the [dependency review](README.md),
but do not constitute a confirmed complete, restorable schema export. The owner
must separately obtain the following evidence. Codex is not accessing production.

Keep exports outside Git, the game's HTTP document root, OneDrive and shared
folders. Restrict the folder to your Windows account using its Security
properties. Never attach raw dumps or auth responses to chat or commits.
Function bodies/defaults may contain embedded credentials even in a schema dump.

Use the official PostgreSQL Windows client tools. `pg_dump` must be at least
the source server's major version; `psql` must understand the dump's syntax.
Set certificate verification for the operator session before any connection:

```powershell
$env:PGSSLMODE = 'verify-full'
# Set PGSSLROOTCERT to the reviewed provider CA path if your client needs it.
# Download provider trust material only from the authenticated official source.
```

Do not downgrade TLS verification to make a connection pass. In the **source**
project's Connect panel verify host, port and username. Do not infer the source
pooler region from the staging connection. A shared pooler hostname is not
project identity. Source export is a manual read-only owner operation, separate
from the staging deployment; the following command is not run by Codex:

```powershell
$SourceHost = Read-Host 'Verified source pooler host (nonsecret)'
$SourcePort = Read-Host 'Verified source pooler port (nonsecret)'
$SourceUser = 'postgres.vjwvhtsjdsbcorszzldk'
$PrivateReview = Join-Path $env:LOCALAPPDATA 'MapGame\private-schema-review'
New-Item -ItemType Directory -Path $PrivateReview -Force | Out-Null
$DumpPath = Join-Path $PrivateReview 'source-public-schema.private.sql'
if (Test-Path $DumpPath) { throw 'Preserve existing export; choose a new filename' }
pg_dump --schema-only --schema=public --no-owner --host $SourceHost --port $SourcePort --username $SourceUser --dbname postgres --password --file $DumpPath
if ($LASTEXITCODE -ne 0) { throw 'Incomplete export; do not import' }
Get-FileHash -LiteralPath $DumpPath -Algorithm SHA256
```

Enter the password only at the hidden prompt. No password URI, command-line
password, transcript, debug log, plaintext `.env`, saved script or screenshot.
Do not use `--no-acl`/`--no-privileges`; grants/default privileges need review.
Do not dump player data, managed `auth`/`storage` schemas or cluster/global roles.
If provider/CLI dump tooling strips grants, supplement them explicitly with
[preflight.sql](preflight.sql), including column grants. Never treat absence
from a filtered dump as proof a privilege does not exist.

Checklist before declaring export complete:

- Successful exit and complete footer; checksum and source/server/tool version.
- All five tables, columns/defaults, PK/FK/check constraints and indexes.
- RLS enable statements, every policy, table/column ACL and default ACL.
- All four session signatures and full function definitions/owners/search paths.
- All ordinary/event triggers, helper functions, views and external dependencies.
- Realtime/publication settings captured separately if not emitted by the dump.
- Comparison with both earlier metadata exports, explaining any differences.

Treat the dump as executable code. Privately inspect dynamic SQL, SECURITY
DEFINER bodies, embedded credentials/endpoints, reconnect/shell/file psql
meta-commands, role/extension/schema changes, COPY/data inserts and unexpected
triggers. A string scan alone cannot certify it safe. New `pg_dump` versions
may emit `\restrict` commands: use compatible `psql`; do not strip security
directives blindly. The read-only preflight itself returns only metadata, but
its function text also needs private handling.

## 2. Resolve the security draft and record approval

Review `draft/000_staging_legacy_security.DRAFT.sql` against that complete export.
Confirm parameter names/types, both overloads, unknown policies/triggers/RPCs,
existing duplicates and ownership-recovery requirements. Reproduce the original
session exposures and proposed fixes in isolated tests. The synthetic fixture
is deliberately not a full production baseline.

Draft decisions needing approval include Central-only sessions, 90-second
heartbeat expiry, one session per world/account, session-first membership join,
verified account/session gates for claims, capital territory ownership while
economy is OFF, and denial of unreviewed removal/transfer/admin write paths.
Do not apply a fix whose effect on real recovery or clients remains unknown.

Expected staging history, when all parts are approved:

1. Private reviewed legacy baseline: five application tables, dependencies and
   real policies/functions; no production/auth/player data.
2. Reviewed staging-only draft, wrapped in **one transaction**. After verifying
   the target independently, its operator wrapper must include both
   `SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';` and
   `SET LOCAL mapgame.legacy_schema_reviewed='yes';`. These acknowledgements are
   not automatic proof of identity or full schema correctness.
3. Existing economy `001_backend.sql`, `002_pin_rules.sql`,
   `003_legacy_coordination.sql`, in that order, settings OFF.
4. Existing Edge Function deployed OFF, followed by genuine staged-account
   acceptance. No naming migrations 004/005 or player-facing spending.

The main guide copies only 001–003. An approved baseline/draft must be added
to the reviewed migration history before those versions, **not** appended after
already applied economy files by `--include-all`. Reconcile manual imports and
CLI history explicitly; never use repair commands to hide unapplied changes.
Retain approved SQL hashes and exact filenames. A later partial failure does
not mean earlier individually committed migrations were rolled back.

## 3. Approved staging-only import — not authorized by this guide

First test the reviewed baseline/draft with local Docker/Supabase. Never deploy
`backend/tests/bootstrap.sql` or `staging-only/tests/legacy-model.fixture.sql`.
They fabricate Supabase roles, auth identities and permissive policies.

After explicit owner approval only, verify Dashboard target
**upcrdvdspypoyferpuxe**, the local CLI project-ref guard, and the baseline hash.
Use one reviewed migration workflow. If using a manual import, this is the
staging-only command shape; `$ApprovedBaseline` must be a reviewed private file,
not the raw export, and must contain no transaction-breaking/reconnect commands:

```powershell
# APPROVAL REQUIRED. PGSSLMODE=verify-full and reviewed CA already configured.
# This is a remote WRITE; do not run as a preview or during preparation.
psql --host aws-1-us-west-2.pooler.supabase.com --port 5432 --username postgres.upcrdvdspypoyferpuxe --dbname postgres --password -X --set ON_ERROR_STOP=1 --single-transaction --file $ApprovedBaseline
if ($LASTEXITCODE -ne 0) { throw 'Import failed; inspect before continuing' }
```

The approved baseline/hardening may be one reviewed transaction so the unsafe
intermediate baseline is never exposed. Keep Edge undeployed/OFF and staging
inaccessible to game clients during provisioning. Do not seed production player
records; create only approved fresh Central metadata and disposable accounts.

Run both preflights on staging, compare expected metadata, then follow the main
guide's `migration list` and `db push --dry-run`. A dry-run lists migrations;
it does not validate SQL execution or security. Test table **and column** writes
with user JWTs, both start overloads, collisions, stale/future heartbeat,
concurrent newest-session behavior, eligibility, claims/capital ownership,
private economy RPC isolation and all exact ledger rules. Admin/service-role
success does not prove user authorization. Isolated mocked-GoTrue tests do not
replace genuine two-account REST/gateway/Realtime testing.

## 4. Rollback and report

A failed transactional baseline/draft import rolls back that transaction. Do
not run a down migration that restores direct session writes or foreign-session
takeover. If already deployed, suspend staging Edge/session writer access;
retain balances, buildings, audits and idempotency receipts. The existing
`rollback-disable.sql` is a separately approved economy stop; resuming requires
reviewed service grants. Never reset production, delete receipts or auto-drop
schemas as a rollback. Retiring/recreating disposable staging is a separate
owner-approved decision after preserving needed evidence.

Record approval, commit, tool versions, sanitized schema diff, SQL hashes and
actual test results/failures. Keep real player data and secrets out of reports.
Until all security gates and explicitly approved staging-only transaction tests
pass, keep the game frontend and Central economy OFF. Temporary backend test
activation and any later release remain separate explicit approvals.
