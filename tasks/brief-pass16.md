# Brief — Astra coding pass 16: world-fixed lighting and value separation

You are the coding worker for one isolated Starhold rendering pass. Use GPT-6
Astra Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, visual metrics, or a critic. The orchestrator owns all
validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `docs/MOBILE_SPEC.md`
5. `docs/CIVILIZATIONS.md`
6. `docs/LIGHTING_CONTRAST_SPEC.md` — binding pass contract
7. `.dream-loop/target.png`
8. `evidence-p15/shot-main.png` — actual current frame
9. `src/renderer.ts`

## Current verified state

Implementation `0027680`, documentation head after the civilization contract.
The build, desktop, phone, tablet, portrait, deterministic WASM, exact palette,
terrain texture, cliff ramp, and instance saturation gates all pass. The live
Tailscale build is current.

Current canonical lighting measurements:

- coverage 42.720% — preserve between 40% and 46%;
- non-void mean 81.577 — target 86–94;
- non-void standard deviation 42.087 — target at least 44;
- luminance >=90: 30.796% — target at least 38%;
- luminance >=170: 4.066% — target 5.0–8.5%;
- palette outside pixels: 0 — must stay zero;
- texture density 0.2222: PASS;
- cliff lower/upper 0.848 and negative slope: PASS.

Fresh target comparison fails because the settlement is flat, dark, and hard to
read. The user explicitly likes the current map and civilization. Preserve them.

## Implement only this piece

Work only in `src/renderer.ts`. Prefer the first four items done well over extra
changes.

### 1. Make the light fixed in world space

The current face rule is too camera-relative and produces a uniformly top-lit
scene. Replace it with one north-west/above world light. Each box face already
carries a world-facing `shade` ID. Choose family steps from that world direction
before or independently of camera yaw. Rotating the camera must reveal different
lit faces; the light itself must not turn with the camera.

Use hard family steps only:

- top: authored base;
- north-west-facing: base or base minus one;
- cross-light: base minus one or two;
- south-east-facing: base minus at least two;
- underside/deep recess: darkest valid family entry or ink.

Solid geometry must never shade into palette index 0. Do not multiply RGB values.

### 2. Restore a clear building value hierarchy

Without changing any box dimensions or adding geometry:

- Charter Keep is the main ivory value landmark.
- Heliowell and active Prism Bastion are the secondary cyan/ivory landmarks.
- Hall, Forge, Court, and Wharf keep one readable lit facade and one dark facade.
- Hearth Pods and decorative props stay one value step quieter.
- Keep energy endpoints small; do not turn whole roofs or walls white/cyan.

Use existing call-site pigments or a bounded kind-aware light bias. Do not add
more windows, props, trim, particles, or boxes.

### 3. Separate the amethyst ground from the settlement

Keep every plate, crack, road, terrace, cliff, and prop in place. Rebalance only
existing palette choices and face steps:

- broad ground uses dark/middle violet;
- light violet remains a small chip/rim/crystal accent;
- north-west terrace lips read one step lighter;
- south-east ledges and foundation contacts read one step darker;
- roads remain visible but cannot compete with Keep walls or unit highlights;
- preserve the pass-15 texture component sizes and cliff ramp.

### 4. Make actors readable without resizing them

- Raise one small friendly core/shoulder face by one family step where needed.
- Keep full one-pixel ink contours.
- Keep Reaver broad armor dark; preserve one orange weapon focal pixel.
- Prevent the eastern battle from merging into one dark mass.
- Strengthen the selected ring with bright gold segments and an ink gap from the
  ground. It must remain readable at the phone layout.
- Do not move, resize, respawn, or change any entity.

### 5. Keep hard, connected shadows

Cast direction is south-east in world space for every yaw. Improve the existing
contact/cast value only if required for grounding. Shadows remain short,
connected, opaque, and palette-bound. Do not add a pass, blur, alpha, or detached
halo.

## Non-goals and untouched scope

- No civilization registry or missing unit/building implementation in this pass.
- No map, terrain topology, road, prop, architecture, footprint, camera, zoom,
  composition, HUD, mobile layout, input, simulation, balance, or timing change.
- Do not edit `sim/`, `src/main.ts`, `src/kinds.ts`, HTML, CSS, docs, tasks,
  scripts, evidence, WASM, package files, or dependencies.
- Do not add files.

## Hard invariants

- Raw WebGPU/WGSL and fixed 960×540 physical raster.
- Exact 32-colour palette. No new hex, gradient, bloom, antialiasing, alpha
  lighting, `Math.random`, texture, draw pass, or per-frame allocation.
- Preserve `MAX=16000`, saturation reporting, contour ownership, picking, HUD
  buttons, `buttonGlyphPixels()`, and the mobile path.
- Preserve Rust/WASM ABI, seed, deterministic state, camera and controls.
- Required post-pass performance: at least 59 fps and p95 at most 20 ms.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

These are compile checks, not final validation. Do not run
`scripts/capture.mjs`, `scripts/measure-detail.py`, any server, screenshot, or
critic.

## Definition of implementation done

- The renderer has one coherent world-fixed hard-light system.
- Existing geometry and simulation interfaces are untouched.
- TypeScript/build compilation succeeds if you choose to run it.
- Commit only `src/renderer.ts` with:

`git add src/renderer.ts && git commit -m "art: pass 16 — world-fixed light and value hierarchy"`

End with changed file, exact lighting/value changes, compile result, remaining
risk, and commit ID. Stop. The orchestrator will validate and may reject it.
