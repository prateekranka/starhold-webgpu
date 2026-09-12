# Brief — Astra coding pass 19: faction cross-light bounce

You are the coding worker for one isolated Starhold lighting correction. Use
GPT-6 Astra Medium in standard mode. Implement only. Do not run the game, a
server, Playwright, screenshots, metrics, or a critic. The orchestrator owns
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `docs/CIVILIZATIONS.md`
5. `docs/LIGHTING_CONTRAST_SPEC.md`, including passes 16–18
6. `evidence-p18/shot-main.png`, `metrics.txt`, and `critic.md`
7. `.dream-loop/target.png`
8. `src/renderer.ts`, especially the world vertex shader's `shaded` block

## Current state

Pass 18 commit `248a8ae` is the candidate base. Keep all of it, including pass
17's structural floor and pass 18's settled-core ellipse.

Pass 18 is a kept component. It passes build, 8/8 runtime gates, 60.3 fps, p95
17.3 ms, exact deterministic hash, palette, texture, cliff, and saturation. Both
critics judge its light pool coherent and material.

The complete lighting gate misses by a narrow amount:

- mean 85.679; target minimum 86; short 0.321;
- midtones 37.268%; target minimum 38%; short 0.732 percentage points;
- highlights 4.315%; target minimum 5%; short 0.685 percentage points;
- contrast SD 44.820; pass.

The live phone route remains frozen on verified pass 15. Your build cannot
deploy it.

## This pass — exactly one correction

Edit only `src/renderer.ts`. In the existing WGSL normal-geometry shading block,
add one discrete palette step of world-fixed reflected civic light to the south
cross-light face.

Eligibility must be exactly:

- `screen == 0.`;
- authored `pigment >= 4.` and `pigment < 28.`;
- `shade == 2.` (world south face only).

For eligible fragments, raise `shaded` by exactly one step. Use the same family
cap logic that pass 17 already uses for the top/west key-face lift:

- broad stone/ivory cap 8;
- broad teal cap 13;
- broad energy cap 17;
- broad gold cap 21;
- broad Reaver cap 26;
- existing small authored endpoint logic remains unchanged.

Place this next to the existing `shade==0. || shade==3.` key-lift branch. Reuse
its computed family cap rather than making a second independent material system
if practical. Do not alter the base `faceSteps` table. The eligible south face
first loses its existing one step, then receives one bounce step. The world-east
face ID 4 stays two steps dark.

This should move authored stone 7's south face from output 6 to 7, crossing the
highlight threshold. It should move low teal, energy, gold, and Reaver south
faces by one family step, improving midtone readability. It must not promote
broad geometry into a family endpoint beyond the existing cap.

## Hard exclusions

Do not change:

- pass 18's `basalt()` function or ellipse;
- static map mode `-6`;
- terrain `-5`, shadows/ground marks `-3`, shards `-2`, emissives `-4`, or HUD;
- top, north, west, east, or underside face behavior;
- structural stone floor;
- Hearth values, actor geometry, selection ring, shadows, cast direction;
- map, roads, terrain, cliffs, motifs, props, buildings, units, camera, zoom,
  controls, simulation, palette, renderer capacity, or dependencies.

Do not add a gradient, light pool, new colour, draw pass, texture, uniform,
allocation, or file. Do not edit `sim/`, other `src/` files, HTML, CSS, docs,
tasks, scripts, evidence, WASM, or package files.

Do not intentionally make any pass-18 pixel darker.

## Definition of this correction

The orchestrator will require:

- all 8 desktop runtime gates;
- exact deterministic hash `20b89f84`;
- 60 fps-class performance and no console errors;
- no saturation;
- exact palette, texture, cliff, grid, and coverage preservation;
- mean 86–94;
- SD >=44;
- >=90 midtone share >=38%;
- >=170 highlight share 5.0–8.5%;
- visual improvement at landmark hierarchy, unit separation, and fixed-light
  reading without washing housing or terrain.

Do not game metrics through coverage, camera, geometry, HUD, particles, or map
lighting.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 19 — add faction cross-light bounce"`

End with changed file, exact eligibility and cap behavior, compile result,
remaining risk, and commit ID. Stop.
