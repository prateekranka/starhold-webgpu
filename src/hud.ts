// Starhold wave-2 bottom HUD bar (docs/MATCH_SPEC.md §7, §10).
// DOM only: nothing here draws into the canvas. Every label comes from the sim
// ABI or src/kinds.ts, and the markup lives in index.html — this module fills it
// and diffs every write, so a frame that changes nothing touches nothing.
import {Kind, State, names, ageNames, factionNames} from './kinds';

/** Headquarters population capacity, docs/MATCH_SPEC.md §4. Only used when the
 *  wasm build predates the wave-2 ABI. */
export const HQ_POP_CAP = 15;
const PAGE_SIZE = 4;            // action buttons per chevron page
const ROSTER_STRIDE = 8;        // docs/MATCH_SPEC.md §3
const EMPTY: readonly RosterRow[] = [];

/** Frozen ABI plus the wave-2 additions (docs/MATCH_SPEC.md §2). The additive
 *  members are optional: the wasm build can lag the front-end, so every call
 *  site feature-checks before it calls. */
export interface SimAbi {
  memory: WebAssembly.Memory;
  sim_init(seed: number): void;
  sim_step(dt: number): void;
  sim_entity_count(): number;
  sim_entity_ptr(): number;
  sim_entity_stride(): number;
  sim_select(index: number): void;
  sim_select_add?(index: number): void;
  sim_select_clear?(): void;
  sim_terrain_ptr(): number;
  sim_alloy(): number;
  sim_charge(): number;
  sim_match_init?(seed: number, faction: number): void;
  sim_mode?(): number;
  sim_outcome?(): number;       // 0 none, 1 defeat, 2 victory (sim-authoritative)
  sim_outcome_tick?(): number;
  sim_player?(): number;
  sim_age?(): number;
  sim_age_progress?(): number;
  sim_age_cost?(): number;
  sim_age_cost_charge?(): number;
  sim_pop_used?(): number;
  sim_pop_cap?(): number;
  sim_command?(op: number, a: number, b: number): number;
  sim_roster_count?(): number;
  sim_roster_ptr?(): number;
  sim_can_train?(kind: number): number;
  sim_can_build?(kind: number): number;
  sim_can_place?(kind: number, tile: number): number;
  sim_build_extent?(kind: number, axis: number): number;
  sim_selected_token?(): number;
  sim_build_builder?(tile: number): number;
  sim_builder_ready?(token: number): number;
  /** Expansive world (LARGEMAP_SPEC §4): 0 when the showcase is running. */
  sim_world_size?(): number;
  sim_world_ptr?(): number;
  sim_metres_per_tile?(): number;
  sim_base_x?(faction: number): number;
  sim_base_y?(faction: number): number;
  sim_raid_active?(): number;
  sim_raid_lane?(): number;
  sim_raid_breach?(): number;
  sim_raid_eta?(): number;
  sim_corridor_wp?(lane: number, wp: number, coord: number): number;
}

/** One roster row, docs/MATCH_SPEC.md §3. */
export interface RosterRow {
  kind: number;
  faction: number;
  tier: number;
  klass: number;
  producer: number;
  alloy: number;
  charge: number;
  pop: number;
}

/** Everything the bar shows for one frame. main.ts owns the sim, so it owns the
 *  values; the bar keeps the object and reads it again when a button is clicked. */
export interface HudView {
  ready: boolean;
  match: boolean;              // the wave-2 ABI is present
  mode: number;                // 0 showcase, 1 match
  outcome: number;             // display only; never derived from entity counts
  player: number;              // 0 Dawnward, 1 Cinderwake
  age: number;
  ageProgress: number;         // 0..1 while a tier advance runs, else 1
  ageCost: number;
  ageCostCharge: number;
  alloy: number;
  charge: number;
  popUsed: number;
  popCap: number;
  selected: number | null;     // snapshot index into the entity array
  selectedKind: number | null;
  selectedState: number;
  tile: number;                // placement tile for a build command
  placementKind: number | null;
  placementValid: boolean;
}

export interface HudWiring {
  command: (op: number, a: number, b: number) => number;
  build: (kind: number) => number;
  startMatch: (faction: 0 | 1) => void;
  resetShowcase: () => void;
}

// --- kind registries (mirrors src/kinds.ts; explicit, never a range check) ----
export const BUILDING_KINDS: readonly number[] = [
  Kind.Keep, Kind.Court, Kind.Well, Kind.Hall, Kind.Forge, Kind.Hearth, Kind.Bastion, Kind.Wharf,
  Kind.PyreArk, Kind.ScrapMaw, Kind.EmberSiphon, Kind.FangYard, Kind.Chainworks, Kind.SootNests, Kind.HookSpire, Kind.RiftMooring,
];
export const UNIT_KINDS: readonly number[] = [
  Kind.Riveter, Kind.Beetle, Kind.Sentinel, Kind.Sunlance, Kind.Skiff, Kind.Cantor, Kind.Ram,
  Kind.Jackal, Kind.Strider, Kind.Ashhand, Kind.Mule, Kind.Hookguard, Kind.Sootwing, Kind.Brandcaller,
];
export function isBuildingKind(kind: number): boolean { return BUILDING_KINDS.includes(kind); }
export function isUnitKind(kind: number): boolean { return UNIT_KINDS.includes(kind); }

// --- roster table -------------------------------------------------------------
const rosterRows: RosterRow[] = [];
let rosterView: Float32Array | null = null;
let rosterKey = '';

/** The roster table (docs/MATCH_SPEC.md §3) in the sim's own row order. The
 *  typed view and the row objects are pooled, so a steady frame allocates
 *  nothing. Returns [] when the ABI is absent or the table is not readable. */
export function readRoster(sim: SimAbi | undefined): readonly RosterRow[] {
  if (!sim || typeof sim.sim_roster_count !== 'function' || typeof sim.sim_roster_ptr !== 'function') return EMPTY;
  const count = sim.sim_roster_count();
  const pointer = sim.sim_roster_ptr();
  const bytes = sim.memory.buffer.byteLength;
  if (count <= 0 || pointer <= 0 || pointer + count * ROSTER_STRIDE * 4 > bytes) return EMPTY;
  const key = `${pointer}:${count}:${bytes}`;
  if (!rosterView || rosterKey !== key) {
    try {
      rosterView = new Float32Array(sim.memory.buffer, pointer, count * ROSTER_STRIDE);
    } catch {
      rosterView = null;
      rosterKey = '';
      return EMPTY;
    }
    rosterKey = key;
  }
  while (rosterRows.length < count) rosterRows.push({kind: 0, faction: 0, tier: 0, klass: 0, producer: 0, alloy: 0, charge: 0, pop: 0});
  if (rosterRows.length > count) rosterRows.length = count;
  for (let i = 0; i < count; i++) {
    const row = rosterRows[i];
    const o = i * ROSTER_STRIDE;
    row.kind = rosterView[o];
    row.faction = rosterView[o + 1];
    row.tier = rosterView[o + 2];
    row.klass = rosterView[o + 3];
    row.producer = rosterView[o + 4];
    row.alloy = rosterView[o + 5];
    row.charge = rosterView[o + 6];
    row.pop = rosterView[o + 7];
  }
  return rosterRows;
}

const label = (kind: number): string => names[kind] ?? `KIND ${kind}`;
const costLabel = (alloy: number, charge: number): string => charge > 0 ? `${alloy}A ${charge}C` : `${alloy}A`;
const costWords = (row: RosterRow): string => {
  const parts = [`${row.alloy} alloy`];
  if (row.charge > 0) parts.push(`${row.charge} charge`);
  if (row.pop > 0) parts.push(`${row.pop} population`);
  return parts.join(', ');
};

/** Action rows for the current selection, straight from the roster table and
 *  the sim's own gating (docs/MATCH_SPEC.md §7): train buttons for a completed
 *  building, build buttons for a completed worker. */
function candidates(sim: SimAbi | undefined, view: HudView): readonly RosterRow[] {
  const rows = readRoster(sim);
  if (rows.length === 0 || view.selectedKind === null) return EMPTY;
  const player = view.player;
  if (isBuildingKind(view.selectedKind)) {
    if (view.selectedState === State.Construct || view.selectedState === State.Death) return EMPTY;
    // The roster producer field is authoritative. A building with no matching
    // rows has no production action; do not fill its HUD with disabled units.
    return rows.filter((row) => row.faction === player && row.klass === 1
      && row.producer === view.selectedKind).slice();
  }
  if (view.selectedKind === Kind.Riveter || view.selectedKind === Kind.Ashhand) {
    if (view.selectedState === State.Death) return EMPTY;
    return rows.filter((row) => row.faction === player && row.klass === 0).slice();
  }
  return EMPTY;
}

/** The DOM bottom bar. Built once, updated per frame from a HudView. */
export class Hud {
  private readonly wiring: HudWiring;
  private readonly alloyValue: HTMLElement;
  private readonly chargeValue: HTMLElement;
  private readonly popValue: HTMLElement;
  private readonly skirmish: HTMLElement;
  private readonly faction: HTMLElement;
  private readonly ageCluster: HTMLElement;
  private readonly ageName: HTMLElement;
  private readonly ageProgress: HTMLElement;
  private readonly ageFill: HTMLElement;
  private readonly ageCost: HTMLElement;
  private readonly advance: HTMLButtonElement;
  private readonly reset: HTMLButtonElement;
  private readonly matchEnd: HTMLDialogElement;
  private readonly endTitle: HTMLElement;
  private readonly endText: HTMLElement;
  private readonly newMatch: HTMLButtonElement;
  private lastOutcome = 0;
  private readonly starts: HTMLButtonElement[];
  private readonly list: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly texts = new Map<HTMLElement, string>();
  private view: HudView;
  private sim: SimAbi | undefined;
  private rows: readonly RosterRow[] = EMPTY;
  /** True when the current selection has an unfinished order to cancel. */
  private cancelable = false;
  private key = '';
  private page = 0;
  private readonly alloyRate: HTMLElement;
  private readonly chargeRate: HTMLElement;
  private buttonRows: RosterRow[] = [];
  private history: Array<{ alloy: number; charge: number; time: number }> = [];
  private lastSampleTime = 0;
  private lastMode = -1;
  private buttons: HTMLButtonElement[] = [];
  private kinds: number[] = [];
  private buildFlags: boolean[] = [];
  private enabledFlags: boolean[] = [];
  private lastAlloy = -1;
  private lastCharge = -1;
  private lastPop = '';
  private lastPlayer = -1;
  private lastAge = -1;
  private lastPercent = -1;
  private lastCost = '';

  constructor(wiring: HudWiring) {
    this.wiring = wiring;
    const pick = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
    this.alloyValue = pick('hud-alloy-value');
    this.chargeValue = pick('hud-charge-value');
    this.popValue = pick('hud-pop-value');
    const alloyParent = pick('hud-alloy');
    let alloyRate = document.getElementById('hud-alloy-rate');
    if (!alloyRate) {
      alloyRate = document.createElement('span');
      alloyRate.id = 'hud-alloy-rate';
      alloyRate.className = 'r';
      alloyParent.append(document.createTextNode(' '), alloyRate);
    }
    this.alloyRate = alloyRate;
    const chargeParent = pick('hud-charge');
    let chargeRate = document.getElementById('hud-charge-rate');
    if (!chargeRate) {
      chargeRate = document.createElement('span');
      chargeRate.id = 'hud-charge-rate';
      chargeRate.className = 'r';
      chargeParent.append(document.createTextNode(' '), chargeRate);
    }
    this.chargeRate = chargeRate;
    this.skirmish = pick('hud-skirmish');
    this.faction = pick('hud-faction');
    this.ageCluster = pick('hud-age');
    this.ageName = pick('hud-age-name');
    this.ageProgress = pick('hud-age-progress');
    this.ageFill = pick('hud-age-fill');
    this.ageCost = pick('hud-age-cost');
    this.advance = pick('hud-advance') as HTMLButtonElement;
    this.reset = pick('hud-reset') as HTMLButtonElement;
    this.matchEnd = pick('match-end') as HTMLDialogElement;
    this.endTitle = pick('match-end-title');
    this.endText = pick('match-end-text');
    this.newMatch = pick('match-end-new') as HTMLButtonElement;
    this.matchEnd.addEventListener('cancel', (event) => event.preventDefault());
    this.newMatch.addEventListener('click', () => {
      const outcome = this.sim?.sim_outcome?.();
      if (this.sim?.sim_mode?.() !== 1 || (outcome !== 1 && outcome !== 2)) return;
      this.wiring.startMatch(this.sim.sim_player?.() === 1 ? 1 : 0);
    });
    this.starts = [pick('hud-start-0') as HTMLButtonElement, pick('hud-start-1') as HTMLButtonElement];
    this.list = pick('hud-action-list');
    this.prev = pick('hud-prev') as HTMLButtonElement;
    this.next = pick('hud-next') as HTMLButtonElement;
    this.status = pick('hud-status');
    // Seed the text cache from the markup so the first update only writes what
    // actually differs (index.html starts at "MATCH UNAVAILABLE").
    for (const element of [this.alloyValue, this.chargeValue, this.popValue, this.faction, this.ageName, this.ageCost, this.status, this.alloyRate, this.chargeRate]) {
      this.texts.set(element, element.textContent ?? '');
    }
    this.view = {
      ready: false, match: false, mode: 0, outcome: 0, player: 0, age: 0, ageProgress: 1, ageCost: 0, ageCostCharge: 0,
      alloy: 0, charge: 0, popUsed: 0, popCap: 0, selected: null, selectedKind: null, selectedState: -1, tile: 0, placementKind: null, placementValid: false,
    };
    // One delegated listener: the action buttons are rebuilt per selection.
    pick('hud-bar').addEventListener('click', (event) => this.click(event));
  }

  /** Kinds of the action buttons that are enabled right now, in bar order.
   *  This is what window.__APP.getState().actions reports. */
  actions(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.kinds.length; i++) if (this.enabledFlags[i]) out.push(this.kinds[i]);
    return out;
  }

  update(sim: SimAbi | undefined, view: HudView): void {
    this.view = view;
    this.sim = sim;
    const match = view.match && !!sim;
    const inMatch = match && view.mode === 1;
    // Native modality blocks pointer/keyboard input behind the panel without
    // participating in the bar layout. Only a flag transition touches its DOM.
    const outcome = inMatch ? view.outcome : 0;
    if (outcome !== this.lastOutcome) {
      this.lastOutcome = outcome;
      const ended = outcome === 1 || outcome === 2;
      this.newMatch.disabled = !ended;
      if (ended) {
        this.setText(this.endTitle, outcome === 1 ? 'DEFEAT' : 'VICTORY');
        this.setText(this.endText, outcome === 1
          ? 'All your units and buildings have been destroyed.'
          : 'All enemy units and buildings have been destroyed.');
        if (!this.matchEnd.open) this.matchEnd.showModal();
      } else if (this.matchEnd.open) this.matchEnd.close();
    }

    // Left: ALLOY / CHARGE / POP used/cap.
    if (this.lastAlloy !== view.alloy) { this.lastAlloy = view.alloy; this.setText(this.alloyValue, String(view.alloy)); }
    if (this.lastCharge !== view.charge) { this.lastCharge = view.charge; this.setText(this.chargeValue, String(view.charge)); }
    const pop = `${view.popUsed}/${view.popCap}`;
    if (this.lastPop !== pop) { this.lastPop = pop; this.setText(this.popValue, pop); }

    // Track resource delta over the last 60 ticks (1 second).
    if (this.lastMode !== view.mode || this.lastPlayer !== view.player) {
      this.lastMode = view.mode;
      this.history = [];
      this.lastSampleTime = 0;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.history.length === 0 || now - this.lastSampleTime >= 12) {
      this.lastSampleTime = now;
      this.history.push({ alloy: view.alloy, charge: view.charge, time: now });
      if (this.history.length > 60) {
        this.history.shift();
      }
    } else {
      this.history[this.history.length - 1] = { alloy: view.alloy, charge: view.charge, time: now };
    }
    while (this.history.length > 1 && now - this.history[0].time > 1050) {
      this.history.shift();
    }
    const oldest = this.history[0];
    const elapsedSec = oldest ? (now - oldest.time) / 1000 : 0;
    const canRate = this.history.length >= 2 && elapsedSec >= 0.1;
    const rateAlloy = canRate ? (view.alloy - oldest.alloy) / elapsedSec : 0;
    const rateCharge = canRate ? (view.charge - oldest.charge) / elapsedSec : 0;
    const alloyRateVal = Number(rateAlloy.toFixed(1));
    const alloyRateText = alloyRateVal > 0 ? `(+${rateAlloy.toFixed(1)}/s)` : '';
    this.setText(this.alloyRate, alloyRateText);
    const chargeRateVal = Number(rateCharge.toFixed(1));
    const chargeRateText = chargeRateVal > 0 ? `(+${rateCharge.toFixed(1)}/s)` : '';
    this.setText(this.chargeRate, chargeRateText);

    // Middle: SKIRMISH in showcase mode, faction + age + RESET in match mode.
    this.setOff(this.skirmish, inMatch);
    this.setOff(this.faction, !inMatch);
    this.setOff(this.ageCluster, !inMatch);
    this.setOff(this.reset, !inMatch);
    if (this.reset.disabled !== !inMatch) this.reset.disabled = !inMatch;
    for (const button of this.starts) if (button.disabled !== (inMatch || !match)) button.disabled = inMatch || !match;
    if (this.lastPlayer !== view.player) {
      this.lastPlayer = view.player;
      this.setText(this.faction, factionNames[view.player] ?? '—');
    }
    const age = view.age >= 0 && view.age < ageNames.length ? Math.floor(view.age) : 0;
    if (this.lastAge !== age) { this.lastAge = age; this.setText(this.ageName, ageNames[age]); }
    const percent = inMatch ? Math.round(Math.max(0, Math.min(1, view.ageProgress)) * 100) : 0;
    const advancing = inMatch && percent < 100;
    if (this.lastPercent !== percent) {
      this.lastPercent = percent;
      this.ageFill.style.width = `${percent}%`;
      this.ageProgress.setAttribute('aria-valuenow', String(percent));
    }
    this.setOff(this.ageProgress, !advancing);
    const cost = Math.max(0, Math.round(view.ageCost));
    const costCharge = Math.max(0, Math.round(view.ageCostCharge));
    const showAdvance = inMatch && cost > 0;
    this.setOff(this.advance, !showAdvance);
    const disabled = !showAdvance || view.alloy < cost || view.charge < costCharge;
    if (this.advance.disabled !== disabled) this.advance.disabled = disabled;
    const costText = showAdvance && !advancing ? `${cost}A ${costCharge}C` : '';
    if (this.lastCost !== costText) { this.lastCost = costText; this.setText(this.ageCost, costText); }
    this.setOff(this.ageCost, costText === '');

    // Right: context actions for the current selection, from the roster table.
    // A construction site in progress also offers CANCEL, so the cancel flag is
    // part of the key that decides whether the button set must be rebuilt.
    const cancelable = inMatch && (view.selectedState === State.Construct || view.placementKind !== null);
    const key = `${match ? 1 : 0}|${inMatch ? 1 : 0}|${view.player}|${view.selected ?? -1}|${view.selectedKind ?? -1}|${view.selectedState}|${view.placementKind}`;
    if (key !== this.key || cancelable !== this.cancelable) {
      this.key = key;
      this.cancelable = cancelable;
      this.rows = inMatch ? candidates(sim, view).filter((row) => row.kind !== view.placementKind) : EMPTY;
      this.page = 0;
      this.build();
    }
    this.sync(sim);
    const status = this.statusText(match, inMatch);
    this.setText(this.status, status);
    this.setOff(this.status, status === '');
  }

  private statusText(match: boolean, inMatch: boolean): string {
    if (!match) return 'MATCH UNAVAILABLE';
    if (!inMatch) return '';
    if (this.view.placementKind !== null) return this.view.placementValid ? 'TAP TO BUILD' : 'BLOCKED';
    if (this.view.selectedKind === null) return 'NO SELECTION';
    if (this.cancelable) return 'UNDER CONSTRUCTION';
    if (this.rows.length === 0) {
      const k = this.view.selectedKind;
      if (k === 12) return 'HELIOWELL — GENERATES +1 CHARGE / S — TETHER SOURCE';
      if (k === 62) return 'EMBER SIPHON — GENERATES +1 CHARGE / S — PYRE TETHER';
      if (k === 15 || k === 65) return 'HABITATION — PROVIDES +5 POPULATION';
      if (k === 40) return 'RICH ALLOY DEPOSIT — GATHERABLE BY WORKERS';
      if (k === 22 || k === 23 || k === 26 || k === 30 || k === 31 || k === 34) return 'COMBAT READY — DEFENDS PERIMETER';
      if (k === 20 || k === 32) return 'WORKER UNIT — GATHERS AND BUILDS';
      if (k === 21 || k === 33) return 'CARRIER UNIT — HAULS ALLOY';
      return 'NO ACTIONS';
    }
    return '';
  }

  private disabledReason(row: RosterRow): string {
    if (this.view.alloy < row.alloy) return `Need ${row.alloy - this.view.alloy} more Alloy`;
    if (this.view.charge < row.charge) return `Need ${row.charge - this.view.charge} more Charge`;
    if (row.klass === 1 && (this.view.popUsed >= this.view.popCap || this.view.popUsed + (row.pop || 1) > this.view.popCap)) {
      return `Population limit reached (${this.view.popUsed}/${this.view.popCap})`;
    }
    const build = row.klass === 0;
    return `${build ? 'Build' : 'Train'} ${label(row.kind)}, ${costWords(row)}`;
  }

  /** Rebuild the visible page of action buttons. Only called when the action
   *  set changes (a new selection, a mode change, or a page turn). */
  private build(): void {
    this.list.textContent = '';
    this.buttons = [];
    this.kinds = [];
    this.buttonRows = [];
    this.buildFlags = [];
    this.enabledFlags = [];
    // A selected construction site offers CANCEL: the simulation refunds a
    // cancelled order in full (MATCH_SPEC §5, command op 3) and until now no
    // control ever sent it, so a misplaced site could only be waited out.
    if (this.cancelable) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.dataset.action = 'cancel';
      const name = document.createElement('span');
      name.className = 'n';
      name.textContent = 'CANCEL';
      const cost = document.createElement('span');
      cost.className = 'c';
      cost.textContent = this.view.placementKind !== null ? 'NO COST' : 'REFUND';
      cancel.append(name, cost);
      const cancelLabel = this.view.placementKind !== null ? 'Cancel placement, no cost' : 'Cancel this construction, full refund';
      cancel.setAttribute('aria-label', cancelLabel);
      cancel.title = cancelLabel;
      this.list.append(cancel);
    }
    const pageSize = this.pageSize();
    const start = this.page * pageSize;
    const stop = Math.min(start + pageSize, this.rows.length);
    for (let i = start; i < stop; i++) {
      const row = this.rows[i];
      const build = row.klass === 0;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = build ? 'build' : 'train';
      button.dataset.kind = String(row.kind);
      const name = document.createElement('span');
      name.className = 'n';
      name.textContent = label(row.kind);
      const cost = document.createElement('span');
      cost.className = 'c';
      cost.textContent = costLabel(row.alloy, row.charge);
      button.append(name, cost);
      const accessible = `${build ? 'Build' : 'Train'} ${label(row.kind)}, ${costWords(row)}`;
      button.setAttribute('aria-label', accessible);
      button.disabled = true;
      button.title = this.disabledReason(row);
      this.list.append(button);
      this.buttons.push(button);
      this.kinds.push(row.kind);
      this.buttonRows.push(row);
      this.buildFlags.push(build);
      this.enabledFlags.push(false);
    }
    const pages = Math.max(1, Math.ceil(this.rows.length / this.pageSize()));
    this.setOff(this.prev, pages <= 1);
    this.setOff(this.next, pages <= 1);
    this.prev.disabled = pages <= 1 || this.page <= 0;
    this.next.disabled = pages <= 1 || this.page >= pages - 1;
  }

  /** Refresh enablement from sim_can_train / sim_can_build every frame. */
  private sync(sim: SimAbi | undefined): void {
    for (let i = 0; i < this.buttons.length; i++) {
      const kind = this.kinds[i];
      const row = this.buttonRows[i];
      let enabled = false;
      if (sim) {
        if (this.buildFlags[i]) enabled = typeof sim.sim_can_build === 'function' && sim.sim_can_build(kind) !== 0;
        else enabled = typeof sim.sim_can_train === 'function' && sim.sim_can_train(kind) !== 0;
      }
      if (this.enabledFlags[i] !== enabled) {
        this.enabledFlags[i] = enabled;
        this.buttons[i].disabled = !enabled;
      }
      if (row) {
        const build = this.buildFlags[i];
        const accessible = `${build ? 'Build' : 'Train'} ${label(row.kind)}, ${costWords(row)}`;
        const title = enabled ? accessible : this.disabledReason(row);
        if (this.buttons[i].title !== title) {
          this.buttons[i].title = title;
        }
      }
    }
  }

  private pageSize(): number { return this.cancelable ? PAGE_SIZE - 1 : PAGE_SIZE; }

  private turn(delta: number): void {
    const pages = Math.max(1, Math.ceil(this.rows.length / this.pageSize()));
    const page = Math.min(pages - 1, Math.max(0, this.page + delta));
    if (page === this.page) return;
    this.page = page;
    this.build();
    this.sync(this.sim);
  }

  private click(event: Event): void {
    const target = event.target as HTMLElement | null;
    const button = target ? (target.closest('button') as HTMLButtonElement | null) : null;
    if (!button || button.disabled) return;
    const page = button.dataset.page;
    if (page) { this.turn(page === '-1' ? -1 : 1); return; }
    const action = button.dataset.action;
    const kind = Number(button.dataset.kind ?? '0');
    if (action === 'match') this.wiring.startMatch(kind === 1 ? 1 : 0);
    else if (action === 'reset') this.wiring.resetShowcase();
    else if (action === 'advance') this.wiring.command(2, 0, 0);
    else if (action === 'train') this.wiring.command(0, kind, this.view.selected ?? 0);
    else if (action === 'build') this.wiring.build(kind);
    else if (action === 'cancel') this.wiring.command(3, 0, 0);
  }

  private setText(element: HTMLElement, value: string): void {
    if (this.texts.get(element) === value) return;
    this.texts.set(element, value);
    element.textContent = value;
  }

  private setOff(element: HTMLElement, off: boolean): void {
    if (element.classList.contains('off') !== off) element.classList.toggle('off', off);
  }
}
