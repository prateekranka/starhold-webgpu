# Brief — Astra coding pass 12: lit terrain, contact shadows, unit re-scale

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one coherent lighting piece. Do not run the game, capture screenshots, or
judge the result. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — terrain, palette lock, lighting rules
4. `.dream-loop/target.png`
5. `evidence-p11/shot-main.png` — the actual 960×540 frame
6. `src/renderer.ts`

## Verified state

Pass 11 landed the finer grid: build PASS, 7/7 runtime gates, 60.3 fps, p95 17.2 ms,
deterministic hash unchanged, 32 colours exactly, and the frame now renders on a true
1 px grid (was 2 px blocks). Two independent blind critics still return FAIL.

Critic A (terrain):

> There is no elevation shading, cast shadow or light source: every cliff face, tile and
> structure sits on one flat mid value with no downward darkening ramp, so the plateau
> reads as a paper-flat tilemap instead of the target's lit, sculpted mesa.

Critic B (units):

> Units use the same palette as the nearby buildings and have no strong team-colour pop,
> so they disappear into the base footprint at glance distance.

The orchestrator confirms both by inspection: the plateau top is a uniform plane, the
cliff rim does not darken downward, structures have no contact shadow, and the largest
unit silhouette now reads almost as large as a building.

## Implement only this piece

### A. A lit, sculpted mesa (highest priority)

- Choose ONE fixed key-light direction in screen space (top-left) and apply it to every
  world object at all four yaws: **top faces brightest, one lateral face mid, the other
  lateral face darkest**, consistent for terrain, buildings and units.
- Cliff/terrain side faces get a vertical value ramp that darkens downward in discrete
  palette steps (3–4 steps, hard edges, no dithering gradient).
- Plateau top surfaces must read clearly lighter than any side face.
- **Measurable acceptance:** in the final frame, the mean luminance of the bottom cliff
  band must be at least 25% lower than the mean luminance of the plateau top surface.
- Do not add colours outside the 32-colour palette. Build the ramp from the existing
  stone/void families already listed in WORLD_PLAN.md.

### B. Contact and drop shadows

- Every building and every combat unit gets a solid, hard-edged dark footprint where it
  meets the ground: 1–2 px of the darkest ink family at the contact edge (ambient
  occlusion), plus a short drop shadow offset toward the side opposite the key light.
- Shadows are solid coverage — no alpha, no blur, no soft falloff, no additive blending.
- Shadow length must not exceed about 0.5 tile, and must not make two adjacent units
  merge into one dark mass.

### C. Re-scale units for the 2× grid

- Unit pixel sizes were tuned for the old 480×270 grid. Re-check every role at 960×540
  and re-tune so that: workers read smallest, line units roughly 8–14 px tall, and **no
  unit silhouette exceeds about 1.5 world tiles in its largest dimension**.
- Fix the oversized broad wing shape if it currently reads as large as a building.
- Keep the team-colour separation from Critic B: friendly fills must not match building
  trim. Where a unit crosses a building face, its 1 px dark contour must stay continuous.
- Do not change unit counts, roles, or behaviour.

## Hard invariants

- Preserve the raw Rust WASM ABI, `window.__APP`, and the 960×540 internal render target.
- Fixed 60 Hz deterministic sim, seed 73129, no `Math.random`.
- Do not change entity counts, spawn times, health, damage, economy, construction,
  opening schedule, camera yaw/zoom behaviour, or controls.
- Raw WebGPU + WGSL only. No dependencies. Exactly 32 palette colours, no antialiasing.
- **Performance gate: fps ≥ 59 with p95 ≤ 20 ms at 960×540.** Headroom measured at
  515 fps uncapped, so this change must not regress it meaningfully.
- ≤64 draw calls, ≤100k triangles, no new per-frame heap allocation.
- Work only in `src/renderer.ts` and `src/main.ts`.
- Do not edit `docs/`, `tasks/`, `scripts/`, evidence, `sim/`, or `public/sim.wasm`.
- You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

`git add -A && git commit -m "render: pass 12 — lit terrain ramp, contact shadows, unit rescale"`

End with changed files, the exact light direction and ramp steps, the measured cause of
the larger unit, remaining weakness, and assumptions. Stop after implementation.
