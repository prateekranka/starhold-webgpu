# Starhold — terrain affordance pass (wave 3, second piece)

Status: **binding brief.** Written before code. Owner of the decision: the game dev
lead. One writer per file.

## Why

The composition pass fixed the *data*: a probe of the world buffer now reports a
62-tile flat clearing at each base with **zero void** inside it, two wide
low-gradient routes from each clearing toward the centre (5.11 km and 4.77 km), ore
in 12 groups with four of 3+ tiles per base, and ridge runs with two-step flanks.
`scripts/world-composition-probe.mjs` passes.

The *pixels* do not say any of that. Two independent readers, looking at the frames
and at a rendered map of the same world, agree it still fails as a read:

> **Independent critic (frames, after the pass):** VERDICT FAIL. *"No readable
> resource/buildability language. At this zoom, resource outcrops are absent or
> indistinguishable — the scattered dark ground tiles read as debris/noise, not
> harvestable nodes. Buildable ground is a large purple void with no calm boundary,
> and the gray cliffs do not telegraph flanks or choke routes. A player cannot
> identify where to build, what to harvest, or how to attack around terrain."* It
> records as working: the keep reads immediately as the player's base, the palette
> is cohesive and clean at both sizes, and the interface framing is legible.

> **Independent critic (map):** the routes now exist and *"look like deliberate
> paths"*, but *"no visible flattened or quiet clearing around either base"* and the
> ore dots are *"mostly sparse point deposits"*.

So this piece is not about generating more terrain. It is about making the existing
terrain **legible**: every affordance the simulation already has must be visible
from the pixels alone, at every zoom the game offers.

## The four affordances

1. **Ore must announce itself as harvestable.** A player looking at one frame must
   be able to point at every ore deposit. The current ore prop is a small pale
   diamond that the critic read as debris. It needs its own silhouette language
   (a crystalline shard cluster that is wider than tall, with a highlight facet) and
   enough hue and value separation from the ground that it survives at 1x zoom on a
   phone. It must also be unmistakable next to the *charge* crystals, which are the
   other glowing thing on the ground.
2. **Buildable ground must read as the calmest surface on screen.** The clearing
   inside the base's flat disc is where a player builds. Today the ground noise is
   uniform, so a busy field extends right up to and through the clearing. Ground
   detail is a volume knob: turn it *down* inside the clearing and at any flat disc
   the simulation marks as buildable, and *up* at the features the composition pass
   created, which is the opposite of the current even spread.
3. **The routes must visibly leave the base.** The paved corridors exist in the
   tile data and are drawn, but the critic says they *"do not visibly connect to the
   base"*. A route must start where the clearing ends and read as a continuous band
   for at least 30 tiles, so the player can see which way out is which.
4. **Cliffs and ridges must telegraph flank and choke.** A cliff face needs a light
   side and a shadowed side, and a ridge needs enough vertical structure to read as
   a wall rather than a colour change in the ground.

## Rules

- **Palette.** 32 colours, unchanged. Legibility comes from arrangement, value
  separation and silhouette, not from new hues. If a hue change is unavoidable,
  take it from the existing ramp and say which two entries it swaps.
- **Showcase frozen.** At t = 108 s the tuple must still read
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`, including after switching
  from a match back to the showcase. The authored island must not change by a pixel.
- **Determinism.** The same seed produces the same world; the match determinism gate
  compares two matches in one run (it reads `39ee7d97` today). A regeneration is not
  expected for this piece unless the fix requires one.
- **Frame budget.** 60.3 fps mean and p95 ≤ 17.5 ms on desktop and phone at every
  zoom step. The widest step renders about 9,400 instances; do not raise it by more
  than 15 %.
- **Procedural and pixel-exact.** No textures, no decals, no image files, no new
  render passes, no new dependencies.
- **Two readers must agree at the end.** The frames pass gets a fresh blind critic;
  the map render gets a fresh independent read. Both must stop naming resource and
  buildability readability.

## Measured acceptance (the agent implements the measurement)

Add `scripts/terrain-legibility.mjs`: it starts a world match on the built bundle,
walks the camera to a base, captures a frame at 1x and at the widest zoom, and
prints three numbers. The numbers before and after the change are the evidence.

1. **Ore separation.** Sample the pixels of an ore deposit and the median ground
   colour within 8 tiles of it. Report the hue distance and the lightness
   difference. Target: both clearly above the measurement's own noise floor, and
   ore distinguishable from ground *and* from charge crystals at 1x on a phone.
2. **Calm clearing.** Report the standard deviation of ground-shade pixels inside
   the base clearing and in a control region of the same size away from the base.
   Target: the clearing is the *quieter* of the two, by a margin the agent states
   before it starts.
3. **Route continuity.** From the clearing edge outward, report the longest run of
   consecutive tiles whose pixels read as route rather than ground. Target: at
   least 30 tiles, in both route directions from each base.

State the three targets as numbers in the report *before* the change, then show the
after numbers beside them.

## Acceptance criteria

1. All three measured targets above are met on the final build, on desktop and on a
   landscape phone.
2. A fresh blind critic judging frames at 1x and at the widest zoom no longer names
   resource or buildability readability as the single biggest gap, and does not call
   the ground noise.
3. A fresh read of the rendered map says the world reads as composed geography.
4. Every existing gate passes on all five viewports (`canvas-fits` now expects fill
   mode on a landscape touch viewport, `tap-clears` derives its point from
   `__APP.tileScreen`, `match-end`, `world-composition`, both determinism gates).
5. Showcase tuple unchanged; palette count still 32; fps within 0.5 of 60.3.

## Non-goals

New units, buildings, mechanics or costs; unit art; camera, controls or interface
changes; the skill tree; texture work; and any change to the world *generator*
unless a legibility fix genuinely cannot be made on the rendering side — the
generator's probe already passes and should stay passing.
