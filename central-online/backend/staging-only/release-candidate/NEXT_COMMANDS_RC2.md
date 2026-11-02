# Lenovo: one safe command at a time

All commands below are offline/local except the explicitly identified Git fetch/
pull. They do not contact Supabase. Start inside your existing Map Game checkout.
Run one command, inspect its result, then proceed. Preserve any local changes;
never use reset/force/repair to get past a discrepancy.

1. Check local work:
   ```powershell
   git status --short
   ```
   If it lists work, preserve/review it before continuing; do not discard it.
2. Fetch this repository's latest branches:
   ```powershell
   git fetch origin
   ```
3. Select the existing candidate branch:
   ```powershell
   git switch feature/0.4.1-multiplayer-economy-rc
   ```
4. Update only by fast-forward:
   ```powershell
   git pull --ff-only origin feature/0.4.1-multiplayer-economy-rc
   ```
5. Compare the commit with the reported RC2 SHA:
   ```powershell
   git rev-parse HEAD
   ```
6. Explicitly verify RC2, **not** the old approved manifest:
   ```powershell
   node central-online/backend/staging-only/release-candidate/build-plan.cjs --candidate RC2 --check
   ```
   Success is source integrity, not deployment approval. CANDIDATE.json remains
   the unchanged RC1 record; its old unqualified check is expected to fail now.
   Do not run --write, regenerate hashes or edit either manifest to fix failure.
7. Run the candidate provenance/order tests:
   ```powershell
   node --test central-online/backend/staging-only/tests/candidate-plan.test.cjs
   ```
8. With Docker Desktop running and the approved PG image already cached:
   ```powershell
   node central-online/backend/staging-only/tests/run-isolated.cjs (Join-Path $env:TEMP 'mapgame-rc2-review')
   ```
9. With PowerShell 7.2+ available:
   ```powershell
   node --test central-online/backend/staging-only/tests/local-schema.test.cjs
   ```
10. Privately review REVIEW_RC2.md, the new protected-source diff, your existing
    local schema review and metadata evidence. Do not upload exports, SQL bodies,
    JWTs, keys, auth responses or passwords. No new connection/export is authorized
    by these commands. Record approval and the private reviewed baseline/wrapper
    hashes separately; test fixtures and raw dumps are never deployment baselines.

STOP here. Disabled staging provisioning needs explicit approval for the exact
reviewed SQL and target. The subsequent genuine JWT/REST/Realtime/Edge matrix and
separate temporary spending approval are in WINDOWS_ACCEPTANCE.md. None of those
operations has been performed by this offline review. No production action, db
push, reset, deployment, account deletion or spending enablement is authorized.
