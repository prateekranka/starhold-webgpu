# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**PAUSED — Codex Plus five-hour quota exhausted on 2026-09-12.**

## Stop state

- Codex account used for this exercise: Plus only (`~/.codex-linux`).
- Plus primary window: **100% used**. Codex reported retry at 19:15 IST.
- No Codex process or Astra runner remains active.
- Pass 9 stopped during `src/renderer.ts` edits. The partial edit did not compile:
  `Property 'STORAGE' does not exist on type ...`.
- The invalid edit was saved as `tasks/logs/pass9-interrupted.patch`, then reverted.
- The repository is back at verified pass 8.

## Final verified state

Orchestrator verification after the rollback:

- `npm run build`: PASS.
- Browser/runtime harness: **7/7 gates PASS**.
- WebGPU frame rate: **60.3 fps**, p95 **17.0 ms**.
- Camera rotate button: PASS.
- Zoom buttons: PASS.
- Click selection: PASS.
- Console errors: none.
- Determinism: two raw WASM replays matched exactly:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- Final evidence: `evidence-final/`.

## Visual gate

Latest fresh Cursor Auto critic verdict on pass 8: **FAIL**.

Single biggest gap: combat units remain too small and blob-like in a packed group.
They need larger whole-body silhouettes, a clear head/front tip, and stable dark
separation between adjacent actors.

Pass 9 was intended to make that correction. Its incomplete patch is preserved but
must not be applied without review. It contains a broken `GPUBufferUsage.STORAGE`
reference in a local test shim and did not reach the required type check or commit.

## Completed passes

1. Foundation: deterministic sim, WebGPU renderer, HUD, camera, selection.
2. Partial density pass (earlier quota interruption).
3. Buildings, construction, terrain detail, unit poses, combat effects.
4. Visible raid, stronger terrain faces, ambient life, selection HUD.
5. Separated raid formation and readable combat exchange.
6. Distinct combat-role silhouettes.
7. Higher faction contrast and unit rims.
8. Larger, brighter friendly combat tokens.
9. Interrupted at Plus quota limit; invalid partial edit reverted and archived.

## Resume checklist

1. Confirm Plus quota: `python3 tasks/quota-check.py`.
2. Start from verified pass 8, not the interrupted working edit.
3. Review `tasks/brief-pass9.md` and `tasks/logs/pass9-interrupted.patch`.
4. Use a fresh coding context. Implement pass 9 cleanly; do not resume the failed run.
5. Orchestrator runs:
   `npm run build`
6. Orchestrator runs:
   `node scripts/capture.mjs --root dist --out evidence-p9 --min-fps 60 --settle 108`
7. Run a fresh blind critic on `evidence-p9/shot-main.png`.
8. Iterate only if the critic still returns FAIL.

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
