# Starhold Workshop

First connected slice: Civilization Codex → Asset Forge → Encounter Lab → Research Atlas → Review & Evidence. Feature branch `feat/ash-jackal-workshop`, PR #1. This does not deploy to the existing Tailnet sites.

## Run

With Node 22 and Rust installed, from a clean working tree:

```sh
git fetch origin
git switch feat/ash-jackal-workshop
npm ci
rustup target add wasm32-unknown-unknown
npm run dev:tools
```

Open `http://localhost:5199/tools/?view=forge&civ=1&kind=30`. The command builds both WASM variants before starting Vite. Port 5199 must be free. The original `/lab.html` links to this workshop; the game remains `/`.

The root `/` game page now uses the authored showcase as a **live animated game-menu background**. Units, buildings and simulation activity continue while the menu is open; New Game, session Resume, Options, Settings, How to Play and About sit over the live scene. See `docs/GAME_MENU.md` for the player flow and menu browser test.

Generated `tools/sim.workshop.wasm` and `tools/revision.json` are ignored development outputs. Do not move tools into `public/` or the production entry graph. The normal WASM contains research/content rules but no lab mutation exports.

## Repository skill playbooks

Read `skills/README.md` before delegating Workshop, asset, animation, research or pre-commit work. The folder contains Starhold-native README/HOWTO playbooks for the workflows adapted from Dimillian/Evergrow and TheOrcDev/skills, plus `skills/SOURCES.md` recording upstream inspiration and what was re-designed for Starhold.

## Review Ash Jackal

Choose Cinderwake Reavers → Ash Jackal. Compare **Field rig** (`jackal-field-1`) and **Longbow outrider** (`jackal-longbow-1`). Both are authored procedural candidates drawn through the production renderer, with one shared weapon socket. Inspect eight actor facings, four camera yaws, idle/walk/attack/wreck poses and animation phase. The native crop is paired with a fixed 4× nearest-neighbor enlargement. For buildings, the phase slider controls construction progress.

A staged pose is not proof of combat timing. Open Encounter and select the stationary weapon target, small engagement, or wall/passage fixture. Reset creates a fresh 64×64 simulation. Prepared research pays real costs; its setup duration is recorded separately. Encounters stop at 30 seconds; interactive research review has a 120-second limit.

Click an owned unit, then Move or Attack and a destination/target. Shift-click adds units; Hold stops the selection. Commands use generation-safe handles. This lab interaction is not a complete main-game RTS input redesign.

Compare runs Base, Tempered, Running and Anchored under the same authored fixture policy. It is not optimized micro, a general win-rate prediction or proof of balance. The status line labels damage as a total for both sides.

## Research and combat

The first slice has **six nodes per civilization**, not the final 12–18-node design. Research is faction-specific, per-match, timed and paid with Alloy/Charge; ages remain. Rust owns costs, prerequisite edges, producer checks, effects and cancellation. The workshop and game share the same research panel. Its map draws runtime prerequisite edges; only layout coordinates are presentation metadata.

Base Ash Jackal draws for 24 ticks and has a 48-tick attack cycle at 60 Hz. Tempered Arrows increases damage. Its mutually exclusive children are **Running Draw**, allowing movement 12 ticks earlier without accelerating shots, and **Anchored Draw**, using a 36-tick draw and 60-tick cycle with 50% stronger shots than the equivalent configuration.

Release timing and the projectile are authoritative simulation events. The rig does not emit a second decorative arrow. Both candidates share local-world socket `(0.6, 0.18, 0.72)`, rotated by actor yaw. In-flight damage remains fixed if research completes later.

Cancelling unfinished research refunds its paid costs. Losing its producer does not refund. Health research raises maximum health without healing existing actors. Research resets with a fresh match.

## Evidence and validation

JSON records fixture/seed, research, commands, event trace, actor handles, paid setup, runtime content, asset revision, source stamp and the loaded WASM SHA-256. PNG captures use explicit GPU readback. Candidate review JSON does **not** modify source, promote an asset or persist an approval. No playable saves are accessed.

```sh
npm run verify:workshop
npx playwright install chromium
npm run test:workshop:browser
npm run test:menu:browser
```

Linux CI uses `scripts/workshop-gpu.mjs` software Vulkan and a virtual display:

```sh
WORKSHOP_HEADED=1 WORKSHOP_GPU_LOG=1 xvfb-run -a npm run test:workshop:browser
WORKSHOP_HEADED=1 WORKSHOP_GPU_LOG=1 xvfb-run -a npm run test:menu:browser
```

An independent red-pixel GPU clear/readback probe runs before game checks. Adapter failure, device loss and blank Forge captures fail the test; they are never skipped as passes. Those Linux-specific flags do not apply to normal macOS/Windows runs.

The showcase regression test freshly compiles baseline `a52203db04807f9226d76546c807eb8145e99dd5`, then compares the exact entity snapshot at seed 1 / tick 6480. It retains 55 entities, 247 Alloy and 199 Charge. This verifies simulation preservation, not human approval of every visual.

The permanent workflow is read-only. Evidence PNGs/JSON are retained for seven days.

## Boundaries

This is not a connected image-generation service, arbitrary asset editor, automatic approval/promotion store, persistent game-save system, manual replay importer, complete main-game command interface or global AI navigation rewrite. Explicit commands have deterministic obstacle navigation; legacy world AI has not been comprehensively replaced. All 30 actors being visible does not establish that all designed special abilities are finished.

The next art decisions remain human review of the two Jackal candidates and the first Cinderwake building set. Physical iPhone/iPad/Safari verification is still needed. Software-GPU viewport checks are not Apple hardware performance results. This PR does not alter the live Tailnet deployment.
