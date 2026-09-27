/**
 * Procedural Harbor Skiff (Kind 24) asset rig.
 * Dawnward fast hover patrol craft with swept aerodynamic cowl,
 * twin stabilization outriggers, anti-grav repulsors, and plasma thrusters.
 */
import type {BoxSink} from './ash-jackal';

export interface SkiffPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawHarborSkiff(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: SkiffPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Crashed chassis scorched into the ground
    b(0, 0, 0.08, 0.9, 0.6, 0.16, 1, -1);
    b(0.1, -0.15, 0.14, 0.6, 0.35, 0.12, 9, -1);
    b(-0.25, 0.35, 0.06, 0.45, 0.18, 0.06, 13);
    return;
  }

  // Hover bobbing & banking physics
  const hoverBob = Math.sin(pose.tick * 0.1) * 0.05;
  const bankTilt = moving ? Math.sin(pose.phase * Math.PI * 2) * 0.04 : 0;
  const baseZ = 0.38 + hoverBob;

  // 1. Central Fuselage (Stepped ivory & teal canopy)
  b(0.05, 0, baseZ, 0.95, 0.46, 0.18, 9); // Main ivory hull
  b(0.22, 0, baseZ + 0.08, 0.45, 0.28, 0.14, 13); // Teal cockpit canopy
  b(0.38, 0, baseZ + 0.08, 0.16, 0.18, 0.08, 17); // Forward sensor glass

  // 2. Swept Wing Outriggers
  // Left outrigger wing
  b(-0.05, -0.36, baseZ + 0.02 + bankTilt, 0.65, 0.28, 0.08, 9);
  b(-0.15, -0.48, baseZ + 0.12 + bankTilt, 0.3, 0.08, 0.22, 13); // Vertical stabilizer fin
  // Right outrigger wing
  b(-0.05, 0.36, baseZ + 0.02 - bankTilt, 0.65, 0.28, 0.08, 9);
  b(-0.15, 0.48, baseZ + 0.12 - bankTilt, 0.3, 0.08, 0.22, 13); // Vertical stabilizer fin

  // 3. Ventral Anti-Grav Repulsor Emitters (Cyan glow on ground)
  b(0.05, -0.22, baseZ - 0.1, 0.28, 0.14, 0.06, 17);
  b(0.05, 0.22, baseZ - 0.1, 0.28, 0.14, 0.06, 17);
  b(0.05, 0, 0.03, 0.8, 0.5, 0.02, 18); // Faint projection ring on sand

  // 4. Rear Twin Plasma Thrusters
  b(-0.46, -0.16, baseZ, 0.2, 0.14, 0.14, 1);
  b(-0.46, 0.16, baseZ, 0.2, 0.14, 0.14, 1);

  // Plasma exhaust plumes
  if (moving || (pose.tick % 2 === 0)) {
    const flameLen = moving ? 0.28 + (pose.tick % 3) * 0.05 : 0.14;
    b(-0.46 - flameLen * 0.5, -0.16, baseZ, flameLen, 0.08, 0.08, 17);
    b(-0.46 - flameLen * 0.5, 0.16, baseZ, flameLen, 0.08, 0.08, 17);
    b(-0.46 - flameLen * 0.9, -0.16, baseZ, 0.08, 0.04, 0.04, 18);
    b(-0.46 - flameLen * 0.9, 0.16, baseZ, 0.08, 0.04, 0.04, 18);
  }

  // 5. Twin Chin Laser Emitters
  b(0.48, -0.1, baseZ - 0.06, 0.24, 0.06, 0.06, 5);
  b(0.48, 0.1, baseZ - 0.06, 0.24, 0.06, 0.06, 5);

  if (attacking && (pose.tick % 4 < 2)) {
    b(0.62, -0.1, baseZ - 0.06, 0.14, 0.08, 0.08, 17);
    b(0.62, 0.1, baseZ - 0.06, 0.14, 0.08, 0.08, 17);
  }
}
