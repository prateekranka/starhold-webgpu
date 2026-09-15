#!/usr/bin/env node
// Objective composition measures for the world terrain, per
// docs/TERRAIN_COMPOSITION_SPEC.md. No browser, no renderer: it reads the world
// buffer the simulation generates and reports the numbers the spec sets floors on.
//
// Usage: node scripts/world-composition-probe.mjs [public/sim.wasm] [seed] [faction]
import { readFile } from 'node:fs/promises';

const wasmPath = process.argv[2] || 'public/sim.wasm';
const seed = Number(process.argv[3] || 73129) >>> 0;
const faction = Number(process.argv[4] || 0) >>> 0;

const bytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {});
const e = instance.exports;

const t0 = Date.now();
e.sim_match_init(seed, faction);
const genMs = Date.now() - t0;

const side = e.sim_world_size();
const metres = e.sim_metres_per_tile();
const world = new Float32Array(e.memory.buffer, e.sim_world_ptr(), side * side);
const at = (x, y) => (x < 0 || y < 0 || x >= side || y >= side ? -2 : world[y * side + x]);

// ---------------------------------------------------------------- level census
const census = new Map();
for (let i = 0; i < world.length; i += 1) census.set(world[i], (census.get(world[i]) || 0) + 1);
const rows = [...census.entries()].sort((a, b) => b[1] - a[1]);
console.log(`world: ${side}x${side} tiles, ${(side * metres / 1000).toFixed(2)} km a side, generated in ${genMs} ms`);
console.log(`levels: ${rows.map(([h, n]) => `${h}->${(100 * n / world.length).toFixed(1)}%`).join('  ')}`);

// ------------------------------------------------------------- clearing extent
// The largest connected run of land at one height that contains the base. The
// spec wants a quiet clearing at least 60 tiles across on its short axis.
function clearing(bx, by) {
  const cx = Math.floor(bx), cy = Math.floor(by);
  const level = at(cx, cy);
  if (level === -1 || level === -2) return { level, area: 0, w: 0, h: 0, note: 'base is not on land' };
  const seen = new Uint8Array(side * side);
  const queue = [cy * side + cx];
  seen[cy * side + cx] = 1;
  let area = 0, minX = cx, maxX = cx, minY = cy, maxY = cy;
  // A clearing is flat: same level, no void, and the walk must not step onto a
  // tile whose level differs. Anything else is a terrace edge.
  while (queue.length) {
    const i = queue.pop();
    const x = i % side, y = (i - x) / side;
    area += 1;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    const neighbours = [i - 1, i + 1, i - side, i + side];
    const nx = [x - 1, x + 1, x, x];
    const ny = [y, y, y - 1, y + 1];
    for (let k = 0; k < 4; k += 1) {
      if (nx[k] < 0 || ny[k] < 0 || nx[k] >= side || ny[k] >= side) continue;
      const j = neighbours[k];
      if (seen[j]) continue;
      if (world[j] !== level) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return { level, area, w: maxX - minX + 1, h: maxY - minY + 1, minX, maxX, minY, maxY };
}

const bases = [0, 1].map((f) => ({ f, x: e.sim_base_x(f), y: e.sim_base_y(f) }));
for (const b of bases) {
  const c = clearing(b.x, b.y);
  const short = Math.min(c.w || 0, c.h || 0);
  console.log(`base ${b.f} at (${b.x},${b.y}) level=${c.level} clearing area=${c.area} tiles ${c.w}x${c.h} short axis=${short} ${short >= 60 ? 'OK' : 'TOO SMALL (spec floor 60)'}`);
}

// ------------------------------------------------------ routes: land-only path
// A route must be traceable from the clearing to the map centre without void.
function landPath(fromX, fromY, toX, toY) {
  const start = Math.floor(fromY) * side + Math.floor(fromX);
  const goal = Math.floor(toY) * side + Math.floor(toX);
  const seen = new Int32Array(side * side).fill(-1);
  const queue = [start];
  seen[start] = start;
  let head = 0;
  let steps = 0;
  while (head < queue.length) {
    const i = queue[head];
    head += 1;
    steps += 1;
    if (i === goal) {
      let length = 0;
      for (let j = i; j !== start; j = seen[j]) length += 1;
      return { reachable: true, length, visited: steps };
    }
    const x = i % side, y = (i - x) / side;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
      const j = ny * side + nx;
      if (seen[j] !== -1 || world[j] < 0) continue;
      seen[j] = i;
      queue.push(j);
    }
  }
  return { reachable: false, visited: steps };
}
const mid = Math.floor(side / 2);
for (const b of bases) {
  const p = landPath(b.x + 0.5, b.y + 0.5, mid, mid);
  console.log(`base ${b.f} -> centre: land-only route ${p.reachable ? `yes, ${p.length} tiles (${(p.length * metres / 1000).toFixed(2)} km)` : 'NO'} (visited ${p.visited})`);
}

// ------------------------------------------------------------- ridge structure
// A ridge reads as a lit face and a shadowed face: at least two height steps
// along one flank. Count step faces and how many 100x100 regions hold two or more.
let stepFaces = 0;
const regionSteps = new Map();
for (let y = 1; y < side - 1; y += 1) {
  for (let x = 1; x < side - 1; x += 1) {
    const h = world[y * side + x];
    let steps = 0;
    if (h >= 0) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const n = world[(y + dy) * side + (x + dx)];
        if (n >= 0 && Math.abs(n - h) >= 0.5) steps += 1;
      }
    }
    if (steps) {
      stepFaces += steps;
      const key = `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
      regionSteps.set(key, (regionSteps.get(key) || 0) + steps);
    }
  }
}
const regions = [...regionSteps.values()];
const withTwo = regions.filter((n) => n >= 2).length;
console.log(`ridge step faces: ${stepFaces}  regions with any step: ${regions.length}  with 2+ faces: ${withTwo}`);

// --------------------------------------------------------------- ore clustering
const n = e.sim_entity_count();
const stride = e.sim_entity_stride();
const ents = new Float32Array(e.memory.buffer, e.sim_entity_ptr(), n * stride);
const ore = [];
for (let i = 0; i < n; i += 1) {
  if (ents[i * stride + 4] === 40) ore.push({ x: ents[i * stride], y: ents[i * stride + 1] });
}
// Single-link clustering at 30 tiles: a group is ore that sits together.
const groups = [];
const taken = new Array(ore.length).fill(false);
for (let i = 0; i < ore.length; i += 1) {
  if (taken[i]) continue;
  const stack = [i];
  taken[i] = true;
  const members = [];
  while (stack.length) {
    const a = stack.pop();
    members.push(ore[a]);
    for (let b = 0; b < ore.length; b += 1) {
      if (taken[b]) continue;
      if (Math.hypot(ore[a].x - ore[b].x, ore[a].y - ore[b].y) <= 30) { taken[b] = true; stack.push(b); }
    }
  }
  const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
  const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
  groups.push({ size: members.length, cx, cy, spread: Math.max(...members.map((m) => Math.hypot(m.x - cx, m.y - cy))) });
}
groups.sort((a, b) => b.size - a.size);
console.log(`ore tiles: ${ore.length}  groups (single-link at 30 tiles): ${groups.length}  sizes: ${groups.map((g) => g.size).join(',')}`);
for (const b of bases) {
  const near = groups.filter((g) => Math.hypot(g.cx - b.x, g.cy - b.y) <= 120);
  const usable = near.filter((g) => g.size >= 3);
  console.log(`base ${b.f}: ore groups within 120 tiles = ${near.length}, of them 3+ tiles = ${usable.length} ${usable.length >= 4 ? 'OK' : 'SHORT (spec wants 4)'}`);
}

// ------------------------------------------------------------------ void share
const voidTiles = census.get(-1) || 0;
let voidNearBase = 0, boxTiles = 0;
for (let y = 0; y < side; y += 1) {
  for (let x = 0; x < side; x += 1) {
    for (const b of bases) {
      if (Math.abs(x - b.x) <= 60 && Math.abs(y - b.y) <= 60) {
        boxTiles += 1;
        if (world[y * side + x] < 0) voidNearBase += 1;
      }
    }
  }
}
console.log(`void: ${(100 * voidTiles / world.length).toFixed(1)}% of the world, ${(100 * voidNearBase / Math.max(1, boxTiles)).toFixed(2)}% inside 121x121 boxes at the bases`);

// -------------------------------------------------------- strict local floors
// A connected terrace's bounding box can span the whole map through a thin
// road. Measure the actual flat disc under each base as well, not that envelope.
let compositionOK = true;
for (const b of bases) {
  const bx = Math.floor(b.x), by = Math.floor(b.y), h = at(bx, by);
  let radius = 0, voids = 0;
  for (let y = by - 60; y <= by + 60; y++) for (let x = bx - 60; x <= bx + 60; x++) if (at(x, y) < 0) voids++;
  outer: for (let r = 1; r <= 60; r++) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r && at(bx + x, by + y) !== h) break outer;
    }
    radius = r;
  }
  const ok = h >= 0 && radius * 2 >= 60 && voids === 0;
  compositionOK &&= ok;
  console.log(`base ${b.f}: flat disc diameter=${radius * 2} tiles; exact 121x121 box void=${voids}/14641 ${ok ? 'OK' : 'FAIL'}`);
}

// Erode by a full 3x3 flat footprint before walking. A path in this mask proves
// a >=3-tile-wide low-gradient corridor, not a one-cell land bridge. Gate its
// departure through two separated arcs of the clearing, not two adjacent walks
// down the same road. The arcs are defined by direction, not generator waypoints.
const wide = new Uint8Array(side * side);
for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
  const h = at(x, y);
  if (h < 0) continue;
  let flat = true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== h) flat = false;
  if (flat) wide[y * side + x] = 1;
}
function widePath(b, lane) {
  const bx = Math.floor(b.x), by = Math.floor(b.y), sign = bx < mid ? 1 : -1;
  const start = by * side + bx, parents = new Int32Array(side * side).fill(-1), queue = new Int32Array(side * side);
  let head = 0, tail = 1;
  queue[0] = start; parents[start] = start;
  while (head < tail) {
    const i = queue[head++], x = i % side, y = Math.floor(i / side);
    if (Math.hypot(x - mid, y - mid) <= 100) {
      let length = 0, gradient = 0, exit = null;
      for (let j = i; j !== start; j = parents[j]) {
        const px = j % side, py = Math.floor(j / side);
        gradient = Math.max(gradient, Math.abs(world[j] - world[parents[j]])); length++;
        if (Math.hypot(px - bx, py - by) >= 32) exit = [px - bx, py - by];
      }
      return { length, gradient, exit };
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * side + nx;
      if (nx < 1 || ny < 1 || nx >= side - 1 || ny >= side - 1 || !wide[j] || parents[j] !== -1 || Math.abs(world[j] - world[i]) > .5) continue;
      const u = (nx - bx) * sign, v = (ny - by) * sign, r = Math.hypot(u, v);
      // Two non-touching exit arcs at radius 32..40: around opposite ridge
      // flanks before the corridors turn inward toward the contested middle.
      if (r >= 32 && r <= 40 && (lane === 0 ? v > -24 || Math.abs(u) > 16 : u > -24 || Math.abs(v) > 16)) continue;
      parents[j] = i; queue[tail++] = j;
    }
  }
  return null;
}
for (const b of bases) {
  for (let lane = 0; lane < 2; lane++) {
    const p = widePath(b, lane);
    compositionOK &&= !!p;
    console.log(`base ${b.f}: wide route ${lane + 1} ${p ? `OK width>=3 length=${p.length} max-gradient=${p.gradient} clearing-exit=(${p.exit})` : 'NO'} -> within 100 tiles of centre`);
  }
}

// Count actual consecutive ridge faces, not unrelated steps in a 100x100 box.
// Each cell in a run must show 1 -> .5 -> 0 on the SAME monotone land flank.
// Restrict the second drop to twelve tiles and require twelve adjacent faces.
for (const b of bases) {
  const runs = [];
  const bx = Math.floor(b.x), by = Math.floor(b.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tx = dy ? 1 : 0, ty = dx ? 1 : 0;
    const flank = (x, y) => {
      if (Math.hypot(x - bx, y - by) > 200 || at(x, y) !== 1 || at(x + dx, y + dy) !== .5) return false;
      for (let d = 2; d <= 12; d++) {
        const h = at(x + dx * d, y + dy * d);
        if (h === 0) return true;
        if (h !== .5) return false;
      }
      return false;
    };
    for (let y = Math.max(1, by - 200); y <= Math.min(side - 2, by + 200); y++) {
      for (let x = Math.max(1, bx - 200); x <= Math.min(side - 2, bx + 200); x++) {
        if (!flank(x, y) || flank(x - tx, y - ty)) continue;
        let length = 1;
        while (flank(x + tx * length, y + ty * length)) length++;
        if (length >= 12) runs.push({ x, y, length });
      }
    }
  }
  runs.sort((a, b) => b.length - a.length);
  const ok = runs.length >= 3;
  compositionOK &&= ok;
  console.log(`base ${b.f}: ridge runs of 12+ two-step faces within 200 tiles=${runs.length} lengths=${runs.map(r => r.length).join(',')} ${ok ? 'OK' : 'SHORT (spec wants 3)'}`);
}
for (const b of bases) compositionOK &&= groups.filter(g => g.size >= 3 && g.spread <= 30 && Math.hypot(g.cx - b.x, g.cy - b.y) <= 120).length >= 4;
console.log(`world-composition: ${compositionOK ? 'PASS' : 'FAIL'}`);
if (!compositionOK) process.exitCode = 1;
