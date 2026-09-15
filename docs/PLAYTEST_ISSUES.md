# Starhold — playtest issues for Astra

Opened 2026-09-15 by the orchestrator while playing the 10 km world build.
One entry per issue: what I saw, how to reproduce, and what is left.
Reproduce with `node scripts/capture.mjs` for the gates and a playtest script in
the same shape as the runs quoted here (start a match, drive the HUD, then
`fastForward` and read `__APP.entityProbe()`).

Status values: **fixed here**, **open**, **needs design**.

---

## Fixed here (kept as a record)

### P1 — every moving unit sank into void in a world match — fixed
`walk()` recomputed an entity's height with the frozen showcase `height()`
function, so in a 10 km world any unit that moved got z = -1 and was drawn under
the map. Evidence: the first playtest reported 12 actors on void at match start
and 16 after 6.5 minutes. Fix: `walk` reads the active map through `ground()`.
After: 0 actors below terrain.

### P2 — raiders marched at an authored island coordinate — fixed
`Order::Raid` fell back to the literal `(12, 18)`, the showcase island's centre,
so in the world every raider walked to the map's far corner and sat there.
Evidence: 20 minutes of match time left the nearest raider 740 tiles from the
player's base. Fix: march at the enemy base from `game.base`.

### P3 — a raid lasted 35 s; the march takes about 7 minutes — fixed
The raid window could not cover the distance between the two starts, so a wave
expired long before contact. Fix: the window is `35 s + distance / speed`.

### P4 — the AI never built anything in a world match — fixed
`ai_build` searched `x 20..30, y 3..26` around `(24, 14)` with 32-tile indexing
— the authored eastern approach. On the world those tiles are far away or void,
so the AI placed no building, trained no combat unit, and never raided.
Evidence: the enemy stayed at its 13 starting entities for 20 minutes; after the
fix it reached 27 entities with 7 raiders and attacked the player's base. Fix:
search around the faction's own base using the active side length.

### P5 — new AI units were posted at island coordinates — fixed
`match_production` assigned homes at `(24.8, 18 + 3n)` and `(25 + …, 19 + …)`, so
replacement units walked to the map corner instead of defending their base.
Fix: homes sit around the AI's own base.

### P6 — `rally` clamped spawn points to the 32-tile island — fixed
New units spawned at `x = 29.7`, the island's east edge, in a 1024-tile world.
Fix: the clamp follows the active map.

### P7 — units crossing a canyon dropped to z = -1 — fixed
Movement is direct (no pathfinding, a stated non-goal), so a unit that crossed
void lost its height and sank. Fix: a unit holds its last ground height while it
is over void.

### P8 — no control could cancel an unfinished order — fixed
MATCH_SPEC §5 and command op 3 refund a cancelled order in full, but no HUD
control ever sent op 3, so a misplaced construction site could only be waited
out. Fix: a selected construction site offers `CANCEL / REFUND` in the action bar
and the status line reads UNDER CONSTRUCTION.

---

### P9 — on a landscape phone the ADVANCE button was unreachable — fixed

Found by the touch playtest, then reproduced and measured here. With a worker
selected, the bar has to hold five meters, the age cluster (which contains
ADVANCE), the map control, the two page chevrons and a page of four build
buttons in 844 px — about 33 px more than the bar has. `#hud-age` had
`min-width: 0`, so the age cluster was squeezed to 144 px while its content
needed 220 px, and the ADVANCE button was drawn *outside* its own cluster, under
RESET. RESET comes later in the DOM, so it won the hit test: `elementFromPoint`
at the centre of ADVANCE returned RESET. A tap meant to advance the age reset
the match instead, so the age could not be advanced on a phone at all.

Fixed in `src/style.css`: a hidden page chevron now releases its space
(`display: none`, not `visibility: hidden`), the age cluster never shrinks
(`flex: 0 0 auto`), action buttons pack to the 44 px touch minimum, and a
narrow-bar tier trims the spacing and the age progress bar below 900 px.

Guarded by the `bar-hit-test` gate: with a worker selected, every visible bar
control's centre must hit that control, and the centre of ADVANCE must resolve to
ADVANCE. It reads `visible controls=9 mis-hits=0 advanceCentre->hud-advance` on
all four touch viewports.

### Touch playtest evidence (phone 844x390 dsf 2, tablet 1024x768 dsf 2)

Touch input is trustworthy end to end: every pointer event the audit captured is
`trusted: true` with `pointerType: touch`, the page never scrolls, and pinch,
short tap, tap-after-pinch, camera drag, minimap drag/close/reopen and
minimap tap-to-centre all pass. Frame rate holds on a phone in the world:
**60.0 fps minimum across all eight samples** (both bases, four zoom levels,
p50 16.7 ms), with no console errors. The AI grows from 13 to 26 entities with 8
raiders away from home, and the closest raider reaches **3.1 tiles** from the
player's base at t = 690 s. Economy for an untouched match: alloy 80 -> 340,
charge 40 -> 160 in 120 s.

Two of that report's failing checks are its own criteria, not defects: "economy
120s" wanted the *player's* entity count to rise (it does not unless the player
taps), and "enemy worker touch selection" expects an enemy worker to be
selectable (enemy entities are not selectable by design). "producer 12 actions"
is A2 below, and "44px targets containment overlap scroll" is P9 above.

### P10 — the page chevron at the last page — checked, not a defect (kept as a record)

Found while answering "how do I see an Ash Jackal in the game", and withdrawn
after checking the code. The chevron does nothing at the last page because
`next.disabled` is set exactly then, `turn()` clamps the page, and
`#hud-bar button:disabled` styles the muted border and text — so the control is
correctly inert *and* visibly inert. The probe that flagged it was the faulty
part: it clicked a disabled button and used the `.off` class as its exit test,
but `.off` is only set when there is a single page, so the loop read the last
page six times and reported six pages.

Two things worth keeping from it:

1. **The Fang Yard sits on page 2 of the Cinderwake build list.** It is buildable,
   but the building that trains the faction's signature raider is one chevron away
   from the default view, with no other hint that a second page exists. That is a
   discoverability question, not a bug.
2. **Read the whole bar before concluding anything about a faction.** The first
   reading took only the visible page and made it look as though Cinderwake could
   not build a Fang Yard at all. The same class of mistake produced the earlier
   action-bar entry (A4) in this file, which was also withdrawn on measurement.

## Open — needs design or deeper work

### A1 — a defeated player is never told the match ended — needs design
When the AI razes the player's base the settlement simply empties: population
reads `0/0`, every action is disabled, and the bar still says FOUNDING. Evidence:
playtest t+12 min, `pop=0/0`, alloy frozen at 568, no message anywhere.
Suggestion: a match state in the sim (`won`, `lost`, `running`) plus one line in
the bar, and a way to restart without a page reload.

### A2 — the Heliowell offers no actions at all — needs design
Selecting a Heliowell (kind 12) shows `NO ACTIONS`: it is only a prerequisite for
the Sunlance and a charge source. A player reads that as a broken selection.
Suggestion: show a status readout instead (`CHARGE SOURCE +1/s`, `ALLOWS
SUNLANCE`), or give it a real production action.

### A3 — BUILD places the building for the player, silently — needs design
`buildNearest` picks the nearest simulation-approved tile, so pressing BUILD
drops a 24-alloy building somewhere the player did not choose, with no preview
and no confirmation. Note the positive: it never fails, and Rust still enforces
footprints, level ground and collisions. Suggestion: a placement mode with a
ghost footprint and a confirm tap.

### A4 — action-bar paging — checked, not a defect (kept as a record)
`PAGE_SIZE` is 4 and a worker's build set is exactly four actions
(Keep 10, Court 11, Well 12, Hearth 15), measured as four visible controls of
63x44 CSS px with nothing behind `◀ ▶`. A building's train set is one to three
actions. So the paging chevrons are never needed for the current rosters; the
`null` my first playtest saw was a timing artifact (it read the bar before the
HUD had rebuilt for the new selection), not a hidden button. Re-check this entry
if a roster ever offers more than four actions for one selection.

### A5 — units walk over canyons — open
Direct movement means units cross void gaps; they now hold their height instead
of sinking, so they read as walking on an invisible bridge. Suggestion: a terrain
cost field and a two-level path (a coarse region graph plus straight steering),
or authored bridges over the planned chasms.

### A6 — raid balance on a 10 km map — needs design
With P2–P4 fixed the AI now reaches the player's base and, if the player does
nothing, levels it in roughly 12 minutes. Verify that this is the intended
pressure: waves start at 150 s and repeat every 90 s, and a wave needs about
7 minutes to cross. Suggestion: either move the starts closer, or scale the wave
clock with the map distance and give the player a warning beat.