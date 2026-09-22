import './arena-modal.css';

export interface ThoughtStreamEntry {
  faction: 0 | 1;
  persona: string;
  thought: string;
  latencyMs: number;
  tick: number;
}

export class SpectatorHud {
  private element: HTMLElement;
  private listElement: HTMLElement;
  private entries: ThoughtStreamEntry[] = [];
  private collapsed = false;

  constructor() {
    this.element = document.createElement('aside');
    this.element.id = 'spectator-hud';
    this.element.innerHTML = `
      <div class="spec-hud-header">
        <div class="spec-hud-title">
          <span>AI ARENA SPECTATOR</span>
          <span class="spec-badge-live"><i></i>LIVE MLX</span>
        </div>
        <div class="spec-hud-controls">
          <button type="button" id="spec-speed-1x" class="spec-hud-toggle" title="Normal Speed">1x</button>
          <button type="button" id="spec-speed-2x" class="spec-hud-toggle" title="Fast Speed">2x</button>
          <button type="button" id="spec-speed-4x" class="spec-hud-toggle" title="Ultra Speed">4x</button>
          <button type="button" id="spec-hud-collapse" class="spec-hud-toggle">_</button>
        </div>
      </div>
      <div class="spec-hud-thought-stream" id="spec-thought-list">
        <div style="font-size:9px;color:#747C91;text-align:center;padding:12px 0;">
          Awaiting tactical thoughts from Laya-MLX models...
        </div>
      </div>
    `;

    this.element.style.display = 'none';
    document.body.appendChild(this.element);
    this.listElement = this.element.querySelector('#spec-thought-list')!;
    this.bindEvents();
  }

  private bindEvents() {
    const collapseBtn = this.element.querySelector<HTMLButtonElement>('#spec-hud-collapse');
    if (collapseBtn) {
      collapseBtn.onclick = () => {
        this.collapsed = !this.collapsed;
        this.element.classList.toggle('collapsed', this.collapsed);
        collapseBtn.textContent = this.collapsed ? '▢' : '_';
      };
    }

    const s1 = this.element.querySelector<HTMLButtonElement>('#spec-speed-1x');
    const s2 = this.element.querySelector<HTMLButtonElement>('#spec-speed-2x');
    const s4 = this.element.querySelector<HTMLButtonElement>('#spec-speed-4x');

    const setActive = (btn: HTMLElement | null) => {
      [s1, s2, s4].forEach((b) => b?.classList.remove('primary'));
      btn?.classList.add('primary');
    };
    setActive(s1);

    if (s1) s1.onclick = () => { (window as any).__starhold_time_scale = 1; setActive(s1); };
    if (s2) s2.onclick = () => { (window as any).__starhold_time_scale = 2; setActive(s2); };
    if (s4) s4.onclick = () => { (window as any).__starhold_time_scale = 4; setActive(s4); };
  }

  public addThought(entry: ThoughtStreamEntry): void {
    this.entries.push(entry);
    if (this.entries.length > 20) {
      this.entries.shift();
    }
    this.renderThoughts();
  }

  private renderThoughts(): void {
    if (this.entries.length === 0) return;

    this.listElement.innerHTML = this.entries
      .slice(-6)
      .reverse()
      .map((e) => {
        const factionCls = e.faction === 0 ? 'dawn' : 'cinder';
        const factionLabel = e.faction === 0 ? 'Dawnward' : 'Cinderwake';
        const sec = Math.floor(e.tick / 60);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');

        return `
          <div class="spec-thought-entry ${factionCls}">
            <div class="spec-thought-meta">
              <strong>${factionLabel} · ${e.persona.toUpperCase()}</strong>
              <span>${mm}:${ss} · <span class="spec-thought-latency">${e.latencyMs.toFixed(0)}ms MLX</span></span>
            </div>
            <div class="spec-thought-text">${e.thought}</div>
          </div>
        `;
      })
      .join('');
  }

  public show(): void {
    this.element.style.display = 'flex';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }

  public clear(): void {
    this.entries = [];
    this.listElement.innerHTML = `
      <div style="font-size:9px;color:#747C91;text-align:center;padding:12px 0;">
        Awaiting tactical thoughts from Laya-MLX models...
      </div>
    `;
  }
}
