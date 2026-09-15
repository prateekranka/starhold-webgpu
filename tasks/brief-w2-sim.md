# Brief W2-SIM — match mode, ages, and commands in the Rust simulation

You are implementing the biggest piece of wave 2. Work only in `sim/src/lib.rs`.

## Read first

- `docs/MATCH_SPEC.md` — binding ABI, ages, commands, match scenario. Implement §2–§6 exactly.
- `docs/CIVILIZATIONS.md` §4–§8 — rosters, tiers, costs, train/build times, HP, speed.
- `sim/src/lib.rs` — the current showcase simulation.

## Deliverable

Add to `sim/src/lib.rs`, without changing any showcase behaviour:

1. `sim_match_init(seed:u32, faction:u32)` — standard skirmish start per
   `docs/CIVILIZATIONS.md` §4 for the player faction, and the equivalent package
   for the opponent faction. Player base in the west settlement area of the map,
   opponent on the eastern causeway approach. Same `height()` terrain function.
2. `sim_mode()`, `sim_player()`, `sim_age()`, `sim_age_progress()`,
   `sim_age_cost()`, `sim_age_cost_charge()`, `sim_pop_used()`, `sim_pop_cap()`.
3. `sim_command(op,a,b)` with the four verbs in §5, full validation, and 1/0 return.
4. `sim_roster_count()` + `sim_roster_ptr()` — the stride-8 roster table in §3,
   built from the tables in `docs/CIVILIZATIONS.md` §5–§8 (both factions, 15 rows each:
   8 buildings + 7 units).
5. `sim_can_train(kind)` and `sim_can_build(kind)` for the current selection.
6. Ages: costs, durations, gating, `sim_age_progress()`.
7. A deterministic opponent: gathers, defends, advances on a fixed schedule, and
   raids in bounded waves. No unseeded randomness.

Population: headquarters 15 capacity, plus 5 per completed housing building
(Hearth Pods kind 15 / Soot Nests kind 65).

## Hard rules

- `sim_init(seed)` and the showcase tick body must stay byte-identical: the
  showcase determinism hash `20b89f84` at t=108 s must not change. Put match mode
  behind a `mode` field and a separate branch.
- Snapshot stride stays 12. Do not change the meaning of snapshot indices 0–11.
- Use explicit kind registries. No numeric-range type checks such as `kind < 20`.
- All state must be deterministic: fixed-point or f32 comparisons that are
  reproducible tick to tick. No floats from `std::time`, no hash maps with random
  iteration order.
- Keep everything inside `sim/src/lib.rs`. Do not touch `src/`, `scripts/`, docs,
  or git. Do not run `npm`, `node`, or `git`.

## Self-check before you report

- `cd sim && cargo build --target wasm32-unknown-unknown --release` succeeds with
  no new warnings you introduced.
- `cd sim && cargo check` clean.
- Re-read your diff and confirm the showcase path is untouched.

## Report

Final message: files changed, the exact new exported functions, how the opponent
schedule works, and anything you deliberately left out.
