/**
 * Starhold Autonomous AI Agent using Local Apple Silicon Laya-MLX Service.
 * Periodically observes the battlefield, requests typed strategic decisions,
 * and executes authoritative simulation commands via sim_command_for.
 */

import {Kind} from '../kinds';
import {isBuildingKind, isUnitKind} from '../hud';

export type Persona = 'codex' | 'claude' | 'gemini';

export interface LayaAgentConfig {
  faction: 0 | 1;
  persona: Persona;
  serviceUrl?: string;
  decisionIntervalTicks?: number;
}

export interface LayaThought {
  faction: 0 | 1;
  persona: Persona;
  thought: string;
  decision: Record<string, any>;
  latencyMs: number;
  tick: number;
}

// Name-to-Kind mapping for Laya decision outputs
const NAME_TO_KIND: Record<string, number> = {
  // Dawnward Units
  riveter: Kind.Riveter,
  pack_beetle: Kind.Beetle,
  ward_sentinel: Kind.Sentinel,
  sunlance: Kind.Sunlance,
  harbor_skiff: Kind.Skiff,
  prism_cantor: Kind.Cantor,
  star_ram: Kind.Ram,
  // Dawnward Buildings
  charter_keep: Kind.Keep,
  freight_court: Kind.Court,
  heliowell: Kind.Well,
  muster_hall: Kind.Hall,
  starforge: Kind.Forge,
  hearth_pods: Kind.Hearth,
  prism_bastion: Kind.Bastion,
  sky_wharf: Kind.Wharf,
  // Cinderwake Units
  ashhand: Kind.Ashhand,
  chain_mule: Kind.Mule,
  hookguard: Kind.Hookguard,
  ash_jackal: Kind.Jackal,
  sootwing: Kind.Sootwing,
  brandcaller: Kind.Brandcaller,
  cinder_strider: Kind.Strider,
  // Cinderwake Buildings
  pyre_ark: Kind.PyreArk,
  scrap_maw: Kind.ScrapMaw,
  ember_siphon: Kind.EmberSiphon,
  fang_yard: Kind.FangYard,
  chainworks: Kind.Chainworks,
  soot_nests: Kind.SootNests,
  hook_spire: Kind.HookSpire,
  rift_mooring: Kind.RiftMooring,
};

// Unit producer kinds
const UNIT_PRODUCERS: Record<number, number> = {
  [Kind.Riveter]: Kind.Keep,
  [Kind.Beetle]: Kind.Court,
  [Kind.Sentinel]: Kind.Hall,
  [Kind.Sunlance]: Kind.Hall,
  [Kind.Skiff]: Kind.Wharf,
  [Kind.Cantor]: Kind.Hall,
  [Kind.Ram]: Kind.Forge,
  [Kind.Ashhand]: Kind.PyreArk,
  [Kind.Mule]: Kind.ScrapMaw,
  [Kind.Hookguard]: Kind.FangYard,
  [Kind.Jackal]: Kind.FangYard,
  [Kind.Sootwing]: Kind.RiftMooring,
  [Kind.Brandcaller]: Kind.FangYard,
  [Kind.Strider]: Kind.Chainworks,
};

export class LayaAgent {
  readonly faction: 0 | 1;
  readonly persona: Persona;
  private serviceUrl: string;
  private decisionIntervalTicks: number;
  private lastDecisionTick = -9999;
  private isDeciding = false;
  private abortController: AbortController | null = null;
  private thoughtListeners: Set<(thought: LayaThought) => void> = new Set();

  constructor(config: LayaAgentConfig) {
    this.faction = config.faction;
    this.persona = config.persona;
    this.serviceUrl = config.serviceUrl ?? 'http://127.0.0.1:5198';
    this.decisionIntervalTicks = config.decisionIntervalTicks ?? 60; // 1 second
  }

  public onThought(listener: (thought: LayaThought) => void): () => void {
    this.thoughtListeners.add(listener);
    return () => this.thoughtListeners.delete(listener);
  }

  public tick(sim: any, entities: Float32Array, worldSide: number, currentTick: number): void {
    if (!sim || typeof sim.sim_command_for !== 'function') return;
    if (this.isDeciding) return;
    if (currentTick - this.lastDecisionTick < this.decisionIntervalTicks) return;

    this.lastDecisionTick = currentTick;
    this.isDeciding = true;

    const summary = this.buildStateSummary(sim, entities, worldSide, currentTick);
    this.requestDecision(summary, currentTick, sim, entities, worldSide);
  }

  private buildStateSummary(sim: any, entities: Float32Array, worldSide: number, tick: number): string {
    const f = this.faction;
    const alloy = typeof sim.sim_faction_alloy === 'function' ? sim.sim_faction_alloy(f) : 0;
    const charge = typeof sim.sim_faction_charge === 'function' ? sim.sim_faction_charge(f) : 0;
    const pop = typeof sim.sim_faction_pop === 'function' ? sim.sim_faction_pop(f) : 0;
    const popCap = typeof sim.sim_faction_pop_cap === 'function' ? sim.sim_faction_pop_cap(f) : 0;
    const age = typeof sim.sim_faction_age === 'function' ? sim.sim_faction_age(f) : 0;

    let myWorkers = 0;
    let myMilitary = 0;
    let myBuildings = 0;
    let enemyUnitsSeen = 0;
    let baseUnderAttack = false;

    const entityCount = entities.length / 12;
    const baseCoords = this.getBaseCoords(entities, worldSide);

    for (let i = 0; i < entityCount; i++) {
      const kind = entities[i * 12 + 4];
      const state = entities[i * 12 + 5];
      const faction = entities[i * 12 + 9];
      if (state === 4) continue; // dead

      if (faction === f) {
        if (isBuildingKind(kind)) myBuildings++;
        else if (isUnitKind(kind)) {
          if (kind === Kind.Riveter || kind === Kind.Ashhand) myWorkers++;
          else myMilitary++;
        }
      } else if (faction === 1 - f) {
        if (isUnitKind(kind)) {
          enemyUnitsSeen++;
          const ex = entities[i * 12];
          const ey = entities[i * 12 + 1];
          const distToBase = Math.hypot(ex - baseCoords.x, ey - baseCoords.y);
          if (distToBase < 16) {
            baseUnderAttack = true;
          }
        }
      }
    }

    const sec = Math.floor(tick / 60);
    return `T=${sec}s. Alloy:${alloy}, Charge:${charge}, Pop:${pop}/${popCap}, Age:${age + 1}. Army:${myMilitary}, Workers:${myWorkers}, Bldgs:${myBuildings}. Enemies seen:${enemyUnitsSeen}. Base under attack:${baseUnderAttack}.`;
  }

  private getBaseCoords(entities: Float32Array, worldSide: number): { x: number; y: number } {
    const hqKind = this.faction === 0 ? Kind.Keep : Kind.PyreArk;
    const count = entities.length / 12;
    for (let i = 0; i < count; i++) {
      if (entities[i * 12 + 4] === hqKind && entities[i * 12 + 9] === this.faction) {
        return { x: entities[i * 12], y: entities[i * 12 + 1] };
      }
    }
    // Fallback based on world size
    const side = worldSide > 0 ? worldSide : 1000;
    return this.faction === 0
      ? { x: side / 5, y: side / 3 }
      : { x: (side * 4) / 5, y: (side * 2) / 3 };
  }

  private async requestDecision(
    stateSummary: string,
    tick: number,
    sim: any,
    entities: Float32Array,
    worldSide: number
  ): Promise<void> {
    try {
      this.abortController = new AbortController();
      const resp = await fetch(`${this.serviceUrl}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: this.persona,
          faction: this.faction,
          state_summary: stateSummary,
        }),
        signal: this.abortController.signal,
      });

      if (!resp.ok) {
        throw new Error(`Laya service responded with ${resp.status}`);
      }

      const data = await resp.json();
      const thought: LayaThought = {
        faction: this.faction,
        persona: this.persona,
        thought: data.thought ?? 'Reviewing battlefield conditions.',
        decision: data.decision ?? {},
        latencyMs: data.latency_ms ?? 0,
        tick,
      };

      this.thoughtListeners.forEach((l) => l(thought));
      this.executeDecision(thought.decision, sim, entities, worldSide);
    } catch (err) {
      // Graceful fallback if service is temporarily unreachable
      console.warn(`[LayaAgent ${this.persona}] Decision error:`, err);
    } finally {
      this.isDeciding = false;
      this.abortController = null;
    }
  }

  private executeDecision(
    decision: Record<string, any>,
    sim: any,
    entities: Float32Array,
    worldSide: number
  ): void {
    const f = this.faction;
    const macro = decision.macro_priority?.choice;
    const unitChoice = decision.train_unit?.choice;
    const structureChoice = decision.build_structure?.choice;
    const stance = decision.combat_stance?.choice;
    const target = decision.assault_target?.choice;

    // 1. Tech Up: advance age if requested
    if (macro === 'tech_up') {
      sim.sim_command_for(f, 2, 0, 0); // op 2: advance age
    }

    // 2. Training
    if (unitChoice) {
      const cleanName = String(unitChoice).toLowerCase().replace(/\s+/g, '_');
      const unitKind = NAME_TO_KIND[cleanName];
      if (unitKind) {
        const producerKind = UNIT_PRODUCERS[unitKind];
        const producerIndex = this.findProducer(entities, producerKind);
        if (producerIndex !== null) {
          sim.sim_command_for(f, 0, unitKind, producerIndex); // op 0: train unit
        }
      }
    }

    // 3. Structure Placement
    if (structureChoice) {
      const cleanName = String(structureChoice).toLowerCase().replace(/\s+/g, '_');
      const structKind = NAME_TO_KIND[cleanName];
      if (structKind) {
        const tile = this.findBuildTile(sim, structKind, entities, worldSide);
        if (tile !== null) {
          sim.sim_command_for(f, 1, structKind, tile); // op 1: build structure
        }
      }
    }

    // 4. Combat / Movement
    const baseCoords = this.getBaseCoords(entities, worldSide);
    const foeSide = worldSide > 0 ? worldSide : 1000;
    const foeCoords = f === 0
      ? { x: (foeSide * 4) / 5, y: (foeSide * 2) / 3 }
      : { x: foeSide / 5, y: foeSide / 3 };

    if (macro === 'all_in_attack' || target === 'enemy_main_base') {
      // Order military group to advance on enemy base
      const fixedX = Math.round(foeCoords.x * 10);
      const fixedY = Math.round(foeCoords.y * 10);
      sim.sim_command_for(f, 4, fixedX, fixedY); // op 4: move group
      sim.sim_command_for(f, 8, 0, 0); // op 8: trigger raid surge
    } else if (target === 'retreat_to_base' || stance === 'defensive') {
      // Fallback defensive posture
      const fixedX = Math.round(baseCoords.x * 10);
      const fixedY = Math.round(baseCoords.y * 10);
      sim.sim_command_for(f, 4, fixedX, fixedY); // op 4: move group
    } else if (target === 'scout_forward' || target === 'neutral_resource_node') {
      // Move to center choke point
      const midX = foeSide / 2;
      const midY = foeSide / 2;
      const fixedX = Math.round(midX * 10);
      const fixedY = Math.round(midY * 10);
      sim.sim_command_for(f, 4, fixedX, fixedY);
    }
  }

  private findProducer(entities: Float32Array, producerKind: number): number | null {
    const count = entities.length / 12;
    for (let i = 0; i < count; i++) {
      if (entities[i * 12 + 4] === producerKind && entities[i * 12 + 9] === this.faction && entities[i * 12 + 5] !== 4) {
        return i;
      }
    }
    return null;
  }

  private findBuildTile(sim: any, kind: number, entities: Float32Array, worldSide: number): number | null {
    const base = this.getBaseCoords(entities, worldSide);
    const side = worldSide > 0 ? worldSide : 1000;
    const bx = Math.floor(base.x);
    const by = Math.floor(base.y);

    // Search outwards in a spiral around base
    for (let r = 3; r <= 10; r += 2) {
      for (let dx = -r; dx <= r; dx += 3) {
        for (let dy = -r; dy <= r; dy += 3) {
          const tx = bx + dx;
          const ty = by + dy;
          if (tx < 4 || tx >= side - 4 || ty < 4 || ty >= side - 4) continue;
          const tile = tx + ty * side;
          const placeable = typeof sim.sim_can_place_for === 'function'
            ? sim.sim_can_place_for(this.faction, kind, tile) === 1
            : true;
          if (placeable) return tile;
        }
      }
    }
    return null;
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isDeciding = false;
  }
}
