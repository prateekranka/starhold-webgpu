# Brief — Astra coding pass 26: widen hard emissive cores

You are the coding worker for one Starhold lighting correction. Use GPT-6 Astra
Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 25
2. `evidence-p25/metrics-desktop.txt`, `critic-deepseek-main.txt`,
   `critic-cursor-auto-main.txt`, `critic-deepseek-focused.txt`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, method `emissive()`

## Required starting state

- Branch `master` at commit `c23b0b6` ("art: pass 25 — enlarge hard emissive cores").
- The working tree must be clean before you edit. Untracked evidence files and
  scripts may exist; leave them untouched.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed.
  Never use `/home/bobbyranka/.codex-astra` or another account.

Pass 25 enlarged each opaque core from `(w,h)` to `(w+2,h+2)`. All objective
gates pass, but two fresh independent critics still name emissive punch as the
single largest gap, and a focused critic selected one further pixel of
enlargement on every side.

## This pass — one expression change

Edit only `src/renderer.ts`, inside method `emissive()`.

Keep one box per emitter. Change only its dimensions from `w+2,h+2` to `w+4,h+4`:

```ts
this.emissiveCount++;
this.box(x,y,z,w+4,h+4,0,color,owner,-4);
```

Keep the core colour, x/y/z position, owner, depth, mode -4, 512 cap, and one
counter increment unchanged. Update only the adjacent comment to state that the
core gets a hard two-pixel expansion on every side. It is still one opaque
exact-palette quad.

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
- fresh independent target critics; lighting/contrast and unit readability must
  no longer be the single largest gap.

## Allowed worker checks

You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 26 — widen hard emissive cores"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
