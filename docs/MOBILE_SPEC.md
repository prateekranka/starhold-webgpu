# Mobile spec — Starhold (binding)

Status: **binding contract** for the mobile pass. Written by the orchestrator
(2026-09-13). The coding worker implements this file exactly. The orchestrator
validates it with `scripts/capture.mjs`.

## 1. Goal

Starhold must be fully playable on a phone or tablet in landscape. Desktop
behaviour must not change.

Acceptance criteria (user verbatim, 2026-09-13):

- Responsive landscape phone and tablet layouts.
- Safe-area insets respected (notch, home bar).
- No page scroll. No clipped HUD.
- The canvas stays pixel-sharp.
- Touch targets are at least 44x44 CSS px, independent of canvas downscale.
- Tap selects a unit or a building.
- Quarter-turn camera buttons stay.
- Zoom `+` / `-` buttons stay.
- Two-finger pinch zoom works. A pinch must not break tap.
- Portrait mode is **playable** (wave 2, supersedes the rotate notice): the canvas
  fits the width above the HUD bar, the bar stays fully visible with >=44x44 CSS px
  targets, and there is no page scroll. The rotate notice survives only as the
  no-WebGPU error path.
- Verified at 844x390 landscape (iPhone), 390x844 portrait (iPhone), 1024x768
  landscape (iPad), 768x1024 portrait (iPad), and 960x540 desktop.

Preserved invariants (do not change):

- Raw WebGPU rendering, no library.
- Fixed deterministic Rust/WASM simulation. `sim/` is untouched.
- 32-colour palette. No colour outside `src/kinds.ts` `palette`.
- Camera behaviour: 90 degree yaw steps, four discrete zoom steps, orthographic
  pitch, fixed 960x540 render target with nearest-neighbour upscale.
- Selection semantics: `renderer.pick()`, frontmost silhouette, empty terrain
  clears selection.
- Performance: at least 59 fps with p95 frame time at most 20 ms.

## 2. Layout contract

### 2.1 Viewport

`index.html` viewport meta becomes:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

`viewport-fit=cover` plus `env(safe-area-inset-*)` gives the safe-area values.

### 2.2 Safe-area variables

`:root` defines four custom properties. The harness overrides them to simulate
a notch, so they MUST be read at runtime, not baked in:

```css
--safe-t: env(safe-area-inset-top, 0px);
--safe-r: env(safe-area-inset-right, 0px);
--safe-b: env(safe-area-inset-bottom, 0px);
--safe-l: env(safe-area-inset-left, 0px);
```

### 2.3 Body

```css
html, body { height: 100%; }
body {
  margin: 0; overflow: hidden; overscroll-behavior: none;
  width: 100%; height: 100vh; height: 100dvh;
  display: grid; place-items: center;
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
  -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
  user-select: none; -webkit-user-select: none; touch-action: manipulation;
}
```

No scrollbar may appear. The page must never scroll in any viewport.

### 2.4 Canvas fit (main.ts `resize()`)

```ts
const read = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
const availW = innerWidth - read('--safe-l') - read('--safe-r');
const availH = innerHeight - read('--safe-t') - read('--safe-b');
const fit = Math.min(availW / RENDER_WIDTH, availH / RENDER_HEIGHT);
const scale = fit >= 1 ? Math.floor(fit) : Math.max(0.1, fit);
viewport.style.width = `${RENDER_WIDTH * scale}px`;
viewport.style.height = `${RENDER_HEIGHT * scale}px`;
```

`resize()` runs on `resize`, on `orientationchange`, and once at boot.

`#viewport` is centred by the body grid. The canvas keeps its 960x540 backing
store and `image-rendering: pixelated`. Non-integer scales stay nearest-neighbour;
never switch to a blurring mode.

### 2.5 Touch layout switch

At boot, before the first frame:

```ts
const touchLayout = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
document.body.classList.add(touchLayout ? 'touch' : 'mouse');
renderer.hudButtons = !touchLayout;
```

Rules:

- **Touch layout** (`body.touch`): the four control buttons are DOM controls in a
  fixed cluster (section 3). The renderer does NOT draw the in-canvas button
  cluster.
- **Mouse layout** (unchanged desktop look): the in-canvas cluster is drawn as
  today, and the DOM buttons keep their current transparent percentage layout.

## 3. Touch control cluster

Position: fixed, bottom-right, inside the safe area, four buttons in one row, in
the same order as desktop:

```css
body.touch nav {
  position: fixed; inset: auto;
  right: calc(var(--safe-r) + 10px); bottom: calc(var(--safe-b) + 10px);
  display: flex; gap: 8px; pointer-events: none;
}
body.touch button {
  position: static; width: 48px; height: 48px; min-width: 44px; min-height: 44px;
  border: 2px solid #747C91; background: #1B1E30; padding: 0;
  display: grid; place-items: center; pointer-events: auto;
}
body.touch button canvas.glyph { display: block; width: 36px; height: 36px; image-rendering: pixelated; }
body.mouse canvas.glyph { display: none; }
```

- 48x48 CSS px per button satisfies the 44x44 minimum with margin.
- The size is in CSS px. It does not scale with the canvas.
- Each button contains `<canvas class="glyph" width="12" height="12" aria-hidden="true"></canvas>`.
- Button background `#1B1E30`, border `#747C91`, glyph `#F3F0D7`. All three are
  palette colours. No anti-aliasing, no border-radius, no shadow.
- Ids stay `#rotate-left`, `#rotate-right`, `#zoom-out`, `#zoom-in`. Handlers stay
  the existing `rotate()` and `zoomBy()` functions.

### 3.1 Glyph pixels (shared source of truth)

Export one function from `src/renderer.ts`:

```ts
export function buttonGlyphPixels(kind: number): Uint8Array; // 100 bytes, 10x10, row-major
```

It returns the current in-canvas arrow / minus / plus patterns:

- kinds 0, 1 (rotate left, rotate right): the existing 10x10 arrow, mirrored for
  kind 1;
- kind 2 (zoom out): a 10x2 bar at rows 4 and 5;
- kind 3 (zoom in): the same bar plus a 2x10 bar at columns 4 and 5.

`Renderer.buttonGlyph()` must paint from this function, so the DOM glyph and the
canvas glyph can never drift apart. `main.ts` paints each 12x12 glyph canvas:
one pixel of margin, then the 10x10 pattern offset by (1,1), colour `#F3F0D7`.

## 4. Input contract (main.ts)

Mouse input keeps the existing `canvas` `click` listener. Touch input uses
pointer events on the canvas. `touch-action: none` on `#world` so the browser
never scrolls or zooms the page itself.

State: `activePointers: Map<number, {x,y}>`, `downX`, `downY`, `downAt`,
`pinched`, `pinchStartDist`, `pinchStartZoom`.

- `pointerdown` (`pointerType` is not `mouse`): remember the point and the time.
  With exactly two pointers, record `pinchStartDist` (ignore start distance under
  20 px) and `pinchStartZoom`, and set `pinched = true`.
- `pointermove` (two pointers, pinch active): compute
  `ratio = dist / pinchStartDist`, then
  `steps = Math.round(Math.log(ratio) / Math.log(1.4))`, then
  `zoomIndex = clamp(pinchStartZoom + steps, 0, 3)`. Spreading fingers zooms in.
- `pointerup`: with one pointer, if `pinched` is false, movement is at most 12 CSS
  px and duration is at most 400 ms, call `selectAt(x, y)`. A tap must never be
  swallowed by a previous pinch.
- `pointercancel` and a release of the last pointer: reset `pinched`,
  `pinchStartDist`, `pinchStartZoom`, and the tap origin. A tap after a pinch
  selects normally.
- Pinch changes only `zoomIndex`. It never selects, never rotates, and never
  changes selection.

`window.__APP.getState()` gains one field: `touch: boolean` (true in touch
layout). Every other field and function stays exactly as `docs/INTERFACE.md`
defines.

## 5. Portrait mode (wave 2: playable)

Portrait is a playable orientation, not a notice. `docs/MATCH_SPEC.md` §8 is the
binding contract:

- the canvas fits the width above the HUD bar and keeps its 16:9 ratio;
- `#hud-bar` is fully visible and every target stays >=44x44 CSS px;
- no page scroll in either orientation, and rotation never reloads the app;
- `#rotate-notice` is kept only as the no-WebGPU error path, never as an
  orientation gate. The DOM text stays exempt from the strict render palette, as
  the existing `#error` overlay is.

## 5.1 Landscape

Unchanged from the shipped mobile pass: canvas fits the viewport, camera buttons
sit bottom-right with 48x48 CSS px targets, and the new HUD bar spans the bottom
without covering them.

## 6. Must-not-change list

- `sim/src/lib.rs` and the WASM ABI. The simulation, the seed, and tick order stay
  byte-identical.
- `renderer.pick()` geometry and selection semantics.
- Camera maths: `yawSteps`, the `zooms` array `[4/3, 1, 4/5, 2/3]`, the 960x540
  render target, the 2 px art grid, and the post-pass palette quantiser.
- The world HUD strips: top strip and the bottom-left selection panel stay drawn
  in the canvas at their current coordinates.
- No new dependencies. No new files in `src/`. `scripts/`, `docs/`, `tasks/` are
  orchestrator-owned.

## 7. Verification (orchestrator)

```
node scripts/capture.mjs --root dist --out evidence-mobile/phone    --width 844  --height 390 --touch --dsf 2 --min-fps 59 --settle 108
node scripts/capture.mjs --root dist --out evidence-mobile/tablet   --width 1024 --height 768 --touch --dsf 2 --min-fps 59 --settle 108
node scripts/capture.mjs --root dist --out evidence-mobile/portrait --width 390  --height 844 --touch --dsf 2 --portrait
node scripts/capture.mjs --root dist --out evidence-mobile/desktop  --min-fps 60 --settle 108
python3 scripts/measure-detail.py evidence-mobile/phone/shot-main.png
```

Touch gate list: `touch-layout`, `no-scroll`, `canvas-fits`, `hud-unclipped`,
`touch-targets-44`, `safe-area-respected`, `tap-select`, `rotate-touch`,
`zoom-touch`, `pinch-zoom`, `tap-after-pinch`, plus the existing boot, fps,
console and determinism gates.
