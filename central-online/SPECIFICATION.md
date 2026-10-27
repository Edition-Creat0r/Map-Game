# MAP GAME 0.4.1 — CENTRAL WORLD ONLINE

Repository: Edition-Creat0r/Map-Game

Base: Latest validated `feature/modern-frontier` branch.

Create: `feature/0.4.1-central-world-online`

Target private playtest: October 30–November 2, 2026.

## Objective

Make Central World a working, secure, competitive multiplayer civilization economy while preserving the completed Modern Frontier homepage, shop, advancements, graphics and Singleplayer gameplay.

Prioritize correctness, low lag, security and the ability for 60–100 players to enjoy the game together.

Do not merge to main automatically.

## Checkpoint 1 — Multiplayer backend

Inspect the actual Supabase schema, authentication, permissions, RLS policies, deployment tooling and territory ownership system.

Implement or prepare securely deployable migrations for:

- Persistent player economy and balances.
- Shared Central World construction and buildings.
- Server-authoritative purchases and resource consumption.
- Production, workers, electricity and upkeep.
- Research and material availability.
- Trusted elapsed-time settlement and no offline-time cap.
- Atomic, idempotent transactions.
- Server-verified territory placement and collisions.
- Economy transaction history and audit records.

Never trust browser-provided balances, production amounts, timestamps or ownership claims.

Keep Singleplayer and Central World balances completely separate.

If authorized database deployment and testing are unavailable, complete the migration and backend implementation for review, but keep multiplayer economy disabled. Report exactly what an authorized maintainer must deploy.

## Checkpoint 2 — Safe public naming

Create one shared, server-enforced moderation system for:

- Usernames
- Kingdom names
- City names
- Alliance names
- Publicly visible building names

Reject inappropriate terms, obfuscation, Unicode lookalikes, impersonation, and prohibited phrases without aggressively rejecting harmless names.

Enforce unique usernames and the two-hour username-change cooldown on the server.

Add report, hide, force-rename and manual-review capabilities with permission checks.

Do not reveal the full filter rules to clients.

## Checkpoint 3 — Chat and friends

Implement a safe initial communication system.

Include:
- Authorized world chat.
- Message length limits.
- Rate limiting and spam protection.
- Server-side text moderation.
- Block, mute and report controls.
- A compact expandable chat panel.
- Safe message history and retention.
- Friends-only messaging only when its permissions and moderation are fully implemented.

Because test participants may be under 13, do not activate unrestricted free-text chat until the applicable privacy, consent and safeguarding requirements have been reviewed and satisfied.

Provide restricted preset messages as a fallback for the private test.

## Checkpoint 4 — Competitive economy

Introduce trustworthy rankings for:
- Wealth
- Industrial production
- City development

Use authorized server data, never client-submitted leaderboard scores.

Refresh leaderboards efficiently rather than continuously polling all players.

Add a small competitive challenge framework, but do not invent new resources or enable unverified rewards.

## Checkpoint 5 — Performance engineering

Required load-test scenarios: 25, 60, 100, 150, 300 and eventually 600 concurrent simulated players.

Primary acceptance target: 100 concurrent players under representative economy, chat and navigation load.

Target:
- p95 server actions below 200 ms at 100 players.
- Chat p95 below one second where free-text chat is enabled.
- Smooth 30+ FPS Basic mode on representative Chromebooks.
- Zero duplicate purchases, lost committed resources or authorization breaches.

Treat these as testable targets, not current capabilities.

Use regional subscriptions, compact updates, batching and independently isolated future minigame sessions.

Do not overload the database with frame-by-frame production updates.

## Checkpoint 6 — Private release candidate

Keep the existing visual restoration, shop, home hub, advancements, world backups and six-era economy working.

Run all existing regression suites and new server authorization/security tests.

Test two or more genuinely authenticated accounts against the deployed staging backend.

Test purchases, concurrent spending, territory collisions, failed operations, reconnects, research bypass attempts and user-to-user data isolation.

Run realistic capacity tests on authorized staging infrastructure.

Create a private playtest release candidate only if all essential security and reliability requirements pass.

If a critical backend, privacy, chat or performance gate cannot be completed, report the blocker and provide a smaller safe playtest build instead.

Do not force-push or merge main. Do not weaken authentication, disable RLS or bypass TLS for convenience.

Stop after 0.4.1. Do not begin military, minigames or the next major architecture update.

## Required final report

Include:
- Implemented vs blocked features
- Changed files and migration scripts
- Actual staging deployment status
- Security and authorization test results
- Multiplayer economy transaction tests
- Naming moderation tests
- Chat/privacy readiness
- 25/60/100/150-player load results where executable
- Browser FPS and responsiveness
- Git commit and PR status
- Specific remaining steps for the private school playtest.