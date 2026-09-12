# Starhold — lighting and contrast pass L1

Status: **binding presentation contract** for the next implementation pass.
Written by the orchestrator on 2026-09-13. Read with `docs/DIRECTIVE.md`,
`docs/WORLD_PLAN.md`, `docs/MOBILE_SPEC.md`, and `docs/CIVILIZATIONS.md`.

## 1. Goal

Keep the current Vesper March map and Dawnward Compact art, but make the scene
read with stronger depth, material separation, building hierarchy, and unit
contrast. The fixed light comes from the north-west and above. The south-east
side of each form must be darker. The result must remain hard-edged pixel art
inside the existing 32-colour palette.

This is a lighting and contrast pass. It is not a detail pass and not a map
rewrite.

## 2. Baseline evidence

Source implementation: `0027680`. Current canonical frame:
`evidence-p15/shot-main.png`. Target: `.dream-loop/target.png`.

Independent comparison found:

- current non-void world coverage: 42.720% of the judged frame;
- current non-void luminance mean: 81.577;
- current non-void luminance standard deviation: 42.087;
- current pixels at luminance 90 or higher: 30.796%;
- current pixels at luminance 170 or higher: 4.066%;
- target non-void luminance mean: 95.786;
- target pixels at luminance 90 or higher: 55.414%;
- target pixels at luminance 170 or higher: 8.712%.

The target fills more of its frame. That composition difference is real, but it
is outside this pass because the user locked the current map look. Do not change
camera, map bounds, terrain topology, building positions, or unit scale to game
the comparison.

## 2.1 Rejected pass 16 lesson

Pass 16 commit `4f7b483` made the face table and cast direction world-fixed, but
it failed the visual and objective gates. It changed 2.0255% of the frame;
71.648% of changed pixels became darker. Non-void mean fell to 80.981, the
midtone share fell to 30.148%, and a fresh DeepSeek critic selected pass 15 as
the better image.

Keep its world-space direction as the technical base. Do not deepen shadows
again. The next correction must lift normal structural stone out of ink values,
raise selected top/key-facing Dawnward planes, restore the Hearth values that
pass 16 lowered, and leave terrain unchanged.

## 2.2 Rejected pass 17 lesson

Pass 17 commit `a947440` kept pass 16's direction and lifted normal structural
stone. It passed 8/8 runtime gates, raised contrast deviation to 44.397, and a
fresh critic selected it over pass 15. It still failed the lighting gate:
non-void mean 82.417, midtone share 30.815%, and bright share 4.295%. Only
1.6574% of frame pixels changed from pass 16. Local box-face changes cannot
create the broad value grouping seen in the target.

Keep pass 17 as the candidate base. The next isolated piece is one world-fixed
open-sky light pool over the settled core. Implement it inside the existing
`basalt()` palette function. It remaps existing violet plate pixels and cannot
change geometry, authored motif positions, roads, cliffs, or the outer map.

## 2.3 Pass 18 component decision

Pass 18 commit `248a8ae` adds the exact-palette settled-core light pool. Keep it.
It moved non-void mean from 82.417 to 85.679 and midtone share from 30.815% to
37.268%. Contrast deviation is 44.820. Runtime, palette, texture, cliff, and
simulation gates pass. Both the orchestrator and a fresh DeepSeek critic judged
the light pool coherent and material, not an artificial ellipse.

Lighting L1 remains open by a narrow margin: mean needs 0.321, midtones need
0.732 percentage points, and endpoint highlights need 0.685 percentage points.
Do not expand the terrain ellipse. The next isolated piece is one palette step of
world-fixed bounce on the south-facing cross-light face of normal faction
geometry. The east face remains the deepest visible shadow.

## 2.4 Pass 19 component decision

Pass 19 commit `b90631c` adds one south-face bounce step to normal faction
geometry. Keep it. Mean 87.250, contrast deviation 46.844, and midtone share
38.488% pass. Runtime, palette, terrain, cliff, and simulation gates pass. Both
critics judge it material. Highlight share is 4.904%, only 0.096 percentage
points below the 5.0% floor (approximately 184 judged pixels).

The final correction is not another wall or terrain lift. Promote only small,
top-facing, actor-owned planes by one family step toward the existing endpoint.
This makes unit helmets, tools, and weapon faces read at normal zoom without
adding geometry or making static props interactive.

## 2.5 Pass 20 component decision

Pass 20 commit `d2cd6c1` promotes small actor top planes toward their existing
material endpoint. Keep it. It changed 157 frame pixels, all brighter, and raised
highlight share from 4.904% to 4.953%. All other gates remain green. A fresh
critic judged the actor crop clean and explicitly approved expanding the same
rule to 0.40 tile. Approximately 90 more judged pixels must enter the highlight
band.

The final pass changes only the endpoint-glint size eligibility from the shared
`small` limit of 0.30 tile to a dedicated maximum dimension of 0.40 tile. Do not
change the existing `small` variable because broad-face endpoint protection uses
it.

## 2.6 Pass 21 decision

Pass 21 commit `b2388b9` widens actor-glint eligibility to 0.40 tile. It passes
all 63 desktop/mobile runtime gates, all objective lighting gates in three
identical canonical runs, exact palette, four-yaw fixed-light review, terrain,
cliff, performance, capacity, and simulation checks. The final independent
target critic still fails it and names weak value separation as the largest gap.
World identity remains intact.

A fresh focused critic selected one correction: promote only non-actor top faces
one palette step to existing endpoints. Do not darken walls or expand the terrain
pool. Apply this only to normal mode 0, `combat < 17`, authored pigments 4–27,
top face ID 0, and boxes larger than 0.40 tile. Tiny props and actors stay out.

## 2.7 Pass 22 decision

Pass 22 commit `ae945ff` promotes non-actor top faces toward their endpoints. It
passes every objective gate: mean 88.643, deviation 49.654, midtones 38.544%,
and highlights 7.192%. The final DeepSeek and Cursor Auto critics still fail the
lighting scope. Both now name shadow/emissive separation rather than brightness.
The focused critic chose existing cast-shadow pigment 2→1 over darker east
faces or removal of south bounce.

Keep pass 22 as the candidate base. The next and final change is one source token
inside `shadow()`: the broad connected cast fill uses palette index 1 instead of
2. The separate contact lip remains index 0. Do not change shadow geometry,
height, direction, or any lit surface.

## 3. Required visual changes

### 3.1 World-fixed directional light

Use one fixed north-west/above light in world space. Camera rotation must reveal
different lit and shadowed faces; the light must not rotate with the camera.

For every solid material family:

- upward faces use the authored base value;
- faces toward north-west lose at most one family step;
- cross-light faces lose one or two family steps before local bounce;
- normal faction geometry (`screen == 0`, authored pigment 4–27) receives one
  discrete bounce step on world south face ID 2; the same family caps as the key
  lift apply, and explicit pigments 0–3 stay dark;
- static map mode `-6`, terrain `-5`, shadows/marks `-3`, shards `-2`, emissives
  `-4`, HUD, and the world-east face do not receive this bounce;
- faces toward south-east lose at least two family steps;
- undersides and deep recesses use the darkest valid family entry or ink;
- solid geometry never shades into palette index 0, which is the void colour.

Do not use RGB multiplication. Select discrete entries from the existing family.
No smooth light, gradient, normal map, bloom, alpha shadow, or new colour.

### 3.2 Ground hierarchy

Keep the amethyst basalt and all authored plates, cracks, terraces, props, and
roads. Rebalance existing violet and stone entries so terrain supports the
settlement instead of competing with it:

- broad walkable ground stays in dark and middle violet values outside the settled
  core;
- one world-fixed open-sky pool is permitted over the settled core: ellipse center
  `(16,17)`, radii `(11,9)` in world tiles, evaluated in `basalt()` immediately
  before its final return;
- inside that ellipse only, remap an existing result of index 28 to 29 and index 29
  to 30; keep index 30 unchanged and never promote ground to index 31;
- stone joints, road pixels, authored chips, seams, and motif positions stay in
  place; only their final violet value can move by one step;
- outside the ellipse, every terrain pixel stays bit-identical to pass 17;
- `#BD96C1` stays limited to crystal tips and small rim accents, not broad ground
  fill;
- north-west terrace lips can be one step lighter than their caps;
- south-east ledges and contact lines are darker by one clear step;
- pale roads remain visible, but road centers must not become as bright as Keep
  walls or unit highlights;
- preserve the pass-15 texture and cliff-ramp gates.

### 3.3 Building hierarchy

The Charter Keep is the first value landmark. The Heliowell and active Prism
Bastion are second. Housing and utility buildings are quieter.

- Keep: broad ivory midtone, highest-ivory top plane, small edge glints, strong
  teal roof shadow, clear dark doorway.
- Final building-top rule: only normal mode 0, `combat < 17`, authored pigment
  4–27, top face ID 0, and maximum dimension greater than 0.40 tile receives one
  additional step toward endpoint 9, 14, 18, 22, or 27. Side faces keep their
  existing penultimate caps.
- Terrain/static-map modes, actors, HUD, effects, and boxes at or below 0.40 tile
  cannot enter this rule.
- Heliowell/Bastion: cyan energy is bright but occupies small areas; structure
  mass remains readable when energy is ignored.
- Hall/Forge/Court/Wharf: one clear lit face and one clear shadow face; function
  details remain subordinate to the silhouette.
- Hearth Pods and small props: one value step below civic and military anchors.
- Contact shadow must join each foundation to the ground. It must not become a
  detached soft halo.

### 3.4 Unit and combat readability

Do not resize or move units in this pass.

- Friendly actors keep teal/ivory/gold/cyan ownership. Raise one small core face
  or shoulder plane by one family step where needed. Keep a complete ink contour.
- Final actor endpoint rule: only `combat >= 17`, `screen` from -2 through 0,
  top face ID 0, authored pigment 4–27, and maximum box dimension at most 0.40
  tile can receive one extra step; cap at its existing family endpoint 9, 14,
  18, 22, or 27. This rule uses a dedicated size check and does not alter the
  shared `small` value.
- Static geometry, buildings, terrain, projectiles/effects without actor ownership,
  emissives, and broad actor planes cannot enter the final endpoint rule.
- Reavers keep wine/vermilion/orange ownership. Their orange weapon face is the
  focal pixel; broad armor stays darker than Dawnward armor.
- At the eastern fight, adjacent friendly and enemy silhouettes must not merge
  into one dark cluster.
- The selected entity ring uses bright gold segments with an ink separation from
  the ground. It must remain visible at the 844×390 phone layout.
- Muzzle flashes and energy cores can use family endpoints. Do not brighten all
  particles or make static props look interactive.

### 3.5 Cast and contact shadows

Keep shadows hard and palette-bound.

- Cast direction is south-east in world space at every yaw.
- Existing connected cast fill uses palette index 1; the narrow contact lip stays
  index 0. Do not alter either footprint.
- Major buildings receive a short, connected stepped shadow.
- Units receive a one- or two-pixel contact shadow plus the existing short cast
  direction. Air-unit shadows remain on terrain.
- Roads and shallow ground marks do not cast tall shadows.

## 4. Objective gates

The orchestrator extends the existing `scripts/measure-detail.py`; no new test
file is required. The canonical 960×540 frame must meet all of these:

- exact palette: at most 32 colours and zero colours outside `src/kinds.ts`;
- non-void coverage stays between 40% and 46%; this preserves framing;
- non-void luminance mean is 86–94;
- non-void luminance standard deviation is at least 44;
- at least 38% of non-void pixels have luminance 90 or higher;
- 5.0–8.5% of non-void pixels have luminance 170 or higher;
- terrain transition density stays 0.20–0.30;
- largest `#624779` component stays below 8,000 pixels;
- largest `#3C3057` component stays below 6,000 pixels;
- cliff lower/upper ratio stays at or below 0.85 and slope stays negative;
- renderer reports `saturated=false` and remains below the instance cap.

These numbers prevent a dark flat frame, but they do not prove good lighting.
The visual gate remains authoritative: in a fresh target-vs-build comparison,
the single largest gap must no longer be flat lighting, weak value separation,
or unreadable units.

## 5. Functional and performance invariants

- Raw WebGPU and the fixed 960×540 physical raster remain.
- Exact 32-colour palette. No new hex value.
- Rust/WASM simulation, ABI, seed 73129, tick order, entity count, start state,
  combat, construction, selection, camera, zoom, HUD layout, touch layout, and
  controls remain unchanged.
- `sim/src/lib.rs` and `src/main.ts` stay untouched.
- Canonical raw-WASM hash stays
  `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`.
- Desktop, landscape phone, tablet, and portrait gates all pass.
- At least 59 fps and p95 at most 20 ms on the reference hardware.
- No added draw pass, dependency, texture, per-frame allocation, or random input.

## 6. Non-goals

Do not:

- add either civilization's missing units or Cinderwake buildings;
- change terrain shape, roads, props, architecture, footprints, map coverage, or
  canonical camera framing;
- add more micro-detail, particles, windows, crates, grass, or crystals;
- change gameplay values, faction balance, starting roster, or selection rules;
- alter mobile control placement or button size.

## 7. Definition of done

1. One isolated renderer commit implements the pass.
2. Production build succeeds.
3. Existing desktop and mobile runtime gates pass.
4. Exact simulation hash matches.
5. Palette, lighting, texture, cliff, and instance metrics pass.
6. Screenshots at all four yaw steps show one fixed world light.
7. A fresh blind critic no longer names lighting/contrast or unit readability as
   the largest gap.
8. If any gate loses, restore the last verified release and name one gap for the
   next iteration.
