ART FIX TASK — Ash Jackal readability. You own exactly one file:
`/home/bobbyranka/Cowork/starhold-jackal/src/assets/ash-jackal.ts`

The unit has just been rebuilt at 2x and is now 32-34 px tall. It passes its gates, the
wreck reads as a collapsed centaur, and the four poses are distinguishable. Three
measured defects remain. Fix them. Do not redesign what already works.

Read `docs/ASH_JACKAL.md` first (binding spec), then the file, then `src/kinds.ts`
(the `sink.box` colour argument is a PALETTE INDEX, not a hex colour).

## The three defects, measured by an independent critic on the real render

**1. It reads as "a rider on a horse", not a centaur.**
The human torso meets the horse with a hard value break, so it looks like someone sitting
on a mount. The horse is also too dark and unmodelled: a critic described it as "almost
entirely a very dark navy/black solid mass ... it nearly merges with the black drop shadow".
Partly addressed already: the back surface and the loading shoulder are now `shade` (3) and
the barrel is `coat` (2), with `navy` (1) underneath. Continue from there:
- build a value ladder at the junction so the eye reads one continuous creature:
  tan/skin torso (21/27) -> leather girth (19) -> shade (3) shoulder -> coat (2) barrel -> navy (1) underside;
- the horse's chest and shoulder must be LIGHTER where the torso emerges, and the front
  legs must sit directly under the torso, so the human mass grows out of the animal mass;
- keep the horse's anatomy readable in profile: croup, barrel, chest and a distinct neck/
  withers mass, not one capsule.

**2. The bow still reads as "a thin vertical staff/pole", not a bow.**
Only the pale string is visible; the limbs are too thin and their browns blend into the body.
- Bow limbs must be at least `.18` authored units thick (the renderer applies 0.6, and the
  frame is about 12 px per world unit, so `.18` is roughly 1.3 native pixels).
- Make the limbs a clear forward arc: an unmistakable C/D curve away from the body, with the
  tips clearing the silhouette, and the grip exactly at `JACKAL_GRIP`.
- The string is the highest-contrast element: `white` (9) at about `.15` thick, from tip to
  tip, pulled back to the drawing hand during the draw.
- During the draw (attack, phase <.5) the nocked arrow must be visible and at least `.11`
  thick. At release and after, draw no arrow: the simulation projectile is the only shot.
- Put `white` (9) star sparkles on the limbs, and keep cyan (17/18) for the rune and pendant.

**3. Nothing may be sub-pixel.**
Authored thickness below **`.14`** disappears at render scale (0.6 x about 12 px per world
unit is under one pixel). Any element that must read - string, arrow, sparkles, sock bands,
feathers, tail tip, rune - has a floor of `.14`.

## Hard constraints (unchanged; breaking any of these fails the piece)

- Signature stays `export function drawAshJackal(sink:BoxSink,x:number,y:number,z:number,id:number,pose:JackalPose,variant:JackalVariant='field'):void`.
- `JACKAL_GRIP = [2,.6,2.3]` (authored) and `JACKAL_SOCKET = JACKAL_GRIP * JACKAL_SCALE` stay
  exactly as they are. The bow GRIP box must stay at `JACKAL_GRIP` with size `(.2,.24,.2)`,
  because the Rust simulation spawns the projectile from that point.
- Poses keep their meaning: 0 idle, 1 walk, 2 attack driven by `phase` (<.5 drawing,
  >=.5 released), 4 wreck as a fallen body. Gait and settle stay driven by `tick`.
- Variants `field` and `longbow` keep their ids, names, revisions and statuses, and differ
  only in the bow's height and forward reach.
- Palette indices only from `src/kinds.ts`. Do not use index 0 as a fill on solids.
- Do not edit any other file: not `sim/`, not `src/renderer.ts`, not `tests/`, not `docs/`.
  Do not run git commands and do not commit.

## What already works — do not regress it

- The wreck is a fallen body lying on its flank and must stay that way.
- Attack / idle / walk / wreck must stay visually distinct.
- The unit must stay roughly 32-34 px tall at zoom 1.

## Verify before you finish

- `npx tsc --noEmit -p tsconfig.json` exits 0 with no diagnostics.
- Report: the box count for one Jackal in the attack pose and in the wreck pose, the
  thinnest element you emit that is meant to be visible, the largest local coordinate you
  reach, and a one-line note on how you bridged the torso-to-horse junction.

The attached images: (1) the target reference sheet; (2) a generated 8-heading turn-around
of the same character in the correct facing order (E, SE, S, SW / W, NW, N, NE);
(3) the unit's current native gameplay-size contact sheet - 8 facings by attack/idle/walk/
wreck; (4) the current render magnified 4x, which is where the rider-vs-centaur and bow
problems are most visible.
