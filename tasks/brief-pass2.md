# Brief — Astra coding pass 2: build the world out (gpt-6-astra, reasoning medium, fast)

You are a **coding agent** on the Starhold demo. You implement. You do NOT test,
validate, screenshot, or run servers — the orchestrator does that.

## Read first

1. `/home/bobbyranka/Cowork/starhold/docs/DIRECTIVE.md` — the user's requirements.
2. `/home/bobbyranka/Cowork/starhold/docs/INTERFACE.md` — the BINDING contract.
3. `/home/bobbyranka/Cowork/starhold/docs/WORLD_PLAN.md` — the full world design.
4. `/home/bobbyranka/Cowork/starhold/.dream-loop/target.png` — the target screenshot.
5. `/home/bobbyranka/Cowork/starhold/.dream-loop/current.png` — where the demo is now.
6. The source tree: `src/`, `sim/`.

## Look at both images first

Open the target and the current screenshot and compare them directly. The renderer
works (isometric camera, palette, HUD, selection, buttons all validated) but the
scene is **far too sparse and too pale** next to the target. Your job is to close
that gap.

## The gap to close (orchestrator's read — verify against the images yourself)

- **Density.** Target shows eight distinct buildings with strong silhouettes, roads
  connecting them, ore shards, a crystal garden, cliff faces and a foreground of
  ruins/grass. Current has a handful of pale boxes on a flat plate.
- **Readable inhabitants.** Target has ~20 units, each readable at 7–11 px with
  faction colours and poses (mining, carrying, aiming, welding). Current units are
  barely visible specks.
- **Colour energy.** Target uses the full 32-colour palette: teal hulls, gold cargo,
  cyan energy, wine-red raiders, violet crystals, ivory masonry. Current is washed
  to a few greys and teals.
- **Live action.** Target shows a muzzle flash, tracers, an arcing shell, a crane
  hook mid-lift, dust and pennants. Current shows almost no motion in a still.
- **Construction reads as assembly.** The selected 71% Bastion in the target has
  open cheeks, exposed ribs, a crane hook and a segmented gold selection ring.
- **Terrain language.** Target: basalt mesa with visible cliff faces, stepped
  ledges, ore crescent, crystal garden, worn roads, foreground ruins.

## Build these (from WORLD_PLAN.md, in priority order)

1. All eight building types with their construction stages, at the plan's
   coordinates and footprints.
2. The full unit roster with visible silhouettes and distinct animation poses.
3. Ore nodes + mining/carrying loop + cargo handoffs; the Heliowell charge pulse.
4. Roads (worn flagstone diamonds) and the terrain height language: mesa top,
   cliff faces, ore crescent, crystal garden, basin rim.
5. Combat readability: muzzle flashes, tracers, bolts, the Strider's arcing shell,
   impacts, the wave-warning pulses on the causeway.
6. Ambient motion inventory: dust ribbons, forge smoke, crystal glints, pollen,
   pennants/awnings, service drones, the far sky freighter, grass sway.
7. HUD completion: selection panel with name + HP + job (e.g. `BUILDING 71%`),
   alloy/charge counters, and the four buttons restyled to match the target.

Work in the order above; if you run out of room, prefer 1–3 done well over 7
attempted.

## Hard rules

- Keep the WASM ABI and `window.__APP` surface exactly as `INTERFACE.md` defines
  (the orchestrator's harness depends on them; changing them fails the build gate).
- Rust: `cargo build --release --target wasm32-unknown-unknown`; raw `extern "C"`;
  no wasm-bindgen, no wasm-pack, no external crates.
- Renderer: raw WebGPU + WGSL only. No three.js, no WebGL fallback.
- Palette: ONLY the 32 colours in WORLD_PLAN.md; quantise in the shader; no
  antialiasing, no gradients, no bloom.
- Deterministic sim: seeded PRNG, fixed 60 Hz, no `Math.random`.
- Keep it FAST: the orchestrator gates on fps ≥ 59 with p95 ≤ 20 ms at 960x540.
  Draw calls ≤ 64, triangles ≤ 100k, entity cap as the plan states. No per-frame
  allocations in the render loop.
- You MAY run `cargo build` and `npx tsc --noEmit` to confirm compilation.
  Do NOT start the dev server, screenshot, or run capture.mjs.
- Work only inside `/home/bobbyranka/Cowork/starhold`. Do not modify `docs/`,
  `tasks/`, or `scripts/capture.mjs`.
- Commit when done: `git add -A && git commit -m "world: density pass — buildings, units, terrain, motion"`

## Definition of done

- `npm run build` succeeds.
- At a glance, the running scene reads as the same GAME as the target: same
  camera, same palette energy, comparable density, units readable in silhouette,
  visible ongoing construction and combat.
- All `window.__APP` fields still live and honest.

End with a summary: files changed, what now matches the target, what is still
missing, assumptions made.
