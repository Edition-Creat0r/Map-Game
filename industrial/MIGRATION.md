# Phase A save and clock contract

The world save (`mapGame_alpha021_firstPlayable`), territory dimensions, ownership, terrain, forests and placement formats are unchanged. Economy storage remains `mapgame_economy_021e`; migration is additive to `economy.version = 2`. The previous 0.3.3D report describes a historical 12-hour cap; this release supersedes that cap.

## Exact ledger and compatibility

Money, Steel, Carbon, Iron, Concrete and Glass stay at their existing root locations. Existing `placedIncomeItems`, IDs, positions, styles/variants, levels, legacy flags and unknown fields survive. Version-1 partial elapsed/boosted milliseconds, population and high-water checkpoint are retained. Legacy flat saves still use the inherited one-time import and grandfathered building definitions; this does not re-price or re-recipe existing buildings.

Version 2 adds `economy.precision`: decimal integer strings with 300,000,000,000 units per resource/person. BigInt arithmetic never enters JSON directly. Decimal configuration rates are rounded to six decimal places; integer elapsed milliseconds then have exact accounting at the stored scale. Display/API balances remain JavaScript numbers. The whole-number/remainder projection avoids artificial fractional errors for large integer balances. Older numeric fractions migrate to within one ledger quantum (about 3.33×10^-12); existing numeric precision is not magically recoverable.

Unknown root, economy and building fields remain, including unknown precision-map entries. Known numeric fields are sanitized as before. Malformed saves and newer unsupported schema versions remain read-only, preserving their source. Version-1 readers in 0.3.3D already reject newer economy versions. To downgrade, restore a matching backup of both save keys; do not ask older simulation code to interpret v2 precision/checkpoints.

`lastEconomyTick` remains mirrored for compatibility; `economy.lastTick` is the authoritative high-water cursor. Progress already discarded by an earlier capped release cannot be reconstructed from its advanced timestamp and is not retrospectively fabricated.

## No offline elapsed-time cap

Every positive elapsed millisecond from the saved checkpoint is retained. The former `CAP_MS` and its `Math.min` are gone. `OFFLINE_CAP_MINUTES` is `null` as legacy API metadata meaning no cap. There is no replacement seven-day/year cap.

The same ten-second operating rules apply to online and offline time, with partial intervals retained across callbacks. Production speed is 1.2× visibly online, 1× offline; recipe input consumption scales with production speed. Upkeep, housing growth, energy and workforce capacities are unboosted. Prototype recipe tests use the existing six stocks; live starter recipes and balances remain unchanged until Phase B.

Resources retain their existing 10^12 numeric ceiling. That bounds amounts, not elapsed time. A full stock can remain full while time and upkeep continue; this is not yet warehouse overflow/logistics simulation. Supported timestamps are nonnegative safe-integer milliseconds, covering the JavaScript Date range. Invalid/non-finite timestamps fail closed rather than creating NaN state. Mathematical infinity is not a meaningful saved timestamp.

## Catch-up algorithm and interruption

The solver evaluates a discrete operating state: stable saved order (generators first), upfront upkeep/input reserves, workers, power, outputs and population. It records the exact inequalities determining that state and its resource/population flow. Repeated operating profiles define a candidate affine cycle. A cycle is skipped only while every recorded inequality remains satisfied and no changing quantity crosses a clamped face. Cash, input, workforce, housing and stock boundaries are handled by exact evaluation. A conservative boundary cycle is left unskipped. New output cannot fund another building's input in the same tick.

Steady rates and common alternating production shortages therefore take work proportional to operating changes rather than elapsed ticks. Exact ledgers make aggregate cycles and one-tick reference execution agree, including across callback partitions and reloads. The trace cache is bounded at 64 profiles; unusual future networks with long/nonrepeating behavior can require more evaluations. Phase B must validate and benchmark its actual recipe graph; Phase A does not prove constant-time execution for every arbitrary programmable production network.

Large cities (>256 records) resume in `economy_worker.js`, which has no DOM, storage, ownership or multiplayer access. It receives a snapshot and returns a completed result plus summary. The owning tab holds the existing exclusive Web Lock, blocks economic mutations during catch-up and atomically commits balances, buildings and checkpoint together. Closing/cancelling terminates the worker; late results are ignored. A crash before commit pays nothing and leaves the old checkpoint, so resuming recomputes rather than double-awards. Failed persistence rolls back the result.

Browsers without Workers, worker failures and small jobs use bounded cooperative passes. Large cooperative cities allow two exact evaluations per pass; others allow 32. Each persisted cursor includes the balances actually computed through it. Remaining elapsed time is not dropped or placed into an invalid oversized partial tick. Construction remains blocked until completion. Storage and UI updates still have some main-thread cost; workers do not make huge saves free.

## Clock limits and Singleplayer authority

Reloading/resuming the same checkpoint cannot pay twice. A backward wall clock cannot move the checkpoint backward. Matching building transaction IDs remain idempotent. The exclusive writer lease prevents two cooperating tabs from independently advancing the same save; an unexpected external write pauses the active writer.

A live wall/monotonic skew above five seconds is recorded in `clockAnomalies` and shown as a notice. Such intervals receive offline 1×, not an invented online bonus. Importantly, they are **not discarded**: operating-system suspension can resemble a forward clock edit. The monotonic observation spans worker computation, so starting a worker does not erase that observation. On normal callback gaps above 60 seconds the inherited conservative offline-rate policy also applies.

An untrusted local file and device clock cannot distinguish a genuine closed-game absence from a user advancing the clock or editing balances. There is no claim of anti-cheat, server authority, trusted UTC or secure multiplayer economy. Eliminating forward-date farming would require an explicitly reviewed trusted time/transaction service. No Supabase/auth/schema/ownership changes are part of Phase A.
