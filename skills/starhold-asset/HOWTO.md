# starhold-asset HOWTO

## 1. Write the contract first

Before changing geometry, record the asset's identity and gameplay contract in a versioned source file.

For a unit, specify:

- civilization and role;
- body plan and silhouette cues;
- palette/material rules;
- required actions/states;
- sockets and authoritative timing relationships;
- technical envelope;
- visual-review criteria.

For a building, replace locomotion/action fields with footprint, entrances/exits, construction stages, production activity, damage/wreck requirements and any attachment points.

## 2. Create a new immutable candidate

Give every meaningful revision a unique ID such as:

```text
jackal-field-1
jackal-longbow-1
jackal-sprite-1
fang-yard-1
```

Record its parent revision and intent. Do not reuse an old revision ID for new geometry.

## 3. If using generated reference art

Treat it as governed input:

- keep one subject per pack;
- preserve consistent proportions/equipment/palette across views;
- include all silhouette-critical extremities;
- make asymmetry explicit instead of blindly mirroring;
- include a gameplay-scale contact view;
- record where the reference came from and which runtime candidate it informs.

Do not call generated reference imagery "in game" until the actual runtime path consumes it.

## 4. Implement through production rendering

Prefer a dedicated asset module called by the normal renderer and Forge. Avoid implementing a separate prettier version only for the tool.

For Ash Jackal the pattern is `drawAshJackal(...)` plus shared sockets/constants. Future assets should follow similarly narrow ownership where practical.

## 5. Add technical gates

Write gates that correspond to the contract, not arbitrary aesthetics. Examples:

- finite/positive geometry;
- required body-part/footprint structure;
- socket ownership and release origin;
- required states are mechanically distinct;
- locomotion support/contact rule;
- gameplay envelope/bounds;
- wreck is terminal and readable;
- candidate revision/lineage is unique.

A gate should explain its measurement and failure.

## 6. Inspect in Forge

At minimum review:

- native gameplay-size crop;
- enlarged crop;
- all required actor facings/camera yaws;
- idle/move/attack/hit/wreck or building equivalents;
- the current candidate's technical-gate list;
- candidate history.

A staged attack pose is only presentation review; use Encounter Lab to verify authoritative behavior/timing.

## 7. Human review

The human should explicitly check the contract's visual criteria. For Ash Jackal these include silhouette, Cinderwake identity, weapon readability and motion/action readability.

Record one of:

```text
pending
approved
rework
```

Approval is tied to the exact candidate revision. A child revision must earn its own approval.

## 8. Export evidence

Use Forge's review export when available. The record should include contract, candidate, technical gates, human decision, source/WASM provenance and relevant Workshop state.

## 9. Verify before commit

```sh
npm run verify:workshop
npm run test:workshop:browser
```

Then inspect the actual Forge capture/evidence, not only the green check.

## When to create a new candidate instead of editing

Create a new revision when the change materially affects silhouette, body plan, equipment proportions, animation/gait identity, socket placement or accepted visual behavior. Tiny implementation corrections that do not change the reviewed identity may stay within the same development candidate until it has been externally reviewed; once a revision is used as review evidence, prefer a child revision for material changes.
