# Brief W2-RENDER — both civilizations in the renderer, with motion

You are implementing the wave-2 renderer work. Work only in `src/renderer.ts`.

## Read first

- `docs/UNIT_DESIGN.md` — binding silhouette rules and animation contract.
- `docs/CIVILIZATIONS.md` — building footprints and faction colour ownership.
- `docs/MATCH_SPEC.md` §2 — snapshot semantics (state index 5, anim_phase index 6).
- `src/renderer.ts` — the existing procedural renderer. Study how kinds 10–17
  (buildings) and 20–24, 30–31 (units) are drawn, including `shadow()`,
  `emissive()`, palette-family stepping, and the instance budget.

## Deliverable

1. **Cinderwake buildings** — draw kinds 60, 61, 62, 65, 63, 64, 66, 67 with the
   silhouette rules in `docs/UNIT_DESIGN.md` §3. They must not reuse Dawnward
   massing. Footprints: 60 = 4×4, 61 = 3×3, 62 = 2×2, 65 = 3×2, 63 = 3×3,
   64 = 3×3, 66 = 2×2, 67 = 4×3. Construction stages use the same progress
   convention as kinds 10–17 (`param0` = 0..1).
2. **Dawnward units 25 (Prism Cantor) and 26 (Star Ram)** per `docs/UNIT_DESIGN.md` §2.
3. **Cinderwake units 32 (Ashhand), 33 (Chain Mule), 34 (Hookguard),
   35 (Sootwing), 36 (Brandcaller)** per §3. The **Ash Jackal (kind 30) must
   become the steppe-centaur silhouette**: four-legged jointed chassis fused to an
   archer torso with a drawn ember bow. It currently reads as a plain walker.
4. **Motion** — implement the idle/move/attack/work/construct contract in
   `docs/UNIT_DESIGN.md` §4 for every unit kind you touch, driven only by
   `state`, `anim_phase`, and the tick. Amplitude limits in §4 are binding.

## Hard rules

- Procedural geometry only. No sprite atlas, no textures, no new WGSL passes.
- Palette: only the 32 colours in `src/kinds.ts`. Solid geometry never uses
  index 0. Stay inside the existing instance budget and never exceed it.
- Use explicit kind sets, never numeric ranges such as `kind < 20`.
- The four-yaw contract stays: these silhouettes must read at yaw 0–3.
- Showcase kinds and their current look must not regress.
- Do not touch `sim/`, `src/main.ts`, `index.html`, `src/style.css`, docs, or git.
- Do not run `git`. Do not run `npm run build` while another worker may build;
  `npx tsc --noEmit -p tsconfig.json` is your check.

## Self-check before you report

- `npx tsc --noEmit -p tsconfig.json` clean.
- Re-read the diff: no showcase kind changed shape, no palette index added.

## Report

Final message: files changed, the kind-by-kind silhouette summary, and how each
new unit's idle and attack motion is driven.
