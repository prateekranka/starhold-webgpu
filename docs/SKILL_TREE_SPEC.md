# Starhold — skill tree (decision brief)

Status: **draft, awaiting bobby's decision.** No code depends on it yet. Owner of the
decision: bobby; the brief itself is the lead's. Written before code.

## Why this exists

Bobby, 2026-09-15: *"we'll need a skill tree in the game also at some point."*
Starhold has ages and a roster but no progression *choice*: both factions advance
Monument → March → Starhold on rails, and every player who reaches March has exactly
the same options. A tree is how a real-time strategy game lets two players with the
same faction play differently.

Evergrow is the reference for how to do this without guessing: 2,333 nodes, 150
passive constellations, 20 active skills, and — the part that matters — their tree is
*tooled*. A lab renders it, an audit measures it, and a balance pass produced
current, proposed and rebuilt tree JSON with diagrams. We already have the lab
pattern (`src/lab/`, dev-only, drift-checked against the docs) and the audit shape
(`scripts/*probe.mjs` turning a design claim into numbers).

## What the simulation would have to own

The sim is authoritative for everything else, so it must own this too: the unlocked
set, the costs, the prerequisite edges, and every effect the tree claims. The client
draws it and forwards clicks; it never decides what is legal.

A node needs: `id`, `age` (which tier exposes it), `cost` (alloy, charge), `requires`
(the nodes that must be unlocked first), and one `effect` from a small vocabulary.
The vocabulary is the real design work, so keep it mechanical and countable:

- **rate**: +alloy or +charge per minute, flat or a percentage
- **cap**: +population capacity
- **cost**: −% cost for a kind or a class (units, buildings, ages)
- **speed**: +% movement or +% work rate for a class
- **power**: +damage or +health for a class
- **unlock**: make a building or unit buildable that is not, including things the
  roster already has and hides today
- **age**: cheaper or faster tier advance

Every one of those is already a number in the sim, which means every one can be
*measured* and *gated*, and none of them needs new mechanics.

## The three shapes worth choosing between

**A — no tree, keep ages only.** Add one or two age choices (for example a military
or an economic March). *Cost:* days. *Strength:* smallest change, no new UI, no
balance surface. *Weakness:* does not deliver what a tree is for.

**B — a shallow tree: two branches per faction, twelve to eighteen nodes.** Each
faction gets an economic and a military branch, unlocked by age, capped by cost.
*Cost:* a week or so; one new screen; a balance pass. *Strength:* every node is
visible in one view on a phone, so no panning UI, and the choice is real from the
first match. *Weakness:* replay depth is limited — after a few matches the two
branches have both been explored.

**C — a deep tree: sixty to ninety nodes across three ages with constellations.**
*Cost:* weeks, plus a real balance process and a dedicated UI with pan, zoom, search
and filtering. *Strength:* the Evergrow depth, long-term progression. *Weakness:*
the UI is the expensive part on a phone-first product, and a deep tree with a shallow
roster (30 actors) has little to bite on.

**Recommendation: B, built so C is an extension rather than a rewrite.** Ship a
shallow tree with the node vocabulary above. If the data model is right, C is more
nodes and a bigger screen, not different plumbing. A tree that lands is worth more
than a tree that is deep.

## Interface rules (phone-first, consistent with the rest of the product)

- One screen, opened from the bar, paged by age the way the action bar is paged
  today. No pan or zoom in the first version.
- A node shows: name, effect in words, cost, and its prerequisite state. Locked,
  available and unlocked must be three unmistakable states, and the reason a node is
  unavailable must be readable ("needs March", "needs Starforge").
- The action bar keeps its page chevrons; nothing new appears in the bar unless the
  tree needs a single entry point.
- Every control ≥44×44 px; palette 32 entries; the screen must be usable with one
  thumb in landscape.

## Measured acceptance

1. **The sim owns it.** A read-only probe reports the unlocked set, each node's
   availability and its effect on the live numbers. A gate asserts that unlocking a
   node changes exactly the number the node claims and nothing else, for every effect
   kind at least once.
2. **Determinism.** The showcase tuple is untouched; a match with a fixed unlock
   sequence hashes identically twice in one run.
3. **The lab covers it.** `/lab.html` gains the tree: every node with its data, and
   the same drift check that already compares documents against the simulation.
4. **The audit exists before the balance does.** A probe reports, for a sample of
   node paths, the cost in resources and time against the effect gained, so the tree
   can be tuned with numbers rather than by feel.
5. **Playable on a phone.** Frames at 844×390 in landscape show a node page with all
   three states legible; no node's text overflows; fps unchanged.

## What this brief does *not* decide, and needs bobby

- Whether nodes cost resources at all, or are bought with a separate point currency
  earned by playing.
- Whether unlocks are permanent per match, or persist across matches for a faction.
- Whether the tree is shared between factions or unique to each.
- Whether it replaces the current age advance or sits beside it.

Those four answers change the data model, so they come before code.

## Non-goals for the first version

Respec, refunds, saved loadouts, tree sharing, node art beyond palette glyphs,
animated nodes, and multiplayer balance.
