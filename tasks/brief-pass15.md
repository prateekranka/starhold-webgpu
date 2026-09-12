# Brief — Astra coding pass 15: macro depth and lived-in settlement density

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one final high-impact art pass. Do not run the game, capture screenshots,
or judge the result. The orchestrator owns validation. Stop after your commit.

## Inherited state (read this)

A mobile pass landed after pass 14 (commit `5007a1d`, spec `docs/MOBILE_SPEC.md`).
It changed layout and input only: `index.html`, `src/style.css`, `src/main.ts`, and
two small additions in `src/renderer.ts` — a public field `hudButtons` and the
exported `buttonGlyphPixels()`. The rendered world art is still exactly the pass-14
frame in `evidence-p14/shot-main.png`.

Rules that follow from that:

- Keep `hudButtons` guarding the in-canvas button cluster in `hud()`. Touch layout
  hides that cluster; desktop shows it. Do not remove or rename the field.
- Keep `buttonGlyphPixels()` and the `buttonGlyph()` rewrite that uses it.
- Do not change layout, CSS, input, camera or HUD coordinates.
- Your art edits add to the same file; keep the diff inside the world-art methods.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — terrain heights, opening layout, detail-density rules
4. `.dream-loop/target.png`
5. `evidence-p14/shot-main.png` — actual current frame
6. `src/renderer.ts`

## Verified state

Pass 14: build PASS; 7/7 runtime gates; 60.3 fps; p95 17.1 ms; exact
WASM hash unchanged; 1 px grid; 31 palette colours. Terrain texture metrics now pass:

- transition density 0.2315 (target 0.20–0.28);
- largest `#624779` region 2,210 px (<8,000);
- largest `#3C3057` region 1,131 px (<6,000).

The cliff ramp is close but still fails: lower/upper `0.882` (must be ≤0.85), slope
`-0.125/row`. Two independent critics and orchestrator inspection agree:

> The plateau still reads as a flat sparse tile field. The new micro-texture repeats
> evenly, but the scene lacks macro elevation structure, grounded prop clusters, and
> building-facade life. It reads as a vertical slice, not a lived-in AoE2:DE settlement.

## Implement only this piece

Renderer art only. Do not change simulation/gameplay, entity counts, camera, HUD,
controls, resolution, road routes, unit silhouettes, or building footprints.

### A. Make existing height levels unmistakable

Use the existing terrain height data — do not invent walkable geometry or change physics.
Where adjacent terrain cells have different heights, draw a visible internal retaining
face with the same pass-12 cliff language:

- crystal garden rim (northwest/back): raised violet shelf;
- eastern defense terrace: raised defensive shelf;
- western industrial/ore shelf: distinct lower shelf;
- southeast expansion shelf: visible ledge and ramp boundary.

Each internal height change needs: a 1 px lit top edge on the top-left side, 2–4 hard
vertical shade bands, and 1 px darkest contact line at its base. Roads crossing levels
must show stairs/ramps, not cut through vertical faces. Keep actors and buildings on top.

### B. Add authored settlement prop clusters in the empty zones

Use small non-gameplay props only. Keep roads and combat lanes clear. Add 6–10
**clusters**, not loose random items:

- forge yard: coal/ore bins, anvil/table, 2 smoke stacks, cargo trolley;
- depot/HQ route: 2 handcarts, tied crate stacks, lamp posts, short fence sections;
- barracks/front: weapon rack, training posts, shield/lance bundle, two pennants;
- bastion construction: scaffold ties, tool chest, loose beams, pulley silhouette;
- crystal garden: shrine marker, 2 low collectors, dark root contacts;
- quiet residential edge: two small awning/tent service stalls and a water/charge barrel.

All props must be under 10 px tall except pennants/smoke. Group each around a clear use;
no salt-and-pepper scatter. Use contact shadows. Respect the exact palette.

### C. Add facade-scale pixel detail to existing buildings

Do not alter massing. Add 1–3 px details that make scale and function readable:

- doors with dark recess + lit lintel;
- 2–4 window slits per major facade;
- ladders/vents/pipes where appropriate;
- banners/awnings with faction colour;
- roof edge trim and one material-break seam;
- visible construction ribs on the selected 82% Bastion.

Building detail must stay brighter and more structured than the ground texture.

### D. Finish the outer cliff ramp

Darken only the lower half of the outer side faces by one additional permitted palette
step. Preserve top cap colour. The exact gate must pass:

`python3 scripts/measure-detail.py <shot> --top 230 265 --rim 350 465 --x0 180 --x1 430`

Requirements: `cliff_lower/cliff_upper <= 0.85`, slope `<0`, texture density 0.20–0.28,
`#624779_max <8000`, `#3C3057_max <6000`.

## Hard invariants

- Raw WebGPU/WGSL, 960×540 internal target, exact 32-colour palette, no new hex,
  alpha, gradients, blur, bloom, antialiasing, `Math.random`, or dependencies.
- Preserve Rust/WASM ABI, `window.__APP`, fixed 60 Hz, seed 73129, gameplay,
  selection, camera, zoom and controls.
- fps ≥59, p95 ≤20 ms; ≤64 draw calls; ≤100k triangles; no per-frame heap churn.
- Work only in `src/renderer.ts`.
- Do not edit docs/tasks/scripts/evidence/sim/public WASM.
- You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

`git add src/renderer.ts && git commit -m "art: pass 15 — terraced depth, settlement props, facade detail"`

End with changed files, terraces/prop clusters/facade details, ramp adjustment, remaining
weakness, and assumptions. Stop after implementation.
