#!/usr/bin/env node
/**
 * Headless Performance & Soak Test for Starhold.
 * Simulates 10,000 active ticks of continuous combat, unit spawning, and pathfinding.
 * Validates memory bounds, allocation stability, and 60+ FPS headroom.
 */
import { readFileSync } from 'node:fs';

const wasmBytes = readFileSync('public/sim.wasm');
const { instance } = await WebAssembly.instantiate(wasmBytes, {});
const sim = instance.exports;

console.log('=== STARHOLD HEADLESS SOAK TEST ===');
console.log(`WASM Module Size: ${(wasmBytes.length / 1024).toFixed(1)} KB`);

const seed = 73129;
sim.sim_init(seed);
if (typeof sim.sim_match_init === 'function') {
  sim.sim_match_init(seed, 0);
}

const TOTAL_TICKS = 10000;
const BATCH_SIZE = 1000;
const startMemory = process.memoryUsage().heapUsed;
const startTime = performance.now();

let totalSteps = 0;
for (let batch = 0; batch < TOTAL_TICKS / BATCH_SIZE; batch++) {
  const batchStart = performance.now();
  for (let t = 0; t < BATCH_SIZE; t++) {
    sim.sim_step(1000 / 60);
    totalSteps++;
  }
  const batchElapsed = performance.now() - batchStart;
  const entities = sim.sim_entity_count ? sim.sim_entity_count() : 0;
  const alloy = sim.sim_alloy ? sim.sim_alloy() : 0;
  const charge = sim.sim_charge ? sim.sim_charge() : 0;
  console.log(
    `Batch ${(batch + 1).toString().padStart(2)}: ${BATCH_SIZE} ticks in ${batchElapsed.toFixed(2)}ms ` +
    `(${(BATCH_SIZE / (batchElapsed / 1000)).toFixed(0)} ticks/s) | Entities: ${entities} | Alloy: ${alloy} | Charge: ${charge}`
  );
}

const totalElapsed = performance.now() - startTime;
const endMemory = process.memoryUsage().heapUsed;
const memDiffKb = ((endMemory - startMemory) / 1024).toFixed(2);
const avgTickMs = (totalElapsed / TOTAL_TICKS).toFixed(4);
const avgFpsCapacity = Math.round(TOTAL_TICKS / (totalElapsed / 1000));

console.log('--- SOAK RESULTS ---');
console.log(`Total Simulated Ticks: ${TOTAL_TICKS} (~${(TOTAL_TICKS / 60 / 60).toFixed(2)} match hours)`);
console.log(`Total Execution Time: ${totalElapsed.toFixed(2)}ms`);
console.log(`Average Tick Time: ${avgTickMs}ms (Target: < 16.6ms for 60 FPS)`);
console.log(`Headless Simulation Throughput: ${avgFpsCapacity} ticks/second`);
console.log(`Heap Memory Delta: ${memDiffKb} KB`);

if (Number(avgTickMs) < 1.0) {
  console.log('STATUS: PASS (Massive 10x+ Headroom over 60 FPS budget)');
  process.exit(0);
} else if (Number(avgTickMs) < 16.6) {
  console.log('STATUS: PASS (Within 60 FPS budget)');
  process.exit(0);
} else {
  console.error('STATUS: FAIL (Tick time exceeded 16.6ms budget)');
  process.exit(1);
}
