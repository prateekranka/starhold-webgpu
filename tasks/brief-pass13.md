# Brief — Astra coding pass 13: amethyst terrain language

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one terrain-art piece. Do not run the game, capture screenshots, or judge
the result. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — terrain/layout and exact palette
4. `.dream-loop/target.png`
5. `evidence-p12/shot-main.png` — actual frame
6. `src/renderer.ts`

## Verified state

Pass 12: build PASS; 7/7 runtime gates; 60.3 fps; p95 17.2 ms; exact WASM
hash unchanged; true 1 px render grid; 31 colours; no console errors.
The new cliff ramp passes the objective gate:
`cliff_lower/cliff_upper=0.828`, slope `-0.239/row`.

Two fresh critics returned FAIL. The orchestrator agrees with this single biggest gap:

> The terrain is a flat, uniform gray platform. Unlike the target's rich amethyst
> frontier, the huge top plane has no layered purple material, clear edge highlight,
> authored surface patches, or crystal scatter. It visually outweighs the buildings
> and combat.

Ignore any critic-proposed hex values that are not in WORLD_PLAN.md. Use only the
locked palette below.

## Implement only this piece

Change terrain/prop rendering only. Do not modify units, buildings, shadows, lighting
direction, HUD, camera, sim, controls, combat, construction, or resolution.

### A. Replace the gray field with amethyst basalt

The plateau top must read as **purple basalt**, not a gray concrete slab:

- Base stone: `#565B73` only as a minority neutral foundation.
- Broad alien-violet inclusions: `#3C3057` and `#624779`.
- Small lit seams/rim accents: `#8C69A0`; reserve `#BD96C1` for tiny glints only.
- Roads remain visibly pale/warm stone (`#747C91` / `#98A4AE`) so navigation lanes
  still separate from the purple ground.
- Keep the pass-12 cliff value ramp and top-left light. Cliff sides remain in the
  void/stone ramp and darken downward; do not flatten or brighten them again.

### B. Author large material regions, not random noise

- Build 5–8 deterministic, recognizable terrain regions: crystal garden, ore crescent,
  central worn plaza, eastern defense scars, southwest industrial shelf, foreground
  dust channel, and 1–2 quiet basalt fields.
- Each region uses hand-clustered shapes: 2–5 px crack/ore clusters plus larger
  12–30 px patches. No independent random-pixel salt-and-pepper noise.
- The central building foundations stay clear. Roads and doorway aprons must remain
  legible and unobstructed.
- Add a continuous but irregular 1 px violet highlight along selected top cliff edges,
  strongest on top-left-lit edges, never on every edge equally.

### C. Perimeter landmarks and atmosphere

- Keep and improve the existing crystal garden. Add 4–6 small purple crystal spire
  clusters distributed along the perimeter and ore crescent; vary height and group
  shape deterministically. Do not block roads or actors.
- Add sparse ochre grass and 2–3 broken low ruin forms in the foreground only, all
  under 10 px tall, as WORLD_PLAN.md requires.
- Add three very small background moon/rock silhouettes and a thin sparse violet haze
  band. Do not create a large horizon or consume map space. No gradients or alpha.

## Visual acceptance at the default capture

- The largest continuous top-surface region must no longer be neutral gray.
- Purple/violet terrain pixels visibly outnumber neutral gray terrain pixels outside
  roads/building footprints.
- Roads are immediately traceable from depot → HQ → eastern defense.
- Cliff faces remain darker downward and pass:
  `python3 scripts/measure-detail.py <shot> --top 230 265 --rim 350 465 --x0 180 --x1 430`.
- The battle and buildings remain at least as readable as pass 12.

## Hard invariants

- Preserve raw Rust WASM ABI, `window.__APP`, 960×540 internal target, fixed 60 Hz,
  seed 73129, all gameplay, controls, selection, camera and zoom.
- Exact 32-color palette only. No new hex, alpha, gradients, bloom, antialiasing,
  random pixel noise, or `Math.random`.
- Raw WebGPU + WGSL. No dependencies.
- fps ≥59 and p95 ≤20 ms; ≤64 draw calls; ≤100k triangles; no per-frame heap churn.
- Work only in `src/renderer.ts`.
- Do not edit docs/tasks/scripts/evidence/sim/public WASM.
- You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

`git add src/renderer.ts && git commit -m "art: pass 13 — layered amethyst terrain regions and perimeter detail"`

End with changed files, palette allocation, regions/landmarks added, remaining weakness,
and assumptions. Stop after implementation.
