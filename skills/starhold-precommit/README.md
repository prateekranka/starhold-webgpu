# starhold-precommit

A regression-floor playbook for agent-created Starhold commits.

## What this skill is for

Use it whenever an agent is changing code, simulation rules, renderer behavior, Workshop tooling, asset contracts or research and intends to commit.

It adapts OrcDev's `shadscan-pre-commit` principle: establish the task's existing floor, then refuse to create a commit that makes that floor worse without an explicit override.

## Starhold regression floor

The exact checks depend on the task, but the default Workshop branch floor is:

- Rust default-feature tests;
- Rust workshop-feature tests;
- strict TypeScript;
- production build;
- production/workshop WASM separation;
- pinned frozen-showcase regression;
- JavaScript/WASM Workshop contract tests;
- real-pixel browser checks when UI/rendering changed;
- asset-specific gates for governed asset work.

CI is a second line of defense. The agent should run appropriate checks **before** committing rather than use GitHub Actions as its first syntax/test loop.

## Principles

1. Record the relevant baseline before changing files.
2. Do not "fix" a regression by removing the check, weakening a quality threshold or updating a golden baseline unless that change is itself the approved task.
3. Never stage or rewrite unrelated user changes.
4. A green technical floor does not imply human art/design approval.
5. If the task cannot pass without unrelated work, stop and report that dependency rather than silently broadening scope.

## Typical floor by task

### Rust simulation/research

```sh
cargo test --manifest-path sim/Cargo.toml
cargo test --manifest-path sim/Cargo.toml --features workshop
npm run verify:workshop
```

### Renderer/Workshop/UI

```sh
npm run verify:workshop
npm run test:workshop:browser
```

### Governed asset

Run the general checks plus the asset's contract gates and inspect the resulting Forge evidence.

## Completion report

Before an agent-created commit, report:

```text
Baseline: <what passed before the task>
Required floor: <checks that must remain green>
Final verification: <commands + result>
Evidence: <artifact/capture if applicable>
Commit: <sha>
Overrides: none / explicit user-approved exception
```

See [`HOWTO.md`](HOWTO.md).
