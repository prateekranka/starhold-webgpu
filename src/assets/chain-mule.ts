/**
 * Procedural Chain Mule (Kind 33) asset rig.
 * Cinderwake heavy logistics transport with articulated tractor wedge,
 * towing chains, and high-capacity scrap hopper trailer.
 */
import type {BoxSink} from './ash-jackal';

export interface MulePose {
  state: number;
  phase: number;
  tick: number;
}

export function drawChainMule(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: MulePose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Overturned tractor and broken cargo trailer
    b(0.2, 0, 0.1, 0.7, 0.5, 0.18, 23, -1);
    b(-0.4, 0.1, 0.08, 0.65, 0.45, 0.14, 24, -1);
    b(-0.2, -0.2, 0.05, 0.25, 0.25, 0.06, 1);
    b(-0.45, -0.15, 0.04, 0.18, 0.18, 0.05, 21);
    return;
  }

  const stride = moving ? Math.sin(pose.phase * Math.PI * 2) : 0;
  const articulation = moving ? Math.sin(pose.phase * Math.PI * 2 - 0.5) * 0.08 : 0;
  const walkBob = moving ? Math.abs(stride) * 0.03 : 0;
  const baseZ = 0.22 + walkBob;

  // --- 1. TRACTOR CAB (Front Unit) ---
  b(0.22, -0.22, 0.08, 0.52, 0.14, 0.15, 1);
  b(0.22, 0.22, 0.08, 0.52, 0.14, 0.15, 1);
  b(0.24, 0, baseZ, 0.56, 0.42, 0.24, 24);
  b(0.36, 0, baseZ + 0.06, 0.28, 0.32, 0.16, 25);
  b(0.18, 0, baseZ + 0.14, 0.32, 0.34, 0.14, 23);
  b(0.34, 0, baseZ + 0.12, 0.06, 0.24, 0.05, 26);
  b(0.48, -0.12, baseZ - 0.04, 0.18, 0.06, 0.08, 1);
  b(0.48, 0.12, baseZ - 0.04, 0.18, 0.06, 0.08, 1);

  // --- 2. TOWING HITCH & CHAINS ---
  b(-0.04, 0, baseZ - 0.04, 0.14, 0.14, 0.1, 1);
  const chainSway = articulation * 0.5;
  b(-0.1, -0.1 + chainSway, baseZ - 0.02, 0.18, 0.04, 0.04, 5);
  b(-0.1, 0.1 + chainSway, baseZ - 0.02, 0.18, 0.04, 0.04, 5);

  // --- 3. TRAILER CARGO UNIT (Rear Unit) ---
  const trailerX = -0.42;
  const trailerY = articulation;
  b(trailerX, trailerY - 0.2, 0.07, 0.44, 0.12, 0.14, 1);
  b(trailerX, trailerY + 0.2, 0.07, 0.44, 0.12, 0.14, 1);

  b(trailerX, trailerY, baseZ - 0.02, 0.52, 0.44, 0.12, 23);
  b(trailerX + 0.22, trailerY, baseZ + 0.1, 0.06, 0.42, 0.18, 1);
  b(trailerX - 0.22, trailerY, baseZ + 0.1, 0.06, 0.42, 0.18, 1);
  b(trailerX, trailerY - 0.2, baseZ + 0.1, 0.48, 0.06, 0.18, 1);
  b(trailerX, trailerY + 0.2, baseZ + 0.1, 0.48, 0.06, 0.18, 1);

  // Cargo contents: salvaged scrap & ore blocks
  b(trailerX + 0.06, trailerY - 0.06, baseZ + 0.06, 0.18, 0.18, 0.14, 21);
  b(trailerX - 0.08, trailerY + 0.06, baseZ + 0.05, 0.16, 0.16, 0.12, 5);
  b(trailerX + 0.02, trailerY + 0.04, baseZ + 0.12, 0.14, 0.14, 0.1, 26);
}
