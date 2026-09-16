# starhold-asset

Contract-first production for Starhold units and buildings.

## What this skill is for

Use it when creating, revising or reviewing a civilization asset, including:

- procedural unit/building geometry;
- generated reference art intended to guide an implementation;
- candidate A/B comparisons;
- asset-specific automated gates;
- human visual approval/rework evidence.

## Current implementation

Ash Jackal is the reference implementation. Its governed files include:

- `src/assets/ash-jackal.ts` — runtime procedural candidates;
- `src/assets/ash-jackal-contract.ts` — contract, immutable candidate lineage and technical gates;
- `src/tools/asset-review.ts` — Forge governance/human review;
- `src/tools/asset-review.css` — governance presentation;
- `docs/ASSET_PIPELINE.md` — project-wide lifecycle.

The current candidates are `jackal-field-1` and `jackal-longbow-1`.

## Lifecycle

```text
experiment -> candidate -> technical-pass -> visual-review -> approved
                                                    \-> rework
```

A technical pass is never an art approval. Approval is version-specific evidence; it does not silently promote the production runtime default.

## Contract contents

A useful asset contract defines at least:

- stable asset ID and civilization;
- gameplay role and body/building plan;
- visual cues that must survive gameplay scale;
- forbidden identity drift;
- palette/material ownership;
- required states;
- gameplay attachment points/sockets;
- timing relationships that presentation must respect;
- technical bounds and required gates;
- human review criteria.

## OrcDev-inspired rules adapted to Starhold

- Preserve candidate lineage instead of overwriting accepted/rejected history.
- Judge the exact production-rendered output, not only the source/configuration that authored it.
- Automated gates screen technical correctness; a human judges identity/readability.
- Fix a failing asset. Do not relax a gate solely to make the candidate pass.
- Generated concept/reference imagery is an input unless the runtime explicitly supports that asset format.
- Review at native gameplay size before rewarding decorative detail.

## Done means

An asset is ready for approval only when its contract exists, every required technical gate passes, the Forge can inspect its relevant states/facings, and a human can record an explicit approve/rework decision against the exact revision.

See [`HOWTO.md`](HOWTO.md).
