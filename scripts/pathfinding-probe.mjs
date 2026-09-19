#!/usr/bin/env node
// Objective probe for obstacle-aware pathfinding and canyon traversal.
// Runs headless with public/sim.wasm. Audits ground units stepping onto void,
// monitors raider corridor navigation, and tracks march progression between bases.
//
// Usage: node scripts/pathfinding-probe.mjs [public/sim.wasm] [seconds] [seed] [faction]

import { readFile } from 'node:fs/promises';

const wasmPath = process.argv[2] || 'public/sim.wasm';
const durationSec = Number(process.argv[3] || 720) >>> 0; // default 12 minutes
const seed = Number(process.argv[4] || 73129) >>> 0;
const faction = Number(process.argv[5] || 0) >>> 0;

const bytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {});
const sim = instance.exports;

const t0 = Date.now();
sim.sim_match_init(seed, faction);
const initMs = Date.now() - t0;

const side = sim.sim_world_size();
const metres = sim.sim_metres_per_tile();
const world = new Float32Array(sim.memory.buffer, sim.sim_world_ptr(), side * side);
const terrainAt = (x, y) => {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= side || ty >= side) return -2;
  return world[ty * side + tx];
};

const base0 = { x: sim.sim_base_x(0), y: sim.sim_base_y(0) };
const base1 = { x: sim.sim_base_x(1), y: sim.sim_base_y(1) };
const baseDist = Math.hypot(base1.x - base0.x, base1.y - base0.y);

console.log(`[pathfinding-probe] Map: ${side}x${side} (${(side * metres / 1000).toFixed(2)} km), init: ${initMs}ms`);
console.log(`[pathfinding-probe] Base 0: (${base0.x.toFixed(1)}, ${base0.y.toFixed(1)}), Base 1: (${base1.x.toFixed(1)}, ${base1.y.toFixed(1)})`);
console.log(`[pathfinding-probe] Straight-line distance: ${baseDist.toFixed(1)} tiles (${(baseDist * metres / 1000).toFixed(2)} km)`);

const isAircraft = (kind) => kind === 24 || kind === 35;
const isBuilding = (kind) => (kind >= 10 && kind <= 17) || (kind >= 60 && kind <= 67);

let voidStepCount = 0;
const voidStepsByKind = new Map();
let minRaiderDistToBase0 = baseDist;
let firstRaidLaunchTime = null;
let firstRaidArrivalTime = null;

const stepMs = 1000 / 60;
const totalTicks = durationSec * 60;

const simStart = Date.now();

for (let tick = 1; tick <= totalTicks; tick++) {
  sim.sim_step(stepMs);

  // Sample every second (60 ticks)
  if (tick % 60 === 0) {
    const sec = tick / 60;
    const count = sim.sim_entity_count();
    const stride = sim.sim_entity_stride();
    const ptr = sim.sim_entity_ptr();
    const entities = new Float32Array(sim.memory.buffer, ptr, count * stride);

    for (let i = 0; i < count; i++) {
      const off = i * stride;
      const x = entities[off + 0];
      const y = entities[off + 1];
      const z = entities[off + 2];
      const kind = Math.round(entities[off + 4]);
      const state = Math.round(entities[off + 5]);
      const hp = entities[off + 7];
      const unitFaction = Math.round(entities[off + 9]);

      // Only check live mobile ground units (exclude dead, aircraft, ore, projectiles, buildings)
      if (hp <= 0 || state === 4 || isAircraft(kind) || kind >= 40 || isBuilding(kind)) {
        continue;
      }

      const gz = terrainAt(x, y);
      if (gz < 0) {
        voidStepCount++;
        voidStepsByKind.set(kind, (voidStepsByKind.get(kind) || 0) + 1);
      }

      // Track AI raiders marching toward player base (base0)
      if (unitFaction === 1 && (kind === 30 || kind === 31 || kind === 34)) {
        const d = Math.hypot(x - base0.x, y - base0.y);
        if (d < minRaiderDistToBase0) {
          minRaiderDistToBase0 = d;
        }
        if (d < baseDist - 50 && firstRaidLaunchTime === null) {
          firstRaidLaunchTime = sec;
        }
        if (d <= 15 && firstRaidArrivalTime === null) {
          firstRaidArrivalTime = sec;
        }
      }
    }
  }
}

const simElapsedMs = Date.now() - simStart;
const ticksPerSec = ((totalTicks / simElapsedMs) * 1000).toFixed(0);
const outcome = sim.sim_outcome();

console.log('\n--- Simulation Summary ---');
console.log(`Duration: ${durationSec}s (${totalTicks} ticks) simulated in ${simElapsedMs}ms (${ticksPerSec} ticks/s)`);
console.log(`Outcome: ${outcome === 0 ? 'RUNNING' : outcome === 1 ? 'DEFEAT' : 'VICTORY'} (code ${outcome})`);
console.log(`Closest raider to Base 0: ${minRaiderDistToBase0.toFixed(1)} tiles`);
console.log(`First raid launch: ${firstRaidLaunchTime !== null ? `${firstRaidLaunchTime}s` : 'none'}`);
console.log(`First raid arrival: ${firstRaidArrivalTime !== null ? `${firstRaidArrivalTime}s` : 'did not reach'}`);
console.log(`Ground units stepping over void: ${voidStepCount} occurrences`);

if (voidStepsByKind.size > 0) {
  console.log('Void occurrences by unit kind:');
  for (const [k, c] of voidStepsByKind.entries()) {
    console.log(`  Kind ${k}: ${c} second-samples`);
  }
}

// Exit code: 0 if probe succeeded in gathering data
process.exit(0);
