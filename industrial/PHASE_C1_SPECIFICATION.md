# MAP GAME 0.3.4 — OFFICIAL PHASE C1 SPECIFICATION

Repository: `Edition-Creat0r/Map-Game`

Current integration branch: `feature/0.3.4-industrial-revolution`

Current confirmed commit: `03adac1`

This specification explicitly authorizes Phase C1 as an amendment to the Industrial Revolution roadmap.

## 1. Roadmap Amendment

Update `industrial/RELEASE_PLAN.md` to reflect the following sequence:

- Phase A — Uncapped Offline Economy: Completed
- Phase B — Industrial Catalog and Production Chains: Completed
- **Phase C1 — Simplification, Material Unlocks, Beginner Progression and UI: Implement now**
- Phase C2 — Warehouses, Logistics and City Services: Future
- Phase D — Advanced Research, Ten-Level Factory Upgrades and Achievements: Future
- Phase E — Architecture, Roads and Industrial Districts: Future
- Phase F — Defense Industry and Integrated Release: Future

Phase C1 does not replace Phases C2–F. It introduces an accessible progression layer ahead of those deeper systems.

Document this amendment before modifying gameplay.

## 2. Material Manifest — Exact Rules

The existing Phase B registry has 121 material IDs, including Money.

Preserve all 121 internal material IDs and their saved balances.

Create a versioned `industrial/player-materials.json` manifest defining exactly 100 player-facing materials.

Exactly 10 are initially unlocked:

| Display name | Canonical ID |
|---|---|
| Money | `money` |
| Steel | `steel` |
| Carbon | `carbon` |
| Iron Ore | `ironOre` |
| Coal | `coal` |
| Concrete | `concrete` |
| Glass | `glass` |
| Silica | `silica` |
| Copper Ore | `copperOre` |
| Limestone | `limestone` |

Resolve these IDs against `industrial/catalog.json`. Where the canonical casing differs, use the actual existing ID and document it. Do not create duplicate material IDs or aliases.

### Selecting the remaining 90

Use the canonical Phase B material dependency graph as the source of truth.

The selection policy is:

1. Include all ten starter materials.
2. Select 90 additional existing material IDs, prioritizing materials with actual reachable manufacturing chains, construction uses, or planned major unlocks.
3. Prefer civilian manufacturing, construction, energy, electronics, machinery and vehicle progression before highly specialized late-era content.
4. Exclude 21 IDs from the ordinary player-facing progression view. Prioritize excluding unused, redundant or defense-only future materials, provided this does not break selected recipes.
5. Preserve excluded materials internally and in existing saves.
6. Make every selected material reachable through an explicit unlock and acquisition path.
7. Do not automatically expose or unlock dependency materials merely because a recipe references them. Instead ensure prerequisites lead to a valid acquisition path.
8. Write all 100 selected canonical IDs explicitly into the manifest, with `unlockEra`, `unlockRequirements`, and `visibility` metadata.
9. Generate a human-readable appendix showing all 100 selected IDs and the 21 excluded IDs, with reasons.
10. Freeze the manifest for this release so file ordering, names and translations cannot affect selection.

Do not silently delete, rename, re-price or re-recipe existing Phase B catalog entries.

### Compatibility rule

A material being hidden from the ordinary inventory must never make its balance inaccessible to the underlying simulation.

Existing saves may contain previously acquired materials and factories from the original 121-material catalog.

Continue honoring those assets and production contracts.

Provide a Legacy Inventory section when necessary, so returning players can inspect materials not included in the simplified progression.

## 3. Six-Era Progression

Use these eras:

1. Settlement — 10 starting materials.
2. Industrialization — 15 additional materials.
3. Electrification — 20 additional materials.
4. Mass Production — 20 additional materials.
5. Information Age — 20 additional materials.
6. Global Superpower — 15 additional materials.

The cumulative visible material totals must be 10, 25, 45, 65, 85 and 100.

Materials and factories unlock through defined milestones and appropriate research.

Example milestone categories:

- Population thresholds
- Factories constructed
- Total material production
- Research completed
- Industrial diversification
- Civilization development

Progression thresholds must be reasonable for Singleplayer and must not introduce an unavoidable deadlock in the starter economy.

A player should always have an achievable next objective.

Do not introduce official minigames as mandatory progression requirements.

## 4. Factory Availability

Preserve all 120 Phase B industrial definitions and all five starter contracts.

The simplified shop should display:

- Available buildings prominently.
- Locked buildings through a separate Discover/Research view.
- Unavailable defense definitions as future content, not purchases.

Reconcile existing Phase B availability with the new progression system.

A building must not be purchasable if it requires a material the player has not unlocked, unless a documented legacy exception applies.

Existing legally purchased buildings remain operational with their pinned production contracts even when their materials or technology are not yet unlocked under the new progression policy.

Prevent purchase bypasses through both UI and economy APIs.

## 5. Initial Research Tree

Create a small, functional research system covering:

- Basic Industry
- Mining and Refining
- Construction Technology
- Electricity
- Urban Development
- Electronics Foundations
- Industrial Machinery

Research nodes should have explicit IDs, prerequisites, completion status, unlock effects and costs.

Use a validated directed acyclic graph.

Introduce straightforward research progression without requiring the full Phase D advanced research economy.

Research must be obtainable through ordinary gameplay.

Do not activate ten-level upgrades or four factory specializations yet. Those remain Phase D work.

## 6. Simplified UI

Organize the main interface into five sections:

- Build
- Industry
- Research
- World
- More

Preserve access to the existing World Map, economy, settings, authentication and Singleplayer functions.

Only show beginner-relevant actions by default.

Retain advanced catalog search and an optional detailed mode.

Keep Money, Steel, Carbon, Energy and Population prominent.

The ordinary inventory should show unlocked materials, with a separate Discover view explaining future resources.

Include a Next Goal panel that recommends achievable objectives.

Example:

"Build a Steel Factory — requires 6 workers and 10 electricity."

Avoid repeatedly rebuilding large catalogs during gameplay.

## 7. Factory Automation

Introduce an optional beginner-friendly automatic operating-priority setting.

The automation can reorder or prioritize existing production according to workforce, electricity, material availability and upkeep.

It must not fabricate resources, bypass research, ignore costs, bypass warehouse constraints introduced later, or alter old production contracts.

The manual option remains available for advanced players.

Settle elapsed economic time before changes and persist the resulting priority configuration.

## 8. Official Minigame Rewards — Future Interface Only

Reserve an extensible interface for future owner-created official minigames.

Only trusted, server-validated official minigames may eventually award privileged economy resources or tokens in multiplayer.

Player-created minigames cannot mint unrestricted resources.

Do not implement minigames or multiplayer rewards during Phase C1.

All core progression must remain achievable without minigames.

## 9. Persistence and Migration

Use a versioned additive migration compatible with the current Phase B economy schema.

Preserve:

- Existing inventory balances, including all 121 IDs.
- Exact BigInt ledger values.
- Existing building records and pinned recipes.
- Unknown saved fields.
- Offline checkpoints and partial timing.
- Existing Singleplayer claims.
- World coordinates and terrain placement.
- Previously acquired legal assets.

Existing players should not lose progress.

For pre-progression saves, use an explicit deterministic migration policy that preserves already acquired capabilities without granting unrelated advanced technology.

Unsupported future save versions must fail closed.

Document downgrade and backup requirements.

## 10. Performance and Regression Testing

Verify:

- Exactly 100 manifest entries.
- Exactly 10 initial material unlocks.
- Exactly 90 additional unlocks.
- Exactly 21 internal materials excluded from ordinary progression.
- Canonical registry references.
- Complete material acquisition paths.
- No beginner progression deadlocks.
- Locked factory purchase rejection.
- Legacy save preservation.
- Research DAG validity and idempotence.
- Automatic operating-priority correctness.
- Uncapped offline production and 1.2× online throughput.
- Complete Singleplayer browser flow.
- Forest, terrain, hydrology and strategic-map compatibility.
- No new console errors or missing resources.

Compare loading time, World Map navigation, local panning, zooming, shop performance, and large-city economy behavior against Phase B.

## 11. Conditional Merge Authorization

After implementation, Codex is authorized to create and merge a pull request into `main`, **only if all release gates pass**.

Before merging:

1. Verify the integration branch contains all required preceding phases and fixes.
2. Confirm the final proposed merge result against the current `main`.
3. Run the complete test suite against that exact result.
4. Confirm the material manifest, progression logic, migration and browser gameplay all pass.
5. Confirm no significant performance regression.
6. Confirm no unintended Supabase, multiplayer, ownership or authentication changes.
7. Review the complete diff and ensure no unrelated files or secrets are committed.
8. Confirm the GitHub Pages deployment configuration and perform a post-merge smoke test if applicable.

Use a normal pull request merge. No force-pushing.

If there is a conflict, ambiguous material mapping, migration failure, failing test or unresolved release blocker, do not merge. Report the issue.

After a successful merge, provide the PR URL, merge commit SHA, test results and summary of the version now on `main`.

Stop after Phase C1. Do not automatically begin Phase C2.