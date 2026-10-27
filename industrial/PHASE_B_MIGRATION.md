# Phase B migration — economy schema 3, material registry 1

Phase A commit 3069890 and all its 55 tests were verified before implementation. The integration branch stays `feature/0.3.4-industrial-revolution`. Phase B extends the economy only; the world save, 316×316 grid, 32,768-unit territories, seed, terrain, forests, water and ownership interfaces stay compatible.

## Balances and aliases

`mapgame_economy_021e` remains canonical. Money, Steel, Carbon, Iron, Concrete and Glass stay at their existing root keys. The other 115 registered stocks live in `inventory`. `economy.materialRegistryVersion` is 1; `economy.version` becomes 3. The registry contains 121 unique IDs including Money. Its declared aliases (`Money`, `cash`, `currency`, `Steel`, `Carbon`, `Iron`, `Concrete`, `Glass`) resolve to the same canonical balances; they do not create separate stocks. Duplicate alias costs are summed before affordability/debit.

New stocks default to zero. Existing balances, pending elapsed/boosted milliseconds, high-water checkpoint and exact precision strings are retained. Nonregistered inventory keys, unknown root/economy/precision fields and building metadata survive. Noncanonical alias-looking inventory fields are retained but are not counted again as core resources. Registered quantity fields remain finite/nonnegative and use the existing numeric safety ceiling.

The Phase A ledger scale (300,000,000,000 integer units per quantity) is unchanged. JSON stores decimal strings; JavaScript numbers remain display projections. Material order is independent of accounting order. Migration does not replay already processed time or retrospectively recover time previously discarded by much older capped releases.

Malformed JSON and unsupported future economy/material-registry versions remain read-only with their source record intact. The old Phase A adapter rejects economy schema 3; downgrade by restoring a matching backup, not by forcing an older engine to consume v3 data. No Supabase migration is involved.

## Grandfathered production contracts

Known pre-catalog building IDs are assigned a stable `economyContract` referencing a rule snapshot under `economy.rules`. The snapshot retains the actual legacy/starter input, output, upkeep, housing, growth, power and workforce rule set. Existing IDs, coordinates, rotation, variant/style, levels, owner/territory metadata and custom fields are preserved. Legacy definitions that produced money are not silently converted to resource recipes. Existing level scaling is retained; no new upgrade actions or specialization effects are implemented.

New purchases also pin their active rules in the same atomic transaction as payment and placement. Industrial rows store recipe ID/version and use contract keys such as `industrial-v1:steelFoundry`; a later recipe version gets a different key. New catalog rates cannot overwrite the old snapshot. Future releases must review eligibility/unlock-policy changes separately; snapshots do not grant technologies or equipment permissions.

The five starter definitions stay available and unchanged even for new construction. Their old implicit feedstock is a deliberate compatibility policy. The 120 new industrial definitions are additional IDs with explicit recipes; no existing type is replaced by a similarly named factory.

A pre-v3 unknown row whose type happens to match a newly introduced industrial ID is preserved **inactive**, rather than suddenly becoming a producer. Other unknown types remain retained/inactive. Future-locked and definitions-only records cannot operate or be purchased under the current Phase B policy.

## Exact simulation, persistence and safety

Only stocks participating in the current city enter a simulation frame; per-building inputs/outputs use sparse slots. The exact guarded affine solver and bounded trace cache remain, now covering arbitrary registered materials. Inputs, upfront upkeep, power, workers, growth and caps determine operation. No output is spendable until the next tick. Online 1.2× increases recipe inputs and outputs together; upkeep/capacity/growth remain unboosted.

Worker jobs load the same registry and kernel. The existing Singleplayer writer lock, atomic result commit, cancellation/late-message protection, cooperative fallback and checkpoint discipline remain. Purchases that trigger their own catch-up cannot race its result. Clock/suspension gaps use offline 1× without dropping elapsed time; repeated/backward checkpoints cannot pay twice. Locally edited dates/balances remain unverifiable without an explicitly reviewed external authority.

Model/technology references are validated before registration; missing stock IDs, bad amounts and recipe cycles are rejected. Positive paid extraction is the only industrial no-material-input source. Industrial recipes cannot mint Money. These rules validate shipped content; they are not claims of multiplayer anti-cheat. Persistence and transactions remain Singleplayer-only, with no schema, auth, ownership or permission changes on the server.
