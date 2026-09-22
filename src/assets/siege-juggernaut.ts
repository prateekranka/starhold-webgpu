/**
 * Procedural Heavy Siege Juggernauts:
 * - Star Ram (Kind 26, Dawnward)
 * - Hookguard (Kind 34, Cinderwake)
 * Inspired by reference 03: heavy armored dreadnought with elevated shoulder mortar,
 * recoil shockwave, shell ejection, forward power fist/ram, and billowing blast smoke.
 */
import type {BoxSink} from './ash-jackal';

export interface SiegePose {
  kind: number; // 26 or 34
  state: number;
  phase: number;
  tick: number;
}

export const SIEGE_SCALE = 0.65;

export function drawSiegeJuggernaut(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: SiegePose
): void {
  const isStarRam = pose.kind === 26;
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  // Palette families:
  // Star Ram (Dawnward): Ivory plate (7, 8, 9), Teal core (12, 13), Gold crest (21, 22), Cyan energy (17, 18)
  // Hookguard (Cinderwake): Wine armor (23, 24, 25), Dark steel (1, 2, 3), Orange heat (26, 27)
  const plateColor = isStarRam ? 8 : 24;
  const trimColor = isStarRam ? 13 : 25;
  const chassisColor = isStarRam ? 4 : 23;
  const glowColor = isStarRam ? 18 : 27;

  if (wreck) {
    // Smashed siege engine on terrain: shattered ram head, collapsed treads, smoking boiler
    b(-0.1, 0, 0.18, 1.8, 1.3, 0.35, chassisColor, -1);
    b(0.5, 0, 0.22, 0.6, 0.8, 0.3, plateColor, -1);
    // Broken treads
    b(-0.2, -0.65, 0.08, 1.6, 0.35, 0.2, 2);
    b(-0.3, 0.7, 0.08, 1.5, 0.35, 0.2, 2);
    // Severed mortar barrel
    b(0.2, -0.4, 0.12, 0.8, 0.28, 0.28, 3);
    return;
  }

  // Locomotion & Vibration
  const treadCycle = (pose.tick % 24) / 24;
  const rumble = moving ? (pose.tick % 4 < 2 ? 0.04 : -0.04) : Math.sin(pose.tick * Math.PI / 30) * 0.015;

  // Firing sequence (ref03):
  // 60-tick cadence:
  // 0..0.3: Elevation & Lock-down
  // 0.3..0.45: Fire shockwave & huge recoil
  // 0.45..0.7: Shell casing ejection & steam vent
  // 0.7..1.0: Recovery
  const fireCycle = (pose.tick % 48) / 48;
  const isFiring = attacking;
  const firingShot = isFiring && fireCycle >= 0.3 && fireCycle < 0.45;
  const ejecting = isFiring && fireCycle >= 0.45 && fireCycle < 0.7;

  const mortarRecoil = firingShot ? -0.32 : (ejecting ? -0.16 : 0);
  const elevateAngle = isFiring ? 0.25 : 0.08;

  // Tracked Chassis / Lower Base
  for (const side of [-1, 1] as const) {
    const trackY = side * 0.68;
    // Main heavy track frame
    b(-0.05, trackY, 0.02, 2.1, 0.38, 0.42, 2);
    b(-0.05, trackY, 0.42, 1.9, 0.34, 0.12, chassisColor, -1);
    // Track bogie wheels & moving treads
    for (let w = -3; w <= 3; w++) {
      const wx = w * 0.28 + (moving ? (treadCycle * 0.28 - 0.14) : 0);
      b(wx, trackY + side * 0.12, 0.14, 0.2, 0.08, 0.22, 4);
    }
  }

  // Heavy Central Hull / Armored Citadel (ref03)
  const hullZ = 0.44 + rumble;
  b(-0.15, 0, hullZ, 1.6, 1.1, 0.65, chassisColor, -1);
  b(-0.1, 0, hullZ + 0.48, 1.35, 0.95, 0.42, plateColor, -1);
  b(0.35, 0, hullZ + 0.18, 0.55, 0.85, 0.52, trimColor);

  // Front Heavy Weaponry:
  if (isStarRam) {
    // Star Ram: Square Hydraulic Ram Head on steel rails
    const ramStroke = attacking && fireCycle < 0.35 ? 0.45 : 0;
    b(0.85 + ramStroke, 0, hullZ + 0.1, 0.58, 0.88, 0.62, 8);
    b(1.15 + ramStroke, 0, hullZ + 0.12, 0.24, 0.72, 0.48, 21); // Gold ram bumper
    b(0.55, 0, hullZ + 0.14, 0.6, 0.25, 0.25, 6); // Hydraulic ram piston
  } else {
    // Hookguard: Boarding cleaver & massive spiked fist
    b(0.85, -0.32, hullZ + 0.05, 0.5, 0.22, 0.75, 23);
    b(1.15, -0.32, hullZ + 0.25, 0.35, 0.12, 0.55, 25); // Serrated hook blade
    b(0.72, 0.32, hullZ + 0.12, 0.44, 0.44, 0.44, 25);  // Spiked boarding shield
  }

  // Massive Elevated Shoulder Siege Mortar (ref03)
  const mortarY = -0.38;
  const mortarZ = hullZ + 0.72 + elevateAngle * 0.8;
  // Mortar pivot mount
  b(-0.25, mortarY, hullZ + 0.58, 0.48, 0.36, 0.42, chassisColor);
  // Heavy cannon barrel
  b(0.25 + mortarRecoil, mortarY, mortarZ, 1.15, 0.42, 0.44, 3);
  b(0.78 + mortarRecoil, mortarY, mortarZ, 0.24, 0.48, 0.5, plateColor); // Reinforced muzzle ring
  // Cannon bore / barrel opening
  b(0.88 + mortarRecoil, mortarY, mortarZ, 0.06, 0.34, 0.34, 0);

  // Firing Shockwave, Muzzle Burst, and Shell Ejection (ref03 & ref09)
  if (firingShot) {
    // Immense forward muzzle burst
    b(1.22, mortarY, mortarZ, 0.65, 0.55, 0.55, glowColor);
    b(1.45, mortarY, mortarZ, 0.32, 0.32, 0.32, 9); // Bright white blast core
    // Backward recoil shockwave / dust plume
    b(-0.65, mortarY, mortarZ - 0.1, 0.45, 0.4, 0.35, 6);
  }

  if (ejecting) {
    // Shell casing ejected upward & backward from breach
    b(-0.45, mortarY + 0.18, mortarZ + 0.35, 0.18, 0.18, 0.28, 21); // Brass casing
    // Steam / smoke puff billowing from breach
    b(-0.35, mortarY, mortarZ + 0.42, 0.35, 0.35, 0.35, 5);
  }

  // Commander's Cupola / Armor Crest with Visor
  b(-0.15, 0.24, hullZ + 0.82, 0.48, 0.48, 0.28, plateColor);
  b(0.08, 0.24, hullZ + 0.84, 0.08, 0.32, 0.12, glowColor); // Glowing visor slit
}
