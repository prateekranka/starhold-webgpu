# starhold-workshop HOWTO

## Run the current Workshop

```sh
git switch feat/ash-jackal-workshop
npm ci
rustup target add wasm32-unknown-unknown
npm run dev:tools
```

Open:

```text
http://localhost:5199/tools/
```

Useful direct routes:

```text
/tools/?view=forge&civ=1&kind=30
/tools/?view=encounter&civ=1&kind=30
/tools/?view=research&civ=1&kind=30
```

## Add a new Workshop capability

1. **Name the real system being inspected.** Decide whether the source of truth is Rust/WASM, the production renderer, an asset contract, or presentation-only metadata.
2. **Reuse the source of truth.** Add read-only ABI/data access if necessary instead of duplicating gameplay values in the tool.
3. **Make a disposable fixture.** A reset must create fresh deterministic state with an explicit seed and no live-save mutation.
4. **Add the UI surface.** Keep controls large enough for touch and preserve the selected civilization/kind in the URL when practical.
5. **Expose evidence.** Include fixture, seed, selected revision, commands/events, source stamp and loaded WASM hash for simulation claims.
6. **Test the actual interaction.** Extend `scripts/workshop-browser.mjs`; do not only assert DOM existence. Exercise the renderer or simulation behavior the control is meant to inspect.
7. **Check production isolation.** `dist/` must not gain the developer entry page or workshop mutation WASM.

## Add a new disposable encounter

- Put authoritative fixture setup in the simulation-side workshop path, not in a visual-only TypeScript mock.
- Give the fixture a stable scenario identifier.
- Specify initial actors, ownership, obstacles/resources and authored orders.
- Record any paid research setup separately from battle time.
- Bound the run duration.
- Make the same seed + commands produce the same snapshots/events.

Then add the fixture to Encounter Lab and a deterministic regression test.

## Add a new developer workspace

The existing top-level workspaces are Codex, Forge, Encounter, Research and Review. Add another only when it represents a distinct repeated workflow.

Checklist:

- add the view identifier/title;
- add its section and navigation control;
- define when the production preview is visible;
- preserve URL routing;
- update mobile layout if the new controls can overflow;
- add one browser path through the workspace;
- document it in `docs/WORKSHOP.md`.

## Verify

Fast non-browser gate:

```sh
npm run verify:workshop
```

Browser gate on a normal desktop:

```sh
npx playwright install chromium
npm run test:workshop:browser
```

The Linux CI WebGPU command is documented in `docs/WORKSHOP.md`; do not use its software-GPU flags as a performance benchmark.

## Review questions

Before committing, answer:

- Is this showing the real runtime or a convenient imitation?
- Can the experiment be reset and reproduced?
- Does a technical PASS remain separate from a human design/art decision?
- Did we accidentally put developer-only code/assets into production output?
