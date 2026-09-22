# starhold-research-atlas

A playbook for Starhold civilization research and the Workshop Research Atlas.

## What this skill is for

Use it when adding or modifying:

- civilization research nodes;
- prerequisites or mutually exclusive doctrines;
- research costs, duration, producer requirements or effects;
- the Research Atlas layout/presentation;
- research-specific disposable encounter tests.

## Current implementation

The first slice has six nodes per civilization. Runtime authority lives in `sim/src/research.rs`; the client reads the catalog and status through the exported WASM API. The game and Workshop share the same research panel.

Ash Jackal currently demonstrates the intended model:

- `Tempered Arrows` changes damage;
- `Running Draw` and `Anchored Draw` are mutually exclusive specializations;
- research is paid, timed, per-match and civilization-specific;
- destroyed producer infrastructure can cancel paid research without refund;
- health research raises maximum health without healing existing units.

## Design principles

This adapts Evergrow's atlas/progression ideas to an RTS:

- the **simulation owns** costs, prerequisites, exclusivity and effects;
- layout coordinates are presentation metadata only;
- the player should be able to see what changes, what it costs, where it is researched and what is missing;
- meaningful nodes should change tactics or production decisions, not only stack tiny percentages;
- specialization choices should make the same unit/building play differently without hiding the base roster behind the tree;
- research behavior must be testable in disposable scenes.

## Tree quality rules

Prefer a shallow readable graph before a sprawling atlas. A node should have a reason to exist.

For every node, define:

- stable ID;
- civilization;
- required age;
- producer building;
- Alloy/Charge cost;
- duration in ticks;
- prerequisite set;
- exclusivity group if any;
- effect type, target and value;
- plain-language tactical intent.

Do not encode gameplay rules only in UI copy.

## Done means

A new node is complete when:

1. Rust owns its complete definition;
2. status correctly reports age/prerequisite/producer/resources/busy/exclusive/complete/running/available states;
3. the effect changes the intended authoritative gameplay path;
4. reset/new match removes per-match research state;
5. the Atlas reads it from runtime data;
6. deterministic tests cover the relevant behavior and edge cases.

See [`HOWTO.md`](HOWTO.md).
