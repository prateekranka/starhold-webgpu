/**
 * Procedural Cinder Strider (Kind 31) asset rig.
 * Inspired by reference 02: 4-legged articulated spider-tank walker
 * with alternating recoil cannons, knee suspension, and firing compression.
 */
import type {BoxSink} from './ash-jackal';

export interface StriderPose {
  state: number;
  phase: number;
  tick: number;
  cooldown?: number;
}

export const STRIDER_SCALE = 0.65;

export function drawCinderStrider(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: StriderPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  const strut = (
    ax: number, ay: number, az: number,
    dx: number, dy: number, dz: number,
    w: number, c: number, steps = 3
  ) => {
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      b(
        ax + dx * t, ay + dy * t, az + dz * t - Math.abs(dz) / steps / 2,
        Math.abs(dx) / steps + w, Math.abs(dy) / steps + w, Math.abs(dz) / steps + w,
        c
      );
    }
  };

  if (wreck) {
    // Collapsed chassis on ground with splayed broken legs and scorched plating (ref09)
    b(0, 0, 0.12, 1.4, 1.1, 0.26, 23, -1);
    b(-0.2, 0, 0.35, 0.9, 0.8, 0.22, 24, -1);
    // Dislocated cannons
    b(0.45, -0.35, 0.16, 0.9, 0.18, 0.16, 1);
    b(0.35, 0.4, 0.14, 0.85, 0.18, 0.16, 1);
    // Buckled legs
    for (const [lx, ly] of [[-0.7, -0.6], [-0.6, 0.6], [0.6, -0.65], [0.55, 0.6]] as const) {
      b(lx, ly, 0.05, 0.35, 0.35, 0.1, 23);
      b(lx * 1.3, ly * 1.3, 0.03, 0.4, 0.15, 0.08, 24);
    }
    return;
  }

  // Gait and suspension: diagonal-pair trot (ref02 walk cycle)
  const gait = ((pose.tick % 40) + 40) % 40 / 40;
  const bob = moving ? Math.abs(Math.sin(pose.tick * Math.PI / 20)) * 0.08 : Math.sin(pose.tick * Math.PI / 36) * 0.02;
  const brace = attacking ? -0.1 : 0; // Low crouch firing stance (ref02)

  // Central Armored Core
  const coreZ = 0.55 + bob + brace;
  b(0, 0, coreZ, 1.25, 0.95, 0.48, 24, -1);
  b(-0.15, 0, coreZ + 0.32, 0.95, 0.78, 0.28, 25, -1);
  b(0.32, 0, coreZ + 0.1, 0.45, 0.62, 0.34, 23);

  // Rear power generator / radiator vents with ember glow
  b(-0.62, 0, coreZ + 0.08, 0.28, 0.72, 0.36, 23);
  for (let s = -1; s <= 1; s += 2) {
    b(-0.65, s * 0.22, coreZ + 0.14, 0.12, 0.14, 0.24, 26);
    b(-0.67, s * 0.22, coreZ + 0.16, 0.06, 0.08, 0.16, 27); // Heat vent
  }

  // 4 Articulated Reverse-Jointed Spider Legs (ref02)
  // Front-right (1, 1), Front-left (1, -1), Rear-right (-1, 1), Rear-left (-1, -1)
  const legSpanX = 0.62;
  const legSpanY = 0.54;

  for (const end of [-1, 1] as const) {
    for (const side of [-1, 1] as const) {
      // Diagonal pair phase: end * side > 0 vs end * side < 0
      const legPhase = (gait + (end * side > 0 ? 0 : 0.5)) % 1;
      const step = moving ? (legPhase < 0.6 ? 0.25 - 0.5 * legPhase / 0.6 : -0.25 + 0.5 * (legPhase - 0.6) / 0.4) : 0;
      const lift = moving && legPhase >= 0.6 ? Math.sin((legPhase - 0.6) / 0.4 * Math.PI) * 0.22 : 0;

      const hipX = end * legSpanX * 0.7;
      const hipY = side * legSpanY * 0.7;
      const kneeX = end * (legSpanX + 0.35) + step * 0.4;
      const kneeY = side * (legSpanY + 0.38);
      const kneeZ = coreZ + 0.18 + lift * 0.5;

      const footX = end * (legSpanX + 0.48) + step;
      const footY = side * (legSpanY + 0.42);
      const footZ = 0.04 + lift;

      // Hip rotator housing
      b(hipX, hipY, coreZ - 0.05, 0.26, 0.26, 0.26, 23);

      // Upper femur strut: upward and outward to raised knee (spider silhouette)
      strut(hipX, hipY, coreZ, kneeX - hipX, kneeY - hipY, kneeZ - coreZ, 0.14, 24);
      // Knee armor cap
      b(kneeX, kneeY, kneeZ, 0.24, 0.22, 0.2, 25);

      // Lower tibia strut: downward to footpad
      strut(kneeX, kneeY, kneeZ, footX - kneeX, footY - kneeY, footZ - kneeZ, 0.12, 23);
      // Articulated footpad with ground-grip claws
      b(footX, footY, footZ, 0.28, 0.26, 0.1, 23);
      b(footX + end * 0.12, footY, footZ, 0.12, 0.2, 0.06, 25);
    }
  }

  // Alternating Twin Heavy Siege Cannons (ref02)
  // Shot cadence: phase alternates between left barrel (side = -1) and right barrel (side = 1)
  const shotCycle = (pose.tick % 32) / 32;
  const activeLeft = attacking && shotCycle < 0.5;
  const activeRight = attacking && shotCycle >= 0.5;

  const recoilLeft = activeLeft ? Math.sin(shotCycle * 2 * Math.PI) * 0.24 : 0;
  const recoilRight = activeRight ? Math.sin((shotCycle - 0.5) * 2 * Math.PI) * 0.24 : 0;

  // Left Barrel (side = -1)
  const lbY = -0.32;
  const lbZ = coreZ + 0.15;
  b(0.1 - recoilLeft, lbY, lbZ, 0.35, 0.22, 0.24, 23); // Trunnion mount
  b(0.65 - recoilLeft, lbY, lbZ, 0.85, 0.14, 0.14, 1);  // Barrel
  b(1.12 - recoilLeft, lbY, lbZ, 0.18, 0.18, 0.18, 24); // Muzzle brake

  // Right Barrel (side = 1)
  const rbY = 0.32;
  const rbZ = coreZ + 0.15;
  b(0.1 - recoilRight, rbY, rbZ, 0.35, 0.22, 0.24, 23);
  b(0.65 - recoilRight, rbY, rbZ, 0.85, 0.14, 0.14, 1);
  b(1.12 - recoilRight, rbY, rbZ, 0.18, 0.18, 0.18, 24);

  // Muzzle Flashes & Energy Conduit (ref02 & ref09)
  if (activeLeft && shotCycle < 0.22) {
    // Intense muzzle flash bursting from left barrel
    b(1.35, lbY, lbZ, 0.42, 0.36, 0.36, 27);
    b(1.48, lbY, lbZ, 0.22, 0.22, 0.22, 9); // Hot core
    // Energy conduits along chassis
    b(0.2, lbY, lbZ + 0.12, 0.4, 0.08, 0.08, 26);
  }
  if (activeRight && shotCycle >= 0.5 && shotCycle < 0.72) {
    // Intense muzzle flash bursting from right barrel
    b(1.35, rbY, rbZ, 0.42, 0.36, 0.36, 27);
    b(1.48, rbY, rbZ, 0.22, 0.22, 0.22, 9); // Hot core
    b(0.2, rbY, rbZ + 0.12, 0.4, 0.08, 0.08, 26);
  }

  // Forward optical scanner / targeting sensor
  b(0.52, 0, coreZ + 0.22, 0.14, 0.28, 0.12, 26);
  b(0.58, 0, coreZ + 0.22, 0.06, 0.18, 0.08, 27);
}
