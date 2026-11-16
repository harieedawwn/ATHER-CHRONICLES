import { FighterId, MoveCategory, MoveKey, StageId } from './types';

interface FighterAcousticProfile {
  /** Base fundamental frequency for weapon/body resonance */
  baseFreq: number;
  /** Inharmonic modal ratios for weapon material (steel, stone, plasma, bronze, crystal, iron, wire) */
  modalRatios: [number, number, number, number];
  /** FM modulation ratio for metallic/energetic strike transient */
  fmRatio: number;
  /** FM modulation index (intensity of metallic/energy bite) */
  fmIndex: number;
  /** Bandpass formant frequencies [startHz, peakHz, endHz] for weapon swing whoosh */
  swingFormant: [number, number, number];
  /** Filter Q for swing air turbulence */
  swingQ: number;
  /** WaveShaper drive amount for impacts */
  hitDrive: number;
  /** Sub-bass drop start & end frequencies [startHz, endHz] */
  subDrop: [number, number];
  /** Footstep weight multiplier (0.7 light shinobi -> 1.45 colossal titan) */
  stepWeight: number;
  /** Footstep high-frequency gear/spur/armor clink frequency */
  stepClinkFreq: number;
  /** Power chord root frequency (Hz) for Ultimate Awakening */
  ultRootFreq: number;
}

const FIGHTER_PROFILES: Record<FighterId, FighterAcousticProfile> = {
  // 1. KURO — Mid-Air Assassin (Void Kunai & Abyssal Reaper Scythe)
  kuro: {
    baseFreq: 310,
    modalRatios: [1.0, 1.618, 2.74, 4.18],
    fmRatio: 2.41,
    fmIndex: 190,
    swingFormant: [280, 1480, 190],
    swingQ: 2.6,
    hitDrive: 44,
    subDrop: [155, 27],
    stepWeight: 0.78,
    stepClinkFreq: 2850,
    ultRootFreq: 110.0, // A2 Abyssal minor
  },
  // 2. VELO — Hyper-Speed Duelist (Supersonic Plasma Jet Gauntlets)
  velo: {
    baseFreq: 420,
    modalRatios: [1.0, 1.42, 2.15, 3.36],
    fmRatio: 1.75,
    fmIndex: 240,
    swingFormant: [360, 2150, 320],
    swingQ: 3.1,
    hitDrive: 52,
    subDrop: [195, 34],
    stepWeight: 0.86,
    stepClinkFreq: 3400,
    ultRootFreq: 146.83, // D3 High-voltage kinetic
  },
  // 3. KENJI — Crimson Eye (Cursed Odachi Katana "Muramasa" & Conqueror Haki)
  kenji: {
    baseFreq: 540,
    modalRatios: [1.0, 1.58, 2.46, 3.68],
    fmRatio: 2.82,
    fmIndex: 310,
    swingFormant: [240, 1760, 210],
    swingQ: 3.4,
    hitDrive: 58,
    subDrop: [165, 24],
    stepWeight: 1.0,
    stepClinkFreq: 2480,
    ultRootFreq: 116.54, // Bb2 Samurai tragic-heroic
  },
  // 4. BRAM — Iron Rift (Colossal Gravity Titan Greatsword & Obsidian Plate)
  bram: {
    baseFreq: 145,
    modalRatios: [1.0, 1.48, 2.22, 3.14],
    fmRatio: 1.38,
    fmIndex: 165,
    swingFormant: [95, 520, 68],
    swingQ: 1.5,
    hitDrive: 76,
    subDrop: [128, 18],
    stepWeight: 1.48,
    stepClinkFreq: 680,
    ultRootFreq: 82.41, // E2 Colossal tectonic sub
  },
  // 5. RAIJIN — Heaven's Conduit (High-Voltage Storm Naginata & Taiko Drum)
  raijin: {
    baseFreq: 380,
    modalRatios: [1.0, 1.72, 2.88, 4.35],
    fmRatio: 3.15,
    fmIndex: 340,
    swingFormant: [220, 1620, 175],
    swingQ: 2.4,
    hitDrive: 62,
    subDrop: [178, 25],
    stepWeight: 1.08,
    stepClinkFreq: 1920,
    ultRootFreq: 130.81, // C3 Storm god resonance
  },
  // 6. CHRONO — Zero Hour (Cathedral Clockwork Scythe & Bronze Bell)
  chrono: {
    baseFreq: 440,
    modalRatios: [1.0, 1.5, 2.0, 3.175], // Authentic cathedral bell harmonic/inharmonic ratios
    fmRatio: 2.0,
    fmIndex: 220,
    swingFormant: [180, 1180, 140],
    swingQ: 2.8,
    hitDrive: 48,
    subDrop: [150, 26],
    stepWeight: 0.96,
    stepClinkFreq: 3120,
    ultRootFreq: 123.47, // B2 Cathedral toll
  },
  // 7. NYX — Mirror Sovereign (Dimensional Prism Chakram & Astral Portals)
  nyx: {
    baseFreq: 660,
    modalRatios: [1.0, 1.498, 2.245, 3.368],
    fmRatio: 2.618,
    fmIndex: 260,
    swingFormant: [340, 2280, 410],
    swingQ: 3.6,
    hitDrive: 42,
    subDrop: [172, 29],
    stepWeight: 0.72,
    stepClinkFreq: 4180,
    ultRootFreq: 138.59, // C#3 Astral sovereign
  },
  // 8. SOL — Ashen Phoenix (Molten Morningstar Flail & Volcanic Hellfire)
  sol: {
    baseFreq: 210,
    modalRatios: [1.0, 1.54, 2.38, 3.52],
    fmRatio: 1.62,
    fmIndex: 210,
    swingFormant: [130, 860, 95],
    swingQ: 1.8,
    hitDrive: 68,
    subDrop: [142, 21],
    stepWeight: 1.28,
    stepClinkFreq: 1180,
    ultRootFreq: 98.0, // G2 Volcanic forge
  },
  // 9. JIN — Cyber Shinobi (Twin Mecha-Blades & Autonomous Puppet "Karasu")
  jin: {
    baseFreq: 490,
    modalRatios: [1.0, 1.66, 2.62, 3.94],
    fmRatio: 2.95,
    fmIndex: 280,
    swingFormant: [290, 1920, 250],
    swingQ: 2.9,
    hitDrive: 50,
    subDrop: [168, 28],
    stepWeight: 0.88,
    stepClinkFreq: 2740,
    ultRootFreq: 110.0, // A2 Cyber-shinobi
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private combatFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private roomReverbNode: ConvolverNode | null = null;
  private roomReverbGain: GainNode | null = null;
  private uiBusGain: GainNode | null = null;
  private envBusGain: GainNode | null = null;

  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;
  private gravelCrunchBuffer: AudioBuffer | null = null;
  private distortionCache: Map<number, Float32Array<ArrayBuffer>> = new Map();

  private muted = false;
  private isDucked = false;
  private lastUiHoverTime = 0;
  private lastWallSlideTime = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val ? 0 : 0.94, this.ctx.currentTime);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupMasterBus(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupMasterBus(ctx: AudioContext): void {
    // 1. Combat Bus Filter (for time-dilation / domain expansion lowpass ducking)
    this.combatFilter = ctx.createBiquadFilter();
    this.combatFilter.type = 'lowpass';
    this.combatFilter.frequency.value = 20000;
    this.combatFilter.Q.value = 0.85;

    // 2. Studio Mastering Compressor (high-impact punch + glue)
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -13;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 6.5;
    this.compressor.attack.value = 0.0015;
    this.compressor.release.value = 0.16;

    // 3. Master Output Gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.94;

    // 4. Dedicated Clean UI Bus (bypasses combat time-stop filter so UI stays silky & responsive)
    this.uiBusGain = ctx.createGain();
    this.uiBusGain.gain.value = 0.78;
    this.uiBusGain.connect(this.masterGain);

    // 5. Subtle Environment Ambience Bus (very light, ducks under heavy combat)
    this.envBusGain = ctx.createGain();
    this.envBusGain.gain.value = 0.24;
    this.envBusGain.connect(this.combatFilter);

    // 6. Dual Impulse Reverbs: Tight Metallic Combat Room + Dark Cinematic Arena Hall
    this.roomReverbNode = ctx.createConvolver();
    this.roomReverbNode.buffer = this.createImpulseResponse(ctx, 0.34, 4.8, 3400);
    this.roomReverbGain = ctx.createGain();
    this.roomReverbGain.gain.value = 0.24;

    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(ctx, 1.55, 3.1, 1850);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.28;

    this.combatFilter.connect(this.compressor);
    this.roomReverbNode.connect(this.roomReverbGain);
    this.roomReverbGain.connect(this.compressor);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    // Pre-generate specialized acoustic noise buffers (White, Pink, Brown Sub-Rumble, Gravel/Bone Crunch)
    const len = Math.floor(ctx.sampleRate * 1.5);
    this.whiteNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    this.pinkNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brownNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    this.gravelCrunchBuffer = ctx.createBuffer(1, len, ctx.sampleRate);

    const wData = this.whiteNoiseBuffer.getChannelData(0);
    const pData = this.pinkNoiseBuffer.getChannelData(0);
    const bData = this.brownNoiseBuffer.getChannelData(0);
    const gData = this.gravelCrunchBuffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    let brownLast = 0;

    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      wData[i] = white;

      // Paul Kellet's refined pink noise filter
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.042;
      b6 = white * 0.115926;

      // Warm brown sub-rumble noise for seismic tremors & explosions
      brownLast = (brownLast + 0.02 * white) / 1.02;
      bData[i] = brownLast * 3.2;

      // Granular gravel/debris/bone impulse texture (sparse high-crest micro-impacts)
      const grain = Math.random() < 0.14 ? Math.sign(white) * Math.pow(Math.abs(white), 0.35) : pData[i] * 0.45;
      gData[i] = grain;
    }
  }

  private createImpulseResponse(
    ctx: AudioContext,
    duration: number,
    decay: number,
    dampingLpHz: number
  ): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    const alpha = Math.min(0.95, (2 * Math.PI * dampingLpHz) / ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const n = i / length;
        const raw = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        prev = prev + alpha * (raw - prev);
        channelData[i] = prev;
      }
    }
    return impulse;
  }

  private getDistortionCurve(amount = 40): Float32Array<ArrayBuffer> {
    const rounded = Math.round(amount);
    const cached = this.distortionCache.get(rounded);
    if (cached) return cached;

    const k = rounded;
    const nSamples = 8192;
    const buffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      // Asymmetric warm analog-style saturation curve for weighty low-end punch
      const asym = x >= 0 ? x : x * 0.92;
      curve[i] = ((3 + k) * asym * 20 * deg) / (Math.PI + k * Math.abs(asym));
    }
    this.distortionCache.set(rounded, curve);
    return curve;
  }

  /**
   * Connects a combat audio node with optional stereo panning (-1..1), tight room send, and hall reverb send.
   */
  private connectOut(node: AudioNode, reverbSend = 0.2, pan = 0, roomSend = 0.15): void {
    if (!this.combatFilter || !this.compressor || !this.ctx) return;

    let targetNode: AudioNode = node;
    if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), this.ctx.currentTime);
      node.connect(panner);
      targetNode = panner;
    }

    targetNode.connect(this.combatFilter);

    if (this.roomReverbNode && roomSend > 0) {
      const rSend = this.ctx.createGain();
      rSend.gain.value = roomSend;
      targetNode.connect(rSend);
      rSend.connect(this.roomReverbNode);
    }
    if (this.reverbNode && reverbSend > 0) {
      const hSend = this.ctx.createGain();
      hSend.gain.value = reverbSend;
      targetNode.connect(hSend);
      hSend.connect(this.reverbNode);
    }
  }

  private getProfile(fighterId?: string): FighterAcousticProfile {
    if (fighterId && fighterId in FIGHTER_PROFILES) {
      return FIGHTER_PROFILES[fighterId as FighterId];
    }
    return FIGHTER_PROFILES.kenji;
  }

  public unlock(): void {
    this.ensureContext();
  }

  // ===========================================================================
  // PART 1: TACTILE, CHILL, ASMR-SATISFYING NON-ARCADE UI SOUND SUITE
  // (Warm matte-ceramic switches, muted wooden kalimba harmonics & velvet slides)
  // ===========================================================================

  /**
   * Subtle matte-ceramic micro-tick when hovering interactive cards or buttons.
   */
  public playUiHover(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain) return;
    const now = ctx.currentTime;
    if (now - this.lastUiHoverTime < 0.045) return;
    this.lastUiHoverTime = now;

    // Soft damped wood/ceramic keycap touch
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.032);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.036);

    osc.connect(g);
    g.connect(this.uiBusGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Satisfying tactile mechanical-ceramic "thock" for standard UI buttons & ruleset switches.
   */
  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    // Layer 1: Warm low-mid mechanical switch bottom-out "thock"
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(235, now);
    body.frequency.exponentialRampToValueAtTime(78, now + 0.055);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.001, now);
    bg.gain.linearRampToValueAtTime(0.22, now + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    body.connect(bg);
    bg.connect(this.uiBusGain);
    body.start(now);
    body.stop(now + 0.065);

    // Layer 2: Muted rosewood marimba harmonic overtone
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(587.33, now); // D5 warm wood harmonic
    tone.frequency.exponentialRampToValueAtTime(580, now + 0.07);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(0.085, now + 0.005);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    tone.connect(lp);
    lp.connect(tg);
    tg.connect(this.uiBusGain);
    tone.start(now);
    tone.stop(now + 0.08);
  }

  /**
   * Gentle downward damped ceramic tap when navigating Back or closing a modal.
   */
  public playUiBack(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain) return;
    const now = ctx.currentTime;

    [392.0, 293.66].forEach((freq, idx) => {
      const t0 = now + idx * 0.038;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t0 + 0.075);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.15, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      osc.connect(g);
      g.connect(this.uiBusGain!);
      osc.start(t0);
      osc.stop(t0 + 0.085);
    });
  }

  /**
   * Crisp magnetic toggle sound (upward warm interval for ON, downward for OFF).
   */
  public playUiToggle(isOn = true): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain) return;
    const now = ctx.currentTime;
    const notes = isOn ? [329.63, 440.0] : [440.0, 311.13];

    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.032;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t0 + 0.065);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      osc.connect(g);
      g.connect(this.uiBusGain!);
      osc.start(t0);
      osc.stop(t0 + 0.075);
    });
  }

  /**
   * Bespoke Fighter Selection Lock-In sound: combines a velvety low-thock with a warm, tasteful
   * acoustic signature hint of the chosen fighter's motif (never harsh or arcade!).
   */
  public playUiSelectFighter(fighterId: FighterId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // 1. Velvet sub-thock cushion
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(185, now);
    sub.frequency.exponentialRampToValueAtTime(62, now + 0.095);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.26, now + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    sub.connect(sg);
    sg.connect(this.uiBusGain);
    sub.start(now);
    sub.stop(now + 0.11);

    // 2. Character-tailored warm harmonicfifth dyad (filtered through a 1.8kHz warm lowpass)
    const root = Math.max(220, Math.min(587.33, prof.ultRootFreq * 3));
    [root, root * 1.498].forEach((freq, idx) => {
      const t0 = now + idx * 0.036;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.005, t0 + 0.16);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1850, t0);
      lp.frequency.exponentialRampToValueAtTime(620, t0 + 0.16);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.13 : 0.1, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.17);

      osc.connect(lp);
      lp.connect(g);
      g.connect(this.uiBusGain!);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  }

  /**
   * Smooth architectural stone/velvet slide lock-in when selecting a Battleground Stage.
   */
  public playUiSelectStage(stageId?: StageId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    const pitchMap: Record<StageId, number> = {
      void_flat: 1.08,
      torii: 1.0,
      dojo: 1.12,
      monolith: 0.88,
      coliseum: 0.82,
      hypercube: 1.18,
      tesseract: 1.24,
      train: 0.95,
    };
    const p = (stageId && pitchMap[stageId]) || 1.0;

    // Warm tactile slide + deep ceramic lock
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210 * p, now);
    osc.frequency.exponentialRampToValueAtTime(84 * p, now + 0.085);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.uiBusGain);
    osc.start(now);
    osc.stop(now + 0.095);

    // Soft brushed-velvet air texture
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.8;
    bp.frequency.setValueAtTime(480 * p, now);
    bp.frequency.exponentialRampToValueAtTime(920 * p, now + 0.09);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.09, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.uiBusGain);
    src.start(now);
    src.stop(now + 0.11);
  }

  /**
   * Rich, warm harmonic confirmation chord + deep velvet sub-thump for primary progression buttons
   * ("VS AI Arena", "Next: Select Map", "Engage Duel").
   */
  public playUiConfirm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiBusGain) return;
    const now = ctx.currentTime;

    // Deep velvet sub-cushion
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(165, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.32, now + 0.008);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    sub.connect(sg);
    sg.connect(this.uiBusGain);
    sub.start(now);
    sub.stop(now + 0.2);

    // Warm A-add9 acoustic glass/marimba chord arpeggio
    [220.0, 329.63, 440.0, 493.88].forEach((freq, idx) => {
      const t0 = now + idx * 0.028;
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.003, t0 + 0.24);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2100, t0);
      lp.frequency.exponentialRampToValueAtTime(680, t0 + 0.24);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.14 / (1 + idx * 0.25), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);

      osc.connect(lp);
      lp.connect(g);
      g.connect(this.uiBusGain!);
      osc.start(t0);
      osc.stop(t0 + 0.27);
    });
  }

  // ===========================================================================
  // PART 2: SUBTLE STAGE ENVIRONMENT SOUNDSCAPE (Very Light & Atmospheric)
  // ===========================================================================

  /**
   * Called every tick from GameEngine during active battle to weave ultra-subtle, non-intrusive
   * stage-specific environmental micro-textures (wind, distant rail seams, clockwork ticks, braziers).
   */
  public stepEnvironment(stageId: StageId, tick: number): void {
    if (this.muted || this.isDucked) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.envBusGain || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    if (stageId === 'train') {
      // Rhythmic high-speed Maglev rail-joint "clack-clack" every 54 frames (~0.9s)
      if (tick % 54 === 0 || tick % 54 === 7) {
        const isSecond = tick % 54 === 7;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isSecond ? 92 : 108, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.055);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(isSecond ? 0.08 : 0.11, now + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(this.envBusGain);
        osc.start(now);
        osc.stop(now + 0.065);
      }
      // Slipstream wind gust warning whoosh at cycle === 240
      if (tick % 360 === 240) {
        const src = ctx.createBufferSource();
        src.buffer = this.pinkNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(220, now);
        bp.frequency.exponentialRampToValueAtTime(680, now + 0.45);
        bp.frequency.exponentialRampToValueAtTime(190, now + 1.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.envBusGain);
        src.start(now);
        src.stop(now + 1.2);
      }
    } else if (stageId === 'tesseract') {
      // Subtle Cathedral Clockwork escapement tick every 60 frames (1.0s)
      if (tick % 60 === 0) {
        const isTock = Math.floor(tick / 60) % 2 === 1;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isTock ? 1180 : 1420, now);
        osc.frequency.exponentialRampToValueAtTime(isTock ? 420 : 540, now + 0.028);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.055, now + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
        osc.connect(g);
        g.connect(this.envBusGain);
        osc.start(now);
        osc.stop(now + 0.035);
      }
    } else if (stageId === 'torii' || stageId === 'dojo') {
      // Gentle mountain breeze & distant wooden temple furin/bamboo clack every ~3.5s
      if (tick % 210 === 45) {
        const src = ctx.createBufferSource();
        src.buffer = this.pinkNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 3.2;
        bp.frequency.setValueAtTime(310, now);
        bp.frequency.exponentialRampToValueAtTime(520, now + 0.5);
        bp.frequency.exponentialRampToValueAtTime(260, now + 1.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.07, now + 0.4);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.envBusGain);
        src.start(now);
        src.stop(now + 1.2);
      }
    } else if (stageId === 'coliseum' || stageId === 'monolith') {
      // Subtle subterranean brazier fire / abyssal tremor pulse every ~3s
      if (tick % 180 === 30 && this.brownNoiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.brownNoiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(160, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.085, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        src.connect(lp);
        lp.connect(g);
        g.connect(this.envBusGain);
        src.start(now);
        src.stop(now + 1.0);
      }
    } else if (stageId === 'hypercube') {
      // Distant cyberpunk spinner-car flyby Doppler hum every ~4s
      if (tick % 240 === 90) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(98, now + 0.9);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.045, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.envBusGain);
        osc.start(now);
        osc.stop(now + 1.0);
      }
    }
  }

  // ===========================================================================
  // PART 3: CHARACTER-UNIQUE LOCOMOTION FOLEY (Footsteps, Skid, Jump, Land, Wall)
  // ===========================================================================

  /**
   * Character-specific footstep sound with physical weight, surface grit, and gear/armor detail.
   */
  public playFootstep(fighterId: FighterId, isDash = false, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const w = prof.stepWeight;
    const vol = (isDash ? 0.24 : 0.13) * Math.min(1.35, w);

    // 1. Physical sole/boot ground compression thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    const startHz = (isDash ? 155 : 125) / Math.sqrt(w);
    thud.frequency.setValueAtTime(startHz, now);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.055 * w);

    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(vol, now + 0.003);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.06 * w);
    thud.connect(tg);
    this.connectOut(tg, 0.06, pan, 0.12);
    thud.start(now);
    thud.stop(now + 0.07 * w);

    // 2. Surface gravel/stone sole grit
    const grit = ctx.createBufferSource();
    grit.buffer = this.gravelCrunchBuffer ?? this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.9;
    bp.frequency.setValueAtTime(prof.stepClinkFreq * 0.65, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.045);
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(vol * 0.55, now);
    gg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    grit.connect(bp);
    bp.connect(gg);
    this.connectOut(gg, 0.05, pan, 0.1);
    grit.start(now);
    grit.stop(now + 0.055);

    // 3. Character-distinct locomotion accent on Dash steps
    if (isDash) {
      const clink = ctx.createOscillator();
      clink.type = fighterId === 'velo' || fighterId === 'raijin' ? 'sawtooth' : 'sine';
      clink.frequency.setValueAtTime(prof.stepClinkFreq, now);
      clink.frequency.exponentialRampToValueAtTime(prof.stepClinkFreq * 0.72, now + 0.04);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.05, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      clink.connect(cg);
      this.connectOut(cg, 0.08, pan, 0.1);
      clink.start(now);
      clink.stop(now + 0.05);
    }
  }

  /**
   * High-friction boot/stone pivot skid when reversing momentum at speed.
   */
  public playSkid(fighterId: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    const src = ctx.createBufferSource();
    src.buffer = this.gravelCrunchBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.6;
    bp.frequency.setValueAtTime(1650 / prof.stepWeight, now);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.09);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    src.connect(bp);
    bp.connect(g);
    this.connectOut(g, 0.1, pan, 0.18);
    src.start(now);
    src.stop(now + 0.1);
  }

  /**
   * Character-specific Ground Jump, Short-Hop, and Mid-Air Double Jump (Zero arcade boings!).
   */
  public playJump(isShort = false, fighterId?: FighterId, isAirJump = false, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const dur = isShort ? 0.11 : 0.16;

    // 1. Pressurized cloth & wind-shear launch whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.1;
    filter.frequency.setValueAtTime(prof.swingFormant[0] * 1.1, now);
    filter.frequency.exponentialRampToValueAtTime(
      prof.swingFormant[1] * (isShort ? 0.65 : 0.92),
      now + dur * 0.55
    );
    filter.frequency.exponentialRampToValueAtTime(prof.swingFormant[2] * 1.4, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isShort ? 0.16 : 0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    this.connectOut(gain, 0.16, pan, 0.18);
    src.start(now);
    src.stop(now + dur + 0.02);

    // 2. Ground push-off thud OR Mid-Air kinetic shock-ring
    const push = ctx.createOscillator();
    push.type = isAirJump ? 'triangle' : 'sine';
    const startHz = isAirJump ? prof.baseFreq * 0.85 : 135 / prof.stepWeight;
    push.frequency.setValueAtTime(startHz, now);
    push.frequency.exponentialRampToValueAtTime(isAirJump ? startHz * 1.45 : 38, now + 0.075);

    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.2 * prof.stepWeight, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    push.connect(pg);
    this.connectOut(pg, isAirJump ? 0.25 : 0.08, pan, 0.15);
    push.start(now);
    push.stop(now + 0.085);
  }

  /**
   * Weight-scaled physical landing impact (from nimble ninja tabi to Bram's seismic tremor).
   */
  public playLand(fighterId: FighterId, impactVy = 6, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const force = Math.min(1.6, Math.max(0.45, impactVy / 6.5)) * prof.stepWeight;

    // 1. Heavy floor compression sub-thud
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140 / Math.sqrt(prof.stepWeight), now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.09 * force);

    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(Math.min(0.48, 0.24 * force), now + 0.004);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.095 * force);
    sub.connect(sg);
    this.connectOut(sg, 0.14, pan, 0.22);
    sub.start(now);
    sub.stop(now + 0.11 * force);

    // 2. Stone/gravel/armor settle crunch
    const crunch = ctx.createBufferSource();
    crunch.buffer = this.gravelCrunchBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400 * force, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.085);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(Math.min(0.32, 0.16 * force), now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    crunch.connect(lp);
    lp.connect(cg);
    this.connectOut(cg, 0.12, pan, 0.18);
    crunch.start(now);
    crunch.stop(now + 0.095);
  }

  /**
   * Gritty cliff/wall friction scrape during Wall-Slide.
   */
  public playWallSlide(fighterId: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;
    if (now - this.lastWallSlideTime < 0.065) return;
    this.lastWallSlideTime = now;
    const prof = this.getProfile(fighterId);

    const src = ctx.createBufferSource();
    src.buffer = this.gravelCrunchBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.4;
    bp.frequency.setValueAtTime(980 / prof.stepWeight, now);
    bp.frequency.exponentialRampToValueAtTime(640, now + 0.06);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    src.connect(bp);
    bp.connect(g);
    this.connectOut(g, 0.08, pan, 0.14);
    src.start(now);
    src.stop(now + 0.07);
  }

  /**
   * Solid stone/masonry underside thud when bonking head against the bottom of a platform.
   */
  public playCeilingBonk(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.085);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    this.connectOut(g, 0.15, pan, 0.25);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * Character-distinct Burst Dash & Directional Air-Dash propulsion!
   */
  public playDash(fighterId?: FighterId, isAirDash = false, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // 1. High-pressure sonic wind cone burst
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.7;
    filter.frequency.setValueAtTime(prof.swingFormant[0] * 1.2, now);
    filter.frequency.exponentialRampToValueAtTime(prof.swingFormant[1] * 1.15, now + 0.055);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.21);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.34, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    src.connect(filter);
    filter.connect(gain);
    this.connectOut(gain, 0.26, pan, 0.22);
    src.start(now);
    src.stop(now + 0.23);

    // 2. Sub-bass pressure propulsion punch
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isAirDash ? 175 : 150, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.15);
    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.32, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sub.connect(sGain);
    this.connectOut(sGain, 0.18, pan, 0.15);
    sub.start(now);
    sub.stop(now + 0.17);

    // 3. Character-distinct dash transient (e.g. Velo jet afterburner, Raijin spark snap, Sol cinder roar)
    const accent = ctx.createOscillator();
    accent.type =
      fighterId === 'raijin' || fighterId === 'velo' || fighterId === 'sol'
        ? 'sawtooth'
        : 'triangle';
    accent.frequency.setValueAtTime(prof.baseFreq * 1.4, now);
    accent.frequency.exponentialRampToValueAtTime(prof.baseFreq * 0.45, now + 0.12);
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.11, now);
    ag.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    accent.connect(ag);
    this.connectOut(ag, 0.22, pan, 0.15);
    accent.start(now);
    accent.stop(now + 0.14);
  }

  /**
   * Escalating weapon/aura tension pulse while holding `L` (Strong Smash Charge).
   */
  public playChargePulse(fighterId: FighterId, ratio: number, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const pitch = 0.9 + ratio * 0.85;

    const osc = ctx.createOscillator();
    osc.type = fighterId === 'raijin' || fighterId === 'velo' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(prof.baseFreq * 0.55 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(prof.baseFreq * 0.85 * pitch, now + 0.085);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650 + ratio * 1800;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.09 + ratio * 0.08, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(lp);
    lp.connect(g);
    this.connectOut(g, 0.25, pan, 0.15);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // ===========================================================================
  // PART 4: CHARACTER-UNIQUE WEAPON SWINGS & BRUTAL COMBAT IMPACTS
  // ===========================================================================

  /**
   * Character-specific and move-specific weapon swing synthesis!
   * Every fighter's weapon (Katana, Greatsword, Plasma Gauntlets, Naginata, Scythe, Chakram,
   * Morningstar Flail, Void Kunai, Cyber Twinblades) produces its own authentic acoustic signature.
   */
  public playAttackSwing(
    fighterId: FighterId,
    moveKey: MoveKey,
    category: MoveCategory,
    pan = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    const isStrong = category === 'strong';
    const isSpecial = category === 'special';
    const isHeavy = isStrong || isSpecial || moveKey === 'jab3' || moveKey === 'dair' || moveKey === 'fair';

    // Distinct pitch contour per moveKey so jab1 -> jab2 -> jab3 and aerials never sound identical!
    const movePitchMap: Partial<Record<MoveKey, number>> = {
      jab1: 1.08,
      jab2: 1.22,
      jab3: 0.88,
      ftilt: 0.96,
      utilt: 1.16,
      dtilt: 1.04,
      nair: 1.12,
      fair: 0.94,
      bair: 0.89,
      uair: 1.18,
      dair: 0.82,
      fstrong: 0.74,
      ustrong: 0.8,
      dstrong: 0.7,
    };
    const pitch = movePitchMap[moveKey] ?? 1.0;
    const dur = isStrong ? 0.25 : isHeavy ? 0.19 : 0.13;

    // 1. Formant-Filtered Air-Cavity Turbulence Whoosh
    const air = ctx.createBufferSource();
    air.buffer = isStrong ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = prof.swingQ * (isStrong ? 0.85 : 1.0);
    bp.frequency.setValueAtTime(prof.swingFormant[0] * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(prof.swingFormant[1] * pitch, now + dur * 0.42);
    bp.frequency.exponentialRampToValueAtTime(prof.swingFormant[2] * pitch, now + dur);

    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.001, now);
    airGain.gain.linearRampToValueAtTime(isStrong ? 0.38 : isHeavy ? 0.28 : 0.2, now + dur * 0.3);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    air.connect(bp);
    bp.connect(airGain);
    this.connectOut(airGain, isStrong ? 0.32 : 0.16, pan, 0.22);
    air.start(now);
    air.stop(now + dur + 0.02);

    // 2. Physical Weapon Body Displacement Sub-Sweep
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(prof.subDrop[0] * 0.95 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(prof.subDrop[1] * 1.3, now + dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(isStrong ? 0.28 : 0.14, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    sub.connect(subGain);
    this.connectOut(subGain, 0.12, pan, 0.14);
    sub.start(now);
    sub.stop(now + dur + 0.02);

    // 3. Character-Exclusive Acoustic Weapon Layer on every swing!
    if (fighterId === 'kenji') {
      // Tamahagane katana edge air-whistle (FM metallic edge sing)
      const edge = ctx.createOscillator();
      edge.type = 'sine';
      edge.frequency.setValueAtTime(1480 * pitch, now);
      edge.frequency.exponentialRampToValueAtTime(2420 * pitch, now + dur * 0.4);
      edge.frequency.exponentialRampToValueAtTime(980 * pitch, now + dur);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.001, now);
      eg.gain.linearRampToValueAtTime(isStrong ? 0.13 : 0.075, now + dur * 0.25);
      eg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      edge.connect(eg);
      this.connectOut(eg, 0.28, pan, 0.2);
      edge.start(now);
      edge.stop(now + dur + 0.01);
    } else if (fighterId === 'sol') {
      // Heavy forged iron flail chain-links rattling during swing
      [0, 0.032, 0.068].forEach((offset, idx) => {
        const clink = ctx.createOscillator();
        clink.type = 'triangle';
        clink.frequency.setValueAtTime((1120 + idx * 340) * pitch, now + offset);
        clink.frequency.exponentialRampToValueAtTime(480, now + offset + 0.035);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.09, now + offset);
        cg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.038);
        clink.connect(cg);
        this.connectOut(cg, 0.18, pan, 0.2);
        clink.start(now + offset);
        clink.stop(now + offset + 0.04);
      });
    } else if (fighterId === 'chrono') {
      // Brass clockwork escapement gear ratchet clicks embedded in scythe swing
      [0, 0.028, 0.058].forEach((offset, idx) => {
        const tickOsc = ctx.createOscillator();
        tickOsc.type = 'sine';
        tickOsc.frequency.setValueAtTime((1850 + idx * 420) * pitch, now + offset);
        tickOsc.frequency.exponentialRampToValueAtTime(620, now + offset + 0.024);
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0.08, now + offset);
        tg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.026);
        tickOsc.connect(tg);
        this.connectOut(tg, 0.22, pan, 0.18);
        tickOsc.start(now + offset);
        tickOsc.stop(now + offset + 0.03);
      });
    } else if (fighterId === 'raijin') {
      // High-voltage electric arc crackle snapping off the Naginata polearm
      const zap = ctx.createOscillator();
      zap.type = 'sawtooth';
      zap.frequency.setValueAtTime(980 * pitch, now);
      zap.frequency.exponentialRampToValueAtTime(185, now + dur * 0.7);
      const zg = ctx.createGain();
      zg.gain.setValueAtTime(isStrong ? 0.14 : 0.08, now);
      zg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.75);
      zap.connect(zg);
      this.connectOut(zg, 0.24, pan, 0.2);
      zap.start(now);
      zap.stop(now + dur * 0.8);
    } else if (fighterId === 'velo') {
      // Jet-gauntlet turbine Doppler whine
      const jet = ctx.createOscillator();
      jet.type = 'sawtooth';
      jet.frequency.setValueAtTime(520 * pitch, now);
      jet.frequency.exponentialRampToValueAtTime(1680 * pitch, now + dur * 0.5);
      jet.frequency.exponentialRampToValueAtTime(380 * pitch, now + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const jg = ctx.createGain();
      jg.gain.setValueAtTime(0.09, now);
      jg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      jet.connect(lp);
      lp.connect(jg);
      this.connectOut(jg, 0.2, pan, 0.16);
      jet.start(now);
      jet.stop(now + dur + 0.01);
    } else if (fighterId === 'nyx') {
      // Spinning crystal prism chakram harmonic shimmer
      const prism = ctx.createOscillator();
      prism.type = 'sine';
      prism.frequency.setValueAtTime(1320 * pitch, now);
      prism.frequency.exponentialRampToValueAtTime(1980 * pitch, now + dur);
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.085, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      prism.connect(pg);
      this.connectOut(pg, 0.32, pan, 0.2);
      prism.start(now);
      prism.stop(now + dur + 0.01);
    } else if (fighterId === 'jin') {
      // Taut steel chakra-wire twang + Karasu puppet servo slash
      const wire = ctx.createOscillator();
      wire.type = 'triangle';
      wire.frequency.setValueAtTime(1180 * pitch, now);
      wire.frequency.exponentialRampToValueAtTime(640 * pitch, now + dur * 0.85);
      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.1, now);
      wg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
      wire.connect(wg);
      this.connectOut(wg, 0.22, pan, 0.18);
      wire.start(now);
      wire.stop(now + dur);
    } else if (fighterId === 'kuro') {
      // Inverted shadow-vacuum kunai slice
      const vac = ctx.createOscillator();
      vac.type = 'sine';
      vac.frequency.setValueAtTime(860 * pitch, now);
      vac.frequency.exponentialRampToValueAtTime(160, now + dur * 0.85);
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0.12, now);
      vg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
      vac.connect(vg);
      this.connectOut(vg, 0.28, pan, 0.2);
      vac.start(now);
      vac.stop(now + dur);
    } else if (fighterId === 'bram') {
      // Colossal obsidian greatsword sub-gravitational air-crush
      const crush = ctx.createOscillator();
      crush.type = 'sawtooth';
      crush.frequency.setValueAtTime(118 * pitch, now);
      crush.frequency.exponentialRampToValueAtTime(38, now + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.18, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      crush.connect(lp);
      lp.connect(cg);
      this.connectOut(cg, 0.25, pan, 0.22);
      crush.start(now);
      crush.stop(now + dur + 0.02);
    }
  }

  /**
   * Brutal, Visceral Multi-Layered Combat Impact (`playAttackHit`)!
   * Combines:
   *  1. Analog-saturated Sub-Bass Chest Slam (scaled by attacker's `hitDrive` and `subDrop`)
   *  2. FM Metallic / Energy Weapon Strike Transient (unique per attacker!)
   *  3. Inharmonic Weapon Modal Resonator (katana steel, bronze bell, iron flail, crystal prism, etc.)
   *  4. High-Crest Bone/Armor/Gravel Crunch & Air-Rip Turbulence
   */
  public playAttackHit(
    attackerId: FighterId,
    defenderId: FighterId,
    moveKey: MoveKey | null,
    category: MoveCategory | null,
    damage: number,
    kbForce: number,
    isHeavy: boolean,
    pan = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const attProf = this.getProfile(attackerId);
    const defProf = this.getProfile(defenderId);
    const scale = Math.min(1.75, Math.max(0.65, kbForce / 7.2));
    const isFinisher = isHeavy || category === 'strong' || moveKey === 'jab3' || moveKey === 'dair';

    // 1. SATURATED SUB-BASS CHEST SLAM (WaveShaper-driven low-end impact)
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(attProf.hitDrive * (isFinisher ? 1.25 : 0.9));
    sub.type = 'sine';
    const subDur = isFinisher ? 0.38 : 0.21;
    sub.frequency.setValueAtTime(attProf.subDrop[0] * (isFinisher ? 1.12 : 1.0), now);
    sub.frequency.exponentialRampToValueAtTime(attProf.subDrop[1], now + subDur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(
      Math.min(0.78, (isFinisher ? 0.58 : 0.38) * scale),
      now + 0.004
    );
    subGain.gain.exponentialRampToValueAtTime(0.001, now + subDur + 0.01);

    sub.connect(shaper);
    shaper.connect(subGain);
    this.connectOut(subGain, isFinisher ? 0.42 : 0.18, pan, 0.28);
    sub.start(now);
    sub.stop(now + subDur + 0.02);

    // 2. FM PHYSICAL WEAPON BITE TRANSIENT (Carrier + Modulator for visceral metallic/kinetic snap)
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();

    const pitchVar = moveKey === 'jab1' ? 0.96 : moveKey === 'jab2' ? 1.06 : moveKey === 'jab3' ? 1.18 : 1.0;
    const cFreq = attProf.baseFreq * pitchVar;
    carrier.type = attackerId === 'bram' || attackerId === 'sol' ? 'triangle' : 'sine';
    modulator.type = attackerId === 'raijin' || attackerId === 'velo' ? 'sawtooth' : 'sine';

    carrier.frequency.setValueAtTime(cFreq * 1.35, now);
    carrier.frequency.exponentialRampToValueAtTime(cFreq * 0.42, now + (isFinisher ? 0.16 : 0.095));

    modulator.frequency.setValueAtTime(cFreq * attProf.fmRatio, now);
    modGain.gain.setValueAtTime(attProf.fmIndex * (isFinisher ? 1.4 : 1.0), now);
    modGain.gain.exponentialRampToValueAtTime(1, now + (isFinisher ? 0.12 : 0.065));

    const fmOutGain = ctx.createGain();
    fmOutGain.gain.setValueAtTime((isFinisher ? 0.34 : 0.22) * scale, now);
    fmOutGain.gain.exponentialRampToValueAtTime(0.001, now + (isFinisher ? 0.17 : 0.1));

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(fmOutGain);
    this.connectOut(fmOutGain, isFinisher ? 0.32 : 0.18, pan, 0.25);

    modulator.start(now);
    carrier.start(now);
    modulator.stop(now + 0.18);
    carrier.stop(now + 0.18);

    // 3. CHARACTER-DISTINCT INHARMONIC WEAPON MODAL RESONATOR
    const modalDur = isFinisher ? 0.29 : 0.16;
    attProf.modalRatios.forEach((ratio, idx) => {
      const mOsc = ctx.createOscillator();
      mOsc.type = idx === 0 ? 'triangle' : 'sine';
      const f0 = attProf.baseFreq * ratio * pitchVar;
      mOsc.frequency.setValueAtTime(f0, now);
      // Slight pitch bend based on fighter weapon physics
      const endMult =
        attackerId === 'kenji'
          ? 1.015 // Singing katana steel upward shimmer
          : attackerId === 'nyx'
          ? 1.06 // Shattering prism upward refraction
          : attackerId === 'chrono'
          ? 0.992 // Cathedral bell steady decay
          : 0.92;
      mOsc.frequency.exponentialRampToValueAtTime(f0 * endMult, now + modalDur);

      const mg = ctx.createGain();
      const modeAmp = ((isFinisher ? 0.16 : 0.1) * scale) / (idx + 1);
      mg.gain.setValueAtTime(0.001, now);
      mg.gain.linearRampToValueAtTime(modeAmp, now + 0.003);
      mg.gain.exponentialRampToValueAtTime(0.001, now + modalDur * (1 - idx * 0.12));

      mOsc.connect(mg);
      this.connectOut(mg, isFinisher ? 0.45 : 0.24, pan, 0.25);
      mOsc.start(now);
      mOsc.stop(now + modalDur + 0.02);
    });

    // 4. BRUTAL FLESH / ARMOR / BONE CRUNCH TRANSIENT (scaled by Defender's armor weight!)
    if (this.gravelCrunchBuffer && this.whiteNoiseBuffer) {
      const crunch = ctx.createBufferSource();
      crunch.buffer = isFinisher ? this.gravelCrunchBuffer : this.whiteNoiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      // Heavier defenders (Bram/Sol) produce a lower, metallic plate crunch; lighter ones a crisp snap
      const centerHz = (isFinisher ? 2200 : 1650) / Math.sqrt(defProf.stepWeight);
      bp.frequency.setValueAtTime(centerHz, now);
      bp.frequency.exponentialRampToValueAtTime(340, now + (isFinisher ? 0.2 : 0.11));
      bp.Q.value = 1.25;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(Math.min(0.52, (isFinisher ? 0.42 : 0.26) * scale), now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (isFinisher ? 0.21 : 0.12));

      crunch.connect(bp);
      bp.connect(nGain);
      this.connectOut(nGain, isFinisher ? 0.42 : 0.22, pan, 0.3);
      crunch.start(now);
      crunch.stop(now + 0.22);
    }

    // 5. Bonus Elemental/Weapon Hit Tail on Strong/Heavy Blows
    if (isFinisher && damage >= 12) {
      if (attackerId === 'raijin' || attackerId === 'velo') {
        // High-voltage thunder/plasma shock crackle tail
        const bolt = ctx.createOscillator();
        bolt.type = 'sawtooth';
        bolt.frequency.setValueAtTime(1450, now + 0.02);
        bolt.frequency.exponentialRampToValueAtTime(62, now + 0.24);
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.22, now + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        bolt.connect(bg);
        this.connectOut(bg, 0.45, pan, 0.25);
        bolt.start(now + 0.02);
        bolt.stop(now + 0.26);
      } else if (attackerId === 'bram' || attackerId === 'sol') {
        // Seismic sub-rumble / volcanic detonation roar
        if (this.brownNoiseBuffer) {
          const roar = ctx.createBufferSource();
          roar.buffer = this.brownNoiseBuffer;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(420, now);
          lp.frequency.exponentialRampToValueAtTime(85, now + 0.34);
          const rg = ctx.createGain();
          rg.gain.setValueAtTime(0.38, now);
          rg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          roar.connect(lp);
          lp.connect(rg);
          this.connectOut(rg, 0.5, pan, 0.3);
          roar.start(now);
          roar.stop(now + 0.36);
        }
      }
    }
  }

  // Legacy-compatible wrappers that route to the upgraded combat synthesis
  public playSwing(pitch = 1, isHeavy = false, fighterId?: FighterId, pan = 0): void {
    this.playAttackSwing(
      fighterId ?? 'kenji',
      isHeavy ? 'fstrong' : pitch > 1.1 ? 'jab2' : 'jab1',
      isHeavy ? 'strong' : 'light',
      pan
    );
  }

  public playHit(intensity = 1, isHeavy = false, attackerId?: FighterId, defenderId?: FighterId, pan = 0): void {
    this.playAttackHit(
      attackerId ?? 'kenji',
      defenderId ?? 'bram',
      isHeavy ? 'fstrong' : 'jab1',
      isHeavy ? 'strong' : 'light',
      isHeavy ? 16 : 8,
      intensity * 8,
      isHeavy,
      pan
    );
  }

  /**
   * High-velocity wall-bounce slam when a fighter is launched into a stage wall or cliff face.
   */
  public playWallSlam(fighterId: FighterId, intensity = 1, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // Seismic masonry/hull thump
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(55);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.28);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(Math.min(0.65, 0.42 * intensity * prof.stepWeight), now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.38, pan, 0.3);
    sub.start(now);
    sub.stop(now + 0.3);

    // Shattering stone debris crunch
    const debris = ctx.createBufferSource();
    debris.buffer = this.gravelCrunchBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, now);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.22);
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.36, now);
    dg.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    debris.connect(lp);
    lp.connect(dg);
    this.connectOut(dg, 0.35, pan, 0.28);
    debris.start(now);
    debris.stop(now + 0.24);
  }

  // ===========================================================================
  // PART 5: BESPOKE SPECIAL SKILL & DEFENSIVE / COUNTER MECHANICS
  // ===========================================================================

  /**
   * Dedicated sound generator for every character's signature special mechanics (`J` moves).
   */
  public playSpecialSkill(fighterId: FighterId, specialTag: string, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    if (specialTag === 'bram_gravity_pull') {
      // Sub-gravitational black-hole suction warp (reverse-envelope sub-sweep)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(48, now);
      osc.frequency.exponentialRampToValueAtTime(195, now + 0.24);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(180, now);
      lp.frequency.exponentialRampToValueAtTime(980, now + 0.24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.36, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.45, pan, 0.25);
      osc.start(now);
      osc.stop(now + 0.36);
      return;
    }

    if (specialTag === 'raijin_rod_plant' || specialTag === 'raijin_sky_pillar') {
      // High-voltage lightning rod anchor spike + electric corona arc
      const spike = ctx.createOscillator();
      spike.type = 'sawtooth';
      spike.frequency.setValueAtTime(1680, now);
      spike.frequency.exponentialRampToValueAtTime(92, now + 0.22);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.32, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
      spike.connect(sg);
      this.connectOut(sg, 0.42, pan, 0.25);
      spike.start(now);
      spike.stop(now + 0.24);
      this.playClash(pan);
      return;
    }

    if (specialTag === 'chrono_stasis_bubble' || specialTag === 'chrono_echo_rewind') {
      // Temporal clockwork gear arrest + cathedral bell harmonic
      [523.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(
          specialTag === 'chrono_echo_rewind' ? freq * 0.75 : freq,
          now
        );
        osc.frequency.exponentialRampToValueAtTime(
          specialTag === 'chrono_echo_rewind' ? freq * 1.25 : freq * 0.82,
          now + 0.36
        );
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18 / (idx + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(g);
        this.connectOut(g, 0.55, pan, 0.25);
        osc.start(now);
        osc.stop(now + 0.4);
      });
      return;
    }

    if (specialTag === 'sol_supernova') {
      // Thermonuclear Cinder Stack Detonation!
      this.playAttackHit('sol', 'bram', 'fstrong', 'strong', 22, 12, true, pan);
      return;
    }

    if (specialTag === 'sol_chain_grapple') {
      // Heavy iron harpoon chain launch
      [0, 0.025, 0.052, 0.08].forEach((off, idx) => {
        const link = ctx.createOscillator();
        link.type = 'triangle';
        link.frequency.setValueAtTime(1280 + idx * 290, now + off);
        link.frequency.exponentialRampToValueAtTime(420, now + off + 0.04);
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.16, now + off);
        lg.gain.exponentialRampToValueAtTime(0.001, now + off + 0.045);
        link.connect(lg);
        this.connectOut(lg, 0.25, pan, 0.2);
        link.start(now + off);
        link.stop(now + off + 0.05);
      });
      return;
    }

    if (specialTag === 'nyx_prism_barrage' || specialTag === 'nyx_portal_gate' || specialTag === 'nyx_spatial_swap') {
      // Crystalline dimensional refraction beam / wormhole tear
      [880, 1318.5, 1975.5, 2637.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.018);
        osc.frequency.exponentialRampToValueAtTime(
          specialTag === 'nyx_spatial_swap' ? freq * 1.35 : freq * 0.88,
          now + 0.24
        );
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.14 / (idx + 1), now + idx * 0.018);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(g);
        this.connectOut(g, 0.5, pan, 0.25);
        osc.start(now + idx * 0.018);
        osc.stop(now + 0.28);
      });
      return;
    }

    if (
      specialTag === 'jin_thread_guillotine' ||
      specialTag === 'jin_puppet_command' ||
      specialTag === 'jin_puppet_ambush'
    ) {
      // High-tension steel razor-wire cross-snap + Karasu mecha-blade crunch
      [960, 1520, 2480, 3720].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq * 1.12, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.74, now + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18 / (idx + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        osc.connect(g);
        this.connectOut(g, 0.38, pan, 0.25);
        osc.start(now);
        osc.stop(now + 0.22);
      });
      return;
    }

    // Fallback character-tuned energetic special release
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(prof.baseFreq * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(prof.baseFreq * 0.45, now + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(g);
    this.connectOut(g, 0.35, pan, 0.2);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Stance activation for Standing Parry (`P` neutral) — tailored to the fighter's weapon guard!
   */
  public playParryStance(fighterId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // Crisp weapon guard brace + low metallic resonance
    [prof.baseFreq * 1.25, prof.baseFreq * 1.88].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.68, now + 0.11);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16 / (idx + 1), now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      this.connectOut(gain, 0.24, pan, 0.2);
      osc.start(now);
      osc.stop(now + 0.13);
    });
  }

  /**
   * Explosive steel-on-steel / aura deflection when a standing Parry (`P`) successfully deflects an attack!
   */
  public playParryDeflect(defenderId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(defenderId);

    // 1. Sub-bass shockwave thump
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(48);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(175, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.32);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.56, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.33);
    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.45, pan, 0.3);
    sub.start(now);
    sub.stop(now + 0.34);

    // 2. Singing forged-steel modal deflection ring
    prof.modalRatios.forEach((r, idx) => {
      const f = Math.max(820, prof.baseFreq * 2.2) * r;
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * 0.97, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.03, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 0.99, now + 0.48);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(g);
      this.connectOut(g, 0.62, pan, 0.35);
      osc.start(now);
      osc.stop(now + 0.52);
    });
  }

  /**
   * Heavy armored kinetic absorption thud when Bram's Super-Armor eats an enemy blow without flinching.
   */
  public playArmorAbsorb(defenderId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    void defenderId;

    // Deep forged-iron plate thud + anvil harmonic
    [130, 390, 620].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.58, now + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.36 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(g);
      this.connectOut(g, 0.25, pan, 0.3);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  /**
   * Brutal armor/guard shatter explosion when an Unblockable Ultimate or Armor-Breaker crushes a stance!
   */
  public playGuardShatter(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gravelCrunchBuffer) return;
    const now = ctx.currentTime;

    // Glass & steel fracture harmonics + heavy sub-drop
    [1480, 2240, 3380, 4920].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.012);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.42, now + 0.26);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2 / (idx + 1), now + idx * 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(g);
      this.connectOut(g, 0.55, pan, 0.35);
      osc.start(now + idx * 0.012);
      osc.stop(now + 0.29);
    });

    this.playWallSlam('bram', 1.4, pan);
  }

  /**
   * Iconic Awakening Surge cue the instant a fighter's Ultimate Gauge reaches 100%!
   */
  public playUltimateReady(fighterId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    const root = prof.ultRootFreq * 2;
    [root, root * 1.5, root * 2.0].forEach((freq, idx) => {
      const t0 = now + idx * 0.045;
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.92, t0);
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, t0 + 0.34);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.18 / (idx + 1), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);

      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.5, pan, 0.25);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    });
  }

  // Spatial vacuum warp for Blink / Teleports / Portal Warps
  public playBlink(fighterId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // Reverse-style vacuum implosion + low sub-drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(prof.baseFreq * 1.15, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    this.connectOut(gain, 0.42, pan, 0.25);
    osc.start(now);
    osc.stop(now + 0.2);

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + 0.17);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.26, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp);
    lp.connect(nGain);
    this.connectOut(nGain, 0.38, pan, 0.22);
    src.start(now);
    src.stop(now + 0.19);
  }

  // Deep anime Observation Haki / Rift Seal / Stasis tension pulse
  public playHakiPulse(fighterId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(108, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.48);

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(prof.baseFreq * 1.1, now);
    overtone.frequency.exponentialRampToValueAtTime(prof.baseFreq * 0.68, now + 0.45);

    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.001, now);
    gSub.gain.linearRampToValueAtTime(0.42, now + 0.025);
    gSub.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const gOver = ctx.createGain();
    gOver.gain.setValueAtTime(0.001, now);
    gOver.gain.linearRampToValueAtTime(0.12, now + 0.035);
    gOver.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    sub.connect(gSub);
    overtone.connect(gOver);
    this.connectOut(gSub, 0.48, pan, 0.25);
    this.connectOut(gOver, 0.65, pan, 0.3);

    sub.start(now);
    overtone.start(now);
    sub.stop(now + 0.52);
    overtone.stop(now + 0.48);
  }

  // Time-fracture katana unsheathe & thunderous Observation Counter impact
  public playCounter(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const partials = [1240, 1960, 2880, 4160];
    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.94, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 0.055);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.99, now + 0.52);

      const gain = ctx.createGain();
      const amp = 0.18 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

      osc.connect(gain);
      this.connectOut(gain, 0.65, pan, 0.35);
      osc.start(now);
      osc.stop(now + 0.54);
    });

    this.playAttackHit('kenji', 'bram', 'fstrong', 'strong', 19, 12, true, pan);
  }

  // Hyper-Speed Overdrive / Sol Phoenix Mantle Ignition Roar
  public playOverdrive(fighterId?: FighterId, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(45);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(62, now);
    sub.frequency.exponentialRampToValueAtTime(185, now + 0.16);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.52);

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.52, now + 0.13);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);

    sub.connect(shaper);
    shaper.connect(sGain);
    this.connectOut(sGain, 0.5, pan, 0.3);
    sub.start(now);
    sub.stop(now + 0.56);

    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(prof.swingFormant[0], now);
    bp.frequency.exponentialRampToValueAtTime(prof.swingFormant[1] * 1.2, now + 0.18);
    bp.frequency.exponentialRampToValueAtTime(280, now + 0.48);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.38, now + 0.12);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(bp);
    bp.connect(nGain);
    this.connectOut(nGain, 0.52, pan, 0.3);
    noise.start(now);
    noise.stop(now + 0.52);
  }

  // Realistic steel-on-steel weapon clash
  public playClash(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const modes = [980, 1580, 2460, 3540, 4820];
    modes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 0.44);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (0.44 - i * 0.05));

      osc.connect(g);
      this.connectOut(g, 0.58, pan, 0.32);
      osc.start(now);
      osc.stop(now + 0.46);
    });

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(155, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.38, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    sub.connect(sg);
    this.connectOut(sg, 0.28, pan, 0.2);
    sub.start(now);
    sub.stop(now + 0.27);
  }

  // Anime Time-Dilation / Vanish-Suspension Audio Ducking (muffles highs + plays sub heartbeat)
  public setTimeDilationDuck(active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.combatFilter) return;
    if (active === this.isDucked) return;
    this.isDucked = active;
    const now = ctx.currentTime;
    this.combatFilter.frequency.cancelScheduledValues(now);
    this.combatFilter.frequency.setValueAtTime(
      Math.max(100, this.combatFilter.frequency.value),
      now
    );
    if (active) {
      this.combatFilter.frequency.setTargetAtTime(420, now, 0.035);
      this.playHeartbeatPulse();
    } else {
      this.combatFilter.frequency.setTargetAtTime(20000, now, 0.06);
    }
  }

  public playHeartbeatPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;
    const now = ctx.currentTime;

    [0, 0.14].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 72 : 62, now + offset);
      osc.frequency.exponentialRampToValueAtTime(26, now + offset + 0.13);
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.38 : 0.28, now + offset + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(g);
      g.connect(this.compressor!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  // Theatrical anime KO blast: seismic sub-drop + low brass horn + atmospheric debris wash
  public playKO(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(60);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(175, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.92);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.75, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    sub.connect(shaper);
    shaper.connect(subG);
    this.connectOut(subG, 0.58, 0, 0.35);
    sub.start(now);
    sub.stop(now + 0.98);

    [65.41, 98.0, 130.81].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.91, now + 0.82);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 460;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24 / (idx + 1), now + 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.65, 0, 0.3);
      osc.start(now);
      osc.stop(now + 0.88);
    });

    if (this.gravelCrunchBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.gravelCrunchBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2800, now);
      lp.frequency.exponentialRampToValueAtTime(110, now + 0.82);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      src.connect(lp);
      lp.connect(ng);
      this.connectOut(ng, 0.68, 0, 0.35);
      src.start(now);
      src.stop(now + 0.88);
    }
  }

  // Heavy Taiko War-Drum & Bronze Rim for 3 - 2 - 1 pre-match countdown
  public playCountdownTick(count: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = count === 1 ? 1.24 : count === 2 ? 1.08 : 0.95;

    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(35);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(155 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(42 * pitch, now + 0.18);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.38, now + 0.006);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.28, 0, 0.22);
    sub.start(now);
    sub.stop(now + 0.2);

    const rim = ctx.createOscillator();
    rim.type = 'triangle';
    rim.frequency.setValueAtTime(560 * pitch, now);
    rim.frequency.exponentialRampToValueAtTime(240 * pitch, now + 0.11);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.16, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    rim.connect(bg);
    this.connectOut(bg, 0.32, 0, 0.2);
    rim.start(now);
    rim.stop(now + 0.13);
  }

  // Explosive Arena War-Gong & Blade Clash for FIGHT!
  public playFightStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playClash();
    [110, 164.81, 220, 329.63, 440].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.008, now + 0.45);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.2 / (idx + 1), now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.55, 0, 0.3);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  // Stage Updraft Jump Pad / Catapult Launch
  public playJumpPad(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    // Pressurized pneumatic/geyser launch
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    this.connectOut(g, 0.35, pan, 0.2);
    osc.start(now);
    osc.stop(now + 0.25);

    this.playDash('velo', true, pan);
  }

  /**
   * 9 Character-Exclusive Signature Taunt Audio Performances (`T` button)!
   * Zero shared notes—each fighter performs their iconic weapon & elemental ritual.
   */
  public playTaunt(fighterId?: string, pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const id = (fighterId ?? 'kenji') as FighterId;
    const prof = this.getProfile(id);

    if (id === 'kenji') {
      // Sacred Katana Unsheathe (*SHING!*) + Conqueror Haki Sub-Pulse
      [1680, 2520, 3780].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * 0.92, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.06, now + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16 / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(g);
        this.connectOut(g, 0.55, pan, 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      });
      this.playHakiPulse('kenji', pan);
    } else if (id === 'bram') {
      // Colossal Greatsword Ground Plant + Tectonic Armor Lock
      this.playWallSlam('bram', 1.2, pan);
      this.playArmorAbsorb('bram', pan);
    } else if (id === 'raijin') {
      // Twin Taiko Thunder Beats + Overhead Lightning Crackle
      [0, 0.14].forEach((off, idx) => {
        const drum = ctx.createOscillator();
        drum.type = 'sine';
        drum.frequency.setValueAtTime(idx === 0 ? 155 : 185, now + off);
        drum.frequency.exponentialRampToValueAtTime(36, now + off + 0.16);
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(0.38, now + off);
        dg.gain.exponentialRampToValueAtTime(0.001, now + off + 0.17);
        drum.connect(dg);
        this.connectOut(dg, 0.38, pan, 0.25);
        drum.start(now + off);
        drum.stop(now + off + 0.18);
      });
      this.playSpecialSkill('raijin', 'raijin_rod_plant', pan);
    } else if (id === 'chrono') {
      // Winding Cathedral Clockwork Mechanism + Resonant Bronze Bell Toll
      [0, 0.04, 0.08, 0.12].forEach((off, idx) => {
        const gear = ctx.createOscillator();
        gear.type = 'triangle';
        gear.frequency.setValueAtTime(1400 + idx * 280, now + off);
        gear.frequency.exponentialRampToValueAtTime(520, now + off + 0.03);
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(0.12, now + off);
        gg.gain.exponentialRampToValueAtTime(0.001, now + off + 0.035);
        gear.connect(gg);
        this.connectOut(gg, 0.25, pan, 0.2);
        gear.start(now + off);
        gear.stop(now + off + 0.04);
      });
      this.playSpecialSkill('chrono', 'chrono_stasis_bubble', pan);
    } else if (id === 'sol') {
      // Spinning Iron Chain-Flail Rattle + Hellfire Blast Roar
      this.playSpecialSkill('sol', 'sol_chain_grapple', pan);
      this.playOverdrive('sol', pan);
    } else if (id === 'velo') {
      // Twin Jet-Gauntlet Turbine Spool-Up + Sonic Knuckle Pop
      this.playDash('velo', true, pan);
      this.playAttackSwing('velo', 'jab3', 'light', pan);
    } else if (id === 'nyx') {
      // Levitating Astral Prism Harmonic + Mirror Shimmer
      this.playSpecialSkill('nyx', 'nyx_prism_barrage', pan);
    } else if (id === 'jin') {
      // Cyber-Wire Tension Pluck + Karasu Mecha-Jaw Lock
      this.playSpecialSkill('jin', 'jin_thread_guillotine', pan);
    } else {
      // Kuro: Abyssal Chain Drag + Void Kunai Reverse-Vacuum
      this.playBlink('kuro', pan);
      this.playAttackSwing('kuro', 'fstrong', 'strong', pan);
    }

    void prof;
  }

  // ===========================================================================
  // PART 6: 4-ACT CINEMATIC ULTIMATE AWAKENING AUDIO CHOREOGRAPHY
  // ===========================================================================

  // Act I (Frames 1..72): Domain Expansion Time-Freeze Awakening Cut-In
  public playUltimateActivation(fighterId?: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // 1. Deep Anime Domain-Expansion Time-Stop Sub-Bass Drop with warm saturation (1.25s)
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(52);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.28);
    sub.frequency.exponentialRampToValueAtTime(18, now + 1.18);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.78, now + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.65, 0, 0.35);
    sub.start(now);
    sub.stop(now + 1.22);

    // 2. Character-Signature Low-Brass / Synth Power Chord Swell
    const root = prof.ultRootFreq;
    [root, root * 1.5, root * 2, root * 2.5, root * 3].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.5, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 1.15);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, now);
      lp.frequency.exponentialRampToValueAtTime(3400, now + 0.45);
      lp.frequency.exponentialRampToValueAtTime(720, now + 1.15);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.26 / (idx + 1), now + 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.18);

      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.68, 0, 0.3);
      osc.start(now);
      osc.stop(now + 1.2);
    });

    // 3. Secondary Whip-Pan Weapon / Domain Ignition Cue at Frame 37 (+0.58s)
    const cueTime = now + 0.58;
    prof.modalRatios.forEach((ratio, idx) => {
      const cueOsc = ctx.createOscillator();
      cueOsc.type = idx === 0 ? 'sawtooth' : 'sine';
      const f0 = prof.baseFreq * ratio;
      cueOsc.frequency.setValueAtTime(f0 * 0.85, cueTime);
      cueOsc.frequency.exponentialRampToValueAtTime(f0 * 1.45, cueTime + 0.44);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.001, cueTime);
      cg.gain.linearRampToValueAtTime(0.24 / (idx + 1), cueTime + 0.018);
      cg.gain.exponentialRampToValueAtTime(0.001, cueTime + 0.48);
      cueOsc.connect(cg);
      this.connectOut(cg, 0.58, 0, 0.3);
      cueOsc.start(cueTime);
      cueOsc.stop(cueTime + 0.5);
    });

    this.playClash();
  }

  // Act II (Frames 73..132): Heavy anime rush footstep / ground-crack / thruster pulse during Pursuit!
  public playUltimateSprintStep(fighterId?: string, stepIndex = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const pitch = (stepIndex % 2 === 0 ? 1.0 : 1.12) / Math.sqrt(prof.stepWeight);

    // Punchy saturated ground-crack footstep
    const thud = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(38);
    thud.type = 'sine';
    thud.frequency.setValueAtTime(185 * pitch, now);
    thud.frequency.exponentialRampToValueAtTime(30 * pitch, now + 0.095);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(0.48, now + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thud.connect(shaper);
    shaper.connect(tg);
    this.connectOut(tg, 0.22, 0, 0.25);
    thud.start(now);
    thud.stop(now + 0.11);

    // Character-specific pursuit propulsion layer (thruster / lightning / chain / stone)
    if (this.gravelCrunchBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.gravelCrunchBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.9;
      bp.frequency.setValueAtTime(prof.stepClinkFreq * 0.75 * pitch, now);
      bp.frequency.exponentialRampToValueAtTime(280 * pitch, now + 0.085);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.32, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      src.connect(bp);
      bp.connect(ng);
      this.connectOut(ng, 0.24, 0, 0.2);
      src.start(now);
      src.stop(now + 0.095);
    }
  }

  // Act III (Frames 133..300): Character-Distinct 10-Hit Barrage Impact!
  public playUltimateBarrageStrike(fighterId?: string, hitIndex = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const id = (fighterId ?? 'kenji') as FighterId;
    const prof = this.getProfile(id);
    const pitch = 0.86 + hitIndex * 0.098;
    const pan = (hitIndex % 2 === 0 ? -1 : 1) * Math.min(0.65, 0.22 + hitIndex * 0.04);

    // 1. Saturated Sub-Bass Chest Punch on every strike
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(prof.hitDrive);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(prof.subDrop[0] * 1.15 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(prof.subDrop[1], now + 0.23);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.6, now + 0.004);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.38, pan, 0.28);
    sub.start(now);
    sub.stop(now + 0.25);

    // 2. Character-Specific Harmonic / Weapon Signature Layer!
    prof.modalRatios.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      osc.type =
        id === 'velo' || id === 'raijin' || id === 'sol'
          ? idx === 0
            ? 'sawtooth'
            : 'triangle'
          : idx === 0
          ? 'triangle'
          : 'sine';
      const f0 = prof.baseFreq * ratio * pitch;
      osc.frequency.setValueAtTime(f0 * 0.96, now);
      osc.frequency.exponentialRampToValueAtTime(
        id === 'kenji' || id === 'nyx' ? f0 * 1.08 : f0 * 0.88,
        now + 0.21
      );
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.24 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      this.connectOut(g, 0.52, pan, 0.3);
      osc.start(now);
      osc.stop(now + 0.23);
    });

    // 3. High-velocity bone/steel/air-rip transient
    if (this.gravelCrunchBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.gravelCrunchBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400 * pitch, now);
      bp.frequency.exponentialRampToValueAtTime(360, now + 0.16);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.42, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      src.connect(bp);
      bp.connect(ng);
      this.connectOut(ng, 0.38, pan, 0.28);
      src.start(now);
      src.stop(now + 0.18);
    }
  }

  // Act IV-A (Frames 301..339): High-tension 0.65s pre-explosion climax charge & signature execution cue
  public playUltimateFinalCharge(fighterId?: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);
    const dur = 0.62;

    // 1. Rising dual-octave synth tension riser over 0.62s
    const base = prof.ultRootFreq;
    [base, base * 2, base * 4].forEach((baseF, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseF, now);
      osc.frequency.exponentialRampToValueAtTime(baseF * 5.2, now + dur);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(350, now);
      lp.frequency.exponentialRampToValueAtTime(5200, now + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.3 / (idx + 1), now + dur * 0.85);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.03);

      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.58, 0, 0.3);
      osc.start(now);
      osc.stop(now + dur + 0.04);
    });

    // 2. Vacuum air-suck noise envelope
    if (this.pinkNoiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(260, now);
      bp.frequency.exponentialRampToValueAtTime(3200, now + dur);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.45, now + dur * 0.9);
      ng.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.02);
      src.connect(bp);
      bp.connect(ng);
      this.connectOut(ng, 0.48, 0, 0.25);
      src.start(now);
      src.stop(now + dur + 0.03);
    }

    // 3. Character-Specific Climax Trigger right before Frame 340 Detonation (+0.5s):
    // e.g. Kenji Katana Tsuba Hilt-Click (*SHING!*), Chrono XII Cathedral Bell Toll, etc.
    const sigTime = now + 0.5;
    prof.modalRatios.forEach((r, i) => {
      const f = prof.baseFreq * 2.2 * r;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, sigTime);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, sigTime + 0.24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, sigTime);
      g.gain.linearRampToValueAtTime(0.26 / (i + 1), sigTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, sigTime + 0.25);
      osc.connect(g);
      this.connectOut(g, 0.62, 0, 0.32);
      osc.start(sigTime);
      osc.stop(sigTime + 0.26);
    });

    this.playHeartbeatPulse();
  }

  // Act IV-B (Frame 340): Multi-stage Nuclear / Cataclysmic Finisher Detonation tailored per fighter!
  public playUltimateImpact(fighterId?: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const prof = this.getProfile(fighterId);

    // Stage 1: Distorted Sub-Bass Seismic Bomb (220Hz -> 16Hz over 1.65s)
    const sub = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(78);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    sub.frequency.exponentialRampToValueAtTime(16, now + 1.62);

    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.92, now + 0.006);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    sub.connect(shaper);
    shaper.connect(sg);
    this.connectOut(sg, 0.72, 0, 0.4);
    sub.start(now);
    sub.stop(now + 1.68);

    // Stage 2: 4-Wave Cascading Detonation Roar & Character-Tuned Aftershock Pulses (at 0s, 0.16s, 0.34s, 0.54s)
    [0, 0.16, 0.34, 0.54].forEach((offset, idx) => {
      const t0 = now + offset;
      const amp = idx === 0 ? 0.64 : idx === 1 ? 0.48 : idx === 2 ? 0.36 : 0.26;
      const dur = idx === 0 ? 0.76 : 0.6;
      const pan = idx === 0 ? 0 : idx % 2 === 1 ? -0.45 : 0.45;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime((idx === 0 ? prof.ultRootFreq * 2.2 : prof.ultRootFreq * 1.5), t0);
      osc.frequency.exponentialRampToValueAtTime(20, t0 + dur);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, t0);
      lp.frequency.exponentialRampToValueAtTime(80, t0 + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.02);

      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.68, pan, 0.35);
      osc.start(t0);
      osc.stop(t0 + dur + 0.04);
    });

    // Stage 3: Full-Spectrum Gravel Crunch + Brown Sub-Rumble Shockwave Wash (1.55s tail)
    if (this.gravelCrunchBuffer && this.brownNoiseBuffer) {
      const crack = ctx.createBufferSource();
      crack.buffer = this.gravelCrunchBuffer;
      const cFilter = ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.frequency.setValueAtTime(3200, now);
      cFilter.frequency.exponentialRampToValueAtTime(240, now + 0.72);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.68, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      crack.connect(cFilter);
      cFilter.connect(cg);
      this.connectOut(cg, 0.68, 0, 0.38);
      crack.start(now);
      crack.stop(now + 0.78);

      const roar = ctx.createBufferSource();
      roar.buffer = this.brownNoiseBuffer;
      const rFilter = ctx.createBiquadFilter();
      rFilter.type = 'lowpass';
      rFilter.frequency.setValueAtTime(1600, now);
      rFilter.frequency.exponentialRampToValueAtTime(65, now + 1.52);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.75, now);
      rg.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
      roar.connect(rFilter);
      rFilter.connect(rg);
      this.connectOut(rg, 0.8, 0, 0.4);
      roar.start(now);
      roar.stop(now + 1.58);
    }
  }
}

export const sound = new SoundEngine();
