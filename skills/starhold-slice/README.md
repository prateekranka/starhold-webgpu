# starhold-slice

A planning playbook for cutting Starhold work into vertical, independently verifiable agent-sized slices.

## What this skill is for

Use it before a large implementation request such as:

- "build out Cinderwake";
- "finish the research atlas";
- "add all building construction states";
- "redo unit animation";
- "make the Workshop support generated sprites".

It adapts OrcDev's `cut-it` idea to Starhold's simulation/renderer/tooling boundaries.

## Slice rules

Every slice should be:

- **vertical** — it produces a working end-to-end capability, not only a new data layer with no consumer;
- **dependency ordered** — no hidden reliance on a future slice;
- **small enough for one focused agent run**;
- **large enough to produce a meaningful reviewable result**;
- **green at the end** — relevant tests/builds pass;
- **self-contained** — another agent can execute it without this chat history;
- **explicit about scope** — name what is deliberately not being changed.

## Starhold slice template

```md
## Slice N — <imperative title>

**Goal:** What working capability exists after this slice?

**Depends on:** none / Slice X

**Touches:**
- exact files/modules/areas

**Steps:**
1. concrete action
2. concrete action
3. verification/evidence action

**Done when:**
- exact observable behavior
- exact tests/commands
- required evidence or human review state

**Out of scope:**
- explicit adjacent work not to pull into this slice
```

## Good Starhold slices

Examples:

- "Add Fang Yard contract + one Forge candidate + contract gates";
- "Synchronize Ash Jackal release pose with authoritative projectile event";
- "Add one Cinderwake research specialization and deterministic encounter coverage";
- "Add building construction phase inspection to Forge and browser QA".

## Weak slices

Avoid horizontal slices like:

- "add all types/interfaces";
- "refactor renderer";
- "write tests later";
- "generate every Cinderwake asset".

These either defer the proof of value or create too much unreviewed surface area.

See [`HOWTO.md`](HOWTO.md) for turning a plan into execution slices.
