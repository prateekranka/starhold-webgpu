# Brief — Astra coding pass 30: lift large building tops to their endpoint

You are the coding worker for one Starhold lighting correction. Use GPT-6 Astra
Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/LIGHTING_CONTRAST_SPEC.md`, through pass 29
2. `evidence-p29/metrics-desktop.txt`, `critic-deepseek-main.txt`,
   `critic-cursor-auto-main.txt`
3. `.dream-loop/target.png`
4. `src/renderer.ts`, the "Larger non-actor top planes" branch in the vertex
   shader

## Required starting state

- Branch `master` at commit `f6dd663` ("art: pass 29 — brighten cliff top rim").
- The working tree must be clean before you edit. Untracked evidence files and
  scripts may exist; leave them untouched.
- Run `python3 tasks/quota-check.py` first. Continue only if Plus is allowed.
  Never use `/home/bobbyranka/.codex-astra` or another account.

Three fresh critic rounds keep naming the same gap: bright north-west tops over
deep faces. The large building tops still stop one step short of their family's
brightest entry.

## This pass — one expression change

Edit only `src/renderer.ts`, in the vertex shader, inside the branch that reads:

```wgsl
// Larger non-actor top planes gain one step toward their material endpoint.
if combat<17. && screen==0. && pigment>=4. && pigment<28. && shade==0. && max(size.x,max(size.y,size.z)) > .4 {
  let endpoint=select(select(select(select(9.,14.,pigment>=10.),18.,pigment>=15.),22.,pigment>=19.),27.,pigment>=23.);
  shaded=min(endpoint,shaded+1.);
}
```

Change only the lift amount from one step to two:

```wgsl
  shaded=min(endpoint,shaded+2.);
```

Update the adjacent comment so it says the large non-actor top planes gain up to
two steps toward their material endpoint. The `endpoint` terms, the size
condition, the actor rule (`.4` sized tops keep their one-step lift), the key
lift, the bounce restore, the family floor, and the clamp all stay exactly as
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

`git add src/renderer.ts && git commit -m "art: pass 30 — lift large building tops"`

End with exact changes, compile result, remaining risk, and commit ID. Stop. If
the Plus usage limit appears before commit, stop immediately and report the
untouched or partial state. Do not use another account.
