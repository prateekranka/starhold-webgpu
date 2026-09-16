# Starhold — civilization research

Status: **first implementation slice on `feat/ash-jackal-workshop`**, not deployed. The user approved the connected Evergrow-inspired workshop plan on September 16, 2026. The earlier decision brief is preserved in Git history; it is not an implemented feature inventory.

## Decisions used for this slice

Research is per-match and civilization-specific. Nodes cost Alloy, Charge and simulation time, and sit alongside the existing Founding → March → Starhold ages. They do not consume a new point currency or create account-wide power progression. The existing Ash Jackal and starting roster are not moved behind new unlocks.

The immediate implementation is six nodes per civilization. The previously proposed 12–18 nodes per civilization remains an expansion target, not a completed count. The atlas is a compact prerequisite diagram with readable details, not an RPG-scale traversal graph. Evergrow informs the runtime-backed inspection and testing workflow, not copied content or node-count targets.

## Runtime contract

`sim/src/research.rs` owns the catalog, paid jobs, owned research set, costs, timing, prerequisites and effects. `sim_kind_stat` exposes effective runtime actor definitions. `sim_research_*` exposes node data, availability, active job and progress. The client does not independently decide whether research is legal.

`sim_command(10, research_id, 0)` starts research; `sim_command(11, 0, 0)` cancels unfinished research with a full refund. A producer lost to combat does not refund its job. Producer and age checks remain authoritative. Health research does not heal living actors. A new match clears jobs and acquired effects.

Node effects currently cover movement, damage, maximum health, range and the two Ash Jackal doctrines. The older brief's additional economic rates, population caps, discounts, roster unlocks and age discounts are not claimed implemented.

## First catalog

Dawnward: Surveyor Boots, Cargo Bearings, Foundation Braces, Ward Plating, Focused Lenses and Long Sight.

Cinderwake: Scavenger Stride, Mule Bearings, Yard Braces, Tempered Arrows, Running Draw and Anchored Draw.

Tempered Arrows is required before either Jackal doctrine. Running Draw and Anchored Draw are mutually exclusive for a match. Running Draw permits movement twelve ticks earlier without shortening the weapon cadence. Anchored Draw commits to a longer draw and cycle in return for stronger shots. Exact prices, targets and coefficients are defined in Rust, not duplicated here.

## Interface and workshop

The game and disposable workshop share `src/research-panel.ts` and its prerequisite diagram. Nodes expose their state, cost, duration, producer, age and unmet requirements. The graph links to detailed node cards. Layout coordinates are presentation-only; edges come from the runtime prerequisite mask. Controls have touch-sized targets and narrow-view containment.

`docs/WORKSHOP.md` documents launch instructions, the six-node first slice, Ash Jackal variants, controlled encounters, evidence and limits. Research changes are exercised through real commands, not only displayed in a static tree preview.

## Verification

Rust tests cover graph IDs and acyclic same-civilization prerequisites, availability failures, exact costs/timing, repeated requests, cancellation, producer loss, mutually exclusive doctrines, reset and every current effect. Jackal tests exercise cadence, release phase, socket, movement lock and immutable in-flight damage.

JavaScript/WASM tests verify exported content, paid fixture preparation, deterministic research encounters and exact frozen-showcase snapshot equality against the pinned original code. Browser checks purchase research through the shared panel and test narrow layouts. See `docs/WORKSHOP.md` and the current GitHub Actions run for checkpoint results.

Controlled encounter comparisons do not establish final economy balance. A comprehensive research-path economic audit, larger atlas, persisted loadout planning, automatic asset promotion and physical Apple-device visual/performance approval remain outside this slice.
