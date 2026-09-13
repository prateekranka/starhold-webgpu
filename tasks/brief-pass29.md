# Brief — Astra coding pass 29: brighten the cliff top rim

You are the coding worker for one Starhold lighting correction. Use GPT-6 Astra
Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 28
2. `evidence-p28/metrics-desktop.txt`, `critic-deepseek-main.txt`,
   `critic-cursor-auto-main.txt`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, the fragment shader cliff-ramp line inside `fs()`

## Required starting state

- Branch `master` at commit `b41b3ef` ("art: pass 28 — deepen east wall shade").
- The working tree must be clean before you edit. Untracked evidence files and
  scripts may exist; leave them untouched.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed.
  Never use `/home/bobbyranka/.codex-astra` or another account.

Pass 27 gave the cliffs a near-black base; both fresh critics still ask for a
bright lit rim over those dark faces. This pass brightens only the rim band.

## This pass — one expression change

Edit only `src/renderer.ts`, in the fragment shader inside `fs()`. The current
line is:

```wgsl
if i.cliff.x>=0. {let band=select(0.,1.,i.cliff.x<.85)+select(0.,1.,i.cliff.x<.65)+select(0.,1.,i.cliff.x<.40);f.color=vec4f(palette[u32(max(1.,i.cliff.y-band-select(0.,1.,band>=1.)))],1.);}
```

Change only the step term so the top rim (`band==0`) gains one family step while
every deeper band keeps its current value:

```wgsl
if i.cliff.x>=0. {let band=select(0.,1.,i.cliff.x<.85)+select(0.,1.,i.cliff.x<.65)+select(0.,1.,i.cliff.x<.40);f.color=vec4f(palette[u32(max(1.,i.cliff.y-band+select(1.,-1.,band>=1.)))],1.);}
```

Update the adjacent comment to say the bright rim gains one step over the
deepened base. Band thresholds, the select profiles
(`select(4.,3.,steps>=2.)`), the clamp, and every other line stay exactly as
they are.

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

`git add src/renderer.ts && git commit -m "art: pass 29 — brighten cliff top rim"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
