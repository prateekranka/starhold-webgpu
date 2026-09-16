# Starhold Asset Production Contract

Status: first complete governed implementation is **Cinderwake Reavers → Ash Jackal** on the workshop PR.

This layer borrows the useful production discipline from contract-driven game-art pipelines without adopting their Blender/Meshy/Unity assumptions. Starhold assets remain procedural WebGPU assets unless a separate design decision changes that.

## Lifecycle

Every authored asset revision moves through an explicit lifecycle:

`experiment → candidate → technical-pass → visual-review → approved` or `rework`

A technical pass is screening, not art acceptance. Only the human reviewer can mark a candidate approved. Workshop approval is local review evidence and **does not** rewrite source, change the runtime default, or commit to Git.

Never overwrite a prior revision. New work gets a new immutable revision ID and records its parent when applicable.

## Contract first

An asset contract owns identity, required states, gameplay attachment points, technical limits and human review criteria. Tooling consumes the contract; tooling must not silently redefine it.

The Ash Jackal contract lives in `src/assets/ash-jackal-contract.ts` and currently requires:

- Cinderwake faction identity.
- Mechanical centaur/quadruped body plan: low four-legged chassis + upright archer torso.
- Oversized ember bow and rear quiver readable at gameplay scale.
- Wine-red / dark-iron / vermilion / restrained-ember material language.
- Idle, diagonal-pair locomotion, draw/release/recovery attack, and a terminal wreck.
- Shared world release socket `(0.6, 0.18, 0.72)` at asset scale `0.6`.
- Eight actor facings, four camera yaws, and native-raster human review.

It explicitly forbids drifting into a literal canine, a generic humanoid archer, Dawnward symmetry, or a heavy-tank silhouette.

## Automated gates

`evaluateAshJackalCandidate()` runs required technical gates against the actual procedural drawing function. Current gates check:

1. finite positive geometry;
2. four-leg body-plan footplates;
3. diagonal-pair locomotion support at a sampled swing phase;
4. the contract-owned release socket and scale;
5. removal of the nocked presentation arrow after authoritative release;
6. the authored gameplay-space envelope;
7. distinct idle / walk / attack / wreck geometry;
8. a low terminal wreck silhouette;
9. unique immutable candidate lineage.

CI fails if either shipped Ash Jackal candidate breaks a required gate.

**Do not change a threshold merely to make a candidate pass.** Fix the asset. A gate or threshold may change only when the design contract itself is intentionally revised and that decision is visible in the change.

## Human review

The Forge adds a human checklist for the active Ash Jackal candidate:

- centaur silhouette reads at native gameplay scale;
- Cinderwake identity is unmistakable;
- bow and quiver remain readable across facings;
- walk, attack and wreck communicate their actions without depending on magnification.

All required technical gates and all human checks are required before the **Approve candidate** action is enabled.

The review decision and note are kept in browser local storage per immutable revision. Exporting produces `starhold-<revision>-review.json` with the contract, candidate, technical gates, human decision, provenance and current workshop state. This file is evidence only. Source promotion remains a separate deliberate code change.

## Ash Jackal candidate history

- `jackal-field-1` — root baseline, technical pass.
- `jackal-longbow-1` — child of `jackal-field-1`; longer chassis / larger bow; visual review.

Neither is marked source-level `approved` by the implementation. The operator chooses.

## Adding the next unit or building

Use the same vertical slice:

1. write the contract;
2. register immutable candidate revisions;
3. implement the production-renderer candidate;
4. add technical gates that measure claims the contract actually makes;
5. expose native-scale comparison in Forge;
6. add explicit human review criteria;
7. add deterministic encounter or construction evidence where behavior exists;
8. run the permanent workshop verification workflow;
9. keep the asset in visual review until the operator approves it.

For buildings, replace locomotion/action gates with footprint, entrance/exit, construction-stage, activity, damage and wreck gates. The next intended Cinderwake target is Fang Yard so the signature raider and its producer become a coherent first faction set.
