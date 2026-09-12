# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**Mobile pass M1 — DONE and verified (16/16 phone, 17/17 tablet, 18/18 portrait,
7/7 desktop regression). Next: pass 15 (macro depth) on remaining Plus quota.**

## Latest verified state — mobile pass M1

Implementation commit `5007a1d` (`mobile: responsive touch layout, safe areas and
pinch zoom`), spec `docs/MOBILE_SPEC.md`, harness commit `scripts/capture.mjs`.

| Viewport | Mode | Result |
|---|---|---|
| 844x390, dsf 2 | touch landscape | **17/17 gates PASS** |
| 1024x768, dsf 2 | touch tablet | **17/17 gates PASS** |
| 390x844 -> 844x390, dsf 2 | portrait then rotate | **18/18 gates PASS** |
| 960x540 | desktop regression | **7/7 gates PASS** |

- Build: **PASS** (`npm run build`, tsc clean).
- Hardware WebGPU: **60.3 fps**, p95 **16.9 ms**, max 18.3 ms at every mobile viewport.
- Touch: tap clears selection, tap selects, rotate taps step yaw exactly one
  quarter turn, zoom taps step one magnification, two-finger pinch steps exactly
  one zoom level and never changes the selection, tap after pinch works.
- Touch targets: 4 buttons at **48x48 CSS px**, no overlap, independent of the
  canvas scale. Simulated 44 px notch insets: canvas and buttons stay inside.
- Palette: phone/tablet/desktop frames have **31 distinct colours, 0 outside the
  32-colour palette** — the canvas stays nearest-neighbour and pixel-sharp.
  The portrait rotate notice is DOM text and is palette-exempt by spec.
- Determinism: raw-WASM replay unchanged —
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- In-canvas button cluster is hidden on touch (DOM cluster replaces it);
  desktop keeps the drawn cluster.
- Evidence: `evidence-mobile/phone|tablet|portrait|desktop/`.

## How to play on a phone or tablet

1. Join the tailnet, then open `https://bobby.taile5de76.ts.net:8446/` in
   Safari (iOS 18+) or Chrome (Android, WebGPU required).
2. Hold the device in **landscape**. Portrait shows a ROTATE TO LANDSCAPE notice.
3. Tap a unit or building to inspect it; tap empty terrain to clear.
4. Bottom-right buttons: rotate left, rotate right, zoom out, zoom in.
5. Pinch with two fingers to zoom in or out (one level per pinch step).

## Visual gate — still FAIL, pass 15 next

The amethyst ground has fine texture, but the settlement still reads as one broad
low platform: weak internal terraces, few functional prop clusters, little
facade-scale detail. Cliff ramp lower/upper `0.882` (target <= `0.85`).
Pass 15 is specified in `tasks/brief-pass15.md` and runs next.

## Resume checklist (pass 15)

1. Confirm Plus quota: `python3 tasks/quota-check.py`.
2. Launch in a fresh context:
   `bash tasks/astra-run.sh coder tasks/brief-pass15.md tasks/logs/pass15-retry.log`.
3. Worker must be GPT-6 Astra Medium, standard mode, `fast_mode=false`.
4. Orchestrator: `npm run build`, then
   `node scripts/capture.mjs --root dist --out evidence-p15 --min-fps 60 --settle 108`.
5. `python3 scripts/measure-detail.py evidence-p15/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430`.
6. Fresh critic, then continue from the single largest visible gap. Never Pro.

## Binding and verification files

- `docs/DIRECTIVE.md`, `docs/INTERFACE.md`, `docs/WORLD_PLAN.md`, `docs/MOBILE_SPEC.md`.
- `.dream-loop/target.png` — target at tick 6480.
- `scripts/capture.mjs` — runtime, controls, mobile, performance and determinism gates.
- `scripts/measure-detail.py` — grid, palette, texture, slab and cliff-ramp metrics.
- `tasks/vision-critic.py` — raw DeepSeek comparative vision gate.
- `tasks/astra-run.sh` — Plus-only fresh-context runner; fast mode disabled.

## Agent settings

- Coding worker: GPT-6 Astra, reasoning `medium`, `fast_mode=false`.
- Astra CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus home: `~/.codex-linux`.
- WebGPU capture: Playwright headless shell through Intel gen-9 Vulkan/ANGLE.
