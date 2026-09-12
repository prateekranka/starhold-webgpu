# Starhold — civilization bible

Status: **binding design contract** from 2026-09-13. This file is the source of
truth for playable civilization identity, rosters, building sets, and standard
match starts. `docs/WORLD_PLAN.md` remains the source of truth for the Vesper
March map, palette, camera, and current showcase timing.

## 1. Locked world identity

Starhold takes place on the **Vesper March**, an amethyst basalt frontier cut by
fallen-star ore, cold crystal wells, old alien roads, and broken causeways.
Settlements combine medieval civic shapes with repaired space machinery. Every
site must look built, supplied, occupied, and defended.

The shipped map and the current Dawnward settlement define the visual baseline.
Preserve these facts:

- amethyst basalt terrain, stepped cliffs, pale roads, cyan crystal seams;
- an isometric 960×540 physical raster with hard palette shading;
- teal, ivory, gold, and cyan Dawnward forms;
- wine, vermilion, orange, hooks, and wedges for Cinderwake forms;
- visible logistics, construction, repairs, patrols, raids, and projectiles;
- no generic neon boxes, smooth gradients, faction recolours, or modern Earth
  vehicles.

The terrain is neutral. A civilization owns its structures, units, effects,
banners, and interface heraldry. It does not recolour the ground.

## 2. First two playable civilizations

| Faction ID | Civilization | Strategic identity | Shape and colour ownership |
|---|---|---|---|
| 0 | **Dawnward Compact** | Durable settlement, ordered logistics, repair, long-range defense | Broad square foundations, stepped ivory shoulders, teal roofs, gold heraldry, cyan energy, upright soldiers |
| 1 | **Cinderwake Reavers** | Fast expansion, salvage, disruption, mobile pressure | Low asymmetric wedges, backward hooks, wine armor, vermilion cloth, orange heat, crouched infantry, jointed walkers |
| 2 | Neutral world | Ore, wildlife, ruins, effects, and scenario objects | Violet geology, old stone, neutral metal; never used as a playable faction |

Neither playable civilization is a skin of the other. They cover the same seven
unit roles and eight building roles so a match is readable. Their concrete
units, buildings, silhouettes, production rules, and tactical strengths differ.
No third civilization starts production until both of these pass their full
completion gate in section 11.

## 3. Shared match grammar

Both civilizations use:

- **Alloy** for structure, armor, tools, and hulls.
- **Charge** for advanced weapons, support systems, and energy structures.
- **Population** for live units. A headquarters starts with 15 capacity.
- Three development tiers: **Founding**, **March**, and **Starhold**.

Shared role coverage does not mean shared statistics or art:

| Role | Dawnward | Cinderwake |
|---|---|---|
| Worker | Riveter | Ashhand |
| Hauler | Pack Beetle | Chain Mule |
| Front line | Ward Sentinel | Hookguard |
| Ranged pressure | Sunlance | Ash Jackal |
| Scout / light aircraft | Harbor Skiff | Sootwing |
| Support | Prism Cantor | Brandcaller |
| Siege | Star Ram | Cinder Strider |

## 4. Standard skirmish start

This is the player start for balance work. It is not the existing autonomous
showcase scene.

### Shared opening state

- Three complete buildings: headquarters, alloy depot, and charge source.
- Ten unit models using 11 population of 15.
- 80 Alloy and 40 Charge after all starting assets are paid for.
- No tower, military production building, siege unit, or support unit.
- Four workers begin on the nearest ore. Two workers wait beside the
  headquarters for the first build order.
- The hauler waits at the depot. Two combat units hold the exposed approach.
- The scout starts over or beside the headquarters.
- The first real choice is housing, military production, or faster industry.

### Exact starting packages

| Civilization | Complete starting buildings | Starting units |
|---|---|---|
| **Dawnward Compact** | 1 Charter Keep, 1 Freight Court, 1 Heliowell | 6 Riveters, 1 Pack Beetle, 2 Ward Sentinels, 1 Harbor Skiff |
| **Cinderwake Reavers** | 1 Pyre Ark, 1 Scrap Maw, 1 Ember Siphon | 6 Ashhands, 1 Chain Mule, 2 Ash Jackals, 1 Sootwing |

The starts are economy-equivalent, not unit-identical. Dawnward begins with a
stronger defensive screen. Cinderwake begins with faster harassment. The scout
is a one-time starting asset until its air building is complete.

## 5. Dawnward Compact — full building set

Existing names, footprints, and visual language are locked.

| Kind | Tier | Building | Function | Cost A/C | Time | Footprint / HP |
|---:|---|---|---|---:|---:|---|
| 10 | Founding | **Charter Keep** | Headquarters, worker training, tier advance, basic drop-off | 100/60 | 48 s | 4×4 / 1,500 |
| 11 | Founding | **Freight Court** | Main ore drop-off, cargo routing, Pack Beetle production | 24/0 | 24 s | 3×3 / 600 |
| 12 | Founding | **Heliowell** | Generates Charge and anchors the Prism Lattice | 32/20 | 30 s | 2×2 / 600 |
| 15 | Founding | **Hearth Pods** | Adds population capacity and civilian shelter | 20/8 | 24 s | 3×2 / 600 |
| 13 | March | **Muster Hall** | Ward Sentinel, Sunlance, and Prism Cantor production | 28/12 | 24 s | 3×3 / 600 |
| 14 | March | **Starforge** | Alloy efficiency, weapon upgrades, Star Ram production | 36/16 | 30 s | 3×3 / 600 |
| 16 | Starhold | **Prism Bastion** | Long-range static defense and local lattice relay | 40/24 | 42 s | 2×2 / 900 |
| 17 | Starhold | **Sky Wharf** | Harbor Skiff production, cargo export, air repair | 48/24 | 30 s | 4×3 / 600 |

### Dawnward building standard

- Foundations are square or stepped. Doors and work faces point to a road.
- Ivory carries the broad lit mass. Teal owns roofs and armor. Gold marks civic
  rank. Cyan is energy only.
- Construction uses measured stages, paired ribs, fitted panels, and supplied
  crates. A whole building never scales up from the ground.
- Damage adds cracked panels and smoke. A destroyed building leaves a repairable
  same-footprint scaffold.

## 6. Dawnward Compact — full unit set

| Kind | Tier | Unit | Producer | Cost A/C | Train / Pop | Combat and work role |
|---:|---|---|---|---:|---:|---|
| 20 | Founding | **Riveter** | Charter Keep | 4/0 | 6 s / 1 | Gathers, builds, repairs; 70 HP; speed 1.4 |
| 21 | Founding | **Pack Beetle** | Freight Court | 8/2 | 10 s / 1 | Hauls ore and build kits; retreats from combat; 180 HP; speed 1.0 |
| 22 | Founding | **Ward Sentinel** | Muster Hall | 8/4 | 12 s / 1 | Shielded line defender; range 5; 12 damage; 180 HP; speed 1.6 |
| 24 | Founding start / Starhold replacement | **Harbor Skiff** | Sky Wharf | 12/6 | 18 s / 2 | Fast air scout and one-crate courier; no main attack; 150 HP; speed 2.0 |
| 23 | March | **Sunlance** | Muster Hall | 10/6 | 16 s / 2 | Fragile long-range rifle knight; range 7; 25 damage; 110 HP; speed 1.4 |
| 25 | March | **Prism Cantor** | Muster Hall + Heliowell | 14/10 | 22 s / 2 | Projects a short protective ward and improves nearby repair; 100 HP; speed 1.35 |
| 26 | Starhold | **Star Ram** | Starforge | 24/18 | 32 s / 3 | Slow tracked siege projector; strong against buildings, weak when surrounded; 360 HP; speed 0.75 |

### Dawnward signature rule — Prism Lattice

A completed Heliowell connects to structures through completed roads. Connected
structures repair and recharge 20% faster. The rule does not multiply gathered
resources. Broken roads or lost Heliowells remove the bonus but do not disable a
building. This makes Dawnward strong when it holds a planned settlement.

## 7. Cinderwake Reavers — full building set

Cinderwake structures are rebuilt expedition machines. They are not ruins and
not Dawnward buildings with red paint.

| Kind | Tier | Building | Function | Cost A/C | Time | Footprint / HP |
|---:|---|---|---|---:|---:|---|
| 60 | Founding | **Pyre Ark** | Headquarters, Ashhand training, tier advance, basic drop-off | 90/50 | 44 s | 4×4 / 1,350 |
| 61 | Founding | **Scrap Maw** | Ore crusher, salvage intake, Chain Mule production | 22/0 | 21 s | 3×3 / 525 |
| 62 | Founding | **Ember Siphon** | Generates Charge from a caged star ember | 30/18 | 27 s | 2×2 / 500 |
| 65 | Founding | **Soot Nests** | Adds population capacity through stacked field shelters | 18/6 | 20 s | 3×2 / 450 |
| 63 | March | **Fang Yard** | Hookguard, Ash Jackal, and Brandcaller production | 26/10 | 22 s | 3×3 / 525 |
| 64 | March | **Chainworks** | Salvage upgrades and Cinder Strider production | 34/14 | 28 s | 3×3 / 650 |
| 66 | Starhold | **Hook Spire** | Harpoon defense that slows one target before firing | 38/20 | 38 s | 2×2 / 750 |
| 67 | Starhold | **Rift Mooring** | Sootwing production and rapid field redeployment | 44/22 | 28 s | 4×3 / 550 |

### Cinderwake building standard

- Foundations are offset wedges or open frames. Roof lines lean backward.
- Wine armor owns the broad mass. Vermilion marks cloth and danger. Orange is
  heat, ammunition, and furnace light. Pale stone appears only as stolen trim.
- Hooks, suspended chains, exposed pistons, tooth plates, and patched sails show
  function. No tower or roof can share the Dawnward silhouette.
- Construction starts as anchored chains and an open frame. Modules arrive as
  salvage sections, lock at unequal heights, and then ignite.
- Damage removes panels and vents heat. A wreck remains harvestable and can be
  rebuilt on the same foundation.

## 8. Cinderwake Reavers — full unit set

| Kind | Tier | Unit | Producer | Cost A/C | Train / Pop | Combat and work role |
|---:|---|---|---|---:|---:|---|
| 32 | Founding | **Ashhand** | Pyre Ark | 4/0 | 5 s / 1 | Gathers, builds, dismantles, and harvests salvage; 60 HP; speed 1.55 |
| 33 | Founding | **Chain Mule** | Scrap Maw | 7/2 | 9 s / 1 | Fast hauler with two salvage hooks; 150 HP; speed 1.15 |
| 34 | Founding | **Hookguard** | Fang Yard | 7/3 | 10 s / 1 | Close line fighter that pins fast units; 150 HP; speed 1.8 |
| 30 | Founding | **Ash Jackal** | Fang Yard | 8/4 | 11 s / 1 | Fast ranged raider; short range, burst fire, weak armor; 80 HP; speed 1.8 |
| 35 | Founding start / Starhold replacement | **Sootwing** | Rift Mooring | 11/5 | 16 s / 2 | Air scout with weak ember darts; no cargo; 120 HP; speed 2.4 |
| 36 | March | **Brandcaller** | Fang Yard + Ember Siphon | 12/9 | 19 s / 2 | Marks one target for focused damage and reveals it through cover; 90 HP; speed 1.5 |
| 31 | Starhold | **Cinder Strider** | Chainworks | 22/16 | 28 s / 3 | Reverse-jointed siege walker; range 7, arcing splash shell; 240 HP; speed 0.9 |

### Cinderwake signature rule — Salvage Claim

Destroyed units and buildings leave bounded wrecks. Ashhands and Chain Mules can
recover them as Alloy. A unit wreck returns 25% of its base Alloy cost. A
building wreck returns 35%. Charge is never recovered. Wrecks expire or can be
denied by the opponent. This gives Cinderwake momentum after combat without a
third resource or hidden income.

## 9. Visual and gameplay standardization

Every concrete type must have one entry with these fields before implementation:

- stable kind ID and faction ID;
- name, role, tier, producer, prerequisites;
- Alloy cost, Charge cost, train/build time, population;
- footprint or collision radius, HP, speed, range, damage, cadence;
- one primary action, one clear weakness, and one counter relation;
- four-yaw silhouette sheet or procedural silhouette contract;
- faction colour ownership, size at normal zoom, selection shape, death/wreck;
- idle, move, work, attack, construction, damage, and death motion as applicable.

Do not identify a building by a numeric range such as `kind < 20` after
Cinderwake buildings enter the game. Use explicit registry membership. Keep the
existing concrete IDs. The simpler shared-kind plus faction-recolour plan is
rejected because it would remap the shipped Ash Jackal and Cinder Strider and
would encourage visual clones.

Reserved stable IDs:

- 10–17: Dawnward buildings, locked.
- 20–26: Dawnward units; 20–24 locked, 25–26 reserved above.
- 30–36: Cinderwake units; 30–31 locked, 32–36 reserved above.
- 40–52: current neutral objects and effects, locked.
- 60–67: Cinderwake buildings, reserved above.

## 10. Showcase preservation

The shipped autonomous scene is the **Dawnward Founding Showcase**. It starts
with four complete Dawnward buildings and a larger active roster because its job
is to show construction, logistics, and a raid by simulation time 108 seconds.
That scenario stays deterministic and remains the visual benchmark.

The standard skirmish start in section 4 is a separate future scenario. Do not
change `sim_init(seed)` or its verified hash merely to make the standard start
appear. A future additive entry point can select scenario and faction while
`sim_init(seed)` retains the showcase for regression captures.

Current Cinderwake raid waves remain valid preview actors. Their two existing
units become part of the full playable roster; they are not discarded.

## 11. Two-civilization completion gate

Both civilizations must pass before a third is designed or built:

1. Eight buildings and seven units exist for each faction.
2. Every type is named in selection UI and has a unique silhouette at normal
   phone zoom and desktop zoom.
3. No Cinderwake structure reuses Dawnward massing. No faction uses a palette
   family owned by the other for its broad armor or roof area.
4. Each standard start has the exact three buildings and ten units in section 4.
5. Each faction can gather, build housing, make military units, reach Starhold,
   field support and siege, lose units, and recover from damage.
6. Dawnward Prism Lattice and Cinderwake Salvage Claim produce visible,
   deterministic state changes.
7. Same seed plus faction plus command stream gives the same normalized state
   hash. Camera, selection, and render rate do not change simulation truth.
8. The current Dawnward showcase hash remains unchanged until a separately
   approved scenario migration.
9. Landscape phone, tablet, and desktop controls remain usable. Performance stays
   at least 59 fps with p95 at most 20 ms on the reference host.
10. A fresh blind critic can distinguish faction, role, and hierarchy without
    names or colour-only clues.

## 12. Implementation order

1. Complete the locked lighting and contrast pass. It changes presentation only.
2. Add explicit civilization registries and remove numeric-range type checks.
3. Complete and verify Dawnward unit 25 and unit 26.
4. Complete the seven Cinderwake unit silhouettes and motion set.
5. Complete the eight Cinderwake buildings and their construction stages.
6. Add the separate standard-start scenario and faction selection.
7. Add player orders only through deterministic simulation commands.

This order preserves the current map and showcase while the two civilizations
become complete, judgeable pieces.
