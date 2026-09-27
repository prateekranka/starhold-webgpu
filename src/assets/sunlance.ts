/**
 * Procedural Sunlance (Kind 23) asset rig.
 * Dawnward long-range kinetic rail-spear skirmisher with stepped ivory mantlet,
 * shoulder-mounted accelerator lance, and energy conduit coils.
 */
import type {BoxSink} from './ash-jackal';

export interface SunlancePose {
  state: number;
  phase: number;
  tick: number;
}

export function drawSunlance(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: SunlancePose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Fallen skirmisher chassis with shattered accelerator lance
    b(0, 0, 0.08, 0.6, 0.35, 0.16, 9, -1);
    b(0.1, 0.1, 0.06, 0.3, 0.25, 0.12, 13);
    // Broken lance pieces
    b(0.25, -0.2, 0.05, 0.7, 0.08, 0.08, 1);
    b(0.7, -0.3, 0.04, 0.4, 0.06, 0.06, 17); // Discharging capacitor
    return;
  }

  // Animation drivers
  const stride = moving ? Math.sin(pose.phase * Math.PI * 2) : 0;
  const attackRecoil = attacking ? Math.sin(pose.tick * 1.2) * 0.12 : 0;
  const walkBob = moving ? Math.abs(stride) * 0.04 : 0;
  const bodyZ = 0.24 + walkBob;

  // 1. Legs (athletic greaves with gold knees)
  const lZ = moving ? Math.max(0, stride) * 0.08 : 0;
  const rZ = moving ? Math.max(0, -stride) * 0.08 : 0;
  // Left leg
  b(-0.06, -0.14, 0.08 + lZ, 0.16, 0.12, 0.18, 9);
  b(-0.04, -0.14, 0.18 + lZ, 0.12, 0.1, 0.12, 21); // Gold poleyn knee
  // Right leg
  b(-0.06, 0.14, 0.08 + rZ, 0.16, 0.12, 0.18, 9);
  b(-0.04, 0.14, 0.18 + rZ, 0.12, 0.1, 0.12, 21);

  // 2. Torso (tapered cuirass with heraldic gold crest)
  b(0, 0, bodyZ + 0.12, 0.32, 0.34, 0.28, 9); // Ivory cuirass
  b(0.04, 0, bodyZ + 0.14, 0.14, 0.22, 0.18, 21); // Gilded center chevron
  b(-0.06, 0, bodyZ + 0.16, 0.26, 0.36, 0.1, 13); // Teal mantle

  // 3. Crested Helmet with visor slit
  b(0.02, 0, bodyZ + 0.34, 0.2, 0.2, 0.18, 9);
  b(0.1, 0, bodyZ + 0.34, 0.06, 0.14, 0.05, 17); // Cyan targeting slit
  b(-0.02, 0, bodyZ + 0.44, 0.24, 0.06, 0.12, 21); // Gold plume crest

  // 4. Kinetic Rail-Lance (Shoulder-mounted heavy weapon)
  const lanceX = 0.2 - attackRecoil;
  const lanceY = -0.22;
  const lanceZ = bodyZ + 0.24;

  // Lance breech and power cell
  b(lanceX - 0.35, lanceY, lanceZ, 0.45, 0.14, 0.14, 1);
  b(lanceX - 0.3, lanceY, lanceZ + 0.08, 0.22, 0.1, 0.08, 17); // Cyan power core

  // Twin rail accelerator barrel
  b(lanceX + 0.25, lanceY, lanceZ + 0.02, 0.85, 0.07, 0.04, 5);
  b(lanceX + 0.25, lanceY, lanceZ - 0.02, 0.85, 0.07, 0.04, 5);

  // Coaxial accelerator rings
  for (const rx of [0.05, 0.3, 0.55]) {
    b(lanceX + rx, lanceY, lanceZ, 0.08, 0.12, 0.12, 17);
  }

  // Muzzle flash on attack release
  if (attacking && (pose.tick % 6 < 2)) {
    b(lanceX + 0.75, lanceY, lanceZ, 0.22, 0.22, 0.22, 18);
    b(lanceX + 0.9, lanceY, lanceZ, 0.15, 0.15, 0.15, 9);
  }

  // 5. Left Arm: Tactical Aiming Stabilizer & Shieldlet
  b(0.06, 0.2, bodyZ + 0.14, 0.12, 0.1, 0.12, 9);
  b(0.18, 0.18, bodyZ + 0.1, 0.2, 0.08, 0.08, 5);
  b(0.24, 0.18, bodyZ + 0.1, 0.08, 0.18, 0.22, 13); // Teal buckler
}
