# Brief — Astra coding pass 28: deepen the east wall shade step

You are the coding worker for one Starhold lighting correction. Use GPT-6 Astra
Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 27
2. `evidence-p27/metrics-desktop.txt`, `critic-deepseek-main.txt`,
   `critic-cursor-auto-main.txt`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, the `faceSteps` declaration in the vertex shader

## Required starting state

- Branch `master` at commit `044fcf4` ("art: pass 27 — deepen lower cliff faces").
- The working tree must be clean before you edit. Untracked evidence files and
  scripts may exist; leave them untouched.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed.
  Never use `/home/bobbyranka/.codex-astra` or another account.

Pass 27 deepened the lower cliff faces; both fresh critics now prefer it for
depth but still name the missing carved sun/shade separation as the largest gap.
Both lit and shaded wall faces must separate harder.

## This pass — one expression change

Edit only `src/renderer.ts`, in the vertex shader. The current line is:

```wgsl
let faceSteps=array<f32,6>(0.,1.,1.,0.,2.,32.);
```

Change only the east entry from `2.` to `3.`:

```wgsl
let faceSteps=array<f32,6>(0.,1.,1.,0.,3.,32.);
```

Update the adjacent comment so it says the east face loses three steps. Every
other entry, the key lift, the bounce restore, the actor and building top rules,
the family floor, and the `max(1., ...)` clamp stay exactly as they are.

## Hard exclusions

Do not change any other line. Do not add alpha, blend, gradients, textures,
colours, particles, uniforms, draw passes, new geometry, or files. Do not change
terrain, roads, buildings, units, shadows, camera, controls, simulation,
palette, capacity, or dependencies. Do not edit `sim/`, any other `src/` file,
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

`git add src/renderer.ts && git commit -m "art: pass 28 — deepen east wall shade"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
