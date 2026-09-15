#!/usr/bin/env node
// Node-level check of the expansive world: no browser, no renderer. Verifies the
// LARGEMAP_SPEC §4 claims about the generated world and the world spawns.
import { readFile } from 'node:fs/promises';

const bytes = await readFile(process.argv[2] || 'public/sim.wasm');
const { instance } = await WebAssembly.instantiate(bytes, {});
const e = instance.exports;

const t0 = Date.now();
e.sim_match_init(73129, 0);
const genMs = Date.now() - t0;

const side = e.sim_world_size();
const metres = e.sim_metres_per_tile();
const ptr = e.sim_world_ptr();
const world = new Float32Array(e.memory.buffer, ptr, side * side);

const counts = new Map();
for (let i = 0; i < world.length; i++) counts.set(world[i], (counts.get(world[i]) || 0) + 1);
const levels = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const land = [...counts.entries()].filter(([h]) => h >= 0).reduce((s, [, n]) => s + n, 0);

console.log(`side=${side} tiles  metres/tile=${metres}  world=${(side * metres / 1000).toFixed(2)} km`);
console.log(`generation: ${genMs} ms`);
console.log(`levels: ${levels.map(([h, n]) => `${h}->${(100 * n / world.length).toFixed(1)}%`).join('  ')}`);
console.log(`land share: ${(100 * land / world.length).toFixed(1)}%`);
console.log(`heights only in {-1,0,0.5,1}: ${levels.every(([h]) => [-1, 0, 0.5, 1].includes(h))}`);

const bx = [e.sim_base_x(0), e.sim_base_x(1)];
const by = [e.sim_base_y(0), e.sim_base_y(1)];
const sep = Math.hypot(bx[0] - bx[1], by[0] - by[1]);
console.log(`base Dawnward=(${bx[0]},${by[0]})  Cinderwake=(${bx[1]},${by[1]})  separation=${sep.toFixed(0)} tiles = ${(sep * metres / 1000).toFixed(2)} km`);
const patch = (cx, cy) => {
  const z = world[Math.floor(cy) * side + Math.floor(cx)];
  for (let y = Math.floor(cy) - 5; y <= Math.floor(cy) + 5; y++)
    for (let x = Math.floor(cx) - 5; x <= Math.floor(cx) + 5; x++)
      if (world[y * side + x] !== z) return false;
  return z >= 0;
};
console.log(`base patches flat+land: ${patch(bx[0], by[0])} ${patch(bx[1], by[1])}`);

const n = e.sim_entity_count();
const stride = e.sim_entity_stride();
const ents = new Float32Array(e.memory.buffer, e.sim_entity_ptr(), n * stride);
const byKind = new Map();
for (let i = 0; i < n; i++) {
  const k = ents[i * stride + 4];
  byKind.set(k, (byKind.get(k) || 0) + 1);
}
console.log(`entities=${n} kinds: ${[...byKind.entries()].sort((a, b) => a[0] - b[0]).map(([k, c]) => `${k}x${c}`).join(' ')}`);
let offLand = 0, minD = Infinity, maxD = 0;
for (let i = 0; i < n; i++) {
  const x = ents[i * stride], y = ents[i * stride + 1], z = ents[i * stride + 2], k = ents[i * stride + 4];
  if (z < 0) offLand++;
  if (k === 40) {
    const d = Math.hypot(x - bx[0], y - by[0]);
    minD = Math.min(minD, d); maxD = Math.max(maxD, d);
  }
}
console.log(`entities standing on void: ${offLand}`);
console.log(`ore distance from Dawnward base: nearest ${minD.toFixed(0)} tiles, farthest ${maxD.toFixed(0)} tiles`);
console.log(`alloy=${e.sim_alloy()} charge=${e.sim_charge()} pop=${e.sim_pop_used()}/${e.sim_pop_cap()}`);

// determinism: a second init with the same seed must reproduce tile for tile
const first = Float32Array.from(world.subarray(0, 4096));
const firstBase = [...bx, ...by];
e.sim_match_init(73129, 0);
const world2 = new Float32Array(e.memory.buffer, e.sim_world_ptr(), side * side);
let diff = 0;
for (let i = 0; i < 4096; i++) if (world2[i] !== first[i]) diff++;
console.log(`determinism: same-seed tile diffs=${diff}, bases equal=${firstBase.every((v, i) => v === [e.sim_base_x(0), e.sim_base_x(1), e.sim_base_y(0), e.sim_base_y(1)][i])}`);

// a world match must still simulate: 10 s of ticks
const before = e.sim_entity_count();
for (let i = 0; i < 600; i++) e.sim_step(1000 / 60);
console.log(`after 600 ticks: entities ${before} -> ${e.sim_entity_count()}, alloy=${e.sim_alloy()}, charge=${e.sim_charge()}`);

// showcase must be untouched by all of this
e.sim_init(1);
console.log(`showcase after world: mode=${e.sim_mode()} world_size=${e.sim_world_size()} entities=${e.sim_entity_count()} alloy=${e.sim_alloy()} charge=${e.sim_charge()}`);
for (let i = 0; i < 6480; i++) e.sim_step(1000 / 60);
console.log(`showcase t=108s: entities=${e.sim_entity_count()} alloy=${e.sim_alloy()} charge=${e.sim_charge()}`);
