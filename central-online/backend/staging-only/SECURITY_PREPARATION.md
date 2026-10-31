# Final offline security preparation

Base: `559b20de995710d3ad68d9eacb1f31ade2e1316b` on the unchanged
`feature/0.4.1-staging-security-review` branch. Work lives separately on
`feature/0.4.1-security-preparation`. This package is **not deployment approval**.

## Reviewed decisions and improvements

- Session start still rejects a foreign session ID before touching the caller's
  previous session. Both overloads use the same locks and never assign `user_id`
  in the conflict update. No ownership-transfer mechanism was introduced.
- Heartbeat still binds verified user/world/session and rejects stale (at least
  90 seconds), future-dated or conflicted rows. Explicit authenticated rejoin is
  allowed. End-session deliberately remains **owner-only idempotent cleanup**:
  an expired/conflicted own row can be deleted; `true` is an acknowledgement,
  including when no matching row exists. Ending never renews a session. This
  records existing behavior rather than silently changing client semantics.
- The opt-in draft now refuses non-postgres session function owners, argument
  defaults, set-returning/non-boolean contracts, missing identity primary keys,
  required NOT NULLs, missing/unvalidated/deferred expected FKs, and missing or
  partial global owner uniqueness. It **does not create or repair constraints**.
  These are conservative expected-baseline requirements, still subject to the
  private real export. Unexpected valid schema variants require a new review.
- A public extra SECURITY DEFINER routine or any preexisting noninternal trigger
  on the five tables stops draft application. There is no guessed allowlist of
  production hooks. The four exact session signatures must be the reviewed ones.
  The draft is now explicitly baseline-first, not an after-001 retrofit.
- Elevated roles reachable from client roles (including SET ROLE membership,
  conservatively regardless of inheritance settings) stop the draft. After
  named-role revocations, effective inherited session writes, legacy TRUNCATE /
  REFERENCES / TRIGGER rights and column REFERENCES also stop it. Additional
  role grants are not silently removed or rewritten.
- The test runner now actually applies synthetic baseline -> hardening -> 001
  -> 002 -> 003. Its PostgreSQL image must already be cached (`--pull=never`),
  and the disposable container has no network, ports or host mounts. Tests use
  synthetic identities, not real GoTrue/JWT accounts. Fixtures are never baselines
  for deployment. Temporary backend activation occurs only inside the disposable
  synthetic integration test, followed by reset/cleanup, never in a game client.

## Windows local-export report

[Review-LocalSchema.ps1](tools/Review-LocalSchema.ps1) is self-contained PowerShell
7.2+/.NET. It does not invoke Git, Docker, psql, Supabase, network APIs, or evaluate
SQL. It reads a local UTF-8 file (maximum 32 MiB), hashes the bytes and writes only
new sanitized JSON/Markdown reports under the selected private report directory.
The input is never copied, edited or executed. UNC/network-drive and repository
locations are refused; link/junction targets are checked. Keep both locations
outside Git, the game's HTTP root, synced/shared folders and any public directory.
Use your private Windows user-profile folder with access limited to your account.
The script does not change filesystem permissions or establish a private ACL.

The trusted lexer separates comments, quoted identifiers, strings, dollar bodies
and outer statements; it is **not a PostgreSQL semantic parser**. Reports contain
fixed finding codes/messages, line numbers, counts and the SHA256, never SQL,
unknown object names, source filenames/paths or credential matches. Potential
credentials get a fixed warning only. Even error output is generic. Reports are
still private: they expose structural findings and line numbers.

Checks include the five table/RLS definitions, required primary keys, explicit
NOT NULL evidence, FK syntax, global owner uniqueness, session-routine counts,
unsafe owner reassignment, SECURITY DEFINER/search paths, owners, grants/defaults,
role memberships, triggers, policies, views/rules, data statements, psql directives
and sensitive patterns. Missing or unusual syntax is flagged for manual review,
not repaired. Comments/body strings cannot fake outer DDL evidence. Legitimate
`\restrict` / `\unrestrict` lines are recorded without being executed or stripped.

**Exit 2 = report produced, REVIEW REQUIRED. Exit 1 = scan failed; no complete
new report. No exit code approves deployment.** The script never emits a pass or
claims that absence of a pattern proves safety. `--no-owner` dumps cannot prove
owners; public-only dumps cannot prove global memberships or external dependencies.
A privileged-routine warning can be expected even for a safe definer function:
its implementation and effective permissions still need review.

## Remaining blockers

1. The complete real export has not been reviewed. Confirm all five tables,
   constraints (including referential actions, owner uniqueness scope and index
   validity), owners, function argument names/return types/defaults, policies,
   table AND column grants, all dependency schemas, views/rules and triggers.
2. Review real role attributes/membership options, effective schema CREATE,
   BYPASSRLS/superuser reachability, default privileges and grants to roles other
   than anon/authenticated/service_role. The draft's checks do not certify the
   whole role graph or prevent a privileged administrator from changing it later.
3. Public-definer detection is conservative, not a proof that all alternative
   write paths are gone. Review nonpublic/exposed schemas, SECURITY INVOKER
   wrappers, dynamic SQL, extension routines, views, event triggers, dependency
   functions and service privileges. Public schema-only scanning cannot discover
   omitted objects or actual gateway exposure. No blanket live-security claim.
4. Admin deletion, auth-user cascades, reconciliation and recovery need explicit
   design/review: the write guard rejects unreviewed deletions and identity moves.
   Capital terrain/buildability remains an existing pending product decision.
5. Session abuse rate limiting is not implemented. Revocation is checked before
   economy processing, not atomically inside context/commit; an already-running
   request is not guaranteed to be cancelled by a newer session. No new security
   claim is made for in-flight revocation.
6. Real two-account JWT/REST/RLS/Realtime/Edge tests remain NOT RUN. Staging target
   verification, reviewed import, backend deployment and any temporary economy
   test activation each require separate explicit authorization. Player-facing
   Central spending remains OFF. No Supabase access is needed for this package.

## Order and transaction requirements

Reviewed **private baseline -> reviewed security hardening -> 001_backend.sql ->
002_pin_rules.sql -> 003_legacy_coordination.sql**, all before disabled Edge
provisioning or separately authorized staging tests. The baseline must provide
Supabase's existing auth dependencies, the five real application tables and four
legacy session signatures; do not fabricate managed auth or import real users.

The baseline and reviewed hardening should be one approved transaction so unsafe
legacy permissions/RPCs are never exposed between imports. The draft has no
BEGIN/COMMIT of its own: both acknowledgement SET LOCALs and the entire draft must
be in the same transaction. They are operator acknowledgements, not target proof.
Do not run it statement-by-statement in the Dashboard. Reapplication is not
idempotent; do not hide a partial failure with repair or include-all commands.

001 creates the disabled private economy and service RPCs; its coordination
function dependency is supplied by 003 before any activation. 002 pins unchanged
rules and leaves settings OFF. 003 requires capitals and adds coordination; the
ownership hardening remains active even with the economy OFF. CLI dry-run only
lists files; it does not prove SQL correctness. Neither test fixture is deployable.
Do not include naming 004/005 or the separate 0.4.2 industrial feature branch.

Failure of the draft transaction rolls it back, including revocations. Do not
restore unsafe session grants as an automatic rollback. Existing migration-order,
explicit approval and recovery instructions in [WINDOWS_SCHEMA_REVIEW.md](WINDOWS_SCHEMA_REVIEW.md)
and [the deployment guide](../WINDOWS_STAGING_DEPLOYMENT.md) still apply.

## Validation commands

```powershell
# Local export triage is separate; see WINDOWS_NEXT_SESSION.md.
node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-security-tests')
# PowerShell 7.2+ must be on PATH (or set PWSH_BIN to its local executable).
node --test central-online/backend/staging-only/tests/local-schema.test.cjs
node central-online/backend/tests/run-postgres.cjs (Join-Path $env:TEMP 'mapgame-cp1-tests')
$GameTests = @(Get-ChildItem .\tests\*.test.cjs | ForEach-Object { $_.FullName })
node --test @GameTests
```

The scanner tests skip if PowerShell 7.2+ is unavailable. A skipped scanner suite is
not a Windows validation result. Synthetic credential canaries, fixtures and test
reports contain no real exports, player data or keys.

## Actual validation for this preparation branch

All results below use committed-base code plus this preparation diff; no real
export or Supabase credential was available or used. No tests were skipped.

| Suite | Result |
| --- | --- |
| Original synthetic vulnerability reproductions | 2 passed |
| New baseline contract/rollback checks | 17 passed |
| Hardened session/ownership/security/economy integration | 20 passed |
| PowerShell scanner under official SHA256-verified PowerShell 7.4.6 on Linux | 18 passed (including conditional-CREATE compatibility regressions) |
| Existing Checkpoint 1 SQL/economy suite | 17 passed |
| Existing deterministic game/Singleplayer suite | 101 passed |
| Existing naming regression suite (isolated, not deployed) | 31 passed |
| Checkpoint 1 compatibility before/after naming fixtures/migrations | 17 passed before and 17 passed after |
| Actual Windows/Lenovo execution | NOT RUN |
| Private real export review; live metadata; genuine two-account staging tests | NOT RUN |

The 39 first-three-row cases include collisions in both overloads, concurrent
starts and purchases, foreign-account read/write/heartbeat/end denial, stale /
future / conflicted heartbeat, expired-claim denial, owner-only expired cleanup,
missing PK/FK/NOT NULL, unvalidated FK, partial/missing owner uniqueness, unexpected
function ownership/defaults, elevated/inherited roles, inherited column writes
and claim TRUNCATE, an alternative definer RPC and unknown trigger. Rejected
contract changes roll back without leaving a security schema or revocations.
The successful integration runner now uses the documented order, records it in
its result, and verifies settings remain OFF before tests.

Scanner cases verify original-byte hashes, credential-canary redaction, generic
errors, safe quoted identifiers/nested comments/dollar bodies, missing structural
contracts, psql directive handling, and repository/symlink/input protections.
The script is never run against a real dump in this environment. It is static
triage, not a substitute for PostgreSQL catalog inspection or a Windows run.

Local-only logs: `/tmp/mapgame-final-preparation.log`,
`/tmp/mapgame-final-preparation-results/`, `/tmp/mapgame-schema-scanner-tests.log`,
`/tmp/mapgame-final-preparation-core.log`, `/tmp/mapgame-final-preparation-game.log`,
`/tmp/mapgame-final-preparation-naming.log`. These are not committed. Initial
implementation test failures were corrected before the final passing runs.

Only `.gitignore`, this staging-only documentation, the opt-in draft, local
scanner and synthetic-test files change. Economy/naming migrations 001–005,
Edge/client/auth/ownership runtime, Singleplayer and saved data are unchanged.
Nothing here modifies a hosted database, enables player spending or merges main.


## Scanner compatibility follow-up to 8b7cc1d

The table recognition expressions previously accepted `CREATE TABLE public.name`
but omitted `IF NOT EXISTS`. Lowercase quoted identifiers were already safely
normalized by the lexer; the missing optional clause caused all five reported
tables to be missed. The same prefix was used for PK/FK/NOT NULL evidence, so the
bug also produced secondary constraint warnings. No private export was accessed.

The scanner now recognizes both ordinary and `CREATE TABLE IF NOT EXISTS`
statements for exact lowercase public-table identifiers, including quoted ones.
PK/FK/column evidence uses the corrected syntax too. Conditional creation is
recognized as export evidence only: it does not prove an already-existing target
table would match the definition. Duplicate definitions retain review findings.

NOT NULL evidence is now separated at table-column depth. Parentheses/commas in
types and defaults such as `timestamp(6)` and `DEFAULT now()` no longer hide an
explicit modifier. Nested CHECK/default expressions and literal text cannot count
as NOT NULL. Complex defaults remain conservatively unresolved, and duplicate
columns or later DROP NOT NULL retain warnings. Primary-key-implied NOT NULL still
requires private catalog verification rather than silently dismissing a warning.

Eighteen scanner tests passed under PowerShell 7.4.6, with no skips. The eight new
cases cover all five supplied headers at lines 212/228/240/252/267 (synthetic
columns, not copied private definitions), PK/FK recognition, defaults/type
parentheses, genuine missing NOT NULL, quoted case/lookalikes, duplicate/ambiguous
DDL, expression false positives, unqualified names and ALTER SET/DROP behavior.
Three targeted regressions failed against the old scanner before the fix.
The 39 isolated security cases and 101 deterministic game tests were rerun and
passed; the SQL draft, migrations and runtime are unchanged by this follow-up.
Logs are local-only at `/tmp/mapgame-scanner-compat-{before,after,security,game}.log`.

Rerun the unchanged Windows scanner command against your private local file after
updating this branch. Exit 2 is still expected and means REVIEW REQUIRED. Correct
recognition does not clear owners/roles, constraint validity, alternative access
paths, real schema completeness or genuine two-account staging gates. Actual
Windows execution and review of your real column definitions remain NOT RUN here.
No export upload is needed or requested.
