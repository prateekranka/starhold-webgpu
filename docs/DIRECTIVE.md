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

## Agent roster (user-specified)

1. **Planning**: Astra high + fast (gpt-6-astra, reasoning high, fast mode).
2. **Main orchestrator**: deepseek flash (the Hermes session agent). Orchestrates,
   validates, fixes integration bugs. Does NOT implement features.
3. **Coding subagents**: Astra medium (gpt-6-astra, reasoning medium). Fresh context
   per run. No forking. Implement only — do NOT test/validate (orchestrator does that).

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
