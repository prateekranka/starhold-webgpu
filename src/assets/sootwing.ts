/**
 * Procedural Sootwing (Kind 35) asset rig.
 * Cinderwake aerial recon ornithopter with articulated bat wings,
 * vermilion heat-cloth membranes, and twin soot rocket nozzles.
 */
import type {BoxSink} from './ash-jackal';

export interface SootwingPose {
  state: number;
  phase: number;
  tick: number;
}

export function drawSootwing(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: SootwingPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Crashed ornithopter with crumpled wing spars
    b(0, 0, 0.06, 0.8, 0.35, 0.12, 23, -1);
    b(0.1, -0.2, 0.05, 0.4, 0.3, 0.05, 25);
    b(-0.15, 0.25, 0.04, 0.45, 0.25, 0.05, 24);
    return;
  }

  // Flight dynamics & wing flapping
  const flapCycle = Math.sin(pose.tick * 0.25);
  const wingAngle = (moving ? flapCycle : flapCycle * 0.4) * 0.18;
  const altitude = 0.55 + Math.sin(pose.tick * 0.1) * 0.06;

  // Ground shadow projection
  b(0, 0, 0.02, 0.7, 0.6, 0.02, 0);

  // 1. Sleek Asymmetric Fuselage
  b(0.08, 0, altitude, 0.85, 0.24, 0.16, 24);
  b(0.28, 0, altitude - 0.02, 0.35, 0.16, 0.12, 23);
  b(0.38, 0, altitude - 0.02, 0.08, 0.1, 0.06, 26);

  // 2. Articulated Swept Bat Wings (Left & Right)
  const lTipZ = altitude + wingAngle;
  b(0, -0.26, lTipZ * 0.5 + altitude * 0.5, 0.42, 0.32, 0.06, 25);
  b(-0.1, -0.52, lTipZ, 0.34, 0.3, 0.05, 24);
  b(-0.18, -0.68, lTipZ + 0.04, 0.16, 0.14, 0.04, 1);

  const rTipZ = altitude - wingAngle;
  b(0, 0.26, rTipZ * 0.5 + altitude * 0.5, 0.42, 0.32, 0.06, 25);
  b(-0.1, 0.52, rTipZ, 0.34, 0.3, 0.05, 24);
  b(-0.18, 0.68, rTipZ + 0.04, 0.16, 0.14, 0.04, 1);

  // 3. Tail Boom & Rudder Fins
  b(-0.4, 0, altitude + 0.04, 0.35, 0.08, 0.08, 1);
  b(-0.52, 0, altitude + 0.12, 0.16, 0.04, 0.18, 25);

  // 4. Twin Soot Rocket Nozzles
  b(-0.35, -0.09, altitude - 0.04, 0.22, 0.08, 0.08, 1);
  b(-0.35, 0.09, altitude - 0.04, 0.22, 0.08, 0.08, 1);

  if (moving || (pose.tick % 3 === 0)) {
    const flameLen = moving ? 0.26 + (pose.tick % 4) * 0.04 : 0.12;
    b(-0.35 - flameLen * 0.5, -0.09, altitude - 0.04, flameLen, 0.06, 0.06, 26);
    b(-0.35 - flameLen * 0.5, 0.09, altitude - 0.04, flameLen, 0.06, 0.06, 26);
    b(-0.35 - flameLen * 0.9, 0, altitude - 0.04, 0.1, 0.08, 0.04, 27);
  }

  // 5. Ventral Harpoon Dropper / Claws
  b(0.12, -0.07, altitude - 0.12, 0.16, 0.04, 0.1, 1);
  b(0.12, 0.07, altitude - 0.12, 0.16, 0.04, 0.1, 1);

  if (attacking && (pose.tick % 4 < 2)) {
    b(0.25, 0, altitude - 0.16, 0.22, 0.08, 0.08, 26);
  }
}
