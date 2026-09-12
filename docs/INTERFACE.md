# Interface contract — Starhold (binding)

Every coding agent must satisfy this. The orchestrator validates against it.

## Repository layout

```
starhold/
  index.html            # entry page, loads /src/main.ts
  src/                  # TypeScript front-end (WebGPU renderer, input, UI)
  sim/                  # Rust simulation crate -> wasm32-unknown-unknown
    Cargo.toml
    src/lib.rs
  public/               # static assets (wasm output lands here as /sim.wasm)
  docs/                 # plan, evidence
  scripts/
    build-wasm.sh       # cargo build + copy to public/sim.wasm
    capture.mjs         # headless validation harness (orchestrator-owned)
```

## Build

- `npm run wasm` → builds `sim/` to `public/sim.wasm` (must work offline after first
  `rustup target add wasm32-unknown-unknown`; the target is installed).
- `npm run dev` → wasm build + vite dev server on port 5199.
- `npm run build` → wasm + `tsc --noEmit` + `vite build`.
- The Rust crate must build with plain `cargo build --release --target
  wasm32-unknown-unknown` — no wasm-bindgen, no wasm-pack. Use raw
  `#[no_mangle] pub extern "C"` exports and linear memory.

## WASM ABI (raw, no bindgen)

The module is instantiated with `WebAssembly.instantiateStreaming` and imports
nothing (or only satisfies trivial imports). Required exports:

| Export | Signature | Meaning |
|---|---|---|
| `memory` | Memory | exported linear memory |
| `sim_init` | `(seed: u32) -> void` | seed + build the world |
| `sim_step` | `(dt_ms: f32) -> void` | advance the sim one fixed tick |
| `sim_entity_count` | `() -> u32` | number of live entities |
| `sim_entity_ptr` | `() -> *const f32` | pointer to a flat f32 entity array |
| `sim_entity_stride` | `() -> u32` | floats per entity |

Entity array layout (floats, per entity, in order):
`x, y, z, yaw, kind, state, anim_phase, health, selected, faction, param0, param1`

`kind` codes and `state` codes are defined in `docs/WORLD_PLAN.md`; keep a comment
block in `sim/src/lib.rs` as the single source of truth and mirror it in
`src/kinds.ts`.

## Runtime contract (the page MUST expose these)

`window.__APP` object, present as soon as the module script starts:

```ts
window.__APP = {
  ready: boolean,                 // true once the first frame has rendered
  error: string | null,           // first fatal error text, else null
  getState(): {                   // called by the capture harness
    yawSteps: number,             // 0..3, camera rotation in 90° steps
    zoom: number,                 // camera distance scalar
    selected: number | null,      // entity index or null
    entityCount: number,
    fps: number | null,           // last measured fps (1s window), null until ready
    frameStats: { drawCalls: number; triangles: number } | null
  },
  rotate(dir: 1 | -1): void,      // what the on-screen rotate buttons call
  zoomBy(delta: 1 | -1): void,    // what the +/- buttons call
  selectAt(x: number, y: number): void  // screen-space click, same as canvas click
}
```

These must be the SAME functions the visible UI buttons call — the harness clicks
the real DOM buttons, and `__APP.onclick` is the fallback path.

## UI requirements (visible, clickable)

- A rotate-left and rotate-right button (camera yaws exactly ±90° per click).
- `+` and `-` zoom buttons.
- Both control clusters must be real DOM elements with stable ids:
  `#rotate-left`, `#rotate-right`, `#zoom-in`, `#zoom-out`.
- A small HUD panel that shows the selected entity's name and health when something
  is selected (this is also how the harness proves selection visually).

## Rendering requirements

- WebGPU only (`navigator.gpu`); show a clear error overlay if unavailable.
- Internal render resolution **480x270**, upscaled to the canvas with
  nearest-neighbour (pixel-art lock). The canvas fills the window, letterboxed
  to preserve 16:9.
- Isometric camera: orthographic, pitch ≈ 35.264°, yaw = 45° + 90°·step.
- Palette locked to `docs/WORLD_PLAN.md` (24-40 colors). No colours outside it.
- Every pixel sampled from the palette: quantise in the shader (post pass) so no
  anti-aliasing or gradients leak through.

## Performance contract

- Sim runs at a fixed 60 Hz timestep, decoupled from rendering.
- Renderer must hold **>60 fps** at 960x540 canvas (480x270 internal) on Intel
  gen-9 integrated graphics with headless SwiftShader off (hardware Vulkan).
- No per-frame allocations in the render loop; no `Math.random` in the sim.
- Prefer one instanced draw per entity kind; batch by texture/material.

## Determinism

- Same seed → same world and same first 600 ticks. The harness checks that
  `entityCount` and the entity array hash match across two fresh loads.
