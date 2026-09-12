# Brief — Astra coding pass 20: small actor endpoint glints

You are the coding worker for the final isolated Starhold lighting correction.
Use GPT-6 Astra Medium in standard mode. Implement only. Do not run the game, a
server, Playwright, screenshots, metrics, or a critic. The orchestrator owns
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `docs/CIVILIZATIONS.md`
5. `docs/LIGHTING_CONTRAST_SPEC.md`, including passes 16–19
6. `evidence-p19/shot-main.png`, `metrics.txt`, and `critic.md`
7. `.dream-loop/target.png`
8. `src/renderer.ts`, especially the world vertex shader variables `combat`,
   `screen`, `pigment`, `small`, `shade`, and `shaded`

## Current state

Pass 19 commit `b90631c` is the candidate base. Keep all of it.

It passes build, all 8 desktop runtime gates, 60.3 fps, p95 17.2 ms, exact
simulation hash, palette, coverage, mean, contrast, midtone, texture, cliff, and
saturation gates. Both critics keep it.

Only one objective value misses:

- highlight share is 4.904%; minimum is 5.0%; short by 0.096 percentage points,
  approximately 184 judged pixels.

The live phone route remains frozen on verified pass 15. Your build cannot
deploy it.

## This pass — exactly one correction

Edit only `src/renderer.ts`. Add one endpoint-glint rule to the existing WGSL
world vertex shader after normal structural key/bounce shading and before
assigning `o.color`.

A face is eligible only when all conditions are true:

- `combat >= 17.` so the box belongs to a rendered actor;
- `screen >= -2.` and `screen <= 0.` so it is ordinary actor geometry, not an
  emissive or HUD element;
- `pigment >= 4.` and `pigment < 28.`;
- `shade == 0.` so only the small upward plane changes;
- `small` is true, using the existing maximum-dimension <=0.3-tile rule.

For an eligible face, raise `shaded` by exactly one palette step, capped at its
existing material-family endpoint:

- stone/ivory endpoint 9;
- teal endpoint 14;
- energy endpoint 18;
- gold endpoint 22;
- Reaver endpoint 27.

Use discrete palette indices only. Reuse the existing nested `select` family
pattern. Do not change the broad-face caps used by key or bounce lighting. Do not
alter `small` itself.

This promotes penultimate small actor faces such as energy 17, gold 21, and
Reaver 26 to their existing hot endpoint. Lower values can move only one step.
Existing endpoint faces stay at the endpoint. The rule adds no boxes and changes
no contours.

## Hard exclusions

Do not change:

- pass 18's `basalt()` ellipse;
- pass 19's cross-light bounce;
- face table, structural stone floor, broad material caps, cast/contact shadows;
- any TypeScript building or unit call site;
- actor size, position, silhouette, contour, effects, particles, selection ring;
- static map, terrain, roads, cliffs, motifs, props, buildings, camera, zoom,
  controls, simulation, palette, renderer capacity, or dependencies.

Do not add geometry, emissive calls, particles, a new light pool, a colour, draw
pass, texture, uniform, allocation, or file. Do not edit `sim/`, other `src/`
files, HTML, CSS, docs, tasks, scripts, evidence, WASM, or package files.

Do not intentionally make any pass-19 pixel darker. The expected change is
roughly 200–500 raster pixels, not a broad brightness shift.

## Definition of done

The orchestrator will require:

- all desktop and mobile runtime gates;
- exact deterministic hash `20b89f84`;
- at least 59 fps, p95 <=20 ms, no console errors, no saturation;
- exact palette, texture, cliff, grid, and coverage preservation;
- mean 86–94;
- SD >=44;
- midtones >=38%;
- highlights 5.0–8.5%;
- fixed light across all four yaw steps;
- a fresh blind critic that no longer names flat lighting, weak value separation,
  or unit readability as the largest gap.

Do not game metrics through coverage, camera, geometry, HUD, particles, or map
lighting.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 20 — add actor endpoint glints"`

End with changed file, exact eligibility and endpoint caps, compile result,
remaining risk, and commit ID. Stop.
