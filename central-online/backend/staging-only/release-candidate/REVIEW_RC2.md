# Final offline security review — RC2 proposal, not deployment approval

Reviewed starting commit `5f742f2008d87276f76b3d8fde0f31580b2abcc4` on
`feature/0.4.1-multiplayer-economy-rc`. All SQL execution used disposable,
network-isolated PostgreSQL. No Supabase API, credentials, private export, real
JWT, live migration, deployment or spending activation was used.

## Findings and disposition

| Severity | Finding / evidence | Disposition |
| --- | --- | --- |
| Medium — correctness/isolation | RC1 start-session selected only owner at draft:205 and overwrote world at draft:211–215. A user could reuse their own other-world ID, delete their Central session and move the other-world row into Central. Both overloads and concurrent attempts reproduced it. No cross-account takeover was found. | **Fixed**: current draft:201–222 locks and checks owner AND world before deletion, constrains the upsert and requires exactly one affected row. Other-world sessions remain untouched. |
| Medium — least privilege, conditional policy risk | RC1 retained INSERT/UPDATE/DELETE and possible column writes on worlds. Existing fixture RLS hid the risk, but a permissive policy allowed world metadata changes/deletion. This is not evidence that the actual 13 source policies permit those writes. | **Fixed**: draft:158–196 revokes unused client world DML at table and column level, checks inherited access and preserves existing SELECT. World metadata is operator-provisioned, not player-created. Tests deliberately permissive policies; real policy review still required. |
| Medium — approval provenance | The RC1 builder's implicit --write overwrote CANDIDATE.json with current hashes. That command cannot stand in for the newly required source approval. | **Fixed**: build-plan.cjs:38–50 keeps the old file immutable, rejects implicit writes, requires explicit RC2 selection and exclusive creation of a separate manifest. Old approval correctly fails on changed sources; RC2 review is required. |
| High deployment gate — unverified dependency, not a demonstrated bypass | actor() trusts managed auth.uid() and verified auth.users state. The real gateway/JWT/role and auth.uid dependency have not been inspected/tested here. | Gate remains. Review native staging auth.uid owner/settings/dependencies, effective schema/role privileges and all callable wrappers privately. Genuine JWT tests must follow a separately approved disabled deployment. Do not reimplement JWT validation with caller parameters. |
| High operational gate — existing limitation | Legacy DELETE guards block account/world cascades; economy accounts independently restrict auth deletion. | Unchanged. Retain trial users/world. No blanket owner/service exemption, destructive cleanup or ledger/receipt deletion. Private OFF-only session recovery is the only maintenance capability. |
| Medium availability/semantics gate | Session RPC abuse throttling is absent; legacy row writes require any active own session, not a request-supplied session ID. Session revocation does not atomically cancel already-authorized in-flight economy requests. | Unchanged and explicit. Restrict the trial to approved users/exposure controls; do not claim device exclusivity on direct legacy REST or instant revocation. Stop/drain economy before maintenance. |

Line references above identify current source except explicitly labeled RC1.
RC1 historical start routine is in commit 5f742f2 at lines 199–223. The exact raw
historical source can be reviewed with Git locally; do not execute it as fallback.

## What the identity/session review verified offline

- `actor()` (draft:146–156) derives UID only from auth.uid(), rejects NULL,
  non-Central world, absent user, unconfirmed email or absent world. Username and
  device values are labels only; neither can select another actor. SQL does not
  cryptographically validate a JWT. PostgREST/GoTrue supply the trusted request
  context; direct SQL can set custom GUCs, so arbitrary-SQL/set_config wrappers
  would invalidate that trust assumption. Such access remains a metadata gate.
- Both start overloads use the same protected implementation. Global session-ID
  and actor transaction locks, row lock, immutable owner/world filters and the
  unique (world,user) index serialize callers and prevent duplicate/takeover
  behavior under the tested permission model. Foreign-owner collisions reject
  before deleting the caller's existing session; same-owner cross-world reuse
  now rejects too. Trusted DB owners can still change the database itself.
- Heartbeat (draft:230–242) binds UID/world/session, uses server time and rejects
  stale (at least 90 seconds), future-dated or conflicted rows. End-session
  (draft:244–254) binds the same identity and is idempotent owner-only cleanup,
  deliberately permitting removal of an expired own row. Its true return is not
  a row-count/existence disclosure. Wrong-world requests fail closed.
- Session table/column writes, TRUNCATE/REFERENCES/TRIGGER rights and old session
  policies are revoked; new self-only session SELECT remains. RC2 additionally
  strips unused world metadata DML. Effective inherited privileges are checked,
  not just direct ACLs. Service keys/DB owner remain trusted server capabilities,
  not player credentials; these tests do not certify unknown real role graphs.
- Replaced definer routines require postgres owner/boolean/no-default contracts;
  objects are qualified and search_path is pinned to pg_catalog. Explicit
  EXECUTE revocations remove anon/PUBLIC/service access to the four session
  signatures; authenticated retains it. Helpers are private; new recovery is
  SECURITY INVOKER and also requires actual/current postgres identity and OFF.
- Known extra public definer routines/legacy triggers and schema drift abort the
  draft. This is not an exhaustive detector for nonpublic invoker/definer wrappers,
  views, rules, extensions, event triggers or later privileged changes. Count
  summaries (five tables, 13 original policies, four signatures) do not establish
  those objects' predicates, owners, grants or semantics. The fixture's inventory
  and supplied eight FK actions agree, but full real-schema equivalence is unproven.

## Exact final offline results

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Isolated PostgreSQL + handler matrix | 83 | 0 | 0 |
| PowerShell 7.4.6 local schema scanner | 18 | 0 | 0 |
| Candidate/source-provenance tests | 6 | 0 | 0 |
| Singleplayer/game deterministic regressions | 101 | 0 | 0 |
| Existing backend SQL/economy suite | 17 | 0 | 0 |
| Naming regression suite (separate synthetic test schema, not deployed) | 31 | 0 | 0 |
| Backend compatibility before/after naming | 17 + 17 | 0 | 0 |
| Actual Deno Edge default-OFF/origin/target tests | 2 | 0 | 0 |
| Existing naming Deno default-OFF/test-policy rejection | 2 | 0 | 0 |
| Deno Edge type check | Passed | — | — |

83 = 2 exposure + 9 baseline cleanup + 22 contract + 20 session/security + 6 final
review + 12 hardened cleanup + 7 maintenance + 5 two-player transaction journeys.
The new tests first reproduced four failing assertions against RC1; all final
assertions pass after the focused changes. Expected historical RC1 --check exit 1
is a successful approval-invalidity gate, not a failed final test or permission
to rewrite old hashes. Baseline RC1 --check passed before any protected change.

Only the opt-in hardening and source-lock builder/protected review documents
changed among the 14 protected inputs. CANDIDATE.json remains byte-identical:
SHA256 `b6709e5b484c2fd7ab2320eccecf4d322f64aadb5a0beb509ee658f7f589e9fe`.
The builder verifies its metadata fingerprint (JSON file line endings tolerated),
while every actual protected source hash stays byte-exact. RC2 is a separate
proposal requiring fresh review; tests never normalize/rewrite source files to
make a hash check pass. Existing economy 001–003, frozen rules, Edge runtime,
Singleplayer/render/auth/client/ownership sources and save formats are unchanged.

Containers used cached pinned images, network NONE, no PostgreSQL ports/host
mounts. Deno used read-only trusted source with loopback tests only. Auth.uid()
and GoTrue identities in SQL/HTTP tests are synthetic; real locks/RLS/grants/
transactions/ledgers run in PostgreSQL. No genuine JWT/REST/Realtime/Edge deployment
or new Windows/browser run is claimed. Browser startup is not certified by the
101 automated game tests.

Local-only evidence: `/tmp/mapgame-review-rc1.log`,
`/tmp/mapgame-review-reproductions.log`, `/tmp/mapgame-review-rc2.log`,
`/tmp/mapgame-review-rc2-static.log`, `/tmp/mapgame-review-rc2-game.log`,
`/tmp/mapgame-review-core.log`, `/tmp/mapgame-review-naming.log`,
`/tmp/mapgame-review-deno-{check,entry}.log`, `/tmp/mapgame-review-naming-deno.log`. No real data or secrets in reports.

## Remaining work, separated by authority

**Entirely offline:** code/diff review, immutable candidate provenance, exact source
lock, negative/positive synthetic tests and the five-step sequence are prepared.
Review RC2's changes explicitly; do not inherit RC1's source approval. Re-run the
local scanner against your existing private file if useful; it is triage only.
No private export or authentication response needs to be sent to Codex.

**Private metadata/baseline:** locally reconcile real column types/NOT NULLs,
PKs/FKs and actions/indexes, four argument names/return/default contracts, table/
function ownership, actual auth.uid dependency, all policy predicates/roles,
effective inherited table/column/function/schema privileges, default ACLs,
additional exposed schemas/RPCs/views/rules/triggers and Realtime. Inspect source
privately; do not upload private SQL bodies. Approve a sanitized schema-only
baseline and its hash, and the same-transaction hardening wrapper/hash. No raw
dump, managed auth import, player rows or test bootstrap may supply that baseline.

**Explicit staging approval:** independently verify project upcrdvdspypoyferpuxe
and key/connection binding, review actual CLI history/provider capabilities,
then authorize exact baseline -> RC2 hardening -> 001 -> 002 -> 003 and a disabled
Edge deployment. Acknowledge retention-only account/world lifecycle for this
trial. Source lock success is not identity, schema or security approval. Genuine
positive tests are not a prerequisite to the initial disabled deployment: they
are a later spending/release gate. No stage of that deployment is authorized here.

**Genuine staging tests:** after the approved disabled deployment, run real-user
JWT, REST/RLS/column/RPC and Realtime negative tests; then obtain separate approval
for temporary staging spending and the two-account purchases/production/concurrent
replay/reconnect/stop matrix. Check actual bundling, canonical seed, external
loading and any supplied staging client. Player-facing integration is still OFF.
No rate/cleanup/instant-revocation or browser-capacity guarantee is implied.

**Readiness: NOT READY for deployment approval yet.** The private baseline/metadata,
fresh RC2 source approval, target/provider verification and exact wrapper approval
are unresolved. The offline code is ready for that review. Production and Central
spending remain OFF. See NEXT_COMMANDS_RC2.md for one-command-at-a-time Windows
steps, then WINDOWS_ACCEPTANCE.md for the separately approved deployment/test gates.
