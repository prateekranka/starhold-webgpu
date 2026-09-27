/**
 * Procedural Pack Beetle (Kind 21) asset rig.
 * Inspired by reference 05: heavy carapace scarab with 6 articulated legs,
 * cargo harness, and ground-burrowing / bunker defense stance with sand bursts.
 */
import type {BoxSink} from './ash-jackal';

export interface BeetlePose {
  state: number;
  phase: number;
  tick: number;
  cargo?: number;
}

export const BEETLE_SCALE = 0.52;

export function drawPackBeetle(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: BeetlePose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Cracked shell resting in sand with broken legs and scattered crates
    b(0, 0, 0.08, 1.2, 0.95, 0.25, 11, -1);
    b(0.1, -0.1, 0.22, 0.7, 0.6, 0.2, 10, -1);
    // Cracked fissure
    b(0.12, 0.05, 0.25, 0.06, 0.5, 0.18, 1);
    // Broken legs
    for (const [lx, ly] of [[-0.45, -0.4], [0, 0.45], [0.4, -0.38]] as const) {
      b(lx, ly, 0.04, 0.3, 0.12, 0.06, 7);
    }
    // Fallen cargo crate
    b(0.55, 0.35, 0.06, 0.32, 0.32, 0.24, 21);
    return;
  }

  // Burrowing / Bracing state (ref05):
  // When idle, working or defending, the beetle hunkers down into the sand,
  // spreading its heavy shell armor plates flush with the terrain.
  const burrowing = !moving && !attacking;
  const burrowDepth = burrowing ? 0.14 : 0;
  const shellSplay = burrowing ? 0.08 : 0;

  // Gait: Tripod gait (hexapod) - alternating triangles of 3 legs
  const gait = ((pose.tick % 36) + 36) % 36 / 36;
  const bob = moving ? Math.abs(Math.sin(pose.tick * Math.PI / 18)) * 0.06 : Math.sin(pose.tick * Math.PI / 30) * 0.02;

  const bodyZ = 0.28 - burrowDepth + bob;

  // 6 Articulated Legs (front, middle, rear on left and right)
  // Tripod 1: Front-Left, Mid-Right, Rear-Left
  // Tripod 2: Front-Right, Mid-Left, Rear-Right
  const legXOffsets = [0.38, 0.0, -0.38];
  for (let i = 0; i < 3; i++) {
    const lx = legXOffsets[i];
    for (const side of [-1, 1] as const) {
      const isTripod1 = (i % 2 === 0 && side === -1) || (i % 2 === 1 && side === 1);
      const legPhase = (gait + (isTripod1 ? 0 : 0.5)) % 1;

      const step = moving ? (legPhase < 0.6 ? 0.14 - 0.28 * legPhase / 0.6 : -0.14 + 0.28 * (legPhase - 0.6) / 0.4) : 0;
      const lift = moving && legPhase >= 0.6 ? Math.sin((legPhase - 0.6) / 0.4 * Math.PI) * 0.14 : 0;

      const footX = lx + step;
      const footY = side * (0.52 + shellSplay);
      const footZ = burrowing ? 0.01 : 0.03 + lift;

      // Leg upper joint
      b(lx * 0.7, side * 0.35, bodyZ, 0.16, 0.18, 0.14, 10);
      // Leg strut to ground
      b(footX, footY, footZ, 0.22, 0.14, 0.08, 7);
      b((lx * 0.7 + footX) / 2, (side * 0.35 + footY) / 2, (bodyZ + footZ) / 2, 0.1, 0.1, 0.12, 11);
    }
  }

  // Sand bursts / dust particles kicked up when burrowed in position (ref05)
  if (burrowing) {
    const dustPhase = (pose.tick % 48) / 48;
    for (let d = 0; d < 6; d++) {
      const da = d * Math.PI / 3 + dustPhase * 0.4;
      const dist = 0.58 + ((d * 17) % 11) * 0.02;
      b(Math.cos(da) * dist, Math.sin(da) * dist, 0.02 + dustPhase * 0.06, 0.12, 0.12, 0.04, 20); // Sand grain
      b(Math.cos(da) * (dist + 0.08), Math.sin(da) * (dist + 0.08), 0.01, 0.08, 0.08, 0.03, 28); // Shadow in sand
    }
  }

  // Main Chitin Shell / Abdomen
  // Segmented layered carapace plates (Dawnward teal & ivory plate)
  b(0, 0, bodyZ, 1.15 + shellSplay, 0.88 + shellSplay, 0.38, 12, -1);
  b(-0.12, 0, bodyZ + 0.22, 0.85, 0.78, 0.32, 13, -1);
  b(-0.15, 0, bodyZ + 0.38, 0.65, 0.62, 0.18, 8, -1); // Ivory crest ridge

  // Flank protective armor skirts
  for (const side of [-1, 1] as const) {
    b(-0.05, side * (0.42 + shellSplay), bodyZ - 0.04, 0.85, 0.14, 0.26, 11, -1);
  }

  // Head and mandibles (front)
  b(0.55, 0, bodyZ - 0.02, 0.32, 0.44, 0.24, 11);
  b(0.68, -0.12, bodyZ - 0.06, 0.22, 0.08, 0.1, 8); // Mandible left
  b(0.68, 0.12, bodyZ - 0.06, 0.22, 0.08, 0.1, 8);  // Mandible right
  b(0.6, -0.15, bodyZ + 0.08, 0.08, 0.08, 0.08, 18); // Cyan sensory eye
  b(0.6, 0.15, bodyZ + 0.08, 0.08, 0.08, 0.08, 18);

  // Cargo Harness & Crates on Back
  const cargoCount = pose.cargo !== undefined ? Math.max(0, Math.min(3, pose.cargo)) : 2;
  // Mounting brackets
  b(-0.1, -0.25, bodyZ + 0.36, 0.5, 0.08, 0.1, 7);
  b(-0.1, 0.25, bodyZ + 0.36, 0.5, 0.08, 0.1, 7);

  if (cargoCount >= 1) {
    // Primary alloy crate
    b(-0.12, 0, bodyZ + 0.48, 0.48, 0.44, 0.32, 21);
    b(-0.12, 0, bodyZ + 0.62, 0.44, 0.4, 0.08, 22);
  }
  if (cargoCount >= 2) {
    // Secondary crate
    b(-0.35, 0, bodyZ + 0.42, 0.36, 0.38, 0.28, 20);
  }
}
