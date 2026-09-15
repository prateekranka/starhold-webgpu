# Brief W2-HARNESS — gates for HUD, ages, commands, and portrait play

You are extending the Playwright harness. Work only in `scripts/capture.mjs`.

## Read first

- `docs/MATCH_SPEC.md` §9 — the exact gate names you must add, §10 — `__APP`.
- `scripts/capture.mjs` — existing gates, viewport flags, `--portrait`, `--touch`,
  report JSON shape, and exit-code contract.

## Deliverable

1. Add every gate in `docs/MATCH_SPEC.md` §9 with those exact names:
   `hud-bar`, `hud-resources`, `hud-age`, `age-advance`, `train-unit`,
   `build-site`, `match-boot`, `match-determinism`, `portrait-playable`.
2. Add an `--ipad-portrait` viewport mode (768×1024 dsf 2) that runs the same
   layout and interaction gates as portrait, reporting the gate name
   `ipad-portrait` for the size check.
3. Replace the obsolete `portrait-notice` gate. Portrait must now prove the
   playable layout: canvas visible, `#hud-bar` visible with ≥44×44 px targets, no
   scroll. Keep a separate gate that the no-WebGPU error path still exists.
4. Keep every existing gate name and its strictness. The showcase gates must not
   weaken. `exit 0` only when all gates pass.
5. Match gates must drive the app only through `window.__APP` and real DOM clicks:
   `startMatch(faction)`, `command(op,a,b)`, `fastForward(seconds)`, `getState()`.

## Hard rules

- Do not weaken, rename, or delete existing gates.
- Do not touch `src/`, `sim/`, docs, or git. Do not run `git` commands.
- The new gates will fail until integration lands; that is expected. Report which
  new gates fail and why.

## Self-check before you report

- `node --check scripts/capture.mjs`.
- Run the desktop capture against the current `dist/` and confirm the eight
  pre-existing desktop gates still pass; the new ones may fail.

## Report

Final message: gates added, the exact `--ipad-portrait` usage line, and the
observed pass/fail list from your run.
