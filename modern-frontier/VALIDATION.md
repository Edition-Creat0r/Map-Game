# Modern Frontier — integration and release report

Branch `feature/modern-frontier`, based on validated visual restoration `9111c239971fea1a27d11756490593b5cce63b43`. Application code is frozen at `437fda404b21e49851101edeaa05b699337a5825`; subsequent changes are documentation and validation tools only. **Main is unchanged. This is not a deployed or multiplayer-economy release.**

## Implemented checkpoints

| Checkpoint | Delivered and checked |
|---|---|
| Home hub | Two main play cards, existing SP/auth handlers, read-only world/research/advancement summary, backed-up New World, asset-backed original scene, reduced/static alternatives, structured truthful development notes |
| Ultimate shop | Near-full playable viewport, actual catalog categories, search/availability filters, price/name/era sort, favorites, 2D previews, no-purchase inspection, base/active recipes, real requirements and existing Place/rotation/cancel/payment path |
| Settings studio | Five presets, safe color inputs, text scale, legacy density controls, scene/motion/shop/graph controls, line glow/speed, local-only validated/cropped/dimmed backgrounds, volume/mute and gesture-started synthesized UI tones |
| Account/community | Current account status, existing Central auth entry, explicitly unavailable friends/messages/username/deletion/server previews |
| Advancements | 13 curated SP objectives in five working branches, three tiers, eligible-node reveal/hidden industrial goal, cosmetic completion, three pinned goals, pan/zoom/keyboard graph, optional animated links; research remains separate |
| Worlds/backups | Private exact-string SP export, versioned validated import, deliberate confirmation, pre-change snapshot, same-writer-lock exclusion, write-ahead rollback/recovery, backed-up single-slot New World and complete-snapshot restore |
| Backend foundation | Audited existing clients and delivered proposed authority/transaction/settlement/security matrix; no backend or sensitive client writes enabled |

Military/minigame/community objectives, actual factory upgrades, warehouse/network economy effects, extra servers and theme-pack import remain clearly reserved. No invented economic reward currency. Music/environment sliders are reserved because no tracks exist. Offline launch is explicitly unverified: there is no service worker. No private image is uploaded publicly.

## Tests and source compatibility

- **101/101 automated tests pass**, zero failures/skips: `node --test tests/*.test.cjs`. The initial full runner contained 99; two additional import/privacy tests subsequently passed with the entire deterministic suite. Log: `/workspace/modern-frontier/final-automated.log`.
- All **12 inherited C1 release suites**, inherited visual UI and environment screenshot suites passed against the frozen application. Includes actual SP launch/World Map/local navigation, starter and industrial placement/rotation/cancel, all C1 research/material progression, legacy/unknown fields and contracts, unlimited offline/1.2× accounting, forest/geographic continuity and 1,000/10,000-building cities.
- Modern Frontier browser suite passed at **1366×768, 1440×900, 1920×1080**. Tests actual user actions: signed-out Central auth gating; real construction debit; no debit on inspection/cancellation; favorites/filter/inspector; research and recognition; pin cap/graph pan/zoom/keys; preferences and private image upload/removal; exact export/import/reload; cross-tab import refusal; confirmed New World and complete restore; interrupted-journal recovery. Final additional run also verifies silent boot, system reduced-motion static scene, and deliberately unmuted gesture-started Web Audio.
- Final browser error/HTTP-failure/failed-request arrays are empty. Existing eight terrain sources load; Regular 3D stays paused. TLS verification stays enabled, using the environment's existing verified trust; no CA/trust-store changes or certificates are committed.
- **47 existing runtime JS/CSS/JSON files are byte-identical to the base**, including all economy/model/worker/catalog/material/research policies, terrain/forests/hydrology/renderers, game, buildings, authentication and ownership modules. Only existing `index.html` and `economy_ui.js` are changed; new frontend modules supply the update. Audit: `/workspace/modern-frontier/source-audit.json`.
- Preserve 121 internal IDs, 100 visible / 10 initial materials, 120 industrial + five starter definitions, six eras, seven research nodes, 316×316 world and 32,768-unit territories. No core schema/recipe/price/multiplier migration. New SP recognition uses a separate versioned slot record included in backups; unknown fields remain preserved. See [ARCHITECTURE.md](ARCHITECTURE.md).

Full command (sequential, no overlapping benchmarks):

```sh
NODE_PATH=/workspace/.onboarding-tools/node_modules \
MAP_GAME_TEST_URL=http://127.0.0.1:8001 \
node tests/run-frontier-release.cjs /workspace/modern-frontier/release
```

A source server and trusted Chromium/Playwright installation are required. The runner preserves historical visual/C1 comparisons and separately compares to `9111c23`. Resume was used only after verifying the same source commit and no runtime changes; the expanded cross-tab test originally needed an asynchronous Web Lock-result wait. Final expanded tests passed. The final independent browser run is `/workspace/modern-frontier/final-browser/results.json`; consolidated prior suites are `/workspace/modern-frontier/release/results.json`. These are local source validations, not Pages or live database certification.

## Performance — retain the open release gate

Three interleaved fresh-browser samples per version against exact visual restoration; software WebGL at 1440×1000. Medians below. **Do not infer universal improvement or dismiss the colder regressions as noise.**

| Metric | Restoration baseline | Modern Frontier |
|---|---:|---:|
| Startup | 2,127 ms | 1,680 ms |
| Territory entry | 1,070 ms | 973 ms |
| High-detail ready | 1,959 ms | 1,961 ms |
| World pan FPS / p95 | 55.6 / 33.3 ms | 47.6 / 49.9 ms |
| Local pan FPS / p95 | 51.4 / 33.4 ms | 53.6 / 33.4 ms |
| Zoom FPS / p95 | 59.2 / 16.8 ms | 48.2 / 50.0 ms |
| Detail pan FPS / p95 | 55.2 / 33.3 ms | 43.7 / 50.0 ms |

Additional warm controlled profiling uses the same T_190_27 territory, seed 734221, viewport/camera, 4.5-second warm-up, six-second repeated pan/zoom trace, alternating order and three runs per version. Median **51.69 → 52.00 FPS**, **33.4 → 33.4 ms p95**, browser task time **1.626 → 1.648 s** and script time **0.536 → 0.513 s**. This repeat does not reproduce a large steady renderer slowdown. All scenes have zero remaining Home animations after launch. Dominant samples are existing native drawImage/getBoundingClientRect, `basic_world.updateInspector` and forest drawing. Modern Frontier JS accounts for one sample in each approximately 5,400-sample trace; no new hot rendering loop is evidenced. No CPU-throttling intervals occurred within those profile windows. These observations do not explain every cold pan/zoom outlier, so **the performance release review remains OPEN**. No unmeasured renderer rewrite or work reduction was used to hide it.

Repeated exact-fixture 1,000-year catch-up (three fresh-browser samples, alternating order, fixed trusted test clock, identical serialized inputs):

| Buildings | Baseline median (range) | Frontier median (range) |
|---|---:|---:|
| 100 | 319.4 ms (175.7–513.5) | 220.0 ms (172.9–395.2) |
| 1,000 | 354.4 ms (337.8–371.3) | 357.4 ms (314.8–754.3) |
| 10,000 | 913.4 ms (908.5–1,495.8) | 1,021.8 ms (956.1–1,098.3) |

All paired exact ledger/checkpoint/contract hashes agree. These are cold UI/adapter resumes, not isolated warm-kernel timings; 10,000-record median is 11.9% higher and remains reported. The inherited isolated kernel gate also passes (B median 66.25 ms / current C1 64.80 ms; one of four regression pairs, below its rejection rule); kernel source is unchanged, so no frontend speedup is attributed to it. Earlier large-city samples and all raw ranges/outliers are retained rather than replaced.

Shop open/filter/close, 50 iterations per run: median approximately **0.30 → 0.40 ms**, median p95 **4.7 → 0.7 ms**, ten rendered records in both. Post-GC JS heap across three pairs was approximately **25.4–26.5 MB**, with less than **1 MB retained delta** after 100 shop cycles in every run. This is JS heap, not GPU/process memory or a guarantee of leak-free indefinite sessions.

Raw frame intervals/long tasks, CPU profiles, heap, source hashes and summary: `/workspace/modern-frontier/performance-summary.json` and `release/`. Initial final-release long tasks and city spikes remain visible in the logs. Performance concerns are not closed merely because functional test processes exit successfully.

## Screenshots and release blockers

[Gallery: all three resolutions, shop/graph/studio, World Map, forests/mountains/rivers/lakes/research/inventory](/workspace/modern-frontier/GALLERY.html). Captures are local Singleplayer, never described as a signed-in Central World or deployed site. Graph captures include deliberate pan/zoom tests; hidden nodes are progressively revealed. Art limits remain the same: no dedicated evergreen PNGs, no full factory-thumbnail pack or music tracks; existing PNG/procedural atlas and deterministic 2D plans are used. Profiles also retain inherited territory metadata where a legacy biome label can differ from the shared dominant biome weights; this update does not reinterpret that label or change geography.

**Do not merge:** the prior conditional release gates and unresolved performance review remain in force. Multiplayer economy/social/deletion require authorized staging/schema/RLS/RPC access, trusted server settlement and authoritative terrain/collision transactions, deployed migrations and real two-user adversarial tests. None are certified here. [SECURITY.md](SECURITY.md) specifies the exact missing prerequisites, proposed contract and required attack matrix. Signed-in multiplayer and deployed website testing are not claimed. Main and current ownership/auth behavior stay unchanged.
