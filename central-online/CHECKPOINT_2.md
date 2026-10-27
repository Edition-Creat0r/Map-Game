# Checkpoint 2 — Safe Public Naming

Base `db1bec5f3d0da80624acf395c7351baad82c6333`; branch `feature/0.4.1-central-world-online`. **Reviewable implementation and isolated checks only. No live enforcement/deployment is claimed. All naming activation switches remain OFF. No main merge and no Checkpoint 3 work.**

## Delivered

- One server-only evaluator for usernames, kingdom/city/alliance names and public building labels. Unicode 16 full case folding/confusable data, NFKC, Unicode digit/leet and separator/repetition detection, word/phrase/explicit-prefix rules, exceptions, reserved administrative identities, safe international names and manual review for ambiguous scripts.
- Private production rules configured through server secrets, never a client bundle/API response. The checked-in test-only rules are deliberately incomplete and cannot be used to start the production entry point.
- Canonical registry, case-insensitive username uniqueness and additional confusable-key reservations. Username changes require two hours of database time. Concurrent claims/renames serialize. Replays, forged application clocks, timestamps and UUID casing cannot reset/fork the cooldown.
- Authenticated reports, private manual-review queue, hiding and authorized forced rename. Moderator capabilities are private database rows, not user metadata. Hard policy rejections cannot be overridden by review. Moderation checks observed revisions/current policy/current owner, with audit and rollback protection.
- Rate limits before policy evaluation, including rejected attempts. Safe generic rejection responses; no private rule details. Resolved review requests become terminal replay receipts. Retention removes expired raw candidates while retaining minimal replay protection and hashed anti-impersonation reservations.
- Database guards for every **known** legacy public-name mirror: auth username metadata, membership username, claim/capital owner username and capital names. Unconfigured-world capital names cannot be a bypass. Password/private profile updates and ownership IDs remain separate.
- Gated official-client label projection: approved registry labels for ownership/cities; generic Player for unverified realtime presence. The adapter ignores sender names, preserves IDs, caches/batches canonical reads and is disabled by default. Authentication, claiming and economic authorization are not delegated to this adapter.

Kingdom/alliance kinds are implemented in the shared policy/registry, but require trusted owner bindings from actual entity systems. No such live gameplay/source was verified; missing bindings deny writes. There is no new kingdom/alliance gameplay, participant naming form or moderator dashboard—this checkpoint supplies backend APIs and the display integration boundary.

## Tests and evidence

| Check | Result |
|---|---|
| Naming/policy/client security suite | **31 passed**, zero failed |
| Checkpoint-1 backend suite | **17 passed before and after** the new migrations, with naming activation off for the compatibility rerun |
| Existing deterministic game suite | **101 passed**, zero failed/skipped |
| Deno compilation | Passed |
| Actual Deno entry tests | **2 passed**: default-off behavior/origin rejection; refusal of the incomplete test policy |
| Modern Frontier browser regression | Passed with explicitly identified cached Babylon libraries at all three requested sizes |
| C1 browser regression | Passed in the same explicit cached-library mode |
| Actual Supabase accounts/RLS/deployment | **Unavailable; not tested or certified** |
| Normal live Babylon loading | Proxy CONNECT HTTP 403 remains a blocker; cached tests are not live startup proof |

The database suite uses real isolated PostgreSQL, real grants/RLS and concurrent sessions, but **synthetic auth/legacy fixtures and mocked GoTrue identity**. It proves the proposed transaction/permission behavior under those fixtures, not deployed Supabase behavior. No actual project schema, admin role, private production policy, moderator or account was provisioned here.

Tests include all five kinds; profanity/phrases/Unicode/leet/invisibles/reserved titles; harmless Scunthorpe/Dickinson/Penistone/Cockburn/Shiitake and international names; full Unicode case-fold conflicts; concurrent same-name/different-name renames; two-hour/case/UUID/clock bypasses; unauthorized review/hide/rename and forged metadata roles; private schema/RPC/activation/binding denial; canonical legacy writes; hidden public reads; deduplicated non-automatic reports; stale reviews/moderation; forced-rename cooldown; expired-review outcomes; atomic rollback of aliases/mirrors/audit; credential/private-field independence; and sticky guards after API suspension.

A pre-existing fixed-minute quota test occasionally crossed its reset boundary. Its test-only fix now retries **only if the database proves that minute changed**; a same-window failure still fails. No economy rate-limit implementation was weakened.

## Changes and compatibility

New package: [naming/README.md](naming/README.md), policy/handler/Edge entry, migrations **004_registry.sql** and **005_legacy_guards.sql**, Unicode data/license/provenance and generator, private-policy fingerprint helper, preflight/suspension instructions and security/client/Deno test tools.

Existing files changed:

- `index.html`: load the off-by-default naming config and projection before multiplayer.
- `multiplayer.js`: public label projection at existing read/return boundaries and event refresh. Authentication calls, session arguments other than the display label, IDs, ownership comparisons, persistence/claim/recovery operations and permissions remain unchanged.
- `central-online/backend/tests/backend.test.cjs`: quota-window test determinism only.
- `central-online/CHECKPOINTS.md`: checkpoint status.

Economy model/worker/catalog/progression policy, auth adapter, terrain/forest/hydrology/renderers, ownership data and Singleplayer save formats remain unchanged. Checkpoint-1 canonical rules still match their frozen hashes. No certificates, privileged credentials, production filter lists, third-party cached JS or real user data are committed. Public Unicode security data is not the private filter list.

## Exact staging work still required

[Deployment, API, policy format, activation impact, retention and suspension instructions](naming/README.md).

1. Obtain authorized staging credentials and real verified accounts/moderators. Run naming and Checkpoint-1 metadata preflight privately. Audit the actual schema/RLS/grants/auth hooks/session routines/realtime identity and every additional public-name source. Unknown name sources require an adapter first; this checkout is not a schema export.
2. Review/apply Checkpoint-1 001–003, then naming 004 and 005. They default OFF and do not deploy or enable the client/API. Verify all expected legacy columns and triggers and the readonly building-name projection.
3. Review a complete private age-appropriate production policy and exceptions. Supply it as `NAMING_POLICY_JSON` through server secrets. Do not copy the test fixture or place real rules/keys in the public repository/web root. Compute its fingerprint with `naming/policy-hash.mjs`; the helper outputs only the hash.
4. Deploy `public-names` using `naming/supabase/config.toml` and the function entry, retaining gateway JWT checks and initially `PUBLIC_NAMING_ENABLED=false`. Configure only server-side staging URL/public key/service key/exact origins. The actual Supabase CLI deployment and bundling are not certified by the local Deno check.
5. Seed least-privilege moderator rows and only verified entity bindings. Review the activation change: existing unreviewed labels are privately quarantined and replaced with safe defaults until checked. No automatic approval or account/ownership rewrite occurs. Call the owner-only activation function with the reviewed policy hash in controlled staging, then enable writer and client projection only after tests.
6. Test two real accounts, concurrent renames/cooldown, direct REST/RPC/auth-metadata bypasses, legacy mirrors, moderator permissions, hidden cache behavior and realtime identity. Clients do not infer identity/privileges from presence; unverified presence labels remain generic. Existing server-session/ownership security remains an independent release gate.

Emergency suspension stops the API/service write capability while retaining database guards, approved reads, client projection, aliases and audit. **Do not disable activated guards or restore unreviewed raw names.** Retention needs an authorized scheduled job; no real cron/deployment has been configured. Privacy/consent/retention/account-deletion review for the school playtest is not claimed complete.

## Reproduction / artifacts

```sh
node central-online/naming/tests/run-checkpoint2.cjs /tmp/mapgame041-names
node --test tests/*.test.cjs
```

The runner reuses the pinned, network-isolated Checkpoint-1 PostgreSQL setup. It applies only synthetic fixtures, checks compatibility before/after the new migrations and removes the container. Fixture-only config resets are not a production rollback. Deno tests use a read-only package at `/naming` in a network-isolated pinned Deno container; the local disabled server uses loopback only.

Local evidence: `/workspace/central-online/checkpoint2/`. SQL/naming and pre/post compatibility logs, Deno logs, source audit, cached browser `browser/results.json` and `c1-browser/phase-c1-browser.json` are retained. Final run paths are recorded in `summary.json`. Earlier failed/corrected iterations remain separate.

**Outcome:** Checkpoint 2 is implemented for review and locally validated. Production policy configuration, actual schema/RLS/accounts/deployment, live CDN loading and previous performance gates remain open. Main unchanged. Stop before Checkpoint 3.
