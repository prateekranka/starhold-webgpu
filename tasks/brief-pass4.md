# Brief — Astra coding pass 4: readability and life (gpt-6-astra, reasoning medium, fast)

You are a **coding agent** on the Starhold demo. You implement. You do NOT run the
dev server, screenshot, or validate — the orchestrator does that.

## Read first

1. `/home/bobbyranka/Cowork/starhold/docs/DIRECTIVE.md`
2. `/home/bobbyranka/Cowork/starhold/docs/INTERFACE.md` (binding)
3. `/home/bobbyranka/Cowork/starhold/docs/WORLD_PLAN.md`
4. `/home/bobbyranka/Cowork/starhold/.dream-loop/target.png` — the target
5. `/home/bobbyranka/Cowork/starhold/evidence-p3b/shot-main.png` — the demo at t=108s
   (this is the frame the orchestrator judges every pass on)
6. `src/renderer.ts`, `src/main.ts`, `sim/src/lib.rs`

## What the orchestrator saw at t=108s (fix these, in this order)

1. **The raid is invisible.** WORLD_PLAN.md puts wave 2 (6 Jackals) mid-advance at
   t=108s, engaging the eastern defense. In the captured frame there is no enemy on
   screen and no combat. Make enemies and combat unmistakable AT THAT MOMENT:
   red units on the eastern road, muzzle flashes, tracers in flight, an impact.
   Verify by stepping the sim yourself: the orchestrator captures at
   tick 6480 (t=108s) exactly.
2. **Units are still hard to read.** Colony units exist but are pale and lost against
   the stone. Give every unit a dark 1-pixel silhouette edge (the ink family) so it
   separates from the ground, plus stronger faction colour blocks. Target shows
   workers/soldiers reading clearly at 7-11 px.
3. **Terrain is one flat grey plate.** Target: basalt mesa with VISIBLE cliff faces
   (vertical striations, alternating ledges), worn pale roads linking buildings, an
   ore crescent, a crystal garden, and a foreground with ruins/grass/dust. The mesa
   edge needs real vertical face shading — currently the rim is nearly flat.
4. **Ambient life is missing.** Add the motion inventory's cheapest wins: forge smoke
   puffs, crystal glints, pennants/awnings on buildings, dust ribbon, 2 service
   drones, grass sway. These should be visible in a still frame.
5. **HUD**: show the selection panel content (name + HP + job) with the plan's
   wording, and confirm alloy/charge counters update (they read 300/200 now — the
   plan's cap is 300 alloy / 200 charge; check the economy actually spends).

## Also do this (small, exact)

Add to `window.__APP` (see INTERFACE.md):
`fastForward(seconds: number): void` — advance the simulation that many seconds
immediately by looping the fixed-step update without rendering. The orchestrator's
harness uses it to reach t=108s instantly; without it every validation costs 2
minutes of wall clock.

## Hard rules

- Keep the WASM ABI and `window.__APP` surface exactly as `INTERFACE.md` defines.
- Rust: raw `extern "C"`, no wasm-bindgen, no wasm-pack, no external crates.
- Renderer: raw WebGPU + WGSL only. No three.js, no WebGL fallback.
- Palette: only the 32 colours in WORLD_PLAN.md. No antialiasing/gradients/bloom.
- Deterministic sim: seeded PRNG, fixed 60 Hz, no `Math.random`.
- Performance: fps ≥ 59 with p95 ≤ 20 ms at 960x540; draw calls ≤ 64; triangles ≤ 100k.
  No per-frame allocations in the render loop.
- You MAY run `cargo build` and `npx tsc --noEmit`. Nothing else.
- Work only inside `/home/bobbyranka/Cowork/starhold`. Do not modify `docs/`,
  `tasks/`, or `scripts/`.
- Commit: `git add -A && git commit -m "world: pass 4 — readable units, visible raid, terrain faces, ambient life"`

## Definition of done

`npm run build` succeeds; at t=108s the frame shows a readable colony under attack,
with cliff faces, roads and ambient motion — recognisably the same game as the target.

End with a summary: files changed, what is fixed, what is still weak, assumptions.
