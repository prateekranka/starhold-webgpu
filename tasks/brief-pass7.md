# Brief — Astra coding pass 7: combat-unit contrast (gpt-6-astra, medium, fast)

You are a **coding agent** on Starhold. Implement one small visual piece. Do not test,
run a server, capture screenshots, or judge the result. The orchestrator does that.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md` — especially palette lock lines 81–93
4. `.dream-loop/target.png`
5. `evidence-p6/shot-main.png` — actual t≈112s frame
6. `src/renderer.ts`

## Verified state

Pass 6: 7/7 gates; 60.3 fps; p95 17.1 ms; no console errors; deterministic.
The unit roles now have different shapes. A fresh blind critic still returned FAIL:

> SINGLE BIGGEST GAP: Ground units lack AoE2-level silhouette and terrain
> contrast—the reddish cluster blends into the dark purple rock so individuals
> don’t pop when packed.
>
> NEXT PASS: Raise ground-unit chroma/value and harden outline/rim so each body
> reads as a distinct silhouette against the asteroid at this zoom, without
> changing building scale.

## Implement only this visual fix

Renderer-only. Do not change sim behavior, positions, counts, building art, terrain,
HUD, camera, or combat timing.

1. **Hostile value separation:**
   - Continuous outer silhouette: Void/ink `#10121C`.
   - Main body must use bright Reaver red `#BC4A45`, not wine `#4E2439`.
   - Upper/forward rim must use heat orange `#E77945`.
   - Face/muzzle/weapon highlight: `#F5B66B`.
   - Reserve wine `#4E2439` for inner recesses only. No body-sized wine slabs.
2. **Friendly value separation:**
   - Continuous outer silhouette: `#10121C`.
   - Main armor: teal `#298B8B` / light teal `#4FB7AA`.
   - Ivory edge blocks: `#D8E3D5`; hot single pixels only `#F3F0D7`.
   - Do not let friendly bodies become mostly stone-grey against the ground.
3. **Harden the contour:** the ink edge must visibly surround each actor even when
   two units overlap. Add a one-pixel bright faction rim on the top and forward-facing
   side inside the ink edge. Preserve the role silhouettes from pass 6.
4. **Readability in a pack:** where bodies overlap, the rear unit's bright top rim
   and dark contact shadow must remain visible. A six-Jackal group must read as six,
   not one red mass. Use a small ink contact shadow under each body if needed.
5. Keep the increased combat-unit size from pass 6. Do not inflate it further unless
   required by the 1-pixel contour.
6. Preserve projectiles, muzzle flashes, selection rings, depth ordering, nearest
   scaling, and attack-pose silhouette changes.

## Hard invariants

- Use only the exact 32 palette colors in WORLD_PLAN.md. No transparency, gradients,
  bloom, antialiasing, hex variants, or new colors.
- Raw WebGPU/WGSL. Deterministic. No `Math.random`.
- ≤64 draw calls, ≤100k triangles, no new per-frame heap churn.
- Do not modify Rust, docs, tasks, scripts, evidence, buildings, terrain, or HUD.
- You may run only `npx tsc --noEmit`.

## Commit

`git add -A && git commit -m "art: pass 7 — high-contrast faction rims and unit separation"`

End with changed files, exact palette mapping, remaining weakness, and assumptions.
Stop after implementation.
