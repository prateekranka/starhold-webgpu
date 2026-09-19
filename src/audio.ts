// Zero-dependency procedural retro Web Audio synthesizer engine for Starhold.
// Generates 8-bit / chiptune SFX, unit responses, combat explosions, and ambient wind.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNoiseNode: AudioNode | null = null;
  private ambientHumNode: OscillatorNode | null = null;
  private muted = false;
  private initialized = false;
  private lastAlarmTime = 0;
  private lastCombatSfxTime = 0;

  constructor() {
    // Lazy initialize on first user gesture
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, {once: false, passive: true});
      window.addEventListener('keydown', unlock, {once: false, passive: true});
    }
  }

  private init() {
    if (this.initialized || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.initAmbient();
      this.initialized = true;
    } catch {
      // Graceful fallback for audio-restricted environments
    }
  }

  private initAmbient() {
    if (!this.ctx || !this.ambientGain) return;
    try {
      // 1. Filtered pink/brown noise for planetary wind
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.11;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

      whiteNoise.connect(windFilter);
      windFilter.connect(this.ambientGain);
      whiteNoise.start();
      this.ambientNoiseNode = whiteNoise;

      // 2. Low reactor / base power hum (55Hz drone)
      const hum = this.ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.setValueAtTime(55, this.ctx.currentTime);
      const humGain = this.ctx.createGain();
      humGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      hum.connect(humGain);
      humGain.connect(this.ambientGain);
      hum.start();
      this.ambientHumNode = hum;
    } catch {
      // Ignore if ambient fails to bind
    }
  }

  stopAmbient() {
    if (this.ambientNoiseNode) {
      try { (this.ambientNoiseNode as AudioBufferSourceNode).stop(); } catch {}
      this.ambientNoiseNode = null;
    }
    if (this.ambientHumNode) {
      try { this.ambientHumNode.stop(); } catch {}
      this.ambientHumNode = null;
    }
  }

  private ensureContext(): boolean {
    if (!this.initialized) this.init();
    if (!this.ctx || this.muted) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  /**
   * Unit selection sound: crisp high or mid chirp depending on unit role
   */
  playSelect(kind?: number) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isHeavy = kind === 26 || kind === 31 || (kind !== undefined && kind >= 60);
    const baseFreq = isHeavy ? 280 : 520;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.07);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Command acknowledgment sound (move, attack, build)
   */
  playOrder(op: number) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (op === 0) {
      // Move confirmation: two-tone rising blip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(660, t + 0.04);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (op === 1) {
      // Attack confirmation: sharp sawtooth staccato
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.08);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
    } else {
      // Build / gather / generic
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.setValueAtTime(780, t + 0.03);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  /**
   * Combat sound effects
   */
  playCombat(type: 'laser' | 'railgun' | 'mortar' | 'explosion' | 'hit') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    if (t - this.lastCombatSfxTime < 0.04) return; // Rate-limit dense battle cacophony
    this.lastCombatSfxTime = t;

    if (type === 'laser') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.14);
    } else if (type === 'railgun') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.22);
    } else if (type === 'mortar') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(650, t + 0.15);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (type === 'explosion') {
      // Noise burst for crunchy retro explosion
      const dur = 0.35;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(t);
    } else if (type === 'hit') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  /**
   * Alarm klaxon siren for enemy raids and base perimeter breaches
   */
  playAlarm(type: 'raid' | 'breach' | 'victory' | 'defeat') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    if (t - this.lastAlarmTime < 2.5) return; // Prevent continuous ringing
    this.lastAlarmTime = t;

    if (type === 'raid' || type === 'breach') {
      const freqHigh = type === 'breach' ? 950 : 750;
      const freqLow = type === 'breach' ? 620 : 500;
      for (let cycle = 0; cycle < 3; cycle++) {
        const ct = t + cycle * 0.35;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqHigh, ct);
        osc.frequency.setValueAtTime(freqLow, ct + 0.16);

        gain.gain.setValueAtTime(0.16, ct);
        gain.gain.setValueAtTime(0.16, ct + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.33);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(ct);
        osc.stop(ct + 0.34);
      }
    } else if (type === 'victory') {
      // Fanfare: Major triad ascending arpeggio C5 - E5 - G5 - C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const nt = t + idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, nt);
        gain.gain.setValueAtTime(0.2, nt);
        gain.gain.exponentialRampToValueAtTime(0.001, nt + 0.4);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(nt);
        osc.stop(nt + 0.45);
      });
    } else if (type === 'defeat') {
      // Somber descending tones
      const notes = [440.0, 415.3, 392.0, 329.6];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const nt = t + idx * 0.2;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, nt);
        gain.gain.setValueAtTime(0.18, nt);
        gain.gain.exponentialRampToValueAtTime(0.001, nt + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(nt);
        osc.stop(nt + 0.4);
      });
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.22, this.ctx.currentTime);
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export const sound = new SoundEngine();
