# Brief — Astra coding pass 8: readable friendly tokens (gpt-6-astra, medium, fast)

You are a **coding agent** on Starhold. Implement one small visual piece. Do not test,
run a server, capture screenshots, or judge the result. The orchestrator does that.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — palette lock and player silhouette language
4. `.dream-loop/target.png`
5. `evidence-p7/shot-main.png` — actual t≈112s frame
6. `src/renderer.ts`

## Verified state

Pass 7: 7/7 gates; 60.3 fps; p95 17.0 ms; no console errors; exact
WASM replay hash matched (`20b89f84`). The six orange/red hostiles now read as
separate actors.

Fresh critic verdict: **FAIL**.

> SINGLE BIGGEST GAP: Friendly teal units are too small, soft-edged, and
> chroma-matched to building trim, so they smear into structures and each other
> instead of reading as countable AoE2-style combat tokens.
>
> NEXT PASS: Give every unit a hard 1px near-black outline plus a brighter, more
> saturated team fill (and a tiny unique silhouette cue) so teal friendlies stay
> separable from teal architecture and from each other when stacked.

## Implement only this visual fix

Renderer-only. Do not change sim behavior, counts, positions, enemy art, buildings,
terrain, HUD, camera, combat timing, or opening schedule.

At 480×270, yaw 0, zoom 1:

1. **Scale only friendly gameplay actors:**
   - Worker (20): keep 7–9 px high.
   - Lancer/Sentinel (21/23): increase current rendered body and weapon dimensions
     by about 25–35%; target 11–14 px high with a long obvious lance/barrel.
   - Windwright (22): increase wing span by about 25–35%; target 13–17 px wide.
   - Do not enlarge service particles, buildings, enemy units, or selection rings.
2. **Continuous hard contour:** every friendly actor needs a complete visible
   `#10121C` 1-pixel silhouette behind/below its full assembled shape. The contour
   must read around the composite unit, not as disconnected dark box fragments.
   If box-part outlines cannot form a clean contour, add one low-cost dark backing
   silhouette made from 2–4 snapped boxes before the colored parts.
3. **Separate from teal buildings:** use `#4FB7AA` and `#8BD7BE` for main friendly
   cloth/armor masses, with large `#D8E3D5` ivory shoulder/wing panels. Reserve
   dark teal `#163D48`/`#1D6068` for recesses only. Building art must not change.
4. **Unique role cue survives overlap:**
   - Worker: small round ivory hood + one warm `#F1CE72` tool/face mark.
   - Lancer: tall ivory crest + long gold/ivory side lance.
   - Windwright: broad light-teal wing bar + cyan `#58BED4` center pixel.
5. Add a compact `#10121C` contact shadow under each friendly so light bodies do
   not merge with pale roads. It must be smaller than the body and not look like
   a selection ring.
6. Preserve pass-6 poses, attack silhouette changes, depth sorting, projectiles,
   and palette quantization.

## Hard invariants

- Exact 32-color palette only. No opacity, gradients, bloom, antialiasing, or new hex.
- Raw WebGPU/WGSL. Deterministic. No `Math.random`.
- ≤64 draw calls, ≤100k triangles, no per-frame heap churn.
- Do not modify Rust, docs, tasks, scripts, evidence, buildings, terrain, enemy art,
  or HUD.
- You may run only `npx tsc --noEmit`.

## Commit

`git add -A && git commit -m "art: pass 8 — crisp enlarged friendly combat tokens"`

End with changed files, exact unit-size/color changes, remaining weakness, and
assumptions. Stop after implementation.
