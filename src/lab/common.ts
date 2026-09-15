// Shared plumbing for the Starhold development labs. The pattern is borrowed from
// Dimillian/Evergrow's tools layer (game/src/tools/common.ts): every lab is a tiny
// HTML shell plus a module, the lab refuses to run outside `vite dev`, and a lab
// can export what it shows as JSON so a judgement can be audited later.
//
// Labs live outside the production build: `npm run build` emits index.html only,
// because vite only builds the entries it is given. Opening lab.html on a dev
// server is the only way in.
import { palette, names, factionNames, ageNames } from '../kinds.ts';

if (!import.meta.env.DEV) throw new Error('The Starhold lab requires the local development server (npm run dev).');

export { palette, names, factionNames, ageNames };

export function downloadJSON(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string; text?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, text, ...rest } = props as Record<string, unknown>;
  if (className) node.className = className as string;
  if (text !== undefined) node.textContent = text as string;
  Object.assign(node, rest);
  for (const child of children) node.append(child);
  return node;
}

/** A markdown table row whose first cell is a bare integer is a roster row. */
export interface DocRow { kind: number; cells: string[]; table: string; }

export interface DocTable { header: string[]; rows: DocRow[]; table: string; }

/**
 * Every markdown table in a document, with its header row, so a lab can find a
 * column by meaning instead of by position. Column order in the design docs is
 * not part of any contract.
 */
export function docTables(markdown: string, table: string): DocTable[] {
  const tables: DocTable[] = [];
  let header: string[] | null = null;
  let current: { rows: DocRow[] } = { rows: [] };
  const flush = () => { if (header) tables.push({ header, rows: current.rows, table }); header = null; current = { rows: [] }; };
  current = { rows: [] };
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) { flush(); continue; }
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
    if (/^-{2,}$/.test(cells[0]) || cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
    if (!header) { header = cells; continue; }
    if (/^\d+$/.test(cells[0])) current.rows.push({ kind: Number(cells[0]), cells, table });
  }
  flush();
  return tables.filter((t) => t.rows.length > 0);
}

export function parseDocTables(markdown: string, table: string): DocRow[] {
  const rows: DocRow[] = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
    if (!/^\d+$/.test(cells[0])) continue;
    rows.push({ kind: Number(cells[0]), cells, table });
  }
  return rows;
}

/** The first `**Label**` or bold name in a table row, used for the actor's name. */
export function bold(cell: string | undefined): string | null {
  if (!cell) return null;
  const m = cell.match(/\*\*(.+?)\*\*/);
  return m ? m[1] : null;
}

export function matchCell(cells: string[], re: RegExp): RegExpMatchArray | null {
  for (const cell of cells) {
    const m = cell.match(re);
    if (m) return m;
  }
  return null;
}

// ---------------------------------------------------------------------- roster
export interface RosterRow {
  kind: number; faction: number; tier: number; klass: number; producer: number;
  alloy: number; charge: number; pop: number;
}

export interface SimHandle {
  exports: Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };
  roster: RosterRow[];
  rosterStride: number;
  build: string;
}

/**
 * Loads the simulation the game itself ships, so the lab reports the numbers the
 * match actually uses rather than a copy that can drift.
 */
export async function loadSim(): Promise<SimHandle> {
  const response = await fetch('/sim.wasm');
  if (!response.ok) throw new Error(`sim.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  const exports = instance.exports as SimHandle['exports'];
  const stride = 8; // ROSTER_STRIDE in sim/src/lib.rs: kind, faction, tier, klass, producer, alloy, charge, pop
  const count = exports.sim_roster_count ? exports.sim_roster_count() : 0;
  const roster: RosterRow[] = [];
  if (count && exports.sim_roster_ptr) {
    const ptr = exports.sim_roster_ptr();
    const view = new Float32Array(exports.memory.buffer, ptr, count * stride);
    for (let i = 0; i < count; i += 1) {
      const row = view.subarray(i * stride, (i + 1) * stride);
      roster.push({ kind: row[0], faction: row[1], tier: row[2], klass: row[3], producer: row[4], alloy: row[5], charge: row[6], pop: row[7] });
    }
  }
  return { exports, roster, rosterStride: stride, build: count ? `${count} roster rows` : 'no roster ABI in this build' };
}

// ------------------------------------------------------------------- schematic
/** Faction shades: ivory and teal for Dawnward, rust and ember for Cinderwake. */
export function factionColors(faction: number): { top: string; left: string; right: string; trim: string } {
  if (faction === 1) return { top: '#BC4A45', left: '#4E2439', right: '#813447', trim: '#F5B66B' };
  return { top: '#D8E3D5', left: '#1D6068', right: '#298B8B', trim: '#F1CE72' };
}

/**
 * Draws a schematic of an actor: an isometric plinth for its footprint with a
 * stepped cap, in the faction's shades. This is a diagram of size and proportion,
 * not the renderer's geometry — the lab says so on the card.
 */
export function drawSchematic(canvas: HTMLCanvasElement, tilesW: number, tilesH: number, levels: number, faction: number, selected = false): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 320;
  const cssH = 190;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#10121C';
  ctx.fillRect(0, 0, cssW, cssH);

  const tile = Math.min(20, (cssW - 40) / Math.max(2, tilesW + tilesH));
  const iso = (x: number, y: number, z: number) => ({
    sx: cssW / 2 + (x - y) * tile,
    sy: cssH * 0.72 + (x + y) * tile * 0.5 - z * tile * 0.9,
  });
  const { top, left, right } = factionColors(faction);
  const face = (a: { sx: number; sy: number }, b: { sx: number; sy: number }, c: { sx: number; sy: number }, d: { sx: number; sy: number }, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.lineTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#10121C';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // Plinth: bottom at z=0 in the footprint's own coordinates.
  const w0 = -tilesW / 2, w1 = tilesW / 2, d0 = -tilesH / 2, d1 = tilesH / 2;
  const base = 1;
  for (let z = 0; z < Math.max(1, levels); z += 1) {
    const shrink = z * 0.18;
    const x0 = w0 + shrink, x1 = w1 - shrink, y0 = d0 + shrink, y1 = d1 - shrink;
    const h = base;
    face(iso(x0, y0, z + h), iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x0, y1, z + h), top);
    face(iso(x0, y1, z + h), iso(x1, y1, z + h), iso(x1, y1, z), iso(x0, y1, z), right);
    face(iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x1, y1, z), iso(x1, y0, z), left);
  }
  if (selected) {
    ctx.strokeStyle = palette[22];
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, cssW - 4, cssH - 4);
  }
}
