/**
 * Procedural Prism Cantor (Kind 25) asset rig.
 * Dawnward energy channeler with a levitating ceremonial dais,
 * rotating octahedral focus crystal, and orbiting refraction shards.
 */
import type {BoxSink} from './ash-jackal';

export interface CantorPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawPrismCantor(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: CantorPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const channeling = pose.state === 2 || pose.state === 3;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Smashed ceremonial pedestal with fractured inactive crystal
    b(0, 0, 0.08, 0.7, 0.7, 0.16, 9, -1);
    b(0, 0, 0.18, 0.45, 0.45, 0.12, 2, -1);
    b(0.2, 0.15, 0.06, 0.22, 0.18, 0.14, 16);
    return;
  }

  // Levitating bob and crystal spin angles
  const hoverZ = 0.32 + Math.sin(pose.tick * 0.08) * 0.04;
  const spin = pose.tick * 0.05;
  const shardOrbit = pose.tick * (channeling ? 0.18 : 0.08);

  // 1. Levitating Hexagonal Ivory Dais / Base
  b(0, 0, hoverZ, 0.65, 0.65, 0.12, 9);
  b(0, 0, hoverZ - 0.06, 0.5, 0.5, 0.08, 13); // Teal undercarriage
  b(0, 0, hoverZ + 0.07, 0.42, 0.42, 0.06, 21); // Gilded ring inlay

  // Anti-grav repulsor glow on ground
  b(0, 0, 0.03, 0.55, 0.55, 0.02, 18);

  // 2. Three Ceremonial Gilded Pylons
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + (moving ? Math.sin(pose.tick * 0.1) * 0.05 : 0);
    const px = Math.cos(angle) * 0.24;
    const py = Math.sin(angle) * 0.24;
    b(px, py, hoverZ + 0.16, 0.1, 0.1, 0.22, 9);
    b(px, py, hoverZ + 0.26, 0.06, 0.06, 0.12, 21); // Gold pinnacle
  }

  // 3. Central Rotating Octahedral Focus Crystal
  const crystalZ = hoverZ + 0.32;
  const rotX = Math.cos(spin) * 0.04;
  const rotY = Math.sin(spin) * 0.04;
  b(rotX, rotY, crystalZ, 0.2, 0.2, 0.26, 17);
  b(-rotX, -rotY, crystalZ, 0.14, 0.14, 0.32, 18); // Luminous inner prism core

  // 4. Orbiting Refraction Shards (3 crystalline satellites)
  const orbitDist = channeling ? 0.24 : 0.36;
  for (let i = 0; i < 3; i++) {
    const angle = shardOrbit + (i * Math.PI * 2) / 3;
    const sx = Math.cos(angle) * orbitDist;
    const sy = Math.sin(angle) * orbitDist;
    const sz = crystalZ + Math.sin(shardOrbit * 2 + i) * 0.05;
    b(sx, sy, sz, 0.08, 0.08, 0.12, 14);
    b(sx, sy, sz, 0.05, 0.05, 0.08, 18);
  }

  // 5. Channeling / Casting FX
  if (channeling) {
    b(0.35, 0, crystalZ, 0.45, 0.08, 0.08, 17);
    b(0.55, 0, crystalZ, 0.25, 0.05, 0.05, 18);
    if (pose.tick % 3 === 0) {
      b(0.65, Math.sin(pose.tick) * 0.1, crystalZ + 0.04, 0.04, 0.04, 0.04, 18);
    }
  }
}
