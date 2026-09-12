# Brief — Astra coding pass 9: countable combat actors (Plus quota final pass)

You are a coding agent. Implement one narrow renderer fix. Do not test, run a server,
capture screenshots, or judge. The orchestrator does that. Stop immediately after commit.

Read: `docs/DIRECTIVE.md`, `docs/WORLD_PLAN.md`, `evidence-p8/shot-main.png`,
and `src/renderer.ts`.

Verified pass 8: 7/7 gates, 60.3 fps, p95 17.1 ms, exact deterministic replay
hash. Fresh critic still says:

> Units are too small and blob-like when clustered—no readable silhouette,
> facing, or per-unit separation against each other or teal/white buildings.
> Upsize combat units ~1.5–2× with a 1px dark outline, a distinct head/front tip,
> and 2–3px minimum spacing so each unit stays countable in a tight group.

Implement exactly this. Do not change buildings, terrain, HUD, sim logic, unit count,
camera, effects, or enemy/friendly palette ownership.

- Enlarge gameplay combat-unit silhouettes by another 35–45% from pass 8.
  Keep workers unchanged. Keep bodies under 18 px high at 480×270.
- Give every combat unit one unmistakable facing cue: a dark-separated head and a
  bright 2–3 px nose/weapon tip on its forward side.
- Ensure 2–3 internal pixels of dark visual separation between nearby actors.
  Use a small deterministic renderer-only world offset per stable entity ID where
  needed (fixed table or stable modulo, max 0.35 world tile). Do not use random.
  Picking may remain on sim centers; the visual offset is small.
- Put one continuous `#10121C` backing silhouette behind the entire actor. Do not
  outline only separate body parts. Then draw saturated faction fill inside it.
- Friendly bodies must not become all-mint blobs: use large light-teal/ivory fields
  but split them with `#163D48` recess bands. Hostiles keep red/orange fields split
  by wine recesses. Each actor must remain countable when overlapping.
- Preserve role silhouettes, attack poses, depth sort, selection rings, tracers,
  projectiles, and palette quantization.

Hard rules: renderer-only; exact 32-color palette; raw WebGPU; no antialiasing,
opacity, gradients, bloom, `Math.random`, dependencies, or per-frame heap churn.
≤64 draw calls, ≤100k triangles. Do not edit docs/tasks/scripts/evidence/Rust.
Run only `npx tsc --noEmit`.

Commit:
`git add -A && git commit -m "art: pass 9 — countable spaced combat actors"`

End with files changed, exact scale/offset/outline change, remaining weakness, and
assumptions. Stop after implementation.
