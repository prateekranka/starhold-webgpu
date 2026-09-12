# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, WASM sim + WebGPU renderer.
Dream Loop Plus run, 2026-09-12.

## Roster (user-specified)

| Role | Model | Status |
|---|---|---|
| Planning | gpt-6-astra, reasoning high, fast | DONE — `docs/WORLD_PLAN.md`, `.dream-loop/target-prompt.md` |
| Target image | gpt-6-astra (image gen) | DONE — `.dream-loop/target.png` (1672x941) |
| Orchestrator | deepseek flash (this session) | running |
| Coding | gpt-6-astra, reasoning medium, fast | pass 1 in flight |

## Artifacts

- `docs/DIRECTIVE.md` — user's asks, verbatim.
- `docs/INTERFACE.md` — binding ABI + `window.__APP` + build commands + perf contract.
- `docs/WORLD_PLAN.md` — world design: 2 factions, 8 buildings, 7 units, 32-color
  palette, motion inventory, opening queue, wave cadence.
- `.dream-loop/target.png` — the dream target (seed 73129, tick 6480, second Bastion
  selected at 71%).
- `scripts/capture.mjs` — orchestrator validation harness (boots, fps, rotate/zoom
  buttons, click-select, determinism, console errors).
- `tasks/astra-run.sh` — Astra runner (Pro account, `~/.codex-astra`).

## Environment facts (this Linux box)

- codex CLI 0.154.0 at `~/.local/codex-154/node_modules/.bin/codex` (0.152 from mise
  is too old for gpt-6-astra).
- Codex auth: `~/.codex-astra/auth.json`, from the `chatgpt-pro` pool entry
  (plan prolite, 66% weekly used at start). The `chatgpt-plus` entry is exhausted.
- Rust 1.98.1 + wasm32-unknown-unknown target installed (`~/.cargo`).
- WebGPU works headless in Chromium with
  `--enable-features=Vulkan,VulkanFromANGLE --enable-unsafe-webgpu --use-angle=vulkan`
  (Intel gen-9 adapter, hardware path).
- Playwright chromium at `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.

## Loop

1. Plan (Astra high) → done.
2. Target image → done.
3. Coder pass (Astra medium) → orchestrator validates with `scripts/capture.mjs`,
   fixes integration bugs, captures screenshots, loops.
4. Browser review by the user after the loop budget is spent.
