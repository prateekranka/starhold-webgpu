#!/usr/bin/env node
// Renders the generated world as an SVG so a person can see what the generator
// actually produced: terrain levels, void, ore, both bases, and the land-only
// route from each base toward the map centre. Borrowed from the way
// Dimillian/Evergrow renders audit diagrams from raw data instead of describing
// them in prose.
//
// Usage: node scripts/world-map-render.mjs [sim.wasm] [seed] [faction] > map.svg
import { readFile } from 'node:fs/promises';

const wasmPath = process.argv[2] || 'public/sim.wasm';
const seed = Number(process.argv[3] || 73129) >>> 0;
const faction = Number(process.argv[4] || 0) >>> 0;

const { instance } = await WebAssembly.instantiate(await readFile(wasmPath), {});
const e = instance.exports;
e.sim_match_init(seed, faction);

const side = e.sim_world_size();
const metres = e.sim_metres_per_tile();
const world = new Float32Array(e.memory.buffer, e.sim_world_ptr(), side * side);
const at = (x, y) => (x < 0 || y < 0 || x >= side || y >= side ? -2 : world[y * side + x]);

// Palette values from src/kinds.ts. Terrain uses the ground ramp, one step per
// level plus a distinct void tone; ore and bases take their faction accent.
const GROUND = { '-1': '#1B1E30', '0': '#2B2D46', '0.5': '#41435E', '1': '#565B73' };
const WATER = '#163D48';
const ORE = '#F1CE72';
const BASE = ['#8BD7BE', '#F5B66B'];

// Land-only route: breadth-first from a base to the map centre, drawn so a
// reader can see whether the two starts are connected at all.
function landPath(fromX, fromY, toX, toY) {
  const start = Math.floor(fromY) * side + Math.floor(fromX);
  const goal = Math.floor(toY) * side + Math.floor(toX);
  const prev = new Int32Array(side * side).fill(-1);
  const queue = [start];
  prev[start] = start;
  let head = 0;
  while (head < queue.length) {
    const i = queue[head];
    head += 1;
    if (i === goal) {
      const path = [];
      for (let j = i; j !== start; j = prev[j]) path.push(j);
      return path.reverse();
    }
    const x = i % side, y = (i - x) / side;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
      const j = ny * side + nx;
      if (prev[j] !== -1 || world[j] < 0) continue;
      prev[j] = i;
      queue.push(j);
    }
  }
  return null;
}

const bases = [0, 1].map((f) => ({ f, x: e.sim_base_x(f), y: e.sim_base_y(f) }));
const mid = side / 2;
const paths = bases.map((b) => landPath(b.x, b.y, mid, mid));

const ore = [];
const n = e.sim_entity_count();
const stride = e.sim_entity_stride();
const ents = new Float32Array(e.memory.buffer, e.sim_entity_ptr(), n * stride);
for (let i = 0; i < n; i += 1) if (ents[i * stride + 4] === 40) ore.push([ents[i * stride], ents[i * stride + 1]]);

const cell = 1; // one SVG unit per tile
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side * cell} ${side * cell}" width="1024" height="1024" shape-rendering="crispEdges">`);
out.push(`<rect width="100%" height="100%" fill="#10121C"/>`);
// Terrain: run-length by row so the file stays a sensible size.
for (let y = 0; y < side; y += 1) {
  let x = 0;
  while (x < side) {
    const v = String(world[y * side + x]);
    const fill = v === '-1' ? GROUND['-1'] : v === '0' ? GROUND['0'] : v === '0.5' ? GROUND['0.5'] : GROUND['1'];
    let w = 1;
    while (x + w < side && String(world[y * side + x + w]) === v) w += 1;
    out.push(`<rect x="${x * cell}" y="${y * cell}" width="${w * cell}" height="${cell}" fill="${fill}"/>`);
    x += w;
  }
}
// Routes.
paths.forEach((path, index) => {
  if (!path) return;
  const d = path.map((i, k) => {
    const x = (i % side) + 0.5, y = Math.floor(i / side) + 0.5;
    return `${k === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
  out.push(`<path d="${d}" fill="none" stroke="${BASE[index]}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/>`);
});
// Ore, bases, labels.
for (const [x, y] of ore) out.push(`<rect x="${x - 0.6}" y="${y - 0.6}" width="2.2" height="2.2" fill="${ORE}"/>`);
for (const b of bases) {
  out.push(`<circle cx="${b.x + 0.5}" cy="${b.y + 0.5}" r="6" fill="none" stroke="${BASE[b.f]}" stroke-width="2"/>`);
  out.push(`<text x="${b.x + 10}" y="${b.y + 4}" fill="${BASE[b.f]}" font-family="monospace" font-size="14">${b.f === 0 ? 'DAWNWARD' : 'CINDERWAKE'}</text>`);
}
const reached = paths.map((p) => (p ? `${(p.length * metres / 1000).toFixed(2)} km` : 'NO LAND ROUTE'));
out.push(`<text x="12" y="${side - 26}" fill="#98A4AE" font-family="monospace" font-size="14">seed ${seed} · ${side}×${side} tiles · ${(side * metres / 1000).toFixed(2)} km · ore ${ore.length}</text>`);
out.push(`<text x="12" y="${side - 8}" fill="#98A4AE" font-family="monospace" font-size="14">route to centre: ${bases.map((b, i) => `${b.f === 0 ? 'D' : 'C'} ${reached[i]}`).join(' · ')}</text>`);
out.push('</svg>');
console.log(out.join('\n'));
