// Campaign Scenario Engine for Starhold.
// Delivers narrative skirmish operations with dedicated objectives and live trackers.

export interface ScenarioObjective {
  id: string;
  description: string;
  completed: boolean;
  progress?: string;
}

export interface CampaignScenario {
  id: number;
  title: string;
  codename: string;
  subtitle: string;
  briefing: string;
  faction: 0 | 1; // 0: Dawnward, 1: Cinderwake
  targetKind?: number;
  objectives: ScenarioObjective[];
}

export const CAMPAIGN_SCENARIOS: CampaignScenario[] = [
  {
    id: 1,
    title: 'Operation 1: Frontier Landing',
    codename: 'FIRST HARBOR',
    subtitle: 'Establish the Forward Colony',
    briefing: 'Establish the Charter Keep colony, deploy power Heliowells, and defend against early Cinderwake scouting parties.',
    faction: 0,
    objectives: [
      { id: 'keep', description: 'Establish Charter Keep headquarters', completed: false },
      { id: 'power', description: 'Power 2 Heliowells for charge generation', completed: false, progress: '0/2' },
      { id: 'scouts', description: 'Survive first raider scout wave', completed: false }
    ]
  },
  {
    id: 2,
    title: 'Operation 2: Canyon Breach',
    codename: 'IRON CORRIDOR',
    subtitle: 'Advance Through the Choke Point',
    briefing: 'Construct a Starforge, produce a vanguard of 4 Ward Sentinels and 2 Sunlances, and push through the fortified canyon pass.',
    faction: 0,
    objectives: [
      { id: 'forge', description: 'Construct Starforge heavy foundry', completed: false },
      { id: 'squad', description: 'Assemble frontline army (4 Sentinels, 2 Sunlances)', completed: false, progress: '0/6' },
      { id: 'push', description: 'Repel enemy defense outpost at the pass', completed: false }
    ]
  },
  {
    id: 3,
    title: 'Operation 3: Clash of the Titans',
    codename: 'CINDERFALL',
    subtitle: 'Neutralize the Pyre Ark',
    briefing: 'Launch a full-scale assault against the Cinderwake stronghold, defeat the heavy Cinder Strider walker, and destroy the Pyre Ark.',
    faction: 0,
    objectives: [
      { id: 'army', description: 'Mobilize heavy siege armor and strike crafts', completed: false },
      { id: 'strider', description: 'Destroy the enemy Cinder Strider titan', completed: false },
      { id: 'ark', description: 'Obliterate the Cinderwake Pyre Ark command barge', completed: false }
    ]
  }
];

class ScenarioManager {
  private activeScenario: CampaignScenario | null = null;

  getActiveScenario(): CampaignScenario | null {
    return this.activeScenario;
  }

  startScenario(id: number): CampaignScenario | null {
    const s = CAMPAIGN_SCENARIOS.find(sc => sc.id === id);
    if (!s) return null;
    this.activeScenario = {
      ...s,
      objectives: s.objectives.map(o => ({ ...o, completed: false }))
    };
    if (typeof window !== 'undefined' && window.__APP) {
      window.__APP.startMatch(s.faction);
    }
    this.renderObjectiveHud();
    return this.activeScenario;
  }

  clearScenario() {
    this.activeScenario = null;
    this.renderObjectiveHud();
  }

  updateProgress(entities: Float32Array, entityCount: number, player: number, waves: number, outcome: number) {
    if (!this.activeScenario) return;
    const s = this.activeScenario;

    if (s.id === 1) {
      let hasKeep = false;
      let wells = 0;
      for (let i = 0; i < entityCount; i++) {
        const k = entities[i * 12 + 4];
        const f = entities[i * 12 + 9];
        const p = entities[i * 12 + 10];
        if (f === player && p >= 1.0) {
          if (k === 10) hasKeep = true;
          if (k === 12) wells++;
        }
      }
      s.objectives[0].completed = hasKeep;
      s.objectives[1].completed = wells >= 2;
      s.objectives[1].progress = `${Math.min(2, wells)}/2`;
      s.objectives[2].completed = waves >= 1;
    } else if (s.id === 2) {
      let hasForge = false;
      let sentinels = 0, sunlances = 0;
      for (let i = 0; i < entityCount; i++) {
        const k = entities[i * 12 + 4];
        const f = entities[i * 12 + 9];
        const p = entities[i * 12 + 10];
        const hp = entities[i * 12 + 7];
        if (f === player && hp > 0) {
          if (k === 14 && p >= 1.0) hasForge = true;
          if (k === 22) sentinels++;
          if (k === 23) sunlances++;
        }
      }
      s.objectives[0].completed = hasForge;
      const totalUnits = Math.min(4, sentinels) + Math.min(2, sunlances);
      s.objectives[1].completed = sentinels >= 4 && sunlances >= 2;
      s.objectives[1].progress = `${totalUnits}/6`;
      s.objectives[2].completed = waves >= 2;
    } else if (s.id === 3) {
      let foeStriderAlive = false, foeArkAlive = false;
      for (let i = 0; i < entityCount; i++) {
        const k = entities[i * 12 + 4];
        const f = entities[i * 12 + 9];
        const hp = entities[i * 12 + 7];
        if (f !== player && hp > 0) {
          if (k === 31) foeStriderAlive = true;
          if (k === 60) foeArkAlive = true;
        }
      }
      s.objectives[0].completed = waves >= 1;
      s.objectives[1].completed = !foeStriderAlive && waves >= 1;
      s.objectives[2].completed = outcome === 1 || (!foeArkAlive && waves >= 1);
    }
    this.renderObjectiveHud();
  }

  private renderObjectiveHud() {
    if (typeof document === 'undefined') return;
    let banner = document.getElementById('campaign-objectives');
    if (!this.activeScenario) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'campaign-objectives';
      document.body.appendChild(banner);
    }
    const s = this.activeScenario;
    const allDone = s.objectives.every(o => o.completed);
    banner.className = allDone ? 'completed' : '';
    banner.innerHTML = `
      <div class="co-header">
        <span class="co-tag">MISSION</span>
        <span class="co-title">${s.codename}</span>
      </div>
      <div class="co-list">
        ${s.objectives.map(o => `
          <div class="co-item ${o.completed ? 'done' : ''}">
            <span class="co-check">${o.completed ? '✓' : '○'}</span>
            <span class="co-desc">${o.description}</span>
            ${o.progress ? `<span class="co-prog">${o.progress}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

export const scenarioManager = new ScenarioManager();
