# Checkpoint 2 — safe public naming (review-only, disabled)

Base: completed Checkpoint 1 `db1bec5f3d0da80624acf395c7351baad82c6333`. No live Supabase access, deployed schema/RLS verification, real JWT-account testing or deployment is claimed. **Server, database and client activation remain OFF.** Checkpoint 3/chat is not implemented.

## Authority and policy

`policy.mjs` is the single server-side evaluator for usernames, kingdoms, cities, alliances and public building labels. It handles NFKC display normalization, Unicode 16 full case folding, UTS #39 confusable skeletons, Unicode decimal/leet substitutions, separator/spacing obfuscation, repeated letters, literal word/phrase/explicit-prefix rules, exceptions and protected administrative identities. Mixed Latin/Cyrillic/Greek ambiguity enters manual review; invisible/bidi/control/unsupported characters do not publish. Names are 3–24 code points for usernames and 2–48 for other types. Username separators are `_ . -`; other labels also allow spaces and apostrophes. Harmless embedded substrings are not blanket matches.

The full production terms, reserved phrases and exceptions are supplied in **`NAMING_POLICY_JSON` as a server secret**, never a client bundle/API response or public repository file. `tests/fixture-policy.json` is deliberately incomplete and marked `testOnly`; the production compiler refuses it. A reviewed production policy is a remaining deployment dependency. This is not a claim that a finite filter catches every language, context or new evasion; reports, human review and private policy maintenance remain necessary.

Private policy shape: version 1; nonempty `terms` and `reserved` arrays of `{value,mode}` (`word`, `whole`, or carefully selected `prefix`); optional `allowWhole` exact-name exceptions. Administrative reservations are checked before exceptions. Prefixes should be narrow; ordinary short substrings such as those inside Scunthorpe, Dickinson, Penistone, Cockburn, Assistant, Stafford and Shiitake must not be broadly blocked. Hard rejections cannot be bypassed by a moderator approval; correct a false-positive rule privately, then reassess. Manual approval resolves ambiguity only after the current policy is rechecked.

The public Unicode dataset is **not** the private moderation list. It is generated from the installed ICU 76 C APIs (Unicode 16.0.0), with source provenance/hash and the distribution's ICU/Unicode license in `data/`. Public mappings include 22,717 confusables and 1,557 case folds plus decimal digits and assigned-code-point ranges. Newer/unassigned characters fail closed until a reviewed data update. No runtime Unicode download, npm dependency or TLS bypass is needed. Regeneration requires the documented ICU 76 symbols; do not silently regenerate with another Unicode version.

## Database enforcement and compatibility

Migration 004 creates a private FORCE-RLS registry, hashed username/key/skeleton reservations, operations, quota rows, moderator permissions, reports, review queue, audit and quarantined legacy labels. Clients cannot read private tables or call approving/mutating RPCs. Public read RPCs return only canonical labels/revisions or safe fallbacks; no filter lists, raw candidates, hidden names or audit data.

The Edge service verifies the JWT through GoTrue, requires confirmed email, derives the actor from that response and accepts only strict intent fields. It is off by default, keeps gateway JWT checks, uses HTTPS upstream, exact origin allowlists, body/network deadlines and generic public errors. No client clock, approval result, role, cooldown or owner claim is accepted. GoTrue and actual project role/RLS/session behavior still need real staging verification.

Each syntactically valid rename attempt reaches the database quota **before** policy assessment, including rejected names. Default: 10 attempts per account per 600-second server-controlled window; moderators share the configured quota. Completed idempotent receipt replay does not rerun the filter or rename. Failed ownership/moderation authorization never reaches policy assessment. Use platform abuse limits too; this package does not establish protection against many independently verified accounts or high-volume network attacks.

Username uniqueness uses full Unicode case-fold keys plus confusable skeletons, with SQL serialization/unique constraints. Prior username keys/skeletons remain reserved to their original account as SHA-256 hashes to prevent immediate impersonation. Similar-looking handles may therefore be unavailable even if their words are harmless; this is an identity-conflict result, not a profanity accusation. Username changes require **two hours of database time**. Exact no-change writes/replays do not restart that clock; case-only changes count. Moderator force-rename explicitly overrides and restarts it, preventing immediate undo. Review approval does not bypass cooldowns.

User/entity UUIDs are canonicalized, so uppercase UUIDs cannot fork a cooldown namespace. Usernames bind directly to the authenticated account; city names bind to the existing Central capital owner; buildings bind to the real Checkpoint-1 `(actor, building UUID)` and current territory authorization. Kingdom/alliance ownership comes only from private trusted bindings populated by a reviewed real entity adapter—no client binding endpoint exists. **There is no new kingdom/alliance gameplay or proven deployed ownership source here**; without a trusted binding those targets are unavailable.

Migration 005 closes known legacy mirrors: editable `auth.users.raw_user_meta_data.username`, `world_members.username`, `territory_claims.owner_username`, `capitals.owner_username` and capital names. It fails if expected columns are missing. Signup can still create an account; an unapproved submitted username becomes `Player`. Auth metadata cannot subsequently change a username independently of the registry. Password/email/private metadata updates remain separate. Membership/claim/capital writes are canonicalized without changing user IDs, claims, coordinates or ownership permissions. Unconfigured worlds receive unnamed city labels rather than an unmoderated channel. Checkpoint-1 building projections add registry-approved labels without altering economy JSON/contracts.

Activation is **owner-only and deliberate**. It privately quarantines preexisting labels and resets unreviewed public labels to `Player`/unnamed defaults; it does not silently approve them. Existing approved registry labels are synchronized atomically. Authentication credentials and ownership/economy state are not migrated. This visible-label change must be reviewed with the maintainer before activation. An activated guard cannot be disabled by a casual config update; emergency suspension stops the API while retaining canonical database guards and safe public reads.

## Moderation API

All writes are POST to the `public-names` Edge Function with a verified user Bearer token, an explicit allowed origin and a new UUID `operationId`. The same operation ID cannot be reused for different intent. Responses never contain rejection terms or private rule details.

| Action | Required intent fields | Authority |
|---|---|---|
| `rename` | `kind`, `entity`, `name` | Actual account/entity owner |
| `report` | `kind`, `entity`, `reason` | Verified account; deduplicated per reporter/name revision |
| `hide` | `kind`, `entity`, `reason`, `revision` | Server `can_hide` permission; observed revision required |
| `force_rename` | `kind`, `entity`, `name`, `reason`, `revision` | Server `can_rename`; same policy; revision 0 may initialize a quarantined profile |
| `review` | `reviewId`, `decision` (`approve`/`reject`) | Server `can_review`; current owner, policy hash, name revision and cooldown rechecked |
| `resolve_report` | `reportId`, `resolution` (`resolved`/`dismissed`) | Server `can_review` |
| `queue` | none; no operation ID | Any assigned moderation permission; private, bounded queue |

Reasons are fixed enums, not public free-text chat. Moderator permissions are private owner-managed rows; `user_metadata.role`, username content and client-supplied approval flags grant no powers. Reports never automatically hide a name. Hide immediately changes canonical reads/mirrors to safe fallbacks. Review outcomes progress from pending to terminal receipts without reapplying changes on replay. Stale moderation cannot overwrite newer names. Every completed rename/hide/review/report resolution is auditable; no economy rewards or resource transactions occur.

`entity` is the account UUID for `username`/Central `city`, `actorUUID:buildingUUID` for `building`, and a trusted binding ID for kingdom/alliance. There is no participant rename form or moderator dashboard in this checkpoint; the implemented interfaces are the backend API and registry read projection.

## Official-client display boundary

`client-config.js` remains `enabled:false`. The small adapter is loaded before multiplayer and does **no requests or polling while off**. When deliberately enabled after staging review, official clients render claims/capitals only from batched canonical registry reads with bounded caching/fail-safe fallback, ignoring sender-supplied labels. Refresh is nominally 10 seconds while Central is connected; returning to a visible tab invalidates the cache. It does not claim instant erasure of already received text.

Realtime presence identity is currently client-asserted and not verified by this checkout. Therefore enabled mode shows generic **Player** for presence entries, even if a claimed user ID belongs to a real account. It does not infer moderator identity/privileges from presence. Real presence authentication and actual session/ownership permissions remain staging gates; this checkpoint does not rewrite them. IDs, joins, claims, capital writes, economy and Singleplayer mechanics are unchanged. Do not disable the projection after activation while allowing untrusted legacy presence labels.

## Staging deployment steps — NOT EXECUTED HERE

1. From authorized staging, run `preflight.sql` and Checkpoint-1 preflight; privately review actual columns, RLS/grants, auth hooks, username copies, protected-session RPCs, realtime identity/publications and any additional public-name tables. Unknown name sources need a protected adapter first. Do not run synthetic fixture SQL on Supabase.
2. Apply Checkpoint-1 001–003 if not already applied. Review/apply `migrations/004_registry.sql`, then `005_legacy_guards.sql`. Names remain off; no client flag or economy enable switch is changed.
3. Supply a reviewed private production policy outside this repository/web root. Compute its fingerprint with `node central-online/naming/policy-hash.mjs < /PRIVATE/reviewed-policy.json` (prints hash only). Store policy and service credentials through authorized server secrets, never in static files. The test policy must not be used in a playtest deployment.
4. Deploy `public-names` using `supabase functions deploy public-names --workdir central-online/naming --project-ref YOUR_AUTHORIZED_STAGING_PROJECT`. Keep `verify_jwt=true` and `PUBLIC_NAMING_ENABLED=false` until private config, packaging and integration are verified. Standard Deno compilation/disabled-entry testing is local evidence; actual Supabase CLI deployment is not tested here.
5. Assign moderators explicitly as owner-managed least-privilege rows in `cw041_names.moderators`. Connect verified kingdom/alliance owner bindings only after real entity sources exist. Do not give client roles private schema/table access.
6. Review the legacy-label quarantine impact and retention. As authorized owner call `SELECT cw041_names.activate('THE_64_HEX_REVIEWED_POLICY_HASH');` inside the controlled staging rollout. Then enable the Edge flag and, only after two-account tests, the separate client config. These are deployment instructions, not actions performed by Codex.
7. Test genuine users, auth update flows, concurrent renames/cooldown/UUID casing, direct REST/RPC bypasses, every legacy mirror, hidden labels, queue authorization and realtime impersonation. Neither an isolated PostgreSQL schema nor mocked GoTrue identity proves live enforcement.

Private policy rotation: suspend the Edge writer, retain database guards/read projection, review changed rules against existing names, set the new fingerprint, deploy matching private policy and resume only after testing. Older review candidates become stale rather than bypassing newer rules. No full rules are exposed to clients.

Emergency suspension: `suspend.sql` plus `PUBLIC_NAMING_ENABLED=false`. Keep database activation and client projection in place. Do not drop guards, registry or hashed username reservations; do not automatically restore unreviewed legacy labels. Resumption needs reviewed service-RPC grants/config, not re-running CREATE migrations over existing data.

## Retention and limitations

Schedule the owner-only `cw041_names.purge()` job through reviewed staging/production tooling; no cron job is deployed here. Attempt raw intents, review candidates and quarantined legacy text expire after 30 days; expired pending operations get safe terminal results. Audit display text is removed after 90 days; resolved/dismissed reports older than 90 days are removed. Minimal idempotency receipts/fingerprints, event metadata and hashed username reservations remain for replay/anti-impersonation. Actual policy/privacy/consent, backups, account deletion and retention obligations need the maintainer's review, particularly for a school playtest. No compliance certification is claimed.

No live Supabase admin connector, project credentials or deployed schema was available. Production policy configuration, real account/session/ownership tests, unknown legacy adapters and deployment remain blockers. No player-capacity or latency claims are made. The prior Babylon proxy 403 and cold-render performance review remain open; explicitly cached-library browser tests are not live startup validation. Checkpoint 3 is not started.

## Local verification

`node central-online/naming/tests/run-checkpoint2.cjs /tmp/mapgame041-names` uses the pinned Checkpoint-1 disposable PostgreSQL image, no network/ports/volumes, synthetic legacy/auth fixtures and mocked GoTrue identities. It runs Checkpoint-1 tests, applies naming migrations, runs naming/policy/client security tests, then repeats Checkpoint-1 tests with activation off. The fixture-only config reset in that test is **not** a production rollback procedure. `node --test tests/*.test.cjs` checks the unchanged game systems. Deno entry tests cover disabled mode and refusal to deploy the test policy. No actual user credentials, policy or cached third-party JS libraries are committed.
