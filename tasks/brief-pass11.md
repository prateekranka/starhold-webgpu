# Brief — Astra coding pass 11: finer pixel grid and directional light

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one structural visual piece. Do not run the game, capture screenshots, or
judge the result. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — terrain pixel math and palette lock
4. `.dream-loop/target.png` (1672×941)
5. `evidence-p9/shot-main.png` (960×540 capture)
6. `src/renderer.ts`, `src/main.ts`

## Verified state

Build PASS; 7/7 runtime gates; 60.3 fps; p95 17.0 ms; no console errors; deterministic
replay hash matched. Unit roles, faction colours, contours, and combat effects exist.

A fresh independent vision critic compared the actual frame against the target and
returned FAIL with this diagnosis:

> Ugly pixel scale and flat lighting — the build's sprites are about half the target's
> pixel density with a single ambient value and no cast shadows, occlusion or
> emissive glow, so buildings, turrets and the enemy cluster collapse into
> undifferentiated chunky blobs on a muddy grey-noise ground plane.
>
> NEXT PASS: Halve the pixel size of every sprite and terrain tile (double the internal
> render resolution, keep the same world scale), then bake one top-left directional
> light with per-building drop shadows onto the ground layer, and add an additive
> emissive pass on crystal clusters, window slits and muzzle flashes.

The orchestrator measured this objectively with ffmpeg pixel-run analysis:

- Target: median identical-colour run = **1 px** at 1672×941.
- Build: median identical-colour run = **4 px** at 960×540 (2 px art-pixel blocks).

The build's art grid is about half the target's effective density. This is the single
biggest visible gap.

## Implement only this piece

### A. Double the internal render resolution, keep world scale

- Internal render target: **480×270 → 960×540** (exactly 2×; same 16:9 aspect).
- Presentation: the canvas is now 960×540 at scale 1 (was 480×270 at scale 2). Keep the
  existing integer-only upscale rule for larger windows and non-integer downscale for
  smaller ones. No smoothing; nearest sampling only.
- World scale, camera pitch, yaw steps, zoom ladder, and all world coordinates stay
  exactly as they are. Only the pixel grid becomes finer. Ground diamonds change from
  12×7 px to 24×14 px at default zoom; keep the 35.264° pitch and the 6.928 px-per-unit-z
  relationship scaled to the new grid.
- Update every hard-coded pixel constant that assumed 480×270 — render targets, depth
  textures, scissor/viewport rects, HUD origin, pixel-snapping quantisation, selection
  ring sizes, effect pixel sizes, and the `pick()` screen→world mapping used by
  `__APP.selectAt`. Selection must still land on the same entity after the change.
- Bitmap glyphs and DOM HUD stay legible at the new grid; do not let text shrink.

### B. One directional light with real shading

- Add a single fixed directional light from the **top-left** (screen-space) with a
  constant direction for all yaws, so the look is stable while rotating.
- Faces must differ by orientation: top faces brightest, left faces mid, right faces
  darkest (or the mirror if that suits the top-left key). Use only the existing palette
  families — no new colours, no smooth gradients.
- Cast a short, hard-edged drop shadow on the ground for buildings and combat units.
  Shadow colour must come from the void/ink family. Shadows are solid coverage (no
  partial alpha, no blur, no soft edges).
- Keep the palette quantisation pass last, unchanged.

### C. Palette-safe emissive accents

- Crystal clusters, window slits, reactor seams, and muzzle flashes get 1–2 px of the
  brightest entry in their family so they read as light sources against the dark rock.
- Total bright/hot pixels must stay under 4% of the frame, per WORLD_PLAN.md.
- **No additive blending, no bloom, no glow blur.** Brightness comes from discrete
  palette steps only.

## Hard invariants

- Preserve the raw Rust WASM ABI and the `window.__APP` interface exactly.
- Fixed 60 Hz deterministic sim, seed 73129, no `Math.random`.
- Do not change entity counts, spawn times, health, damage, economy, construction,
  opening schedule, camera controls, or zoom count.
- Raw WebGPU + WGSL only. No dependencies, no Three.js, no WebGL fallback.
- **Performance is a hard gate: fps ≥ 59 with p95 ≤ 20 ms at 960×540.** If doubling the
  internal resolution threatens that, reduce fill cost (smaller effect quads, fewer
  overdraw layers, tighter frustum) rather than lowering the resolution back.
- ≤64 draw calls, ≤100k triangles, no new per-frame heap allocation.
- Work only in `src/renderer.ts`, `src/main.ts`, `index.html`, `src/style.css`.
- Do not edit `docs/`, `tasks/`, `scripts/`, evidence, `public/sim.wasm`, or `sim/`.
- You may run only `npx tsc --noEmit` and `npm run build`.

## Commit

`git add -A && git commit -m "render: pass 11 — 960x540 pixel grid, directional light, emissive accents"`

End with changed files, the exact resolution/lighting changes, remaining weakness, and
assumptions. Stop after implementation.
