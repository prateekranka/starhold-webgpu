# Starhold — Sol/Astra Dream Loop contract

This contract governs the five-hour autonomous quality loop that starts at
2026-09-19 11:17 IST and stops by 16:17 IST. The rollback point is commit
`0112d16`. Work is isolated on `feat/sol-astra-dream-loop`.

## Goal

Make the current playable match more attractive, readable, alive, and pleasant to
control. Improve the real game, not a disconnected beauty shot. Preserve the visual
identity already approved: isometric pixel art, the 32-colour Starhold palette,
Dawnward and Cinderwake silhouettes, the 10 km world, fixed 960×540 raster, and the
existing camera and command model.

## Non-goals

- Do not redesign the simulation, economy, combat balance, civilizations, map
  generator, or fixed-tick model.
- Do not replace the current roster in one sweep. Sprite migration remains gradual.
- Do not restore the box-only renderer as the shipping path.
- Do not touch the frozen Tailnet release on port 8446 or the green PR preview on
  8448. This loop gets a separate preview.
- Do not deploy to Cloudflare or promote a release.
- Do not weaken, remove, retry-wrap, or rebaseline a gate to make a pass green.
- Do not add new test files or test-only helpers. Use the existing harnesses and
  direct runtime probes.

## Ownership and model split

- **Orchestrator:** GPT-5.6 Sol, xhigh reasoning, standard speed. It owns target
  choice, piece selection, gameplay, builds, tests, screenshots, critics, integration,
  commits, pushes, and the final report.
- **Artistic hand:** fresh GPT-6 Astra sessions, medium reasoning, standard speed,
  Plus-linked `~/.codex-linux` only. Each worker implements one pass and stops. It
  must not test, validate, run a server, commit, push, or invoke Dream Loop itself.
- Every worker gets the current composited screenshot, the locked target screenshot,
  the latest critic finding, the files it may edit, and the invariants below.
- No worker self-report is evidence. Sol reads the diff and validates the live build.

## Locked target

Dream Loop starts from a fresh composited screenshot of the real active match. Astra
medium may generate one improved **in-engine target screenshot** from that baseline.
The target must still look achievable by this product. It must retain the exact
isometric camera, pixel-art raster, 32-colour palette language, match HUD, two-faction
space-civilization setting, and normal gameplay framing. It must not become smooth
concept art, a cinematic crop, a different game, or a UI-free illustration.

Store working context in the ignored `.dream-loop/` directory:

- `baseline.png` — active-match baseline from the loop branch;
- `target.png` — locked target screenshot;
- `current.png` — latest accepted active-match screenshot;
- `play-ledger.jsonl` — observed state, legal action, outcome, and issue decisions;
- `round-N/` — temporary briefs, logs, captures, and critic output.

## TypeSafe-shaped gameplay loop

The official project-local TypeSafe skill is installed. No `TYPESAFE_API_KEY` exists
on this machine, so this loop must not claim that Jev or the TypeSafe API ran. Sol
uses the skill's typed decision structure locally and records the raw observed state
that supports each decision.

For each play segment, gather state through the real UI and read-only `window.__APP`
probes. Keep exact rules and execution in code. Use these bounded judgments:

1. **Choice — next legal action.** Select one action from the controls currently
   visible and enabled: select unit, select building, pan, rotate, zoom, minimap jump,
   enter placement, move placement, confirm, cancel/refund, train, advance age, wait,
   open menu, resume, or reset. A disabled or absent action is not a candidate.
2. **Noul — actionable defect.** Decide whether the action's observed result violates
   visible feedback, reachability, legibility, consistency, or the written contract.
   Record the evidence before changing code.
3. **Score — play quality.** Score each segment on five concrete levels:
   0 broken or blocked; 1 works but is confusing; 2 understandable but flat; 3 clear
   and satisfying; 4 excellent, responsive, and visually rich.
4. **Choice — next issue.** Rank only reproducible findings. Prefer a root cause that
   improves many interactions. If no candidate is reproducible, continue playing.

Run both factions. Exercise mouse and touch layouts. A scripted click is valid only
when hit testing proves it reaches the intended visible control. A state change alone
is not enough.

## Self-bettering round

1. Build and play the current branch. Capture the canonical 960×540 match frame and
   an 844×390 touch frame. Record page errors, gameplay state, and performance.
2. Compare the current frame to `target.png`. Name the single biggest achievable gap.
   Combine that with the highest-priority reproducible play defect, if one exists.
3. Give a fresh Astra medium worker a narrow implementation brief. One file owner per
   pass. Prefer one strong improvement over several partial changes.
4. Sol reads the diff, removes unrelated changes, repairs integration bugs, and runs
   the existing affected checks.
5. Build and exercise the changed path through the real served page. Capture a fresh
   composited frame. Confirm zero unexpected console/page errors.
6. Measure the fixed invariants. Ask a fresh blind critic to compare current against
   target and name one gap. The critic sees images and acceptance facts, not the
   worker's explanation.
7. Accept the pass only if the game remains correct and the visual/play result is
   better. Commit and push each accepted piece. Revert a loss instead of rationalizing
   it. Feed the new frame and critic finding into the next fresh brief.

## Invariants

- `sim/src/lib.rs`, the WASM ABI, fixed 60 Hz step, deterministic hashes, save/state
  meaning, faction rosters, costs, timing, and player commands stay unchanged unless
  a reproducible gameplay defect proves that the simulation is its root cause. Such a
  case must be isolated and verified separately before any simulation edit.
- Same seed produces the same canonical state. Do not rebaseline a changed hash.
- Rendering remains raw WebGPU at a fixed 960×540 physical raster with nearest-
  neighbour presentation and the existing 32-colour palette.
- Renderer instance capacity remains 26,000, with the 24,000 world bake stop.
  Saturation or degradation is a failure.
- Hardware host target remains at least 59 fps and p95 frame time at most 20 ms.
  Record p50, p95, max, renderer, and whether the adapter is software.
- Touch controls remain at least 44×44 CSS px. The four camera controls remain 48×48,
  on-screen, unobstructed, and correctly hit-tested.
- The menu remains free of match-only HUD chrome. Active matches retain the complete
  resource strip, selected-entity plaque, command bar, minimap, and camera controls.
- Use composited screenshots. WebGPU canvas readback is not evidence.
- Do not commit generated WASM, `dist/`, `.dream-loop/`, installed agent skills, logs,
  credentials, or OAuth material.

## Validation cone for every accepted pass

Run the smallest affected existing checks first. Before pushing an accepted piece,
the minimum is:

- `npm run build`;
- the directly affected existing browser gate;
- a real active-match browser exercise with zero page errors;
- canonical desktop and touch composited screenshots;
- deterministic state/hash check if the changed dependency cone can affect state;
- a fresh blind target comparison;
- `git diff --check` and a clean post-commit worktree.

Before the loop ends, run the full existing relevant suite, update `PROGRESS.md`, stop
all Codex workers and private servers, push the branch, and leave a reachable isolated
Tailnet preview if the final build is green.

## Exit conditions

Stop when one of these is true:

- time reaches 16:17 IST;
- the allowed Plus window can no longer serve the named models;
- three accepted visual/play rounds are complete and a fresh critic identifies no
  material achievable gap inside this contract;
- the remaining gaps require a user decision or a forbidden simulation/design change.

At exit, preserve the best green commit. Partial work must not replace it.