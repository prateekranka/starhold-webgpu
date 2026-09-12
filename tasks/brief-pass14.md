# Brief — Astra coding pass 14: authored terrain texture and restored cliff depth

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one terrain polish pass. Do not run the game, capture screenshots, or judge
the result. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — terrain/layout and exact palette
4. `.dream-loop/target.png`
5. `evidence-p13/shot-main.png` — actual current frame
6. `src/renderer.ts`

## Verified state

Pass 13 build/runtime: PASS, 7/7 gates, 60.3 fps, p95 17.2 ms, deterministic
WASM hash unchanged, true 1 px grid, 31 palette colours. It made the plateau purple,
kept roads traceable, and added perimeter detail.

However, both independent critics return FAIL on the same root defect:

> Terrain is still made of empty slabs — large unmodulated purple polygons with no
> contact wear, authored ground texture, or small-scale material breakup.

It also regressed the objective cliff ramp:

- pass 12: lower/upper `0.828`, slope `-0.239/row` (PASS)
- pass 13: lower/upper `0.914`, slope `-0.100/row` (**FAIL**)

Measured current texture:

- `#624779`: 55,372 px; one connected slab is **21,015 px**.
- `#3C3057`: 30,132 px; one connected slab is **8,898 px**.
- Horizontal transition density in the map area: **0.1681**.

## Implement only this piece

Terrain and ground-contact art only. Do not change units, buildings, HUD, camera,
controls, simulation, combat, construction, render resolution, or light direction.

### A. Break the purple slabs into authored basalt material

- Keep the amethyst identity, but no single flat `#624779` or `#3C3057` polygon may
  dominate a quadrant.
- Subdivide broad surfaces with deterministic hand-clustered material shapes:
  - 2–5 px cracks, chips, seams and ore flecks;
  - 8–24 px irregular stone plates and worn patches;
  - short diagonal/stepped contours that follow the isometric axes;
  - occasional quiet areas, but never a whole quadrant without detail.
- Use `#3C3057`, `#624779`, minority `#565B73`, and sparse `#8C69A0` accents.
  `#BD96C1` remains tiny glints only. No new hex values.
- Do not use independent random pixels or a regular checkerboard/grid. All variation
  must be deterministic and grouped into recognizable material clusters.
- **Numeric target:** largest connected `#624779` component < **8,000 screen pixels**;
  largest connected `#3C3057` component < **6,000 pixels**. Horizontal transition
  density in the map area should reach **0.20–0.28** (not noisy >0.30).

### B. Add contact wear around authored features

- Add short worn aprons around building doors, cargo stops, barricades and crystal
  roots. Use palette stone values; keep them smaller than roads.
- Add 1–2 px darkest contact marks where crystals, ruins and cliff-top props touch
  the ground. These are hard solid pixels, not soft/transparent shadows.
- Roads stay pale and continuous. Add sparse broken edge stones and wheel-track marks,
  but do not narrow or hide the depot→HQ→east-defense route.

### C. Restore the pass-12 cliff ramp

- Preserve the four hard vertical bands. Ensure terrain material overlays affect
  top caps only — they must not recolour or cover side-face bands.
- Side ramp remains in locked palette order, bright rim to dark base:
  `#565B73 → #41435E → #2B2D46 → #1B1E30`, with the darkest opposing face ending
  `#10121C`.
- The exact orchestrator command must return `terrain ... -> PASS`:
  `python3 scripts/measure-detail.py <shot> --top 230 265 --rim 350 465 --x0 180 --x1 430`
  requiring lower/upper ≤0.85 and slope<0.

## Hard invariants

- Raw WebGPU/WGSL; exact 32-colour palette; 960×540 internal target; no alpha,
  gradients, blur, bloom, antialiasing, `Math.random`, or dependencies.
- Preserve Rust/WASM ABI, `window.__APP`, fixed 60 Hz sim, seed 73129, gameplay,
  selection, camera, zoom, controls and all unit/building rendering.
- fps ≥59, p95 ≤20 ms; ≤64 draw calls; ≤100k triangles; no per-frame heap churn.
- Work only in `src/renderer.ts`.
- Do not edit docs/tasks/scripts/evidence/sim/public WASM.
- You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

`git add src/renderer.ts && git commit -m "art: pass 14 — authored basalt texture and restored cliff ramp"`

End with changed files, exact texture patterns, how side bands were isolated, remaining
weakness, and assumptions. Stop after implementation.
