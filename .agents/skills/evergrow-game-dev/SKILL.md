---
name: evergrow-game-dev
description: >-
  Game development methodology and architectural guidelines inspired by Dimillian/Evergrow.
  Use when designing game systems, implementing simulation-authoritative mechanics, building
  dev-only labs and tooling, creating skill trees/progression, conducting headless balance audits,
  and executing visual design QA.
---

# Evergrow Game-Dev Methodology

A disciplined, tooling-first architectural framework for game development with AI agents, based on the patterns established in `Dimillian/Evergrow`.

## 1. Simulation-Authoritative Core & Determinism

The simulation is authoritative: the client renders, plays animations, and forwards typed player commands, but **never computes game rules or mutates game state itself**.

- **Fixed-step update loop**: Run simulation at a strict fixed rate (e.g., 60 Hz or 120 Hz) driven by an accumulator.
- **Strict determinism**: A seed plus a command sequence must reproduce the match or run exactly. Assert determinism with state hashes and benchmark tuples on every build.
- **Headless logic**: Simulation logic must compile and run headless without browser APIs (Canvas, WebGPU, DOM) so it can be audited, fast-forwarded, and tested in CLI scripts.
- **Decoupled presentation**: Visuals, audio, effects, camera, and post-processing interpolate from simulation snapshots; they must never feed back into simulation state.

## 2. Headless Owners & Narrow Contexts

Avoid monolithic managers or god objects:
- **Dedicated narrow owners**: Break mechanics into narrow headless owners (e.g., `combat-damage`, `combat-rewards`, `ground-effects`, `encounter-scaling`, `progression`).
- **Context passing**: Pass explicit, typed contexts rather than passing the entire game state.
- **Explicit update ordering**: Preserve strict tick ordering for damage, statuses, production, and cleanup to prevent order-of-operations race conditions.

## 3. Tooling-First Development (Dev Labs & Playgrounds)

Never balance or debug mechanics purely inside live gameplay. Build dev-only inspection tools first:
- **Dev-only entrypoints**: Build standalone HTML reviews (e.g., `lab.html`, `/tools/`, `/bestiary.html`) for inspecting units, buildings, equipment, and skill graphs.
- **Bundle exclusion**: Ensure dev tools are excluded from production builds (`dist/`).
- **Disposable in-memory state**: Tool studies and playgrounds must use isolated, disposable in-memory state. Never connect dev tools to playable saves.
- **Headless audit scripts**: Build CLI probe scripts (`scripts/*probe.mjs`) to turn gameplay claims and numbers into measurable statistics (e.g. route continuity, map composition, power curves).

## 4. Visual Truth & Design QA

Follow the Evergrow Design QA protocol when verifying art, UI, and rendering:
- **Paired visual evidence**: Compare the target design/concept against the live implementation side by side at native display density.
- **Contrast & palette enforcement**: Strictly adhere to the project palette (e.g. 32-color quantization) and contrast standards.
- **Fidelity checklist**:
  - *Typography*: Strict font hierarchy and glyph metrics; no blurry scaling.
  - *Spacing & touch targets*: Guaranteed minimum sizes (e.g. 44×44 px touch targets) and layout containment across all viewport sizes (desktop, tablet, landscape phone, portrait).
  - *Geometry & silhouettes*: Recognizable 3D silhouettes, distinct team colors, clear ground planes and shadows.
- **Objective gate tests**: Automated browser gates for canvas fit, framerate/p95 frame times, palette bounds, camera movement, and HUD hit tests.

## 5. Progression & Skill Trees

When designing progression trees (such as `docs/SKILL_TREE_SPEC.md`):
- **Immutable graph data**: Nodes, requirements, and connections defined in declarative, immutable data structures.
- **Countable mechanics vocabulary**: Keep effects strictly mechanical (flat/percentage rates, caps, cost reductions, speed, power).
- **Route & cost previews**: Provide pure shortest-route previews and remaining-cost calculations without mutating player state.
- **Balance audits before feel**: Run simulated allocation paths through automated scripts to measure resource cost vs. power gain before manual tuning.

## 6. References

For detailed reference material and case studies from Evergrow:
- [Design QA & Visual Verification Protocol](./references/design-qa.md)
- [Local Development Tools & Playgrounds](./references/development-tools.md)
- [Skill Progression & Tree Architecture](./references/skill-progression.md)
- [Skill Tree Balance Audit Methodology](./references/skill-tree-balance.md)
