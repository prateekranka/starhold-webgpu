# Brief W2-HUD — bottom action bar, portrait playable, app API

You are implementing the HUD and the mobile layout for wave 2. Your files, and
only these: `index.html`, `src/style.css`, `src/main.ts`, and a new `src/hud.ts`.

## Read first

- `docs/MATCH_SPEC.md` — §7 HUD bar, §8 portrait contract, §10 `window.__APP`.
- `docs/MOBILE_SPEC.md` — existing sizing and safe-area rules that still apply.
- `src/main.ts` — current boot, input, resize, and `window.__APP`.
- `src/kinds.ts` — `names`, `factionNames`, `ageNames`, `Kind`.

## Deliverable

1. **`src/hud.ts`** — a DOM bottom bar built once and updated per frame:
   - left: ALLOY, CHARGE, POP used/cap;
   - middle: age name, a thin progress bar while a tier advance runs, and an
     ADVANCE button (visible when `sim_age_cost() > 0`, disabled when the cost is
     unaffordable);
   - right: context actions from the roster table — for a completed building,
     train buttons; for a completed worker, build buttons. Each button shows the
     name and cost, uses `data-action`, `data-kind`, and is disabled when
     `sim_can_train`/`sim_can_build` returns 0.
   - Clicking a button calls `window.__APP.command(op, kind, b)`.
   - Chevron arrows for touch (◀ ▶) move between action pages when more than four
     actions exist, so the bar never overflows.
2. **`index.html`** — the bar markup, plus an accessible name per button. Remove
   the `#rotate-notice` overlay for playable viewports; keep an equivalent
   no-WebGPU error path only.
3. **`src/style.css`** — bar styling in the existing palette, safe-area aware,
   ≥44×44 CSS px targets, no page scroll, landscape and portrait both correct.
   Portrait is playable: canvas fits the width above the bar.
4. **`src/main.ts`** — wire the sim ABI additions, add `startMatch(faction)` and
   `command(op,a,b)` to `window.__APP`, extend `getState()` with the fields in
   §10, and keep every existing input path working (tap select, tap clear, pinch
   zoom, rotate buttons, zoom buttons).

## Hard rules

- Do not draw the HUD in canvas. DOM only. Do not touch `src/renderer.ts`.
- Do not change camera maths, `zooms`, or the 960×540 backing store.
- No new colours outside `src/kinds.ts`.
- The sim may not yet export the new functions while you work. Guard with a
  feature check (`typeof sim.sim_age === 'function'`) so the app still boots on
  the old wasm, and the HUD shows a "MATCH UNAVAILABLE" state instead of crashing.
- Do not touch `sim/`, `scripts/`, docs, or git. Do not run `git` commands.
- Do not run `npm run build` if another worker may be building; `npx tsc --noEmit -p tsconfig.json` is your check.

## Self-check before you report

- `npx tsc --noEmit -p tsconfig.json` clean.
- Re-read the diff: every existing interaction still handled.

## Report

Final message: files changed, the DOM ids you added, the exact `__APP` surface,
and how the bar behaves in portrait versus landscape.
