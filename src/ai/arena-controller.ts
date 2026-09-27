/**
 * Arena Match Controller for Starhold.
 * Manages game loop updates for AI models (Claude, Codex, Gemini),
 * coordinates network lockstep forwarding, and emits live thought streams for spectators.
 */

import {LayaAgent, LayaThought, Persona} from './laya-agent';
import {LockstepManager} from '../net/lockstep';

export type ControllerType = 'human' | 'codex' | 'claude' | 'gemini' | 'friend';

export interface ArenaControllerOptions {
  p1: ControllerType;
  p2: ControllerType;
  lockstep?: LockstepManager;
  onThought?: (thought: LayaThought) => void;
}

export class ArenaController {
  private p1Type: ControllerType;
  private p2Type: ControllerType;
  private p1Agent: LayaAgent | null = null;
  private p2Agent: LayaAgent | null = null;
  private lockstep: LockstepManager | null = null;
  private active = false;
  private thoughtListeners: Set<(thought: LayaThought) => void> = new Set();
  private unsubs: Array<() => void> = [];

  constructor(options: ArenaControllerOptions) {
    this.p1Type = options.p1;
    this.p2Type = options.p2;
    this.lockstep = options.lockstep ?? null;

    if (options.onThought) {
      this.thoughtListeners.add(options.onThought);
    }

    this.initAgents();
  }

  private initAgents() {
    this.cleanup();

    // Player 1 AI (Dawnward Compact, faction 0)
    if (this.p1Type === 'codex' || this.p1Type === 'claude' || this.p1Type === 'gemini') {
      this.p1Agent = new LayaAgent({
        faction: 0,
        persona: this.p1Type as Persona,
      });
      const unsub = this.p1Agent.onThought((t) => this.broadcastThought(t));
      this.unsubs.push(unsub);
    }

    // Player 2 AI (Cinderwake Reavers, faction 1)
    if (this.p2Type === 'codex' || this.p2Type === 'claude' || this.p2Type === 'gemini') {
      this.p2Agent = new LayaAgent({
        faction: 1,
        persona: this.p2Type as Persona,
      });
      const unsub = this.p2Agent.onThought((t) => this.broadcastThought(t));
      this.unsubs.push(unsub);
    }

    this.active = true;
  }

  public onThought(listener: (thought: LayaThought) => void): () => void {
    this.thoughtListeners.add(listener);
    return () => this.thoughtListeners.delete(listener);
  }

  private broadcastThought(thought: LayaThought) {
    this.thoughtListeners.forEach((l) => l(thought));
  }

  public tick(sim: any, entities: Float32Array, worldSide: number, currentTick: number): void {
    if (!this.active || !sim) return;

    if (this.p1Agent) {
      this.p1Agent.tick(sim, entities, worldSide, currentTick);
    }
    if (this.p2Agent) {
      this.p2Agent.tick(sim, entities, worldSide, currentTick);
    }
  }

  public getP1Type(): ControllerType {
    return this.p1Type;
  }

  public getP2Type(): ControllerType {
    return this.p2Type;
  }

  public isSpectator(): boolean {
    return this.p1Type !== 'human' && this.p2Type !== 'human';
  }

  public getLockstep(): LockstepManager | null {
    return this.lockstep;
  }

  public isActive(): boolean {
    return this.active;
  }

  public cleanup(): void {
    this.p1Agent?.stop();
    this.p2Agent?.stop();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.p1Agent = null;
    this.p2Agent = null;
    this.active = false;
  }
}
