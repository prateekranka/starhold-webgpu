# Starhold

A browser real-time strategy game: a deterministic Rust/WASM simulation under a
WebGPU isometric renderer, drawn with a hard 32-colour palette and pixel-exact
geometry. No image files are loaded for the world or the units; everything in the
frame is generated.

## Commands

| Command | What it does |
| --- | --- |
| `npm run wasm` | Build `public/sim.wasm` from `sim/src/lib.rs` |
| `npm run wasm:workshop` | Build `tools/sim.workshop.wasm` with the workshop feature set |
| `npm run wasm:all` | Both WASM variants, in order |
| `npm run build` | wasm, then `tsc --noEmit`, then `vite build` into `dist/` |
| `npm run dev` | Build the wasm and serve on port 5199 |
| `npm run dev:tools` | Build both wasm variants and serve the app plus the workshop |
| `npm run capture` | Build, then run the browser gate harness; writes a capture report and screenshots |
| `npm run preview` | Build, then serve the built `dist/` on port 5199 |
| `npm run test:workshop` | Build everything the node tests read, then run them |
| `npm run verify:workshop` | Rust tests, production build, pinned baseline, node tests |

### The simulation binaries are generated, never committed

`public/sim.wasm` and `tools/sim.workshop.wasm` are build outputs of
`sim/`. They are **not tracked by Git** — `.gitignore` excludes them, and CI
fails if either one is committed. Every command above builds the variants it
needs before it uses them, so a fresh clone needs only the toolchain:

```sh
npm ci
rustup target add wasm32-unknown-unknown
npm run dev
```

A committed binary drifts from its source. One checkout carried a stale
`public/sim.wasm` without the `sim_research_count` export that `src/` calls, so
the app died at runtime with `s.sim_research_count is not a function` while
every CI job stayed green, because CI built the wasm before it ran the app.

The gate harness runs one viewport per invocation. The five-viewport set is:

```
node scripts/capture.mjs --root dist --out <dir>                                  # desktop 960x540 dsf 1
node scripts/capture.mjs --width 844  --height 390 --dsf 2 --touch    --out <dir> # phone landscape, touch
node scripts/capture.mjs --width 1024 --height 768 --dsf 2 --touch    --out <dir> # tablet, touch
node scripts/capture.mjs --width 390  --height 844 --dsf 2 --portrait --out <dir> # phone portrait (shows the rotate notice)
node scripts/capture.mjs --ipad-portrait                              --out <dir> # iPad portrait 768x1024 dsf 2
```

Other flags: `--min-fps`, `--fps-seconds`, `--seed`, `--settle`. A run exits
non-zero when any gate fails and prints each gate as `PASS`/`FAIL` with its
measured values.

## The simulation

`sim/src/lib.rs` is authoritative: the browser sends commands and reads state, and
never computes game rules itself. Two modes share one entity array.

**Showcase mode** (`mode 0`) is the authored island: a 32-tile scene with the
initial colony, staged construction, patrols, combat and projectiles. It is the
determinism tripwire, and at t = 108 s it must read
`{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.

**World match mode** (`mode 1`) is a generated 1024×1024-tile world at 10 m per
tile — 10.24 km on a side — with terrain, biomes, ore deposits and two faction
bases kilometres apart. A match starts with 54 entities (41 for the player, 13
for the opponent); the opponent builds, trains and marches on the player's base.
Match determinism is checked by hash, comparing two matches started in the same run rather than against a stored constant (it reads `0f96e8dc` on the current build; a world regeneration legitimately moves it).

Simulation steps at a fixed 60 Hz and is advanced from a fixed accumulator, so a
seed plus a command sequence reproduces a match exactly.

## The renderer

`src/renderer.ts` bakes the visible terrain window into instance buffers and
re-bakes when the camera moves, with level-of-detail tiers by zoom: measured
8366 instances at zoom 1.0 and 4729 at zoom 0.67 for one window. The render
target is 960×540, nearest-neighbor scaled in integer steps when space allows.
Geometry, the bitmap HUD and the controls are drawn into the same
palette-quantized frame; transparent DOM buttons supply accessible hit targets.
Ray picking uses the submitted component boxes and terrain occlusion.

## The interface

A single bar holds the resource meters, the age cluster with its ADVANCE button,
the map control, the page chevrons and one page of context actions (build, train,
cancel). Above it floats a **minimap**: draggable, closable and reopenable, with a
camera frame; a tap centres the camera on that tile, and the panel is pulled back
on screen when the viewport changes.

The bar is designed so that no cluster is ever squeezed below its own content —
a squeezed cluster draws its control outside its box and the next control wins
the tap. A narrow-bar spacing tier applies below 900 px, hidden page chevrons
release their space, and every visible control keeps a 44×44 px touch target.

## Verification

- **Gates.** `npm run capture` covers the whole surface: boot, palette, canvas
  fit, HUD readouts, selection, camera, LOD budget, minimap, training, building,
  cancel and refund, age advance, world scale, determinism, frame rate, console
  errors, and the mobile layouts. Current build: 193/193 across the five
  viewports.
- **Hit tests.** Gates tap the live entity position (`__APP.entityScreen`) rather
  than guessed points, and `bar-hit-test` asserts that every visible control's
  centre hits that control — the guard for the crowding defect that made the
  phone's ADVANCE button unreachable.
- **Frame rate.** 60.3 fps mean with p95 16.9–17.0 ms on desktop and every touch
  viewport.
- **Determinism.** The showcase tuple and the match hash are asserted on every
  run; a change to either is a regression, not a new baseline.

The frozen release served to the phone lives at `~/.starhold-live/current`
(port 5200). It is a separate artifact and is not rebuilt by `npm run build`.

## Documents

| File | Contents |
| --- | --- |
| `docs/DIRECTIVE.md` | The locked plan and the quality bar |
| `docs/INTERFACE.md` | The binding sim ABI and the command set |
| `docs/WORLD_PLAN.md` | World generation and biome intent |
| `docs/MATCH_SPEC.md` | Match rules, costs, ages and the read-only probes |
| `docs/LARGEMAP_SPEC.md` | The 10.24 km world and the floating minimap |
| `docs/MOBILE_SPEC.md` | Touch layout, safe areas and the rotate notice |
| `docs/LIGHTING_CONTRAST_SPEC.md` | Palette and contrast rules |
| `docs/CIVILIZATIONS.md`, `docs/UNIT_DESIGN.md` | Factions and unit design |
| `docs/PLAYTEST_ISSUES.md` | Playtest defects: fixed records and open items |
| `docs/MATCHEND_SPEC.md` | Decision brief for the match-end model |

## Known gaps

- Movement is direct waypoint motion: there is no obstacle-aware navigation, so a
  unit crossing a canyon holds its height instead of routing around it. A raid
  therefore marches straight at the enemy base.
- An idle player is wiped out in about twelve minutes and is not yet told that
  the match ended (`docs/MATCHEND_SPEC.md`).
- Ore is not depleted by mining; resource reservation and delivery accounting is
  approximate.
- The Wharf and later expansion content are not implemented.
- The match mode is a foundation, not a claim of visual parity with a commercial
  RTS.