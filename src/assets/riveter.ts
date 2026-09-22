/**
 * Procedural Riveter (Kind 20) asset rig.
 * Dawnward heavy worker / harvester with articulated pneumatic drill,
 * hydraulic manipulator claw, and rear ore hopper.
 */
import type {BoxSink} from './ash-jackal';

export interface RiveterPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawRiveter(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: RiveterPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const working = pose.state === 3 || pose.state === 5 || pose.state === 8;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Scorched ruptured harvester frame with severed drill head
    b(0, 0, 0.08, 0.6, 0.5, 0.16, 1, -1);
    b(-0.1, 0, 0.22, 0.45, 0.38, 0.14, 2, -1);
    // Severed drill bit lying in dust
    b(0.35, -0.15, 0.06, 0.32, 0.14, 0.12, 5);
    b(0.5, -0.15, 0.05, 0.18, 0.08, 0.08, 21);
    // Broken hopper spilling crushed alloy scrap
    b(-0.28, 0.1, 0.05, 0.2, 0.2, 0.06, 21);
    return;
  }

  // Animation drivers
  const stride = moving ? Math.sin(pose.phase * Math.PI * 2) : 0;
  const drillCycle = working ? Math.sin(pose.tick * 0.8) : 0;
  const workBob = working ? Math.abs(Math.sin(pose.tick * 0.4)) * 0.04 : 0;
  const walkBob = moving ? Math.abs(stride) * 0.03 : 0;
  const bodyZ = 0.22 + walkBob - workBob;

  // 1. Heavy industrial tracked feet
  const leftLegZ = moving ? Math.max(0, stride) * 0.06 : 0;
  const rightLegZ = moving ? Math.max(0, -stride) * 0.06 : 0;
  // Left foot tread
  b(-0.15, -0.18, 0.06 + leftLegZ, 0.35, 0.14, 0.12, 1);
  b(-0.15, -0.18, 0.13 + leftLegZ, 0.28, 0.1, 0.06, 5);
  // Right foot tread
  b(-0.15, 0.18, 0.06 + rightLegZ, 0.35, 0.14, 0.12, 1);
  b(-0.15, 0.18, 0.13 + rightLegZ, 0.28, 0.1, 0.06, 5);

  // 2. Central Torso / Engine block (Dawnward stepped ivory and teal)
  b(0, 0, bodyZ, 0.48, 0.44, 0.28, 9); // Main ivory hull
  b(0, 0, bodyZ + 0.12, 0.38, 0.36, 0.12, 13); // Teal cap collar
  b(0.04, 0, bodyZ + 0.02, 0.42, 0.34, 0.2, 8); // Side casing trim

  // 3. Sensor Head / Slit Visor
  b(0.16, 0, bodyZ + 0.16, 0.22, 0.24, 0.14, 1);
  b(0.24, 0, bodyZ + 0.16, 0.08, 0.18, 0.06, 17); // Cyan sensor glass

  // 4. Rear Ore Hopper
  b(-0.24, 0, bodyZ + 0.08, 0.24, 0.34, 0.22, 2);
  b(-0.24, 0, bodyZ + 0.18, 0.2, 0.3, 0.08, working ? 21 : 3); // Raw gold ore inside hopper

  // 5. Right Arm: Articulated Rock Drill / Riveter
  const drillExt = working ? 0.08 + drillCycle * 0.04 : 0;
  // Shoulder joint
  b(0.08, -0.25, bodyZ + 0.06, 0.14, 0.12, 0.14, 5);
  // Arm boom
  b(0.22 + drillExt * 0.5, -0.26, bodyZ + 0.04, 0.24, 0.1, 0.1, 8);
  // Drill housing & chuck
  b(0.36 + drillExt, -0.26, bodyZ + 0.02, 0.18, 0.14, 0.14, 1);
  // Fluted conical drill bit
  b(0.48 + drillExt, -0.26, bodyZ + 0.02, 0.22, 0.09, 0.09, 21);
  b(0.56 + drillExt, -0.26, bodyZ + 0.02, 0.08, 0.05, 0.05, 22);

  // Sparks when working ore
  if (working && (pose.tick % 4 < 2)) {
    const sparkX = 0.62 + drillExt + Math.sin(pose.tick * 2) * 0.06;
    const sparkY = -0.26 + Math.cos(pose.tick * 3) * 0.06;
    b(sparkX, sparkY, 0.04 + (pose.tick % 3) * 0.03, 0.05, 0.05, 0.05, 22);
  }

  // 6. Left Arm: Heavy Hydraulic Manipulator Claw
  b(0.08, 0.25, bodyZ + 0.06, 0.14, 0.12, 0.14, 5);
  b(0.22, 0.26, bodyZ + 0.02, 0.2, 0.09, 0.09, 8);
  // Claw jaws
  b(0.32, 0.24, bodyZ + 0.04, 0.12, 0.05, 0.07, 1);
  b(0.32, 0.28, bodyZ - 0.02, 0.12, 0.05, 0.07, 1);
}
