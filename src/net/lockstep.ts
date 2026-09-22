/**
 * Starhold WebRTC Lockstep Networking Manager.
 *
 * Provides peer-to-peer lockstep communication using native browser WebRTC
 * (RTCPeerConnection and RTCDataChannel) without third-party dependencies.
 * Generates self-contained base64 session tokens for copy-paste or URL sharing.
 */

export type NetRole = 'host' | 'client';
export type NetStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface NetCommand {
  tick: number;
  faction: 0 | 1;
  op: number;
  a: number;
  b: number;
}

export interface HashCheck {
  tick: number;
  hash: string;
}

export interface DesyncInfo {
  tick: number;
  localHash: string;
  remoteHash: string;
}

export type NetMessage =
  | { t: 'cmd'; tick: number; faction: 0 | 1; op: number; a: number; b: number }
  | { t: 'hash'; tick: number; hash: string }
  | { t: 'ping'; id: number; timestamp: number }
  | { t: 'pong'; id: number; timestamp: number };

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

/**
 * Encodes an RTCSessionDescriptionInit into a compact base64 string.
 */
export function encodeSessionToken(desc: RTCSessionDescriptionInit): string {
  const payload = {
    type: desc.type,
    sdp: desc.sdp,
  };
  const jsonStr = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a session token (base64 string or raw JSON) into an RTCSessionDescriptionInit.
 */
export function decodeSessionToken(token: string): RTCSessionDescriptionInit {
  let cleaned = token.trim();

  // Strip possible URL prefix or hash fragments
  const hashIdx = cleaned.indexOf('#');
  if (hashIdx !== -1) {
    cleaned = cleaned.slice(hashIdx + 1);
  }
  const tokenIdx = cleaned.indexOf('token=');
  if (tokenIdx !== -1) {
    cleaned = cleaned.slice(tokenIdx + 6);
  }
  const sessionIdx = cleaned.indexOf('session=');
  if (sessionIdx !== -1) {
    cleaned = cleaned.slice(sessionIdx + 8);
  }
  const ampIdx = cleaned.indexOf('&');
  if (ampIdx !== -1) {
    cleaned = cleaned.slice(0, ampIdx);
  }

  let jsonStr = '';
  if (cleaned.startsWith('{')) {
    jsonStr = cleaned;
  } else {
    // Standardize URL-safe base64 characters and pad
    let b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    jsonStr = new TextDecoder().decode(bytes);
  }

  const parsed = JSON.parse(jsonStr);
  const type = parsed.type || (parsed.t === 'o' ? 'offer' : parsed.t === 'a' ? 'answer' : parsed.t);
  const sdp = parsed.sdp || parsed.s;

  if (!type || !sdp) {
    throw new Error('Invalid session description token: missing type or sdp');
  }

  return { type, sdp };
}

/**
 * Waits for ICE candidate gathering to complete on the peer connection.
 */
function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        pc.removeEventListener('icecandidate', onCandidate);
        resolve();
      }
    };

    const timer = setTimeout(cleanup, timeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
      }
    };

    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate === null) {
        cleanup();
      }
    };

    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
  });
}

/**
 * Manages peer-to-peer lockstep networking over WebRTC.
 */
export class LockstepManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private currentRole: NetRole | null = null;
  private currentStatus: NetStatus = 'disconnected';
  private currentLatency = 0;
  private pingSeq = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private readonly rtcConfig: RTCConfiguration;
  private readonly localHashes = new Map<number, string>();
  private readonly remoteHashes = new Map<number, string>();
  private readonly desyncedTicks = new Set<number>();

  private readonly statusListeners = new Set<(status: NetStatus) => void>();
  private readonly commandListeners = new Set<(cmd: NetCommand) => void>();
  private readonly desyncListeners = new Set<(info: DesyncInfo) => void>();
  private readonly latencyListeners = new Set<(rttMs: number) => void>();

  constructor(config: RTCConfiguration = DEFAULT_RTC_CONFIG) {
    this.rtcConfig = config;
  }

  /** Current connection role ('host' or 'client'). */
  get role(): NetRole | null {
    return this.currentRole;
  }

  /** Current connection status. */
  get status(): NetStatus {
    return this.currentStatus;
  }

  /** Last measured round-trip latency in milliseconds. */
  get latency(): number {
    return this.currentLatency;
  }

  /** Returns true if data channel is connected and ready to send. */
  get isConnected(): boolean {
    return this.currentStatus === 'connected' && this.dc?.readyState === 'open';
  }

  /**
   * Registers a status change listener.
   */
  onStatusChange(cb: (status: NetStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  /**
   * Registers a listener for commands received from the remote peer.
   */
  onRemoteCommand(cb: (cmd: NetCommand) => void): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  /**
   * Registers a listener for simulation hash desync detections.
   */
  onDesync(cb: (info: DesyncInfo) => void): () => void {
    this.desyncListeners.add(cb);
    return () => this.desyncListeners.delete(cb);
  }

  /**
   * Registers a listener for latency (round-trip time in ms) updates.
   */
  onLatency(cb: (rttMs: number) => void): () => void {
    this.latencyListeners.add(cb);
    return () => this.latencyListeners.delete(cb);
  }

  /**
   * Host flow: Creates an offer and gathers ICE candidates into a self-contained token.
   */
  async createHostSession(): Promise<string> {
    this.disconnect();
    this.currentRole = 'host';
    this.setStatus('connecting');

    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      this.pc = pc;
      this.bindPc(pc);

      const dc = pc.createDataChannel('lockstep', { ordered: true });
      this.dc = dc;
      this.bindDc(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      if (!pc.localDescription) {
        throw new Error('Host session creation failed: missing local description');
      }

      return encodeSessionToken(pc.localDescription);
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  /**
   * Host flow: Accepts the client's answer token to complete connection.
   */
  async acceptClientAnswer(answerStr: string): Promise<void> {
    if (!this.pc || this.currentRole !== 'host') {
      throw new Error('Cannot accept client answer: no active host session');
    }

    try {
      const answer = decodeSessionToken(answerStr);
      await this.pc.setRemoteDescription(answer);
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  /**
   * Client flow: Joins a host session using the offer token and returns an answer token.
   */
  async joinHostSession(offerStr: string): Promise<string> {
    this.disconnect();
    this.currentRole = 'client';
    this.setStatus('connecting');

    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      this.pc = pc;
      this.bindPc(pc);

      pc.ondatachannel = (event) => {
        this.dc = event.channel;
        this.bindDc(event.channel);
      };

      const offer = decodeSessionToken(offerStr);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);

      if (!pc.localDescription) {
        throw new Error('Join host session failed: missing local description');
      }

      return encodeSessionToken(pc.localDescription);
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  /**
   * Sends a local command to the remote peer scheduled for execution at currentTick.
   */
  sendCommand(cmd: Omit<NetCommand, 'tick'>, currentTick: number): void {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.warn('[LockstepManager] Cannot send command: data channel is not open');
      return;
    }

    const message: NetMessage = {
      t: 'cmd',
      tick: currentTick,
      faction: cmd.faction,
      op: cmd.op,
      a: cmd.a,
      b: cmd.b,
    };

    this.sendJson(message);
  }

  /**
   * Verifies the simulation state hash for a given tick against the remote peer's hash.
   */
  verifyHash(currentTick: number, localHash: string): void {
    this.localHashes.set(currentTick, localHash);

    if (this.dc && this.dc.readyState === 'open') {
      const message: NetMessage = {
        t: 'hash',
        tick: currentTick,
        hash: localHash,
      };
      this.sendJson(message);
    }

    const remoteHash = this.remoteHashes.get(currentTick);
    if (remoteHash !== undefined && remoteHash !== localHash) {
      this.triggerDesync(currentTick, localHash, remoteHash);
    }

    if (currentTick > 600) {
      this.pruneHashes(currentTick - 600);
    }
  }

  /**
   * Closes active connections and resets networking state.
   */
  disconnect(): void {
    this.stopPing();

    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onclose = null;
      this.dc.onerror = null;
      this.dc.onmessage = null;
      try {
        this.dc.close();
      } catch {
        // Ignored on teardown
      }
      this.dc = null;
    }

    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.onicecandidate = null;
      try {
        this.pc.close();
      } catch {
        // Ignored on teardown
      }
      this.pc = null;
    }

    this.localHashes.clear();
    this.remoteHashes.clear();
    this.desyncedTicks.clear();
    this.currentRole = null;
    this.currentLatency = 0;
    this.setStatus('disconnected');
  }

  private setStatus(status: NetStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    for (const cb of this.statusListeners) {
      try {
        cb(status);
      } catch (err) {
        console.error('[LockstepManager] Error in status change callback:', err);
      }
    }
  }

  private bindPc(pc: RTCPeerConnection): void {
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          // Wait for data channel open to set status to 'connected'
          break;
        case 'disconnected':
        case 'closed':
          this.setStatus('disconnected');
          break;
        case 'failed':
          this.setStatus('error');
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this.setStatus('error');
      }
    };
  }

  private bindDc(dc: RTCDataChannel): void {
    dc.onopen = () => {
      this.setStatus('connected');
      this.startPing();
    };

    dc.onclose = () => {
      this.stopPing();
      this.setStatus('disconnected');
    };

    dc.onerror = (event) => {
      console.error('[LockstepManager] DataChannel error:', event);
      this.setStatus('error');
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.handleMessage(event.data);
      }
    };
  }

  private handleMessage(raw: string): void {
    let msg: NetMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.t) {
      case 'cmd':
        for (const cb of this.commandListeners) {
          try {
            cb({
              tick: msg.tick,
              faction: msg.faction,
              op: msg.op,
              a: msg.a,
              b: msg.b,
            });
          } catch (err) {
            console.error('[LockstepManager] Error in command callback:', err);
          }
        }
        break;

      case 'hash':
        this.handleRemoteHash(msg.tick, msg.hash);
        break;

      case 'ping':
        this.sendJson({ t: 'pong', id: msg.id, timestamp: msg.timestamp });
        break;

      case 'pong':
        this.handlePong(msg.timestamp);
        break;
    }
  }

  private handleRemoteHash(tick: number, remoteHash: string): void {
    this.remoteHashes.set(tick, remoteHash);

    const localHash = this.localHashes.get(tick);
    if (localHash !== undefined && localHash !== remoteHash) {
      this.triggerDesync(tick, localHash, remoteHash);
    }
  }

  private triggerDesync(tick: number, localHash: string, remoteHash: string): void {
    if (this.desyncedTicks.has(tick)) return;
    this.desyncedTicks.add(tick);

    const info: DesyncInfo = { tick, localHash, remoteHash };
    for (const cb of this.desyncListeners) {
      try {
        cb(info);
      } catch (err) {
        console.error('[LockstepManager] Error in desync callback:', err);
      }
    }
  }

  private pruneHashes(beforeTick: number): void {
    for (const tick of this.localHashes.keys()) {
      if (tick < beforeTick) this.localHashes.delete(tick);
    }
    for (const tick of this.remoteHashes.keys()) {
      if (tick < beforeTick) this.remoteHashes.delete(tick);
    }
    for (const tick of this.desyncedTicks) {
      if (tick < beforeTick) this.desyncedTicks.delete(tick);
    }
  }

  private startPing(): void {
    this.stopPing();
    // Send immediate ping
    this.sendPing();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 1000);
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendPing(): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    const id = ++this.pingSeq;
    this.sendJson({ t: 'ping', id, timestamp: performance.now() });
  }

  private handlePong(sentTimestamp: number): void {
    const rtt = Math.max(0, Math.round(performance.now() - sentTimestamp));
    this.currentLatency = rtt;
    for (const cb of this.latencyListeners) {
      try {
        cb(rtt);
      } catch (err) {
        console.error('[LockstepManager] Error in latency callback:', err);
      }
    }
  }

  private sendJson(msg: NetMessage): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(msg));
    } catch (err) {
      console.error('[LockstepManager] Failed to send message:', err);
    }
  }
}
