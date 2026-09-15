# Starhold — progress

Browser graphics demo: isometric pixel-art space colony, deterministic Rust/WASM
simulation, and a raw WebGPU renderer.

**Wave 2 in flight (2026-09-15): two complete civilizations, age progression,
bottom HUD action bar, portrait play, and unit motion.** Contract:
`docs/MATCH_SPEC.md` (runtime ABI, ages, commands, HUD, portrait) and
`docs/UNIT_DESIGN.md` (silhouettes, motion, sprite/icon pipeline). GitHub:
`prateekranka/starhold-webgpu` (private), pushed on every verified piece.

Workers for wave 2 (one owner per file, orchestrator verifies and commits):

| Piece | Owner | Files |
|---|---|---|
| W2-SIM: match mode, ages, commands, 2 full rosters | Astra xhigh (codex Plus) | `sim/src/lib.rs` |
| W2-RENDER: Cinderwake buildings, new units, idle/attack motion | Astra xhigh (codex Plus) | `src/renderer.ts` |
| W2-HUD: DOM bottom bar, portrait play, `__APP` surface | DeepSeek Flash subagent | `index.html`, `src/style.css`, `src/main.ts`, `src/hud.ts` |
| W2-HARNESS: 10 new gates, iPad portrait mode | DeepSeek Flash subagent | `scripts/capture.mjs` |
| W2-ART: concept sheets via the Plus image tool | Astra medium (codex Plus) | `art/concept/` |

Integration and release rules for wave 2:

- The showcase stays the boot scene. A match starts only from the HUD SKIRMISH
  buttons or `__APP.startMatch(faction)`, so the pass-15 phone build and the
  t=108 benchmark stay valid.
- `sim_init(seed)` and the showcase hash `20b89f84` must not change.
- The public Tailnet route stays on frozen pass 15 until wave 2 passes every
  gate at desktop, iPhone landscape, iPhone portrait, iPad landscape, and iPad
  portrait.
- Image generation is for concept sheets and HUD icons only. In-world rendering
  stays procedural and pixel-exact.

## Expansive world and floating minimap — 2026-09-15

Contract: `docs/LARGEMAP_SPEC.md`. The match runs on a **10.24 km x 10.24 km**
world (1024 x 1024 tiles at 10 m per tile), generated deterministically from the
match seed, and the HUD carries a **floating minimap** that can be moved and
closed.

| Piece | Files | What landed |
|---|---|---|
| World generator | `sim/src/lib.rs` | integer-hash fBm, terraced onto the art's own levels (void -1, land 0/0.5/1); 4 MB heap heightfield (`Vec`, never an inline array — a 4 MB inline array overflows the wasm stack during thread-local init); two-pass pinhole fill |
| World spawns | `sim/src/lib.rs` | both starts spiral-search a 13x13 flat land patch 745 tiles apart (7.45 km); the authored start package is mirrored onto each site; 12 base crystals plus 16 deposits spread over the map |
| New ABI | `sim/src/lib.rs`, `src/hud.ts` | `sim_world_size`, `sim_world_ptr`, `sim_metres_per_tile`, `sim_base_x`, `sim_base_y` — additive only |
| Windowed bake + LOD | `src/renderer.ts` | the static world is baked per camera window in three tiers (full <=170 px, column+cap <=380 px, flat plate beyond), nearest-first, stopped at `BAKE_LIMIT`; `stats.degraded` reports a stop; the camera uniform gained the view centre and the contour pass and `pick` follow it |
| Camera pan | `src/main.ts` | one-finger and mouse drag pan the world; screen pixels convert through the live rotation and magnification; the view stays clamped inside the map; a drag never selects |
| Minimap | `index.html`, `src/style.css`, `src/main.ts` | floating palette-only 2D canvas, drag to move, 24 px close control, `MAP` bar control (44x44) to reopen, tap to centre the camera, 256x256 terrain plate rebuilt per map |
| Gates | `scripts/capture.mjs` | `world-scale`, `world-terrain`, `camera-pan`, `lod-budget`, `minimap-present/move/close/reopen/jump` |

Frozen guarantees held: `sim_init(seed)` and its 32x32 showcase scenario are
byte-identical, so the showcase determinism tuple is still
`{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`. The match hash moved to
`07592fea` because the match map changed.

Measured: instances per zoom 4729 / 5938 / 8366 / 13538 (ceiling 26000, never
saturated or degraded), 60.0-60.3 fps, terrain sample 74.9% land with no level
outside {-1, 0, 0.5, 1}, minimap drag moves the panel by the drag delta, tap
centres the camera on the tapped tile.

### Two integration findings the gates caught

1. **A tall building hides a worker behind it.** The Keep projects its art
   upwards on screen, so a worker standing west of it is drawn behind the
   building and cannot be tapped (only 4 of 5046 canvas taps reached any worker).
   The world start apron now puts the workers south of the Keep, where they are
   in front and reachable.
2. **The `entityScreen` probe needed to verify itself.** A projected centre can
   land under a neighbour's art, so the probe now scans outwards and returns the
   first *reachable* entity of the requested kind; `train-unit` and `build-site`
   again select their target with one exact tap (`kind 20 f0 @468,260`).

### Not done

- Boot is still the authored showcase island; the world opens from the HUD
  SKIRMISH buttons and RESET returns to the showcase. Flipping boot to the world
  is one line, but the showcase-boot gates (`tap-clears`, `click-select`) would
  need re-baselining, so it is left for a separate verified step.
- No pathfinding: units cross terrain directly, as before.

## Wave 2 verification — 2026-09-15 (all viewports green; release still frozen)

The wave-2 tree was dirty and the build/verify path was failing. Every root
cause was in the harness or in the HUD wiring, not in the simulation.

| Fix | File | What was wrong |
|---|---|---|
| gate restored zoom on the wrong button | `scripts/capture.mjs` | the rotate gate re-zoomed with `buttons[3]` (zoom-in) instead of `buttons[2]` (zoom-out), so later gates inherited the wrong zoom index |
| rotated camera leaked forward | `scripts/capture.mjs` | after `shot-rotated.png` the harness never returned to yaw 0, so every later tap used a rotated screen projection; it now clicks `#rotate-left` |
| gates scanned ~50 guessed points | `scripts/capture.mjs`, `src/main.ts` | the harness could not know where a unit was drawn, so `train-unit` and `build-site` scanned constants until one hit; the read-only `__APP.entityScreen(kind,faction)` probe now returns the live screen centre from the renderer's own projection, each gate makes **one** exact tap, and the constant list and its scan loop are deleted (`61e37e0`) |
| cost tolerance too strict | `scripts/capture.mjs` | a real click/readback can straddle one deterministic Charge tick; the tolerance is now `max(1, abs(drift))` per resource, so the exact cost is still checked |
| BUILD used the HUD tile | `src/hud.ts`, `src/main.ts` | the bar sent the raw HUD tile; it now calls `buildNearest(kind)`, which asks Rust for the nearest placeable tile and leaves `sim_command` authoritative |
| production list showed disabled rows | `src/hud.ts` | a building with no matching roster rows now shows no production action |

Build: **PASS** (`npm run wasm && tsc --noEmit && vite build`). Capture
(`node scripts/capture.mjs`), all five viewports, no console errors:

| Viewport | Mode | Gates |
|---|---|---|
| 960x540 | desktop regression | **18/18 PASS** |
| 844x390, dsf 2 | touch landscape | **28/28 PASS** |
| 1024x768, dsf 2 | touch tablet | **28/28 PASS** |
| 390x844 -> 844x390, dsf 2 | portrait, then rotate | **29/29 PASS** |
| 768x1024, dsf 2 | iPad portrait | **30/30 PASS** |

- 133/133 gates. FPS 60.3 mean, p95 16.7-17.2 ms, max 18.4 ms in every run.
- `train-unit` and `build-site` selected their target with **one exact tap** in
  all five viewports (`kind 10 f0 @417,221` desktop, `@379,152` phone/portrait/
  ipad, `@440,333` tablet; `kind 20 f0 @318,181` desktop, `@311,124` phone).
  Each gate line names the tap it used, so a projection regression fails the
  gate instead of hiding behind a lucky hit.
- Showcase determinism `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}` and
  match determinism `a7b9e906` are unchanged in every run.
- Instance, palette, grid and arena gates unchanged; `saturated=false`.
- Evidence: `evidence-w2/{desktop,phone,tablet,portrait,ipad}/`.

### Independent pick probe (orchestrator-run, not the repo harness)

576 single taps on a 24x24 grid over the yaw-0 match frame:

- 25 taps selected an entity and every one named the correct roster entry for
  its kind: `CHARTER KEEP`, `FREIGHT COURT`, `HELIOWELL`, `PYRE ARK`,
  `SCRAP MAW`, `EMBER SIPHON`, `ASHHAND`, `CHAIN MULE`, `WARD SENTINEL`.
- 10 of those taps landed on the east (Cinderwake) half and all 10 returned a
  Cinderwake entity. The repo harness never taps the east half, so this is the
  first proof that enemy-side picking works.
- 9 distinct kinds selected; 0 console errors.
- Log: `evidence-w2/pick-probe.log`.

### Open items carried out of wave 2

1. `MATCH_SPOTS` is deleted (`61e37e0`) and no guessed fraction or scan remains.
   **Done** — kept here as a record. The selection path is now one exact tap on a
   position the app reports.
2. No independent critic clears the wave-2 match frame, so the release stays
   frozen on pass 15. The DeepSeek vision critic names grounded richness and
   readability as the biggest gap — the same parked structural residual.
   Second-opinion routes, each tested with a real call on 2026-09-15:
   - `cursor-agent --model cursor-grok-4.6-xhigh` → `ActionRequiredError: Named
     models unavailable Free plans can only use Auto.`
   - local cursor bridge: `/v1/models` lists every id, `/v1/chat/completions`
     answers **HTTP 502** for `cursor-grok-4.6-xhigh`, `gpt-5.6-sol-xhigh`,
     `claude-opus-5-thinking-xhigh`, `gemini-3.7-flash-high`.
   - Codex `gpt-6-astra` with `-i <png>`: the image attach and session start
     work, but the Plus account is at **100% of its usage limit** and answers
     `You've hit your usage limit … try again at 3:13 PM`
     (`tasks/quota-check.py`: `plus: allowed=False primary_used=100%
     reset_in=160min`). This is the route to retry after 15:13 IST.
   So the DeepSeek script stays the only working independent eye for now.

### Next three actions

1. Retry the second independent eye after 15:13 IST through Codex `gpt-6-astra`
   with `-i <png>` — the invocation is proven, the quota is not. Then re-judge the
   wave-2 match frame before any release promotion.
2. Write the spec for the match-frame readability piece the critic named: scale
   up unit and building silhouettes and separate the ground mids so both
   settlements read at normal zoom. Stay inside the frozen contracts — 32
   colours, locked map, camera, and controls.
3. Re-run the five viewports after the readability piece lands. The exact-tap
   gates now fail on any projection regression, so they are the guard for that
   work.

**Lighting loop parked at pass 30 (`45212d0`). Every pass 25-30 passed all
objective gates; the independent visual gate is still open — each fresh critic
round preferred the newest build but kept naming carved lighting/depth as the
single largest gap. The Tailnet phone release remains verified pass 15.**

## Pass 25-30 lighting loop — 2026-09-13 Plus window

Six isolated renderer-only passes, each a fresh GPT-6 Astra Medium worker
(standard mode, `fast_mode=false`, `~/.codex-linux`), each committed with its own
evidence directory. No pass was reverted: both critics preferred the newest
build every round.

| Pass | Commit | One change | Objective result |
|---|---|---|---|
| 25 | `c23b0b6` | emissive cores `(w+2,h+2)` | 63/63; all lighting gates |
| 26 | `8a4e45f` | emissive cores `(w+4,h+4)` | 63/63; highlights 7.24% |
| 27 | `044fcf4` | lower cliff bands one step deeper | 63/63; SD 51.3; cliff ratio 0.810 |
| 28 | `b41b3ef` | east wall step 2→3 | 63/63; mean 86.38 (floor 86.0) |
| 29 | `f6dd663` | cliff top rim +1 | 63/63; midtones 41.96% |
| 30 | `45212d0` | large building tops up to +2 | 63/63; mean 88.40; SD 51.35; highlights 7.63% |

Every pass: 8/8 desktop, 18/18 phone (844x390 dsf 2), 18/18 tablet (1024x768
dsf 2), 19/19 portrait (390x844→844x390 dsf 2); determinism
`{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`; >=59 fps with p95 <=20 ms;
exact 32-colour palette, 0 outside; texture and cliff gates green; no console
errors; no instance saturation; four-yaw fixed-light review clean. Evidence:
`evidence-p25/` … `evidence-p30/`.

### Canonical frame, pass 30 vs the dream target (960x540)

| Metric | Build | Target |
|---|---|---|
| non-void coverage | 42.6% | fills the frame |
| luminance mean | 88.40 | 88.00 |
| luminance SD | 51.35 | 53.78 |
| share >= 90 | 41.95% | 49.53% |
| share >= 170 | 7.63% | 7.90% |
| share >= 215 | ~3.6% | 3.10% |

### Why the visual gate is still open (measured, not opinion)

Both independent critics (DeepSeek vision API; Cursor Auto after the named-model
plan block) preferred the newest build in every round yet kept naming carved
value structure — deep occlusion, bright rims, material separation — as the
single largest gap. The residual is structural and locked by contract:

1. **Composition:** the build's world covers 42.6% of the judged frame; the
   target fills 100%. Map look, camera, and bounds are user-locked.
2. **Ground palette step gap:** the authored violet ground uses luma 53/80/116.
   Its mid mass sits just below the luminance-90 line and no intermediate
   palette entry exists, so mid-tone share cannot rise without jumping ~20% of
   the frame to 116 — which would flatten the terrain this pass protects.
3. **No true black on solids:** palette index 0 is the void colour and is banned
   on solid geometry, so the target's 3% sub-25 black clusters cannot be built.
4. **Raster policy:** the target is a smooth-gradient dream render (165k
   colours); the build is locked to 32 flat colours, 1 px edges, no AA/bloom.

## Verified state — mobile M1 + pass 15 (release still live)

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

### Serving chain (durable)

```
/home/bobbyranka/.starhold-live/current -> pass15   (symlink; retarget to promote)
python3 -m http.server 5200 --bind 127.0.0.1 --directory ~/.starhold-live/current
tailscale serve  https://bobby.taile5de76.ts.net:8446  ->  http://127.0.0.1:5200
```

- Keeper: `~/.hermes/scripts/starhold-keep-serve.sh`, registered as the Hermes
  cron job `starhold-keep-serve` (every 5 minutes, `no_agent`, silent). It starts
  the static server only when port 5200 is closed, so the phone build recovers
  without a session. The server process died once between sessions; this job
  prevents a repeat.
- Promotion is a symlink retarget plus a cache-busting reload on the device.
  Never point `current` at an unverified build.

## Civilization lock — first two

`docs/CIVILIZATIONS.md` is now binding. It preserves the Vesper March map and
current Dawnward art while standardizing eight buildings and seven units for each
playable civilization. Nothing in the pass 25-30 lighting loop changed this.

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

## Active next piece — lighting L1 (open; loop parked at pass 30)

All objective work the locked lighting contract allows has landed. The visual
gate did not flip. The renderer head is pass 30 (`45212d0`); the phone release
is frozen pass 15. Further one-pixel edits under the fixed palette, framing, and
geometry contract have low expected value.

## Coordinator audit after the scheduled loop

The coordinator independently checked the parked result rather than accepting the cron
self-report:

- rebuilt pass 30 from source and reran the canonical desktop capture: 8/8, 60.3 fps,
  p95 16.9 ms, exact hash `20b89f84`, 32 colours, zero outside, and every lighting
  metric green;
- parsed all 24 saved viewport reports for passes 25–30: every pass records
  8/8 + 18/18 + 18/18 + 19/19 = 63/63, with one exact deterministic tuple and four
  ordered yaw states without errors;
- confirmed the cumulative implementation diff from parked pass 24 through pass 30 is
  only `src/renderer.ts`; `sim/`, input, controls, map placement, and civilization
  contracts did not change;
- fetched the live Tailnet page and its hashed JavaScript and WASM assets: the route
  still serves frozen pass 15, and its JavaScript is byte-identical to
  `/home/bobbyranka/.starhold-live/pass15`;
- confirmed cron job `9682bd950b42` is completed and disabled;
- removed the temporary `scripts/yaw-capture.mjs` test-only helper because no approval
  existed to retain a new test helper. Its recorded screenshots remain as evidence;
- fixed trailing whitespace in the pass-25 critic record.

## Resume checklist

1. Confirm clean tree and Plus quota: `git status --short`;
   `python3 tasks/quota-check.py`.
2. Do not relaunch a blind renderer loop: six rounds (25–30) each passed every
   objective gate and each was preferred by both critics, but the headline gap
   never moved. The residual needs a change outside the locked set.
3. Coordinator decision: preserve map geometry, current civilization art, camera,
   controls, and the 32-colour cap. Do not change terrain composition or default
   framing under the lighting task. If the wave resumes, first write a separate,
   reviewable specification that reassigns one low-use palette role to an authored
   intermediate ground violet between `#624779` and `#8C69A0`, including every
   affected material mapping. Do not add a 33rd colour.
4. Release path stays frozen until a fresh independent critic stops naming
   lighting/contrast or unit readability as the single largest gap.
5. Never deploy to Cloudflare; never use the Pro account; one worker per pass,
   orchestrator validation only.

## Agent settings

- Coding worker: GPT-6 Astra, reasoning `medium`, `fast_mode=false`.
- Astra CLI: `~/.local/codex-154/node_modules/.bin/codex`, home `~/.codex-linux`.
- Vision critic: `tasks/vision-critic.py` (raw DeepSeek; `VISION_MAX_TOKENS` for
  long answers). Cursor named models stay plan-blocked
  (`ActionRequiredError: Named models unavailable Free plans can only use Auto.`);
  Cursor Auto is the second opinion.
- WebGPU capture: Playwright headless shell through Intel gen-9 Vulkan/ANGLE.
- Four-yaw review: one-state composited screenshots are preserved in each
  `evidence-p25/` through `evidence-p30/` directory. The temporary capture helper
  was removed after use.