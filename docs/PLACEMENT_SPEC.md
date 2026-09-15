# Starhold — placement affordance (BUILD stops being silent)

Status: **binding brief.** Written before code. Owner of the decision: the game dev
lead. Issue: `docs/PLAYTEST_ISSUES.md` A3.

## Why

Today a build control places the building for the player at the nearest legal site
(`buildNearest`). The player never sees a footprint, never chooses a tile, and never
learns where building is allowed. Three separate blind critics have now asked for
exactly this feedback in their own words — *"no valid/invalid placement highlights"*,
*"no legible construction-site cue"*, *"the player cannot reliably tell where
construction is allowed"* — and the fourth named it as the highest-value change.

The simulation already knows the answer: a live check against the wasm reports 73
marked sites accepted and 15 occupied sites rejected on the current build. What is
missing is the interface, not the rule.

## What to build

**Placement mode.** Choosing a build action (from the action bar, on a worker or the
keep) enters a mode where the building is not yet placed:

1. **A footprint follows the pointer.** The candidate building's tiles are drawn as a
   translucent ghost over the world, tracking the pointer on mouse and the finger on
   touch. It must be obvious which tiles the building would occupy.
2. **Two states, from the simulation.** The ghost shows *valid* when the sim would
   accept the site and *invalid* when it would not. The client asks the sim; it must
   not reimplement the rule. Use existing palette entries for the two states (teal
   and red already exist) and keep the distinction legible on a phone at 1x.
3. **Commit and cancel.** A tap (touch) or click (mouse) on a valid site builds it,
   spends the cost, and leaves placement mode. A tap on an invalid site does nothing
   but keep the mode, and must not spend anything. The existing CANCEL control, the
   RESET control, and pressing Escape all leave the mode without spending.
4. **One action at a time.** Entering placement mode for a second building replaces
   the first. Changing the selection, or losing the worker that would build it,
   leaves the mode.
5. **The old path stays.** `buildNearest` remains for the AI and as a fallback when
   the sim reports no legal site anywhere near; do not delete it, and do not let the
   AI enter placement mode.

## Rules

- **The simulation stays authoritative** for cost, validity, and the placed result.
  The client asks, draws, and forwards the player's choice.
- **Showcase frozen:** at t=108 s the tuple must read
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`; the authored island must not
  change by a pixel. The world generator is untouched and its probe must still pass.
- **Palette:** 32 colours. The ghost may only use entries already in `src/kinds.ts`.
- **Frame budget:** 60.3 fps mean, p95 ≤ 17.5 ms on desktop and phone. Redrawing a
  ghost per frame is allowed only if it costs nothing measurable; otherwise redraw on
  change.
- **Touch:** every control stays ≥44×44 px; the mode must work without a keyboard
  (no Escape-only exit) and without a pointer that can hover.
- **No new dependencies**, no textures, no image files.

## Acceptance criteria

1. A new `placement-preview` gate in `scripts/capture.mjs` proves, on desktop and on
   a landscape phone: entering the mode draws a footprint; moving the pointer moves
   it; an invalid position shows the invalid state and a tap there places nothing and
   spends nothing; a valid tap places the site and spends the cost; cancel leaves the
   mode and spends nothing; the mode is exited by the CANCEL control and by Escape.
2. The gate reads the ghost's state from a read-only probe (`__APP.placement()`),
   never from pixels alone, and the probe reports `{active, kind, tx, ty, valid}`.
3. `build-site` and `cancel-order` still pass unchanged.
4. All five viewports pass; the showcase tuple, palette count and fps are unchanged.
5. A blind read of two frames — one in placement mode over valid ground, one over
   invalid — identifies the footprint and the two states. This is a *supporting*
   check, not the acceptance test: the acceptance test is the gate, because the
   blind lane has been shown to flip its stated reason on identical input.

## Non-goals

Multi-building queuing, drag-to-place rectangles, rotation, blueprints saved for
later, terrain flattening, new buildings or costs, AI placement changes, and any
change to the world generator or the terrain language.
