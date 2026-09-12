# Brief — Astra coding pass 5: make the battle readable (gpt-6-astra, medium, fast)

You are a **coding agent** on Starhold. Implement one visual piece. Do not test,
run a server, capture screenshots, or judge the result. The orchestrator does that.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `.dream-loop/target.png` (aspirational target)
5. `evidence-p4/shot-main.png` (actual running frame at t≈112s)
6. `src/main.ts`, `src/renderer.ts`, `sim/src/lib.rs`

## Evidence from pass 4

Objective gates: 7/7. WebGPU: 60.3 fps, p95 17.1 ms, no console errors,
deterministic entity count. The settlement, cliff faces, roads, palette, HUD, and
buildings are now strong.

The SINGLE BIGGEST GAP is occupancy/action readability. At t≈112s the frame
contains a good settlement but appears nearly unoccupied. The planned six-Jackal
raid reads as one small red blob at the far-right edge. Colony defenders/workers are
hard to count. One thin tracer is visible, but it does not read as an active battle.
The target has multiple separated actors, obvious opposing colours, and layered
combat motion around the eastern defense.

## Implement only this piece

Make the t=108–115s battle read clearly in one still frame at 480×270 internal
resolution.

Acceptance criteria for the composited screenshot:

1. **Six separate red Jackals are visible on-map**, not stacked. Put them in a
   two-rank wedge/arc across the eastern road and plaza. Keep at least 8 screen
   pixels between their centers at camera yaw 0, zoom 1. They must be inside the
   mesa, not hidden behind the east tower or clipped by the map edge.
2. **At least eight friendly actors are simultaneously visible** around the
   settlement (workers, Lancers, Windwrights, service drones). These must come from
   deterministic sim entities when they are selectable/combat units. Ambient service
   drones can be deterministic renderer actors only if they are non-gameplay life.
3. **Each faction reads at a glance.** Friendly actors: teal/white with a one-pixel
   ink edge. Hostiles: wine/red/sand with a one-pixel ink edge. Increase unit screen
   silhouette size only as needed (target 8–13 pixels high); do not inflate buildings.
   Give Jackals a clear forward lean and raised weapon; defenders a planted firing pose.
4. **Show an exchange, not a line.** At this capture moment include at least 3
   simultaneous projectiles/tracers, 2 muzzle flashes, and 1 impact burst. Use short,
   thick palette-colour marks that survive nearest-neighbor display. No gradients,
   bloom, or additive soft particles.
5. **Separate combat from scenery.** Keep the east approach clear enough that all
   six hostiles are legible. Do not remove the road, bastion, crystals, or cliff detail.
6. **Construction remains visible.** The selected Prism Bastion at ~82% must still
   read as partly built. Do not replace its framing with a complete building.

## Invariants

- Keep raw WebGPU + WGSL and raw Rust WASM ABI. No Three.js/WebGL/wasm-bindgen.
- Do not change the camera, controls, selection API, deterministic fixed 60 Hz loop,
  seed 73129, opening schedule, or resource caps.
- No `Math.random`. All positions/poses/effects must derive from sim state/tick/seed.
- Use only the 32 palette colours in WORLD_PLAN.md.
- ≤64 draw calls, ≤100k triangles, no new per-frame heap churn.
- Do not modify `docs/`, `tasks/`, `scripts/`, or evidence.
- You may run only `cargo build` and `npx tsc --noEmit`.

## Commit

`git add -A && git commit -m "world: pass 5 — readable raid formation and combat exchange"`

End with changed files, what is fixed, remaining weakness, and assumptions. Stop after implementation.
