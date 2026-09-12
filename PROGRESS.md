# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**Mobile pass M1 and art pass 15 are DONE and verified. The next wave is a
lighting/contrast pass (see "Remaining gap").**

## Verified state — mobile M1 + pass 15

| Piece | Commit | Result |
|---|---|---|
| Mobile spec | `docs/MOBILE_SPEC.md` (commit `ce112da`) | binding contract |
| Mobile implementation | `5007a1d` | responsive touch layout, safe areas, pinch zoom |
| Mobile harness + evidence | `ce112da` | 10 new gates, all viewports |
| Pass-15 art | `ffa1905` | terraces, prop clusters, facade detail, cliff ramp |
| Integration fixes | this commit | instance cap, void-colour clamp, saturation gate |

Final-build verification (same build as the live URL):

| Viewport | Mode | Gates |
|---|---|---|
| 844x390, dsf 2 | touch landscape | **18/18 PASS** |
| 1024x768, dsf 2 | touch tablet | **18/18 PASS** |
| 390x844 -> 844x390, dsf 2 | portrait, then rotate | **19/19 PASS** |
| 960x540 | desktop regression | **8/8 PASS** |

- Build: **PASS**. Hardware WebGPU: **60.3 fps**, p95 **16.9-17.3 ms**, max 18.3 ms.
- Determinism: raw-WASM replay `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`
  — identical to pass 14.
- Palette: desktop, phone and tablet frames have **31 distinct colours, 0 outside
  the palette**. The portrait rotate notice is DOM text and is palette-exempt.
- Grid: 1 px grid (`identical_h_pairs=0.9102`). Canvas backing store 960x540 at
  every viewport; nearest-neighbour upscale only.
- Pass-15 gates: texture density `0.2222` (0.20-0.28 OK), largest `#624779`
  region `2,188 px` (<8,000), largest `#3C3057` region `1,101 px` (<6,000),
  cliff ramp `lower/upper=0.848` (<=0.85 OK), slope `-0.165/row` (negative OK).
- Instance budget: 9,642 instances of 16,000, `saturated=false`.
- Evidence: `evidence-mobile/` (mobile pass) and `evidence-p15/` (pass 15 +
  phone/tablet/portrait on the final build).

### Independent coordinator recheck — 2026-09-13 00:53 IST

- Rebuilt from clean `master` at `0027680`: **PASS**; emitted
  `index-lRyy1alA.js` and `index-Dw_AwUKr.css`.
- Fresh local runs: desktop **8/8**, phone **18/18**, tablet **18/18**, portrait
  **19/19**. All 63 gates passed. FPS was 60.3 in every run; p95 was 18.9 ms
  desktop and 16.9 ms for each touch layout. Console errors: none.
- Fresh live-phone run through `https://bobby.taile5de76.ts.net:8446/`: **18/18**;
  HTTP 200. Live JavaScript SHA-256 `d8795aacd1ab0092b711e696bd47873730ddb14b5a3f382b66e6a015b9fc39e4`
  and CSS SHA-256 `91bdcf2047c44cc05a80632749e0efdeaf5c46c097c0920c4528eed123aac3fd`
  exactly match `dist/`.
- Independent target-vs-build visual gate: **FAIL**. The main gap is macro scale
  and value separation: the settlement is smaller in frame, flatter, darker, and
  less readable than the target. Mobile delivery is accepted; visual parity is not.

### Two integration bugs the worker introduced (fixed here)

1. Pass 15 pushed the instance list past `MAX=8000`, so every late draw (outer
   rim, backdrop, ambient) was **silently dropped** — 17% of the frame. `MAX` is
   now 16,000 and the renderer reports `saturated`, gated by the harness.
2. The new lower-cliff bands were drawn outside the terrain path with pigment 1,
   so shading underflowed to palette index 0 — the background colour. 11,582 px
   of rock turned into sky and the island's base dissolved. Solid geometry now
   clamps at index 1; the thin terrain foot line keeps its old freedom.

## How to play on a phone or tablet

1. Join the tailnet, then open `https://bobby.taile5de76.ts.net:8446/` in Safari
   (iOS 18+) or Chrome (Android); WebGPU must be enabled.
2. Hold the device in **landscape**. Portrait shows a ROTATE TO LANDSCAPE notice.
3. Tap a unit or building to inspect it. Tap empty terrain to clear.
4. Bottom-right: rotate left, rotate right, zoom out, zoom in (48x48 CSS px each).
5. Pinch with two fingers to zoom: one level per pinch step, never selects.

## Remaining gap (name it exactly)

All objective gates pass, but a fresh blind critic still rates the frame **WEAK**
against `.dream-loop/target.png`: the settlement reads flat and uniformly top-lit,
the amethyst terrain is washed out, and units are tiny and hard to read at
960x540. The delta of pass 15 is real but small (~2% of pixels changed: terraces,
8 prop clusters, facade fittings). The next wave must be a **lighting and contrast
pass** — directional light with a darker south-east falloff, fewer top-lit flats,
stronger unit-scale contrast — not another detail pass.

## Resume checklist

1. `git pull` / confirm `git log` head; `python3 tasks/quota-check.py` (Plus only).
2. Write the lighting brief against `docs/WORLD_PLAN.md` light rules.
3. Launch: `bash tasks/astra-run.sh coder tasks/brief-<n>.md tasks/logs/<n>.log`.
4. Orchestrator: `npm run build`, then
   `node scripts/capture.mjs --root dist --out evidence-<n> --min-fps 60 --settle 108`
   and the mobile trio with `--touch --dsf 2` at 844x390, 1024x768 and 390x844.
5. `python3 scripts/measure-detail.py evidence-<n>/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430`
   (all four gates must stay green: grid, colours 31, texture, ramp).
6. Fresh blind critic. Iterate on the single biggest gap. Never the Pro account.

## Agent settings

- Coding worker: GPT-6 Astra, reasoning `medium`, `fast_mode=false`.
- Astra CLI: `~/.local/codex-154/node_modules/.bin/codex`, home `~/.codex-linux`.
- Vision critic: `tasks/vision-critic.py` (raw DeepSeek; `VISION_MAX_TOKENS` for
  long answers). Cursor named models are plan-gated and unavailable.
- WebGPU capture: Playwright headless shell through Intel gen-9 Vulkan/ANGLE.
