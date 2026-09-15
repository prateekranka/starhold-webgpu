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

1. **Fit against the full viewport, but only fill when native size does not fit.**
   For a landscape touch viewport where `max(vw / 960, vh / 540) < 1` — a phone —
   the interface no longer subtracts itself from the world's space and the canvas
   is scaled to fill the width. Where that value is `>= 1` — a tablet — the
   existing rule stands unchanged: `min()` against the available space and an
   integer step, because filling at or above 1x would push the canvas past the
   safe area (measured: 44 px insets on a 1024 px tablet asked for 1.14x and the
   integer step produced a canvas 24 px wider than the screen). The guard is the
   one condition the app and the gates now share; `fillExpected()` in
   `scripts/capture.mjs` is its single definition.
2. **The interface overlays the world.** The bar, the nav column and the minimap
   keep their current offsets, sizes and safe-area insets, and they are drawn over
   the canvas rather than in space carved out of it. The world under them stays
   pannable; no gameplay or camera rule changes.
3. **Phone-sized chrome.** On a landscape touch viewport the minimap panel is at
   most 128×128 CSS px (touch measures 120 today; 168 is the mouse rule) and its
   close control is at least 44×44 px — measured, it was **24×24 on every touch
   viewport**, below the 44 px minimum the rest of the interface obeys, and the
   `bar-hit-test` gate never caught it because it only inspects the bar. The nav
   column's four controls keep 44–48 px.
4. **Portrait is untouched.** Do not change the portrait or iPad-portrait layout:
   both pass their gates today and are out of scope for this piece. The portrait
   gates must stay green.
5. **Readability over coverage.** If filling the width would put interface above
   the base, that is acceptable — panning exists — but the base must never sit
   under an opaque control at match start.

## Acceptance criteria

1. At 844×390 dsf 2, the canvas spans the viewport: no empty band at either side,
   and the empty share of the screen is at most 15 % (measured 42.6 % before this
   change). The canvas aspect stays 1.778, the backing store stays 960×540, and the
   canvas may be taller than the screen — the body clips the overflow and the bar
   sits over it, which is what "the interface overlays the world" means.
2. The minimap panel on that viewport is at most 128×128 px and its close control
   is at least 44×44 px.
3. Every existing gate passes on all five viewports, including `bar-hit-test`
   (crowding is the failure mode this project already paid for once), the touch
   target gates, `canvas-fits`, and the portrait gates.
4. Frame rate is unchanged within 0.5 fps (a larger canvas shows more tiles; the
   LOD tiers must absorb it).
5. A frame captured at 844×390 shows the base, the world and no empty band wider
   than 60 px on either side.

## Measured outcome

`node /tmp/screen-use-probe.mjs` (also reproduced by the `canvas-fits` gate in fill
mode), at 844×390 dsf 2:

| | before | after |
|---|---|---|
| canvas | 580×326 at x=132 | **844×475 at x=0** |
| empty share of the screen | **42.6 %** | 0 % (the canvas fills and overflows) |
| minimap | 128 (already within the rule) | 128 |
| minimap close control | **24×24** | **44×44** |

Two gates encoded the old layout and had to be corrected with it: `canvas-fits`
asserted the canvas sits inside the screen (now it asserts *fill* mode for a
landscape touch viewport and containment elsewhere), and `tap-clears` tapped fixed
fractions of the canvas box, which now point below the screen — it derives its
ground point from the app's tile projection instead (`__APP.tileScreen`, read-only,
added for this).

## Non-goals

Changing the render target or the projection, new interface controls, changing the
bar's height, restyling, and any change to gameplay, camera limits or controls.
