# Brief — Astra coding pass 24: hard palette emissive halos

You are the coding worker for one final Starhold lighting correction. Use GPT-6
Astra Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, including pass 23
2. `evidence-p23/shot-main.png`, `metrics.txt`, and `critic.md`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, method `emissive()` and pipeline depth state

## Current state

Pass 23 commit `e01532f` is the candidate base. Keep all of it.

All objective lighting and desktop runtime gates pass. DeepSeek and Cursor Auto
still fail the target comparison. Both now name emissive-to-shadow separation.
A focused critic chose this exact correction. The render pipeline uses
`depthCompare: less-equal`, so the unchanged core can overwrite a same-depth halo
that is submitted first.

Plus quota is near its limit. Do not inspect unrelated code or add another
change. The live phone route remains frozen on verified pass 15.

## This pass — one helper change

Edit only `src/renderer.ts`, inside method `emissive()`.

Keep the 512-emitter cap and increment `emissiveCount` once per logical emitter.
For each accepted emitter:

1. Submit a halo box first at the same `x`, `y`, `z`, owner, and screen mode `-4`.
2. Halo dimensions are exactly `w+2` and `h+2` raster pixels.
3. Halo colour is exactly `color-1`.
4. Submit the existing core box second, unchanged at dimensions `w`,`h` and colour
   `color`.

Expected shape:

```ts
if(this.emissiveCount>=512)return;
this.emissiveCount++;
this.box(x,y,z,w+2,h+2,0,color-1,owner,-4);
this.box(x,y,z,w,h,0,color,owner,-4);
```

You may update the adjacent comment so it states that the halo is a hard,
one-pixel, same-family band and the core is unchanged.

The emitter audit contains only colours 17, 18, 22, 27, 31, and the same values
with the existing `+32` effect encoding. `color-1` therefore stays in the same
family. Do not add generic family search or another condition.

This is not alpha bloom. Both boxes are opaque exact-palette quads. The later
core overwrites the halo center through the existing `less-equal` depth state.
No new emitter position is allowed.

## Hard exclusions

Do not change any call site, emitter count cap, core dimensions, core colour,
owner, position, depth, screen mode, shader, blend state, pipeline, geometry,
face light, shadow, terrain, road, building, unit, effect timing, selection,
camera, controls, simulation, palette, capacity, or dependency.

Do not add alpha, a gradient, blur, texture, colour, draw pass, uniform,
allocation, particle, or file. Do not edit `sim/`, any other `src/` file, HTML,
CSS, docs, tasks, scripts, evidence, WASM, or package files.

## Definition of done

The orchestrator will require:

- full objective lighting, palette, texture, cliff, grid, and capacity gates;
- all 63 desktop/mobile runtime gates;
- exact deterministic hash `20b89f84`;
- >=59 fps, p95 <=20 ms, no console errors, no saturation;
- four-yaw fixed-light review;
- fresh independent target critic: lighting/contrast and unit readability are no
  longer the single largest gap.

## Allowed worker checks

You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 24 — add hard emissive halos"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
