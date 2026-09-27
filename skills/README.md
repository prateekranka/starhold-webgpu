# Starhold Skills Handbook

Repository-local playbooks for building and reviewing Starhold. These are **Starhold adaptations**, not vendored copies of the upstream projects and not automatically installed agent plugins.

Read the relevant `README.md` first, then its `HOWTO.md`. An agent should treat these files as project instructions for the task at hand.

## Skills

| Skill | Use it for | Main inspiration | Current status |
|---|---|---|---|
| [`starhold-workshop`](starhold-workshop/README.md) | Developer tools, disposable scenes, real-runtime inspection and evidence | Dimillian/Evergrow development tools | Implemented in PR #1 |
| [`starhold-research-atlas`](starhold-research-atlas/README.md) | Civilization research/skill-tree work | Dimillian/Evergrow skill atlas and skill scenes | First six nodes/civ implemented |
| [`starhold-asset`](starhold-asset/README.md) | New units/buildings, candidate lineage, gates and human art approval | OrcDev reference/cleanup/rig pipelines | Ash Jackal implemented first |
| [`starhold-animation`](starhold-animation/README.md) | Gaits, attack timing, sockets, wreck/death and animation QA | OrcDev creature-animation and rig-it | Applied to Ash Jackal; reusable playbook |
| [`starhold-slice`](starhold-slice/README.md) | Cutting a large game-dev plan into safe agent-sized vertical slices | OrcDev cut-it | Process playbook |
| [`starhold-precommit`](starhold-precommit/README.md) | Keeping every agent commit above the existing regression floor | OrcDev shadscan-pre-commit | Process playbook backed by CI |

## Shared rules

1. **Use the real game systems.** Tools should call the production renderer and authoritative Rust/WASM simulation where possible. Do not build a second fake implementation solely for a preview.
2. **Disposable state for experiments.** Workshop encounters, skill/research tests and asset review fixtures must not mutate live saves or the frozen showcase.
3. **Contracts beat chat memory.** Identity, gameplay timings, sockets, required states and thresholds live in versioned project files.
4. **Technical PASS is not visual approval.** Automated gates screen candidates; a human decides whether the art reads correctly.
5. **Never weaken a gate to manufacture a pass.** Fix the asset/system. Changing a threshold requires an explicit design decision.
6. **Version candidates instead of overwriting history.** Preserve lineage so A/B comparison and rollback remain possible.
7. **Vertical slices stay green.** A slice should deliver something end-to-end, pass its checks and leave the branch usable.
8. **Evidence is reproducible.** Record seeds, revisions, commands, WASM/source provenance and captures for meaningful tests.

## How to invoke a playbook with an agent

Use explicit wording so the agent knows which project rules to load:

```text
Read skills/starhold-asset/README.md and skills/starhold-asset/HOWTO.md first.
Then add Fang Yard as the next governed Cinderwake asset. Keep the existing
Ash Jackal and frozen showcase unchanged unless the contract requires it.
```

For multi-stage work, pair `starhold-slice` with the domain skill:

```text
Read skills/starhold-slice/* and skills/starhold-animation/*.
Cut the Ash Jackal locomotion improvement into independently verifiable
vertical slices, then execute only Slice 1.
```

## Source acknowledgements

See [`SOURCES.md`](SOURCES.md) for the exact upstream repositories, commits and ideas that informed these Starhold adaptations.
