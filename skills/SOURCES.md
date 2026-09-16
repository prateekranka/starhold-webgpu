# Sources and adaptation notes

The Starhold playbooks in this directory were written for this repository. They borrow **patterns**, not project-specific code or asset pipelines, from two public projects.

## Dimillian / Evergrow

Repository: `https://github.com/Dimillian/Evergrow`

Reference commit used while designing these playbooks: `025ee2f7c01fbdf938fcff1d6c6d0964cf622d35`.

Patterns adapted for Starhold:

- a discoverable developer-tool hub instead of isolated debug URLs;
- small tools that exercise the **real game systems** rather than parallel mocks;
- disposable simulation scenes for ability/skill testing;
- an atlas-style progression interface with search, prerequisites and route visibility;
- tests for topology/readability and deterministic skill behavior;
- cross-navigation between data, previews and simulation evidence.

Relevant upstream areas inspected included `docs/development-tools.md`, `game/src/tools/catalog.ts`, `game/src/tools/skills.ts`, `game/src/tools/skill-scene.ts`, `game/src/skill-tree.ts`, and `game/scripts/skill-tree-audit.ts`.

Starhold differences: our authoritative gameplay is Rust/WASM, rendering is raw WebGPU, research is per-match civilization tech rather than Evergrow's RPG progression, and the Workshop is development-only.

## TheOrcDev / skills

Repository: `https://github.com/TheOrcDev/skills`

Reference commit used while designing these playbooks: `b57efd8a835247e6315204510fd4601e6ca4dbfb`.

Patterns adapted for Starhold:

- contract-first asset production;
- immutable candidate revisions and source lineage;
- reference consistency and gameplay-camera readability;
- measurable animation/asset gates followed by separate operator visual approval;
- fixing the asset instead of relaxing a failed gate;
- deterministic gait/contact thinking;
- vertical, dependency-ordered work slices;
- a pre-commit regression floor for agent-created changes.

Relevant upstream skills inspected included `game-art-reference-packs`, `creature-animation`, `rig-it`, `game-model-cleanup`, `meshy-asset-production`, `cut-it`, and `shadscan-pre-commit`.

Starhold differences: PR #1 uses procedural WebGPU geometry rather than a Blender/FBX/Unity production path. Meshy, Mixamo, Blender and Unity instructions are **not** dependencies of these Starhold skills. If Starhold later adopts authored meshes, evaluate that pipeline separately instead of assuming the upstream provider settings or budgets apply.

## Attribution rule for future edits

When adding another idea from either upstream project:

1. describe the pattern being adopted;
2. state how Starhold's architecture changes it;
3. avoid copying project-specific paths, budgets, provider settings or acceptance thresholds without an explicit Starhold decision;
4. keep technical checks and human art/design approval separate.
