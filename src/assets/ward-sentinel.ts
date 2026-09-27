/**
 * Procedural Ward Sentinel (Kind 22) asset rig.
 * Inspired by reference 01: heroic upright plate guardian with crested helmet,
 * forward tower shield, and thrusting energy spear/halberd.
 */
import type {BoxSink} from './ash-jackal';

export interface SentinelPose {
  state: number;
  phase: number;
  tick: number;
}

export const SENTINEL_SCALE = 0.54;

export function drawWardSentinel(
  sink: BoxSink,
  x: number,
  y: number,
  z: number,
  id: number,
  pose: SentinelPose
): void {
  const moving = pose.state === 1 || pose.state === 6;
  const attacking = pose.state === 2;
  const wreck = pose.state === 4;

  const b = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, c: number, m = 0) =>
    sink.box(x + dx, y + dy, z + dz, sx, sy, sz, c, id, m);

  if (wreck) {
    // Fallen knight on ground: dropped tower shield and cracked spear
    b(0, 0, 0.06, 0.7, 0.45, 0.18, 7, -1);
    b(0.25, 0, 0.08, 0.28, 0.28, 0.2, 8); // Helmet
    // Smashed tower shield on sand
    b(-0.15, 0.35, 0.04, 0.35, 0.85, 0.08, 12);
    b(-0.15, 0.35, 0.06, 0.15, 0.65, 0.04, 21); // Crest
    // Broken spear shaft
    b(0.1, -0.4, 0.04, 0.95, 0.06, 0.06, 20);
    return;
  }

  // Locomotion & Posture
  const gait = ((pose.tick % 32) + 32) % 32 / 32;
  const bob = moving ? Math.abs(Math.sin(pose.tick * Math.PI / 16)) * 0.08 : Math.sin(pose.tick * Math.PI / 32) * 0.02;

  // Attack cycle (spear thrust & shield bash):
  const attackCycle = (pose.tick % 36) / 36;
  const windup = attacking && attackCycle < 0.4 ? attackCycle / 0.4 : 0;
  const recover = attacking && attackCycle >= 0.65 ? (1 - attackCycle) / 0.35 : 0;
  const spearExtension = attacking ? (attackCycle < 0.4 ? -0.15 * windup : (attackCycle < 0.65 ? 0.65 : 0.65 * recover)) : 0;
  const shieldBash = attacking && attackCycle >= 0.35 && attackCycle < 0.6 ? 0.18 : 0;

  // Leg stance: legionary march (left/right stride)
  const leftStep = moving ? Math.sin(gait * Math.PI * 2) * 0.18 : 0;
  const rightStep = moving ? -leftStep : 0;

  // Left Leg
  b(leftStep, -0.16, 0.02, 0.24, 0.2, 0.44, 7);
  b(leftStep + 0.04, -0.16, 0.02, 0.18, 0.18, 0.12, 4); // Greave boot
  // Right Leg
  b(rightStep, 0.16, 0.02, 0.24, 0.2, 0.44, 7);
  b(rightStep + 0.04, 0.16, 0.02, 0.18, 0.18, 0.12, 4);

  // Armored Torso / Breastplate
  const torsoZ = 0.46 + bob;
  b(0, 0, torsoZ, 0.42, 0.48, 0.54, 8, -1);
  b(-0.02, 0, torsoZ + 0.05, 0.38, 0.44, 0.46, 7, -1);
  // Gold pectoral crest
  b(0.18, 0, torsoZ + 0.14, 0.08, 0.28, 0.22, 21);

  // Pauldrons (Shoulder Guards)
  b(0, -0.31, torsoZ + 0.22, 0.32, 0.2, 0.24, 8);
  b(0, 0.31, torsoZ + 0.22, 0.32, 0.2, 0.24, 8);

  // Helmet / Head (ref01)
  const headZ = torsoZ + 0.48;
  b(0.02, 0, headZ, 0.34, 0.32, 0.36, 8, -1);
  // Gold Centurion crest running along top of helmet
  b(0.04, 0, headZ + 0.24, 0.42, 0.08, 0.18, 22);
  // Slit visor (cyan glint)
  b(0.18, 0, headZ + 0.04, 0.06, 0.24, 0.08, 18);

  // Tower Pavise Shield (Held forward on left arm, side = -1)
  const shieldX = 0.32 + shieldBash;
  const shieldY = -0.32;
  const shieldZ = torsoZ + 0.06;
  // Main curved shield body (Dawnward teal & ivory trim)
  b(shieldX, shieldY, shieldZ, 0.12, 0.48, 1.15, 12, -1);
  b(shieldX + 0.04, shieldY, shieldZ, 0.06, 0.38, 1.05, 8);
  // Shield emblem / boss
  b(shieldX + 0.08, shieldY, shieldZ, 0.06, 0.18, 0.42, 21);
  b(shieldX + 0.1, shieldY, shieldZ, 0.04, 0.1, 0.2, 17); // Glowing cyan crest core

  // Thrusting Halberd / Spear (Held in right hand, side = 1)
  const spearX = 0.15 + spearExtension;
  const spearY = 0.32;
  const spearZ = torsoZ + 0.12;
  // Hand gripping spear
  b(0.18, spearY, torsoZ + 0.05, 0.14, 0.14, 0.14, 7);
  // Long weapon haft
  b(spearX, spearY, spearZ, 2.1, 0.07, 0.07, 20);
  // Spearhead / energy blade tip
  b(spearX + 1.15, spearY, spearZ, 0.45, 0.16, 0.22, 18); // Energy tip
  b(spearX + 1.25, spearY, spearZ, 0.25, 0.08, 0.12, 9);  // White hot point

  if (attacking && attackCycle >= 0.4 && attackCycle < 0.6) {
    // Thrust energy flash
    b(spearX + 1.4, spearY, spearZ, 0.35, 0.25, 0.25, 17);
  }
}
