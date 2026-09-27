# starhold-precommit HOWTO

## 1. Inspect the starting point

Before editing:

```sh
git status --short
git rev-parse HEAD
```

Identify unrelated working-tree changes and leave them alone.

Run the narrow checks that define the task's baseline. For Workshop/asset work, a strong default is:

```sh
npm run verify:workshop
```

If browser/rendering behavior is already part of the task and the environment supports it, also run:

```sh
npm run test:workshop:browser
```

Record failures that already existed. Do not attribute them to the task later.

## 2. Define the required floor

The floor is the baseline plus any new checks required by the requested feature.

Example for adding an Ash Jackal candidate:

```text
- existing Rust/TS/build/showcase checks remain green
- all existing Ash Jackal asset gates remain green
- new candidate lineage gate passes
- Forge renders nonblank native pixels
- human approval may remain pending
```

## 3. Work in small checkpoints

Run the cheapest relevant checks during implementation instead of waiting for the full suite.

Examples:

```sh
cargo test --manifest-path sim/Cargo.toml --features workshop
npm run test:workshop
npm run build
```

Use the full floor immediately before the commit.

## 4. Diagnose instead of weakening

When a check fails:

1. read the exact failure/log;
2. identify whether the code or the test contract is wrong;
3. fix the implementation when the contract still reflects the intended behavior;
4. change a baseline/threshold only when the requested design itself changed and record why.

Never delete a regression test merely because it blocks the commit.

## 5. Run the final floor

For the current Workshop branch:

```sh
npm run verify:workshop
npm run test:workshop:browser
```

If browser automation is environment-blocked, do not claim it passed. Report the limitation and rely on CI only if the user accepts that workflow.

## 6. Inspect evidence for visual work

A green pixel/readback test only means rendering occurred. For asset work:

- open Forge at native scale;
- inspect the exact candidate revision;
- check the gate list;
- keep human approval pending unless the user actually reviews/approves it.

## 7. Commit only the task

Review:

```sh
git diff --check
git diff --stat
git status --short
```

Then commit only the in-scope files.

## 8. Report the floor

A useful completion note is:

```text
Baseline: verify:workshop green at <sha>
Floor: no showcase/build/runtime/asset-gate regressions
Final: verify:workshop PASS; browser PASS
Evidence: <path/run>
Commit: <sha>
Override: none
```

If any item did not run, say so explicitly.
