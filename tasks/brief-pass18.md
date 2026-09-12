# Brief — Astra coding pass 18: settled-core light pool

You are the coding worker for one isolated Starhold lighting correction. Use
GPT-6 Astra Medium in standard mode. Implement only. Do not run the game, a
server, Playwright, screenshots, metrics, or a critic. The orchestrator owns
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `docs/CIVILIZATIONS.md`
5. `docs/LIGHTING_CONTRAST_SPEC.md`, including rejected passes 16 and 17
6. `evidence-p15/shot-main.png`
7. `evidence-p17/shot-main.png`, `metrics.txt`, and `critic.md`
8. `.dream-loop/target.png`
9. `src/renderer.ts`, especially WGSL function `basalt()`

## Current state

Pass 17 commit `a947440` is the candidate base. Keep all of it.

It passes build, 8/8 runtime gates, 60.3 fps, p95 17.3 ms, exact deterministic
hash, palette, texture, cliff, and saturation. Its contrast SD now passes at
44.397. A fresh critic selects pass 17 over pass 15.

It still fails macro lighting: mean 82.417, midtones 30.815%, and highlights
4.295%. Local structure faces changed too little of the frame. The outer map
must stay dark, but the settled core needs one coherent lit plane.

The live phone route is frozen on verified pass 15. Your build cannot deploy it.

## This pass — exactly one change

Edit only `src/renderer.ts`. In WGSL function `basalt()`, add one deterministic,
world-fixed open-sky light pool immediately before the function's final `return
c;`.

Use this exact region in world coordinates:

- center: `(16, 17)` tiles;
- x radius: `11` tiles;
- y radius: `9` tiles;
- inside test: `dot((world-center)/radii, (world-center)/radii) <= 1`.

Inside the ellipse only:

- if final `c == 28u`, return/use `29u`;
- if final `c == 29u`, return/use `30u`;
- if final `c == 30u`, keep `30u`;
- never produce `31u` from ground lighting.

Implement as integer palette selection. Do not multiply or interpolate RGB. The
ellipse test can vary per raster pixel, but every output must be an exact palette
entry.

Preserve all existing `basalt()` decisions before this final remap:

- staggered plate rows and widths;
- shoulder and bent-seam shape;
- province rules;
- stone-joint early return at index 4;
- chips, seams, and ore-fracture motif;
- all motif positions.

The existing stone-joint early return must remain before the light-pool remap, so
road and joint pixels stay stone. Outside the ellipse, `basalt()` must return the
same index as pass 17 for every input.

## Do not combine another fix

Do not alter pass 17's face table, structural floor, key-face lift, Hearth values,
actor highlights, selection ring, shadows, emissives, buildings, units, terrain
geometry, cliffs, roads, authored material arrays, camera, zoom, HUD, controls,
simulation, palette, or renderer capacity.

Do not change `basalt()` coordinates, plate size, motif density, or transition
density. Do not add a feather, random dither, radial gradient, second light pool,
new colour, new draw pass, texture, uniform, allocation, or dependency.

Do not edit `sim/`, other `src/` files, HTML, CSS, docs, tasks, scripts, evidence,
WASM, or package files. Do not add files.

## Expected result

This piece is intended to move broad value grouping without changing map design:

- coverage stays 40–46%;
- mean should move from 82.417 toward 86–94;
- >=90 midtone share should move from 30.815% toward >=38%;
- SD must remain >=44;
- highlight share can remain below 5% for this isolated piece; it will be judged
  separately only if the civic-plane change passes visually;
- palette, texture, cliff, instance, determinism, and runtime gates remain green.

Do not game metrics through coverage, camera, geometry, HUD, or particles.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 18 — light the settled core"`

End with changed file, exact ellipse and remap, compile result, remaining risk,
and commit ID. Stop.
