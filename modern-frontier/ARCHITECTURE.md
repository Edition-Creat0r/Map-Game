# Modern Frontier implementation architecture

## Integration boundary

Base is visual restoration `9111c239971fea1a27d11756490593b5cce63b43`, not main. Modern Frontier uses a new `model.js`, `ui.js` and `frontier.css`, loaded by the existing page, plus focused changes to `economy_ui.js`. It does not replace the renderer, economy solver, catalog, research policy, auth or ownership adapter. All original game module order is retained. The small pure model loads before the economy so an interrupted-restore marker can quarantine play; recovery is performed later under the writer lock before allowing play.

The static home remains available before terrain generation. Existing `mgStartSingle` and `mgJoinCentral` buttons and `game.js` handlers are retained. The home controller decorates the existing template instead of replacing account actions. The fallback game template is still present; this controller decorates whichever home exists after game initialization. Settings remain outside Home, preserving their lifetime when Home is removed.

## Home and catalog

The scene combines original SVG landscape/building silhouettes with repository PNG trees and CSS cloud/tree transforms. No second Babylon scene, image-generation dependency, full-world terrain pass or animation loop is started. CSS animations disappear with the removed Home element and respect system/user reduced motion. Static and industrial-dusk alternatives are available. Developer notes are structured in `updates.json`, explicitly marked in development/validated branch rather than claimed as deployed announcements. No fake presence, live player count or offline availability.

The construction interface is a near-full-playable-viewport catalog with independent list/inspector scrolling, existing ten-item pages, actual categories, availability/search filters, name/price/era sorting and favorites. Cards retain the existing `data-buy` placement path. Illustrations select a detail inspector without purchasing. Inspector uses actual costs, footprints, operating fields and research references; base/offline and active 1.2× recipe inputs/outputs are shown separately. Housing, energy capacity and upkeep are unboosted. Its Place action delegates to the same existing `beginConstruction` path.

Infrastructure and upgrade purchases are unavailable. The four upgrade tracks and ten-level reservation have no implementation effects. Defense definitions retain current era/availability locks. Material/economy definitions are not duplicated into a new UI catalog. Reusable 2D SVG plans avoid 3D work in Basic mode. Card DOM render signatures and closed-panel guards remain. A cached inspector signature avoids rebuilding it every economy tick.

## Preferences, audio and private imagery

- Existing visual preferences remain at `mapgame_visual_preferences_v1` with their old theme/density selectors. New studio preferences are isolated at `mapgame_frontier_preferences_v1`; favorites use `mapgame_frontier_favorites_v1`.
- One token extension covers home, shop, dialogs, graph and existing HUD: Modern Frontier, Midnight Command, Forest Technology, Industrial Gold and Neon Violet. Color inputs accept only hex values; range values are bounded when applied. No arbitrary CSS or scripts are imported. Existing legacy theme preferences remain available.
- Private images are Blob records in device-local IndexedDB `mapgame_frontier_private_images`, not world/economy saves and never public storage. PNG/JPEG/WebP only, 3 MB encoded, 32–4096 pixels per side. Header dimensions are checked before decode, then decoded dimensions are checked. Canvas re-encoding strips metadata and animation before persistence. Object URLs are revoked when replaced. Position, crop scale, dimming and removal are available for home/advancements. Storage errors produce visible feedback.
- UI audio is original Web Audio synthesis, muted by default, throttled and gesture-started, never hover/boot playback. Master/interface levels apply to tones. Music/environment levels are reserved: no tracks are installed. Reduced motion silences these optional tones. No economic state depends on audio.

## Advancement contract

Thirteen curated objectives in Civilization, Energy, Industry, Exploration and Technology. Task, Milestone and Legendary frames differ. Military, Minigames and Community are explicitly future branches. A bounded graph of 13 nodes needs no large-graph culling; rendering is change-keyed, with CSS transforms for pan/zoom and optional animated completed paths. Only completed/eligible nodes are revealed. A hidden industrial accomplishment becomes discoverable after its prerequisite accomplishments. The data contract can grow later with reviewed objectives.

Advancements do not grant materials, currency, research or multiplayer permissions. Reward is permanent cosmetic recognition. Research remains the only existing technology authority. Therefore there is no economic reward transaction to duplicate or retroactively fabricate.

State is versioned separately at `mapgame_frontier_world_v1`: `{version:1, worldId, seed, progress:{version:1, completed, pins, explored}}`, with unknown fields retained. A random world ID is created on first active Singleplayer observation; imports carry it with the snapshot and New World clears it. Seed mismatch/future versions fail closed without overwriting that source. There is one local world slot, not a fake multi-world manager.

Completed construction and research are observed from snapshots emitted after the existing adapter commits. Existing residential/factory/power/research/population facts can safely be recognized on first use because they are provable; no resource reward is granted. Territory exploration is prospective, sampled only for an actual active local territory during existing economy notifications. A fleeting visit shorter than the notification cadence can be missed; tracking does not claim historical exploration. Three goals may be pinned; completion IDs and visits are deduplicated. Reload and import do not duplicate recognition. Population loss does not revoke earned recognition. Building scans occur only when the append-only placed-record count/last identity changes; cached metrics reuse the existing summary, with no simulation/noise work or render-loop hooks.

Advancement notification has its own live region so it cannot replace research unlock feedback. Graph keyboard arrows pan; +/− zoom; buttons and Escape provide accessible alternatives; dialog Tab focus is contained and restored. Settings and shop likewise preserve keyboard behavior and construction R/Escape handling.

## Backups and single-slot replacement

Backup envelope v1, scope `singleplayer`, contains exact STRING values (or null) for only:

1. `mapgame_economy_021e`
2. `mapGame_alpha021_firstPlayable`
3. `mapgame_world_seed`
4. `mapgame_frontier_world_v1`

Raw strings preserve precision ledgers, pinned production contracts, legacy fields and unknown data without reserializing the core records. Exports exclude Supabase sessions, preferences, private images and unrelated storage. Export settles via the existing adapter, pauses its writer, acquires the existing `mapgame-singleplayer-economy-writer` Web Lock, captures the records and resumes the existing adapter. Catch-up must finish first; other-tab writers are refused. World records are the current persisted game records; no alternate save serialization is invented.

Imports accept only bounded JSON backup envelopes, safe keys/depth, supported schema/registry/progression via the existing model, finite balances, distinct building IDs, numeric coordinates and known storage-key boundaries. Unknown record fields remain raw. Invalid/future files do not change storage. Confirm with exact `RESTORE`; no mutation occurs on selecting a file. Home-only import/reset is guarded in code, not merely by hidden buttons. A pre-change snapshot is retained privately at `mapgame_frontier_preimport_v1` before writes. A write-ahead journal at `mapgame_frontier_restore_journal_v1` preserves the entire previous slot; failures roll back, interrupted writes are recovered only under the same exclusive writer lock before play. Multi-key localStorage is not a database transaction; journal-based recovery is the stated guarantee, and corrupt/unrecoverable journals quarantine play rather than being discarded.

New World requires export in that session, confirms that the export still matches current records under the lock, requires exact `NEW WORLD`, validates the seed, keeps a recovery snapshot, replaces only the four whitelisted slot records, and reloads. No multiplayer or auth data is cleared. A restore button uses the retained full snapshot. There is no downgrade operation by changing schema numbers.

## Compatibility

No economy schema change, no re-pricing, no new recipe, no core migration. The 121 IDs, 100/10 manifest, 120+5 definitions, six eras, seven technologies, exact ledger, unlimited elapsed time and online 1.2× rules remain owned by unchanged modules. Existing local saves are read without creating frontier progress until Singleplayer is active. Old game versions ignore the separate frontier keys; downgrades still require the previously documented matching backups when core schema versions differ.

Central World economy remains disabled by unchanged guards. Account/social screens expose existing account status only; username cooldown, private messages, deletion and multiplayer progress/spending remain unavailable. See [SECURITY.md](SECURITY.md). No deployed backend, database policy or GitHub Pages certification is implied.
