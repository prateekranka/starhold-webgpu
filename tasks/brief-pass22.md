# Brief — Astra coding pass 22: building-top endpoint separation

You are the coding worker for one final Starhold lighting correction. Use GPT-6
Astra Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/LIGHTING_CONTRAST_SPEC.md`, including pass 21
3. `evidence-p21/shot-main.png`, `target-vs-pass21.png`, `metrics.txt`, and
   `critic.md`
4. `.dream-loop/target.png`
5. `src/renderer.ts`, especially the WGSL shading block

## Current state

Pass 21 commit `b2388b9` is the candidate base. Keep all of it.

It passes:

- desktop 8/8, phone 18/18, tablet 18/18, portrait 19/19: 63/63 total;
- three identical complete objective lighting gates;
- mean 87.355, SD 46.979, midtones 38.544%, highlights 5.002%;
- 31 colours, zero outside palette;
- four-yaw world-fixed lighting review;
- 60.3 fps, p95 16.9–17.2 ms;
- exact simulation hash `20b89f84`;
- texture, cliff, instance capacity, controls, and mobile layout.

The final independent target critic still says FAIL. Its single gap is weak value
separation. A second focused critic chose this exact remedy over darker walls or
more terrain light: promote only non-actor top faces one palette step to existing
endpoints.

The live phone route remains frozen on verified pass 15. Your build cannot
deploy it.

## This pass — one WGSL rule

Edit only `src/renderer.ts`. Add one rule after the actor endpoint-glint rule and
before `o.color` is assigned.

Eligibility must be exactly:

- `combat < 17.` so actors are excluded;
- `screen == 0.` so static map `-6`, terrain `-5`, marks/shadows `-3`, shards
  `-2`, emissives `-4`, and HUD are excluded;
- authored `pigment >= 4.` and `pigment < 28.`;
- `shade == 0.` so only top faces change;
- `max(size.x,max(size.y,size.z)) > .4` so tiny props are excluded.

For an eligible top face, raise `shaded` by exactly one palette step, capped at
its existing family endpoint:

- stone/ivory 9;
- teal 14;
- energy 18;
- gold 22;
- Reaver 27.

Use the same nested `select` family endpoint pattern as the actor rule. Use exact
palette indices only. A lower value moves only one step. A penultimate value can
reach its endpoint. An existing endpoint stays there.

This creates a high-value top plane over existing darker side faces. It does not
change the broad side-face caps. It adds no geometry and no light to terrain.

## Hard exclusions

Do not change any existing condition or line from passes 16–21. Do not change:

- actor glints or their 0.40-tile limit;
- civic light pool, cross-light bounce, key lift, structural floor, face table;
- wall/side values, shadows, terrain, roads, cliffs, motifs, map, props, actors,
  buildings, call sites, geometry, effects, selection, camera, controls,
  simulation, palette, capacity, or dependencies.

Do not add geometry, particles, emissives, a light pool, a colour, draw pass,
texture, uniform, allocation, or file. Do not edit `sim/`, other `src/` files,
HTML, CSS, docs, tasks, scripts, evidence, WASM, or package files.

Do not intentionally make any pass-21 pixel darker.

## Definition of done

The orchestrator will require again:

- full objective lighting gate: coverage 40–46%, mean 86–94, SD >=44, midtones
  >=38%, highlights 5.0–8.5%;
- exact palette, texture, cliff, grid, and capacity gates;
- all 63 desktop/mobile runtime gates;
- exact hash, at least 59 fps, p95 <=20 ms, no console errors;
- four-yaw fixed-light review;
- fresh independent target critic: lighting/contrast and unit readability are no
  longer the single largest gap.

Full target parity is not required in this scope. Do not game metrics through
coverage, camera, geometry, HUD, particles, or terrain light.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 22 — separate building top values"`

End with changed file, exact eligibility and endpoint caps, compile result,
remaining risk, and commit ID. Stop.
