# Game menu / title showcase

The root `/` page is both the title screen and the live game surface. On first load the deterministic showcase keeps running behind a modal game menu so the player sees units, buildings and faction activity before starting a skirmish.

## Player flow

- **Resume Game** returns to the active match in the current browser tab. It is disabled until a match exists. Persistent save files are not implemented yet.
- **New Game** opens a civilization choice for Dawnward Compact or Cinderwake Reavers. If a match is already active, replacement can require confirmation.
- **Watch Showcase** hides the menu while leaving the showcase running. The `MENU` button reopens it.
- **Options** stores gameplay-facing defaults: default civilization, whether the minimap opens at match start, and replacement confirmation.
- **Settings** stores menu-size, high-contrast and contextual-tip preferences; fullscreen uses the browser Fullscreen API.
- **How to Play** explains the current controls and RTS loop.
- **About** identifies the current pre-release architecture and, in development builds only, links to the Workshop.
- **Return to Showcase** resets the active match to the authored showcase and reopens the menu.

Menu preferences use `localStorage` key `starhold.game-menu.v1`. This is preference state only; it is not a saved game.

## Layout contract

`src/game-menu.ts` creates the menu and wraps the public `window.__APP.startMatch` / `resetShowcase` entry points so programmatic starts and browser automation leave the menu in the correct state. `src/game-menu.css` owns the menu presentation.

The original showcase simulation and renderer are unchanged. While the showcase is active, the old skirmish HUD is hidden and the renderer continues to advance behind the menu. Closing the menu in showcase mode exposes the live scene plus camera controls. Starting a real match restores the normal HUD.

The menu uses the existing Starhold palette and remains responsive for desktop, phone and tablet layouts. Native `<dialog>` semantics provide focus/inert behavior while the menu is open.

## Verify

The normal build must pass first:

```sh
npm run build
```

The menu browser check requires Playwright Chromium. On macOS/Windows:

```sh
npm run wasm
npx playwright install chromium
npm run test:menu:browser
```

Linux CI uses the same software WebGPU setup as the Workshop:

```sh
WORKSHOP_HEADED=1 WORKSHOP_GPU_LOG=1 xvfb-run -a npm run test:menu:browser
```

The browser test verifies that the menu opens on the live showcase, showcase actors keep changing behind it, New Game starts Cinderwake and closes the menu, Resume returns to the active match, options/settings interactions work, and the page does not overflow horizontally. It writes title-menu evidence into `workshop-evidence/`.

The menu and the full Workshop/game browser suite passed together in **Workshop verification #93** on commit `9cce6efd21451cdba7cb9a2a4fa349d27e8a05e9`.

## Scope

The current Resume action is intentionally **current-session only**. A future save/load system should add simulation serialization explicitly rather than pretending that menu preference storage is a saved match. No menu setting changes simulation balance or the asset-governance contracts.
