# Brief — Astra coding pass 25: enlarge hard emissive cores

You are the coding worker for one final Starhold lighting correction after the
Codex Plus primary-window reset. Use GPT-6 Astra Medium in standard mode.
Implement only. Do not run the game, a server, Playwright, screenshots, metrics,
or a critic. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 24
2. `evidence-p24/shot-main.png`, `metrics.txt`, and `critic.md`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, method `emissive()`

## Required starting state

- Branch `master`.
- Pass 24 is reverted by commit `570d70a`.
- `emissive()` is back to one opaque box at `(w,h)` with colour `color`.
- The working tree must be clean before you edit.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed
  after the reset. Never use `/home/bobbyranka/.codex-astra` or another account.

Pass 23 is the candidate base. Its objective lighting and runtime gates pass.
Both independent critics still say the existing 1×2 default emitter cores lack
the target's hard punch. Pass 24's darker halo failed and was reverted.

## This pass — one expression change

Edit only `src/renderer.ts`, inside method `emissive()`.

Keep one box per emitter. Change only its dimensions from `w,h` to `w+2,h+2`:

```ts
this.emissiveCount++;
this.box(x,y,z,w+2,h+2,0,color,owner,-4);
```

Keep the core colour, x/y/z position, owner, depth, mode -4, 512 cap, and one
counter increment unchanged. `w+2,h+2` adds one hard bright raster pixel on each
side. It is still one opaque exact-palette quad. Update only the adjacent comment
to state that the core gets a hard one-pixel expansion.

## Hard exclusions

Do not add a second box or halo. Do not use `color-1`. Do not change call sites,
emitter positions, colour, count cap, shader, blend state, pipeline, instances,
geometry, faces, shadows, terrain, roads, buildings, units, effect timing,
selection, camera, controls, simulation, palette, capacity, or dependencies.

Do not add alpha, gradients, blur, textures, colours, particles, uniforms, draw
passes, allocations, files, or tests. Do not edit `sim/`, any other `src/` file,
HTML, CSS, docs, tasks, scripts, evidence, WASM, or package files.

## Definition of done

The orchestrator will require:

- full objective lighting, palette, texture, cliff, grid, and capacity gates;
- all 63 desktop/mobile runtime gates;
- exact deterministic hash `20b89f84`;
- >=59 fps, p95 <=20 ms, no console errors, no saturation;
- four-yaw fixed-light review;
- fresh Cursor Auto and DeepSeek target critics; lighting/contrast and unit
  readability must no longer be the single largest gap;
- only after that, replacement of the frozen pass-15 Tailnet release.

## Allowed worker checks

You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 25 — enlarge hard emissive cores"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
