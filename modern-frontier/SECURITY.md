# Central World security and backend release contract

## Result of this update

**No multiplayer economic, social, username-change or deletion backend is deployed or certified.** No SQL, RLS, existing RPC, ownership rule or Supabase permissions are changed. Client construction remains Singleplayer-only. Friends/messages/extra servers/delete/rename are visibly unavailable. No service-role credential is introduced. The account view queries only the existing authenticated-user API.

Source contains public Supabase authentication plus Central membership/presence/claim/capital clients. It does not contain server SQL/RLS/RPC definitions or authoritative economic settlement. Available environment tools supply no Supabase administration interface. A browser publishable key is not authorization to administer the project, inspect others' private records or bypass policies. Git repository push access does not provide database access. These are the precise obstacles to Phase 4 server operations and Phase 5 release; frontend appearance cannot remove them.

## Proposed server boundary — not implemented/deployed

A reviewed deployment must define account+`central` world economic scope, independent of local SP keys, retaining the canonical 121 material IDs. All Central territories belonging to an account share that world's balance only if the reviewed contract explicitly adopts this scope. No client balance import. Server stores catalog version/hash, recipe contract version, progression version, exact units and trusted settlement checkpoints. Suggested exact-unit SQL representation is `numeric(32,0)` with check constraints (the current 3×10^11 scale and 10^12 resource ceiling exceed a signed 64-bit integer). Serialize units as decimal strings to clients; do not use floating-point balances or client catalog fields.

Suggested records:

| Record | Authorization and consistency |
|---|---|
| World account ledger/checkpoint | Own-account read; privileged settlement writes only; account row lock |
| Building/recipe contract | Public/owner projection only as reviewed; server catalog and footprint; territory permission checked |
| Placement operation | Unique `(world, account, operation_id)`; immutable intent fingerprint; same-ID/different-intent rejected |
| Research/unlocks | Server-owned prerequisites, cost and completion; no client updates |
| Settlement job | Trusted high-water timestamp, versioned resumable progress and exact pending time; no elapsed-time discard |
| Audit event | Transaction identity and committed outcome; no client forgery |

Construction RPC/server handler must authenticate JWT on the server, validate world/territory ownership and account state, settle old-state production, resolve canonical catalog/unlocks, evaluate authoritative water/slope/footprint/collision/rotation, check exact balances, and atomically debit+insert+record the operation. Lock order must be consistent across account and placement-region rows. Use transaction-level serialization or tested spatial exclusion/locking so concurrent cross-border overlap cannot pass. Successful retry returns the same authoritative result; failed operations debit nothing; a conflicting intent cannot reuse an operation ID. Decorative drainage overlays are never authoritative construction water.

The shared world seed, dimensions and terrain masks need a server-executable verified sampler matching the client. A client-supplied `buildable:true`, biome, terrain height or ownership row is not proof. Existing live ownership RPC/policies must be inspected and integrated before replacing any write path.

Settlement uses trusted time only, pinned recipes, beginning-of-tick stocks, proportional input consumption, workers, energy, upkeep, existing ceilings and exact units. Preserve unlimited elapsed time with bounded resumable execution and durable remaining-time checkpoints; never truncate absence or accept client-generated production totals. Concurrent purchase/research/settlement requests serialize against the same account state. Adopt a reviewed trusted active-session lease/event policy before allowing any multiplayer 1.2× bonus; until then multiplayer bonus and spending remain unavailable. Client visibility or supplied timestamps are not activity proof. Singleplayer 1.2×/offline rules remain unchanged.

Direct sensitive table INSERT/UPDATE/DELETE must be denied to clients. Privileged RPCs require explicit caller/role checks and safe function search paths; revoke unneeded execute grants and never put service-role credentials in browser code. Realtime access follows the same authorization and does not reveal private balances/messages. Verify existing RLS rather than assuming it.

## Username, private messaging and account deletion gates

Unique case-folded normalized names need a database uniqueness constraint, restricted character/length/reserved-name rules, an account row lock and server-enforced `next_change_at` (two-hour cooldown). Client metadata is display data only. Concurrent renames must produce one result without bypassing cooldown or exposing email-derived identities unnecessarily.

Friends/messages require authenticated participant access, explicit acceptance/privacy, server-validated sender, blocking/muting/reporting, rate limits, moderation and documented retention. Private realtime channels must be authorized; no public conversation table or broadcast. Safety controls are a prerequisite to enabling send, not post-release polish.

Deletion needs reviewed data/retention consequences, deliberate confirmation, recent server-verified reauthentication, idempotent server job and safe handling of ownership/capitals/claims, messages/reports and legally retained data. The current UI does not offer an actionable deletion button because that policy and implementation do not exist.

## Required adversarial staging tests (NOT RUN; release blockers)

| Attack/test | Required server outcome |
|---|---|
| Direct own/other balance write, arbitrary production totals | Rejected; balances unchanged |
| Forged or unavailable building/material/recipe/version | Rejected against canonical server catalog |
| Duplicate placement/research/settlement operation | One debit/result/event only |
| Same operation ID with different coordinates/type | Rejected without mutation |
| Two accounts build on unowned land | Unauthorized construction rejected |
| Concurrent overlapping/cross-border placements | At most one conflicting footprint committed |
| Concurrent account purchases with insufficient combined funds | No negative balances, no partial build/debit |
| Forged client clock/visibility/activity or repeated catch-up | Trusted server time and checkpoint only; no duplicate accrual |
| Very long absence interrupted/resumed repeatedly | Exact complete catch-up, no time cap or dropped pending interval |
| Research prerequisites/worker/power/upkeep/input shortages | Same validated constrained rules; no bypass |
| Cross-user inventory/profile/message/realtime read | Denied unless explicitly authorized public projection |
| Concurrent rename, case variants/reserved name/2h bypass | Unique normalized result and enforced trusted cooldown |
| Unconfirmed/stale-reauth/replayed deletion | Rejected or idempotent verified job; no accidental deletion |

Before enabling Central economy: obtain authorized staging/project access, export current schema/grants/RLS/RPC definitions, review migrations and rollback, deploy catalog/sampler/settlement, seed isolated test users, run the matrix plus actual two-user browser flows, inspect server audit/transactions, compare exact solver results, then explicitly enable the client capability. Keep main and existing ownership untouched if any gate fails.

## Local frontend validation boundary

Pure tests exercise backup key isolation, size/version/depth/prototype checks, exact-string preservation, rollback/recovery, advancement idempotence/prerequisites/pins and image pre-decode bounds. Browser tests use real SP purchase/research/save/import and signed-out auth gating; no privileged backend requests. Such tests do not certify database authorization. Full deployment and signed-in multiplayer tests remain separate release gates.
