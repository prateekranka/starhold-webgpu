# Pass M1 — mobile layout and touch input (Starhold)

You are a fresh coding agent. You know nothing about earlier sessions. Read the
files below before you edit anything.

## 1. Read first

- `docs/MOBILE_SPEC.md` — the binding contract for this pass. Every number in it
  is exact. Implement it literally.
- `docs/INTERFACE.md` — the runtime and rendering contract. Do not break it.
- `docs/WORLD_PLAN.md` — palette lock and camera rules.
- `index.html`, `src/style.css`, `src/main.ts`, `src/renderer.ts` — the files you
  will edit. `src/renderer.ts` is dense; read the `hud()` and `buttonGlyph()`
  methods and the `pick()` method carefully.

## 2. Current state

Starhold is a working browser graphics demo: raw WebGPU renderer (no library),
a deterministic Rust/WASM simulation, a 32-colour pixel-art palette, isometric
orthographic camera with four yaw steps and four zoom steps. Desktop mouse play
works and passes all gates. The build is green at commit `8d7ddd3`.

Known mobile gaps, all confirmed by the orchestrator:

1. `index.html` viewport meta lacks `viewport-fit=cover`; no safe-area handling.
2. `body` is `100vw/100vh` with no `dvh` fallback; padding ignores insets.
3. The four control buttons are positioned in percentages of the canvas box, so
   they shrink with the canvas. On a 844x390 phone they are about 32x29 CSS px,
   below the 44x44 touch minimum.
4. There is no touch input at all: no tap selection path, no pinch zoom.
   Selection only fires from a mouse `click` event.
5. No portrait treatment. Opening in portrait shows a small letterboxed strip.
6. The in-canvas button cluster is drawn by the renderer at fixed HUD
   coordinates, so it cannot grow to a touch-friendly size.

## 3. This pass's job

Implement `docs/MOBILE_SPEC.md` in this order. Prefer the first four items done
well over all six attempted.

1. Viewport meta, safe-area variables, body layout, `resize()` from section 2 of
   the spec. No page scroll at any size.
2. Touch layout switch (spec 2.5): `body.touch` class and `renderer.hudButtons`.
   Guard the in-canvas button cluster behind `hudButtons`.
3. Touch control cluster (spec 3): fixed bottom-right DOM row, 48x48 CSS px
   buttons, palette colours, glyph canvases. Add the exported
   `buttonGlyphPixels(kind)` function in `src/renderer.ts` and paint the DOM
   glyphs from it, as the spec says.
4. Pointer input (spec 4): tap selection and two-finger pinch zoom, with the
   exact thresholds. A pinch must never select. A tap after a pinch must select.
5. Portrait overlay (spec 5).
6. `touch: boolean` in `window.__APP.getState()`, and the matching field in the
   local `App` interface in `src/main.ts`.

## 4. Hard rules

- Absolute: do not touch `sim/`. The simulation stays byte-identical.
- Absolute: no colour outside `src/kinds.ts` `palette`. DOM controls use
  `#10121C`, `#1B1E30`, `#747C91`, `#F3F0D7` only.
- Absolute: no new dependency, no new file in `src/`, no new file in the repo.
  Edit `index.html`, `src/style.css`, `src/main.ts`, `src/renderer.ts` only.
- Absolute: keep the mouse path working. The existing `canvas` `click` listener
  and the four button ids and their handlers stay.
- Absolute: keep the 960x540 render target, the 2 px art grid, the palette
  quantise post pass, `renderer.pick()`, `rotate()`, `zoomBy()` and the `zooms`
  array exactly as they are.
- Use the pixel-art look: no border-radius, no box-shadow, no transition, no
  anti-aliased glyph. Aliased bitmap glyphs only.

## 5. No-test clause

Implement only. Do NOT launch a development server, do NOT take screenshots, do
NOT run the Playwright harness, do NOT run validation of any kind. The
orchestrator owns every check.

## 6. Allowed checks

- `npx tsc --noEmit`
- `npm run build` if you want a compile proof of the whole pipeline.

## 7. Scope fence

Do not open, edit or create: `docs/`, `tasks/`, `scripts/`, `evidence*/`,
`sim/`, `dist/`, `PROGRESS.md`.

## 8. Commit and definition of done

Commit your own work from the repository root:

```
git add index.html src/
git commit -m "mobile: responsive touch layout, safe areas and pinch zoom"
```

Done means: the spec is implemented, `npx tsc --noEmit` is clean, the commit
exists, and your final message lists the files you changed plus one sentence per
spec section saying what you did.
