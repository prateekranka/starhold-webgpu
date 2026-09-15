# Starhold — expansive world and floating minimap

Binding for this piece. Written before any code. Numbers are decisions, not
suggestions: the sim, the renderer, the HUD, and the harness all read this file.

## 1. Goal

A world map of **10 km x 10 km** that the player can pan across at 60 fps, plus a
**floating minimap** the player can move and close.

## 2. World scale (decided)

| Quantity | Value | Why |
|---|---|---|
| Metres per tile | 10 m | keeps the authored art sizes sane: units 0.6 tile = 6 m, keeps 4 tiles = 40 m |
| Tiles per side | 1024 | 10.24 km, and a power of two keeps indexing cheap |
| World size | 1024 x 1024 tiles = **10.24 km x 10.24 km** | the requested order of magnitude |
| Terrain heights | void -1, and land 0 / 0.5 / 1 | the existing art pipeline only knows these values |
| Unit speeds | unchanged (tiles/s) | a crossing at 1.4 tiles/s takes 12 min, which reads as an RTS |

The world is **generated**, deterministic from `seed`, from integer-hashed value
noise (`fbm`, 5 octaves, no transcendentals) terraced onto the three land levels.
No authored tile data is added to the repository.

## 3. Contracts that must not move

- `sim_init(seed)` and the showcase scenario stay byte-identical. The frozen
  pass-15 release and its hash tripwire keep their meaning.
- The 32-colour cap, 1 px edges, no AA or bloom.
- Canvas backing store 960x540; nearest-neighbour upscale only.
- `sim_entity_ptr` / `sim_entity_stride` / `sim_select` keep their signatures.
- The world is reached from the HUD SKIRMISH entry, not by changing boot. Boot
  stays the showcase until a separate, verified step flips it.

## 4. Simulation ABI (additive only)

```c
u32  sim_world_size();            // 1024 while a world match is live, else 0
const f32* sim_world_ptr();       // terrain[1024*1024], row-major, 0 when no world
```

- `sim_match_init(seed, faction)` now builds the world terrain, then places both
  starts on land far apart (target separation >= 600 tiles) with the existing
  start package (3 buildings, 10 units, 80 alloy, 40 charge, 11/15 pop).
- Neutral ore shard clusters are scattered across the whole world from the same
  deterministic hash stream, not only near the bases.
- Spawn sites must be flat: an 8x8 tile footprint of equal height, on land,
  inside the world bounds, reached by spiral search from the target coordinate.

## 5. Renderer

The static world is **baked per camera window**, not once at init.

| Tier | Distance from camera centre | Contents | Cost (instances/tile) |
|---|---|---|---|
| A | <= 22 tiles | full authored detail: column, cap, rims, ribs, props | ~8 |
| B | 23..40 tiles | column, cap, one rim | ~3 |
| C | beyond 40 tiles | flat cap only | 1 |

- Bake order is nearest-first, so a budget stop can only shorten the far edge.
- Hard budget: the static bake never pushes the total past 15000 of 16000, and
  `frameStats.degraded` reports true when the budget stopped the bake early.
- Re-bake only when the camera window changes: pan crosses a 4-tile step, or the
  zoom index changes, or the map changes.
- Camera gains a **pan** offset in tiles, clamped so the view stays inside the
  world. Showcase pan stays (0,0) and the projection maths is unchanged for it.
- Zoom keeps four steps (4/3, 1, 4/5, 2/3). The far steps now show more world
  through the lower tiers, not a smaller island.

## 6. Floating minimap (DOM)

A panel above the world with its own 2D canvas, drawn from the palette.

- Backing store 256x256; CSS size 168 px desktop, 120 px on touch layouts.
- Contents: terrain classified from the heightfield (void / low / mid / high),
  both factions as 2 px dots, neutral resources as 1 px dots, and the live camera
  window as a 1 px rectangle.
- **Move:** drag anywhere on the panel with mouse or one finger. Position is kept
  in memory and clamped to the viewport; it must survive a match reset.
- **Close:** a 24 px close control hides the panel. A `MINIMAP` control in the HUD
  bar reopens it at the last position. Closing must never leave the player
  without a way back.
- **Jump:** a tap that is not a drag centres the camera on the tapped tile.
- Touch targets stay >= 44x44 CSS px for the bar control; the panel's own close
  control is 24 px but is not the only way to close or reopen.
- Colours come from the 32-colour palette only.

## 7. Harness gates (new)

| Gate | Assertion |
|---|---|
| `world-scale` | `getState().worldTiles === 1024` and `worldMeters >= 10000` in a world match |
| `world-terrain` | `sim_world_ptr()` yields land and void tiles, heights only in {-1,0,0.5,1} |
| `camera-pan` | a real drag changes `camera.x/y`, the bake rebakes, and the camera stays in bounds |
| `lod-budget` | `saturated === false` and `degraded === false` at every zoom index |
| `minimap-present` | panel visible, canvas 256x256 backing, drawn pixels > 0 |
| `minimap-move` | a real drag moves the panel by the drag delta (>= 20 px) |
| `minimap-close` | the close control hides the panel |
| `minimap-reopen` | the bar control restores it, at the last position |
| `minimap-jump` | a tap on the panel moves the camera to that tile |

All existing gates keep passing on every viewport: desktop 960x540, phone
844x390 dsf 2, tablet 1024x768 dsf 2, portrait 390x844 -> 844x390 dsf 2, iPad
768x1024 dsf 2.

## 8. Non-goals

- Pathfinding, formation movement, fog of war, AI difficulty.
- Sprite atlases; art stays procedural.
- Multiple worlds, save games, procedural *scenarios*.
- Any change to the showcase scenario, its hash, or the frozen pass-15 release.
