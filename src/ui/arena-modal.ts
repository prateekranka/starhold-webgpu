import {LockstepManager} from '../net/lockstep';

export type PlayerControllerType = 'human' | 'codex' | 'claude' | 'gemini' | 'friend';

export interface ArenaMatchConfig {
  p1: 'human' | 'codex' | 'claude' | 'gemini';
  p2: 'human' | 'codex' | 'claude' | 'gemini' | 'friend';
  lockstep?: LockstepManager;
}

export interface ArenaModalOptions {
  onLaunch: (config: ArenaMatchConfig) => void;
  onCancel?: () => void;
}

let modalElement: HTMLDialogElement | null = null;
let activeLockstep: LockstepManager | null = null;

export function openArenaModal(options: ArenaModalOptions): void {
  if (!modalElement) {
    modalElement = document.createElement('dialog');
    modalElement.id = 'arena-modal';
    modalElement.setAttribute('aria-labelledby', 'arena-modal-title');
    document.body.appendChild(modalElement);
  }

  let p1Choice: 'human' | 'codex' | 'claude' | 'gemini' = 'human';
  let p2Choice: PlayerControllerType = 'codex';
  let netMode: 'host' | 'join' = 'host';
  let hostOfferToken = '';
  let clientAnswerToken = '';
  let netStatusText = 'Not connected';
  let netStatusClass = '';

  function render() {
    if (!modalElement) return;
    const isFriendP2 = p2Choice === 'friend';

    modalElement.innerHTML = `
      <header class="arena-head">
        <div>
          <h2 id="arena-modal-title">BATTLE ARENA & MULTIPLAYER</h2>
          <p>Local Human, Autonomous Laya-MLX AI Models, or P2P WebRTC Lockstep</p>
        </div>
        <button type="button" class="arena-close-btn" data-action="close" aria-label="Close arena modal">✕</button>
      </header>

      <div class="arena-body">
        <div class="arena-matchup-grid">
          <!-- Player 1: Dawnward Compact -->
          <div class="arena-faction-card dawn">
            <div class="arena-card-title dawn">
              <span class="arena-faction-badge">D</span>
              <span>DAWNWARD COMPACT (P1)</span>
            </div>
            <div class="arena-select-group">
              <label for="arena-p1-select">Commander</label>
              <select id="arena-p1-select" class="arena-select">
                <option value="human" ${p1Choice === 'human' ? 'selected' : ''}>Human Commander (Local)</option>
                <option value="claude" ${p1Choice === 'claude' ? 'selected' : ''}>Claude 3.7 / MLX (Defensive Fortification)</option>
                <option value="codex" ${p1Choice === 'codex' ? 'selected' : ''}>OpenAI Codex / MLX (Aggressive Raider)</option>
                <option value="gemini" ${p1Choice === 'gemini' ? 'selected' : ''}>Gemini 3.8 Flash / MLX (Multi-Lane Swarm)</option>
              </select>
            </div>
          </div>

          <div class="arena-vs-divider">VS</div>

          <!-- Player 2: Cinderwake Reavers -->
          <div class="arena-faction-card cinder">
            <div class="arena-card-title cinder">
              <span class="arena-faction-badge">C</span>
              <span>CINDERWAKE REAVERS (P2)</span>
            </div>
            <div class="arena-select-group">
              <label for="arena-p2-select">Opponent</label>
              <select id="arena-p2-select" class="arena-select">
                <option value="codex" ${p2Choice === 'codex' ? 'selected' : ''}>OpenAI Codex / MLX (Aggressive Raider)</option>
                <option value="claude" ${p2Choice === 'claude' ? 'selected' : ''}>Claude 3.7 / MLX (Defensive Fortification)</option>
                <option value="gemini" ${p2Choice === 'gemini' ? 'selected' : ''}>Gemini 3.8 Flash / MLX (Multi-Lane Swarm)</option>
                <option value="human" ${p2Choice === 'human' ? 'selected' : ''}>Human Commander (Local Shared)</option>
                <option value="friend" ${p2Choice === 'friend' ? 'selected' : ''}>Remote Friend (WebRTC Lockstep)</option>
              </select>
            </div>

            ${isFriendP2 ? `
              <div class="arena-net-panel">
                <div class="arena-net-row">
                  <button type="button" class="arena-btn ${netMode === 'host' ? 'primary' : ''}" data-action="set-host">Host Game</button>
                  <button type="button" class="arena-btn ${netMode === 'join' ? 'primary' : ''}" data-action="set-join">Join Game</button>
                </div>

                ${netMode === 'host' ? `
                  <p style="font-size:9px;color:#98A4AE;margin:0;">1. Create invite token and share with friend over Chat or Tailscale:</p>
                  <div class="arena-net-row">
                    <button type="button" class="arena-btn primary" data-action="gen-host">Generate Room Token</button>
                    ${hostOfferToken ? '<button type="button" class="arena-btn" data-action="copy-host">Copy</button>' : ''}
                  </div>
                  ${hostOfferToken ? `<textarea class="arena-net-token-box" readonly>${hostOfferToken}</textarea>` : ''}
                  
                  <p style="font-size:9px;color:#98A4AE;margin:4px 0 0;">2. Paste friend's Answer token to complete lockstep link:</p>
                  <input id="arena-host-answer-in" type="text" class="arena-select" placeholder="Paste answer token here..." />
                  <button type="button" class="arena-btn primary" data-action="accept-answer">Connect Lockstep</button>
                ` : `
                  <p style="font-size:9px;color:#98A4AE;margin:0;">1. Paste Host's room token:</p>
                  <input id="arena-client-offer-in" type="text" class="arena-select" placeholder="Paste host room token here..." />
                  <button type="button" class="arena-btn primary" data-action="join-host">Join Host & Generate Answer</button>

                  ${clientAnswerToken ? `
                    <p style="font-size:9px;color:#98A4AE;margin:4px 0 0;">2. Share this answer token back to the Host:</p>
                    <textarea class="arena-net-token-box" readonly>${clientAnswerToken}</textarea>
                    <button type="button" class="arena-btn" data-action="copy-client">Copy Answer Token</button>
                  ` : ''}
                `}

                <div class="arena-net-status ${netStatusClass}">
                  <span>● Status: ${netStatusText}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:10px;">
          <button type="button" class="arena-btn" data-action="close">Cancel</button>
          <button type="button" class="arena-btn primary" data-action="launch" style="min-width:180px;">
            <strong>LAUNCH BATTLE</strong>
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    if (!modalElement) return;

    const p1Select = modalElement.querySelector<HTMLSelectElement>('#arena-p1-select');
    if (p1Select) {
      p1Select.onchange = () => {
        p1Choice = p1Select.value as any;
      };
    }

    const p2Select = modalElement.querySelector<HTMLSelectElement>('#arena-p2-select');
    if (p2Select) {
      p2Select.onchange = () => {
        p2Choice = p2Select.value as any;
        render();
      };
    }

    modalElement.onclick = async (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!target) return;
      const act = target.dataset.action;

      if (act === 'close') {
        closeArenaModal();
        options.onCancel?.();
      } else if (act === 'set-host') {
        netMode = 'host';
        render();
      } else if (act === 'set-join') {
        netMode = 'join';
        render();
      } else if (act === 'gen-host') {
        activeLockstep = new LockstepManager();
        wireLockstepEvents(activeLockstep);
        netStatusText = 'Generating host offer...';
        netStatusClass = '';
        render();
        try {
          hostOfferToken = await activeLockstep.createHostSession();
          netStatusText = 'Awaiting friend answer token...';
          render();
        } catch (err) {
          netStatusText = `Error: ${String(err)}`;
          netStatusClass = 'error';
          render();
        }
      } else if (act === 'copy-host') {
        if (hostOfferToken) navigator.clipboard.writeText(hostOfferToken);
      } else if (act === 'accept-answer') {
        const input = modalElement?.querySelector<HTMLInputElement>('#arena-host-answer-in');
        const token = input?.value.trim();
        if (token && activeLockstep) {
          try {
            await activeLockstep.acceptClientAnswer(token);
            netStatusText = 'Lockstep link connected!';
            netStatusClass = 'connected';
            render();
          } catch (err) {
            netStatusText = `Failed to connect: ${String(err)}`;
            netStatusClass = 'error';
            render();
          }
        }
      } else if (act === 'join-host') {
        const input = modalElement?.querySelector<HTMLInputElement>('#arena-client-offer-in');
        const token = input?.value.trim();
        if (token) {
          activeLockstep = new LockstepManager();
          wireLockstepEvents(activeLockstep);
          netStatusText = 'Joining host session...';
          render();
          try {
            clientAnswerToken = await activeLockstep.joinHostSession(token);
            netStatusText = 'Answer token ready. Send back to host.';
            render();
          } catch (err) {
            netStatusText = `Join failed: ${String(err)}`;
            netStatusClass = 'error';
            render();
          }
        }
      } else if (act === 'copy-client') {
        if (clientAnswerToken) navigator.clipboard.writeText(clientAnswerToken);
      } else if (act === 'launch') {
        closeArenaModal();
        options.onLaunch({
          p1: p1Choice,
          p2: p2Choice as any,
          lockstep: p2Choice === 'friend' ? (activeLockstep ?? undefined) : undefined,
        });
      }
    };
  }

  function wireLockstepEvents(lockstep: LockstepManager) {
    lockstep.onStatusChange((st) => {
      netStatusText = `Status: ${st}`;
      netStatusClass = st === 'connected' ? 'connected' : st === 'error' ? 'error' : '';
      if (modalElement && modalElement.open) render();
    });
  }

  render();
  modalElement.showModal();
}

export function closeArenaModal(): void {
  if (modalElement && modalElement.open) {
    modalElement.close();
  }
}
