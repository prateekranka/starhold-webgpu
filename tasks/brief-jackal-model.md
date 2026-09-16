# Brief — Ash Jackal model rebuild at 2× (builder)

Owner of this piece: ONE builder. You own exactly one file:
`/home/bobbyranka/Cowork/starhold-jackal/src/assets/ash-jackal.ts`

Read first, in this order:
1. `docs/ASH_JACKAL.md` — the binding spec (design, palette mapping, silhouette
   rules, motion, definition of done).
2. `src/assets/ash-jackal.ts` — the current model you are replacing.
3. `src/kinds.ts` — the palette array. **`sink.box(..., color)` takes a palette
   INDEX, not a hex value.**

## What to build

Replace the body of `drawAshJackal` so the unit is the reference centaur archer,
drawn at **2× the current size**, using only the existing box sink.

Reference images (look at them):
- `workshop-evidence/jackal-ref/reference-sheet.png` — the target design.
- `workshop-evidence/jackal-ref/ref-2x.png` — the same character with its
  background keyed out and quantised to Starhold's 32 colours: this is the exact
  palette translation to follow.
- `workshop-evidence/jackal-ref/final-strip-8x.png` — what the design looks like
  at 24/32/48 px; the unit now renders at roughly 34 px tall, so aim for the
  32–48 px column, not the 15 px one on the right.

## Hard contract — do not deviate

1. Signature stays exactly:
   `export function drawAshJackal(sink:BoxSink,x:number,y:number,z:number,id:number,pose:JackalPose,variant:JackalVariant='field'):void`
2. `sink.box(x,y,z,w,d,h,color,owner?,screen?)` — same argument order, all
   coordinates in world units, `x,y,z` is the unit's base centre.
3. **The bow and the projectile socket must agree.** Export exactly:
   ```ts
   export const JACKAL_SOCKET = Object.freeze([2, .6, 2.3] as const);
   ```
   and draw the bow's grip box at local `(2, .6, 2.3)` with size `(.2,.24,.2)`
   (2× of today's `(1,.3,1.15)` / `(.1,.12,.1)`). This deliberately fixes a real
   bug: today the arrow spawns 0.43 units below the drawn bow.
4. `jackalReleasePoint` keeps its current formula and reads `JACKAL_SOCKET`; it
   must return `z + 2.3` when the socket z is 2.3.
5. `JACKAL_VARIANTS` keeps both ids `field` and `longbow`, each keeping its
   `name`, `revision`, and `status` fields. Both variants are the new design; the
   only permitted difference between them is the bow's height and length
   (longbow: taller/longer, as today's naming implies).
6. Poses keep their meaning, driven by the sim exactly as now:
   - `state 0` idle, `1` walk, `2` attack with `phase` 0→1 (`<.5` = drawing,
     `>=.5` = released, and no decorative arrow may be drawn when released),
   - `4` wreck (a fallen body, clearly not an upright unit),
   - `cooldown`/`tick` drive the gait and settle exactly as today.
7. All coordinates must scale to 2× and stay on the art grid (the renderer
   snaps to a 2 px grid): prefer even values and avoid scale factors like 0.83.

## Palette (indices from `src/kinds.ts`)

| Material | Index |
|---|---|
| ink / underside only (never a fill on solids) | 1 |
| horse coat navy, and its highlight | 1, 2 |
| horse mid tone / leg shading | 3, 4 |
| hoof + sock bands | 15, 16 |
| leather harness, bow, tail | 19, 20 |
| skin mid / light | 21, 27 |
| skin warm shade | 24 |
| rune, pendant, bow accents | 17, 18 |
| star sparkles, bow sparkle | 9 |
| feathers | 12, 13 |

Do not use indices 23, 25, 26 (the old maroon/red family) as the unit's main
colours; the reference is navy + tan + teal.

## Definition of done

- `npx tsc --noEmit -p tsconfig.json` exits 0 with no diagnostics.
- The file compiles standalone; no new imports; no new files.
- You touched no other file. Do not run git commands, do not commit, do not edit
  `sim/`, `src/renderer.ts`, `tests/`, or `docs/`.
- Report in your final message: the exported socket value, the exact bow box
  arguments you emit, the box count for one Jackal in the attack pose, and the
  largest local coordinate you use (so the orchestrator can check the footprint).
