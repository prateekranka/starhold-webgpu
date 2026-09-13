# Brief — Astra coding pass 27: deepen the lower cliff faces

You are the coding worker for one Starhold lighting correction. Use GPT-6 Astra
Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 26
2. `evidence-p26/metrics-desktop.txt`, `critic-deepseek-main.txt`,
   `critic-cursor-auto-main.txt`, `critic-deepseek-focused27.txt`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, the fragment shader cliff-ramp line inside `fs()`

## Required starting state

- Branch `master` at commit `8a4e45f` ("art: pass 26 — widen hard emissive cores").
- The working tree must be clean before you edit. Untracked evidence files and
  scripts may exist; leave them untouched.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed.
  Never use `/home/bobbyranka/.codex-astra` or another account.

Measured against the target, the build has 0.00% of judged pixels below
luminance 25 where the target has 3.04%, and 20.0% in the muddy 60-90 band where
the target has 13.6%. Two fresh critics and a focused critic select one change:
deepen the lower cliff faces while keeping each cliff's bright top rim.

## This pass — one expression change

Edit only `src/renderer.ts`, in the fragment shader inside `fs()`. The current
line is:

```wgsl
if i.cliff.x>=0. {let band=select(0.,1.,i.cliff.x<.85)+select(0.,1.,i.cliff.x<.65)+select(0.,1.,i.cliff.x<.40);f.color=vec4f(palette[u32(max(1.,i.cliff.y-band))],1.);}
```

Add exactly one term so every band below the top rim drops one further family
step:

```wgsl
if i.cliff.x>=0. {let band=select(0.,1.,i.cliff.x<.85)+select(0.,1.,i.cliff.x<.65)+select(0.,1.,i.cliff.x<.40);f.color=vec4f(palette[u32(max(1.,i.cliff.y-band-select(0.,1.,band>=1.)))],1.);}
```

The top rim band (`band==0`) keeps its exact current value. Every deeper band
moves one discrete family step darker, and the existing `max(1., ...)` clamp
still forbids palette index 0. Update the adjacent comment to say that every
band below the top rim drops one further step so the cliff base reads
near-black.

## Hard exclusions

Do not change the band thresholds (`.85`, `.65`, `.40`), the select profiles
(`select(4.,3.,steps>=2.)`), the clamp, or any other line. Do not add alpha,
blend, gradients, textures, colours, particles, uniforms, draw passes, new
geometry, or files. Do not change terrain, roads, buildings, units, shadows,
camera, controls, simulation, palette, capacity, or dependencies. Do not edit
`sim/`, any other `src/` file, HTML, CSS, docs, tasks, scripts, evidence, WASM,
or package files.

## Definition of done

The orchestrator will require:

- full objective lighting, palette, texture, cliff, grid, and capacity gates
  (the cliff gate wants lower/upper <= 0.85 with a negative slope);
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

`git add src/renderer.ts && git commit -m "art: pass 27 — deepen lower cliff faces"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
