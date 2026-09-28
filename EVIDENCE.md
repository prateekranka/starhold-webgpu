# Starhold — Dream Loop evidence

Before and after frames from the accelerated visual pass on branch
`feat/sol-astra-dream-loop`. Every image is a full match frame captured from the
running build at 1280x800 through a real browser, not a render target.

| Image | State | Blind verdict |
| --- | --- | --- |
| `evidence/01-baseline.png` | Before the pass | — |
| `evidence/02-terrain-pass.png` | Settlement terrain hierarchy, service activity, action feedback | PASS — "Distinct paving, quieter surrounding terrain, and restrained settlement props establish a clear visual hierarchy without clutter." |
| `evidence/03-unit-separation.png` | Units separated from ore, shadow and paving | FAIL on facing, kept for value separation |
| `evidence/04-ownership-and-selection.png` | Selection brackets and per-side ownership badges | PASS — selection connects to the plaque; ownership reads consistently on both sides |
| `evidence/05-ground-material.png` | Open-ground material variation, accepted pass | FAIL on terrain structure, kept: "no noise, no repetition, no gameplay confusion" |
| `evidence/06-two-faction-encounter.png` | Two-faction encounter fixture | PASS on selection and ownership markers |

Remaining known gaps, in the order the critics ranked them:

1. Open ground lacks readable terrain structure — obstacles and expansion routes.
   This is a map-side question, not a shading question. See `PROGRESS.md` on the
   work branch.
2. Ownership badges on very small units read less immediately than the selection
   brackets.
3. Worker facing is unresolved at roughly 15 px and needs authored directional
   sprite atlases.

Captured on 2026-09-28. Work branch: `feat/sol-astra-dream-loop`.
