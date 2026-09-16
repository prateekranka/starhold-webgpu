# Ash Jackal — design and scale contract

Status: **binding** for the `feat/ash-jackal-design` branch. This supersedes the
Ash Jackal sections of `docs/UNIT_DESIGN.md` where they disagree. Bobby's
direction (2026-09-16): *"i wanted the ash jackal unit to look like the attached
image and nothing like what it currently looks like"*, and the unit scale is
**2×** the size it shipped in PR #1.

Reference art: `workshop-evidence/jackal-ref/reference-sheet.png` (the attached
sheet) and `workshop-evidence/jackal-ref/ref-2x.png` (background keyed,
palette-locked to the 32 colours).

## 1. Why the unit changes size

Measured, not assumed. The unit as it renders today in the 960×540 frame:

| Build | Height on screen | Independent read |
|---|---|---|
| PR #1 Ash Jackal | **15×17 px** | "a crab, a beetle, or a blob" — no bow, no torso, no horse readable |
| Reference design @ 24 px | 24 px | borderline; bow is a hint |
| Reference design @ 32 px | 32 px | recognisably a centaur archer |
| Reference design @ 48 px | 48 px | every element legible |

The reference design cannot exist at 17 px. Bobby approved **2×**, i.e. the Jackal
draws at roughly **30–34 px tall** at zoom 1. Only the Ash Jackal changes for now;
the rest of the roster keeps its current scale until this is judged.

## 2. The character (every element is required)

Lower body, a horse:
- deep navy coat; lighter blue sock bands above dark hooves; dark brown tail.

Upper body, a humanoid woman fused at the waist:
- tan/brown skin, bare midriff, brown leather harness across the chest,
  thin waist strap, pale-blue star pendant at the front of the harness.

Head:
- dark hair behind the shoulders, navy bandana/head wrap, pointed elf-like ears,
  two teal-green feathers fanning back.

Gear and accents:
- a brown recurve **bow** held forward, with small white four-point star sparkles
  and pale-blue accents;
- a glowing blue rune mark plus a bright star sparkle on the horse's hindquarter.

## 3. Palette mapping (32 colours, no new colour)

| Material | Palette entry | Hex |
|---|---|---|
| horse coat, head wrap, hair | deep navy | `#1B1E30`, `#2B2D46` highlight |
| horse mid tone, leg shading | | `#41435E`, `#565B73` |
| socks, hooves | pale blue / ink | `#347DA0`, `#214B78` |
| leather harness, bow, tail | brown | `#6C492C`, `#AA7135` |
| belt/harness highlight, skin | tan / light tan | `#D5A64B`, `#F5B66B` |
| skin shading | warm dark | `#813447` (sparingly) |
| rune, pendant, bow accents | cyan / pale cyan | `#58BED4`, `#A4E8E0` |
| star sparkles, bow sparkle | off-white | `#F3F0D7` |
| feathers | teal green | `#298B8B`, `#4FB7AA` |
| hoof/underside ink | ink | `#10121C` (never as a fill on solids) |

Index 0 stays the void colour; no solid geometry may dissolve into it.

## 4. Silhouette rules at 30–34 px

1. The horse mass is the base: it must read as a four-legged body, with the
   front and rear leg pairs separated, never as one lump.
2. The humanoid torso rises from the horse's shoulders as a distinct vertical
   mass; head, ears and feathers sit above it.
3. The bow is the unit's signature: a visible arc forward of the torso, never
   merged into the body mass.
4. At least four leg ends must be distinguishable in the side views (E, W).
5. Front and back views (N, S) may be narrower but must keep the horse/torso
   split and the bow.

## 5. Motion (driven by the simulation, deterministic)

- **Idle**: slow breathing in the torso plus a small hoof shift. No drift of the
  unit's world position.
- **Walk**: four-beat gait; diagonal pairs offset; the horse body pitches
  slightly. Gait phase comes from the sim's `tick`, never wall clock.
- **Attack**: draw → hold → release → recover, driven by the sim's `phase`
  (0→1). The release must coincide with the sim's RELEASE event; the rig must
  not draw a decorative second arrow — the simulation projectile is the only shot.
- **Wreck**: a fallen body silhouette, clearly not an upright unit.

## 6. Integration constraints (must not break)

- The projectile spawn point is authoritative in Rust. If the visual bow socket
  moves with the new scale, the sim's socket constant moves with it, and the
  existing test *"authoritative arrow origin matches both rendered rigs in every
  facing"* must keep passing.
- `sim/` gameplay behaviour, the showcase hash `20b89f84`, and the match hash
  must not change except where the socket itself changes.
- Instance capacity stays 16,000 and saturation stays fatal.
- The workshop Forge stays the judging surface: 8 facings, 4 camera yaws, and the
  `Native raster · 1x` crop is the honesty panel.

## 7. Definition of done

1. The Forge shows an 8-facing turn-around of the new design with no broken
   facing, at 1:1 and magnified.
2. An independent vision read at 1:1 answers "centaur archer with a bow" without
   prompting, and does **not** answer "crab/bug/blob".
3. Idle, walk, attack and wreck are distinguishable in a contact sheet.
4. Palette: exactly 32 colours, zero outside the palette, in every viewport.
5. The full gate suite stays green at desktop, phone landscape, phone portrait,
   iPad landscape and iPad portrait; fps floor and p95 budget hold.
6. Evidence committed: turn-around sheet, four-yaw captures, in-match frame.
