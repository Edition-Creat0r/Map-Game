# MAP GAME — NEXT MAJOR UPDATE
## Modern Frontier: World Hub, Ultimate Shop, Multiplayer Economy & Advancements

**Repository:** `Edition-Creat0r/Map-Game`

**Base:** The latest successfully validated visual restoration branch, including the existing 0.3.4 Industrial Revolution work.

**Branch:** `feature/modern-frontier`

**Important:** Inspect the actual repository, current branches, release plans, completed features, and visual-update results before beginning. Do not assume an unmerged branch is present on `main`.

### Mission

Transform Map Game into a polished, distinctive civilization-building and multiplayer strategy experience.

The game should feel modern, exciting, slightly futuristic, adventurous, and welcoming—without looking like a generic AI-generated dashboard, a website template, or an excessively cozy village game.

The design identity is **Modern Frontier**.

Preserve existing gameplay while improving its presentation and introducing secure multiplayer economic gameplay.

---

# PHASE 0 — Audit and Foundation

Before implementation:

1. Inspect the final visual restoration work and identify reusable UI elements, environmental assets, building sprites, textures, animations, and sounds.
2. Review the complete Phase A/B/C1 economy, including material aliases, research, unlocks, building contracts, and exact offline simulation.
3. Examine current Supabase authentication, ownership, territory, and security architecture.
4. Identify whether the repository already includes social systems, usernames, multiplayer persistence, and messaging.
5. Create a detailed implementation plan, dependency graph, and test strategy.
6. Update the project roadmap to identify completed, active, and future features.

Preserve all 121 internal resource IDs, 100 player-facing materials, 10 initial materials, six progression eras, seven introductory research nodes, 120 industrial definitions, and five starter contracts.

Do not replace the visual restoration renderer or discard previous performance work.

Implement this update in independently testable milestones. Do not merge into `main` until all required release gates are satisfied.

---

# PHASE 1 — THE MODERN FRONTIER HOME HUB

## 1.1 Homepage identity

Replace the current entry experience with a cinematic, polished game homepage using the Map Game identity.

Use:
- Dark navy and graphite foundations.
- Restrained cyan and amber highlights.
- Natural landscapes combined with modern architecture.
- Actual game terrain, tree, building, river, and city assets.
- Carefully designed typography and original visual elements.
- Subtle environmental animation.
- Smooth, responsive transitions.

Avoid generic AI-generated visuals, excessive gradients, random neon glow, giant marketing slogans, and visually repetitive cards.

The homepage should feel handcrafted and recognizable as Map Game.

## 1.2 Main play options

Create TWO major, visually rich cards.

### Singleplayer

Description: Build a personal civilization, explore biomes, develop production chains, complete advancements, and progress offline.

Features:
- Continue World.
- New World.
- World information.
- Recent world progress.
- Advancement summary.
- Offline-capable play once the required assets are cached.

Do not claim offline availability unless service-worker caching and browser testing confirm it.

### Central World

Description: Enter a persistent shared world with other players.

Features:
- Enter Central World.
- Account/authentication gating.
- Multiplayer world status when available.
- Friends and community entry points.
- Territory information and multiplayer gameplay.

Avoid fake player counts or invented server status.

Reserve a future Servers tab for additional worlds/servers. Do not implement extra servers yet.

## 1.3 Interactive homepage environment

Use a performance-conscious animated background based on game assets.

Possible details:
- Slowly moving clouds.
- Gently swaying trees.
- City lights.
- Chimney smoke.
- Occasional vehicles or aircraft where appropriate.
- Camera parallax.
- Clickable scenery hotspots.

Hotspots may open real features or clearly labeled development previews.

Provide static, low-motion and reduced-graphics alternatives.

Do not delay initial interaction while waiting for optional visual effects.

## 1.4 Feature showcase

Include a restrained secondary area featuring:

**BUILD your dream civilization** — Grow from homes and industry into expansive cities.

**DISCOVER new biomes and structures** — Explore varied environments and territories.

**INNOVATE your production empire** — Research technologies and build manufacturing networks.

**COMMAND your military** — Preview future equipment, defenses, and strategic warfare.

**CHALLENGE friends** — Preview future minigames and competitions.

**CONNECT with other players** — Open available community systems.

Distinguish Playable, In Development, and Planned features. Do not activate fictional or unfinished systems.

## 1.5 Developer updates

Create a small Developer's Corner with:
- Actual released-version history.
- Current update details.
- Planned features.
- Optional screenshots and development notes.

Store update entries in structured content files.

Do not invent release dates, shipped functionality, or developer announcements.

---

# PHASE 2 — FULL-SCREEN ULTIMATE SHOP

## 2.1 Main design

Replace the large text-heavy construction modal with an immersive, near-full-screen shop.

The shop should:
- Occupy essentially the whole playable viewport.
- Remain usable at 1366×768 and 1440×900.
- Use clear categories and visual building cards.
- Offer search, filters, sorting, and favorites.
- Preserve the underlying map and camera state while open.
- Close instantly without losing user progress.
- Support mouse, keyboard and accessible controls.

Build a distinctive game interface, not a generic online storefront.

## 2.2 Shop categories

Initially:
- Residential
- Commercial
- Industry
- Mining
- Refining
- Construction
- Utilities and Energy
- Electronics
- Machinery
- Vehicles
- Infrastructure
- Military Industry
- Upgrades

Only enable categories supported by real catalog entries and implemented gameplay.

Unimplemented categories must clearly display Coming Soon or Locked.

## 2.3 Building cards

Each available building should display:
- Recognizable original icon or asset-backed preview.
- Building name.
- Category and tier.
- Purchase price.
- Required construction materials.
- Primary production or function.
- Locked, available, affordable, or insufficient-resource state.

Cards should have consistent dimensions, readable numbers, and clear visual hierarchy.

Use the actual catalog. Never substitute invented prices or production values.

## 2.4 Detailed building inspector

Selecting a building opens a detailed panel within the shop.

Display:
- Large visual preview.
- Building name and description.
- Footprint.
- Purchase resources.
- Inputs per minute.
- Outputs per minute.
- Energy generation or consumption.
- Workers needed.
- Operating upkeep.
- Production limitations.
- Relevant research requirements.
- Current affordability.
- Advancement connections, where applicable.
- Future upgrade capabilities.

Show the effects of the 1.2× active-play multiplier where relevant and distinguish base production from active production.

Present shortages and dependencies understandably.

## 2.5 Visual previews

Reuse real game sprites, building assets, or deterministic procedural previews.

Where a dedicated asset is missing, create coherent original fallback illustrations matching the game's rendering style.

Do not use unrelated stock imagery.

Do not download copyrighted assets without appropriate rights.

Prioritize recognizable silhouettes and visual differentiation between factory types.

## 2.6 Buying and placing

Preserve existing Singleplayer construction semantics.

Opening a detail panel is not a purchase.

The player explicitly chooses Place, then selects a valid location on the map.

Preserve:
- Placement previews.
- Footprint checks.
- Terrain and slope restrictions.
- Collision checks.
- Rotation.
- Escape cancellation.
- Atomic payment on successful placement.
- Correct rollback after failure.

Central World purchases must use the new secure server-authoritative transaction flow described below.

## 2.7 Upgrade panel reservation

Include a visually integrated Upgrades category and building upgrade panel foundation.

Show future upgrade tracks:
- Production
- Efficiency
- Automation
- Logistics

Prepare reusable components for level, material requirements, stat changes and prerequisites.

Actual ten-level factory upgrades remain disabled until their corresponding economy rules are implemented and tested.

Do not permit fake upgrade purchases or resource changes.

## 2.8 Sound design

Introduce original, subtle UI sounds for:
- Shop opening and closing.
- Category navigation.
- Item selection.
- Successful placement.
- Invalid action.
- Research or advancement unlock.

Prefer lightweight original synthesis or legitimately licensed assets.

Respect:
- Browser autoplay restrictions.
- User mute settings.
- Separate UI and music volumes.
- Reduced-motion/accessibility preferences.

Sounds must not play uncontrollably on repeated hovering or during initial page load.

---

# PHASE 3 — APPEARANCE AND SETTINGS STUDIO

## 3.1 Built-in themes

Ship a polished default Modern Frontier theme and optional presets, including:
- Midnight Command
- Forest Technology
- Industrial Gold
- Neon Violet

Allow adjustment of:
- Accent colors.
- Background colors.
- Panel appearance.
- Typography scale.
- Interface density.
- Homepage scene.
- Animation intensity.
- Shop appearance.
- Advancement-tree appearance.

Use one coherent theme-token system across the home hub, shop, advancements and game HUD.

Persist settings safely.

## 3.2 Custom uploads

Allow players to select local image backgrounds for their homepage and advancement page.

Support safe file formats, strict upload size and dimension limits, image validation, repositioning, cropping, dimming, and removal.

Local-only custom backgrounds are sufficient for the first version.

Do not automatically make private uploaded images public.

Reserve future import/export of validated theme packs, without executable JavaScript, remote scripts or unsafe CSS.

## 3.3 General settings

Organize settings into:
- Account
- Friends & Privacy
- Appearance
- Audio
- Gameplay
- Chat & Safety
- Minigames
- Multiplayer
- Worlds & Backups

Implement actual settings only when corresponding features exist; clearly label placeholders.

Audio settings should support master, music, interface and environmental volume.

Gameplay settings should support graphics quality, camera controls and reduced motion.

---

# PHASE 4 — ACCOUNT AND SOCIAL HUB

## 4.1 Account profile

Display account username, profile information and available customization.

Authenticated users may change their username **once every two hours**.

Enforce the cooldown on the server, not by trusting the browser.

Require:
- Unique case-insensitive usernames.
- Appropriate username validation.
- Reserved-name protection.
- A clear next-available-change time.
- Secure handling of concurrent changes.

## 4.2 Friends and private messages

Provide Friends and Messages areas below the two main gameplay cards.

Integrate existing systems if they are present.

If implementing new messaging, require:
- Authenticated access.
- Explicit friend/privacy controls.
- Server-authorized sender/recipient access.
- Block, mute and report features.
- Rate limits and anti-spam.
- Moderation and appropriate safety protections.
- No disclosure of private conversations or presence to unauthorized users.

Do not create publicly accessible private-message records or unsecured realtime channels.

If these safety requirements cannot be met within the release, ship clearly labeled noninteractive previews instead of pretending messaging is functional.

## 4.3 Account deletion

Create a Delete Account section with a clear confirmation flow.

Require explanation of consequences, deliberate confirmation and reauthentication where appropriate.

Never perform deletion merely by clicking an unconfirmed button.

Handle associated server-side account data and retention according to an explicitly documented policy.

---

# PHASE 5 — MULTIPLAYER ECONOMY

This is a security-critical feature.

Singleplayer economy is currently local-first and must remain independent.

Central World economy must be **server-authoritative**.

Never enable multiplayer spending by simply bypassing Singleplayer-only frontend checks.

## 5.1 Authoritative economy architecture

Inspect the current Supabase/backend architecture before designing changes.

Define:
- Account-linked multiplayer balances.
- All 121 canonical material references where applicable.
- Server-controlled unlocks and research.
- Server-controlled buildings and production contracts.
- Territory ownership and construction permissions.
- World-level resource accounting.
- Authoritative timestamps.
- Transaction and event identifiers.
- Idempotent operations.
- Atomic resource debit and purchase/placement.
- Access controls and auditing.

A user's economy should persist across Central World territories according to a clearly documented scope.

## 5.2 Construction transactions

Implement a verified workflow:

1. Client requests placement with the building ID, coordinates, rotation and unique operation ID.
2. Server validates authentication and territory permissions.
3. Server validates catalog availability and progression.
4. Server verifies footprint, placement and collisions against authoritative world state.
5. Server verifies the current material balance.
6. Server atomically deducts costs and creates the building.
7. Server returns the authoritative result.

Retrying an already completed operation must not double-charge or duplicate buildings.

A failed operation must not consume resources.

Concurrent conflicting placements must resolve safely.

## 5.3 Multiplayer production

Reuse validated economic rules where possible, but do not trust calculations or timestamps supplied by players.

Implement:
- Trusted production settlement.
- Server-verified input consumption.
- Workforce and energy limitations.
- Upkeep accounting.
- Correct resource caps.
- Protected checkpoints.
- Research and unlock enforcement.
- Deterministic offline catch-up.

Retain unlimited elapsed offline time as a gameplay requirement.

Use bounded, resumable server execution if required to prevent expensive long-running requests, without silently discarding elapsed simulation time.

Explicitly define whether the 1.2× online bonus applies to verified active multiplayer sessions; do not trust client visibility claims as proof of activity.

## 5.4 Supabase security

Use explicit database authorization rules and privileged operations for all sensitive writes.

Review row-level security, RPC permissions, service-role secrets, authentication flows, and realtime subscriptions.

Never expose privileged credentials to the browser.

Perform adversarial tests for:
- Balance modification.
- Free building creation.
- Duplicate transactions.
- Unauthorized territory construction.
- Research bypass.
- Clock manipulation.
- Cross-user data access.
- Concurrent operations.
- Offline catch-up abuse.

Do not mark multiplayer economy as released until the authorized backend is deployed, migrations are applied and end-to-end security tests pass.

---

# PHASE 6 — THE EVOLVING ADVANCEMENT TREE

## 6.1 Core concept

Create a distinctive, full-screen, zoomable, pannable advancement graph inspired by the satisfying branching progression of Minecraft, Cookie Clicker and city-building games.

Use original Map Game artwork and node layouts.

Advancements celebrate accomplishments. Research determines technological capabilities. Keep their responsibilities separate.

## 6.2 Evolving complexity

The tree should visually evolve with player progress.

### Foundations

Initially display a small network of approachable tasks.

Use:
- Simple frames.
- Clear connections.
- Gentle animations.
- Limited visible depth.

### Expansion

As achievements are completed:
- Reveal additional branches.
- Show more cross-connections.
- Introduce detailed node frames.
- Animate newly unlocked paths.
- Give completed paths a subtle glow.

### Mastery

For advanced civilizations:
- More intricate network structure.
- Flowing lights along completed paths.
- Ornate milestone and legendary frames.
- Hidden discoveries.
- Multiple large branches.
- Animated progression effects.

Visual elaboration must remain readable and not change the logical prerequisite graph.

## 6.3 Advancement branches

Plan these branches:

1. Civilization
2. Industry
3. Energy
4. Exploration
5. Technology
6. Military
7. Minigames
8. Community

Implement functional initial advancements only for existing, verifiable gameplay events.

Military, minigame and unimplemented social objectives remain future content.

Target a carefully structured extensible graph, with an initial curated set rather than hundreds of filler tasks.

## 6.4 Advancement tiers

Three primary levels:
- Task
- Milestone
- Legendary

Support hidden and secret accomplishments.

Give tiers visibly different but consistent node shapes, borders, icons and completion effects.

## 6.5 Progress and rewards

Show:
- Objective description.
- Current progress.
- Prerequisites.
- Completion status.
- Rewards.
- Related tasks.
- Available next objectives.

Allow players to pin up to three goals to the gameplay interface.

Use event-driven, idempotent completion logic.

Rewards must be granted at most once per eligible completion.

Do not invent an achievement reward currency without validating its place in the existing economy.

In multiplayer, authoritative rewards and completion must be verified on the server.

## 6.6 Animated branching lines

The advancement network should feel increasingly alive.

Implement:
- Curved or smoothly routed connections.
- Distinct locked, available and completed states.
- Animated light movement along eligible completed paths.
- Branch reveal animations.
- Milestone highlights.
- Adjustable line glow and animation speed.
- Optional node completion sounds.

Use Canvas2D, SVG or another appropriate performant rendering approach.

Apply viewport culling or level-of-detail simplification for large graphs.

Avoid excessive particle effects or hundreds of animated DOM elements.

## 6.7 Custom advancement backgrounds

Support player-selected built-in backgrounds and uploaded local images.

Allow image positioning, zoom, opacity and dimming so nodes remain readable.

Respect privacy and do not upload backgrounds to public storage without explicit authorization.

Provide reset-to-default controls.

## 6.8 Persistence and synchronization

Singleplayer advancement state is world-specific and compatible with existing save migrations.

Do not retroactively grant unearned rewards.

Where safe and deterministically provable, migrate progress from existing saved gameplay records.

Otherwise begin tracking the objective prospectively.

For multiplayer, persist verified advancement state in authorized server records.

---

# PHASE 7 — WORLDS AND BACKUPS

Introduce a World Manager foundation.

Provide:
- Current world details.
- World version.
- Save status.
- Export World backup.
- Import World with validation.
- Backup before migrations.
- Restore from compatible backup.
- Clear distinction between Singleplayer and Central World data.

Avoid irreversible changes to existing local worlds.

Future multi-world slots, version upgrades and downgrades should have documented compatibility contracts.

Do not implement a fake downgrade button. Support a downgrade only when a tested compatible snapshot or reverse migration exists.

Never downgrade by editing the save-schema number alone.

---

# PHASE 8 — PERFORMANCE AND QUALITY

## Visual requirements

The result must feel:
- Premium but not corporate.
- Technological but welcoming.
- Detailed but understandable.
- Animated but not distracting.
- Handcrafted rather than template-generated.

Prioritize real game assets, coherent styling, clear hierarchy and deliberate visual composition.

## Required resolutions

Test at:
- 1366×768
- 1440×900
- 1920×1080

Ensure the shop and advancement tree remain usable with keyboard navigation and smaller screens.

## Accessibility

Include:
- Keyboard navigation.
- Visible focus indicators.
- Accessible labels.
- Text scaling.
- Appropriate contrast.
- Reduced motion.
- Optional effects.
- Independent sound controls.

## Regression tests

Preserve and retest:
- World Map and local rendering.
- Tree, terrain, hydrology and texture assets.
- Existing building placement.
- C1 research and material unlocks.
- All economy material balances and aliases.
- Exact uncapped offline calculations.
- Singleplayer save compatibility.
- Pinned production contracts.
- 1.2× online throughput.
- Basic graphics mode performance.
- Authentication and territory ownership.
- Shop cancel/reopen flows.
- Advancement reward idempotency.
- Multiplayer authorization and transaction atomicity.

Measure startup time, FPS, frame-time percentiles, long tasks, memory usage and large-city performance against the validated baseline.

No significant unexplained regressions are acceptable.

---

# PHASE 9 — DELIVERABLES

Provide:

1. Updated implementation roadmap.
2. Architecture notes for UI, advancement state and multiplayer economy.
3. Fully functional new homepage.
4. Polished full-screen shop.
5. Appearance and settings studio.
6. Working Singleplayer advancement system.
7. Secure Central World economy, only if backend security and deployment validation are completed.
8. World export/import foundation.
9. Screenshots at all supported resolutions.
10. Browser and automated test results.
11. Security validation report.
12. Performance comparison.
13. Save migration notes.
14. Known limitations and incomplete features.

Keep all current player assets and saves compatible.

## Merge policy

Implement the work in logical milestones and validate each independently.

Do not merge partial, unsafe or unverified multiplayer economy changes into `main`.

Do not merge merely because frontend screens appear finished.

Create a PR and merge only after all previously established release gates, backend deployment verification, security tests and real-world browser checks pass.

If blocked, report the exact obstacle and leave `main` unchanged.

**Final objective:** Turn Map Game into a visually memorable, approachable and technically sophisticated civilization game, with a world players enjoy returning to and a progression system that becomes more impressive as they advance.