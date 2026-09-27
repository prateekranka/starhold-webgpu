# starhold-workshop

A playbook for building Starhold developer tools that inspect and exercise the **actual game** in disposable, reproducible contexts.

## What this skill is for

Use this when adding or changing:

- Civilization Codex views;
- Asset Forge inspection;
- Encounter Lab fixtures;
- Research Atlas tooling;
- Review & Evidence exports;
- a new developer-only tool that needs renderer/simulation access.

## Current implementation

The first connected Workshop lives in:

- `src/tools/workshop.ts`
- `src/tools/runtime.ts`
- `src/tools/asset-review.ts`
- `src/tools/workshop.css`
- `tools/index.html`
- `scripts/workshop-browser.mjs`
- `docs/WORKSHOP.md`

Run it with `npm run dev:tools` and open `/tools/`.

## Design principles

This playbook adapts the strongest Evergrow developer-tool pattern: a tool should be a **thin controlled surface over reusable game systems**.

For Starhold that means:

- renderer previews use `Renderer`, not a separately drawn approximation;
- gameplay behavior comes from the Rust/WASM simulation;
- test scenes use fresh disposable state;
- tools are development-only and stay out of the production entry graph;
- every meaningful experiment can emit evidence with source/WASM provenance;
- tool navigation should carry the selected civilization/unit context where practical.

## Hard boundaries

Do not:

- mutate the frozen showcase to make a tool easier to build;
- expose workshop-only mutation functions in production WASM;
- treat a staged animation pose as proof that real combat timing works;
- call a viewport test hardware-performance evidence;
- duplicate authoritative costs, prerequisites or combat values in TypeScript.

## Done means

A new Workshop capability is not done until it:

1. uses the real renderer/simulation or documents why it cannot;
2. has disposable/repeatable state;
3. exposes enough evidence to reproduce the result;
4. works at the supported desktop/phone/tablet viewport checks;
5. passes `npm run verify:workshop` and browser verification when applicable.

See [`HOWTO.md`](HOWTO.md) for the implementation sequence.
