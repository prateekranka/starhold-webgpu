# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**IN DREAM LOOP — pass 13 (amethyst terrain language) ready to dispatch.**

## Latest verified state — pass 12

Implementation commit `6f45d5f` (`render: pass 12 — lit terrain ramp, contact
shadows, unit rescale`).

- `npm run build`: **PASS**.
- Browser/runtime harness: **7/7 gates PASS**.
- Hardware WebGPU: **60.3 fps**, p95 **17.2 ms**, max **19.3 ms**.
- Rotate button: PASS (`0 → 1`).
- Zoom buttons: PASS (`1 → 0.8 → 1`).
- Click selection: PASS. Console errors: none.
- Exact determinism: two raw-WASM replays match:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- Pixel grid: true 1 px grid (`identical_h_pairs=0.9252`; pass 9 was 1.0000 / 2 px blocks).
- Palette: 31 of the 32 permitted colors visible; no palette expansion.
- Cliff ramp objective gate: **PASS** — lower/upper `0.828`, vertical slope
  `-0.239 luminance/row` (pass-11 baseline was `1.007`, `+0.010`).
- Evidence: `evidence-p12/`.

## Current visual gate

Two fresh independent critics still return **FAIL**:

- Raw DeepSeek vision, target-vs-build: the broad plateau top still reads as a flat,
  uniform gray surface instead of the target's layered amethyst frontier.
- Cursor Auto: units remain smaller and less readable than AoE2:DE tokens.

Orchestrator judgment: fix terrain first. It occupies most of the image and currently
outweighs the otherwise clear buildings and separated units. Pass 13 is specified in
`tasks/brief-pass13.md`: purple-basalt material regions, authored surface clusters,
lit rim accents, perimeter crystals, and sparse foreground landmarks. It must preserve
the verified pass-12 cliff ramp, lighting, units, gameplay and performance.

## Structural improvements already verified

1. Deterministic fixed-60-Hz Rust/WASM sim; raw WebGPU renderer; HUD and controls.
2. Building/construction detail, resource routes, raid and projectile combat.
3. Distinct factions, unit roles, silhouettes, combat formation and effects.
4. True 960×540 internal render grid (was 480×270 scaled 2×).
5. Fixed top-left directional light, hard contact/drop shadows.
6. Four-step downward cliff value ramp with an objective numeric gate.
7. Exact raw-WASM state hashing in the capture harness.
8. Uncapped hardware headroom probe: **515.4 fps**, p95 **3.2 ms** at the old grid;
   the 960×540 build remains vsync-stable at 60.3 fps.
9. Second independent visual gate: `tasks/vision-critic.py` sends target + actual
   directly to DeepSeek vision. Cursor Auto remains the second opinion.

## Loop procedure

1. `python3 tasks/quota-check.py` — stop at `allowed=False` / 100%. Do not switch to Pro.
2. Launch one fresh coding context:
   `bash tasks/astra-run.sh coder tasks/brief-passN.md tasks/logs/passN.log`.
3. Coding workers: GPT-6 Astra Medium, standard mode, `fast_mode=false`.
4. Orchestrator: `npm run build`.
5. Orchestrator: `node scripts/capture.mjs --root dist --out evidence-pN --min-fps 60 --settle 108`.
6. Objective art metrics:
   `python3 scripts/measure-detail.py evidence-pN/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430`.
7. Fresh raw DeepSeek target-vs-build critic and Cursor Auto build-only critic.
8. Name one biggest gap and iterate. Update this file and commit verified work.

## Binding files

- `docs/DIRECTIVE.md` — product contract.
- `docs/INTERFACE.md` — ABI, `window.__APP`, controls, performance contract.
- `docs/WORLD_PLAN.md` — exact world plan and 32-color palette.
- `.dream-loop/target.png` — target at tick 6480.
- `scripts/capture.mjs` — browser/runtime verification.
- `scripts/measure-detail.py` — pixel-grid, palette and cliff-ramp metrics.
- `scripts/headroom-probe.mjs` — uncapped hardware performance probe.
- `tasks/vision-critic.py` — raw DeepSeek comparative vision critic.
- `tasks/astra-run.sh` — Plus-only fresh-context worker runner; fast mode disabled.

## Quota / environment

- Last Plus check after pass 12: **53% primary used**, allowed; reset in ~244 minutes.
- Astra Codex CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus home: `~/.codex-linux`.
- WebGPU capture: Playwright Chromium headless shell through Intel gen-9 Vulkan/ANGLE.
- Named Cursor Grok is plan-gated; Cursor Auto is available.
