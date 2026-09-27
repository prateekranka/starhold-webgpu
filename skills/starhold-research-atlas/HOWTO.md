# starhold-research-atlas HOWTO

## Add a research node

1. Open `sim/src/research.rs` and locate the authoritative `RESEARCH` catalog.
2. Choose a stable ID in the civilization's range. Do not renumber shipped/used IDs casually.
3. Define faction, age, producer, Alloy, Charge, duration, prerequisites, exclusivity, effect, target and value.
4. Add or extend the authoritative effect handling. Generic stat effects belong in `effective_kind`; timing/behavior specializations may need dedicated simulation logic.
5. Expose no duplicate client-side cost or prerequisite table. The client should read the runtime catalog.
6. Add human-readable presentation metadata only where needed for names/descriptions/layout.

## Prerequisites and exclusivity

Before committing:

- confirm every prerequisite belongs to a valid node and does not create a cycle;
- confirm a node is reachable at the intended age;
- make exclusivity groups explicit and symmetric;
- test attempting each mutually exclusive sibling after the other has completed;
- test cancellation while running separately from completed ownership.

## Test the effect in a disposable scene

For unit research, create or reuse an Encounter Lab fixture that can expose the changed behavior under identical conditions.

Examples:

- damage/range: stationary target with deterministic shot timing;
- speed/recovery: fixed route or repeated authored movement policy;
- health: controlled damage before/after research without accidental healing;
- production/building effects: fixed queue and resource state.

Compare the same seed and authored policy. Do not call the result a general balance or win-rate prediction.

## Add it to the Atlas

The Atlas should derive graph edges from runtime prerequisites. Only visual placement belongs in presentation code.

Check:

- the label is readable at phone width;
- locked/running/completed/available states are distinct;
- missing requirement text matches authoritative status;
- mutually exclusive choices are obvious before purchase;
- the graph does not require reading crossed or excessively long connector lines to understand the path.

## Required tests

At minimum, extend coverage for:

- catalog uniqueness and prerequisite acyclicity;
- wrong civilization;
- insufficient age/resources;
- missing producer;
- busy producer/queue;
- exact completion tick;
- cancellation/refund policy;
- producer loss policy;
- exclusivity if used;
- actual effect on the target system;
- fresh-match reset.

Run:

```sh
cargo test --manifest-path sim/Cargo.toml --features workshop
npm run verify:workshop
```

When the Atlas interaction changed, also run:

```sh
npm run test:workshop:browser
```

## Design review

Ask three questions before adding another node:

1. Does this create a decision, or only another percentage?
2. Can a player understand what changes before paying?
3. Can the Workshop prove that the implementation matches that promise?
