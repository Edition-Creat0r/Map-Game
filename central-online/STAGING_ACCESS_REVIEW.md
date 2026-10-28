# Staging access and legacy session review

Scope: deployment preparation for checkpoints 1–2 only. No migration, remote RPC, database write, activation, gameplay change or production inspection is authorized by this report.

## Verified source state

Review base: `48a881c3d35707c7512626cf9fe49654114b45d5` on `feature/0.4.1-central-world-online`. Checkpoint 1 is `db1bec5`; checkpoint 2 is `48a881c`. Main remains unchanged. The local checkout was clean before review.

No Supabase connector, staging environment binding or confirmed staging project identity was available during review. The URL embedded in `auth.js` is not evidence of a separate staging project and must not be used by assumption. Live schema, RLS, grants and session-security conclusions remain unverified. Request the staging project reference and a securely configured metadata-read-only connection; do not request credentials in chat or use a service-role key as a read-only credential.

## Source findings and required evidence

- `multiplayer.js` starts a client-generated session using `map_game_start_session`, checks `map_game_session_heartbeat` every ten seconds, and ends it through `map_game_end_session`. None of these deployed definitions is in this checkout. Their server-side authorization is a release blocker, not a proven vulnerability.
- On heartbeat transport/RPC error the legacy client logs and continues. A false response disconnects it. Browser heartbeats therefore cannot enforce authority. Verify every protected server operation independently rejects stale, foreign, ended and replaced sessions; test RPC/REST/realtime access independently of the UI.
- Start-session accepts a browser-provided username. Verify that it cannot bypass checkpoint-2 authoritative naming, mutate another identity, expose email-derived names or overwrite protected membership. Review trigger ordering and naming guards against the actual legacy schema.
- The fallback session identifier uses time and Math.random rather than a UUID. It must not become an authentication secret. Verify server format validation, account/world binding and denial behavior; modern random UUID availability does not establish server correctness.
- The proposed economy Edge adapter verifies the user's token via GoTrue and invokes heartbeat with that same user token before service RPC access. This is a useful source-level boundary, contingent on the legacy heartbeat securely binding `auth.uid()`, world and session. Heartbeat may write liveness state, so do not invoke it during metadata-only access review.
- Naming and economy activation remain default OFF. Existing Singleplayer-only construction and naming client gating remain unchanged. No real two-account security, staging performance or capacity result is claimed.

## Safe initial access procedure

1. Obtain explicit identification of the separate staging project and confirm it differs from the production client target. Configure approved TLS-verified connectivity and a dedicated metadata-read-only credential in secure environment settings. Inspect credential names/presence only.
2. Prefer a role with no player-table SELECT, no write privileges, no privileged role membership and no EXECUTE on application RPCs. Read-only transactions supplement these restrictions; they do not make an owner/service credential least-privileged. Catalog visibility may be incomplete: missing definitions/grants must be reported as unavailable, not safe.
3. Privately review the checked-in `backend/preflight.sql` and `naming/preflight.sql` before execution. Function definitions can contain historical embedded secrets; keep raw output private, restrict artifact permissions and share only redacted findings. Do not query player rows or call legacy session RPCs. Do not expose connection strings in arguments or logs.
4. Run approved catalog SELECTs inside `BEGIN READ ONLY`, with local statement/lock timeouts, and finish with `ROLLBACK`. Inspect table/column contracts, RLS/FORCE RLS, ownership, PUBLIC and role grants, role inheritance, SECURITY DEFINER search paths, function overloads/default EXECUTE, triggers and realtime publications. Supplement existing preflights for session tables and unknown dependencies; their current table lists are not a complete audit.
5. For all three session functions, verify identity derives from `auth.uid()`; world membership/verified-account eligibility; atomic replacement/concurrency; expiration/replay handling; foreign-session denial; restricted liveness/end updates; safe search paths and grants; no direct session-table or realtime leaks. Inspect claim creation, transfer/recovery and capital authorization as well.
6. Record redacted findings and a compatibility decision before preparing any staging deployment. Actual deployments, migrations and mutating two-account security tests require separate explicit authorization. Keep both database and Edge economy flags OFF, naming OFF and frontend multiplayer spending disabled until the required security matrix passes.

## Deployment gate

Read-only staging access is pending secure configuration and staging identity confirmation. Neither checkpoint has been deployed or certified by this review. Existing migration order, gateway JWT verification, rollback-disable procedures and two-account security gates in the backend/naming READMEs remain mandatory. Do not apply migrations or enable spending to bypass an access blocker. Do not merge main or proceed to checkpoint 3.

## Validation for this review

`node --test tests/*.test.cjs central-online/naming/tests/policy.test.cjs central-online/naming/tests/client.test.cjs`: 110 passed, zero failed/skipped (about 2.6 seconds). Initial sandbox execution prevented two existing Git subprocess checks; rerunning with permitted subprocess access passed the complete selection. This is regression evidence, not live session/RLS certification. Docker-backed SQL and Deno deployment suites were not rerun for this documentation-only review. No gameplay or performance behavior changed; staging load/FPS checks remain unrun.
