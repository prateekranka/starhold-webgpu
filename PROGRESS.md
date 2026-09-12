# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and raw WebGPU renderer.

**Two playable civilizations are defined. Pass 16 was rejected. Pass 17 is the
active lighting correction. The phone URL remains on verified pass 15.**

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

## Civilization lock — first two

`docs/CIVILIZATIONS.md` is now binding. It preserves the Vesper March map and
current Dawnward art while standardizing eight buildings and seven units for each
playable civilization.

- **Dawnward start:** Charter Keep, Freight Court, Heliowell; 6 Riveters,
  1 Pack Beetle, 2 Ward Sentinels, 1 Harbor Skiff.
- **Cinderwake start:** Pyre Ark, Scrap Maw, Ember Siphon; 6 Ashhands,
  1 Chain Mule, 2 Ash Jackals, 1 Sootwing.
- Both starts have 80 Alloy, 40 Charge, and 11/15 population. No tower,
  production hall, support unit, or siege unit is prebuilt.
- The current t=108 Dawnward autonomous scene remains a separate showcase and
  keeps its verified simulation hash.
- No third civilization begins until both factions have 8/8 buildings, 7/7
  units, complete economy/combat chains, deterministic starts, and distinct
  normal-zoom silhouettes.

## Active next piece — pass 17 selective key-light lift

Binding spec: `docs/LIGHTING_CONTRAST_SPEC.md`. Corrective worker brief:
`tasks/brief-pass17.md`.

Pass 16 (`4f7b483`) passed 8/8 runtime gates at 60.3 fps and preserved exact
simulation state, palette, texture, cliffs, and instance capacity. It failed the
lighting gate and blind critic. It changed 2.0255% of pixels; 71.648% of those
became darker. Mean fell to 80.981 and midtone share fell to 30.148%. DeepSeek
selected pass 15 as the better image. Evidence is in `evidence-p16/`.

Pass 17 keeps pass 16's world-fixed face and cast direction. It can only lift
normal structural stone, top/key-facing material planes, and existing actor
highlights. It restores pass-15 Hearth values. It cannot alter terrain, geometry,
map coverage, camera, simulation, controls, or palette.

The live Tailnet route no longer reads mutable repo `dist/`. It proxies port 5200,
which serves the frozen pass-15 artifact at
`/home/bobbyranka/.starhold-live/pass15`. The exact live JavaScript and WASM
hashes match that directory, WASM is `application/wasm`, and a fresh phone run
through the route passed 18/18 gates.

## Remaining gap (name it exactly)

The shipping functional, mobile, palette, texture, cliff, and performance gates pass,
but the new lighting gate and a fresh blind critic both **FAIL**. Against
`.dream-loop/target.png`, the settlement reads flat and uniformly top-lit, the
amethyst terrain lacks value hierarchy, and units are hard to read at 960x540.
The next wave is the locked **lighting and contrast pass** — world-fixed
north-west light, darker south-east faces, clearer building hierarchy, and
stronger unit-scale contrast — not another detail pass.

## Resume checklist

1. Confirm clean tree and Plus quota: `git status --short`; `python3 tasks/quota-check.py`.
2. Launch one fresh worker:
   `bash tasks/astra-run.sh coder tasks/brief-pass17.md tasks/logs/pass17.log`.
3. Worker uses GPT-6 Astra Medium, standard mode, `fast_mode=false`, and edits only
   `src/renderer.ts`.
4. Orchestrator runs `npm run build`, then desktop capture into `evidence-p17/`.
5. Orchestrator runs:
   `python3 scripts/measure-detail.py evidence-p17/shot-main.png --top 230 265 --rim 350 465 --x0 180 --x1 430 --lighting-gate`.
6. Only after desktop metrics pass, run all mobile profiles, four-yaw visual checks,
   and a fresh target-vs-build blind critic.
7. On a loss, keep the frozen pass-15 phone release and name one root gap. Never
   use the Pro account. Do not start civilization implementation until lighting
   L1 is judged.

## Agent settings

- Coding worker: GPT-6 Astra, reasoning `medium`, `fast_mode=false`.
- Astra CLI: `~/.local/codex-154/node_modules/.bin/codex`, home `~/.codex-linux`.
- Vision critic: `tasks/vision-critic.py` (raw DeepSeek; `VISION_MAX_TOKENS` for
  long answers). Cursor named models are plan-gated and unavailable.
- WebGPU capture: Playwright headless shell through Intel gen-9 Vulkan/ANGLE.
