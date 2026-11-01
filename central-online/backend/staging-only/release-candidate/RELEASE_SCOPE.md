# Smallest staging multiplayer economy candidate

Base `7f7517a`; dedicated branch `feature/0.4.1-multiplayer-economy-rc`.
**Backend staging candidate only. Not deployed; not production-ready; spending OFF.**
No private export, real JWT, secret or hosted Supabase connection was used.

## Supported trial and explicit limits

Two disposable verified staging users can use the protected session/member/claim/
capital APIs and the server-only Edge intent API to purchase canonical buildings,
settle production, reconnect and replay durable receipts independently. SQL and
Edge trust the authenticated actor, canonical seed/terrain/contracts and database
clock, not browser balances or SP saves. Frozen Checkpoint 1 rules remain unchanged:
125 contracts, 121 materials, seven research nodes. Central production stays 1x;
Singleplayer's 1.2x/uncapped solver and all rendering/save/auth client files are
unchanged. No 0.4.2 catalog or naming 004/005 deployment is included.

This is not a newly wired player shop. Existing player-facing Central purchases
remain disabled; use the explicitly staging-only API acceptance client. Never
open the production-connected game to test a staging backend. Client rendering
seed alignment, actual UI integration, genuine JWT/REST/Realtime/gateway behavior
and real loading remain gates, not offline test claims. No capacity claim is made.

The trial deliberately retains its two auth users, world and economic history.
Hard account/world deletion is unsupported and still rejected by the legacy
DELETE guard and economy account RESTRICT FK. Cleanup tests assert those blockers;
they are not deletion acceptance tests. This prevents a small staging release
from requiring an unreviewed ledger-retention/ownership-transfer redesign.

## Narrow maintenance capability

The existing opt-in hardening draft now contains
`cw041_staging_security.recover_sessions_offline(uuid,uuid,text)` and its private
`session_recovery_audit`. This function is SECURITY INVOKER, search-path pinned,
with no PUBLIC/anon/authenticated/service_role EXECUTE or table grants. Both
session_user and current_user must be postgres. The schema is not public RPC
surface. No extra role, service exemption or ownership-trigger exception exists.

The function requires an existing Central settings row with economy OFF and
locks that row (serializing activation/commit), the operation UUID and the same
actor advisory lock as start/heartbeat/end. It validates a real target auth row
and a fixed reason enum, removes only that actor's Central session rows and records
a server-time/operator/count receipt atomically. It never accepts SQL/free-form
notes, changes a claim/capital/member/ledger, or deletes an account/world.

Operation IDs bind actor and reason; matching retries return the original receipt
and do not revoke a newly rejoined session. Concurrent retries create one audit.
Rollback restores both sessions and audit. Recovery may legitimately revoke zero
rows. Audit has no auth-user FK so future separately reviewed retirement cannot
cascade-delete this evidence. DB owners remain trusted and can alter the database;
this log is not claimed tamperproof against an owner.

Recovery is not an account ban or instant cancellation of previously authorized
requests. Rejoin is allowed after recovery. An operator must first stop the Edge
writer, turn DB spending OFF with the approved stop procedure, wait for/drain
requests, identify the correct target privately and obtain the operation approval.
The function cannot verify an Edge secret flag or remote project identity; these
are independent operator gates. Direct account/world/capital deletion is still
blocked, including for an owner; no pg_trigger_depth/client-GUC bypass was added.

Future retention/anonymization/archival and authorized retirement remain separate
work. Do not change economy FKs to CASCADE, remove idempotency receipts or grant
this function to a browser/server service role to make cleanup easier.

## Exact candidate and deployment boundary

`CANDIDATE.json` locks SHA256s of the SQL, runtime, Edge entry/config, stop script,
this scope/checklist and plan builder. `node build-plan.cjs --check` detects source,
order, target or status drift. Regeneration is not approval. The private baseline
and compiled reviewed hardening wrapper hashes are intentionally unavailable here.
Until independently approved and recorded privately, the candidate is blocked.

Required order, in a fresh verified staging history:
1. `20261101000100_reviewed_legacy_baseline.sql` — private approved baseline only.
2. `20261101000200_reviewed_staging_hardening.sql` — exact draft with approved
   same-transaction acknowledgements; wrapper hash recorded privately.
3. `20261101000300_cp1_backend.sql` — exact 001.
4. `20261101000400_cp1_pin_rules.sql` — exact 002.
5. `20261101000500_cp1_legacy_coordination.sql` — exact 003.

The raw draft is not an auto-deploy migration. Baseline + reviewed hardening should
be one approved provisioning transaction to avoid exposing insecure intermediate
objects. If CLI separates commits, keep staging inaccessible during the approved
window and document the gap; do not pretend a later failure rolled back earlier
commits. Existing histories require explicit reconciliation, never include-all,
force/repair/reset or inserting old versions blindly. Fixtures are never baselines.
The maintenance function is created in hardening but refuses use until 001 exists
and settings are OFF. It requires no extra sixth migration or public RPC.

The Edge entry now refuses to serve enabled economy configuration unless
SUPABASE_URL is exactly `https://upcrdvdspypoyferpuxe.supabase.co`.
This guard supplements, not replaces, checking actual project identity and key
binding. Gateway verify_jwt remains true. No production flag or deployment command
is executed by the plan builder or tests.

## Unresolved release gates

- Privately review complete real schema/metadata, actual function owners/argument
  names/defaults/return types, validated immediate PK/FK/NOT NULL/index scope and
  the eight supplied FK actions. No automatic legacy mismatch repairs.
- Check effective/inherited roles, schema CREATE, additional exposed schemas,
  definer/invoker wrappers, view/rule/trigger/extension paths, actual RLS/column
  grants/default ACLs and Realtime. Draft rejects known drift; it is not a complete
  live schema/role fingerprint. Public names remain Checkpoint 2 work.
- Confirm a reviewed private baseline, auth dependencies, fresh Central metadata,
  SQL hashes/history and actual Supabase owner/CLI capabilities. No auth schema
  import, managed-role fabrication, real player rows or database dumps in Git.
- Keep ordinary account/world deletion unavailable for the staging trial. Review
  provider/admin recovery and ledger-retention requirements before broader use.
  Sessions have no supplied world FK; any future world retirement must handle them.
- Session RPC abuse throttling is not implemented by this candidate (economy
  requests retain their existing limit). Limit the trial to the two approved
  staging users and review project signup/exposure controls before opening it.
  No provider authentication settings are changed by this package.
- Run real two-account gateway/JWT/REST/Realtime/Edge, ownership, transaction,
  offline production and reconnect tests after separate written activation approval.
  End-to-end browser loading, client seed alignment and interface integration remain
  unverified. Isolated mocked GoTrue tests are not those acceptance gates.

Offline evidence and commands are in `VALIDATION.md`. Stop instructions and the
complete future Windows acceptance matrix are in `WINDOWS_ACCEPTANCE.md`.
