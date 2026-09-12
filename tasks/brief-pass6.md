# Brief — Astra coding pass 6: distinct combat silhouettes (gpt-6-astra, medium, fast)

You are a **coding agent** on Starhold. Implement one small visual piece. Do not test,
run a server, capture screenshots, or judge the result. The orchestrator does that.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `.dream-loop/target.png`
5. `evidence-p5/shot-main.png` — actual t≈112s frame
6. `src/renderer.ts`, `src/kinds.ts`, `sim/src/lib.rs`

## Verified state

Pass 5: 7/7 gates, 60.3 fps, p95 17.1 ms, deterministic, no console errors.
The battle now shows separate groups: six wine/red Jackals and 8+ teal/white
friendlies. The battle location and faction colours read well.

Fresh blind critic verdict: **FAIL**.

> SINGLE BIGGEST GAP: Combat units read as near-identical tiny spheres — no
> AoE2-DE-level silhouette/type separation in a fight blob.
>
> Exact next action: Enlarge combat units ~1.5–2× and give each role a unique
> 1px outline + silhouette (e.g. tall wedge / wide disk / angular chassis);
> keep workers smaller and round so combatants stay instantly parsable against
> the purple ground.

## Implement only this piece

Improve the rendered silhouettes. Do not change spawn counts, positions, combat
logic, camera, terrain, buildings, UI, or opening schedule.

At 480×270, yaw 0 and zoom 1:

- **Worker (20):** keep smallest. Round hood/body, visible warm face/tool pixel.
  Approx. 7–9 px tall.
- **Lancer (21):** 1.5–2× current combatant footprint. Tall planted body with a
  long side-mounted lance/barrel. Strong triangular/vertical silhouette.
- **Windwright (22):** broad horizontal wing/disc shape, visibly wider than tall,
  with a teal center. It must not look like a Lancer or Worker.
- **Jackal (30):** angular forward-leaning quadruped/wedge, long nose/weapon and
  two separated rear legs. Wine body, red armor, sand muzzle/face. Approx.
  10–13 px tall and 10–15 px wide. Do not render as stacked balls.
- **Ram/other hostile (31 if visible):** low, broad armored chassis, visually
  heavier than a Jackal.
- Every combatant has a continuous 1-pixel ink (#151925) outer edge at the
  final internal resolution. Keep color fill blocks large enough to survive
  nearest-neighbor scaling.
- Preserve pose direction. Attack pose must change the silhouette, not only a
  one-pixel flash.
- Maintain depth sorting so units do not clip incorrectly through each other.
- Selection rings and projectiles remain visible around the enlarged bodies.

## Invariants

- Raw WebGPU/WGSL and raw Rust WASM ABI only. No external dependencies.
- Deterministic fixed 60 Hz sim, seed 73129, no `Math.random`.
- Only WORLD_PLAN.md's 32-colour palette. No gradients or anti-aliasing.
- ≤64 draw calls, ≤100k triangles, no per-frame heap churn.
- Do not modify `docs/`, `tasks/`, `scripts/`, evidence, terrain, or HUD.
- Prefer renderer-only changes. Touch Rust only if a pose field is missing.
- You may run only `cargo build` and `npx tsc --noEmit`.

## Commit

`git add -A && git commit -m "art: pass 6 — distinct scaled combat silhouettes"`

End with changed files, exact silhouettes implemented, remaining weakness, and
assumptions. Stop after implementation.
