# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**PAUSED — Codex Plus five-hour quota exhausted during pass 15.**

## Stop state — 2026-09-12 20:36 IST

- Plus account only (`~/.codex-linux`): `allowed=False`, primary window **100% used**.
- Codex reported retry at **2026-09-13 00:20 IST**.
- No Codex or Astra process remains active.
- Pass 15 reached the quota limit before it edited any file. There is no partial patch.
- Git tree remained clean at verified pass 14.
- Final park build (`npm run build`): **PASS**.

## Latest verified state — pass 14

Implementation commit `549b55e` (`art: pass 14 — authored basalt texture and restored
cliff ramp`). Orchestrator evidence commit `4e61ffe`.

- Build: **PASS**.
- Browser/runtime: **7/7 gates PASS**.
- Hardware WebGPU: **60.3 fps**, p95 **17.1 ms**, max **17.9 ms**.
- Rotate, zoom, selection: PASS. Console errors: none.
- Exact deterministic raw-WASM replay matches:
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- True 1 px grid: PASS (`identical_h_pairs=0.9025`).
- Palette: 31 permitted colours; no expansion.
- Terrain texture: **PASS** — density `0.2315`; largest `#624779` region `2,210 px`;
  largest `#3C3057` region `1,131 px`.
- Cliff ramp: **FAIL, close** — lower/upper `0.882`, slope `-0.125/row`.
- Evidence: `evidence-p14/`.

## Current visual gate — FAIL

The latest independent critics agree: the amethyst ground now has fine texture, but
the settlement still reads as one broad, low platform. It lacks strong internal
terraces, functional prop clusters, and facade-scale life. The single largest gap is
macro depth and lived-in settlement density.

Pass 15 is fully specified in `tasks/brief-pass15.md` but did not run to implementation.
It must:

- render existing height differences as internal retaining faces and ramps;
- add functional prop clusters around forge, depot, barracks, Bastion and crystals;
- add facade doors, windows, ladders, pipes, banners and trim;
- darken the outer cliff base enough to reach lower/upper ≤0.85;
- preserve gameplay, unit art, roads, terrain texture metrics, camera and performance.

## Resume checklist

1. Confirm Plus quota: `python3 tasks/quota-check.py`.
2. Confirm clean tree: `git status --short`.
3. Launch pass 15 in a **fresh** context:
   `bash tasks/astra-run.sh coder tasks/brief-pass15.md tasks/logs/pass15-retry.log`.
4. Worker must be GPT-6 Astra Medium, standard mode, `fast_mode=false`.
5. Orchestrator runs `npm run build`.
6. Orchestrator runs:
   `node scripts/capture.mjs --root dist --out evidence-p15 --min-fps 60 --settle 108`.
7. Run:
   `python3 scripts/measure-detail.py evidence-p15/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430`.
8. Run fresh raw DeepSeek target-vs-build and Cursor Auto critics.
9. Continue from the single largest visible gap. Do not switch to Pro.

## Binding and verification files

- `docs/DIRECTIVE.md`, `docs/INTERFACE.md`, `docs/WORLD_PLAN.md`.
- `.dream-loop/target.png` — target at tick 6480.
- `scripts/capture.mjs` — runtime, controls, performance and determinism gates.
- `scripts/measure-detail.py` — grid, palette, texture, slab and cliff-ramp metrics.
- `scripts/headroom-probe.mjs` — uncapped GPU headroom probe.
- `tasks/vision-critic.py` — raw DeepSeek comparative vision gate.
- `tasks/astra-run.sh` — Plus-only fresh-context runner; fast mode disabled.

## Agent settings

- Coding worker: GPT-6 Astra, reasoning `medium`, `fast_mode=false`.
- Astra CLI: `~/.local/codex-154/node_modules/.bin/codex`.
- Plus home: `~/.codex-linux`.
- WebGPU capture: Playwright headless shell through Intel gen-9 Vulkan/ANGLE.
