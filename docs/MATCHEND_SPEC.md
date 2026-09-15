# Starhold — the match-end model (decision brief for A1)

Status: **draft, awaiting a decision from bobby.** No code depends on this yet.
Owner of the decision: bobby. Written before code, per the spec-first rule.

## Why this exists

Playtest issue A1: a player who loses everything sees a bar that reads `0/0` and
nothing else. No message, no explanation, no way to start again except the RESET
control, which silently returns to the showcase. A commercial RTS always tells
the player that the match ended and how.

## What the sim has today

There is no match-end concept anywhere in the sim. `match_tick()` runs forever,
and no exported function reports a winner:

- `sim_mode()` — 1 during a match, 0 in the showcase
- `sim_player()` — which side the human commands
- per-side economy through `sim_alloy()`, `sim_charge()`, `sim_age()`, `sim_pop_used()`, `sim_pop_cap()`
- the entity array, each entity carrying a `faction` field, so a client *can*
  count the live entities of each side

So an outcome can be derived, but today nothing derives it and nothing owns it.

## The three options

**A — client-side report only.** The web app counts player-side entities each
frame; when the count stays zero for a grace period it shows a modal DEFEAT with
a NEW MATCH button, and the mirror case shows VICTORY. No sim change at all.
*Cost:* about an hour, one new gate. *Strength:* cheapest, no determinism risk,
ships today. *Weakness:* the sim keeps simulating behind the modal, the outcome
is not in sim state so a probe cannot read it, a player cannot resign, and the
freeze tripwire cannot cover it.

**B — sim-authoritative outcome flag (recommended).** Add
`sim_outcome()` returning 0 none / 1 defeat / 2 victory, decided inside
`match_tick()` after a side's live entity count reaches zero and stays there for
a grace window, plus `sim_outcome_tick()` for when it happened. The client only
renders the flag; the modal is option A's UI.
*Cost:* two to three hours, and the showcase tuple must be re-checked because
`match_tick` changes shape. *Strength:* one source of truth, gates can assert on
the sim rather than on pixels, the state can join the determinism tripwire, and
a future surrender control is a one-line command that sets the same flag.
*Weakness:* a sim change is the riskiest kind in this codebase, and it must not
touch showcase determinism.

**C — full match-end model.** B plus a surrender control, a score summary (time,
units trained, units lost, peak population), a rematch flow and a stored record
of recent matches.
*Cost:* a day or more, and it needs design decisions about what is scored and
what is kept. *Strength:* the commercial-grade experience. *Weakness:* the largest
piece on the board, and the least urgent: the player cannot currently be told the
simplest version of the truth.

## Recommendation

Ship **B with A's interface**: the flag in the sim (so the state is true and
testable) and the minimal modal in the client (so the player is told). Defer C
until the rest of the open list is empty.

## Acceptance criteria

1. When the player's last entity dies, within two seconds the player sees a modal
   that names the end and offers NEW MATCH; the modal does not appear at any
   other time.
2. The same in reverse when the opponent is wiped, with different wording.
3. The showcase never shows the modal (assert in the showcase gate).
4. `sim_outcome()` returns the matching value, and a probe can read it.
5. A new match started from the modal is a clean match: entities, economy, age
   and camera all at their start values, and the hash matches the first match.
6. No console errors; frame rate unchanged at every zoom on phone and desktop.
7. Determinism tripwire unchanged: showcase `{"n":55,"alloy":247,"charge":199,
   "hash":"20b89f84"}` and match hash `a7b9e906`.

## Gate sketch (to add to `scripts/capture.mjs`)

`match-end` — start a match, `fastForward` past the grace window with the player
idle so the opponent wipes the base, then assert: the modal is visible, its text
names the end, `sim_outcome()` is 1, and pressing NEW MATCH returns a live match
with the start economy. A second pass asserts the negative: in the showcase, no
modal exists.

## Non-goals

AI surrender behaviour, scoring, replays, persistence, leaderboards, and any
change to camera, controls or the palette.
