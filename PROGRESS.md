# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**IN DREAM LOOP — pass 10 (combat formation spacing) dispatched 2026-09-12.**

## Verified state (pass 9)

Implementation `51d2a63` ("art: pass 9 — countable spaced combat actors"), verified by
orchestrator commit `6ac96b8`. Fresh standard-mode Astra run (`fast=false`, Plus account):

- `npm run build`: PASS.
- Browser/runtime harness: **7/7 gates PASS**.
- WebGPU frame rate: **60.3 fps**, p95 **17.0 ms**, max 17.5 ms.
- Camera rotate button: PASS (yaw 0 -> 1). Zoom buttons: PASS (1 -> 0.8 -> 1).
- Click selection: PASS. Console errors: none.
- Determinism: two raw WASM replays matched exactly:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- Evidence: `evidence-p9/`.

## Visual gate

Latest fresh Cursor Auto critic verdict on pass 9: **FAIL**.

> The red cluster collapses into one dark blob on purple terrain so you cannot
> count or silhouette-read individuals at combat density.

Passes 7–9 already added brighter hostile colors, dark whole-body contours, larger
silhouettes, forward tips, and small renderer-only offsets. More outline or size is
not the root fix — bodies physically overlap. The fix must come from deterministic
formation spacing in the simulation (`tasks/brief-pass10.md`).

## Completed passes

1. Foundation: deterministic sim, WebGPU renderer, HUD, camera, selection.
2. Partial density pass (earlier quota interruption).
3. Buildings, construction, terrain detail, unit poses, combat effects.
4. Visible raid, stronger terrain faces, ambient life, selection HUD.
5. Separated raid formation and readable combat exchange.
6. Distinct combat-role silhouettes.
7. Higher faction contrast and unit rims.
8. Larger, brighter friendly combat tokens.
9. Renderer-side countable spaced combat actors (offsets, scale, contours).
10. Dispatched: deterministic 1.25-tile Jackal formation slots, 1.1-tile friendly
    spacing, sim/renderer position parity.

## Loop procedure (orchestrator)

1. `python3 tasks/quota-check.py` — stop at allowed=False / 100%.
2. Dispatch one fresh coder context:
   `bash tasks/astra-run.sh coder tasks/brief-passN.md tasks/logs/passN.log`.
3. `npm run build`.
4. `node scripts/capture.mjs --root dist --out evidence-pN --min-fps 60 --settle 108`.
5. Fresh blind screenshot critic (`cursor-agent --trust --print --model Auto`).
6. Iterate on the single biggest gap; update this file and commit after verified work.

## Binding files

- `docs/DIRECTIVE.md` — product contract.
- `docs/INTERFACE.md` — ABI, `window.__APP`, controls, and performance contract.
- `docs/WORLD_PLAN.md` — world plan, opening schedule, and exact 32-color palette.
- `.dream-loop/target.png` — aspirational target at tick 6480.
- `scripts/capture.mjs` — browser controls, screenshots, performance, console, and
  exact-tick raw-WASM determinism gates.
- `tasks/astra-run.sh` — fresh-context Astra runner, defaulted to Plus account home.

## Environment

- Astra-compatible Codex CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus account home: `~/.codex-linux`.
- Rust 1.98.1 with `wasm32-unknown-unknown`.
- WebGPU validation uses Playwright Chromium headless shell with Vulkan/ANGLE.
- Full Chromium returns no WebGPU adapter on this host.
- Screenshot critic lane: `cursor-agent` (Auto). Zen DeepSeek vision lane is
  quota-blocked; named Grok models are unavailable on the current Cursor plan.
