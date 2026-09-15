# Starhold — unit and building design contract (wave 2)

Status: **binding** from 2026-09-13. This file owns silhouette identity, animation
motion, and the sprite/icon pipeline. `docs/CIVILIZATIONS.md` owns names, roles,
costs, tiers, and faction identity. `docs/MATCH_SPEC.md` owns the runtime ABI.

## 1. Rule

Every type has: one silhouette idea from Earth history, extended into the Vesper
March's repaired-machinery world. Borrow the **shape logic** (formation, tool,
posture, mount), never the literal costume. No horses, sails, or swords appear as
themselves; the same idea returns as plating, walkers, hooks, banners, and ember
machinery. Nobody recolours the ground.

## 2. Dawnward Compact — ordered, durable, civic

Earth lineage: legionary drill, Hanseatic trade houses, basilica civic order,
lighthouse keepers.

### Buildings

| Kind | Silhouette rule | Idle motion |
|---|---|---|
| 10 Charter Keep | Stepped basilica citadel, square base, ivory shoulders, one teal keep roof, gold finial | Banner flutter, watch-light pulse |
| 11 Freight Court | Customs house with a projecting crane arm and crate apron | Crane swings, crate stack settles |
| 12 Heliowell | Wellhead ring with a raised prism lens on a tripod | Lens glint pulses; charge motes rise |
| 15 Hearth Pods | Two stacked dome pods on a low plinth, one chimney | Chimney smoke puffs on a slow cadence |
| 13 Muster Hall | Drill hall with a shield rack along the front, paired doors | Rack shelf sway, gate spokes turn |
| 14 Starforge | Vaulted forge, chimney, and a hammer beam over an anvil apron | Hammer strikes; spark flashes in the forge mouth |
| 16 Prism Bastion | Narrow prism tower, aperture shutters, lattice relay ring | Lattice hum: ring segments brighten in sequence |
| 17 Sky Wharf | Open dock with a gantry crane and a mooring cradle | Gantry traverses; cradle dips as a skiff docks |

### Units

| Kind | Silhouette rule | Idle | Attack / work |
|---|---|---|---|
| 20 Riveter | Upright engineer, tool belt, one raised rivet hammer | Hammer taps at rest height | Hammer cycle; weld flash on the work arc |
| 21 Pack Beetle | Low dome shell on six short legs, bundle rack on top | Shell settles; straps tighten | Crate load: bundle drops, shell dips |
| 22 Ward Sentinel | Tower shield forward, upright torso, one short jab arm | Shield set; helmet glint | Shield bash forward, then short jab |
| 23 Sunlance | Long lance-rifle braced on a pavise plate, upright knight | Rest on shoulder; pavise tips | Level, brace, muzzle flash, two-pixel recoil |
| 24 Harbor Skiff | Small gull-wing skiff with a cyan drive sail | Hover bob, wing flex | Courier dip over a crate |
| 25 Prism Cantor | Standard bearer: tall banner pole, prism lantern, no shield | Lantern pulse; banner sway | Raise banner: ward ring flashes outward |
| 26 Star Ram | Tracked chassis, square ram head on rails, ribbed body | Rails settle; exhaust ticks | Ram slides forward; impact burst at the head |

## 3. Cinderwake Reavers — fast, salvage, raiding

Earth lineage: steppe horse-archers (rider fused with mount), whaling and
boarding hooks, breaker's yards, fire-ships, torch-bearer signals.

### Buildings

| Kind | Silhouette rule | Idle motion |
|---|---|---|
| 60 Pyre Ark | Lean wedge barge, caged ember at the centre, rear hook mast | Ember glow breathes; chains sway |
| 61 Scrap Maw | Breaker's yard: toothed jaw intake, tilted sorting chute | Jaw chomps on a slow cadence; sparks |
| 62 Ember Siphon | Caged star ember with a siphon arm on a pivot | Siphon rotates; heat shimmer rises |
| 65 Soot Nests | Stacked field shelters on stilts, patched tarps | Tarps flutter; a lamp swings |
| 63 Fang Yard | Open fighting pit ringed by weapon racks and hooks | Racks sway; brazier smoke |
| 64 Chainworks | Chain forge: lift gantry feeding a toothed press | Chain lift cycle; press sparks |
| 66 Hook Spire | Harpoon tower, coiled line, forward-thrown hook head | Line hum; hook head ticks | 
| 67 Rift Mooring | Sky dock with clamps and a launch rail | Clamp cycle; rail glow |

### Units

| Kind | Silhouette rule | Idle | Attack / work |
|---|---|---|---|
| 32 Ashhand | Crouched scavenger: hood, hook, pry bar, low stance | Pry tap; head turn | Sift/dismantle: pry lever and salvage puff |
| 33 Chain Mule | Long pack walker with flank hooks and hanging salvage | Head bob; hook sway | Load: hooks close, packs settle |
| 34 Hookguard | Crouched boarder: boarding hook in one hand, plank shield in the other | Weight shift; hook test swing | Hook drag forward, then chop |
| 30 Ash Jackal | **Steppe centaur**: four-legged jointed chassis fused to an archer torso, drawn ember bow, quiver rack | Paw shift; bow hand flexes; tail fin sways | Draw, hold one beat, loose: arrow tracer and small recoil |
| 35 Sootwing | Soot-black swept glider with ember dart pods | Hover bob; wing sweep | Dart spit: short tracer, weak flash |
| 36 Brandcaller | Torch-bearer: raised brand, mark glyph on the off hand | Brand flares and gutters | Raise brand: target ring flash and reveal glyph |
| 31 Cinder Strider | Reverse-jointed walker, arcing mortar on the back | Stance sway; joints tick | Rear back, then arcing shell with a visible arc |

## 4. Animation contract

Every unit kind must animate in these states using only `state` (snapshot index 5)
and `anim_phase` (index 6), plus the deterministic tick:

| State | Value | Required motion |
|---|---|---|
| idle | 0 | a two-to-four pixel cycle, period 48–96 ticks, no colour change |
| move | 1 | gait or hover cycle, period 24–48 ticks |
| attack | 2 | windup, strike, recover; the strike frame must read at normal zoom |
| work | 3 | tool cycle for workers only |
| construct | 5 | build cycle for builders at a site |
| death | 4 | collapse/fade handled by the existing wreck path |

Rules:

- Motion is procedural. No sprite atlas in world for this wave.
- Amplitude at normal zoom: 1–3 raster pixels for infantry, 2–4 for walkers and
  vehicles, 1–2 for aircraft.
- No new palette colours; use existing family steps for flashes and glints.
- A fresh blind critic must tell idle from attack from a still frame pair.

## 5. Size contract

Footprints come from `docs/CIVILIZATIONS.md`. Unit sizes match the existing
showcase scale: infantry ≈0.5–0.65 tile tall, walkers ≈0.9–1.1 tile, aircraft
0.45–0.6 tile with a hover height of 3.2–3.6.

## 6. Sprites, sheets, and icons

Two deliverables, in this order:

1. **Concept sheets** — one per unit and per building, generated with the Codex
   Plus image tool from a fixed prompt template. These are design references and
   are committed under `art/concept/`. They are never drawn at runtime.
2. **HUD icons** — a 24×24 raster icon per roster row, derived from the concept
   sheet, quantised to the 32-colour palette, committed under
   `art/icons/<kind>.png`. The HUD uses an icon when the file exists and a text
   label otherwise.

   **Measured result (2026-09-15):** 24×24 slices of the 1536×1024 roster boards
   were cut and judged. A strict critic read several of them as mush: small units
   and the two fliers collapse into a dark red mass, and wing silhouettes confuse
   with each other. Verdict: **not usable as sole button icons.** The HUD keeps
   text labels. Image-generated art is used where it reads — one section-sized
   **portrait card (>=64×64) beside the selection name** — and the roster boards
   stay design references. Pipeline: `scripts/iconize.py` (any cell size).

Not in this wave: in-world sprite atlases. The in-world renderer stays procedural
and pixel-exact. A raster atlas is a separate, separately judged piece because it
risks the palette lock, the one-pixel grid, and the four-yaw contract.

## 7. Gates

- `unit-anim` — a still pair at idle and attack differs in at least N pixels for a
  sampled unit of each faction.
- `silhouette-faction` — a blind critic separates the two factions and names the
  archer unit's mount form without colour-only clues.
- `icon-coverage` — every roster row renders an icon or a text fallback, never an
  empty button.
