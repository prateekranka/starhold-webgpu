# starhold-slice HOWTO

## 1. Start from an existing goal

Use the approved plan, issue, spec, PR description or user request. Do not invent a broader roadmap while slicing.

Write one sentence for the end state. Example:

```text
Cinderwake's signature ranged unit and its producer can both be authored,
inspected, tested and reviewed through the governed Workshop pipeline.
```

## 2. Identify dependency boundaries

For Starhold, common dependency layers are:

- simulation/runtime contract;
- renderer/asset implementation;
- Workshop inspection surface;
- deterministic tests/evidence;
- human visual/design review.

Do not automatically make those separate slices. A good vertical slice usually crosses several of them for **one narrow capability**.

## 3. Cut the smallest useful end-to-end result

Example plan: "finish Cinderwake asset pipeline".

Better slices:

```text
1. Fang Yard contract + candidate + Forge inspection + gates
2. Fang Yard construction/production states + QA
3. Ash Jackal/Fang Yard production relationship in Encounter/Codex
4. Exportable faction-set review evidence
```

Each leaves something testable and visible.

## 4. Define Done before implementation

A Starhold Done condition should name commands and observable evidence.

Example:

```md
**Done when:**
- Fang Yard appears in Forge through the production renderer.
- Construction phase 0, .5 and 1 are visually distinct.
- Required asset gates pass.
- `npm run verify:workshop` passes.
- Browser QA captures the Forge candidate at desktop and phone viewport.
- Human visual approval remains pending unless the user explicitly approves it.
```

## 5. Protect adjacent systems

State invariants such as:

- frozen showcase unchanged;
- production WASM receives no workshop mutation exports;
- existing Ash Jackal candidate revisions remain immutable;
- no research rebalance in an art-only slice;
- no broad renderer refactor unless required by this slice.

## 6. Execute one slice at a time

At the beginning of an agent run, paste or point to the complete slice. At the end, require:

- changed files;
- verification commands/results;
- evidence location;
- commit SHA if committed;
- remaining next slice, without starting it automatically unless requested.

## 7. Re-slice when a slice grows

Split the slice if it starts touching unrelated simulation rules, several asset families, multiple UI systems or a large architectural rewrite that cannot be validated independently.

Do not keep expanding scope just because the same agent already has context.
