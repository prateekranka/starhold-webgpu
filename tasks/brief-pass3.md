# Brief — Astra coding pass 3: finish the world (gpt-6-astra, reasoning medium, fast)

You are a **coding agent** on the Starhold demo. You implement. You do NOT test,
validate, screenshot, or run servers — the orchestrator does that.

## Read first

1. `/home/bobbyranka/Cowork/starhold/docs/DIRECTIVE.md` — the user's requirements.
2. `/home/bobbyranka/Cowork/starhold/docs/INTERFACE.md` — the BINDING contract.
3. `/home/bobbyranka/Cowork/starhold/docs/WORLD_PLAN.md` — the full world design.
4. `/home/bobbyranka/Cowork/starhold/.dream-loop/target.png` — the target screenshot.
5. `/home/bobbyranka/Cowork/starhold/.dream-loop/current.png` — where the demo is now.
6. `src/renderer.ts`, `src/main.ts`, `sim/src/lib.rs`.

## Situation

Passes 1 and 2 built the pipeline and half the density pass. It builds, runs and
passes all 7 orchestrator gates (boots, 60 fps, rotate, zoom, click-select, no
console errors, determinism). What it does NOT yet look like is the target.

## The gap to close (verify against the two images yourself)

- **Units are near-invisible.** Target: ~20 readable inhabitants at 7–11 px with
  faction colour and distinct poses (mining, carrying, aiming, welding). Current:
  a few pale specks. Make every unit type read in silhouette and colour, with
  visible walk/attack/work poses. This is the single biggest gap.
- **Buildings are plain boxes.** Target: stepped ivory keeps with buttresses and
  fins, teal roofs, doors, gantry, chimney, crystal prongs. Current: flat slabs.
  Give each of the 8 building kinds its planned silhouette (WORLD_PLAN.md table)
  built from simple boxes — but stacked, stepped, coloured, with dark edges.
- **Construction must read as assembly.** The target's 71% Bastion shows open
  cheeks, exposed ribs, a crane hook and a gold selection ring. Current sites show
  a flat box. Show partial geometry: the parts built so far, ribs for the rest, a
  crane hook at the current assembly height, weld sparks.
- **Combat must be visible in a still.** Muzzle flashes, a tracer mid-flight, an
  arcing shell, an impact burst. Current: almost nothing.
- **Terrain has no language.** Target: basalt mesa edge with visible cliff faces and
  stepped ledges, worn road diamonds connecting buildings, an ore crescent of large
  violet shards, a crystal garden, foreground ruins/grass/dust.
- **Colour energy.** Use the full palette: teal hulls, gold cargo, cyan energy,
  wine-red raiders, violet crystals, ivory masonry. Current is washed grey-teal.
- **Ambient motion**: forge smoke, crystal glints, pennants/awnings, dust ribbons,
  service drones, the far freighter.
- **HUD**: selection panel with name + HP + job (`BUILDING 71%`), alloy/charge
  counters with small icons, buttons matching the target's dark square style.

Work in that order. Items 1–3 matter most; do them well before polishing 7–8.

## Hard rules

- Keep the WASM ABI and `window.__APP` surface exactly as `INTERFACE.md` defines.
- Rust: `cargo build --release --target wasm32-unknown-unknown`; raw `extern "C"`;
  no wasm-bindgen, no wasm-pack, no external crates. The sim file is dense — you
  may restructure it for clarity as long as the ABI and behaviour are unchanged.
- Renderer: raw WebGPU + WGSL only. No three.js, no WebGL fallback.
- Palette: only the 32 colours in WORLD_PLAN.md, quantised in the shader. No
  antialiasing, gradients or bloom.
- Deterministic sim, fixed 60 Hz, no `Math.random`.
- Keep it FAST: the orchestrator gates on fps ≥ 59 with p95 ≤ 20 ms at 960x540.
  Draw calls ≤ 64, triangles ≤ 100k. No per-frame allocations in the render loop.
- You MAY run `cargo build` and `npx tsc --noEmit`. Do NOT start the dev server,
  screenshot, or run capture.mjs.
- Work only inside `/home/bobbyranka/Cowork/starhold`. Do not modify `docs/`,
  `tasks/`, or `scripts/capture.mjs`.
- Commit when done: `git add -A && git commit -m "world: pass 3 — readable units, building silhouettes, construction, combat FX"`

## Definition of done

- `npm run build` succeeds.
- Side by side with the target, the scene reads as the same game: same camera,
  comparable density, readable inhabitants, distinct buildings, visible construction
  and combat, full palette energy.

End with a summary: files changed, what now matches the target, what is still
missing, assumptions made.
