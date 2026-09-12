# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, WASM sim + WebGPU renderer.
Dream Loop Plus run, started 2026-09-12. **PAUSED — Pro account Codex quota exhausted.**

## STOPPED HERE (2026-09-12 ~12:50 IST)

Both Codex accounts are at 100% of their primary window:

| Account | Plan | Resets |
|---|---|---|
| chatgpt-pro (`~/.codex-astra`, for `gpt-6-astra`) | prolite | **Tue 2026-09-15 15:55 IST** |
| chatgpt-plus | plus | Sat 15:19 IST (5-hour window); secondary 84% used |

The Pro account also meters `GPT-5.3-Codex-Spark` separately (allowed, 0% used) —
verified reachable with `-m gpt-5.3-codex-spark` if a stopgap coder is ever wanted.

Everything is committed; nothing is running. Resume by clearing the block below.

## Resume checklist

1. Confirm quota: `python3 /tmp/codex_quota_full.py` (or the query in `docs/NOTES-codex.md`).
2. If `~/.codex-astra/auth.json` 401s, re-seed: the access token in that file is good to
   **2026-09-16 22:56**; refresh tokens in the pool are rotated, so prefer copying the
   current `access_token` from the `chatgpt-pro` pool entry and keep the existing
   `id_token` (already written, structurally valid).
3. Launch pass 3:
   `cd ~/Cowork/starhold && nohup bash tasks/astra-run.sh coder tasks/brief-pass3.md tasks/logs/pass3.log &`
   (write `brief-pass3.md` first — pass 2 was cut off mid-edit, so pass 3 must
   finish the density work listed in `tasks/brief-pass2.md`.)
4. Validate: `npm run build && node scripts/capture.mjs --root dist --out evidence-p3 --min-fps 60`
5. Compare `evidence-p3/shot-main.png` against `.dream-loop/target.png`; iterate.

## Roster (user-specified)

| Role | Model | Status |
|---|---|---|
| Planning | gpt-6-astra, reasoning high, fast | DONE — `docs/WORLD_PLAN.md` + `.dream-loop/target-prompt.md` |
| Target image | gpt-6-astra (image gen) | DONE — `.dream-loop/target.png` (1672x941) |
| Orchestrator | deepseek flash (Hermes session) | this session |
| Coding | gpt-6-astra, reasoning medium, fast | pass 1 DONE, pass 2 PARTIAL (quota) |

## What the demo does today (all validated)

Harness: **7/7 gates** — boots (41 entities), fps 60.3 (p95 17.1 ms), rotate button,
zoom buttons, click-select, no console errors, determinism across two loads.

- Rust sim → `public/sim.wasm` (raw `extern "C"` ABI, no wasm-bindgen), fixed 60 Hz,
  seeded PRNG, terrain, staged construction, worker/cargo routes, recurring raids,
  projectile combat, selection retained by stable ID.
- WebGPU renderer (raw WGSL): 480x270 internal, nearest-neighbour upscale, isometric
  camera at 4 yaw steps, 4 zoom steps, 32-colour palette quantisation, bitmap-font HUD.
- DOM controls `#rotate-left/#rotate-right/#zoom-in/#zoom-out` + click selection, with
  `window.__APP` live state (the harness reads it).

Gap to the target (what pass 3 must close): unit/inhabitant readability and count,
building variety (8 types in the plan), ore/crystal/terrain language, combat FX
readability, ambient motion (dust, smoke, glints, drones, freighter), HUD selection
panel detail.

## Artifacts

- `docs/DIRECTIVE.md` — user's asks, verbatim.
- `docs/INTERFACE.md` — binding ABI + `window.__APP` + build commands + perf contract.
- `docs/WORLD_PLAN.md` — world design: 2 factions, 8 buildings, 7 units, 32-colour
  palette, exhaustive motion inventory, opening queue, wave cadence.
- `docs/shots/` — pass-1 and pass-2 evidence screenshots.
- `.dream-loop/target.png` — the dream target (seed 73129, tick 6480, second Bastion
  selected at 71%).
- `scripts/capture.mjs` — validation harness. `tasks/astra-run.sh` — Astra runner.
- `tasks/brief-pass1.md`, `brief-pass2.md` — the coder briefs used so far.

## Environment facts (this Linux box)

- codex CLI 0.154.0 at `~/.local/codex-154/node_modules/.bin/codex`. The mise-installed
  0.152 is too old for `gpt-6-astra` ("requires a newer version of Codex").
- Codex homes: `~/.codex-astra` = Pro (gpt-6-astra works, incl. image gen + vision);
  `~/.codex-linux` = Plus.
- Rust 1.98.1 + `wasm32-unknown-unknown` installed; `cargo` on PATH via `~/.cargo/env`.
- Headless WebGPU: use the Playwright **headless-shell** binary at
  `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`
  with `--enable-features=Vulkan,VulkanFromANGLE --enable-unsafe-webgpu --use-angle=vulkan`.
  The full `chromium-1234/chrome-linux64/chrome` binary returns NO adapter; the shell
  returns Intel gen-9. `scripts/capture.mjs` already prefers the shell.
- rAF is vsync-locked at 60 Hz here, so the fps gate reads "≥59 fps and p95 ≤ 20 ms".
