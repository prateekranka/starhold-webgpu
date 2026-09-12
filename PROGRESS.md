# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**IN DREAM LOOP — pass 14 (authored terrain texture and restored cliff depth) dispatched.**

## Latest verified state — pass 13

Implementation commit `522eed7` (`art: pass 13 — layered amethyst terrain regions and
perimeter detail`).

- `npm run build`: **PASS**.
- Browser/runtime harness: **7/7 gates PASS**.
- Hardware WebGPU: **60.3 fps**, p95 **17.2 ms**, max **20.8 ms**.
- Rotate, zoom, click selection: PASS. Console errors: none.
- Exact deterministic raw-WASM replay still matches:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- Pixel grid: true 1 px grid (`identical_h_pairs=0.9287`).
- Palette: 31 permitted colours visible; no expansion.
- Evidence: `evidence-p13/`.

## Current visual gate — FAIL

Pass 13 corrected the material direction: the plateau is now recognizably amethyst,
roads stay traceable, and perimeter crystals/ruins/haze are present. It did not create
small-scale terrain richness. Two independent critics agree that the ground remains
large empty slabs without enough wear, clutter, or contact texture.

Objective art metrics confirm the critique:

- horizontal transition density: **0.1681** (pass target: 0.20–0.28);
- largest connected `#624779` slab: **21,015 px** (target <8,000);
- largest connected `#3C3057` slab: **8,898 px** (target <6,000);
- cliff lower/upper: **0.914**, slope `-0.100/row` (**FAIL**; pass 12 had 0.828).

Pass 14 (`tasks/brief-pass14.md`) must break the slabs into deterministic authored
material clusters and restore the pass-12 cliff ramp. It must not change units,
buildings, gameplay, camera, HUD, lighting direction or resolution.

## Structural improvements already verified

1. Deterministic fixed-60-Hz Rust/WASM sim; raw WebGPU renderer; HUD and controls.
2. Building/construction detail, resource routes, raids and projectile combat.
3. Distinct factions, unit roles, silhouettes, combat formations and effects.
4. True 960×540 internal render grid (was 480×270 scaled 2×).
5. Fixed top-left directional light, hard contact/drop shadows.
6. Four-step downward cliff value ramp (passed in pass 12; regressed in pass 13).
7. Exact raw-WASM state hash gate.
8. Uncapped hardware headroom probe: **515.4 fps**, p95 **3.2 ms** at the old grid;
   the 960×540 build remains vsync-stable at 60.3 fps.
9. Two independent visual gates: raw DeepSeek target-vs-build and Cursor Auto build-only.
10. Automated pixel-grid, palette, cliff-ramp, texture-density and connected-slab metrics.

## Loop procedure

1. `python3 tasks/quota-check.py` — stop at `allowed=False` / 100%; never switch to Pro.
2. Launch one fresh coding context:
   `bash tasks/astra-run.sh coder tasks/brief-passN.md tasks/logs/passN.log`.
3. Worker: GPT-6 Astra Medium, standard mode, `fast_mode=false`.
4. Orchestrator: `npm run build`.
5. Orchestrator: `node scripts/capture.mjs --root dist --out evidence-pN --min-fps 60 --settle 108`.
6. Metrics:
   `python3 scripts/measure-detail.py evidence-pN/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430`.
7. Fresh raw DeepSeek target-vs-build critic and Cursor Auto build-only critic.
8. Name one biggest gap, iterate, update this file, and commit verified work.

## Binding files

- `docs/DIRECTIVE.md` — product contract.
- `docs/INTERFACE.md` — ABI, `window.__APP`, controls, performance contract.
- `docs/WORLD_PLAN.md` — exact world plan and 32-color palette.
- `.dream-loop/target.png` — target at tick 6480.
- `scripts/capture.mjs` — browser/runtime verification.
- `scripts/measure-detail.py` — pixel grid, palette, ramp, texture and slab metrics.
- `scripts/headroom-probe.mjs` — uncapped performance probe.
- `tasks/vision-critic.py` — raw DeepSeek comparative visual critic.
- `tasks/astra-run.sh` — Plus-only fresh-context runner; fast mode disabled.

## Quota / environment

- Plus after pass 13: **67% primary used**, allowed; ~237 minutes to reset.
- Astra Codex CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus home: `~/.codex-linux`.
- WebGPU capture: Playwright Chromium headless shell, Intel gen-9 Vulkan/ANGLE.
- Named Cursor Grok is plan-gated; Cursor Auto is available.
