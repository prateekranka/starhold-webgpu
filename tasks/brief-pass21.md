# Brief — Astra coding pass 21: widen actor glint eligibility

You are the coding worker for one final one-line Starhold lighting correction.
Use GPT-6 Astra Medium in standard mode. Implement only. Do not run the game, a
server, Playwright, screenshots, metrics, or a critic. The orchestrator owns
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/LIGHTING_CONTRAST_SPEC.md`, including pass 20
3. `evidence-p20/shot-main.png`, `actors-p19-p20.png`, `metrics.txt`, and
   `critic.md`
4. `src/renderer.ts`, especially the endpoint-glint rule added by pass 20

## Current state

Pass 20 commit `d2cd6c1` is the candidate base. Keep all of it.

It passes build, all 8 desktop runtime gates, 60.3 fps, p95 17.2 ms, exact
simulation hash, palette, coverage, mean, contrast, midtone, texture, cliff, and
saturation gates. It changed 157 pixels, all brighter. A fresh critic says KEEP,
CLEAN, and EXPAND.

Only the highlight share misses: 4.953% versus the 5.0% minimum, approximately
90 judged pixels.

The live phone route remains frozen on verified pass 15. Your build cannot
deploy it.

## This pass — one eligibility edit

Edit only `src/renderer.ts`. In the pass-20 actor endpoint-glint condition,
replace the final `&& small` eligibility with a dedicated maximum box-dimension
check of at most 0.40 tile:

`max(size.x,max(size.y,size.z)) <= .4`

Keep every other condition exact:

- `combat >= 17.`;
- `screen >= -2.` and `screen <= 0.`;
- `pigment >= 4.` and `pigment < 28.`;
- `shade == 0.`.

Keep the one-step lift and endpoint caps exact: 9, 14, 18, 22, 27.

Do not change or redefine the existing `small` variable. It must continue to
control broad-face endpoint protection at its current 0.30-tile limit. The new
0.40 limit applies only to the actor endpoint-glint condition.

## Hard exclusions

Do not change any other line. Do not change the light pool, bounce, face table,
structural floor, broad caps, colours, call sites, boxes, geometry, actors,
buildings, terrain, roads, cliffs, effects, selection, camera, controls,
simulation, capacity, or dependencies.

Do not add a file, variable, geometry, emissive, particle, draw pass, texture,
uniform, allocation, colour, or metric. Do not edit `sim/`, other `src/` files,
HTML, CSS, docs, tasks, scripts, evidence, WASM, or package files.

Do not intentionally make any pass-20 pixel darker.

## Definition of done

The orchestrator will require:

- the complete desktop lighting gate, including highlights 5.0–8.5%;
- every desktop and mobile runtime gate;
- exact deterministic hash `20b89f84`;
- at least 59 fps, p95 <=20 ms, no console errors, no saturation;
- exact palette, texture, cliff, grid, and coverage preservation;
- fixed light at all four yaw steps;
- a fresh blind critic that no longer names flat lighting, weak value separation,
  or unit readability as the largest gap.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 21 — widen actor glint eligibility"`

End with changed file, exact one-line change, compile result, remaining risk, and
commit ID. Stop.
