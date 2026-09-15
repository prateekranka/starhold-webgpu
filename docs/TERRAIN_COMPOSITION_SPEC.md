# Starhold — terrain composition for the world match (wave 3)

Status: **binding brief.** Written before code. Owner of the decision: the game
dev lead. Implementation: one writer per file.

## Why

The independent visual gate (gpt-6-astra, blind, three frames of the live build)
returns **FAIL** and names one deficiency above all others:

> SINGLE BIGGEST GAP: Environmental composition. Across almost the entire desktop
> and phone battlefield, equally noisy purple ground replaces recognizable terrain,
> substantial scenery and clear routes; the buildings have no convincing
> surrounding world.

Its prescribed next pass, which this brief adopts:

> Replace the continuous purple field with a terrain composition built around a
> quiet base clearing, two visible routes toward clustered resource outcrops, and
> substantial rock ridges with shaded sides. Concentrate surface detail around
> those features.

It also records what already works and must not regress: ivory walls and teal
roofs make the keep distinguishable; cyan and red units stay distinguishable; the
cyan health strip reads clearly.

## What the generator does today

`world_gen(seed, tx, ty)` in `sim/src/lib.rs` is two octaves of value-noise
thresholded into four levels:

```
big  = wfbm(seed,           x/104, y/104)   // ~1 km features
fine = wfbm(seed^0x51ED2701, x/19,  y/19)   // ~190 m features
h    = big*0.70 + fine*0.30
h < 0.436 -> -1 (void)   h < 0.472 -> 0 (low)   h < 0.524 -> 0.5 (mid)   else -> 1 (high)
```

Two consequences a player sees immediately: every landform is one of two terrace
heights at two fixed feature sizes, so cliffs repeat identically across the map,
and nothing distinguishes one region from another except how much of the field
crossed a threshold. There are no routes, no landmarks and no quiet areas —
the per-tile render noise is spread evenly over all of it, which is the "equally
noisy purple ground" the gate reports.

## Measured baseline (seed 73129, faction 0)

Taken with `node scripts/world-composition-probe.mjs public/sim.wasm 73129 0`,
which reads the world buffer the simulation generates. These are the numbers this
piece must move:

```
world: 1024x1024 tiles, 10.24 km a side, generated in 326 ms
levels: 1->43.6%  -1->25.3%  0.5->19.3%  0->11.8%
base 0 at (204.5,341.5) level=1   clearing 90191 tiles 561x388, short axis 388
base 1 at (849.5,713.5) level=0.5 clearing 25291 tiles 464x366, short axis 366
base 0 -> centre: land-only route NO (761663 land tiles visited)
base 1 -> centre: land-only route NO (761663 land tiles visited)
ridge step faces: 84331, every 100x100 region holds 2+ faces
ore tiles: 28 in 18 groups, sizes 6,6,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
base 0: ore groups within 120 tiles = 3, of them 3+ tiles = 1
base 1: ore groups within 120 tiles = 2, of them 3+ tiles = 1
void: 25.3% of the world, 27.56% inside 121x121 boxes at the bases
```

Read that carefully, because it changes what this piece is for. The map is not
short of flat ground — whole terraces are flat, which is why the clearest areas
are enormous and featureless. What is missing is **connection and structure**:

- **The two starts are on separate landmasses.** A land-only walk from either base
  reaches 761,663 tiles and never arrives at the map centre. The world is canyons
  and islands, not a place with routes. Today the raid works only because movement
  ignores terrain entirely.
- **Ore is scattered as singletons.** 18 groups, 16 of them a single tile; one
  usable cluster per base where the spec wants four. There is no geography to a
  mining decision.
- **A quarter of the ground is void, and more than a quarter of the ground inside
  121x121 boxes at the bases is void.** The player's first view is canyons.
- **Ridge structure is absent.** 84,331 step faces, but they are uniformly spread
  noise — every region has a couple, so no region has a ridge that reads as one.

So the composition work is: **connect the world, cluster its resources, quiet its
clearings and give it ridges with flanks** — all while keeping the variety the
noise already provides.

## Target composition

One 10.24 km world must read as **places**, not as a texture. The composition has
four roles, and each role is a property of the terrain field, not a decal:

1. **Quiet base clearing.** Around each faction base, a substantial flat, low-noise
   area (roughly 60–90 tiles across, not the current 11×11 patch) where the base,
   its apron and the player's first buildings read cleanly. Detail is sparse here
   by design: this is the "calm" the gate asks for.
2. **Two visible routes.** Two distinct corridors leave each clearing and reach the
   contested middle. A route is low-gradient, wider than one tile, and visually
   tracked — its tiles differ from their surroundings in shade, not in height, so a
   player can see the way even at the widest zoom.
3. **Clustered resource outcrops.** Ore sits in a few groups at the ends of the
   routes and at the middle, each group on a recognisable landform (a rise, a
   basin edge, a ridge foot) rather than scattered evenly. Mining decisions become
   geography.
4. **Substantial ridges.** Rock ridges with *shaded sides*: at least two height
   steps along one flank so a ridge reads as a lit face and a shadowed face, not
   as a flat plate of one height. These are the landmarks that make a 10 km map
   navigable and that carry the detail the gate wants concentrated.

Region identity is allowed and wanted (for example a dusty basin, a ridge country,
a plain) as long as it comes out of the terrain field and stays inside the palette.

## Rules

- **Showcase stays frozen.** `world_gen` and everything downstream of it serve
  match mode only. `showcase` at t = 108 s must still read
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`, and the authored 32-tile
  island must not change by one pixel.
- **Determinism.** Same seed, same world: the match determinism gate must keep
  agreeing across two runs in one session. The recorded match hash will change —
  that is expected for this piece and must be noted in `PROGRESS.md` — but the
  gate must pass.
- **Palette.** 32 colours, unchanged. Composition comes from the arrangement of
  existing shades, not from new hues. Ground noise is a tool with a volume knob:
  raise it near features, lower it in clearings.
- **Frame rate.** 60.3 fps mean and p95 ≤ 17.5 ms must hold on desktop and phone,
  at every zoom step. The widest step currently renders 13,538 instances; a
  composition pass must not push the bake cost past the frame budget, and the LOD
  tiers must still exist and still be measured by `lod-budget`.
- **Readability at the widest zoom.** Every role above must still be identifiable
  in a single frame at the widest zoom the game allows, both bases visible or not.
- **No new dependencies.** No new passes, no post-processing, no textures.

## Acceptance criteria

1. A player can name, from one frame at the widest zoom, where the quiet ground
   is, which way the routes run, and where the ridges are.
2. Each base sits in a clearing, not on a terrace edge; the clearing is at least
   60 tiles across on its short axis, and **no void lies inside a 121×121-tile box
   centred on either base** (27.56 % today).
3. **A land-only route exists from each clearing to within 100 tiles of the map
   centre**, and two distinct such routes leave each clearing (none exist today).
   The routes are low-gradient and at least three tiles wide at their narrowest.
4. Ore appears in groups of three or more tiles within a 30-tile radius, and at
   least four such groups sit within 120 tiles of each base (one today).
5. Ridges read as landforms: at least three runs of twelve or more consecutive step
   faces within 200 tiles of each base, each run showing two height steps along one
   flank, so a ridge has a lit face and a shadowed face rather than a uniform edge.
6. Palette unchanged; showcase tuple unchanged; `lod-budget`, `world-scale`,
   `worker-tap`, `bar-hit-test`, `cancel-order`, `match-end` and both determinism
   gates still pass; fps unchanged within 0.5 fps.
7. A fresh blind visual gate on frames of the new build returns a verdict that no
   longer names environmental composition as the single biggest gap.

## Probe plan (objective, not a matter of taste)

A Node probe over the world buffer prints, per base and for the middle third of
the map: clearing extent (the largest connected flat region above a size floor),
void fraction, tile-level histogram of the four levels, ridge step counts, ore
group count and group sizes, and a route trace from the clearing to the centre
with its maximum gradient. These numbers are the evidence; the blind gate is the
judgment.

## Gate plan

Extend `scripts/capture.mjs` with `world-composition`, which asserts the numeric
floors from the criteria above (clearing ≥ 60 tiles across, no void in the
clearing, ≥ 2 ore groups of ≥ 3 tiles within 120 tiles of each base, both bases on
a clearing) so a future regeneration cannot quietly return the flat field.

## Non-goals

Obstacle-aware navigation (movement stays direct waypoint motion and canyons stay
crossable), new units or buildings, new palette entries, animated terrain, weather,
roads as separate geometry, and any change to camera, controls or the interface.
