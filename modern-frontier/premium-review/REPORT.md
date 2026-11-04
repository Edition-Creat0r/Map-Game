# Premium shop, Settings Studio and achievements

Branch: `feature/0.4.1-graphics-prototype`, based on preserved `e83f92d`.
Checkpoints: `b7af190` presentation foundation, `f9e62fc` interface integration,
`799c796` focus/compatibility checks, then this evidence/handoff checkpoint.
All work is local. No push, main merge, deployment, Supabase operation or
multiplayer spending activation was performed.

[21 actual screenshots / paired gallery](evidence/index.html) ·
[Short PowerShell transfer guide](WINDOWS.md)

## Implemented

**Construction Shop.** Cached original isometric SVG illustrations represent
residential, commercial, utility and industrial families, with mining/refining/
chemical details. They cover the **145 existing economy contracts** (five starter
and 140 industrial definitions). They are shared illustrative families, not 145
unique models or finished GLBs. There are no live 3D preview scenes or new assets
to download. Catalog names/footprints remain explicit.

Cards show canonical costs, base output rates, power, workers and upkeep; recipe
inputs remain expandable. Actual progression/affordability produce distinct
ready, resource-short, research-locked, unavailable and context/paused styles.
Selected cards and inspector agree. The inspector action is near the top;
payment still happens only after valid native construction. Search, departments,
favorites, paging, detailed/compact presentation and reserved upgrades survive.
Selection does not rebuild cards; native focus survives updates. Removing the
last favorite returns focus to search, keeping it inside the modal.

**Settings.** Three keyboard-accessible tabs: Graphics, Audio, Interface. Existing
live controls are moved, never cloned. Basic and useful theme/scale/motion/density
controls come first; private images, legacy palette/HUD and fine customization
are advanced. Both existing preference keys/versions and unknown fields survive.
Music/environment levels are disabled and described as reserved because there
are no tracks. Legacy Regular-only render-distance/traffic/shadow controls are
retained inactive; Regular stays paused. The experimental graphics preference
remains **false by default**, with its existing opt-in semantics preserved.
A backdrop and proper dialog semantics prevent accidental background clicks.

**Achievements.** Audit found **16 current goals**, not just the original 13:
three industrial-license goals were added by the retained expansion. All 16 IDs,
metrics, targets, prerequisites and records remain unchanged. Five branch groups:
Civilization, Industry, Energy, Technology, Exploration. Task/Milestone/Legendary
map to Bronze/Silver/Gold presentation only. No new Mastery definitions or rewards.

The tree now displays locked, available, in-progress and completed cards, native
progress bars, descriptions and three-pin controls. The existing hidden industry
goal is concealed until its prerequisites are met. Counts use actual saved
buildings, population, research and visited territories; completed records remain
recognized. No random progress, new rewards or research effects.

Fit/zoom, background dragging, arrow-key panning, card arrow/Home/End navigation,
auto-reveal of focused cards and a native-scrolling list alternative are provided.
Tree-only controls disappear in list mode. Completion notifications come from
existing advancement events and respect reduced motion. Graph redraws are keyed
by visible whole-count progress, avoiding churn for fractional population ticks.

**Focus corrections.** Chromium can retain layout boxes for closed-details
children. The old focus trap could choose one and fail Shift+Tab wrapping.
The shared trap now excludes those controls, negative-tabindex tabs, disabled,
hidden and inert controls. Programmatic Easy Craft dismissal preserves the
actual dialog invoker; its normal close/Escape behavior remains unchanged.

## Verified compatibility and tests

- **152 Node tests passed, 0 failed/skipped:** existing 146 plus six presentation
  tests covering the 16 unchanged goals, states/tiers, hidden prerequisites,
  canonical 145 previews, escaped labels and immutable records/no rewards.
- **31 Python tests passed:** 16 terrain-pack and 15 resource-audit tests.
- **15 functional browser programs passed** across initial runs and final
  targeted reruns: premium UI, missing-helper fallback, Modern Frontier,
  visual UI, resource UI, graphics Singleplayer, 0.4.2A industry, retained
  expansion, Phase B, C1, starter economy, forests, environment, large-city
  industry, full graphics showroom.
- Actual screenshot/interactions at **1366×768, 1440×900, 1920×1080**. Checks
  include selected inspector, hover/favorites, empty-favorite focus recovery,
  visible starter placement action, locked/unavailable states, cancellation
  without payment, exact $18,000 commercial placement, resulting real `trade`
  completion, tree/list/zoom/drag and keyboard navigation, three-pin enforcement,
  modal wrapping, expanded private-settings bounds, reload and repeated navigation.
- Settings are compared byte-for-byte against paused economy/base-world records;
  pausing isolates this check from legitimate background autosaves. Existing
  backup/import/export, interrupted-restore recovery, unknown fields, writer
  locks and legacy factory contracts passed inherited browser/model tests.
- Initial broad run: 20/21 programs passed; the stronger new keyboard case exposed
  the collapsed-details focus bug. After the fix, all nine targeted final
  programs passed. The final premium UI rerun also verifies list controls and
  expanded settings bounds. Failure/resolution records are retained in evidence.
- Normal suites report no uncaught errors, missing resources or failed loading.
  A separate intentional 503 for premium-ui.js verifies Singleplayer startup,
  legacy shop/settings and read-only achievement fallback without uncaught
  exceptions. Existing expected missing-texture fallback remains passing.

The canonical **139 internal / 118 player-facing materials, 140 industrial
entries, five starters and 14 research nodes** are unchanged. Economy model,
ledger, recipes, costs, research rules, original manifests, advancement model,
save formats, world/terrain/forests, auth and multiplayer code are untouched.
All 14 protected multiplayer RC files and that branch ref remain unchanged.

## Matched performance

Exact committed e83f92d source overrides versus the candidate, same Basic
territory T_190_27/seed/camera and cached libraries, fresh 1440×900 contexts.
Three samples each, alternating order; warm-up before ≥120 frame intervals per
view. The default-motion and motion-off comparisons ran separately, with no
concurrent browser/solver benchmark. No rendering/simulation work was capped.

| Default motion: median | Before | After |
| --- | ---: | ---: |
| Closed panels FPS | 59.5 | 60.0 |
| Shop FPS / p95 interval | 60.0 / 16.8 ms | 60.0 / 16.8 ms |
| Settings FPS / p95 | 57.6 / 16.8 ms | 60.0 / 16.8 ms |
| Achievements FPS / p95 | 21.62 / 50.1 ms | 60.0 / 16.7 ms |
| Startup ready | 1291 ms | 1250 ms |
| Shop reopen, DOM + layout | 4.8 ms | 5.0 ms |
| Settings reopen, DOM + layout | 0.1 ms | 0.1 ms |
| Achievements reopen, DOM + layout | 2.9 ms | 6.6 ms |

Default achievement FPS ranges: **21.24–21.95 before; 59.02–60.00 after**.
With motion off, achievement medians were **56.25 → 60 FPS**, with 16.8 ms p95
intervals. There were zero >50 ms tasks in the final measured steady-view windows;
this does not describe startup or synthetic batches of repeated opens.

Backdrop blur was removed from the new panels; static illustrations reuse cached
markup. These changes reduce compositing cost without adding render-loop hooks.
The comparison does not isolate every CSS property's contribution or measure
actual GPU memory. Achievements take about 3.7 ms more to build because all 16
cards/progress bars are present rather than just unlocked cards. Warm-up + 12
reopen samples/page are DOM/layout measurements, not input-to-display timings.
The separate existing 50-open shop benchmark also passed. Three startup samples
do not establish a speedup; hardware/driver behavior can differ substantially.

The final **12-page city comparison** retained 100/1,000/10,000 saved buildings,
settled a valid positive-timestamp 1,000-year offline interval and produced
identical exact ledgers before/after. All three sizes averaged about **60 FPS**.
At 10,000, catch-up was 704–715 ms baseline and 712–784 ms candidate across two
samples; p95 frames remained around 16.7–16.8 ms. This is Basic with normal
culling, not 10,000 simultaneously visible 3D models. The existing mixed-industry
solver benchmark and accelerated/reference agreement also passed.

Browser runs use real Chromium and explicitly verified cached official npm
Babylon 9.32.0/loaders and the unchanged HTTPS jsDelivr SDK checksum recorded in
resource-icons/REPORT.md. Caches remain outside Git; Supabase project requests
are blocked by the test preload. No TLS verification is disabled. These tests
are local, not live CDN, deployed-site, Windows, mobile or hardware-GPU approval.

## Remaining limitations / next steps

- Regular 3D remains paused; no finished GLBs or unique art for every factory.
- Music/environment tracks, working upgrades, multiplayer achievements and
  economic achievement rewards are not implemented or presented as active.
- Current achievements remain Singleplayer recognition derived from existing
  records; no server authority or anti-cheat claim is made for local saves.
- The missing ModernResource_Free pack is intentionally not required. Existing
  fallbacks and the original gold Money/Credits icon are retained unchanged.
- Review screenshots and transfer the local bundle using WINDOWS.md. Use a fresh
  browser profile for review. No push, deployment, merge or multiplayer spending is authorized
  by these UI checks; those require separate authorization.

## Reproduce

Serve the repository locally, then use Node/Chromium with Playwright-core and
accessible existing CDNs or an explicitly verified test preload:

```sh
python -m http.server 8017 --bind 127.0.0.1
# Run the following in another terminal:
node --test tests/*.test.cjs
node tests/premium-ui-browser.cjs /tmp/premium-ui
node tests/premium-fallback-browser.cjs /tmp/premium-fallback
MAP_GAME_TEST_MOTION=subtle node tests/premium-ui-performance.cjs /tmp/premium-perf
MAP_GAME_BASELINE_REF=e83f92d node tests/graphics-city-comparison.cjs /tmp/premium-city
```

The same controls are manually reviewable on Lenovo; Linux browser scripts/cache
paths are not certified as Windows automation. See the transfer guide.

## Exact files changed

- `economy_ui.js`
- `index.html`
- `modern-frontier/premium-review/REPORT.md`
- `modern-frontier/premium-review/WINDOWS.md`
- `modern-frontier/premium-review/evidence/after-achievements-1366.png`
- `modern-frontier/premium-review/evidence/after-achievements-1440.png`
- `modern-frontier/premium-review/evidence/after-achievements-1920.png`
- `modern-frontier/premium-review/evidence/after-settings-1366.png`
- `modern-frontier/premium-review/evidence/after-settings-1440.png`
- `modern-frontier/premium-review/evidence/after-settings-1920.png`
- `modern-frontier/premium-review/evidence/after-shop-1366.png`
- `modern-frontier/premium-review/evidence/after-shop-1440.png`
- `modern-frontier/premium-review/evidence/after-shop-1920.png`
- `modern-frontier/premium-review/evidence/before-achievements-1366.png`
- `modern-frontier/premium-review/evidence/before-achievements-1440.png`
- `modern-frontier/premium-review/evidence/before-achievements-1920.png`
- `modern-frontier/premium-review/evidence/before-settings-1366.png`
- `modern-frontier/premium-review/evidence/before-settings-1440.png`
- `modern-frontier/premium-review/evidence/before-settings-1920.png`
- `modern-frontier/premium-review/evidence/before-shop-1366.png`
- `modern-frontier/premium-review/evidence/before-shop-1440.png`
- `modern-frontier/premium-review/evidence/before-shop-1920.png`
- `modern-frontier/premium-review/evidence/city.json`
- `modern-frontier/premium-review/evidence/completion-notice.png`
- `modern-frontier/premium-review/evidence/final-programs.json`
- `modern-frontier/premium-review/evidence/focus-regression.txt`
- `modern-frontier/premium-review/evidence/index.html`
- `modern-frontier/premium-review/evidence/industrial-solver.json`
- `modern-frontier/premium-review/evidence/initial-programs.json`
- `modern-frontier/premium-review/evidence/interface-results.json`
- `modern-frontier/premium-review/evidence/performance-default.json`
- `modern-frontier/premium-review/evidence/performance-reduced.json`
- `modern-frontier/premium-review/evidence/runtime-sha256.json`
- `modern-frontier/premium-review/evidence/settings-audio.png`
- `modern-frontier/premium-review/evidence/settings-interface.png`
- `modern-frontier/premium-ui.js`
- `modern-frontier/premium.css`
- `modern-frontier/ui.js`
- `resource-icons/recipe-sidebar.js`
- `tests/graphics-city-comparison.cjs`
- `tests/modern-frontier-browser.cjs`
- `tests/premium-fallback-browser.cjs`
- `tests/premium-ui-browser.cjs`
- `tests/premium-ui-performance.cjs`
- `tests/premium-ui.test.cjs`
- `tests/visual-ui-browser.cjs`
- `visual_ui.js`
