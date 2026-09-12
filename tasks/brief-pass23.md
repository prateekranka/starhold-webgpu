# Brief — Astra coding pass 23: deepen connected cast shadow

You are the coding worker for one final one-token Starhold lighting correction.
Use GPT-6 Astra Medium in standard mode. Implement only. Do not run the game, a
server, Playwright, screenshots, metrics, or a critic. The orchestrator owns
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/LIGHTING_CONTRAST_SPEC.md`, including pass 22
3. `evidence-p22/shot-main.png`, `metrics.txt`, and `critic.md`
4. `.dream-loop/target.png`
5. `src/renderer.ts`, method `shadow()`

## Current state

Pass 22 commit `ae945ff` is the candidate base. Keep all of it.

It passes all objective lighting gates and desktop runtime checks:

- mean 88.643;
- SD 49.654;
- midtones 38.544%;
- highlights 7.192%;
- exact palette, texture, cliff, performance, capacity, and simulation.

The final DeepSeek critic and Cursor Auto critic still fail the lighting scope.
Both identify emissive-to-shadow separation and lifted ground occlusion. A fresh
focused critic chose this correction over darkening east faces or removing the
south bounce.

Plus quota is near its limit. Do not inspect unrelated code or add a second
change. The live phone route remains frozen on verified pass 15.

## This pass — one source token

Edit only `src/renderer.ts`, inside method `shadow()`.

The first `this.box(...)` call is the broad, connected cast-shadow fill. Change
its authored colour argument from palette index `2` to palette index `1`.

Before:

`this.box(x,y,z+.085,w,d,Math.min(1,h),2,-1,-3);`

After:

`this.box(x,y,z+.085,w,d,Math.min(1,h),1,-1,-3);`

Do not change the second narrow ink-lip call. It stays colour 0. Do not change
any coordinate, dimension, height, owner, screen mode, comment, or other line.

This deepens the existing opaque shadow by one palette step. It adds no pixels,
geometry, colour, or draw call.

## Hard exclusions

Do not change anything else. Do not change lit faces, roofs, actor glints,
terrain light, face table, bounce, structural floor, shadows' footprint or cast
direction, buildings, units, terrain, roads, cliffs, map, camera, controls,
simulation, palette, capacity, or dependencies.

Do not edit `sim/`, any other `src/` file, HTML, CSS, docs, tasks, scripts,
evidence, WASM, or package files. Do not add a file.

## Definition of done

The orchestrator will require:

- full objective lighting gate still passes;
- all 63 desktop/mobile runtime gates;
- exact deterministic hash `20b89f84`;
- >=59 fps, p95 <=20 ms, no console errors, no saturation;
- exact palette, texture, cliff, grid, and four-yaw light gates;
- fresh independent critic: lighting/contrast and unit readability are no longer
  the single largest gap.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 23 — deepen connected cast shadows"`

End with the exact one-token change, compile result, remaining risk, and commit
ID. Stop. If the Plus usage limit appears before commit, stop immediately and
report the untouched or partial state. Do not use another account.
