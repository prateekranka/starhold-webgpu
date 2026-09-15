# Brief W2-ART — concept sheets from the Plus image tool

You are producing design reference art with the image generation tool. Do not
edit code. Do not run git.

## Read first

- `docs/UNIT_DESIGN.md` — §2 Dawnward, §3 Cinderwake, §6 the sheet contract.
- `docs/CIVILIZATIONS.md` §5–§8 — the exact roster names.

## Deliverable (three PNG files, saved to disk)

1. `art/concept/dawnward-roster.png` — one sheet: the 8 Dawnward buildings
   (Charter Keep, Freight Court, Heliowell, Hearth Pods, Muster Hall, Starforge,
   Prism Bastion, Sky Wharf) and the 7 Dawnward units (Riveter, Pack Beetle, Ward
   Sentinel, Sunlance, Harbor Skiff, Prism Cantor, Star Ram).
2. `art/concept/cinderwake-roster.png` — one sheet: the 8 Cinderwake buildings
   (Pyre Ark, Scrap Maw, Ember Siphon, Soot Nests, Fang Yard, Chainworks, Hook
   Spire, Rift Mooring) and the 7 Cinderwake units (Ashhand, Chain Mule,
   Hookguard, Ash Jackal, Sootwing, Brandcaller, Cinder Strider).
3. `art/concept/steppe-centaur-ashjackal.png` — the Ash Jackal alone, four views
   (front, three-quarter, side, back), showing a four-legged jointed chassis fused
   to an archer torso with a drawn energy bow.

## Style rules (all three sheets)

- Isometric pixel art, chunky readable pixels, hard edges, no anti-aliasing, no
  gradients, no drop shadows.
- Dawnward palette: teal roofs, ivory plate, gold trim, cyan energy, amethyst
  ground. Cinderwake palette: wine plate, vermilion cloth, orange heat, black
  hooks, pale stolen trim.
- Recovered-machinery frontier: medieval civic shapes repaired with space
  machinery. No modern Earth vehicles, no smooth neon, no fantasy horses or
  literal swords.
- Plain mid-violet background (#624779) so the sheet reads as a design board.
- Each subject must be separated and fully visible. Readable at 96 px.

## Method

Use the image generation tool. If a sheet comes back with overlapping or clipped
subjects, regenerate it once with a clearer layout instruction. Save final files
with `magick` if you need to convert or resize. Never overwrite a good file with a
worse one.

## Report

Final message: the three absolute paths, their pixel sizes, and one sentence on
what each sheet shows.
