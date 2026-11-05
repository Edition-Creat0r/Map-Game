# Premium UI gameplay fixes

Base: `feature/0.4.1-graphics-prototype` at `f21fb98cbe3c055e2c766733d113cf2e56b5f027`.
Fix branch: `fix/0.4.1-premium-ui-gameplay`, isolated worktree. No push, merge, deployment, remote database access or changes to the multiplayer worktree.

## Findings and changes

### Graphics: absent pack, distinct renderers

No supplied downloaded building pack or `ModernResource_Free.zip` was found in the repository or accessible workspace. The only repository GLB is `assets/models/cars/sedan-01.glb`. The graphics laboratory contains authored procedural house/factory/office prototypes and five original PNG terrain tiles, not finished downloaded GLBs. Its `smallHouse`, `steelMill` and visual-only `officeLow` mappings do not replace Basic gameplay.

Main-game startup deliberately selects Basic. Its buildings use existing simple 2D footprint drawings; Regular 3D is paused. Its eight terrain JPGs all exist, decode and load: grass, dirt, rock, sand, dry plains, rocky grass, snow and wet ground. Basic samples these images into 64×64 luminance tiles and blends their detail with biome colors, rather than displaying full PBR materials. This explains differences from the laboratory and full-size downloaded texture previews. No missing art was substituted and no new renderer was activated. Settings now explicitly describes the laboratory, absent imported building pack and paused Regular-mode preference. Asset integration is **incomplete pending the actual assets and their license**, rather than falsely reported as installed.

Evidence: [asset inventory](asset-audit.json), [actual browser requests and decoded texture status](browser-results.json).

### Dragging: placement mode swallowed drags

Empty-terrain dragging worked on the base in Linux Chromium, so the reported Windows failure was not reproduced in every mode. Construction mode did swallow left drags: it disarmed placement after movement without panning. Input also lacked complete gesture ownership/lifecycle cleanup.

Basic input now distinguishes a click from a drag using the existing five-pixel threshold, pans during construction-mode drags, preserves wheel zoom, and places only on an uninterrupted left click on unobstructed terrain. Pointer IDs, capture loss, cancellation, blur, hidden pages, outside release and territory navigation clear gestures. A gesture cannot become a placement after its building selection changes. An open road tool retains its input. The original placement validation, purchase call, costs and footprints are unchanged.

### Multiple sessions: economy lock existed, entry and metadata were not gated

The existing exclusive browser Web Lock already protected economy transactions. However, `startGame` did not wait for acquisition, so a denied tab still entered the world. Its unrelated world-metadata unload saves could overwrite newer data.

The existing lock is now also the awaited Singleplayer entry gate. A losing tab stays on Home, cannot transact, and cannot write world metadata or advancement pins. Retry rereads canonical data only after acquiring ownership. Generation fencing prevents cancelled lock callbacks from starting a newer request. Metadata is saved before an owned lock is released. The warning offers an existing-session focus hint, retry and Home; no tab is forcibly closed. A restored suspended page that cannot reacquire ownership shows a read-only warning.

The browser releases Web Locks on refresh, close or renderer crash: no localStorage lease or permanent crash lock is introduced. Coordination applies to the same browser profile and origin (scheme/host/port), matching the scope of the save. Different ports/profiles have separate saves. Web Locks require a supported browser and secure/localhost origin; unsupported environments fail closed. A genuinely live or hung writer must be closed by the user; timeouts do not steal ownership. Browsers can reject cross-tab focus hints. Close/reload old game tabs once when installing this version: already-running old JavaScript cannot acquire these new metadata guards retroactively.

### Guest Singleplayer: already supported, Central conflict handler leaked into local play

A signed-out guest could launch Singleplayer on the base; no mandatory login gate was reproduced. Home now explicitly labels it guest/local play. A separate confirmed coupling was removed: a Central session-conflict event previously hid/reloaded even an active Singleplayer world. That handler now ignores the event only during active local play; Central and Home handling remain unchanged. The auth module, Supabase policies and cloud authorization were not modified. Guest play is not a claim of fully offline startup: external engine/SDK dependencies still exist.

## Verification

[Machine-readable test summary](test-summary.json).

- **154/154 Node tests passed**, zero failures/skips. This includes numerical solver, research, migration, catalog, rendering determinism and two new lock retry/cancelled-callback tests.
- **16/16 asset-pack safety tests** and **15/15 resource ZIP-audit tests** passed.
- **13 browser suites passed**: premium-fixes, premium-ui, Modern Frontier, visual-ui, resource-icons, graphics-prototype-sp, industrial-042a, phase-b, phase-c1, economy, forest, environment and graphics-prototype. Final targeted reruns resolved four initial harness failures: old HTML was mixed with the new entry module in two archived-baseline tests; two terrain tests navigated before the now-asynchronous entry gate completed. Baseline module lists and explicit entry-readiness waits were corrected, rather than bypassing checks.
- Native mouse pan/zoom, placement-mode drag, blur/cancellation, outside release, exact single-click house charge, Shop/Settings/Achievements at **1366×768, 1440×900 and 1920×1080** passed.
- Real same-context pages tested denied writes, metadata safety, refresh/close/retry, simultaneous entry (exactly one writer), saved building/balance preservation and a deliberate **real Chromium renderer crash**. Back/forward-cache lifecycle was **simulated** separately and verified read-only restore. The intentional crash is not a spontaneous game error.
- All eight Basic terrain images were decoded in the browser. Final dedicated run recorded **zero JavaScript/console errors, HTTP failures or failed requests**. A synthetic Central-conflict client event left active guest Singleplayer intact; no authenticated live multiplayer claim is made.
- Existing forest/environment suites exercised multiple biomes, mountains, rivers and shorelines. Regular-mode road construction was not certified: the new input test checks road-tool arbitration, and road code is unchanged. Windows-specific retesting remains necessary.

Browser environment: Linux Chromium, localhost HTTP, isolated fresh profiles, original verified cached Babylon/loader/SDK scripts substituted at their normal URLs. Project Supabase HTTPS was blocked. These are local browser tests, not live CDN, authentication, deployment or Supabase validation.

### Performance

[Large-city comparison](city-comparison.json): exact `f21fb98` Basic baseline, two fresh runs per size/variant, fixed 1,000-year scarce-input catch-up. **All ledgers, last ticks and unknown fields matched.** Median results:

| Buildings | Boot before → after (ms) | Catch-up before → after (ms) | FPS before → after | p95 frame before → after (ms) |
|---|---|---|---|---|
| 100 | 1638 → 1458 | 393 → 228 | 60.0 → 60.0 | 16.75 → 16.70 |
| 1,000 | 1548 → 1709 | 536 → 481 | 42.0 → 60.0 | 100.05 → 16.75 |
| 10,000 | 2152 → 1530 | 786 → 868 | 58.8 → 60.0 | 16.75 → 16.80 |

Long-task counts (two runs) were 3/6 → 4/3, 16/3 → 3/3 and 13/8 → 9/8 respectively; maximum tasks were 339 → 220, 312 → 395 and 326 → 220 ms. This noisy small sample does not establish a rendering speedup or rule out large-city startup spikes. In particular, 10,000-building catch-up was slower in this run; the solver itself is unchanged. The existing mixed-industrial solver benchmark also passed accelerated/reference and long-interval checks at 100/1,000/10,000 buildings. Its historical paired module comparison is against `d62525e`, not this UI baseline, and is not presented as a speedup attributable to this fix.

The separate **isolated**, alternating-order interface timing run (three fresh contexts per variant, exact `f21fb98` baseline) is in [ui-performance.json](ui-performance.json). Median startup was **1,428 → 1,405 ms**. Closed, Shop, Settings and Achievements each retained approximately **60 FPS** median and **16.7–16.8 ms** median p95 frames. Sampled idle-view long tasks totaled one before and one after; candidate FPS samples ranged 58.54–60.01. This is a small headless sample, not a guarantee for Lenovo hardware. The existing historical `graphics-main-performance` browser comparison also passed after its baseline module list was corrected. No terrain/economy rendering loops were changed.

## Files changed

- `basic_world.js`: gesture lifecycle and construction-mode panning.
- `economy.js`: adapter lock handshake, retry fencing, ownership status and release notification; production/ledger solver unchanged.
- `game.js`: await local writer, guard local metadata/capital saves, isolate active local play from Central conflict UI.
- `singleplayer-session-ui.js` (new): local-session warning/retry/focus hint.
- `index.html`: load warning module before game; updated affected script cache tags.
- `modern-frontier/ui.js`: guard advancement writes; clarify guest and graphics descriptions.
- `tests/economy.test.cjs`: lock retry and stale callback regressions.
- `tests/premium-fixes-browser.cjs` (new): real gestures, tab isolation, guest entry, crash and viewport coverage.
- `tests/environment-browser.cjs`, `tests/forest-browser.cjs`: wait for local entry before direct navigation.
- `tests/graphics-city-comparison.cjs`, `tests/graphics-main-performance.cjs`, `tests/premium-ui-browser.cjs`, `tests/premium-ui-performance.cjs`, `tests/resource-icons-browser.cjs`: coherent archived entry-module baselines; configurable Premium timing baseline.
- `modern-frontier/premium-fixes/`: this report, synthetic result JSON and screenshots.

Unchanged: `economy_model.js`, recipes/catalog/materials/research rules, saves' format, terrain/forest generation, road implementation, `auth.js`, `multiplayer.js`, server files and migrations. No player data or credentials are included.

## Evidence and Windows recheck

[Shop 1366px](shop-1366.png) · [Settings 1366px](settings-1366.png) · [Achievements 1366px](achievements-1366.png) · [Duplicate-tab warning](duplicate-session.png) · [World Map](world-map.png).

After transferring this commit by an explicitly authorized method, use a separate Windows worktree and the existing Node HTTP server. Close/reload prior game tabs, retain the same host and port to use the same save, then test guest entry, construction drag/click/zoom, the three interfaces and a second tab at that exact URL. The second tab should stay Home; closing the writer and pressing Retry must restore the same building and balance. Back up via the existing world manager before testing personal saves. No push or deployment is needed for local verification.
