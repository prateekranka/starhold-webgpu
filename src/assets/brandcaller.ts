/**
 * Procedural Brandcaller (Kind 36) asset rig.
 * Cinderwake incendiary mortar platform with quad splayed outrigger legs,
 * heavy traverse ring, and angled quad-mortar bombardment barrels.
 */
import type {BoxSink} from './ash-jackal';

export interface BrandcallerPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawBrandcaller(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: BrandcallerPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Smashed mortar chassis with detached barrels and cracked recoil carriage
    b(0, 0, 0.1, 0.9, 0.8, 0.18, 23, -1);
    b(0.1, -0.15, 0.22, 0.6, 0.5, 0.14, 24, -1);
    b(0.3, 0.2, 0.12, 0.7, 0.25, 0.14, 1);
    b(-0.25, -0.3, 0.05, 0.4, 0.15, 0.08, 26);
    return;
  }

  // Animation drivers
  const stride = moving ? Math.sin(pose.phase * Math.PI * 2) : 0;
  const firingRecoil = attacking ? Math.sin(pose.tick * 0.9) * 0.12 : 0;
  const bodyZ = 0.28 - (attacking ? Math.max(0, firingRecoil) * 0.8 : 0);

  // 1. Four Splayed Outrigger Legs
  const legs = [
    {lx: 0.38, ly: -0.38, step: stride},
    {lx: 0.38, ly: 0.38, step: -stride},
    {lx: -0.38, ly: -0.38, step: -stride},
    {lx: -0.38, ly: 0.38, step: stride},
  ];

  for (const leg of legs) {
    const legLift = moving ? Math.max(0, leg.step) * 0.08 : 0;
    b(leg.lx * 0.5, leg.ly * 0.5, bodyZ - 0.04 + legLift * 0.5, 0.24, 0.24, 0.12, 24);
    b(leg.lx * 0.85, leg.ly * 0.85, 0.12 + legLift, 0.18, 0.18, 0.2, 1);
    b(leg.lx * 1.1, leg.ly * 1.1, 0.04 + legLift, 0.22, 0.22, 0.08, 23);
    b(leg.lx * 1.15, leg.ly * 1.15, 0.02 + legLift, 0.14, 0.14, 0.04, 1);
  }

  // 2. Central Traverse Turret Ring
  b(0, 0, bodyZ, 0.68, 0.68, 0.18, 24);
  b(0, 0, bodyZ + 0.1, 0.58, 0.58, 0.12, 1);
  b(0, 0, bodyZ + 0.16, 0.5, 0.5, 0.1, 25);

  // 3. Elevated Quad-Mortar Cluster
  const gunX = -firingRecoil;
  const gunY = 0;
  const gunZ = bodyZ + 0.26;

  b(gunX, -0.2, gunZ, 0.24, 0.1, 0.22, 1);
  b(gunX, 0.2, gunZ, 0.24, 0.1, 0.22, 1);

  const barrelOffsets = [
    {dy: -0.1, dz: 0.08},
    {dy: 0.1, dz: 0.08},
    {dy: -0.1, dz: -0.04},
    {dy: 0.1, dz: -0.04},
  ];

  for (const bOff of barrelOffsets) {
    b(gunX + 0.14, gunY + bOff.dy, gunZ + bOff.dz + 0.06, 0.54, 0.1, 0.1, 1);
    b(gunX + 0.38, gunY + bOff.dy, gunZ + bOff.dz + 0.14, 0.18, 0.12, 0.12, 26);
  }

  b(gunX - 0.26, 0, gunZ - 0.02, 0.32, 0.38, 0.2, 23);

  // Muzzle flash & smoke blast
  if (attacking && (pose.tick % 6 < 2)) {
    b(gunX + 0.58, 0, gunZ + 0.16, 0.36, 0.38, 0.34, 26);
    b(gunX + 0.72, 0, gunZ + 0.22, 0.22, 0.24, 0.22, 27);
    b(gunX + 0.85, 0.05, gunZ + 0.3, 0.28, 0.28, 0.28, 4);
  }
}
