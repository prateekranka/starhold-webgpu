# Starhold — match mode, ages, HUD, and mobile contract

Status: **binding** from 2026-09-13 (wave 2). `docs/CIVILIZATIONS.md` owns rosters,
costs, and faction identity. This file owns the runtime ABI, age rules, command
verbs, HUD contract, portrait contract, and the harness gate names that prove them.
Read `docs/UNIT_DESIGN.md` for silhouette and animation rules.

Preserve the showcase: `sim_init(seed)` and its verified hash `20b89f84` must not
change. Match mode is a second, additive scenario.

## 1. Modes

| Mode | Entry | Use |
|---|---|---|
| Showcase | `sim_init(seed)` | the shipped autonomous Dawnward settlement, t=108 benchmark captures |
| Match | `sim_match_init(seed, faction)` | standard skirmish start, player commands, ages, both civs |

`sim_mode()` returns 0 for showcase and 1 for match. The showcase tick body must
stay byte-identical; match mode is a separate branch inside the same `Sim`.

## 2. Frozen ABI (additive)

```ts
// existing, unchanged
sim_init(seed:u32):void; sim_step(dt_ms:f32):void;
sim_entity_count():u32; sim_entity_ptr():*const f32; sim_entity_stride():u32;
sim_select(index:i32):void; sim_terrain_ptr():*const f32;
sim_alloy():u32; sim_charge():u32;
// new in wave 2
sim_match_init(seed:u32,faction:u32):void;
sim_mode():u32;            // 0 showcase, 1 match
sim_player():u32;          // 0 Dawnward, 1 Cinderwake (player faction in match)
sim_age():u32;             // 0 Founding, 1 March, 2 Starhold
sim_age_progress():f32;    // 0..1 while a tier advance runs, else 1
sim_age_cost():u32; sim_age_cost_charge():u32;   // next tier, 0 at Starhold
sim_pop_used():u32; sim_pop_cap():u32;
sim_command(op:u32,a:u32,b:u32):u32;   // 1 accepted, 0 rejected
sim_roster_count():u32; sim_roster_ptr():*const f32;   // stride 8, see §3
sim_can_train(kind:u32):u32;  // 1 trainable now for the current selection
sim_can_build(kind:u32):u32;  // 1 buildable now for the current selection
```

`sim_entity_stride()` stays 12 and the snapshot layout stays
`x,y,z,yaw,kind,state,anim_phase,health,selected,faction,param0,param1`.
No worker may change the stride or the meaning of indices 0–11.

## 3. Roster table

`sim_roster_ptr()` returns `sim_roster_count()` rows of 8 floats:

| Index | Field |
|---|---|
| 0 | kind |
| 1 | faction (0 Dawnward, 1 Cinderwake) |
| 2 | tier (0 Founding, 1 March, 2 Starhold) |
| 3 | klass (0 building, 1 unit) |
| 4 | producer kind (0 for buildings that need no producer) |
| 5 | Alloy cost |
| 6 | Charge cost |
| 7 | population (units only) |

The HUD renders exactly these rows and no rules of its own. Costs and tiers come
from `docs/CIVILIZATIONS.md` §5–§8.

## 4. Ages

- Three tiers: **Founding → March → Starhold**.
- Advance cost: Founding→March **60 Alloy / 30 Charge**; March→Starhold
  **100 Alloy / 60 Charge**. Deducted when the command is accepted.
- Advance time: **40 s** and **60 s**. Age increments when the timer completes.
- A tier gates buildings and units of a higher tier. A unit also needs its
  producer building complete and its producer's tier satisfied.
- Population: headquarters **15** capacity, plus **5** per completed housing
  building (Hearth Pods kind 15 / Soot Nests kind 65).
- `sim_command(2,0,0)` requests the next tier. Reject when the cost is unaffordable
  or the age is already Starhold.

## 5. Commands

| op | a | b | Meaning |
|---|---|---|---|
| 0 | unit kind | producer entity index | Train one unit |
| 1 | building kind | tile index `x + y*32` | Start a construction site |
| 2 | 0 | 0 | Advance age |
| 3 | 0 | 0 | Cancel the selection's current production |

- Train deducts cost and population immediately, then spawns the unit at the
  producer's rally point after the roster train time.
- Build requires a selected completed worker. The site is placed at the tile,
  then the nearest worker completes it over the building's build time.
- Reject with 0 for anything unaffordable, unplaceable, gated, or unknown.

## 6. Match scenario

- Same Vesper March map and terrain function as the showcase. The map does not
  change. Player base occupies the west settlement; the opponent occupies the
  eastern causeway approach.
- Standard starts are exactly those in `docs/CIVILIZATIONS.md` §4: three complete
  buildings, ten units, 11/15 population, 80 Alloy, 40 Charge.
- The opponent is deterministic: it gathers, defends, advances on a fixed
  schedule, and raids in bounded waves. No randomness beyond the seeded RNG.
- A match hash gate must be stable: same seed + same faction + same command
  stream gives the same normalized hash across two fresh runs.

## 7. HUD bar

A DOM bottom bar, present in both orientations, follows the safe area, and never
covers the camera buttons.

- Left cluster: **ALLOY**, **CHARGE**, **POP used/cap**.
- Middle: **age name** with a progress bar while advancing, and an **ADVANCE**
  button when the next tier is affordable.
- Right cluster: context actions for the current selection — train buttons for a
  completed building, build buttons for a completed worker. Each shows name and
  cost, is disabled when `sim_can_train`/`sim_can_build` returns 0.
- **Showcase mode** (mode 0) has no commands yet. Its middle cluster shows a
  **SKIRMISH** control with two faction buttons — `DAWNWARD` and `CINDERWAKE` —
  that call `__APP.startMatch(0)` / `__APP.startMatch(1)`. Starting a match is a
  deliberate player action; the app never boots straight into a match, so the
  showcase benchmark and the shipped phone build stay valid.
- **Match mode** (mode 1) shows the faction name, the age cluster, and the action
  clusters. A **RESET** button returns to the showcase.
- Every interactive element is at least **44×44 CSS px**. Text uses the existing
  palette. No new colours.
- The bar is `#hud-bar`. Buttons carry `data-action`, `data-kind`, and an
  accessible name. It must survive rotation without reload.

## 8. Portrait contract (supersedes the rotate notice)

Portrait is **playable**. The rotate notice is removed for playable viewports and
kept only as the no-WebGPU error path.

- The canvas fits the width, keeps 16:9, and sits above the HUD bar.
- The HUD bar is fully visible, and every button stays ≥44×44 CSS px.
- No page scroll in either orientation.
- Landscape and portrait both pass the same interaction gates.

## 9. Gate names the harness must add

| Gate | Proves |
|---|---|
| `hud-bar` | bar visible, ≥44 px tall, inside the viewport and the safe area |
| `hud-resources` | ALLOY/CHARGE/POP text equals `__APP.getState()` |
| `hud-age` | age label equals `sim_age()` and the progress bar is coherent |
| `age-advance` | clicking ADVANCE deducts the cost and raises the age after settle |
| `train-unit` | a train action raises entity count and lowers resources |
| `build-site` | a build action creates a construction site |
| `match-boot` | `startMatch(f)` boots a match with the standard start package |
| `match-determinism` | two fresh match runs of one seed produce one hash |
| `portrait-playable` | portrait: canvas visible, bar visible, buttons ≥44 px, no scroll |
| `ipad-portrait` | 768×1024 dsf 2 passes the same layout gates as landscape |

Existing showcase gates stay green.

## 10. `window.__APP` additions

```ts
startMatch(faction:0|1):void;         // deterministic match start
resetShowcase():void;                 // back to the showcase scenario
command(op:number,a:number,b:number):number;   // -> sim_command
getState():{ ...existing,
  mode:number; player:number; age:number; ageProgress:number;
  popUsed:number; popCap:number; alloy:number; charge:number;
  selectedKind:number|null; actions:number[]; };
```

`sim_charge()` and `sim_alloy()` must keep working in both modes.

## 11. Non-goals for this wave

- Unit movement orders, attack orders, and formation control.
- Fog of war, AI difficulty levels, save games, multiplayer.
- In-world sprite atlases. Concept sheets and HUD icons only (see
  `docs/UNIT_DESIGN.md` §6). An in-world atlas is a later, separately judged piece.
- Any change to the showcase hash, the map, the camera maths, or the 32-colour cap.
