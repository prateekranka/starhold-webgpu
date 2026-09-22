// Procedural 3D voxel geometry generator and isometric canvas painter
// for all 14 units and 16 buildings in the Starhold dev lab.
// Uses strict 32-color palette quantization from src/kinds.ts.
import { palette } from '../kinds';
import { drawRiveter } from '../assets/riveter';
import { drawPackBeetle } from '../assets/pack-beetle';
import { drawWardSentinel } from '../assets/ward-sentinel';
import { drawSunlance } from '../assets/sunlance';
import { drawHarborSkiff } from '../assets/harbor-skiff';
import { drawPrismCantor } from '../assets/prism-cantor';
import { drawSiegeJuggernaut } from '../assets/siege-juggernaut';
import { drawAshJackal } from '../assets/ash-jackal';
import { drawCinderStrider } from '../assets/cinder-strider';
import { drawAshhand } from '../assets/ashhand';
import { drawChainMule } from '../assets/chain-mule';
import { drawSootwing } from '../assets/sootwing';
import { drawBrandcaller } from '../assets/brandcaller';
import { renderDawnwardBuildingDetails, renderCinderwakeBuildingDetails } from '../assets/buildings';

export interface VoxelBox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  emissive?: boolean;
}

export interface EmissiveGlint {
  x: number;
  y: number;
  z: number;
  color: number;
  w: number;
  h: number;
}

/** Pre-parsed palette hex values in RGB for canvas shading. */
const PALETTE_RGB = palette.map((hex) => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
]);

function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))})`;
}

/** Cache shaded colors for top, south-west, and south-east faces. */
const SHADED_FACES = PALETTE_RGB.map(([r, g, b]) => ({
  top: rgbToCss(r * 1.05, g * 1.05, b * 1.05),
  left: rgbToCss(r * 0.82, g * 0.82, b * 0.82),
  right: rgbToCss(r * 0.65, g * 0.65, b * 0.65),
}));

/** Building helper classes for base building shapes. */
class GeometrySink {
  boxes: VoxelBox[] = [];
  emissives: EmissiveGlint[] = [];

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, _owner = -1, screen = 0): void {
    if (screen === -4) {
      this.emissive(x, y, z, color);
      return;
    }
    const safeColor = Math.max(0, Math.min(31, Math.floor(color % 32)));
    this.boxes.push({ x, y, z, sx: Math.max(0.04, sx), sy: Math.max(0.04, sy), sz: Math.max(0.04, sz), color: safeColor });
  }

  emissive(x: number, y: number, z: number, color: number, _owner = -1, w = 1, h = 1): void {
    const safeColor = Math.max(0, Math.min(31, Math.floor(color % 32)));
    this.emissives.push({ x, y, z, color: safeColor, w, h });
  }

  strut(x: number, y: number, z: number, dx: number, dy: number, dz: number, width: number, color: number, steps = 3): void {
    for (let j = 0; j < steps; j++) {
      const t = (j + 0.5) / steps;
      this.box(
        x + dx * t,
        y + dy * t,
        z + dz * t - Math.abs(dz) / steps / 2,
        Math.abs(dx) / steps + width,
        Math.abs(dy) / steps + width,
        Math.abs(dz) / steps + width,
        color
      );
    }
  }

  hook(x: number, y: number, z: number, size: number, color: number): void {
    this.box(x, y, z, 0.13 * size, 0.14 * size, 0.65 * size, color);
    this.box(x + 0.2 * size, y, z + 0.55 * size, 0.5 * size, 0.15 * size, 0.13 * size, color);
    this.box(x + 0.4 * size, y, z + 0.36 * size, 0.13 * size, 0.15 * size, 0.27 * size, color);
  }

  crate(x: number, y: number, z: number, size: number): void {
    this.box(x, y, z, size, size, size, 21);
    this.box(x, y, z + size, size * 0.18, size + 0.025, 0.03, 22);
    this.box(x + size * 0.5, y, z + 0.03, 0.025, size * 0.15, size * 0.9, 19);
  }

  banner(x: number, y: number, z: number, phase: number): void {
    const pose = Math.floor(phase * 3) % 3;
    this.box(x, y, z - 0.6, 0.11, 0.11, 1.35, 21);
    this.box(x + 0.42, y + pose * 0.1, z - 0.35, 0.84, 0.13, 0.72, 12);
    this.box(x + 0.82, y + pose * 0.15, z - 0.3 - pose * 0.08, 0.28, 0.14, 0.52, 13);
    this.box(x + 0.3, y + 0.11, z - 0.2, 0.13, 0.08, 0.24, 22);
  }

  crane(x: number, y: number, z: number, w: number, h: number, phase: number): void {
    this.box(x, y, z, 0.17, 0.17, h, 20);
    this.box(x - w * 0.5, y, z + h, w + 0.15, 0.18, 0.18, 22);
    const lift = 0.8 + ((Math.floor(phase * 6) / 6) * (h - 1.2));
    this.box(x - w * 0.8, y, z + lift, 0.05, 0.05, h - lift, 19);
    this.box(x - w * 0.8, y, z + lift - 0.15, 0.2, 0.2, 0.16, 22);
    this.box(x - w * 0.8, y, z + lift - 0.55, 0.42, 0.42, 0.4, 12);
  }
}

/**
 * Procedural base geometry for Dawnward structures (10–17).
 * Replicated faithfully from src/renderer.ts lines 930–1005.
 */
function buildDawnwardBase(sink: GeometrySink, k: number, phase: number, time: number): void {
  const x = 0, y = 0, z = 0;
  if (k === 10) {
    sink.box(x + 1.86, y, z + 0.42, 0.08, 3.4, 0.85, 12);
    for (let j = -1; j <= 1; j++) {
      for (let side = 0; side < 2; side++) {
        sink.box(x + (side ? 1.82 : j * 1.25), y + (side ? j * 1.25 : 1.82), z + 0.3, side ? 0.48 : 0.35, side ? 0.35 : 0.48, 1.65, 8);
        sink.box(x + (side ? 2.02 : j * 1.25), y + (side ? j * 1.25 : 2.02), z + 0.2, 0.45, 0.45, 0.45, 7);
      }
    }
    for (let a = -1; a <= 1; a += 2) {
      for (let b = -1; b <= 1; b += 2) {
        sink.box(x + a * 1.65, y + b * 1.65, z + 0.3, 0.45, 0.45, 2.1, 8);
        sink.box(x + a * 1.65, y + b * 1.65, z + 2.4, 0.5, 0.5, 0.2, 8);
        sink.box(x + a * 1.65, y + b * 1.65, z + 2.6, 0.08, 0.08, 0.45, 22);
      }
    }
    sink.box(x, y, z + 1.75, 3.9, 3.9, 0.22, 8);
    sink.box(x, y, z + 1.97, 2.8, 2.8, 0.8, 8);
    sink.box(x, y, z + 2.1, 2.35, 2.35, 0.6, 12);
    sink.box(x, y, z + 2.77, 3.0, 3.0, 0.2, 8);
    sink.box(x, y, z + 2.97, 1.45, 1.45, 1.2, 8);
    sink.box(x, y, z + 3.0, 0.78, 1.36, 1.05, 11);
    sink.box(x, y, z + 4.17, 1.4, 1.4, 0.2, 12);
    sink.box(x, y, z + 4.35, 0.8, 0.1, 0.1, 21);
    sink.banner(x - 0.9, y + 1.98, z + 2.3, phase);
    sink.banner(x + 1.98, y + 0.85, z + 2.3, phase + 0.3);
  } else if (k === 11) {
    for (let a = -1; a <= 1; a += 2) {
      sink.box(x + a * 1.25, y, z + 0.3, 0.38, 2.7, 1.25, 12);
      for (let j = -1; j <= 1; j++) sink.box(x + a * 1.42, y + j, z + 0.3, 0.16, 0.22, 1.4, 7);
    }
    sink.box(x, y - 1.25, z + 0.3, 2.5, 0.35, 1.3, 12);
    for (let a = -1; a <= 1; a += 2) sink.box(x + a * 1.1, y, z + 1.6, 0.9, 2.8, 0.17, 12);
    sink.box(x, y - 1.0, z + 1.6, 2.7, 0.65, 0.17, 13);
    sink.box(x, y + 0.4, z + 1.75, 3.1, 0.7, 0.15, 21);
    sink.crane(x + 1.6, y + 0.4, z, 3.1, 2.0, phase);
    for (let j = 0; j < 4; j++) sink.crate(x - 1.0 + j * 0.62, y + 0.9 + (j % 2) * 0.8, z + 0.2, 0.48);
  } else if (k === 12) {
    sink.box(x, y, z + 0.3, 1.8, 1.8, 0.3, 13);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      sink.box(x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.8, z + 0.25, 0.45, 0.45, 0.45, 8);
    }
    for (let a = -1; a <= 1; a += 2) sink.box(x + a * 0.8, y, z + 0.55, 0.24, 0.46, 2.5, 8);
    // Cyan shard spire
    sink.box(x, y, z + 0.65, 0.65, 0.65, 2.9, 17);
    for (let j = 0; j < 3; j++) {
      sink.box(x, y, z + 0.85 + j * 0.65, 0.75, 0.75, 0.12, 16);
      sink.emissive(x, y, z + 1.14 + j * 0.65, 18, -1, 2, 1);
    }
  } else if (k === 13) {
    sink.box(x, y, z + 0.3, 2.7, 2.7, 1.5, 12);
    for (let a = -1; a <= 1; a += 2) {
      for (let j = -1; j <= 1; j++) sink.box(x + a * 1.36, y + j, z + 0.3, 0.22, 0.25, 1.8, 8);
    }
    for (let j = 0; j < 4; j++) sink.box(x, y, z + 1.85 + j * 0.22, 3.05, 2.9 - j * 0.6, 0.22, j === 3 ? 13 : 12);
    sink.box(x, y, z + 2.74, 3.15, 0.16, 0.14, 7);
    for (let a = -1; a <= 1; a += 2) sink.box(x + a * 0.48, y + 1.38, z + 0.3, 0.64, 0.12, 1.3, 1);
    sink.banner(x - 1.4, y - 1.0, z + 3.1, phase);
  } else if (k === 14) {
    sink.box(x, y, z + 0.3, 2.7, 2.6, 1.4, 6);
    for (let a = -1; a <= 1; a += 2) sink.box(x + a * 1.3, y, z + 0.3, 0.25, 2.6, 1.8, 8);
    sink.box(x, y, z + 1.7, 2.8, 2.7, 0.22, 7);
    sink.box(x - 0.7, y - 0.6, z + 1.9, 0.55, 0.6, 1.1, 4);
    sink.box(x - 0.7, y - 0.6, z + 2.95, 0.68, 0.7, 0.15, 7);
    sink.box(x + 0.65, y - 0.5, z + 1.9, 0.4, 0.4, 0.85, 7);
    sink.box(x, y + 1.34, z + 0.3, 1.25, 0.18, 1.3, 1);
    sink.emissive(x, y + 1.6, z + 0.73, 27, -1, 2, 2);
    const hammerCycle = (time * 2.5) % 1;
    const hammerDown = hammerCycle < 0.25;
    sink.box(x + 0.4, y - 0.3, z + 1.6 + (hammerDown ? 0 : Math.sin(hammerCycle * Math.PI) * 0.4), 0.35, 0.35, 0.45, 6);
  } else if (k === 15) {
    for (let a = -1; a <= 1; a++) {
      sink.box(x + a * 0.98, y, z + 0.3, 0.87, 1.7, 0.25, 12);
      sink.box(x + a * 0.98, y, z + 0.55, 0.8, 1.5, 1.1, 8);
      sink.box(x + a * 0.98, y, z + 1.65, 0.95, 1.8, 0.25, 8);
      sink.box(x + a * 0.98, y, z + 1.9, 0.58, 1.05, 0.14, 12);
    }
    sink.box(x + 1.15, y - 0.6, z + 2.0, 0.06, 0.06, 0.5, 22);
  } else if (k === 16) {
    for (let j = 0; j < 3; j++) {
      sink.box(x, y, z + 0.3 + j * 0.85, 1.65 - j * 0.28, 1.65 - j * 0.28, 0.72, 13);
      sink.box(x, y, z + 0.98 + j * 0.85, 1.8 - j * 0.28, 1.8 - j * 0.28, 0.15, 8);
    }
    for (let a = -1; a <= 1; a += 2) sink.box(x + a * 0.62, y, z + 0.3, 0.32, 0.7, 2.9, 8);
    sink.box(x, y, z + 3.0, 0.5, 0.5, 0.55, 12);
    sink.box(x + 0.74, y, z + 3.3, 0.23, 0.23, 0.2, 18);
  } else if (k === 17) {
    for (let j = -2; j <= 2; j++) sink.box(x + j * 0.7, y, z + 0.3, 0.62, 2.5, 0.1, 11);
    for (let a = -1; a <= 1; a += 2) {
      sink.box(x + a * 1.8, y, z + 0.4, 0.25, 2.7, 0.3, 8);
      sink.box(x, y + a * 1.3, z + 0.4, 3.4, 0.23, 0.3, 8);
    }
    sink.box(x - 1.2, y - 0.7, z + 0.4, 0.9, 0.9, 1.1, 12);
    sink.box(x - 1.2, y - 0.7, z + 1.5, 1.0, 1.0, 0.18, 8);
    sink.crane(x + 1.5, y - 0.9, z, 1.5, 2.5, phase);
  }
}

/**
 * Procedural base geometry for Cinderwake structures (60–67).
 * Replicated faithfully from src/renderer.ts lines 1019–1170.
 */
function buildCinderwakeBase(sink: GeometrySink, k: number, cycle: number, sway: number): void {
  const x = 0, y = 0, z = 0;
  // Runners and anchor shoes
  sink.box(x - 0.12, y - 0.9, z, 2.8, 0.17, 0.16, 23);
  sink.box(x - 0.12, y + 0.9, z, 2.8, 0.17, 0.16, 23);

  if (k === 60) {
    for (let j = 0; j < 4; j++) {
      const xx = x - 1.35 + j * 0.82, span = 2.6 - j * 0.65;
      sink.box(xx, y, z + 0.2, 0.86, span, 0.28, 23);
      for (let side = -1; side <= 1; side += 2) sink.box(xx - 0.08, y + side * span * 0.44, z + 0.48, 0.88, 0.24, 0.65 - j * 0.1, 24);
    }
    sink.box(x - 0.1, y, z + 0.5, 1.12, 1.05, 0.18, 6);
    sink.box(x - 0.1, y, z + 0.68, 0.72, 0.7, 0.91, 26);
    sink.box(x - 0.1, y, z + 1.9, 0.83, 0.8, 0.12, 24);
    sink.strut(x - 1.35, y - 0.7, z + 0.4, -0.3, 0, 2.35, 0.15, 24);
    sink.hook(x - 1.67, y - 0.7, z + 2.65, 0.7, 25);
  } else if (k === 61) {
    sink.box(x + 0.25, y, z + 0.2, 1.7, 2.4, 0.28, 23);
    for (let side = -1; side <= 1; side += 2) sink.box(x + 0.45, y + side * 0.95, z + 0.42, 1.5, 0.28, 0.67, 24);
    const bite = 0.16 * (1 + Math.sin(cycle * Math.PI * 2));
    sink.box(x + 0.65, y, z + 1.27 - bite, 0.55, 2.05, 0.27, 24);
    for (let j = 0; j < 5; j++) {
      sink.box(x + 0.9, y - 0.8 + j * 0.4, z + 0.42, 0.38, 0.17, 0.32, 6);
      sink.box(x + 0.72, y - 0.8 + j * 0.4, z + 0.98 - bite, 0.32, 0.17, 0.3, 25);
    }
    sink.strut(x + 0.35, y, z + 0.62, -1.46, 0, 1.05, 0.21, 24, 4);
    sink.box(x - 1.12, y, z + 1.76, 0.57, 1.12, 0.2, 25);
  } else if (k === 62) {
    sink.box(x, y, z + 0.22, 1.2, 1.14, 0.24, 23);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      sink.strut(x + Math.cos(a) * 0.62, y + Math.sin(a) * 0.62, z + 0.3, -Math.cos(a) * 0.16, -Math.sin(a) * 0.16, 1.37, 0.1, 24, 2);
    }
    sink.box(x, y, z + 0.53, 0.59, 0.57, 1.04, 26);
    const a = cycle * Math.PI * 2, dx = Math.cos(a) * 0.68, dy = Math.sin(a) * 0.68;
    sink.box(x, y, z + 1.67, 0.5, 0.5, 0.18, 25);
    sink.strut(x, y, z + 1.8, dx, dy, 0.24, 0.12, 6);
    sink.box(x + dx, y + dy, z + 1.34, 0.15, 0.15, 0.74, 24);
  } else if (k === 63) {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4, xx = x + Math.cos(a) * 1.15, yy = y + Math.sin(a) * 1.15;
      sink.box(xx, yy, z + 0.18, 0.52, 0.52, 0.27, 23);
      if (j % 2 === 0) {
        sink.box(xx, yy, z + 0.43, 0.62, 0.13, 0.13, 24);
        sink.hook(xx - 0.16, yy, z + 0.56, 0.68, 6);
      }
    }
    sink.box(x - 0.75, y - 0.7, z + 0.35, 0.46, 0.46, 0.4, 24);
    sink.box(x - 0.75, y - 0.7, z + 0.75, 0.32, 0.32, 0.25, 26);
  } else if (k === 64) {
    sink.box(x + 0.63, y, z + 0.22, 1.12, 1.73, 0.27, 23);
    sink.strut(x - 1.12, y - 0.85, z + 0.2, -0.1, 0, 2.35, 0.17, 24);
    sink.strut(x + 0.99, y - 0.85, z + 0.2, -0.21, 0, 1.97, 0.17, 24);
    sink.strut(x - 1.22, y - 0.85, z + 2.55, 2.0, 0, -0.38, 0.19, 25);
    sink.box(x + 0.63, y, z + 0.5, 1.03, 1.48, 0.22, 6);
    const press = Math.max(0, Math.sin(cycle * Math.PI * 2)) * 0.32;
    sink.box(x + 0.63, y, z + 1.25 - press, 1.08, 1.4, 0.35, 24);
    const lift = cycle * 0.54;
    sink.hook(x - 0.83, y - 0.5, z + 0.33 + lift, 0.7, 25);
    sink.box(x - 0.55, y - 0.49, z + 0.35 + lift, 0.6, 0.46, 0.25, 23);
  } else if (k === 65) {
    for (let level = 0; level < 2; level++) {
      const xx = x - 0.5 + level * 0.85, yy = y + level * 0.16, base = 0.62 + level * 0.87;
      for (let side = -1; side <= 1; side += 2) sink.box(xx + side * 0.48, yy - 0.49, z + 0.16, 0.12, 0.12, base + 0.47, 24);
      sink.box(xx, yy, z + base, 1.36, 1.25, 0.12, 23);
      sink.box(xx - 0.5, yy, z + base + 0.12, 0.2, 1.08, 0.6, 24);
      sink.box(xx, yy - 0.5, z + base + 0.12, 1.08, 0.14, 0.57, 23);
      for (let j = 0; j < 3; j++) sink.box(xx - 0.46 + j * 0.41, yy + (sway * j * 0.25), z + base + 0.81 - j * 0.11, 0.49, 1.38, 0.12, 25);
    }
    sink.box(x + 0.85, y + 0.68, z + 1.67, 0.07, 0.07, 0.45, 6);
  } else if (k === 66) {
    sink.box(x - 0.12, y, z + 0.18, 1.32, 1.23, 0.3, 23);
    sink.strut(x - 0.35, y, z + 0.4, -0.2, 0, 1.92, 0.3, 24);
    sink.strut(x + 0.5, y - 0.3, z + 0.37, -0.77, 0, 1.38, 0.12, 6);
    sink.strut(x - 0.6, y, z + 2.24, 1.15 + sway * 0.4, 0, 0.28, 0.19, 24);
    sink.hook(x + 0.46 + sway * 0.4, y, z + 2.23, 0.66, 25);
  } else if (k === 67) {
    for (let side = -1; side <= 1; side += 2) {
      sink.box(x, y + side * 1.05, z + 0.19, 3.8, 0.25, 0.31, 23);
      sink.strut(x - 1.65, y + side * 0.44, z + 0.45, 3.18, 0, 0.65, 0.16, 24, 4);
      sink.box(x - 1.4, y + side * 0.9, z + 0.5, 0.29, 0.27, 1.25, 24);
      const close = 0.14 * (1 + Math.sin(cycle * Math.PI * 2));
      sink.box(x - 0.5, y + side * (0.94 - close), z + 0.88, 0.55, 0.62, 0.19, 25);
    }
    sink.box(x - 1.65, y, z + 0.5, 0.28, 2.35, 0.18, 24);
    sink.box(x + 1.57, y, z + 1.05, 0.3, 1.27, 0.23, 25);
  }
}

/**
 * Emits all procedural boxes and glints for an actor kind.
 */
export function generateActorGeometry(
  kind: number,
  faction: number,
  time: number,
  tick: number,
  phase: number
): { boxes: VoxelBox[]; emissives: EmissiveGlint[] } {
  const sink = new GeometrySink();

  // --- 14 Unit Procedural Rigs
  if (kind === 20) drawRiveter(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 21) drawPackBeetle(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 22) drawWardSentinel(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 23) drawSunlance(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 24) drawHarborSkiff(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 25) drawPrismCantor(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 26) drawSiegeJuggernaut(sink, 0, 0, 0, 0, { kind: 26, state: 0, phase, tick });
  else if (kind === 30) drawAshJackal(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 31) drawCinderStrider(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 32) drawAshhand(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 33) drawChainMule(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 34) drawSiegeJuggernaut(sink, 0, 0, 0, 0, { kind: 34, state: 0, phase, tick });
  else if (kind === 35) drawSootwing(sink, 0, 0, 0, 0, { state: 0, phase, tick });
  else if (kind === 36) drawBrandcaller(sink, 0, 0, 0, 0, { state: 0, phase, tick });

  // --- 16 Building Structures (Base + Living Animated Architectural Details)
  else if (kind >= 10 && kind <= 17) {
    buildDawnwardBase(sink, kind, phase, time);
    renderDawnwardBuildingDetails(
      (bx, by, bz, sx, sy, sz, c, _o, _s) => sink.box(bx, by, bz, sx, sy, sz, c),
      (ex, ey, ez, c, _o, w, h) => sink.emissive(ex, ey, ez, c, -1, w, h),
      0, 0, 0, kind, 1.0, phase, time, 0
    );
  } else if (kind >= 60 && kind <= 67) {
    const cycle = (time / 1.2 + phase) % 1;
    const sway = Math.sin(cycle * Math.PI * 2) * 0.1;
    buildCinderwakeBase(sink, kind, cycle, sway);
    renderCinderwakeBuildingDetails(
      (bx, by, bz, sx, sy, sz, c, _o, _s) => sink.box(bx, by, bz, sx, sy, sz, c),
      (ex, ey, ez, c, _o, w, h) => sink.emissive(ex, ey, ez, c, -1, w, h),
      0, 0, 0, kind, 1.0, cycle, sway, time, 0
    );
  }

  // --- Props and Effects
  else if (kind === 40) {
    // Ore: glowing cluster of crystals
    sink.box(0, 0, 0.1, 0.8, 0.8, 0.2, 21);
    sink.box(-0.15, 0.1, 0.25, 0.4, 0.4, 0.5, 22);
    sink.box(0.18, -0.1, 0.25, 0.35, 0.35, 0.65, 23);
    sink.emissive(0.18, -0.1, 0.9, 22, -1, 2, 2);
  } else if (kind === 41) {
    // Drone: scout with hovering rotators
    sink.box(0, 0, 0.35 + Math.sin(time * 3) * 0.05, 0.35, 0.35, 0.2, 13);
    sink.box(-0.25, 0, 0.4, 0.2, 0.2, 0.05, 21);
    sink.box(0.25, 0, 0.4, 0.2, 0.2, 0.05, 21);
    sink.emissive(0, 0.18, 0.35, 18, -1, 1, 1);
  } else if (kind === 42) {
    // Freighter: heavy armored hauler
    sink.box(0, 0, 0.3, 1.6, 0.8, 0.45, 12);
    sink.box(0.6, 0, 0.5, 0.4, 0.6, 0.3, 8);
    sink.crate(-0.3, 0, 0.75, 0.4);
  } else if (kind === 43) {
    // Relief: supply kit
    sink.crate(0, 0, 0.1, 0.6);
  } else if (kind === 50) {
    // Projectile: energy bolt
    sink.box(0, 0, 0.4, 0.6, 0.15, 0.15, faction === 1 ? 27 : 18);
    sink.emissive(0, 0, 0.4, faction === 1 ? 27 : 18, -1, 2, 2);
  } else if (kind === 51) {
    // Impact: blast ring
    sink.box(0, 0, 0.05, 1.2, 1.2, 0.08, 26);
    sink.box(0, 0, 0.12, 0.6, 0.6, 0.15, 27);
  } else if (kind === 52) {
    // Wreck: collapsed burnt frame
    sink.box(0, 0, 0.08, 0.9, 0.7, 0.2, 2);
    sink.box(0.2, -0.1, 0.18, 0.4, 0.3, 0.15, 3);
  }

  return { boxes: sink.boxes, emissives: sink.emissives };
}

/**
 * Draws the complete procedural game model onto a 2D canvas in isometric projection.
 */
export function drawActorPreview(
  canvas: HTMLCanvasElement,
  kind: number,
  faction: number,
  footprint: [number, number] | null,
  time = 0,
  tick = 0,
  isUnit = false
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 320;
  const cssH = 190;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  // Deep void background
  ctx.fillStyle = '#10121C';
  ctx.fillRect(0, 0, cssW, cssH);

  const phase = (time * 0.8) % 1;
  const { boxes, emissives } = generateActorGeometry(kind, faction, time, tick, phase);

  const tilesW = footprint?.[0] ?? (isUnit ? 1 : 2);
  const tilesH = footprint?.[1] ?? (isUnit ? 1 : 2);
  const maxSpan = Math.max(tilesW, tilesH, isUnit ? 1.2 : 2.5);

  // Dynamic isometric scale: zoom in on single-tile units, keep buildings framed
  const scale = isUnit ? Math.min(54, (cssW - 40) / 4) : Math.min(24, (cssW - 40) / (maxSpan * 1.85));

  const cx = cssW / 2;
  const cy = isUnit ? cssH * 0.65 : cssH * 0.68;

  const iso = (x: number, y: number, z: number) => ({
    sx: cx + (x - y) * scale,
    sy: cy + (x + y) * scale * 0.5 - z * scale * 0.88,
  });

  // 1. Draw subtle footprint plinth on ground level (z = 0)
  const fw = tilesW / 2;
  const fh = tilesH / 2;
  const plinthTop = faction === 1 ? '#2B2D46' : '#1B1E30';
  const plinthRim = faction === 1 ? '#4E2439' : '#1D6068';

  const p0 = iso(-fw, -fh, 0);
  const p1 = iso(fw, -fh, 0);
  const p2 = iso(fw, fh, 0);
  const p3 = iso(-fw, fh, 0);

  ctx.beginPath();
  ctx.moveTo(p0.sx, p0.sy);
  ctx.lineTo(p1.sx, p1.sy);
  ctx.lineTo(p2.sx, p2.sy);
  ctx.lineTo(p3.sx, p3.sy);
  ctx.closePath();
  ctx.fillStyle = plinthTop;
  ctx.fill();
  ctx.strokeStyle = plinthRim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. Depth sort boxes from back to front (painter's algorithm)
  // In isometric projection: back is minimum (x + y), front is maximum (x + y).
  boxes.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);

  // 3. Draw each box
  for (const b of boxes) {
    const x0 = b.x - b.sx / 2, x1 = b.x + b.sx / 2;
    const y0 = b.y - b.sy / 2, y1 = b.y + b.sy / 2;
    const z0 = Math.max(0, b.z);
    const z1 = z0 + b.sz;

    const v001 = iso(x0, y0, z1);
    const v101 = iso(x1, y0, z1);
    const v111 = iso(x1, y1, z1);
    const v011 = iso(x0, y1, z1);

    const v010 = iso(x0, y1, z0);
    const v110 = iso(x1, y1, z0);
    const v100 = iso(x1, y0, z0);

    const shades = SHADED_FACES[b.color] ?? SHADED_FACES[7];

    // South-west face (facing +y)
    ctx.beginPath();
    ctx.moveTo(v011.sx, v011.sy);
    ctx.lineTo(v111.sx, v111.sy);
    ctx.lineTo(v110.sx, v110.sy);
    ctx.lineTo(v010.sx, v010.sy);
    ctx.closePath();
    ctx.fillStyle = shades.left;
    ctx.fill();
    ctx.strokeStyle = '#10121C';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // South-east face (facing +x)
    ctx.beginPath();
    ctx.moveTo(v101.sx, v101.sy);
    ctx.lineTo(v111.sx, v111.sy);
    ctx.lineTo(v110.sx, v110.sy);
    ctx.lineTo(v100.sx, v100.sy);
    ctx.closePath();
    ctx.fillStyle = shades.right;
    ctx.fill();
    ctx.strokeStyle = '#10121C';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Top face (facing +z)
    ctx.beginPath();
    ctx.moveTo(v001.sx, v001.sy);
    ctx.lineTo(v101.sx, v101.sy);
    ctx.lineTo(v111.sx, v111.sy);
    ctx.lineTo(v011.sx, v011.sy);
    ctx.closePath();
    ctx.fillStyle = shades.top;
    ctx.fill();
    ctx.strokeStyle = '#10121C';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 4. Draw emissive glints
  for (const em of emissives) {
    const pt = iso(em.x, em.y, em.z);
    const colorHex = `#${palette[em.color] ?? 'FFFFFF'}`;
    const radius = Math.max(2, em.w * 2);
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
