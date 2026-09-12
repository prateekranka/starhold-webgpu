# Brief — Astra planning pass (gpt-6-astra, reasoning high, fast)

You are the **planning agent** for a browser graphics demo. You plan; you do not code.

## Read first

- `/home/bobbyranka/Cowork/starhold/docs/DIRECTIVE.md` — the user's requirements, verbatim.

## Your deliverable

Write TWO files:

### 1. `docs/WORLD_PLAN.md`

The design of the world, dense and specific enough that a coding agent can build it
without asking questions. Cover:

- **Setting**: a space civilization actively building itself up on an alien frontier.
  Fantasy-in-space tone (AoE-in-space / StarCraft reference points).
- **Factions**: player colony + hostile raiders (names, colors, silhouette language).
- **Buildings**: 6-9 types with gameplay role, footprint, silhouette, and the stages
  of their construction animation (how a building visibly assembles itself).
- **Units**: 5-8 types with behavior loop, silhouette, and animation set
  (idle / move / attack / work / death).
- **Economy loop**: what workers gather, where it goes, how it feeds construction.
- **Combat**: how attacks read visually (muzzle flash, tracers, impacts, deaths),
  and a wave cadence that keeps the world busy without ending.
- **Ambient life**: the subtle environmental behaviors — drones, dust, vents,
  crystals, sky traffic, weather. Be specific.
- **Terrain**: biome layout, tile/height language, and how isometric depth reads.
- **Palette**: an explicit list of 24-40 hex colors for the pixel-art lock, with
  usage rule per color family. This is binding for the renderer.
- **Camera**: isometric angles, the 4 yaw steps, zoom steps, and framing rules.
- **Motion inventory**: a table of EVERY moving thing in the scene and its period,
  so "alive and bustling" is measurable, not vibes.

### 2. `.dream-loop/target-prompt.md`

ONE image-generation prompt for the "dream" target screenshot: a real in-engine
screenshot of this demo at 480x270 (pixel art), upscaled look, isometric, showing
the colony mid-construction with combat and ambient motion visible. No "concept
art", no painting, no illustration language — an exact game-screenshot target that
a renderer can be compared against pixel by pixel. Include the palette lock and the
framing (what is in the left/middle/right thirds, what is in the foreground).

## Constraints you must design within

- Browser. **Rust simulation compiled to WASM** + **WebGPU rendering** (raw WebGPU,
  WGSL — no three.js, no WebGL fallback). Target **>60fps** at 480x270 internal
  resolution, upscaled with nearest-neighbour.
- Simulation is autonomous: the civilization builds itself, raids arrive on a timer.
  The user only selects things and moves the camera.
- Input contract: click selects a unit or building; a button rotates the camera 90°
  per click; +/- buttons zoom. Design around exactly these controls.
- Deterministic sim, fixed timestep, seeded RNG. No `Math.random` in sim logic.

## Rules

- Do NOT write application code. Markdown only.
- Do NOT run builds, servers, or tests.
- Do NOT ask questions; make the call and state your assumption inline.
- Keep both files under ~400 lines each. Density over prose.

When finished, print a 10-line summary: the setting in one line, building count,
unit count, palette size, and the three strongest "alive world" moments you designed.
