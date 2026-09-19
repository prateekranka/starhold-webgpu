# Directive — Starhold

Verbatim asks from the user (2026-09-12), plus the agent roster. This file is the
contract every worker reads. Do not paraphrase away requirements.

## The ask

> Use Dream Loop Plus to build me a graphics demo: isometric camera, and pixel art
> style shading, a space civilization in the middle of building itself up. Fantasy
> setting (think age of empires in space, starcraft). WASM and WebGPU in browser,
> >60fps. Controls: click to select a unit or building, camera can be rotated 90
> degrees at a time by the user by clicking a button; zoom in/out using +/- buttons.
> World should feel alive and bustling: motion, attack animations, subtle
> environmental behaviors.

Follow-on direction (2026-09-13):

> i want the next pass to be a lighting/contrast pass but i also want this world
> to be defined going forward. i like the current look of the map and civ and we
> should standardize units and buildings by civ. show me what units and buildings
> a user will start with. let's do 2 full civilizations first

`docs/CIVILIZATIONS.md` is the binding roster and start contract.
`docs/LIGHTING_CONTRAST_SPEC.md` is the binding next-pass contract. Preserve the
current map and Dawnward visual language while these two civilizations are built.

## Agent roster (user-specified)

1. **Planning**: Astra high + fast (gpt-6-astra, reasoning high, fast mode).
2. **Main orchestrator**: deepseek flash (the Hermes session agent). Orchestrates,
   validates, fixes integration bugs. Does NOT implement features.
3. **Coding subagents**: Astra medium (gpt-6-astra, reasoning medium). Fresh context
   per run. No forking. Implement only — do NOT test/validate (orchestrator does that).

## Autonomous Dream Loop — 2026-09-19

The current user direction supersedes the orchestrator row above for this loop:

> i have 20% weekly usage remaining and it resets in 5 hrs. take the time to have
> sol xhigh be the orchestrator and astra medium be the artistic hand that makes
> this game fantastic to look at and play. use the typesafe skill to play the game
> and fix any issues there. i'll check back in 5 hrs. let's see what you can get
> done. make it a self bettering loop

For this bounded loop, GPT-5.6 Sol at xhigh reasoning owns design, gameplay,
validation, commits, and acceptance. Fresh GPT-6 Astra workers at medium reasoning
implement one visual or interaction pass at a time and stop before testing. The
binding loop and preservation rules are in `docs/DREAM_LOOP_SPEC.md`.

## Hard requirements

- Runs in a browser. Uses **WASM** (Rust simulation) and **WebGPU** (rendering).
- **>60 fps**.
- Isometric camera; 90-degree rotation per button click; zoom in/out via +/- buttons.
- Click selects a unit or a building.
- Pixel-art shading. Space civilization visibly building itself up.
- The world reads as ALIVE: continuous motion, attack animations, ambient
  environmental behavior.

## Delivery

- Local dev server + a reproducible headless capture (screenshots + fps + console
  errors) proving the requirements.
- Evidence screenshots committed under `docs/shots/`.
