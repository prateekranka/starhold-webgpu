# Brief — Astra coding pass 17: selective key-light lift

You are the coding worker for one corrective Starhold lighting pass. Use GPT-6
Astra Medium in standard mode. Implement only. Do not run the game, a server,
Playwright, screenshots, metrics, or a critic. The orchestrator owns validation.
Stop after your commit.

## Read first

1. `docs/DIRECTIVE.md`
2. `docs/INTERFACE.md`
3. `docs/WORLD_PLAN.md`
4. `docs/CIVILIZATIONS.md`
5. `docs/LIGHTING_CONTRAST_SPEC.md`, including rejected pass 16
6. `tasks/brief-pass16.md`
7. `evidence-p15/shot-main.png`
8. `evidence-p16/shot-main.png`, `metrics.txt`, and `critic.md`
9. `.dream-loop/target.png`
10. `src/renderer.ts`

## Current state

Pass 16 commit `4f7b483` is the current source. It is functionally safe: build,
8/8 runtime gates, 60.3 fps, p95 17.3 ms, exact deterministic hash, palette,
texture, cliff, and saturation all pass. Its world-space face table and cast
direction are useful and must remain.

It is visually rejected:

- pass 16 changed only 2.0255% of pixels from pass 15;
- 71.648% of changed pixels became darker;
- non-void mean fell from 81.577 to 80.981;
- midtone share fell from 30.796% to 30.148%;
- bright share rose only from 4.066% to 4.190%;
- DeepSeek verdict: FAIL; pass 15 is better; forms still merge into terrain.

The live phone route is frozen on verified pass 15. Your build cannot deploy it.

## This pass — one narrow correction

Edit only `src/renderer.ts`. Keep pass 16's world-fixed face IDs and shadow cast.
Do not make any intentional pixel darker than pass 16. Do not touch terrain
materials or cliff bands.

### 1. Give normal structural stone a material floor

The current general shader lets broad stone structures shade down through ink.
For normal solid world geometry only (`screen == 0`) whose authored pigment is in
the structural stone/ivory family 4–9, clamp the shaded result to at least
palette index 4. Explicit recess, door, outline, and contact pigments 0–3 must
stay dark. Terrain (`screen == -5`), ground marks/cast shadows (`-3`), shards
(`-2`), emissive pixels (`-4`), and HUD must not use this floor.

This is the main correction. It must turn broad structure faces that currently
land at indices 1–3 into readable stone, while authored dark recesses remain.

### 2. Add one bounded key-face lift

For normal world geometry, raise only top faces and the west/north-west key face
by one step inside their existing family. Apply it before the final family cap.
Do not lift south/east shadow faces.

Caps for broad faces:

- stone/ivory: index 8; index 9 remains a small glint;
- teal: index 13; index 14 remains a small highlight;
- energy: index 17; index 18 remains an emissive core;
- gold: index 21; index 22 remains a small hot accent;
- Reaver: index 26; index 27 remains a weapon core;
- violet: do not key-lift normal ground or broad terrain.

Existing small authored emissive and actor highlights can retain family endpoints.
No RGB multiplication or interpolation.

### 3. Undo pass 16's Hearth darkening

Restore the three Hearth Pods' wall and roof pigments to their pass-15 values.
Pass 16 lowered broad Hearth values from 8/7 to 7/6. The buildings became less
readable and the change contradicted the measured need. Keep their existing
geometry and details.

### 4. Keep actor and selection gains

Keep pass 16's small ivory Riveter/Sentinel/Sunlance shoulder or helmet lifts and
the bright segmented gold selection ring. If the new structural floor touches
actors, preserve complete ink contours and explicit pigment 0–3 recesses. Do
not resize or move actors.

## Measured target

The canonical screenshot must move materially upward from pass 16:

- coverage stays 40–46%;
- non-void mean reaches 86–94;
- non-void sd reaches at least 44;
- luminance >=90 reaches at least 38%;
- luminance >=170 stays 5.0–8.5%;
- outside-palette pixels stay 0;
- texture and cliff gates stay passing.

Do not game these thresholds by changing camera, map coverage, terrain palette,
HUD area, particle count, or geometry. The visual critic must see clearer civic
hierarchy and units, not a global wash.

## Untouched scope

- No map, roads, terrain, cliffs, props, box dimensions, entity placement,
  camera, zoom, HUD, controls, mobile layout, simulation, balance, faction IDs,
  civilization implementation, or dependencies.
- Do not edit `sim/`, `src/main.ts`, `src/kinds.ts`, HTML, CSS, docs, tasks,
  scripts, evidence, WASM, or package files.
- Do not add files, draw passes, textures, gradients, alpha light, bloom,
  antialiasing, random input, or per-frame allocations.
- Preserve `MAX=16000`, saturation reporting, contour ownership, picking,
  `hudButtons`, and `buttonGlyphPixels()`.

## Allowed worker checks

You may run only:

- `npx tsc --noEmit`
- `npm run build`

Do not perform final validation.

## Commit

Commit only `src/renderer.ts`:

`git add src/renderer.ts && git commit -m "art: pass 17 — lift structural key light"`

End with changed file, exact clamping/lift changes, compile result, remaining
risk, and commit ID. Stop.
