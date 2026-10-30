# Future Map Game Minigame Studio — planning only

Status: requirements, not an implemented editor, sandbox, publication service,
payment flow or achievement backend. No Studio code, credentials, Supabase schema
or Central World permissions are changed by 0.4.2A. Each implementation stage
needs a separate approved design, threat review and acceptance gate.

## Projects and the player

- Real multi-file HTML/CSS/JavaScript projects: a navigable file tree, configurable
  HTML entry point, linked scripts/styles, nested relative paths and static image,
  audio/font/data assets. Preserve bytes, filenames, revisions and attribution.
  No single text field pretending to support projects. TypeScript/build tools,
  packages and arbitrary server runtimes are later explicit decisions.
- Versioned project manifest; stable virtual paths; MIME/size/count/path limits;
  block path traversal, unsafe archive links and decompression bombs. Imports
  validate before replacing an existing project and retain a restore point.
- Responsive player with viewport presets, resize/rotation, keyboard/touch input,
  focus handling, mute/pause/stop/restart and a user-gesture fullscreen preview.
  Fullscreen is scoped to the player, never permission to escape the sandbox.
- Separate, credential-free preview origin. An iframe sandbox allows only reviewed
  capabilities (initially scripts; no same-origin access, top navigation, popups,
  forms or downloads by default). Restrict network/assets with CSP and declared
  capabilities; default deny. Never give projects the game's storage, JWTs,
  account data, economy objects, service keys or privileged parent APIs.
  Prototype relative assets and ES modules under the chosen sandbox: a scoped,
  credential-free asset resolver/CORS policy may be required for opaque origins.
  Do not add parent-origin access merely to make imports work.
- Cross-frame communication uses a versioned, size/rate-bounded allowlist with
  source-window checks, session nonces and explicit responses. A sandbox's
  `null` origin is not proof of identity. Escape all creator metadata in parent
  UI; never insert project HTML into the editor's own document.
- Isolation includes workers, resource budgets and cleanup. Stop controls stay
  outside the project. A plain iframe does not guarantee a hard CPU/memory quota
  against infinite loops; review process isolation and hosting limits explicitly.
  Suspended/closed previews must release audio, timers, workers and object URLs.

## Accurate diagnostics and AI Debug Reports

- Capture console levels, uncaught exceptions, rejected promises, syntax errors,
  script/style/asset loading failures and timestamps. Keep structured objects
  bounded; do not let getters, cycles or enormous logs freeze the editor.
- Clickable diagnostics select the actual project file and line/column. Preserve
  source identity through virtual URLs/source maps and wrapper offsets. Record
  mapping confidence; show unknown location for opaque/cross-origin failures
  rather than inventing a line. Handle CSS and module-relative paths separately.
- A versioned, copyable/downloadable JSON + readable-text Debug Report includes:
  project/revision hashes, entry point, browser/player/viewport, sandbox capability
  set, reproduction steps, expected/actual behavior, diagnostic levels/messages,
  stack traces, virtual paths, line/column and mapping status, asset failures,
  file manifest and optional user-selected source excerpts.
- Reports are previewed before copying/sharing. Redact tokens, credentials,
  identifying/private account data and unrelated storage. Bound file/log volume;
  explicitly label truncated/redacted content. No automatic sending to an AI,
  analytics service or another user. Project text/logs are untrusted data, not
  instructions to an assistant. Never ship an AI provider key in creator code.

## Patch review, history and recovery

- AI suggestions are proposed multi-file patches with a readable diff, affected
  paths, explanation and validation results. No silent apply/publish or execution
  of model-supplied commands. User reviews modifications, additions, renames,
  deletions and assets before acceptance.
- Pin a patch to its source revision/hash; reject stale revisions and unsafe
  paths. Stage changes, validate and apply atomically. A failed apply retains
  the original project. No patch may modify account settings or parent game code.
- Named restore points include source, manifest and asset revisions. Provide
  restore preview, export and recovery after interrupted writes. Concurrent
  tabs/edits require conflict handling, not last-writer data loss.

## Publication, creator controls, discovery and donations

- Local drafts and private previews precede explicit publication. Published
  versions are immutable snapshots with tested entry points, asset integrity,
  license/attribution, content/safety review and a working sandbox. Report,
  moderator review, hiding/takedown and creator appeal need auditable controls.
- Creator settings cover public naming, project visibility, allowed capabilities,
  licensing, accessibility/input hints and update history. Use the reviewed
  public-name policy when actually available; do not imply it is deployed now.
  Server authorization enforces project ownership and moderation roles.
- Discovery supports search, categories, tags, compatibility/accessibility,
  curated lists and clear content/difficulty labels. Anti-spam/ranking abuse and
  privacy-preserving metrics need review. Do not fabricate players, ratings,
  donation totals or popularity.
- Donations are opt-in through a reviewed payment provider, with clear recipient,
  fees, refunds and age/eligibility rules. No card secrets in projects. Receipts
  and idempotent provider webhooks need server verification. Donations cannot
  grant unreviewed Central currency, resources, ownership or combat powers.
  Payments, tax/privacy obligations and moderation are separate release gates.

## Sarcastic, secret and high-difficulty advancements

- Creator-scoped cosmetic advancement definitions can support playful sarcastic
  copy, hidden reveals, difficult challenges and optional hints. Sarcasm must not
  become targeted harassment, protected-trait abuse or humiliating private-data
  disclosure. Difficulty/accessibility warnings and mute/skip controls matter.
- Keep creator achievements separate from reserved official IDs and badges.
  Secrets hide presentation, not security: downloadable client code is inspectable.
  Do not claim anti-cheat from obfuscation or a hidden criterion alone.
- Progress events are deterministic/versioned with replay protection as needed.
  Local project claims are untrusted cosmetic data. Any future official/economic
  reward requires independently reviewed server-authoritative verification;
  creator JavaScript cannot award money, materials or multiplayer permissions.
- Preserve earned achievements through project revisions under a documented
  compatibility policy. No surprise resets, pay-to-complete requirements or
  undisclosed impossible criteria. Extreme difficulty is an explicit choice.

## Future delivery gates

1. Local multi-file editor + versioned project/asset export, tested data recovery.
2. Isolated player + responsive/fullscreen controls and adversarial sandbox tests.
3. Correct mapped diagnostics, redacted Debug Reports, reviewed patches/history.
4. Approved backend for ownership, moderation, safe publishing and discovery.
5. Separately reviewed payments and cosmetic/official advancement authority.

Acceptance must include linked-file/asset fixtures, deliberate errors with known
source positions, malformed maps, recursive logging, infinite loops/worker leaks,
network/storage/navigation escapes, forged postMessage, malicious creator names,
patch traversal/stale edits, interrupted restore, moderation permissions and
payment replay tests. Performance limits must be measured on target devices.
None of these gates is claimed complete by this planning document.
