# Brief — Astra coding pass 1: foundation (gpt-6-astra, reasoning medium, fast)

You are a **coding agent** on the Starhold demo. You implement. You do NOT test,
validate, screenshot, or run servers — the orchestrator does that.

## Read first, in this order

1. `/home/bobbyranka/Cowork/starhold/docs/DIRECTIVE.md` — the user's requirements.
2. `/home/bobbyranka/Cowork/starhold/docs/INTERFACE.md` — the BINDING contract
   (WASM ABI, `window.__APP`, DOM button ids, build commands, performance limits).
3. `/home/bobbyranka/Cowork/starhold/docs/WORLD_PLAN.md` — the world design.
4. `/home/bobbyranka/Cowork/starhold/.dream-loop/target.png` — the target screenshot
   (look at it; it is the visual bar).
5. The repo as it stands: `package.json`, `tsconfig.json`, `scripts/`, `docs/`.

## Current state

Empty project. Scaffold exists only: `package.json` (vite+typescript+playwright,
scripts `wasm`/`dev`/`build`/`preview`/`capture`), `tsconfig.json`, `.gitignore`,
`scripts/build-wasm.sh`, `scripts/capture.mjs` (orchestrator-owned; read it — it
defines exactly how you will be validated), `docs/`, `tasks/`.

Nothing else exists yet: no `index.html`, no `src/`, no `sim/`.

## Your job this pass — the vertical slice

Build the whole pipeline end-to-end so that `npm run build` produces a working
page and `node scripts/capture.mjs` can boot it. Specifically:

1. **`sim/`** — the Rust crate (name `starhold_sim`), cdylib, no external crates.
   Implement the ABI from `INTERFACE.md` exactly:
   `memory`, `sim_init(seed)`, `sim_step(dt_ms)`, `sim_entity_count()`,
   `sim_entity_ptr()`, `sim_entity_stride()`.
   Also add `sim_select(i32)` per WORLD_PLAN.md line 157 (needed for click select).
   Implement: seeded PRNG, a 32x32 terrain heightfield, the opening world from
   WORLD_PLAN.md with the preloaded opening queue (buildings under construction at
   t=0..120), a handful of units that walk, the first raid wave arriving at t=36s,
   and the entity array. Fixed 60 Hz internal tick, accumulator-driven.
   This pass does not need the full economy or all eight building types — but the
   slice must be genuinely alive: units move and work, a building visibly assembles,
   raiders arrive and shoot.

2. **`index.html` + `src/`** — TypeScript, raw WebGPU (WGSL), no three.js:
   - WebGPU device init, clear error overlay if `navigator.gpu` is missing.
   - Render target 480x270, nearest-neighbour upscale to the canvas (letterboxed
     16:9, integer scale when possible).
   - Orthographic isometric camera: pitch 35.264°, yaw step 0..3 (45° + 90°·step).
   - Draw: terrain (instanced boxes/tiles by height), buildings (instanced boxes
     with per-face shading), units (billboards or boxes — your call, keep them
     readable at 7-11 px), ground shadows.
   - Palette quantisation pass using the exact 32 colours in WORLD_PLAN.md.
   - WASM loaded via `WebAssembly.instantiateStreaming('/sim.wasm')`; the entity
     array is read directly out of `memory.buffer` as a Float32Array view
     (re-create the view after any possible memory growth).
   - Fixed-timestep loop: sim at 60 Hz, render decoupled.
   - Click selection: screen -> ray -> nearest entity (buildings and units).
   - DOM buttons `#rotate-left`, `#rotate-right`, `#zoom-out`, `#zoom-in` wired to
     the exact camera step/zoom values in WORLD_PLAN.md (4 zoom steps).
   - HUD: top strip (title + alloy/charge), bottom-left selection panel showing
     name + HP, hidden when nothing is selected.
   - `window.__APP` exactly as `INTERFACE.md` defines (read `scripts/capture.mjs`
     to see every field the harness reads; `getState()` must return live values).

3. **`vite.config.ts`** if needed for the dev server; `public/sim.wasm` is produced
   by `scripts/build-wasm.sh` (already written — do not change it).

## Hard rules

- Keep the WASM ABI and `window.__APP` surface exactly as specified.
- Rust: `cargo build --release --target wasm32-unknown-unknown`; raw
  `extern "C"` exports; NO wasm-bindgen, NO wasm-pack, NO external crates.
- Renderer: raw WebGPU + WGSL only. No three.js, no WebGL fallback, no npm 3D libs.
- Palette: only the 32 colours from WORLD_PLAN.md, quantised in the shader.
- Deterministic sim: seeded PRNG, fixed 60 Hz, no `Math.random`.
- No per-frame allocations in the render loop.
- You MAY run `cargo build`/`cargo check` and `npx tsc --noEmit` to confirm your
  code compiles. That is not testing. Do NOT start the dev server, do NOT take
  screenshots, do NOT write test files, do NOT run capture.mjs.
- Work only inside `/home/bobbyranka/Cowork/starhold`. Do not modify
  `docs/`, `tasks/`, or `scripts/capture.mjs`.
- Commit when done:
  `git -C /home/bobbyranka/Cowork/starhold add -A && git commit -m "slice: foundation — sim, renderer, camera, selection, HUD"`

## Definition of done for this pass

- `npm run build` succeeds (wasm + tsc + vite).
- `public/sim.wasm` exists and exports the ABI above.
- The page renders the colony on an isometric camera at 480x270 internal
  resolution, with the palette applied.
- Both rotate buttons and both zoom buttons change camera state; a click can
  select a unit or building; the HUD updates.
- `window.__APP.getState()` returns real values for every field.

End with a summary: files created, what works, what is unfinished, assumptions.
