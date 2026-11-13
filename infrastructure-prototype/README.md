# Map Game 0.4.4 — Checkpoint 1

Standalone construction-framework prototype. Baseline: `7981452744a5f23016819c45dd521b8f773ceb36`. Branch: `feature/0.4.4-infrastructure-local`.

All new files live in this folder. The main game does not load or link to it. No inherited game files, Phase 4 graphics, backend, multiplayer, economy ledger, world saves, or migration code are changed. The independent clone has no remote configured.

## Demonstration

From `C:\Users\ayach\Map-Game-0.4.4-Infrastructure-Local`:

```powershell
node infrastructure-prototype/serve.cjs
```

Open **http://127.0.0.1:8044**. The server exposes only the four prototype runtime files and binds only to loopback. No dependency install is needed to use the demo. Stop with Ctrl+C.

1. Select Road, Rail, or Power. These are corridor fixtures using the same controller, not complete infrastructure systems.
2. Click a start point. Move the pointer for a live route. Click an endpoint to freeze the proposal for review.
3. Optionally Shift-click to add waypoints, or use the waypoint checkbox. Undo removes the last waypoint; Adjust endpoint reopens the draft.
4. Inspect the complete route, length, total construction estimate, special-cost subtotal, upkeep and connection/crossing counts.
5. Click **Confirm route** to construct in memory and debit mock funds. Cancel or Escape discards the draft without changing the fixture.
6. Reload resets everything. No localStorage, IndexedDB, or other world persistence is used.

Coordinate inputs provide a keyboard-accessible alternative to clicking the map. Coordinates are metres in this fixture, with X 0–1000 and Z 0–700.

| Scenario | Points to enter |
| --- | --- |
| Obstacle detour | Start `(100,280)`, end `(800,280)`; routes around the existing factory |
| Compatible segment snap | Road start `(180,128)`, end `(180,350)`; start snaps to `(180,120)` and the existing edge splits only after confirmation |
| Blocked endpoint | Start `(350,250)`, end `(800,280)`; existing factory blocks construction |
| Cross-network special | Road start `(700,180)`, end `(950,180)`; crosses the rail fixture without joining its graph |
| Waypoint | Start `(100,280)`, waypoint `(250,120)`, end `(800,280)` |

Green = valid; yellow = special crossing/corridor with extra cost; red = blocked; blue = compatible connected route/connection markers. Text accompanies the color states.

Open **Transaction test controls** to set mock funds or inject a single failure after debit, after graph preparation, or immediately before publication. Failure preserves the entire prior mock world and retains the draft for retry. Changing mock funds invalidates old proposals; use Refresh stale estimate and review again.

## Components and contract

- `core.js` contains separately exported pure geometry functions, a bounded deterministic router, immutable proposal generation, `Controller`, and `MockStore`. It has no game, DOM, network or persistence dependency and can be required directly by Node.
- `createPlanner(profiles, router)` accepts independent type profiles, a route implementation and optional pure `validateRoute` callbacks. `MockStore` accepts this planner; both controller previews and commit revalidation use it.
- `TYPES` holds separate fixture profiles for road/rail/power width, appearance, price and upkeep. They share routing and interaction. Future adapters can replace routing constraints and the store boundary; this checkpoint does not claim railway radius, voltage or highway access rules.
- Routing tries a direct corridor, then deterministic eight-direction A* with heading/turn penalties and a finite search budget. Line-of-sight simplification removes unnecessary grid bends. Every accepted line is checked against expanded obstacles, including corridor width and setback. Manual waypoints are retained.
- Snapping projects onto compatible existing segments without mutation. Matching-network intersections become proposed connections. Cross-network crossings remain separate. Duplicate overlaps and self-crossing/backtracking routes are rejected.
- The controller owns idle/routing/review states. Clicking the endpoint creates a review, never a transaction. Adjustments require a new review. Type changes cancel drafts only.
- `MockStore.commit(proposal, operationId)` re-derives and compares the quote against the current revision; checks funds; prepares debit, compatible segment splits, new edges and receipt on a private clone; then publishes once. Failure publishes nothing. Receipts support idempotent replay and reject reused identities for different intents. Notifications occur after publication.
- `app.js` supplies event-driven procedural Canvas drawing and shared controls. Pointer movement is coalesced through requestAnimationFrame; there is no continuous simulation/render loop.
- `serve.cjs` serves only `index.html`, `style.css`, `core.js`, and `app.js`. The page's content policy forbids network connections, external scripts and framing objects.

## Validation

```powershell
node --test infrastructure-prototype/tests/core.test.cjs
npm.cmd ci --prefix infrastructure-prototype
node infrastructure-prototype/tests/browser.cjs
```

Browser tests use installed Microsoft Edge by default; set `CHROMIUM` for another compatible executable. Test dependency is pinned in package-lock.json. Browser profile, temporary files and dependency cache stay in ignored `.runtime/` storage in this prototype.

`tests/core.test.cjs` covers placement/confirmation, obstacle detours, full-width clearance, blocked endpoints/barriers, deterministic results, compatible snapping/splitting, waypoint edits, overlaps, special crossings, costs, insufficient funds, stale revisions, cancellation, quote tampering, rollback, replay, and isolation.

`tests/browser.cjs` exercises pointer and coordinate construction, all fixture types, confirmation, failure/retry, waypoints, editing, cancellation, insufficient funds, stale estimates, keyboard access, responsive layout and reload. It checks runtime requests and forbids browser storage writes. Screenshots and machine-readable results are in `evidence/`.

Inherited automated tests: **172/172 pass against the exact approved baseline bytes**, exported inside ignored test storage with `git -c core.autocrlf=false archive`. A direct Windows-checkout run is **171/172** because an existing raw-string immutability assertion compares CRLF checkout text with LF Git text. The full failure log is retained, and SHA-256/normalization evidence confirms the cause; no existing test or manifest was edited to suppress it.

## Limits / deferred work

- This is a flat 2D planning demonstrator with simple extruded building drawing, not production 3D infrastructure rendering.
- Obstacles are fixture rectangles; there is no live terrain integration, spatial streaming, real bridge/tunnel design, or large-city certification. Bounded grid routing can report no corridor/search budget exhaustion even where a finer search could succeed; add waypoints or use a later adapter.
- Existing corridor overlaps are rejected, not automatically upgraded or demolished. Crossing permissions and costs are deliberately simplified fixture policy. Rail and power geometry does not implement real curves, switches, trains, electrical flow or roadside distribution.
- Road cost is anchored to the existing local-road rate ($240/100 m). Rail/power rates, surcharges and upkeep are demonstration estimates, not six-era balance approval. No real currency or factory prices are changed.
- Transactions are synchronous, in-memory mock atomicity only. Crash durability, real ledger integration, persistent receipts, IndexedDB, save migrations, multiplayer authority, cargo and electricity remain deferred.
- Committed construction has no demolition/undo tool in this checkpoint. Draft waypoint undo, cancellation and endpoint adjustment are supported; reload/reset clears only the test fixture.

Stop after this checkpoint. Checkpoint 2 and real game integration require separate authorization.
