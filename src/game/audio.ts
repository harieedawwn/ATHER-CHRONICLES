class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private isDucked = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val ? 0 : 0.9, this.ctx.currentTime);
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
    // Master low-pass filter for anime time-stop / slow-motion atmospheric ducking
    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    this.masterFilter.Q.value = 0.85;

    // Master compressor for cinematic punch and glue
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.18;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.9;

    // Cinematic stereo hall impulse response for atmospheric tail
    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(ctx, 1.4, 3.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.26;

    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
    this.masterGain.connect(ctx.destination);

    // Pre-generate white and pink/warm noise buffers for Foley & wind
    const len = Math.floor(ctx.sampleRate * 1.2);
    this.whiteNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    this.pinkNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);

    const wData = this.whiteNoiseBuffer.getChannelData(0);
    const pData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      wData[i] = white;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
  }

  private createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const n = i / length;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
      }
    }
    return impulse;
  }

  private connectOut(node: AudioNode, reverbSend = 0.2): void {
    if (!this.masterFilter || !this.compressor || !this.ctx) return;
    node.connect(this.masterFilter);
    if (this.reverbNode && reverbSend > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverbSend;
      node.connect(send);
      send.connect(this.reverbNode);
    }
  }

  public unlock(): void {
    this.ensureContext();
  }

  // Anime Time-Dilation / Vanish-Suspension Audio Ducking (muffles highs + plays sub heartbeat)
  public setTimeDilationDuck(active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterFilter) return;
    if (active === this.isDucked) return;
    this.isDucked = active;
    const now = ctx.currentTime;
    this.masterFilter.frequency.cancelScheduledValues(now);
    this.masterFilter.frequency.setValueAtTime(
      Math.max(100, this.masterFilter.frequency.value),
      now
    );
    if (active) {
      this.masterFilter.frequency.setTargetAtTime(360, now, 0.035);
      this.playHeartbeatPulse();
    } else {
      this.masterFilter.frequency.setTargetAtTime(20000, now, 0.06);
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
      osc.frequency.setValueAtTime(idx === 0 ? 68 : 60, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.12);
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.32 : 0.24, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
      osc.connect(g);
      g.connect(this.compressor!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
  }

  // Instant anime spatial vanish / teleport whip-crack
  public playVanish(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.075);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.15);

    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(g);
    this.connectOut(g, 0.35);
    osc.start(now);
    osc.stop(now + 0.17);

    // Vacuum air snap
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.26, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(bp);
    bp.connect(ng);
    this.connectOut(ng, 0.3);
    src.start(now);
    src.stop(now + 0.14);
  }

  // Rising zero-gravity anime tension charge before Vanish Slam
  public playVanishCharge(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.42);

    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.34);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(g);
    this.connectOut(g, 0.45);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  // Cinematic air/weapon whoosh (layered warm pink noise + resonant low-mid sweep)
  public playSwing(pitch = 1, isHeavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const dur = isHeavy ? 0.22 : 0.14;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = isHeavy ? 1.4 : 2.1;
    filter.frequency.setValueAtTime(140 * pitch, now);
    filter.frequency.exponentialRampToValueAtTime((isHeavy ? 520 : 780) * pitch, now + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(110 * pitch, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isHeavy ? 0.34 : 0.22, now + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    this.connectOut(gain, isHeavy ? 0.3 : 0.15);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Subtle sub-air body weight
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isHeavy ? 95 : 130, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(isHeavy ? 0.18 : 0.08, now + 0.025);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    sub.connect(subGain);
    this.connectOut(subGain, 0.1);
    sub.start(now);
    sub.stop(now + dur + 0.02);
  }

  // Cinematic anime martial-arts / weapon impact
  public playHit(intensity = 1, isHeavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = Math.min(1.6, Math.max(0.6, intensity));

    // Layer 1: Deep cinematic sub-bass drop (Taiko / 808 style chest thump)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    const startF = isHeavy ? 135 : 160;
    const endF = isHeavy ? 28 : 42;
    const subDur = isHeavy ? 0.38 : 0.19;
    sub.frequency.setValueAtTime(startF, now);
    sub.frequency.exponentialRampToValueAtTime(endF, now + subDur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(isHeavy ? 0.55 : 0.35 * scale, now + 0.006);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + subDur);
    sub.connect(subGain);
    this.connectOut(subGain, isHeavy ? 0.35 : 0.15);
    sub.start(now);
    sub.stop(now + subDur + 0.02);

    // Layer 2: Mid-range punch body impact
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(isHeavy ? 240 : 310, now);
    body.frequency.exponentialRampToValueAtTime(52, now + (isHeavy ? 0.16 : 0.09));
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(isHeavy ? 0.32 : 0.2 * scale, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.17 : 0.1));
    body.connect(bodyGain);
    this.connectOut(bodyGain, 0.2);
    body.start(now);
    body.stop(now + 0.18);

    // Layer 3: Foley transient crack + cloth/debris texture
    if (this.pinkNoiseBuffer && this.whiteNoiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = isHeavy ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isHeavy ? 1800 : 1200, now);
      bp.frequency.exponentialRampToValueAtTime(380, now + (isHeavy ? 0.18 : 0.09));
      bp.Q.value = 1.1;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(isHeavy ? 0.35 : 0.22 * scale, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.19 : 0.1));

      noise.connect(bp);
      bp.connect(nGain);
      this.connectOut(nGain, isHeavy ? 0.45 : 0.22);
      noise.start(now);
      noise.stop(now + 0.2);
    }
  }

  // Aerodynamic cloth & wind jump (zero arcade boing!)
  public playJump(isShort = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const dur = isShort ? 0.11 : 0.16;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(isShort ? 620 : 880, now + dur * 0.6);
    filter.frequency.exponentialRampToValueAtTime(340, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isShort ? 0.14 : 0.2, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    this.connectOut(gain, 0.18);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Subtle ground push-off thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(115, now);
    thud.frequency.exponentialRampToValueAtTime(45, now + 0.065);
    const tGain = ctx.createGain();
    tGain.gain.setValueAtTime(0.14, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    thud.connect(tGain);
    this.connectOut(tGain, 0.05);
    thud.start(now);
    thud.stop(now + 0.08);
  }

  // High-pressure wind burst for Dash (`P` + Move)
  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + 0.06);
    filter.frequency.exponentialRampToValueAtTime(190, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    src.connect(filter);
    filter.connect(gain);
    this.connectOut(gain, 0.28);
    src.start(now);
    src.stop(now + 0.22);

    // Sonic pressure thump
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.25, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    sub.connect(sGain);
    this.connectOut(sGain, 0.15);
    sub.start(now);
    sub.stop(now + 0.16);
  }

  // Stance activation & successful deflection for Parry (`P` neutral)
  public playParryStance(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    // Crisp cloth snap + low metallic guard resonance
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.11);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    this.connectOut(gain, 0.25);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Spatial vacuum warp for Kuro Blink / Teleports
  public playBlink(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    // Reverse-style vacuum implosion + low sub-drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    this.connectOut(gain, 0.4);
    osc.start(now);
    osc.stop(now + 0.2);

    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 0.17);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp);
    lp.connect(nGain);
    this.connectOut(nGain, 0.35);
    src.start(now);
    src.stop(now + 0.19);
  }

  // Deep anime Observation Haki tension pulse
  public playHakiPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep sub-harmonic pulse
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.48);

    // Ethereal resonant overtone
    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(440, now);
    overtone.frequency.exponentialRampToValueAtTime(293.66, now + 0.45);

    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.001, now);
    gSub.gain.linearRampToValueAtTime(0.36, now + 0.03);
    gSub.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const gOver = ctx.createGain();
    gOver.gain.setValueAtTime(0.001, now);
    gOver.gain.linearRampToValueAtTime(0.09, now + 0.04);
    gOver.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    sub.connect(gSub);
    overtone.connect(gOver);
    this.connectOut(gSub, 0.45);
    this.connectOut(gOver, 0.65);

    sub.start(now);
    overtone.start(now);
    sub.stop(now + 0.52);
    overtone.stop(now + 0.48);
  }

  // Time-fracture katana unsheathe & thunderous counter impact
  public playCounter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Inharmonic metallic katana resonance (high-Q partials, no square waves)
    const partials = [1180, 1890, 2740, 3920];
    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.96, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.99, now + 0.48);

      const gain = ctx.createGain();
      const amp = 0.14 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.connect(gain);
      this.connectOut(gain, 0.6);
      osc.start(now);
      osc.stop(now + 0.5);
    });

    this.playHit(1.6, true);
  }

  // Hyper-Speed Overdrive turbine & thunderous aura burst
  public playOverdrive(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;

    // Deep rising bass swell + sonic boom release
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.exponentialRampToValueAtTime(165, now + 0.16);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.48);

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.42, now + 0.14);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    sub.connect(sGain);
    this.connectOut(sGain, 0.45);
    sub.start(now);
    sub.stop(now + 0.52);

    // Pressurized wind roar
    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.8;
    bp.frequency.setValueAtTime(240, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + 0.18);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.45);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.32, now + 0.12);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    noise.connect(bp);
    bp.connect(nGain);
    this.connectOut(nGain, 0.5);
    noise.start(now);
    noise.stop(now + 0.48);
  }

  // Realistic steel-on-steel blade clash & Parry deflection ring
  public playClash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bell/steel modal partials
    const modes = [940, 1520, 2380, 3410, 4680];
    modes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 0.42);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (0.42 - i * 0.05));

      osc.connect(g);
      this.connectOut(g, 0.55);
      osc.start(now);
      osc.stop(now + 0.44);
    });

    // Low shockwave thump underneath steel ring
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.32, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    sub.connect(sg);
    this.connectOut(sg, 0.25);
    sub.start(now);
    sub.stop(now + 0.25);
  }

  // Theatrical anime KO blast: seismic sub-drop + atmospheric debris wash
  public playKO(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Massive seismic sub-bass drop
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.85);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.65, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    sub.connect(subG);
    this.connectOut(subG, 0.5);
    sub.start(now);
    sub.stop(now + 0.9);

    // Warm cinematic low-brass/horn fifth resonance
    [65.41, 98.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.75);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 360;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc.connect(lp);
      lp.connect(g);
      this.connectOut(g, 0.6);
      osc.start(now);
      osc.stop(now + 0.8);
    });

    if (this.pinkNoiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, now);
      lp.frequency.exponentialRampToValueAtTime(120, now + 0.75);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.45, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      src.connect(lp);
      lp.connect(ng);
      this.connectOut(ng, 0.65);
      src.start(now);
      src.stop(now + 0.8);
    }
  }

  // Crisp cinematic taiko/percussive tick for 3 - 2 - 1 pre-match countdown
  public playCountdownTick(count: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = count === 1 ? 1.22 : count === 2 ? 1.08 : 0.96;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(46 * pitch, now + 0.16);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.32, now + 0.008);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    sub.connect(sg);
    this.connectOut(sg, 0.25);
    sub.start(now);
    sub.stop(now + 0.18);

    const bell = ctx.createOscillator();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(520 * pitch, now);
    bell.frequency.exponentialRampToValueAtTime(260 * pitch, now + 0.11);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.14, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    bell.connect(bg);
    this.connectOut(bg, 0.3);
    bell.start(now);
    bell.stop(now + 0.13);
  }

  // Explosive anime gong/blade resonance for FIGHT!
  public playFightStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playClash();
    [220, 329.63, 440].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.01, now + 0.36);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.16 / (idx + 1), now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(g);
      this.connectOut(g, 0.45);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // Stage Updraft Jump Pad / Geyser boost
  public playJumpPad(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    this.connectOut(g, 0.35);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Signature Taunt flourish (`T` button)
  public playTaunt(fighterId?: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const baseFreq =
      fighterId === 'bram'
        ? 145
        : fighterId === 'kenji'
        ? 392
        : fighterId === 'nyx'
        ? 523.25
        : fighterId === 'velo'
        ? 440
        : 329.63;

    // Expressive two-note anime flourish + aura chime
    [1, 1.498].forEach((mult, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      const t0 = now + idx * 0.08;
      osc.frequency.setValueAtTime(baseFreq * mult, t0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * mult * 1.04, t0 + 0.22);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(g);
      this.connectOut(g, 0.4);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });

    this.playSwing(1.15, false);
  }

  // Cinematic Ultimate Awakening Cut-In (`V` button)
  public playUltimateActivation(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Deep time-freeze sub-bass drop
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.68);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.55, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    sub.connect(sg);
    this.connectOut(sg, 0.5);
    sub.start(now);
    sub.stop(now + 0.75);

    // 2. Dramatic anime awakening chord + rising tension sweep
    [220, 329.63, 440, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.5, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.78);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.82);

      osc.connect(g);
      this.connectOut(g, 0.65);
      osc.start(now);
      osc.stop(now + 0.85);
    });

    this.playClash();
  }

  // Cataclysmic Unblockable Ultimate Execution Impact
  public playUltimateImpact(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playHit(1.8, true);

    // Thunderous low-end rumble + high metallic/energy shatter
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(110, now);
    rumble.frequency.exponentialRampToValueAtTime(22, now + 0.75);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.6, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    rumble.connect(rg);
    this.connectOut(rg, 0.55);
    rumble.start(now);
    rumble.stop(now + 0.8);

    if (this.whiteNoiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1900, now);
      bp.frequency.exponentialRampToValueAtTime(240, now + 0.55);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.38, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      src.connect(bp);
      bp.connect(ng);
      this.connectOut(ng, 0.6);
      src.start(now);
      src.stop(now + 0.6);
    }
  }
}

export const sound = new SoundEngine();
