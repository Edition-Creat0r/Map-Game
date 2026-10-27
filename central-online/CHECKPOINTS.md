# 0.4.1 Central World Online — separate deliveries

Base: `feature/modern-frontier` at `bc8945d3deeb99d1074d341c1eccd11ad59a6d82`. Branch: `feature/0.4.1-central-world-online`. Source: [SPECIFICATION.md](SPECIFICATION.md).

The user's current instruction supersedes the prior single-turn integration workflow: **one checkpoint per delivery, report its implementation and evidence, then stop before the next checkpoint**. This initial record organizes the work; it does not mark backend implementation complete. Main stays unchanged. The existing cold-render performance review remains open.

| Delivery | Scope | Completion evidence |
|---|---|---|
| 1 — Multiplayer backend | Audit available schema/auth/RLS/ownership/deployment access; implement reviewable migrations and trusted settlement/construction backend, isolated from SP | Exact ledger/uncapped settlement, transaction replay/concurrency, ownership/collision and permission tests; deployment status and exact maintainer instructions. If staging is unavailable, review artifacts only and economy disabled. |
| 2 — Safe public naming | Shared server-only name policy for usernames/kingdoms/cities/alliances/buildings, unique usernames, 2h cooldown, reports and moderator actions | Harmless-name/obfuscation/lookalike/impersonation tests, concurrency/cooldown and moderator permission tests; no client disclosure of full rules. |
| 3 — Chat and friends | Restricted preset chat first; authorization, rate limits, block/mute/report, retention and compact panel | Sender/world isolation, spam/moderation and browser tests. Free text remains disabled without the required privacy/consent/safeguarding review, especially for under-13 participants; DMs unavailable without complete controls. |
| 4 — Competitive economy | Server-derived wealth/production/development rankings, efficient refresh and small challenge framework | Score-forgery/cross-user tests, actual server-derived rankings, no invented resources or unverified rewards. |
| 5 — Performance engineering | Authorized staging scenarios for 25/60/100/150/300, with 600 a future capacity step; compact regional subscriptions/batching | Measured action/chat latency, throughput, errors, consistency and browser FPS. 100-player p95 <200 ms and 30+ FPS on representative Chromebooks are targets, not existing capabilities. Do not load-test production by assumption. |
| 6 — Private release candidate | Full SP/Modern Frontier regressions, staging two-account security/transactions/reconnects, realistic load and final report | Essential security/privacy/reliability/performance gates all satisfied, or explicit smaller safe build and blockers. No main merge, force-push, RLS weakening, TLS bypass, military/minigames or later architecture work. |

Target private-playtest window: October 30–November 2, 2026. This is a target, not a deployment or capacity promise.

Every delivery records changed files, commit, automated/browser/backend results, limitations and whether its gate passed. Mocked/isolated SQL tests are not represented as real staging validation. No authenticated two-user or database-security claim without actual authorized backend testing.

Status: checkpoint 1 review package is implemented and locally tested; real Supabase schema/policy/deployment gates remain blocked and multiplayer economy stays disabled. See [Checkpoint 1 report](CHECKPOINT_1.md). Checkpoints 2–6 have not started.
