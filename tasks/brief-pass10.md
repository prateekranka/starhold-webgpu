# Brief — Astra coding pass 10: combat formation spacing

You are a coding agent on Starhold. Use GPT-6 Astra Medium in standard mode.
Implement one root-cause fix. Do not run the game, capture screenshots, or judge the
result. The orchestrator owns validation. Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `.dream-loop/target.png`
5. `evidence-p9/shot-main.png` — actual t≈112s frame
6. `src/renderer.ts`, `sim/src/lib.rs`

## Verified state

Pass 9: build PASS; 7/7 runtime gates; 60.3 fps; p95 17.0 ms; no console
errors; deterministic state hash `20b89f84` matched. Friendly actors now separate
well. The fresh critic still returned FAIL:

> The red cluster collapses into one dark blob on purple terrain so you cannot
> count or silhouette-read individuals at combat density.

Passes 7–9 already added brighter hostile colors, whole-body dark contours, larger
silhouettes, forward tips, and small renderer offsets. More outline or size is not
the root fix. Bodies physically overlap. Fix formation spacing.

## Implement only this piece

Make all six Jackals individually countable at t=108–115s, yaw 0, zoom 1.

1. **Deterministic separation in simulation:** give active ground combatants stable
   formation slots derived from stable entity ID, not array index. When several
   Jackals converge on one target, arrange them in a two-rank arc/wedge around the
   target instead of one point. Use at least **1.25 world tiles between Jackal
   centers**. All six must remain on the mesa and within weapon range.
2. Friendly combatants converging on one target also need at least **1.1 tiles**
   between centers. Use a separate side of the engagement so factions face each
   other rather than interpenetrate.
3. Separation must be deterministic, bounded, and smooth. Do not teleport living
   actors each frame. Assign the formation offset once at spawn or compute a stable
   target offset from entity ID; normal movement eases toward it.
4. Keep the visible battle near the eastern bastion and inside the camera frame.
   At t=108–115s: six red Jackals in two countable ranks, at least six friendly
   combat actors opposite them, and clear dark ground gaps between neighboring
   bodies. No actor may sit inside a building.
5. Preserve combat timing and effects. Units must still face/attack their targets.
   Projectile origins follow the presented actor positions.
6. Do **not** enlarge units again. If pass-9 renderer-only offsets now duplicate the
   sim spacing, reduce or remove those visual offsets so rendered position matches
   selectable/sim position. Preserve the whole-body `#10121C` outline, bright faction
   fills, role silhouettes, and forward tips.

## Invariants

- Preserve raw Rust WASM ABI and `window.__APP` interface.
- Fixed 60 Hz deterministic simulation, seed 73129, no `Math.random`.
- Do not change entity counts, spawn times, health, damage, resource economy,
  construction, buildings, terrain, HUD, camera, or controls.
- Exact 32-color palette. Raw WebGPU/WGSL. No new dependencies.
- ≤64 draw calls, ≤100k triangles, no new per-frame heap allocation.
- Work only in `sim/src/lib.rs` and `src/renderer.ts`.
- Do not edit docs, tasks, scripts, evidence, or generated `public/sim.wasm`.
- You may run only `cargo build --release --target wasm32-unknown-unknown` and
  `npx tsc --noEmit`.

## Commit

`git add sim/src/lib.rs src/renderer.ts && git commit -m "sim: pass 10 — separated deterministic combat formations"`

End with files changed, exact spacing rule, remaining weakness, and assumptions.
Stop after implementation.
