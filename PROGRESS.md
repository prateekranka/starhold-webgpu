# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**IN DREAM LOOP — pass 15 (macro depth and lived-in settlement density) ready.**

## Latest verified state — pass 14

Implementation commit `549b55e` (`art: pass 14 — authored basalt texture and restored
cliff ramp`).

- Build: **PASS**.
- Browser/runtime: **7/7 gates PASS**.
- Hardware WebGPU: **60.3 fps**, p95 **17.1 ms**, max **17.9 ms**.
- Rotate, zoom, selection: PASS. Console errors: none.
- Exact deterministic raw-WASM replay matches:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- True 1 px grid: PASS (`identical_h_pairs=0.9025`).
- Palette: 31 permitted colours; no expansion.
- Texture gate: **PASS** — density `0.2315`; largest `#624779` region `2,210 px`;
  largest `#3C3057` region `1,131 px`.
- Cliff ramp: **FAIL, close** — lower/upper `0.882`, slope `-0.125/row`.
- Evidence: `evidence-p14/`.

## Current visual gate — FAIL

Both independent critics and direct inspection agree: the amethyst material now has
small-scale breakup, but it repeats evenly over one broad level. The world still lacks
macro elevation structure, meaningful settlement prop clusters, and facade-scale life.
It reads as a clean vertical slice, not a lived-in AoE2:DE settlement.

Pass 15 (`tasks/brief-pass15.md`) is the final high-impact pass for this Plus window:

- render existing terrain height differences as internal retaining faces and ramps;
- add functional prop clusters around forge, depot, barracks, Bastion and crystal garden;
- add facade doors/windows/ladders/pipes/banners/trim to existing buildings;
- darken the outer cliff base enough to restore lower/upper ≤0.85;
- preserve gameplay, terrain texture metrics, units, roads, camera and performance.

## Structural work verified

1. Fixed-60-Hz deterministic Rust/WASM sim, raw WebGPU renderer, HUD and controls.
2. Buildings, staged construction, resource routes, raids, projectiles and selection.
3. Distinct factions, unit silhouettes, combat formations and effects.
4. 960×540 true-1-px internal render grid.
5. Fixed top-left directional light, hard contact/drop shadows.
6. Four-step outer cliff ramp with numeric slope gate.
7. Authored amethyst material with numeric density and connected-slab gates.
8. Exact raw-WASM state hash gate.
9. Uncapped headroom probe: 515.4 fps at old grid; current grid stable at 60.3 fps.
10. Two independent critics: raw DeepSeek target-vs-build and Cursor Auto build-only.

## Loop procedure

1. `python3 tasks/quota-check.py`; stop at `allowed=False` / 100%; never use Pro.
2. Fresh worker: `bash tasks/astra-run.sh coder tasks/brief-passN.md tasks/logs/passN.log`.
3. Worker = GPT-6 Astra Medium, standard mode, `fast_mode=false`.
4. Orchestrator builds and runs `scripts/capture.mjs` at t=108 s.
5. Run `scripts/measure-detail.py` with the canonical bands.
6. Run fresh raw DeepSeek and Cursor Auto critics.
7. Iterate on the single biggest gap; update this file and commit evidence.

## Binding files

- `docs/DIRECTIVE.md`, `docs/INTERFACE.md`, `docs/WORLD_PLAN.md`.
- `.dream-loop/target.png` — target at tick 6480.
- `scripts/capture.mjs`, `scripts/measure-detail.py`, `scripts/headroom-probe.mjs`.
- `tasks/vision-critic.py`, `tasks/astra-run.sh`.

## Quota / environment

- Plus after pass 14 validation: **92% primary used**, allowed; ~227 minutes to reset.
- Astra Codex CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus home: `~/.codex-linux`.
- WebGPU capture: Playwright headless shell, Intel gen-9 Vulkan/ANGLE.
