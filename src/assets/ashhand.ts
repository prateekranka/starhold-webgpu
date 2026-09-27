/**
 * Procedural Ashhand (Kind 32) asset rig.
 * Cinderwake scraper / scavenger with asymmetric wedge chassis,
 * articulated salvage claw, and smoking exhaust stack.
 */
import type {BoxSink} from './ash-jackal';

export interface AshhandPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawAshhand(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: AshhandPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const working = pose.state === 3 || pose.state === 5 || pose.state === 8;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Crushed scrap chassis with bent salvage arm
    b(0, 0, 0.08, 0.65, 0.45, 0.16, 23, -1);
    b(0.1, 0.05, 0.2, 0.45, 0.35, 0.12, 24, -1);
    b(0.35, -0.2, 0.05, 0.25, 0.18, 0.08, 1);
    return;
  }

  const stride = moving ? Math.sin(pose.phase * Math.PI * 2) : 0;
  const clawSnap = working ? Math.sin(pose.tick * 0.9) : 0;
  const walkBob = moving ? Math.abs(stride) * 0.03 : 0;
  const workBob = working ? Math.abs(Math.sin(pose.tick * 0.5)) * 0.04 : 0;
  const bodyZ = 0.2 + walkBob - workBob;

  // 1. Asymmetric Tracked Under-chassis
  const leftTreadZ = moving ? Math.max(0, stride) * 0.05 : 0;
  const rightTreadZ = moving ? Math.max(0, -stride) * 0.05 : 0;
  // Left tread (wider)
  b(-0.08, -0.2, 0.07 + leftTreadZ, 0.48, 0.14, 0.14, 1);
  b(-0.08, -0.2, 0.14 + leftTreadZ, 0.4, 0.1, 0.06, 23);
  // Right tread (narrower wedge)
  b(-0.04, 0.2, 0.07 + rightTreadZ, 0.42, 0.12, 0.14, 1);
  b(-0.04, 0.2, 0.14 + rightTreadZ, 0.36, 0.08, 0.06, 23);

  // 2. Heavy Wedge Hull (Cinderwake wine armor & vermilion heat cowl)
  b(0, 0, bodyZ, 0.52, 0.38, 0.24, 24); // Main wine body
  b(0.08, 0.04, bodyZ + 0.08, 0.36, 0.28, 0.14, 25); // Vermilion cowl
  b(-0.12, -0.06, bodyZ + 0.06, 0.28, 0.22, 0.18, 23); // Rear engine housing

  // 3. Offset Slag Exhaust Chimney (Smoking pipe)
  const pipeX = -0.16;
  const pipeY = -0.12;
  b(pipeX, pipeY, bodyZ + 0.18, 0.12, 0.12, 0.24, 1);
  b(pipeX, pipeY, bodyZ + 0.3, 0.14, 0.14, 0.06, 26); // Glowing orange exhaust rim

  // Puffing voxel smoke when moving or working
  if ((working || moving) && (pose.tick % 5 < 3)) {
    const puffZ = bodyZ + 0.36 + ((pose.tick % 6) * 0.05);
    const puffDrift = Math.sin(pose.tick * 0.3) * 0.06;
    b(pipeX - 0.08 + puffDrift, pipeY, puffZ, 0.1, 0.1, 0.1, 4);
    if (working) {
      b(pipeX, pipeY, bodyZ + 0.32, 0.06, 0.06, 0.06, 27); // Molten ember
    }
  }

  // 4. Heavy Articulated Salvage Claw Arm (Right front)
  const clawExt = working ? 0.1 + clawSnap * 0.05 : 0;
  // Hydraulic shoulder boom
  b(0.12, -0.18, bodyZ + 0.08, 0.14, 0.14, 0.14, 1);
  b(0.26 + clawExt * 0.5, -0.18, bodyZ + 0.06, 0.24, 0.1, 0.1, 5);
  // Wrist swivel
  b(0.38 + clawExt, -0.18, bodyZ + 0.04, 0.14, 0.12, 0.12, 25);

  // Three-finger crushing claws
  const jawAngle = working ? Math.abs(clawSnap) * 0.06 : 0.02;
  b(0.48 + clawExt, -0.18, bodyZ + 0.08 + jawAngle, 0.18, 0.06, 0.06, 1);
  b(0.48 + clawExt, -0.22 - jawAngle, bodyZ - 0.02, 0.18, 0.06, 0.06, 1);
  b(0.48 + clawExt, -0.14 + jawAngle, bodyZ - 0.02, 0.18, 0.06, 0.06, 1);

  // Sparks while cutting scrap
  if (working && (pose.tick % 4 < 2)) {
    b(0.58 + clawExt, -0.18, bodyZ + 0.02, 0.06, 0.06, 0.06, 26);
    b(0.62 + clawExt, -0.16, bodyZ + 0.04, 0.04, 0.04, 0.04, 27);
  }

  // 5. Left Sensor Eye / Scanning Lamp
  b(0.2, 0.12, bodyZ + 0.12, 0.12, 0.12, 0.08, 1);
  b(0.26, 0.12, bodyZ + 0.12, 0.06, 0.08, 0.06, 26); // Amber heat lens
}
