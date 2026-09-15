# Starhold — screen use on wide touch viewports (wave 3)

Status: **binding brief.** Written before code. **Supersedes `MOBILE_SPEC.md`
section 3, line 36 ("fixed 960x540 render target with nearest-neighbour upscale")
only where that rule sizes the canvas for a landscape touch viewport.** Everything
else in `MOBILE_SPEC.md` stands: 44×44 px touch targets, safe-area insets, the
portrait layout, the rotate notice and the glyph contract.

## The finding

The independent visual gate reported, on the landscape phone frame: *"a wide black
margin wastes the left side, while the enormous minimap, camera buttons and bottom
bar compete with a comparatively tiny base."*

Measured on the live build at 844×390 dsf 2, the canvas gate reads:

```
canvas-fits — rect=579.5x326.0@132.2,0.0 aspect=1.778 backing=960x540
```

The canvas is 580 px wide in an 844 px viewport, centred, with **132 px of empty
black on each side — 31 % of the screen**. The cause is structural, not a bug in
the fit code: `main.ts` computes `fit` against the *world area only*
(390 px viewport − 64 px bar = 326 px), so `fit = min(844/960, 326/540) = 0.604`
and the 960×540 world can only be 580×326. The binding spec fixed the render target
at 960×540 for a 320 m island; the world is now 10.24 km, and the phone spends a
third of its screen on nothing.

## Rule

1. **Fit against the full viewport.** For a landscape touch viewport, compute
   `fit = min(vw / 960, vh / 540)` — the interface no longer subtracts itself from
   the world's space. Keep the integer-step rule when `fit >= 1` and the
   nearest-neighbour fractional rule below 1, exactly as now.
2. **The interface overlays the world.** The bar, the nav column and the minimap
   keep their current offsets, sizes and safe-area insets, and they are drawn over
   the canvas rather than in space carved out of it. The world under them stays
   pannable; no gameplay or camera rule changes.
3. **Phone-sized chrome.** On a landscape touch viewport the minimap panel is at
   most 128×128 CSS px (it is 168 today, which is 20 % of the screen width and 45 %
   of its height) and its close control stays at least 44×44 px. The nav column's
   four controls keep 44–48 px.
4. **Portrait is untouched.** Do not change the portrait or iPad-portrait layout:
   both pass their gates today and are out of scope for this piece. The portrait
   gates must stay green.
5. **Readability over coverage.** If filling the width would put interface above
   the base, that is acceptable — panning exists — but the base must never sit
   under an opaque control at match start.

## Acceptance criteria

1. At 844×390 dsf 2, the canvas width is at least 690 px and the empty area is at
   most 15 % of the viewport (it is 31 % today). The canvas aspect stays 1.778 and
   the backing store stays 960×540.
2. The minimap panel on that viewport is at most 128×128 px and its close control
   is at least 44×44 px.
3. Every existing gate passes on all five viewports, including `bar-hit-test`
   (crowding is the failure mode this project already paid for once), the touch
   target gates, `canvas-fits`, and the portrait gates.
4. Frame rate is unchanged within 0.5 fps (a larger canvas shows more tiles; the
   LOD tiers must absorb it).
5. A frame captured at 844×390 shows the base, the world and no empty band wider
   than 60 px on either side.

## Non-goals

Changing the render target or the projection, new interface controls, changing the
bar's height, restyling, and any change to gameplay, camera limits or controls.
