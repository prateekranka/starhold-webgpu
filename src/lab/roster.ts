// Starhold · unit and building lab.
//
// One page that shows every actor in the game: what the design documents promise
// it costs and does, what the simulation actually charges, and what it looks like
// as a proportion diagram. Where the two disagree the card is marked, because a
// document that has drifted from the simulation is a bug in the document.
//
// Sources, in order of authority: the simulation (`public/sim.wasm`, read live),
// then docs/CIVILIZATIONS.md for roles, costs, times, footprints and HP, then
// docs/UNIT_DESIGN.md for silhouette identity and motion. Nothing here is
// hand-copied from a document.
//
// Open it with `npm run dev` and visit /lab.html. It is not part of `npm run build`.
import civDoc from '../../docs/CIVILIZATIONS.md?raw';
import unitDoc from '../../docs/UNIT_DESIGN.md?raw';
import {
  names, factionNames, palette, el, docTables, bold, downloadJSON, loadSim,
  drawSchematic, type DocTable, type RosterRow,
} from './common';

type Group = 'building' | 'unit' | 'prop' | 'effect';

interface Entry {
  kind: number;
  name: string;
  group: Group;
  faction: number;
  tier: string | null;
  role: string | null;
  costDoc: [number, number] | null;
  costSim: [number, number] | null;
  time: string | null;
  popDoc: number | null;
  popSim: number | null;
  footprint: [number, number] | null;
  hp: number | null;
  speed: string | null;
  combat: string | null;
  producer: string | null;
  makes: number[];
  silhouette: string | null;
  motion: string | null;
  sim: RosterRow | null;
  drift: string[];
}

const column = (header: string[], pattern: RegExp) => header.findIndex((h) => pattern.test(h));
const cell = (row: { cells: string[] }, index: number) => (index >= 0 && index < row.cells.length ? row.cells[index] : '');

function groupOf(kind: number): Group {
  if ((kind >= 10 && kind <= 17) || (kind >= 60 && kind <= 67)) return 'building';
  if ((kind >= 20 && kind <= 26) || (kind >= 30 && kind <= 36)) return 'unit';
  if (kind >= 40 && kind <= 43) return 'prop';
  return 'effect';
}

function numbers(cellText: string): [number, number] | null {
  const m = cellText.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function build(): Entry[] {
  const civTables = docTables(civDoc, 'CIVILIZATIONS.md');
  const designTables = docTables(unitDoc, 'UNIT_DESIGN.md');
  const entries = new Map<number, Entry>();

  const entry = (kind: number): Entry => {
    if (!entries.has(kind)) {
      entries.set(kind, {
        kind, name: names[kind] ?? `KIND ${kind}`, group: groupOf(kind), faction: kind >= 30 ? 1 : 0,
        tier: null, role: null, costDoc: null, costSim: null, time: null, popDoc: null, popSim: null,
        footprint: null, hp: null, speed: null, combat: null, producer: null, makes: [],
        silhouette: null, motion: null, sim: null, drift: [],
      });
    }
    return entries.get(kind)!;
  };

  // --- docs/CIVILIZATIONS.md: buildings
  const buildingTable: DocTable | undefined = civTables.find((t) => column(t.header, /building/i) >= 0);
  if (buildingTable) {
    const cKind = 0;
    const cTier = column(buildingTable.header, /tier/i);
    const cName = column(buildingTable.header, /building/i);
    const cFn = column(buildingTable.header, /function/i);
    const cCost = column(buildingTable.header, /cost/i);
    const cTime = column(buildingTable.header, /^time$/i);
    const cFoot = column(buildingTable.header, /footprint/i);
    for (const row of buildingTable.rows) {
      const k = row.cells[cKind];
      if (!/^\d+$/.test(k)) continue;
      const e = entry(Number(k));
      e.tier = cell(row, cTier) || null;
      e.name = bold(cell(row, cName)) ?? e.name;
      e.role = cell(row, cFn) || null;
      e.costDoc = numbers(cell(row, cCost));
      e.time = cell(row, cTime) || null;
      const foot = cell(row, cFoot).match(/(\d+)\s*×\s*(\d+)\s*\/\s*([\d,]+)/);
      if (foot) { e.footprint = [Number(foot[1]), Number(foot[2])]; e.hp = Number(foot[3].replace(/,/g, '')); }
    }
  }

  // --- docs/CIVILIZATIONS.md: units
  const unitTable: DocTable | undefined = civTables.find((t) => column(t.header, /unit/i) >= 0);
  if (unitTable) {
    const cTier = column(unitTable.header, /tier/i);
    const cName = column(unitTable.header, /unit/i);
    const cProducer = column(unitTable.header, /producer/i);
    const cCost = column(unitTable.header, /cost/i);
    const cTrain = column(unitTable.header, /train/i);
    const cRole = column(unitTable.header, /role/i);
    for (const row of unitTable.rows) {
      const k = row.cells[0];
      if (!/^\d+$/.test(k)) continue;
      const e = entry(Number(k));
      e.tier = cell(row, cTier) || null;
      e.name = bold(cell(row, cName)) ?? e.name;
      e.producer = cell(row, cProducer) || null;
      e.costDoc = numbers(cell(row, cCost));
      const train = cell(row, cTrain).match(/([\d.]+)\s*s\s*\/\s*(\d+)/);
      if (train) { e.time = `${train[1]} s`; e.popDoc = Number(train[2]); }
      e.role = cell(row, cRole) || null;
      e.combat = e.role;
      const hp = (e.role ?? '').match(/(\d+)\s*HP/);
      if (hp) e.hp = Number(hp[1]);
      const speed = (e.role ?? '').match(/speed\s*([\d.]+)/);
      if (speed) e.speed = speed[1];
    }
  }

  // --- docs/UNIT_DESIGN.md: silhouette identity and motion
  for (const table of designTables) {
    const cSil = column(table.header, /silhouette/i);
    if (cSil < 0) continue;
    const cIdle = column(table.header, /idle/i);
    const cAttack = column(table.header, /attack|work/i);
    for (const row of table.rows) {
      const e = entry(row.kind);
      e.silhouette = cell(row, cSil) || null;
      const idle = cell(row, cIdle);
      const attack = cell(row, cAttack);
      e.motion = [idle && `idle: ${idle}`, attack && `work: ${attack}`].filter(Boolean).join(' · ') || null;
    }
  }

  // --- the simulation: authority for cost, population and production
  const sim = simHandle;
  for (const row of sim.roster) {
    const e = entry(row.kind);
    e.sim = row;
    e.costSim = [row.alloy, row.charge];
    e.popSim = row.pop;
    if (!names[row.kind]) e.name = `KIND ${row.kind}`;
    if (row.faction >= 0) e.faction = row.faction;
  }
  for (const e of entries.values()) {
    if (e.sim && e.sim.producer > 0) {
      const producer = entries.get(e.sim.producer);
      if (producer) producer.makes.push(e.kind);
    }
  }

  // --- drift: a document that disagrees with the simulation is wrong
  for (const e of entries.values()) {
    if (!e.costDoc || !e.costSim) continue;
    if (e.costDoc[0] !== e.costSim[0] || e.costDoc[1] !== e.costSim[1]) {
      e.drift.push(`cost docs ${e.costDoc[0]}/${e.costDoc[1]} vs sim ${e.costSim[0]}/${e.costSim[1]}`);
    }
    if (e.popDoc !== null && e.popSim !== null && e.popDoc !== e.popSim) {
      e.drift.push(`population docs ${e.popDoc} vs sim ${e.popSim}`);
    }
  }
  return [...entries.values()].sort((a, b) => a.kind - b.kind);
}

// ------------------------------------------------------------------- the page
let simHandle = await loadSim();
let entries = build();

const root = document.querySelector<HTMLElement>('#lab')!;
const state = { query: '', group: 'all' as Group | 'all', faction: 'all' as string, card: 340 };

function matches(e: Entry): boolean {
  if (state.group !== 'all' && e.group !== state.group) return false;
  if (state.faction !== 'all' && String(e.faction) !== state.faction) return false;
  if (!state.query) return true;
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [e.name, e.kind, e.role, e.silhouette, e.motion, e.tier, e.producer, factionNames[e.faction]]
    .filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

function row(dl: HTMLElement, label: string, value: string | null, short = false): void {
  if (!value) return;
  dl.append(el('dt', { text: label }), el('dd', { text: value, class: short ? 'short' : undefined }));
}

function card(e: Entry): HTMLElement {
  const head = el('div', { class: 'card-head' },
    el('h2', { text: e.name }),
    el('span', { class: 'kind', text: `KIND ${e.kind}` }),
  );
  const preview = el('div', { class: 'preview' });
  const canvas = el('canvas');
  preview.append(canvas);

  const dl = el('dl', { class: 'fields' });
  const size = e.footprint ? `${e.footprint[0]}×${e.footprint[1]} tiles` : e.group === 'unit' ? '1×1 tile' : null;
  const costDoc = e.costDoc ? `${e.costDoc[0]} alloy / ${e.costDoc[1]} charge` : null;
  const costSim = e.costSim ? `${e.costSim[0]} alloy / ${e.costSim[1]} charge` : null;
  const costLine = costSim
    ? (costDoc && costDoc !== costSim ? `${costSim}   (docs: ${costDoc})` : costSim)
    : costDoc;
  row(dl, 'Cost', costLine, Boolean(e.drift.find((d) => d.startsWith('cost'))));
  row(dl, 'Time', e.time);
  row(dl, 'Footprint', size);
  row(dl, 'HP', e.hp !== null ? String(e.hp) : null);
  row(dl, 'Speed', e.speed);
  row(dl, 'Population', e.popSim !== null && e.popSim > 0 ? `${e.popSim}` : e.popDoc !== null ? `${e.popDoc}` : null);
  row(dl, 'Producer', e.producer ?? (e.sim && e.sim.producer > 0 ? (names[e.sim.producer] ?? `kind ${e.sim.producer}`) : null));
  row(dl, 'Tier', e.tier);
  row(dl, 'Role', e.role && e.role.length > 90 ? `${e.role.slice(0, 90)}…` : e.role);
  row(dl, 'Sim', e.sim ? `class ${e.sim.klass} · tier ${e.sim.tier} · faction ${factionNames[e.sim.faction] ?? e.sim.faction}` : null);
  if (e.group === 'building') row(dl, 'Makes', e.makes.length ? e.makes.map((k) => names[k] ?? k).join(', ') : 'nothing');

  const notes: HTMLElement[] = [];
  if (e.silhouette) notes.push(el('p', { class: 'note' }, el('b', { text: 'Silhouette: ' }), e.silhouette));
  if (e.motion) notes.push(el('p', { class: 'note' }, el('b', { text: 'Motion: ' }), e.motion));
  if (e.drift.length) notes.push(el('p', { class: 'note' }, el('b', { class: 'drift', text: 'Doc drift: ' }), e.drift.join('; ')));

  const node = el('article', { class: 'card' }, head, preview, dl, ...notes);
  node.dataset.drift = e.drift.length ? 'true' : 'false';
  node.dataset.kind = String(e.kind);
  // Drawn after insertion so the canvas has a measured width.
  queueMicrotask(() => drawSchematic(canvas, e.footprint?.[0] ?? 1, e.footprint?.[1] ?? 1, e.group === 'building' ? (e.footprint && Math.max(...e.footprint) >= 4 ? 3 : 2) : 1, e.faction));
  return node;
}

function render(): void {
  const shown = entries.filter(matches);
  const drifting = entries.filter((e) => e.drift.length);
  root.replaceChildren();

  root.append(el('header', { class: 'lab-head' },
    el('h1', { text: 'Unit and building lab' }),
    el('p', { text: 'Every actor in the game: what the design documents promise, what the simulation charges, and its proportions. Sources are the live wasm build and the docs, parsed at load — nothing is hand-copied.' }),
    el('span', { class: 'badge', text: 'dev only' }),
    el('a', { href: '/', text: 'Open the game ↗' }),
  ));

  const search = el('input', { type: 'search', placeholder: 'Find a unit or building — try keel, ridge, Haul…', value: state.query });
  search.addEventListener('input', () => { state.query = search.value; render(); });
  const chips = el('div', { class: 'chips' });
  const chip = (label: string, active: boolean, onClick: () => void) => {
    const b = el('button', { class: 'chip', text: label, type: 'button' });
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    chips.append(b);
  };
  for (const g of ['all', 'building', 'unit', 'prop', 'effect'] as const) {
    chip(g === 'all' ? 'Everything' : `${g}s`, state.group === g, () => { state.group = g; render(); });
  }
  chip(factionNames[0] ?? 'Dawnward', state.faction === '0', () => { state.faction = state.faction === '0' ? 'all' : '0'; render(); });
  chip(factionNames[1] ?? 'Cinderwake', state.faction === '1', () => { state.faction = state.faction === '1' ? 'all' : '1'; render(); });
  const width = el('input', { type: 'range', min: '320', max: '620', step: '20', value: String(state.card) });
  const widthReadout = el('span', { text: `${state.card}px` });
  width.addEventListener('input', () => {
    state.card = Number(width.value);
    widthReadout.textContent = `${state.card}px`;
    grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${state.card}px, 1fr))`;
  });
  const exportButton = el('button', { class: 'chip', text: 'Export JSON', type: 'button' });
  exportButton.addEventListener('click', () => downloadJSON('starhold-roster.json', { sim: simHandle.build, entries }));
  root.append(el('div', { class: 'toolbar' },
    search, chips,
    el('label', {}, el('span', { text: 'Card width' }), width, widthReadout),
    exportButton,
  ));

  root.append(el('div', { class: 'summary' },
    el('span', {}, el('b', { text: String(shown.length) }), ` of ${entries.length} actors`),
    el('span', {}, el('b', { text: String(entries.filter((e) => e.group === 'building').length) }), ' buildings'),
    el('span', {}, el('b', { text: String(entries.filter((e) => e.group === 'unit').length) }), ' units'),
    el('span', { class: drifting.length ? 'drift' : 'clean' },
      drifting.length
        ? el('span', {}, el('b', { text: String(drifting.length) }), ' doc/sim disagreements — see the red cards')
        : el('span', {}, 'docs agree with the simulation ', el('b', { text: '(0 disagreements)' }))),
    el('span', {}, el('b', { text: String(palette.length) }), ' palette colours'),
    el('span', { text: simHandle.build }),
  ));

  const grid = el('div', { class: 'grid' });
  grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${state.card}px, 1fr))`;
  for (const e of shown) grid.append(card(e));
  root.append(grid);

  const swatches = el('div', { class: 'palette' });
  for (const hex of palette) {
    const s = el('div', { class: 'swatch' });
    s.style.background = `#${hex}`;
    s.append(el('span', { text: hex }));
    swatches.append(s);
  }
  root.append(el('section', {}, el('h2', { text: 'Palette' }), swatches));
  root.append(el('footer', { class: 'lab-foot' },
    'Authority: the simulation (public/sim.wasm, read live) beats docs/CIVILIZATIONS.md beats docs/UNIT_DESIGN.md. A card marked red is a document that has drifted. ',
    el('a', { href: '/lab.html', text: 'reload' }),
  ));
  root.removeAttribute('aria-busy');
}

render();
