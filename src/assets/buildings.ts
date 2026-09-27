// Procedural architectural details and living mechanical animations
// for all 16 Dawnward and Cinderwake faction structures.
// Palette indices strictly 0..31 from src/kinds.ts.

export type BoxFn = (x:number, y:number, z:number, sx:number, sy:number, sz:number, color:number, owner?:number, screen?:number) => void;
export type EmissiveFn = (x:number, y:number, z:number, color:number, owner?:number, w?:number, h?:number) => void;

/**
 * Procedural animated details for Dawnward civic structures (Kinds 10-17).
 */
export function renderDawnwardBuildingDetails(
  box: BoxFn,
  emissive: EmissiveFn,
  x: number,
  y: number,
  z: number,
  k: number,
  p: number,
  phase: number,
  time: number,
  id: number
): void {
  if (p < 0.5) return; // Structural skeleton phase; details attach once framed.

  const fullyBuilt = p >= 0.85;

  if (k === 10) {
    // Charter Keep: Rotating radar mast, perimeter sweeping searchlights, telemetry spire
    if (fullyBuilt) {
      // Rotating comms dish atop tower peak (z+4.6)
      const radarAngle = time * 1.6 + phase * Math.PI;
      const rdx = Math.cos(radarAngle) * 0.28;
      const rdy = Math.sin(radarAngle) * 0.28;
      box(x, y, z + 4.65, 0.08, 0.08, 0.5, 7, id);
      box(x + rdx, y + rdy, z + 5.15, 0.35, 0.12, 0.22, 13, id);
      box(x - rdx * 0.4, y - rdy * 0.4, z + 5.15, 0.12, 0.12, 0.16, 21, id);
      emissive(x, y, z + 5.2, 18, id, 1, 1);

      // Dual sweeping searchlights on upper battlements
      const sweep = Math.sin(time * 1.2 + phase) * 0.35;
      box(x - 1.4, y + 1.4, z + 2.85, 0.22, 0.22, 0.2, 8, id);
      box(x - 1.4 + sweep, y + 1.4 + 0.15, z + 2.95, 0.18, 0.18, 0.18, 22, id);
      emissive(x - 1.4 + sweep * 1.2, y + 1.4 + 0.22, z + 2.95, 22, id, 2, 2);

      box(x + 1.4, y + 1.4, z + 2.85, 0.22, 0.22, 0.2, 8, id);
      box(x + 1.4 - sweep, y + 1.4 + 0.15, z + 2.95, 0.18, 0.18, 0.18, 22, id);
      emissive(x + 1.4 - sweep * 1.2, y + 1.4 + 0.22, z + 2.95, 22, id, 2, 2);
    }
  } else if (k === 11) {
    // Freight Court: Overhead automated monorail hoist track with traveling container
    if (fullyBuilt) {
      const trackProgress = (time * 0.6 + phase) % 1;
      const hoistX = x - 1.0 + trackProgress * 2.0;
      // Overhead gantry rail
      box(x, y + 0.2, z + 2.6, 2.8, 0.12, 0.14, 7, id);
      // Trolley carriage & drop cable
      box(hoistX, y + 0.2, z + 2.5, 0.35, 0.24, 0.16, 21, id);
      box(hoistX, y + 0.2, z + 1.9, 0.05, 0.05, 0.6, 19, id);
      // Suspended alloy cargo container
      box(hoistX, y + 0.2, z + 1.6, 0.45, 0.38, 0.32, 12, id);
      box(hoistX, y + 0.2, z + 1.6, 0.47, 0.12, 0.34, 22, id);

      // Warning strobe at loading mouth
      const strobe = (Math.floor(time * 3) % 2 === 0);
      if (strobe) emissive(x, y - 1.35, z + 1.8, 22, id, 1, 1);
    }
  } else if (k === 12) {
    // Heliowell: Rotating solar tracking mirrors and pulsating energy containment rings
    if (fullyBuilt) {
      const sunAngle = time * 0.75;
      const mdx = Math.cos(sunAngle) * 0.18;
      const mdy = Math.sin(sunAngle) * 0.18;
      // Peripheral tracking mirror vanes
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI * 0.5 + 0.25;
        const px = x + Math.cos(a) * 0.95;
        const py = y + Math.sin(a) * 0.95;
        box(px, py, z + 0.4, 0.14, 0.14, 0.6, 7, id);
        box(px + mdx, py + mdy, z + 1.0, 0.35, 0.35, 0.08, 17, id);
        emissive(px + mdx, py + mdy, z + 1.05, 18, id, 1, 1);
      }
      // Pulsing containment ring particles rising along crystal spire
      const pulseZ = (time * 1.5) % 1;
      box(x, y, z + 0.9 + pulseZ * 2.2, 0.65, 0.65, 0.08, 13, id);
      emissive(x, y, z + 0.9 + pulseZ * 2.2, 18, id, 2, 1);
    }
  } else if (k === 13) {
    // Muster Hall: Fluttering tactical banner, training target dummies, gate portcullis
    if (fullyBuilt) {
      // Training yard dummy
      box(x + 1.1, y + 0.8, z + 0.3, 0.18, 0.18, 0.7, 19, id);
      box(x + 1.1, y + 0.8, z + 0.7, 0.5, 0.12, 0.14, 20, id);
      box(x + 1.1, y + 0.8, z + 0.95, 0.22, 0.22, 0.22, 8, id);

      // Secondary observation lantern
      const lanternGlow = Math.floor(time * 2.5) % 3 === 0 ? 18 : 17;
      emissive(x - 1.2, y + 1.2, z + 2.8, lanternGlow, id, 1, 1);
    }
  } else if (k === 14) {
    // Starforge: Dense billowing voxel smoke plume with wind drift, heavy molten drop hammer
    if (fullyBuilt) {
      // Wind-drifted chimney smoke voxels
      for (let s = 0; s < 6; s++) {
        const sq = ((time * 1.4 + s * 0.18) % 1);
        const smokeSize = 0.22 + sq * 0.45;
        const driftX = sq * 1.2;
        const driftY = sq * 0.45;
        const smokeZ = z + 3.2 + sq * 2.6;
        box(x - 0.7 + driftX, y - 0.6 + driftY, smokeZ, smokeSize, smokeSize, smokeSize * 0.8, sq < 0.4 ? 5 : sq < 0.7 ? 4 : 3);
      }
      // Cooling ventilation turbine blades
      const fanAngle = time * 6.0;
      const fdx = Math.cos(fanAngle) * 0.18;
      const fdy = Math.sin(fanAngle) * 0.18;
      box(x + 1.2, y + 0.5, z + 1.2, 0.12, 0.45, 0.45, 6, id);
      box(x + 1.26, y + 0.5 + fdx, z + 1.2 + fdy, 0.08, 0.38, 0.12, 21, id);
    }
  } else if (k === 15) {
    // Hearth Pods: Rotating atmospheric vapor condenser and bio-beacon
    if (fullyBuilt) {
      const ventSpin = time * 4.5;
      const vdx = Math.cos(ventSpin) * 0.16;
      const vdy = Math.sin(ventSpin) * 0.16;
      box(x, y - 0.7, z + 1.95, 0.38, 0.38, 0.14, 7, id);
      box(x + vdx, y - 0.7 + vdy, z + 2.05, 0.32, 0.08, 0.08, 13, id);
      // Flashing green/teal environmental beacon
      const beacon = Math.floor(time * 3) % 2 === 0 ? 14 : 12;
      emissive(x + 1.15, y - 0.6, z + 2.55, beacon, id, 1, 1);
    }
  } else if (k === 16) {
    // Prism Bastion: Crystalline laser focusing rings revolving around emitter
    if (fullyBuilt) {
      const ringSpin = time * 2.8;
      const rx = Math.cos(ringSpin) * 0.32;
      const ry = Math.sin(ringSpin) * 0.32;
      box(x + rx, y + ry, z + 3.4, 0.14, 0.14, 0.28, 17, id);
      box(x - rx, y - ry, z + 3.4, 0.14, 0.14, 0.28, 17, id);
      emissive(x + rx, y + ry, z + 3.4, 18, id, 1, 1);
      emissive(x - rx, y - ry, z + 3.4, 18, id, 1, 1);

      // Base capacitor banks with pulsing status conduits
      box(x - 0.65, y + 0.65, z + 0.4, 0.35, 0.35, 0.6, 7, id);
      box(x + 0.65, y - 0.65, z + 0.4, 0.35, 0.35, 0.6, 7, id);
      emissive(x - 0.65, y + 0.65, z + 0.75, 17, id, 1, 1);
      emissive(x + 0.65, y - 0.65, z + 0.75, 17, id, 1, 1);
    }
  } else if (k === 17) {
    // Sky Wharf: Runway approach sequenced landing lights & flight control radar
    if (fullyBuilt) {
      // Marching runway deck approach lights
      const lightStep = Math.floor(time * 5) % 4;
      for (let j = 0; j < 4; j++) {
        const lx = x - 0.9 + j * 0.6;
        const ly = y - 0.9;
        const active = (j === lightStep);
        box(lx, ly, z + 0.42, 0.15, 0.15, 0.08, active ? 22 : 20, id);
        if (active) emissive(lx, ly, z + 0.48, 22, id, 1, 1);
      }
      // Radar dish on control hut
      const hutRadar = time * 2.0;
      const hdx = Math.cos(hutRadar) * 0.22;
      const hdy = Math.sin(hutRadar) * 0.22;
      box(x - 1.2, y - 0.7, z + 1.7, 0.08, 0.08, 0.4, 7, id);
      box(x - 1.2 + hdx, y - 0.7 + hdy, z + 2.05, 0.3, 0.12, 0.18, 13, id);
      emissive(x - 1.2, y - 0.7, z + 2.15, 18, id, 1, 1);
    }
  }
}

/**
 * Procedural animated details for Cinderwake reaver structures (Kinds 60-67).
 */
export function renderCinderwakeBuildingDetails(
  box: BoxFn,
  emissive: EmissiveFn,
  x: number,
  y: number,
  z: number,
  k: number,
  p: number,
  cycle: number,
  sway: number,
  time: number,
  id: number
): void {
  if (p < 0.5) return;

  const fullyBuilt = p >= 0.85;

  if (k === 60) {
    // Pyre Ark: Billowing dark chimney smoke and crackling forge embers
    if (fullyBuilt) {
      for (let j = 0; j < 4; j++) {
        const eq = ((time * 1.2 + j * 0.26) % 1);
        const emX = x - 0.1 + (Math.sin(time * 3 + j) * 0.2);
        const emY = y + (Math.cos(time * 3 + j) * 0.2);
        const emZ = z + 2.1 + eq * 1.8;
        box(emX, emY, emZ, 0.12, 0.12, 0.14, eq < 0.4 ? 27 : eq < 0.7 ? 26 : 24);
      }
      // Rising soot plume from aft stack
      for (let s = 0; s < 4; s++) {
        const sq = ((time * 1.1 + s * 0.27) % 1);
        box(x - 1.4 + sq * 0.5, y + 0.6 + sq * 0.3, z + 2.0 + sq * 2.2, 0.3 + sq * 0.3, 0.3 + sq * 0.3, 0.25, sq < 0.5 ? 2 : 1);
      }
    }
  } else if (k === 61) {
    // Scrap Maw: Grinding tooth rolls and metal scrap sparks
    if (fullyBuilt) {
      const toothAngle = time * 5.0;
      const tdx = Math.sin(toothAngle) * 0.18;
      box(x + 0.45, y - 0.3, z + 0.85 + tdx, 0.25, 0.4, 0.2, 6, id);
      box(x + 0.45, y + 0.3, z + 0.85 - tdx, 0.25, 0.4, 0.2, 6, id);

      // Flying sparks from crusher jaws
      if (cycle < 0.3) {
        for (let s = 0; s < 3; s++) {
          const sa = s * Math.PI * 0.66 + time * 6;
          box(x + 0.5 + Math.cos(sa) * 0.25, y + Math.sin(sa) * 0.25, z + 0.9, 0.08, 0.08, 0.08, 27);
        }
      }
    }
  } else if (k === 62) {
    // Ember Siphon: Rocking walking beam pump jack and pressure relief steam puffs
    if (fullyBuilt) {
      const pumpTilt = Math.sin(time * 2.4) * 0.22;
      // Walking beam rocker arm
      box(x, y, z + 2.2 + pumpTilt, 0.85, 0.18, 0.16, 24, id);
      // Reciprocating polished plunger rod
      box(x + 0.38, y, z + 1.2 - pumpTilt * 1.5, 0.1, 0.1, 1.1, 7, id);
      // Steam relief vent puff
      const ventCycle = (time * 0.8) % 1;
      if (ventCycle < 0.35) {
        const vq = ventCycle / 0.35;
        box(x - 0.4 + vq * 0.3, y + 0.3, z + 1.8 + vq * 1.1, 0.2 + vq * 0.25, 0.2 + vq * 0.25, 0.2, 7);
      }
    }
  } else if (k === 63) {
    // Fang Yard: Perimeter spiked barricades and blazing iron skull brazier
    if (fullyBuilt) {
      // Central roaring brazier
      box(x, y, z + 0.25, 0.5, 0.5, 0.35, 6, id);
      box(x, y, z + 0.6, 0.4, 0.4, 0.2, 26, id);
      emissive(x, y, z + 0.75 + Math.sin(time * 8) * 0.05, 27, id, 2, 2);

      // Hanging trophy cage swaying in the breeze
      const cageSway = sway * 1.5 + Math.sin(time * 1.8) * 0.08;
      box(x - 0.9, y + 0.9, z + 1.6, 0.06, 0.06, 0.7, 19, id);
      box(x - 0.9 + cageSway, y + 0.9, z + 0.9, 0.32, 0.32, 0.42, 23, id);
    }
  } else if (k === 64) {
    // Chainworks: Heavy gantry bridge traversal and spark showers
    if (fullyBuilt) {
      const gantryTravel = Math.sin(time * 0.8) * 0.5;
      box(x + gantryTravel, y - 0.85, z + 2.65, 0.32, 0.3, 0.24, 25, id);
      box(x + gantryTravel, y - 0.85, z + 1.9, 0.07, 0.07, 0.75, 6, id);

      // Hammer strike sparks
      if (Math.sin(time * 3.5) > 0.85) {
        for (let s = 0; s < 3; s++) {
          box(x + 0.6 + (s - 1) * 0.15, y + 0.2, z + 0.6, 0.09, 0.09, 0.09, 27);
        }
      }
    }
  } else if (k === 65) {
    // Soot Nests: Makeshift scrap wind turbine spinning rapidly, chimney smoke
    if (fullyBuilt) {
      const turbSpin = time * 4.0;
      const tdx = Math.cos(turbSpin) * 0.28;
      const tdy = Math.sin(turbSpin) * 0.28;
      // Mast
      box(x - 0.8, y - 0.4, z + 1.4, 0.08, 0.08, 1.2, 19, id);
      // Scrap blades
      box(x - 0.8 + tdx, y - 0.4, z + 2.6 + tdy, 0.35, 0.06, 0.12, 24, id);
      box(x - 0.8 - tdx, y - 0.4, z + 2.6 - tdy, 0.35, 0.06, 0.12, 24, id);

      // Rusted chimney soot puffs
      for (let s = 0; s < 3; s++) {
        const sq = ((time * 1.3 + s * 0.33) % 1);
        box(x + 0.85 + sq * 0.4, y + 0.68 + sq * 0.2, z + 1.9 + sq * 1.8, 0.22 + sq * 0.25, 0.22 + sq * 0.25, 0.2, sq < 0.5 ? 2 : 1);
      }
    }
  } else if (k === 66) {
    // Hook Spire: Leaning harpoon turret scanning horizon & search lantern
    if (fullyBuilt) {
      const aimAngle = Math.sin(time * 0.6) * 0.45;
      const hx = Math.cos(aimAngle) * 0.4;
      const hy = Math.sin(aimAngle) * 0.4;
      // Rotating harpoon mount
      box(x + hx, y + hy, z + 2.4, 0.22, 0.22, 0.25, 25, id);
      box(x + hx * 1.8, y + hy * 1.8, z + 2.45, 0.7, 0.12, 0.12, 6, id);
      // Warning lantern on lookout platform
      emissive(x - 0.3, y - 0.3, z + 1.95, 27, id, 1, 1);
    }
  } else if (k === 67) {
    // Rift Mooring: Accelerator rail magnetic spark discharges & hazard warning strobes
    if (fullyBuilt) {
      // Pulsing magnetic discharge traveling down launch track
      const arcPos = (time * 2.2) % 1;
      const arcX = x - 1.6 + arcPos * 3.2;
      box(arcX, y - 1.05, z + 0.55, 0.2, 0.14, 0.14, 27);
      box(arcX, y + 1.05, z + 0.55, 0.2, 0.14, 0.14, 27);
      emissive(arcX, y - 1.05, z + 0.6, 27, id, 1, 1);
      emissive(arcX, y + 1.05, z + 0.6, 27, id, 1, 1);

      // Alternating hazard strobe beacons on twin gantries
      const strobeSide = Math.floor(time * 3) % 2 === 0;
      if (strobeSide) emissive(x + 1.6, y - 1.05, z + 1.4, 26, id, 2, 2);
      else emissive(x + 1.6, y + 1.05, z + 1.4, 26, id, 2, 2);
    }
  }
}
