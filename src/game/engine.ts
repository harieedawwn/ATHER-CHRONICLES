import { AIController } from './ai';
import { sound } from './audio';
import { FIGHTERS } from './fighters';
import { HDPixelRenderer, RENDER_H, RENDER_W } from './renderer';
import { resolvePlatformAtTick, STAGES } from './stages';
import {
  Afterimage,
  BufferedInput,
  DelayedSlash,
  FighterId,
  FighterState,
  FloatingCallout,
  HUDState,
  InputState,
  MatchConfig,
  MoveData,
  MoveKey,
  Particle,
  PortalPair,
  Projectile,
  RiftSeal,
  ScarfNode,
  ShockwaveRing,
  SlashArc,
  StageSpec,
  StasisField,
  TrainingBehavior,
} from './types';

function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    shortHop: false,
    light: false,
    strong: false,
    special: false,
    dash: false,
    taunt: false,
    ultimate: false,
  };
}

function createScarf(x: number, y: number): ScarfNode[] {
  const nodes: ScarfNode[] = [];
  for (let i = 0; i < 6; i++) {
    nodes.push({ x: x - i * 4, y: y - 16, vx: 0, vy: 0 });
  }
  return nodes;
}

export function createFighter(
  slot: 0 | 1,
  id: FighterId,
  x: number,
  y: number,
  facing: 1 | -1,
  stocks: number
): FighterState {
  return {
    slot,
    id,
    spec: FIGHTERS[id],
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    grounded: false,
    onPlatform: false,
    dropThroughTimer: 0,
    jumpsLeft: 2,
    airDashAvailable: true,
    fastFalling: false,
    action: 'idle',
    actionFrame: 0,
    currentMove: null,
    moveHitConnected: false,
    moveHitsDone: 0,
    chargeFrames: 0,
    holdingStrong: false,
    hitstunFrames: 0,
    hitstopFrames: 0,
    invulnFrames: 45,
    parryCooldown: 0,
    damagePercent: 0,
    hp: 1000,
    maxHp: 1000,
    stocks,
    comboCountReceived: 0,
    comboDamageReceived: 0,
    maxComboDealt: 0,
    totalDamageDealt: 0,
    countersLanded: 0,
    specialsLanded: 0,
    gauge: 0,
    ultimateGauge: 0,
    overdriveTimer: 0,
    suspendTimer: 0,
    anchorX: x,
    anchorY: y,
    anchorActive: false,
    hakiTimer: 0,
    hakiCounterTarget: null,
    armorStacks: 0,
    cinderMarks: 0,
    stasisSlowTimer: 0,
    puppetX: x + facing * 34,
    puppetY: y - 12,
    puppetVx: 0,
    puppetVy: 0,
    puppetActive: id === 'jin',
    puppetAttackTimer: 0,
    squashX: 1,
    squashY: 1,
    vibrateX: 0,
    flashWhiteFrames: 0,
    scarf: createScarf(x, y),
    poseBlend: 1,
    lastMoveKey: null,
    prevInput: emptyInput(),
    buffer: [],
    tapDirTimer: 0,
    lastTapDir: 0,
  };
}

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private renderer = new HDPixelRenderer();
  private ai = new AIController();

  private config: MatchConfig;
  private stage: StageSpec;
  private fighters: [FighterState, FighterState];

  private projectiles: Projectile[] = [];
  private riftSeals: RiftSeal[] = [];
  private stasisFields: StasisField[] = [];
  private portals: PortalPair[] = [];
  private delayedSlashes: DelayedSlash[] = [];
  private afterimages: Afterimage[] = [];
  private slashArcs: SlashArc[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private particles: Particle[] = [];
  private callouts: FloatingCallout[] = [];

  private nextProjId = 1;
  private tick = 0;
  private matchFrames = 0;
  private countdownFrames = 0;
  private paused = false;
  private winnerSlot: 0 | 1 | 'draw' | null = null;
  private timeDilation = 1.0;
  private timeDilationTimer = 0;
  private slowMoStep = 0;

  // Camera & Juice
  private camX = 0;
  private camY = 55;
  private camZoom = 1.24;
  private camAngle = 0;
  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;
  private impactFrames = 0;
  private impactInverted = false;

  // Training state
  private trainingBehavior: TrainingBehavior = 'idle';
  private showHitboxes = false;
  private autoHeal = true;
  private lastComboHits = 0;
  private lastComboDamage = 0;

  // Input tracking
  private keysDown = new Set<string>();
  private touchInput: InputState = emptyInput();

  // Loop
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private onHUDUpdate: (hud: HUDState) => void;
  private lastHudEmit = 0;

  constructor(config: MatchConfig, onHUDUpdate: (hud: HUDState) => void) {
    this.config = config;
    this.onHUDUpdate = onHUDUpdate;
    this.stage = STAGES[config.stageId] ?? STAGES.torii;
    const startY = this.stage.platforms[0].y - 18;
    const [spawnP1X, spawnP2X] = this.stage.spawnX ?? [-115, 115];
    this.fighters = [
      createFighter(0, config.p1Fighter, spawnP1X, startY, 1, config.stocksCount),
      createFighter(1, config.p2Fighter, spawnP2X, startY, -1, config.stocksCount),
    ];
    this.fighters[0].grounded = true;
    this.fighters[1].grounded = true;
    if (config.mode === 'training') {
      this.fighters[0].ultimateGauge = 100;
    }
    this.countdownFrames = config.mode === 'vs_ai' ? 86 : 18;
  }

  public mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.width = RENDER_W;
    this.canvas.height = RENDER_H;
    this.bindKeyboard();
    this.lastTime = performance.now();
    this.emitHUD(true);
    this.loop(this.lastTime);
  }

  public destroy(): void {
    sound.setTimeDilationDuck(false);
    cancelAnimationFrame(this.rafId);
    this.unbindKeyboard();
    this.canvas = null;
  }

  private triggerTimeDilation(scale: number, frames: number): void {
    this.timeDilation = scale;
    this.timeDilationTimer = Math.max(this.timeDilationTimer, frames);
    sound.setTimeDilationDuck(scale < 0.75);
  }

  private clearTimeDilation(): void {
    this.timeDilation = 1.0;
    this.timeDilationTimer = 0;
    this.slowMoStep = 0;
    sound.setTimeDilationDuck(false);
  }

  public setPaused(val: boolean): void {
    this.paused = val;
    this.emitHUD(true);
  }

  public togglePause(): void {
    if (this.winnerSlot !== null) return;
    this.paused = !this.paused;
    this.emitHUD(true);
  }

  public setTrainingBehavior(behavior: TrainingBehavior): void {
    this.trainingBehavior = behavior;
    this.emitHUD(true);
  }

  public setShowHitboxes(val: boolean): void {
    this.showHitboxes = val;
    this.emitHUD(true);
  }

  public setAutoHeal(val: boolean): void {
    this.autoHeal = val;
    this.emitHUD(true);
  }

  public resetTrainingPositions(): void {
    const startY = this.stage.platforms[0].y - 18;
    const [spawnP1X, spawnP2X] = this.stage.spawnX ?? [-115, 115];
    this.fighters = [
      createFighter(0, this.config.p1Fighter, spawnP1X, startY, 1, this.config.stocksCount),
      createFighter(1, this.config.p2Fighter, spawnP2X, startY, -1, this.config.stocksCount),
    ];
    this.fighters[0].grounded = true;
    this.fighters[1].grounded = true;
    if (this.config.mode === 'training') {
      this.fighters[0].ultimateGauge = 100;
    }
    this.projectiles = [];
    this.riftSeals = [];
    this.stasisFields = [];
    this.portals = [];
    this.delayedSlashes = [];
    this.afterimages = [];
    this.slashArcs = [];
    this.shockwaves = [];
    this.particles = [];
    this.callouts = [];
    this.lastComboHits = 0;
    this.lastComboDamage = 0;
    this.camAngle = 0;
    this.emitHUD(true);
  }

  public restartMatch(): void {
    this.winnerSlot = null;
    this.paused = false;
    this.matchFrames = 0;
    this.clearTimeDilation();
    this.impactFrames = 0;
    this.camZoom = 1.24;
    this.camAngle = 0;
    this.resetTrainingPositions();
    this.countdownFrames = this.config.mode === 'vs_ai' ? 86 : 18;
    this.emitHUD(true);
  }

  public setTouchInput(partial: Partial<InputState>): void {
    sound.unlock();
    Object.assign(this.touchInput, partial);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    sound.unlock();
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }
    if (code === 'Escape') {
      this.togglePause();
      return;
    }
    this.keysDown.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private handleBlur = () => {
    this.keysDown.clear();
  };

  private bindKeyboard(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  private unbindKeyboard(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  private readPlayerInput(): InputState {
    const k = this.keysDown;
    const t = this.touchInput;
    return {
      left: k.has('KeyA') || k.has('ArrowLeft') || t.left,
      right: k.has('KeyD') || k.has('ArrowRight') || t.right,
      up: k.has('KeyW') || k.has('ArrowUp') || t.up,
      down: k.has('KeyS') || k.has('ArrowDown') || t.down,
      jump: k.has('Space') || t.jump,
      shortHop: k.has('KeyC') || t.shortHop,
      light: k.has('KeyK') || t.light,
      strong: k.has('KeyL') || t.strong,
      special: k.has('KeyJ') || t.special,
      dash: k.has('KeyP') || t.dash,
      taunt: k.has('KeyT') || t.taunt,
      ultimate: k.has('KeyV') || t.ultimate,
    };
  }

  private loop = (now: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(50, now - this.lastTime);
    this.lastTime = now;

    if (!this.paused) {
      const stepMs = 1000 / 60;
      this.accumulator += dt;
      while (this.accumulator >= stepMs) {
        this.accumulator -= stepMs;
        if (this.timeDilationTimer > 0) {
          this.timeDilationTimer--;
          if (this.timeDilationTimer <= 0) {
            this.clearTimeDilation();
          }
        }
        if (this.timeDilation < 1.0) {
          this.slowMoStep += this.timeDilation;
          if (this.slowMoStep < 1.0) {
            this.updateParticlesAndCameraOnly();
            continue;
          }
          this.slowMoStep -= 1.0;
        }
        this.stepSimulation();
      }
    }

    if (this.canvas) {
      this.renderer.render(this.canvas, {
        stage: this.stage,
        fighters: this.fighters,
        projectiles: this.projectiles,
        riftSeals: this.riftSeals,
        stasisFields: this.stasisFields,
        portals: this.portals,
        delayedSlashes: this.delayedSlashes,
        afterimages: this.afterimages,
        slashArcs: this.slashArcs,
        shockwaves: this.shockwaves,
        particles: this.particles,
        callouts: this.callouts,
        camX: this.camX,
        camY: this.camY,
        camZoom: this.camZoom,
        camAngle: this.camAngle,
        shakeX: this.shakeX,
        shakeY: this.shakeY,
        impactFrames: this.impactFrames,
        impactInverted: this.impactInverted,
        timeDilation: this.timeDilation,
        showHitboxes: this.showHitboxes,
        tick: this.tick,
      });
    }

    if (now - this.lastHudEmit > 50) {
      this.emitHUD(false);
      this.lastHudEmit = now;
    }
  };

  private stepSimulation(): void {
    this.tick++;

    // Snappy 3 -> 2 -> 1 -> FIGHT! Countdown Sequence
    if (this.countdownFrames > 0) {
      if (this.countdownFrames === 85) sound.playCountdownTick(3);
      else if (this.countdownFrames === 63) sound.playCountdownTick(2);
      else if (this.countdownFrames === 41) sound.playCountdownTick(1);
      else if (this.countdownFrames === 18) sound.playFightStart();

      this.countdownFrames--;
      if (
        this.countdownFrames === 84 ||
        this.countdownFrames === 62 ||
        this.countdownFrames === 40 ||
        this.countdownFrames === 17 ||
        this.countdownFrames === 0
      ) {
        this.emitHUD(true);
      }

      // Hold fighters in ready stance while 3..2..1 ticks down, unlock immediately on FIGHT! (<= 18)
      if (this.countdownFrames > 18) {
        for (const f of this.fighters) {
          f.actionFrame++;
          this.applyPhysics(f, emptyInput(), 1.0);
          this.updateScarf(f);
        }
        this.updateParticlesAndCameraOnly();
        return;
      }
    }

    if (this.winnerSlot === null && this.config.mode === 'vs_ai') {
      this.matchFrames++;
    }

    if (this.impactFrames > 0) {
      this.impactFrames--;
      this.impactInverted = !this.impactInverted;
    }

    const p1Input = this.winnerSlot === null ? this.readPlayerInput() : emptyInput();
    const p2Input =
      this.winnerSlot === null
        ? this.ai.computeInput(
            this.fighters[1],
            this.fighters[0],
            this.stage,
            this.config.mode,
            this.config.aiDifficulty,
            this.trainingBehavior,
            this.tick
          )
        : emptyInput();

    const inputs: [InputState, InputState] = [p1Input, p2Input];

    // Step each fighter
    for (let i = 0; i < 2; i++) {
      this.updateFighterInputBuffer(this.fighters[i], inputs[i]);
    }

    // Check if either fighter is in the Cinematic Cut-In Phase of their Ultimate (`frames 0..44`).
    // During the Cut-In Phase, time freezes for the opponent so the dramatic camera close-up plays cleanly,
    // then at frame 45 the opponent is released to run, dash, jump, or dodge out of the unblockable zone!
    const p1InCutscene =
      this.fighters[0].action === 'ultimate' && this.fighters[0].actionFrame < 44;
    const p2InCutscene =
      this.fighters[1].action === 'ultimate' && this.fighters[1].actionFrame < 44;

    if (p1InCutscene) {
      this.stepFighter(this.fighters[0], this.fighters[1], inputs[0]);
      this.updateScarf(this.fighters[1]);
      this.updateParticlesAndCameraOnly();
      return;
    }
    if (p2InCutscene) {
      this.stepFighter(this.fighters[1], this.fighters[0], inputs[1]);
      this.updateScarf(this.fighters[0]);
      this.updateParticlesAndCameraOnly();
      return;
    }

    for (let i = 0; i < 2; i++) {
      this.stepFighter(this.fighters[i], this.fighters[1 - i], inputs[i]);
    }

    // Check Melee Clash & Hitbox Collisions
    this.resolveCombatCollisions();

    // Update Projectiles, Delayed Slashes, Rift Seals, Stasis Fields, Portals
    this.updateProjectiles();
    this.updateDelayedSlashes();
    this.updateRiftSeals();
    this.updateStasisFields();
    this.updatePortals();

    // Training auto-heal & Ultimate auto-recharge when combo drops
    if (this.config.mode === 'training' && this.autoHeal) {
      const p1 = this.fighters[0];
      if (p1.action !== 'ultimate' && p1.ultimateGauge < 100) {
        p1.ultimateGauge = Math.min(100, p1.ultimateGauge + 1.5);
      }
      const dummy = this.fighters[1];
      if (dummy.hitstunFrames === 0 && dummy.action !== 'hitstun') {
        if (dummy.damagePercent > 0) {
          dummy.damagePercent = Math.max(0, dummy.damagePercent - 1.8);
        }
        if (dummy.hp < dummy.maxHp) {
          dummy.hp = Math.min(dummy.maxHp, dummy.hp + 15);
        }
      }
    }

    // Match timer in HP / Stock mode (99s in vs_ai)
    if (this.config.mode === 'vs_ai' && this.winnerSlot === null) {
      const remaining = 99 - Math.floor(this.matchFrames / 60);
      if (remaining <= 0) {
        this.resolveTimeOver();
      }
    }

    this.updateParticlesAndCameraOnly();
  }

  private updateParticlesAndCameraOnly(): void {
    // Afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= 0.065;
      if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
    }

    // Slash arcs
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      this.slashArcs[i].life--;
      if (this.slashArcs[i].life <= 0) this.slashArcs.splice(i, 1);
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life--;
      if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.spin) {
        p.angle = (p.angle ?? 0) + p.spin;
      }
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Floating callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy;
      c.vy *= 0.92;
      c.life--;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    // Smooth critically damped camera tracking + Dynamic Ultimate Cutscene Camera & Angles!
    const f1 = this.fighters[0];
    const f2 = this.fighters[1];
    const active1 = f1.action !== 'ko_respawn';
    const active2 = f2.action !== 'ko_respawn';

    let targetX = 0;
    let targetY = 55;
    let targetZoom = 1.08;
    let targetAngle = 0;
    let camLerpSpeed = 0.11;

    const ultFighter =
      f1.action === 'ultimate' ? f1 : f2.action === 'ultimate' ? f2 : null;
    const tauntFighter =
      f1.action === 'taunt' ? f1 : f2.action === 'taunt' ? f2 : null;

    if (ultFighter) {
      const uf = ultFighter.actionFrame;
      camLerpSpeed = 0.16;
      if (uf < 45) {
        // Phase 1: Dramatic Anime Cut-In Close-Up + Dutch Angle Tilt!
        targetX = ultFighter.x + ultFighter.facing * 18;
        targetY = ultFighter.y - 22;
        targetZoom = 1.68;
        targetAngle = -ultFighter.facing * 0.115;
      } else if (uf < 83) {
        // Phase 2: Wide Telegraph & Evasion Window Angle (frames both caster and danger zone so foe can dodge!)
        targetX = ultFighter.x + ultFighter.facing * 72;
        targetY = ultFighter.y - 28;
        targetZoom = 1.12;
        targetAngle = ultFighter.facing * 0.045;
      } else if (uf < 112) {
        // Phase 3: Cataclysm Impact Angle!
        targetX = ultFighter.x + ultFighter.facing * 88;
        targetY = ultFighter.y - 24;
        targetZoom = 1.24;
        targetAngle = -ultFighter.facing * 0.06;
      } else {
        // Phase 4: Smooth recovery back to neutral
        targetX = (f1.x + f2.x) * 0.5;
        targetY = (f1.y + f2.y) * 0.5 - 24;
        targetZoom = 1.08;
        targetAngle = 0;
      }
    } else if (tauntFighter) {
      targetX = (f1.x + f2.x) * 0.5 + (tauntFighter.x - (f1.x + f2.x) * 0.5) * 0.35;
      targetY = tauntFighter.y - 24;
      targetZoom = 1.22;
      targetAngle = tauntFighter.facing * 0.028;
    } else if (active1 && active2) {
      targetX = (f1.x + f2.x) * 0.5 + (f1.vx + f2.vx) * 2.0;
      targetY = (f1.y + f2.y) * 0.5 - 24;
      const dist = Math.hypot(f1.x - f2.x, f1.y - f2.y);
      targetZoom = Math.max(0.78, Math.min(1.26, 1.32 - dist / 520));
      if (this.timeDilation < 0.5) {
        targetZoom = Math.max(targetZoom, 1.24);
      }
    } else if (active1) {
      targetX = f1.x * 0.6;
      targetY = f1.y - 25;
      targetZoom = 1.05;
    } else if (active2) {
      targetX = f2.x * 0.6;
      targetY = f2.y - 25;
      targetZoom = 1.05;
    }

    targetX = Math.max(-240, Math.min(240, targetX));
    targetY = Math.max(-130, Math.min(115, targetY));

    this.camX += (targetX - this.camX) * camLerpSpeed;
    this.camY += (targetY - this.camY) * camLerpSpeed;
    this.camZoom += (targetZoom - this.camZoom) * (ultFighter ? 0.15 : 0.09);
    this.camAngle += (targetAngle - this.camAngle) * 0.14;

    // Screen Shake Decay
    if (this.shakeMag > 0.2) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeMag;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeMag;
      this.shakeMag *= 0.78;
    } else {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private updateFighterInputBuffer(f: FighterState, inp: InputState): void {
    const dirX: -1 | 0 | 1 = inp.right && !inp.left ? 1 : inp.left && !inp.right ? -1 : 0;
    const dirY: -1 | 0 | 1 = inp.down && !inp.up ? 1 : inp.up && !inp.down ? -1 : 0;

    // Age buffer
    for (let i = f.buffer.length - 1; i >= 0; i--) {
      f.buffer[i].ttl--;
      if (f.buffer[i].ttl <= 0) f.buffer.splice(i, 1);
    }

    const pushBuf = (type: BufferedInput['type']) => {
      f.buffer.push({ type, dirX, dirY, ttl: 8 });
    };

    if (inp.ultimate && !f.prevInput.ultimate) pushBuf('ultimate');
    if (inp.taunt && !f.prevInput.taunt) pushBuf('taunt');
    if (inp.special && !f.prevInput.special) pushBuf('special');
    if (inp.strong && !f.prevInput.strong) pushBuf('strong');
    if (inp.light && !f.prevInput.light) pushBuf('light');
    if (inp.shortHop && !f.prevInput.shortHop) pushBuf('shortHop');
    if (inp.jump && !f.prevInput.jump) pushBuf('jump');
    if (inp.dash && !f.prevInput.dash) pushBuf('dash');

    // Double-tap direction dash detection
    if (f.tapDirTimer > 0) f.tapDirTimer--;
    if (dirX !== 0 && ((dirX < 0 && !f.prevInput.left) || (dirX > 0 && !f.prevInput.right))) {
      if (f.tapDirTimer > 0 && f.lastTapDir === dirX && f.grounded && f.action === 'idle') {
        f.action = 'dash';
        f.actionFrame = 0;
        f.facing = dirX;
        f.vx = dirX * f.spec.stats.dashSpeed * (f.overdriveTimer > 0 ? 1.45 : 1);
        this.spawnDust(f.x, f.y + 18, dirX);
      }
      f.lastTapDir = dirX;
      f.tapDirTimer = 13;
    }

    f.prevInput = { ...inp };
  }

  private consumeBuffered(f: FighterState, type: BufferedInput['type']): BufferedInput | null {
    const idx = f.buffer.findIndex((b) => b.type === type);
    if (idx >= 0) {
      const item = f.buffer[idx];
      f.buffer.splice(idx, 1);
      return item;
    }
    return null;
  }

  private stepFighter(f: FighterState, foe: FighterState, inp: InputState): void {
    // Timers
    if (f.invulnFrames > 0) f.invulnFrames--;
    if (f.parryCooldown > 0) f.parryCooldown--;
    if (f.dropThroughTimer > 0) f.dropThroughTimer--;
    if (f.flashWhiteFrames > 0) f.flashWhiteFrames--;
    if (f.stasisSlowTimer > 0) f.stasisSlowTimer--;
    if (f.puppetAttackTimer > 0) f.puppetAttackTimer--;

    // Jin Autonomous Mecha-Puppet "Karasu" Physics & Sync Slash!
    if (f.id === 'jin' && f.puppetActive) {
      this.updateJinPuppet(f, foe);
    }

    // Squash & stretch elastic recovery
    f.squashX += (1 - f.squashX) * 0.24;
    f.squashY += (1 - f.squashY) * 0.24;

    // Hitstop freeze with anime impact body vibration!
    if (f.hitstopFrames > 0) {
      f.hitstopFrames--;
      f.vibrateX =
        f.action === 'hitstun'
          ? (f.hitstopFrames % 2 === 0 ? 1 : -1) * 2.6
          : (f.hitstopFrames % 2 === 0 ? 1 : -1) * 0.8;
      return;
    }
    f.vibrateX = 0;

    // Chrono Stasis Slow Effect: skips every other frame when trapped in Stasis Dome!
    if (f.stasisSlowTimer > 0 && this.tick % 2 === 1) {
      this.updateScarf(f);
      return;
    }

    // Overdrive speed multiplier
    const isOverdrive = f.overdriveTimer > 0;
    if (f.overdriveTimer > 0) {
      f.overdriveTimer--;
      f.gauge = Math.max(0, (f.overdriveTimer / 330) * 100);
      if (this.tick % 2 === 0) {
        this.spawnAfterimage(
          f,
          f.id === 'sol'
            ? this.tick % 4 === 0
              ? '#f97316'
              : '#fde047'
            : this.tick % 4 === 0
            ? '#06b6d4'
            : '#facc15'
        );
      }
    }
    const speedMult = (isOverdrive ? 1.45 : 1.0) * (f.stasisSlowTimer > 0 ? 0.45 : 1.0);

    // Respawn delay
    if (f.action === 'ko_respawn') {
      f.actionFrame++;
      if (f.actionFrame >= 42) {
        const [spawnP1X, spawnP2X] = this.stage.spawnX ?? [-110, 110];
        f.x = f.slot === 0 ? spawnP1X : spawnP2X;
        f.y = -40;
        f.vx = 0;
        f.vy = 0;
        f.action = 'air';
        f.actionFrame = 0;
        f.invulnFrames = 90;
        f.damagePercent = 0;
        f.jumpsLeft = 2;
        f.airDashAvailable = true;
      }
      return;
    }

    f.actionFrame++;

    // Kuro Mid-Air Suspension State!
    if (f.action === 'kuro_suspend') {
      f.vx *= 0.72;
      f.vy = 0;
      f.suspendTimer--;

      const lightTap = this.consumeBuffered(f, 'light');
      const strongTap = this.consumeBuffered(f, 'strong');
      const specTap = this.consumeBuffered(f, 'special');

      if (lightTap || strongTap || specTap || f.suspendTimer <= 0) {
        // Execute Void Back-Dunk!
        f.facing = foe.x >= f.x ? 1 : -1;
        this.startMove(f, f.spec.moves.kuro_suspend_dunk, foe);
      }
      this.updateScarf(f);
      return;
    }

    // Kenji Observation Haki Stance!
    if (f.action === 'kenji_haki') {
      f.vx *= 0.8;
      f.vy *= 0.8;
      f.hakiTimer--;
      if (f.hakiTimer <= 0) {
        f.action = f.grounded ? 'idle' : 'air';
        f.actionFrame = 0;
      }
      this.updateScarf(f);
      return;
    }

    // Signature Character Taunt (T)
    if (f.action === 'taunt') {
      this.stepTaunt(f, foe, inp, speedMult);
      return;
    }

    // Unblockable Cinematic Ultimate (V)
    if (f.action === 'ultimate') {
      this.stepUltimate(f, foe, inp);
      return;
    }

    // Hitstun state
    if (f.action === 'hitstun') {
      f.hitstunFrames--;
      if (f.suspendTimer > 0) {
        f.suspendTimer--;
        f.vx = 0;
        f.vy = 0;
        this.updateScarf(f);
        return;
      }
      if (this.tick % 3 === 0 && Math.hypot(f.vx, f.vy) > 5) {
        this.particles.push({
          x: f.x,
          y: f.y - 8,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: 3,
          color: '#cbd5e1',
          life: 10,
          maxLife: 10,
          gravity: 0,
          drag: 0.95,
          shape: 'pixel',
        });
      }
      if (f.hitstunFrames <= 0) {
        f.action = f.grounded ? 'idle' : 'air';
        f.actionFrame = 0;
        f.comboCountReceived = 0;
        f.comboDamageReceived = 0;
      }
      this.applyPhysics(f, inp, 1.0);
      this.updateScarf(f);
      this.checkBounds(f);
      return;
    }

    // Parry / Air-Dodge
    if (f.action === 'parry' || f.action === 'airdodge') {
      if (f.action === 'airdodge') {
        f.vx *= 0.92;
        f.vy *= 0.92;
        if (this.tick % 2 === 0) this.spawnAfterimage(f, f.spec.accentColor);
      } else {
        f.vx *= 0.78;
      }
      if (f.actionFrame >= (f.action === 'parry' ? 14 : 16)) {
        f.action = f.grounded ? 'idle' : 'air';
        f.actionFrame = 0;
      }
      this.applyPhysics(f, inp, speedMult);
      this.updateScarf(f);
      this.checkBounds(f);
      return;
    }

    // Strong Attack Charging
    if (f.action === 'strong_charge' && f.currentMove) {
      f.vx *= 0.78;
      f.chargeFrames++;
      if (this.tick % 3 === 0) {
        this.particles.push({
          x: f.x + (Math.random() - 0.5) * 36,
          y: f.y - 8 + (Math.random() - 0.5) * 32,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -1.4 - Math.random() * 1.2,
          size: 2.5,
          color: f.spec.secondaryColor,
          life: 12,
          maxLife: 12,
          gravity: 0,
          drag: 0.95,
          shape: 'pixel',
        });
      }
      const maxC = f.currentMove.maxCharge ?? 40;
      if (!inp.strong || f.chargeFrames >= maxC) {
        f.action = 'attack';
        f.actionFrame = 0;
        f.moveHitConnected = false;
        f.moveHitsDone = 0;
        if (f.id === 'jin' && f.puppetActive) {
          f.puppetAttackTimer = 14;
          f.puppetVx += f.facing * 7.5;
        }
        sound.playSwing(0.82, true);
      }
      this.applyPhysics(f, inp, speedMult);
      this.updateScarf(f);
      return;
    }

    // Active Attack Execution
    if (f.action === 'attack' && f.currentMove) {
      const m = f.currentMove;
      const frameStep = isOverdrive ? 1.35 : 1.0;
      const effFrame = Math.floor(f.actionFrame * frameStep);

      // Lunge velocity trigger
      if (m.lungeAtFrame !== undefined && f.actionFrame === m.lungeAtFrame) {
        if (m.lungeX !== undefined) {
          f.vx = f.facing * m.lungeX * (isOverdrive ? 1.25 : 1.0);
        }
        if (m.lungeY !== undefined) {
          f.vy = m.lungeY;
          f.grounded = false;
        }
        if (m.specialTag === 'kuro_shadow_slash' || m.specialTag === 'velo_mach_blitz' || m.specialTag === 'kenji_iaido_draw') {
          sound.playBlink();
        }
      }

      // Afterimages during fast special dashes
      if (
        (m.specialTag === 'kuro_shadow_slash' ||
          m.specialTag === 'velo_mach_blitz' ||
          m.specialTag === 'kenji_iaido_draw' ||
          m.specialTag === 'bram_comet_tackle') &&
        f.actionFrame >= m.startup &&
        f.actionFrame <= m.startup + m.active
      ) {
        if (this.tick % 2 === 0) {
          this.spawnAfterimage(f, f.spec.accentColor);
        }
        // Velo Mach Blitz spawns delayed anime slash cuts!
        if (m.specialTag === 'velo_mach_blitz' && f.actionFrame === m.startup + 3) {
          this.delayedSlashes.push({
            ownerSlot: f.slot,
            x: f.x + f.facing * 12,
            y: f.y - 10,
            angle: (Math.random() - 0.5) * 1.1,
            length: 56,
            timer: 26,
            color: '#06b6d4',
            damage: 6.5,
            knockback: 4.8,
            kbGrowth: 0.045,
          });
          this.delayedSlashes.push({
            ownerSlot: f.slot,
            x: f.x - f.facing * 14,
            y: f.y - 6,
            angle: (Math.random() - 0.5) * 1.2 + 0.6,
            length: 52,
            timer: 32,
            color: '#facc15',
            damage: 6.5,
            knockback: 5.0,
            kbGrowth: 0.048,
          });
        }
      }

      // Spawn slash arc VFX & execute active-frame special detonations on startup completion
      if (f.actionFrame === m.startup) {
        if (m.hitbox.width > 0) {
          this.spawnMoveArc(f, m);
          sound.playSwing(
            m.category === 'strong' ? 0.75 : 1.05,
            m.category === 'strong' || m.category === 'special'
          );
        }

        // Raijin Heavens Judgment: Strike lightning pillars on active frame
        if (m.specialTag === 'raijin_sky_pillar') {
          const myRods = this.riftSeals.filter(
            (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
          );
          for (const rod of myRods) {
            this.shockwaves.push({
              x: rod.x,
              y: rod.y - 8,
              radius: 8,
              maxRadius: 68,
              color: '#38bdf8',
              life: 18,
              maxLife: 18,
              lineWidth: 3,
            });
            this.spawnHitSparks(rod.x, rod.y - 12, '#facc15', 14);
            if (Math.hypot(foe.x - rod.x, foe.y - rod.y) < 58 && foe.invulnFrames <= 0) {
              this.applyHitToFighter(f, foe, {
                offsetX: 0,
                offsetY: 0,
                width: 60,
                height: 90,
                damage: 13.5,
                baseKnockback: 6.8,
                knockbackGrowth: 0.075,
                angleDeg: 84,
                hitstop: 10,
              });
            }
          }
        }

        // Sol Supernova Detonation: Requires 3+ Cinder Marks & within 210px range, never re-applies Cinder!
        if (m.specialTag === 'sol_supernova') {
          const distToFoe = Math.hypot(foe.x - f.x, foe.y - f.y);
          if (foe.cinderMarks >= 3 && distToFoe <= 210 && foe.action !== 'ko_respawn') {
            const stacks = foe.cinderMarks;
            foe.cinderMarks = 0;
            f.moveHitConnected = true; // Prevent melee whip from double-hitting or re-applying Cinder
            this.shockwaves.push({
              x: foe.x,
              y: foe.y - 10,
              radius: 8,
              maxRadius: 46 + stacks * 10,
              color: '#f97316',
              life: 20,
              maxLife: 20,
              lineWidth: 3.5,
            });
            this.spawnHitSparks(foe.x, foe.y - 10, '#fde047', 12 + stacks * 3);
            this.callouts.push({
              x: foe.x,
              y: foe.y - 40,
              vy: -0.8,
              text: `${stacks}x SUPERNOVA!`,
              color: '#fde047',
              life: 32,
              maxLife: 32,
            });
            if (foe.invulnFrames <= 0) {
              this.applyHitToFighter(f, foe, {
                offsetX: 0,
                offsetY: 0,
                width: 64,
                height: 64,
                damage: 5 + stacks * 2.4,
                baseKnockback: 4.8 + stacks * 0.45,
                knockbackGrowth: 0.052 + stacks * 0.005,
                angleDeg: 78,
                hitstop: 7 + stacks,
                breaksArmor: stacks >= 4,
                appliesCinder: false,
              });
            }
          } else if (foe.cinderMarks > 0 && foe.cinderMarks < 3 && distToFoe > 68) {
            this.callouts.push({
              x: f.x,
              y: f.y - 36,
              vy: -0.5,
              text: `NEED 3 CINDERS (${foe.cinderMarks}/3)`,
              color: '#fb923c',
              life: 22,
              maxLife: 22,
            });
          }
        }

        // Jin Razor Wire Cross-Snap: Slices & pulls any target between Jin and Karasu!
        if (m.specialTag === 'jin_thread_guillotine') {
          this.triggerJinThreadGuillotine(f, foe);
        }

        // Jin Iron Maiden Pincer Drop: Karasu slams down on the active frame!
        if (m.specialTag === 'jin_puppet_ambush') {
          this.shockwaves.push({
            x: f.puppetX,
            y: f.puppetY,
            radius: 6,
            maxRadius: 56,
            color: '#2dd4bf',
            life: 16,
            maxLife: 16,
            lineWidth: 3,
          });
          this.spawnHitSparks(f.puppetX, f.puppetY, '#2dd4bf', 14);
          if (
            foe.action !== 'ko_respawn' &&
            foe.invulnFrames <= 0 &&
            Math.hypot(foe.x - f.puppetX, foe.y - 8 - f.puppetY) <= 52
          ) {
            this.applyHitToFighter(f, foe, {
              offsetX: 0,
              offsetY: 0,
              width: 52,
              height: 52,
              damage: 11.5,
              baseKnockback: 5.8,
              knockbackGrowth: 0.062,
              angleDeg: 68,
              hitstop: 8,
            });
          }
        }
      }

      // Jab Combo Cancel Window
      if (m.canCancelIntoJab && f.actionFrame >= m.startup + 2) {
        const nextJab = this.consumeBuffered(f, 'light');
        if (nextJab) {
          this.startMove(f, f.spec.moves[m.canCancelIntoJab], foe);
          this.updateScarf(f);
          return;
        }
      }

      // Kuro Anchor Return after Void Back-Dunk completes!
      const total = m.startup + m.active + m.recovery;
      if (effFrame >= total) {
        if (m.specialTag === 'kuro_dunk_return' && f.anchorActive) {
          this.spawnBlinkBurst(f.x, f.y - 8, f.spec.accentColor);
          f.x = f.anchorX;
          f.y = f.anchorY;
          f.vx = 0;
          f.vy = 0;
          f.anchorActive = false;
          this.spawnBlinkBurst(f.x, f.y - 8, f.spec.secondaryColor);
          sound.playBlink();
        }
        f.currentMove = null;
        f.action = f.grounded ? 'idle' : 'air';
        f.actionFrame = 0;
      }

      this.applyPhysics(f, inp, speedMult, m.gravityScale ?? 1.0, true);
      this.updateScarf(f);
      this.checkBounds(f);
      return;
    }

    // Jump Squat
    if (f.action === 'jump_squat') {
      if (f.actionFrame >= 3) {
        const isShort = f.lastMoveKey === null && !inp.jump;
        f.vy = isShort ? -f.spec.stats.shortHopForce : -f.spec.stats.jumpForce;
        f.grounded = false;
        f.onPlatform = false;
        f.action = 'air';
        f.actionFrame = 0;
        f.squashX = 0.78;
        f.squashY = 1.24;
        this.spawnDust(f.x, f.y + 18, 0);
        sound.playJump(isShort);
      }
      this.applyPhysics(f, inp, speedMult);
      this.updateScarf(f);
      return;
    }

    // Free Movement & Actionable Buffer Handling!
    const dirX: -1 | 0 | 1 = inp.right && !inp.left ? 1 : inp.left && !inp.right ? -1 : 0;
    const dirY: -1 | 0 | 1 = inp.down && !inp.up ? 1 : inp.up && !inp.down ? -1 : 0;

    // Platform drop-through (`S` on semi-solid platform)
    if (f.grounded && f.onPlatform && dirY === 1 && this.tick % 2 === 0) {
      f.dropThroughTimer = 14;
      f.grounded = false;
      f.onPlatform = false;
      f.y += 4;
    }

    // 0. Check Buffered Ultimate Awakening (V)
    const bufUlt = this.consumeBuffered(f, 'ultimate');
    if (bufUlt) {
      if (f.ultimateGauge >= 100) {
        if (bufUlt.dirX !== 0) f.facing = bufUlt.dirX;
        else f.facing = foe.x >= f.x ? 1 : -1;
        f.ultimateGauge = 0;
        f.action = 'ultimate';
        f.actionFrame = 0;
        f.currentMove = null;
        f.moveHitConnected = false;
        f.moveHitsDone = 0;
        f.vx = 0;
        f.vy = 0;
        f.invulnFrames = 90;
        f.anchorX = f.x + f.facing * 96;
        f.anchorY = f.y - 10;
        this.impactFrames = 4;
        this.shakeMag = Math.max(this.shakeMag, 9);
        this.shockwaves.push({
          x: f.x,
          y: f.y - 12,
          radius: 6,
          maxRadius: 88,
          color: f.spec.secondaryColor,
          life: 22,
          maxLife: 22,
          lineWidth: 3.5,
        });
        this.spawnHitSparks(f.x, f.y - 14, f.spec.secondaryColor, 20);
        this.callouts.push({
          x: f.x,
          y: f.y - 44,
          vy: -0.5,
          text: f.spec.ultimateName,
          color: '#fde047',
          life: 44,
          maxLife: 44,
        });
        sound.playUltimateActivation();
        this.updateScarf(f);
        return;
      } else {
        this.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.5,
          text: `ULTIMATE ${Math.floor(f.ultimateGauge)}%`,
          color: '#94a3b8',
          life: 20,
          maxLife: 20,
        });
      }
    }

    // 1. Check Buffered Specials (J)
    const bufSpec = this.consumeBuffered(f, 'special');
    if (bufSpec) {
      if (bufSpec.dirX !== 0) f.facing = bufSpec.dirX;
      let moveKey: MoveKey = 'nspecial';
      if (bufSpec.dirY < 0) moveKey = 'uspecial';
      else if (bufSpec.dirY > 0) moveKey = 'dspecial';
      else if (bufSpec.dirX !== 0) moveKey = 'sspecial';
      this.startMove(f, f.spec.moves[moveKey], foe);
      this.updateScarf(f);
      return;
    }

    // 2. Check Buffered Strongs (L)
    const bufStrong = this.consumeBuffered(f, 'strong');
    if (bufStrong) {
      if (bufStrong.dirX !== 0) f.facing = bufStrong.dirX;
      let moveKey: MoveKey = 'fstrong';
      if (bufStrong.dirY < 0) moveKey = 'ustrong';
      else if (bufStrong.dirY > 0) moveKey = 'dstrong';
      const move = f.spec.moves[moveKey];
      if (f.grounded && move.canCharge) {
        f.action = 'strong_charge';
        f.actionFrame = 0;
        f.currentMove = move;
        f.chargeFrames = 0;
      } else {
        this.startMove(f, move, foe);
      }
      this.updateScarf(f);
      return;
    }

    // 3. Check Buffered Lights (K)
    const bufLight = this.consumeBuffered(f, 'light');
    if (bufLight) {
      if (!f.grounded) {
        let airKey: MoveKey = 'nair';
        if (bufLight.dirY < 0) airKey = 'uair';
        else if (bufLight.dirY > 0) airKey = 'dair';
        else if (bufLight.dirX !== 0) {
          airKey = bufLight.dirX === f.facing ? 'fair' : 'bair';
        }
        this.startMove(f, f.spec.moves[airKey], foe);
      } else {
        if (bufLight.dirX !== 0) f.facing = bufLight.dirX;
        let gKey: MoveKey = 'jab1';
        if (bufLight.dirY < 0) gKey = 'utilt';
        else if (bufLight.dirY > 0) gKey = 'dtilt';
        else if (bufLight.dirX !== 0) gKey = 'ftilt';
        this.startMove(f, f.spec.moves[gKey], foe);
      }
      this.updateScarf(f);
      return;
    }

    // 4. Check P Button: Dash when moving, Parry when standing still!
    const bufDash = this.consumeBuffered(f, 'dash');
    if (bufDash) {
      const moveDirX: -1 | 0 | 1 = bufDash.dirX !== 0 ? bufDash.dirX : dirX;
      const moveDirY: -1 | 0 | 1 = bufDash.dirY !== 0 ? bufDash.dirY : dirY;
      const isMoving = f.grounded ? moveDirX !== 0 : moveDirX !== 0 || moveDirY !== 0;

      if (isMoving) {
        if (f.grounded) {
          // Ground Dash Burst (P + Left/Right)
          f.action = 'dash';
          f.actionFrame = 0;
          f.facing = moveDirX !== 0 ? moveDirX : f.facing;
          f.vx = f.facing * f.spec.stats.dashSpeed * 1.48 * speedMult;
          f.invulnFrames = 7;
          f.squashX = 1.28;
          f.squashY = 0.76;
          this.spawnAfterimage(f, f.spec.accentColor);
          this.spawnDashWindCone(f.x + f.facing * 12, f.y - 8, f.facing > 0 ? 0 : Math.PI, f.spec.accentColor);
          this.spawnDust(f.x, f.y + 18, f.facing);
          sound.playDash();
          this.updateScarf(f);
          return;
        } else if (f.airDashAvailable) {
          // Directional Air-Dash (P + Direction in air)
          f.airDashAvailable = false;
          f.action = 'airdodge';
          f.actionFrame = 0;
          f.invulnFrames = 12;
          const dx = moveDirX !== 0 ? moveDirX : f.facing;
          const dy = moveDirY;
          if (moveDirX !== 0) f.facing = moveDirX;
          const norm = Math.hypot(dx, dy) || 1;
          f.vx = (dx / norm) * 10.2 * speedMult;
          f.vy = (dy / norm) * 8.0 * speedMult;
          f.squashX = 1.24;
          f.squashY = 0.78;
          this.spawnAfterimage(f, f.spec.accentColor);
          this.spawnDashWindCone(f.x, f.y - 8, Math.atan2(f.vy, f.vx), f.spec.accentColor);
          sound.playDash();
          this.updateScarf(f);
          return;
        }
      } else if (f.parryCooldown <= 0) {
        // Standing Still / Neutral P -> PARRY Stance!
        f.action = 'parry';
        f.actionFrame = 0;
        f.invulnFrames = 13;
        f.parryCooldown = 26;
        f.vx *= 0.2;
        if (!f.grounded) {
          f.vy = Math.min(0.4, f.vy * 0.25);
        }
        this.shockwaves.push({
          x: f.x,
          y: f.y - 8,
          radius: 5,
          maxRadius: 32,
          color: '#f8fafc',
          life: 12,
          maxLife: 12,
          lineWidth: 2.2,
        });
        this.particles.push({
          x: f.x + f.facing * 10,
          y: f.y - 12,
          vx: 0,
          vy: 0,
          size: 4.5,
          color: f.spec.secondaryColor,
          life: 10,
          maxLife: 10,
          gravity: 0,
          drag: 1,
          shape: 'flare',
          angle: 0,
          spin: 0.12,
        });
        sound.playParryStance();
        this.updateScarf(f);
        return;
      }
    }

    // 5. Check Short Hop (C) & Full Jump (Space)
    const bufShort = this.consumeBuffered(f, 'shortHop');
    const bufJump = this.consumeBuffered(f, 'jump');
    if (bufShort || bufJump) {
      if (f.grounded) {
        f.vy = bufShort ? -f.spec.stats.shortHopForce : -f.spec.stats.jumpForce;
        f.grounded = false;
        f.onPlatform = false;
        f.action = 'air';
        f.actionFrame = 0;
        f.squashX = 0.78;
        f.squashY = 1.24;
        this.spawnDust(f.x, f.y + 18, 0);
        sound.playJump(Boolean(bufShort));
      } else if (f.jumpsLeft > 0) {
        f.jumpsLeft--;
        f.vy = bufShort ? -f.spec.stats.shortHopForce * 0.95 : -f.spec.stats.jumpForce * 0.95;
        f.fastFalling = false;
        f.action = 'air';
        f.actionFrame = 0;
        f.squashX = 0.8;
        f.squashY = 1.22;
        this.shockwaves.push({
          x: f.x,
          y: f.y + 16,
          radius: 3,
          maxRadius: 18,
          color: f.spec.accentColor,
          life: 10,
          maxLife: 10,
          lineWidth: 1.5,
        });
        sound.playJump(Boolean(bufShort));
      }
    }

    // 6. Check Buffered Taunt (T) when grounded
    const bufTaunt = this.consumeBuffered(f, 'taunt');
    if (bufTaunt && f.grounded) {
      f.facing = foe.x >= f.x ? 1 : -1;
      f.action = 'taunt';
      f.actionFrame = 0;
      f.currentMove = null;
      f.vx *= 0.25;
      sound.playTaunt(f.id);
      this.updateScarf(f);
      return;
    }

    // Horizontal ground/air locomotion
    if (f.grounded) {
      if (f.action === 'dash' && f.actionFrame < 9 && this.tick % 2 === 0) {
        this.spawnAfterimage(f, f.spec.accentColor);
      }
      if (dirX !== 0) {
        f.facing = dirX;
        const targetVx =
          dirX *
          (f.action === 'dash' ? f.spec.stats.dashSpeed * 1.15 : f.spec.stats.walkSpeed) *
          speedMult;
        f.vx += (targetVx - f.vx) * (f.action === 'dash' ? 0.22 : 0.34);
        if (f.action !== 'dash') f.action = 'walk';
      } else {
        f.vx *= 0.74;
        if (Math.abs(f.vx) < 0.25) {
          f.vx = 0;
          f.action = 'idle';
        }
      }
    } else {
      f.action = 'air';
      if (dirX !== 0) {
        const targetVx = dirX * f.spec.stats.airSpeed * speedMult;
        f.vx += (targetVx - f.vx) * 0.14;
      } else {
        f.vx *= 0.96;
      }
      if (dirY === 1 && f.vy > -1.5) {
        f.fastFalling = true;
      }
    }

    this.applyPhysics(f, inp, speedMult);
    this.updateScarf(f);
    this.checkBounds(f);
  }

  private stepTaunt(f: FighterState, foe: FighterState, inp: InputState, speedMult: number): void {
    f.vx *= 0.76;

    // Frame 2: Display signature quote & spawn character-themed aura flourish
    if (f.actionFrame === 2) {
      this.callouts.push({
        x: f.x,
        y: f.y - 42,
        vy: -0.45,
        text: f.spec.tauntQuote,
        color: f.spec.secondaryColor,
        life: 44,
        maxLife: 44,
      });
      this.shockwaves.push({
        x: f.x,
        y: f.y - 10,
        radius: 4,
        maxRadius: 38,
        color: f.spec.accentColor,
        life: 16,
        maxLife: 16,
        lineWidth: 2,
      });
    }

    // Character-specific continuous taunt particle flourishes
    if (f.actionFrame % 4 === 0 && f.actionFrame < 38) {
      const ang = (f.actionFrame * 0.45) + (f.facing > 0 ? 0 : Math.PI);
      this.particles.push({
        x: f.x + Math.cos(ang) * 16,
        y: f.y - 12 + Math.sin(ang) * 12,
        vx: Math.cos(ang) * 1.1,
        vy: -1.1 - Math.random() * 0.9,
        size: 3.2,
        color: f.actionFrame % 8 === 0 ? '#ffffff' : f.spec.secondaryColor,
        life: 14,
        maxLife: 14,
        gravity: -0.02,
        drag: 0.94,
        shape: f.id === 'raijin' || f.id === 'velo' ? 'spark' : 'flare',
        angle: ang,
        spin: 0.12,
      });
    }

    // Frame 14: Reward taunt commitment with +14% Ultimate Gauge & +8% Signature Gauge!
    if (f.actionFrame === 14) {
      f.ultimateGauge = Math.min(100, f.ultimateGauge + 14);
      f.gauge = Math.min(100, f.gauge + 8);
      if (f.id === 'bram') {
        f.armorStacks = Math.min(3, f.armorStacks + 1);
        this.shakeMag = Math.max(this.shakeMag, 4.5);
      } else if (f.id === 'jin' && f.puppetActive) {
        f.puppetAttackTimer = 18;
      }
      this.spawnHitSparks(f.x + f.facing * 10, f.y - 14, f.spec.secondaryColor, 8);
    }

    // Cancelable after frame 16 into movement, dodge, jump, or attack so taunting feels responsive
    if (f.actionFrame >= 16) {
      const hasActionInput =
        inp.left ||
        inp.right ||
        inp.jump ||
        inp.shortHop ||
        inp.light ||
        inp.strong ||
        inp.special ||
        inp.dash ||
        inp.ultimate;
      if (hasActionInput) {
        f.action = f.grounded ? 'idle' : 'air';
        f.actionFrame = 0;
        this.applyPhysics(f, inp, speedMult);
        this.updateScarf(f);
        this.checkBounds(f);
        return;
      }
    }

    if (f.actionFrame >= 46) {
      f.action = f.grounded ? 'idle' : 'air';
      f.actionFrame = 0;
    }

    this.applyPhysics(f, inp, speedMult);
    this.updateScarf(f);
    this.checkBounds(f);
  }

  private stepUltimate(f: FighterState, foe: FighterState, inp: InputState): void {
    const af = f.actionFrame;

    // Caster has invulnerability during Cutscene (0..44) and Telegraph (45..86)
    if (af <= 86) {
      f.invulnFrames = Math.max(f.invulnFrames, 4);
    }

    // PHASE 1 (Frames 1..44): Cinematic Cutscene Freeze & Awakening Aura
    if (af <= 44) {
      f.vx *= 0.5;
      f.vy = 0;
      if (af % 3 === 0) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 26;
        this.particles.push({
          x: f.x + Math.cos(ang) * dist,
          y: f.y - 12 + Math.sin(ang) * dist,
          vx: -Math.cos(ang) * 2.4,
          vy: -Math.sin(ang) * 2.4,
          size: 3.5,
          color: af % 6 === 0 ? '#fde047' : f.spec.secondaryColor,
          life: 14,
          maxLife: 14,
          gravity: 0,
          drag: 0.92,
          shape: 'flare',
          angle: ang,
          spin: 0.15,
        });
      }
      // Lock initial target zone at end of cutscene
      if (af === 44) {
        const mainPlat = this.stage.platforms[0];
        const minSafeX = mainPlat ? mainPlat.x + 28 : this.stage.blastLeft + 110;
        const maxSafeX = mainPlat ? mainPlat.x + mainPlat.width - 28 : this.stage.blastRight - 110;
        f.facing = foe.x >= f.x ? 1 : -1;
        if (f.id === 'velo') {
          f.anchorX = Math.max(minSafeX, Math.min(maxSafeX, foe.x));
          f.anchorY = mainPlat ? mainPlat.y - 18 : 82;
        } else {
          f.anchorX = Math.max(minSafeX, Math.min(maxSafeX, f.x + f.facing * 98));
          f.anchorY = f.y - 10;
        }
      }
      this.updateScarf(f);
      return;
    }

    // PHASE 2 (Frames 45..82): Telegraph & Evasion Window (38 frames / ~0.63s — opponent can RUN & DODGE!)
    if (af === 45) {
      this.callouts.push({
        x: f.anchorX,
        y: f.anchorY - 48,
        vy: -0.25,
        text: '⚠ UNBLOCKABLE — EVADE!',
        color: '#ef4444',
        life: 38,
        maxLife: 38,
      });
      sound.playSwing(0.65, true);
    }

    if (af >= 45 && af <= 82) {
      const mainPlat = this.stage.platforms[0];
      const minSafeX = mainPlat ? mainPlat.x + 28 : this.stage.blastLeft + 110;
      const maxSafeX = mainPlat ? mainPlat.x + mainPlat.width - 28 : this.stage.blastRight - 110;

      // Character-specific telegraph kinematics & danger zone behaviors
      if (f.id === 'velo') {
        // Velo ascends into the stratosphere while his orbital laser reticle tracks then locks!
        f.vx = 0;
        f.vy = f.y > -90 ? -3.8 : 0;
        f.y += f.vy;
        f.grounded = false;
        if (af <= 66) {
          // Tracks opponent until frame 66, then locks in place for 16 frames so opponent can dash out!
          const nextAnchorX = f.anchorX + (foe.x - f.anchorX) * 0.14;
          f.anchorX = Math.max(minSafeX, Math.min(maxSafeX, nextAnchorX));
          f.anchorY = foe.grounded ? foe.y : mainPlat ? mainPlat.y - 18 : 82;
        }
      } else if (f.id === 'kuro' || f.id === 'raijin' || f.id === 'sol') {
        // Levitate ominously while channeling
        f.vx *= 0.7;
        f.vy = af < 65 ? -0.45 : 0;
        f.y += f.vy;
        f.grounded = false;
      } else if (f.id === 'bram') {
        // Bram's Singularity gently tugs the air toward the danger zone (still easy to dash/jump out!)
        f.vx = 0;
        f.vy = 0;
        const distToZone = Math.hypot(foe.x - f.anchorX, foe.y - f.anchorY);
        if (distToZone < 165 && foe.action !== 'ko_respawn') {
          const pullDir = f.anchorX >= foe.x ? 1 : -1;
          foe.vx += pullDir * 0.34;
        }
      } else if (f.id === 'jin') {
        f.vx = 0;
        f.vy = 0;
        f.puppetActive = true;
        f.puppetX += (f.anchorX - f.puppetX) * 0.25;
        f.puppetY += (f.anchorY - 26 - f.puppetY) * 0.25;
      } else {
        f.vx *= 0.7;
        f.vy = 0;
      }

      // Telegraph danger border sparks
      if (af % 3 === 0) {
        this.particles.push({
          x: f.anchorX + (Math.random() - 0.5) * 140,
          y: f.anchorY + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: -1.4 - Math.random() * 1.2,
          size: 2.8,
          color: af % 6 === 0 ? '#ef4444' : f.spec.secondaryColor,
          life: 12,
          maxLife: 12,
          gravity: 0,
          drag: 0.94,
          shape: 'spark',
          angle: -Math.PI * 0.5,
        });
      }

      this.updateScarf(f);
      return;
    }

    // PHASE 3 (Frames 83..105): Unblockable Cataclysm Detonation!
    if (af === 83) {
      sound.playUltimateImpact();
      this.impactFrames = 5;
      this.triggerTimeDilation(0.26, 20);
      this.shakeMag = 16;

      const mainPlat = this.stage.platforms[0];
      const minSafeX = mainPlat ? mainPlat.x + 28 : this.stage.blastLeft + 110;
      const maxSafeX = mainPlat ? mainPlat.x + mainPlat.width - 28 : this.stage.blastRight - 110;

      // Character-specific lunge/reposition on Frame 83
      if (f.id === 'velo') {
        // Orbital Mach-10 dive straight onto the locked reticle!
        f.x = Math.max(minSafeX, Math.min(maxSafeX, f.anchorX));
        f.y = f.anchorY;
        f.vx = 0;
        f.vy = 0;
      } else if (f.id === 'kenji') {
        // Horizon-severing Iaido dash across the danger zone (clamped to main platform so he never self-SDs!)
        this.spawnAfterimage(f, '#ef4444');
        f.x = Math.max(minSafeX, Math.min(maxSafeX, f.x + f.facing * 140));
        f.vx = 0;
        f.vy = 0;
        this.spawnAfterimage(f, '#f59e0b');
      }

      // Spawn monumental shockwaves & bursts at the cataclysm zone
      this.shockwaves.push({
        x: f.anchorX,
        y: f.anchorY - 6,
        radius: 10,
        maxRadius: 118,
        color: f.spec.secondaryColor,
        life: 24,
        maxLife: 24,
        lineWidth: 4.5,
      });
      this.shockwaves.push({
        x: f.anchorX,
        y: f.anchorY - 6,
        radius: 6,
        maxRadius: 84,
        color: '#ffffff',
        life: 18,
        maxLife: 18,
        lineWidth: 3,
      });
      this.spawnHitSparks(f.anchorX, f.anchorY - 8, f.spec.secondaryColor, 28);
      this.slashArcs.push({
        x: f.anchorX,
        y: f.anchorY - 8,
        angleStart: -Math.PI,
        angleEnd: Math.PI,
        radius: 68,
        thickness: 9,
        color: f.spec.accentColor,
        coreColor: '#ffffff',
        life: 16,
        maxLife: 16,
        facing: f.facing,
      });
    }

    // Active Unblockable Hitbox Window (Frames 83..96)
    if (af >= 83 && af <= 96 && !f.moveHitConnected && foe.action !== 'ko_respawn') {
      // Determine danger zone half-width & half-height per character
      let halfW = 86;
      let halfH = 74;
      if (f.id === 'kenji' || f.id === 'raijin') {
        halfW = 108;
        halfH = 64;
      } else if (f.id === 'velo' || f.id === 'chrono') {
        halfW = 78;
        halfH = 82;
      }

      const inDangerZone =
        Math.abs(foe.x - f.anchorX) <= halfW && Math.abs((foe.y - 10) - f.anchorY) <= halfH;

      if (inDangerZone) {
        // UNBLOCKABLE: Shatter Parry & Kenji Haki Counter unconditionally!
        if (foe.action === 'parry' || foe.action === 'kenji_haki') {
          foe.invulnFrames = 0;
          this.callouts.push({
            x: foe.x,
            y: foe.y - 48,
            vy: -0.8,
            text: 'GUARD SHATTERED!',
            color: '#ef4444',
            life: 34,
            maxLife: 34,
          });
        }

        // Only evaded if opponent escaped the zone or is mid air-dodge/dash i-frames at the edge
        if (foe.invulnFrames <= 0) {
          f.moveHitConnected = true;
          f.specialsLanded++;
          if (f.id === 'sol') {
            foe.cinderMarks = 5;
          }
          this.applyHitToFighter(
            f,
            foe,
            {
              offsetX: 0,
              offsetY: 0,
              width: halfW * 2,
              height: halfH * 2,
              damage: 36,
              baseKnockback: 9.8,
              knockbackGrowth: 0.095,
              angleDeg: f.id === 'kuro' || f.id === 'bram' ? 68 : 76,
              hitstop: 16,
              breaksArmor: true,
              unblockable: true,
              hitstunBonus: 14,
            },
            1.0,
            1.0
          );
          this.callouts.push({
            x: foe.x,
            y: foe.y - 52,
            vy: -0.7,
            text: 'CATACLYSM HIT!',
            color: '#fde047',
            life: 40,
            maxLife: 40,
          });
        }
      }
    }

    // Recovery Phase (Frames 97..135)
    if (af >= 97) {
      this.applyPhysics(f, inp, 1.0);
    }

    if (af >= 135) {
      f.action = f.grounded ? 'idle' : 'air';
      f.actionFrame = 0;
      f.currentMove = null;
    }

    this.updateScarf(f);
    this.checkBounds(f);
  }

  private startMove(f: FighterState, move: MoveData, foe: FighterState): void {
    // Handle Special Ability Activation Hooks!
    if (move.specialTag === 'kuro_blink_suspend') {
      // Save anchor & blink behind opponent suspended mid-air!
      f.anchorX = f.x;
      f.anchorY = f.y;
      f.anchorActive = true;
      this.spawnBlinkBurst(f.x, f.y - 8, f.spec.accentColor);

      const behindX = foe.x - foe.facing * 36;
      const hoverY = foe.y - 24;
      f.x = Math.max(this.stage.blastLeft + 60, Math.min(this.stage.blastRight - 60, behindX));
      f.y = Math.max(this.stage.blastTop + 60, hoverY);
      f.vx = 0;
      f.vy = 0;
      f.facing = foe.x >= f.x ? 1 : -1;
      f.action = 'kuro_suspend';
      f.actionFrame = 0;
      f.suspendTimer = 42;
      f.currentMove = null;
      f.invulnFrames = 10;
      this.spawnBlinkBurst(f.x, f.y - 8, f.spec.secondaryColor);
      this.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.6,
        text: 'SUSPEND!',
        color: '#e879f9',
        life: 28,
        maxLife: 28,
      });
      sound.playBlink();
      return;
    }

    if (move.specialTag === 'velo_overdrive') {
      if (f.gauge >= 35 && f.overdriveTimer <= 0) {
        f.overdriveTimer = 330; // 5.5 seconds of Hyper Speed!
        this.shockwaves.push({
          x: f.x,
          y: f.y - 8,
          radius: 8,
          maxRadius: 72,
          color: '#06b6d4',
          life: 20,
          maxLife: 20,
          lineWidth: 3,
        });
        this.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'HYPER OVERDRIVE!',
          color: '#facc15',
          life: 36,
          maxLife: 36,
        });
        this.shakeMag = 6;
        sound.playOverdrive();
      } else {
        // Fire Sonic Vacuum Blade projectile!
        this.projectiles.push({
          id: this.nextProjId++,
          ownerSlot: f.slot,
          x: f.x + f.facing * 20,
          y: f.y - 8,
          vx: f.facing * 8.6,
          vy: 0,
          radius: 7,
          damage: 6,
          baseKnockback: 3.6,
          knockbackGrowth: 0.032,
          angleDeg: 36,
          ttl: 48,
          color: '#06b6d4',
          kind: 'sonic_blade',
        });
        sound.playSwing(1.3);
      }
    }

    if (move.specialTag === 'kenji_haki_stance') {
      f.action = 'kenji_haki';
      f.actionFrame = 0;
      f.hakiTimer = 34;
      f.currentMove = null;
      this.shockwaves.push({
        x: f.x,
        y: f.y - 10,
        radius: 6,
        maxRadius: 48,
        color: '#ef4444',
        life: 18,
        maxLife: 18,
        lineWidth: 2,
      });
      this.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.5,
        text: 'OBSERVATION',
        color: '#f59e0b',
        life: 26,
        maxLife: 26,
      });
      sound.playHakiPulse();
      return;
    }

    if (move.specialTag === 'bram_rift_seal') {
      const existingIdx = this.riftSeals.findIndex(
        (s) => s.ownerSlot === f.slot && (!s.kind || s.kind === 'bram_seal')
      );
      if (existingIdx >= 0) {
        // Detonate existing Rift Seal!
        const seal = this.riftSeals[existingIdx];
        this.riftSeals.splice(existingIdx, 1);
        this.detonateRiftSeal(f, seal);
      } else {
        this.riftSeals.push({
          ownerSlot: f.slot,
          x: f.x + f.facing * 18,
          y: f.y - 4,
          ttl: 420,
          pulse: 0,
          color: '#10b981',
          kind: 'bram_seal',
        });
        this.shockwaves.push({
          x: f.x + f.facing * 18,
          y: f.y - 4,
          radius: 4,
          maxRadius: 34,
          color: '#10b981',
          life: 14,
          maxLife: 14,
          lineWidth: 2,
        });
        sound.playHakiPulse();
      }
    }

    // =========================================================================
    // 5 NEW FIGHTERS' SIGNATURE SPECIAL MECHANICS
    // =========================================================================

    // 5. RAIJIN — Storm Conduit (Lightning Rod Network & High-Voltage Arc Warp)
    if (move.specialTag === 'raijin_rod_plant') {
      const myRods = this.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      );
      if (myRods.length >= 2) {
        // Detonate High-Voltage Chain Lightning between all planted rods!
        this.detonateRaijinRodNetwork(f, foe, myRods);
        this.riftSeals = this.riftSeals.filter(
          (s) => !(s.ownerSlot === f.slot && s.kind === 'raijin_rod')
        );
      } else {
        const rx = f.x + f.facing * 28;
        const ry = f.y;
        this.riftSeals.push({
          ownerSlot: f.slot,
          x: rx,
          y: ry,
          ttl: 520,
          pulse: 0,
          color: '#38bdf8',
          kind: 'raijin_rod',
        });
        this.shockwaves.push({
          x: rx,
          y: ry - 6,
          radius: 4,
          maxRadius: 36,
          color: '#facc15',
          life: 14,
          maxLife: 14,
          lineWidth: 2.2,
        });
        this.callouts.push({
          x: rx,
          y: ry - 34,
          vy: -0.6,
          text: myRods.length === 1 ? 'ROD LINKED!' : 'THUNDER ROD!',
          color: '#38bdf8',
          life: 24,
          maxLife: 24,
        });
        sound.playHakiPulse();
      }
    }

    if (move.specialTag === 'raijin_flash_lance') {
      const myRods = this.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      );
      if (myRods.length > 0) {
        // Warp instantly along electric arc to the furthest rod!
        const targetRod = myRods[myRods.length - 1];
        this.spawnBlinkBurst(f.x, f.y - 8, '#38bdf8');
        f.x = targetRod.x - f.facing * 12;
        f.y = targetRod.y;
        f.facing = foe.x >= f.x ? 1 : -1;
        this.spawnBlinkBurst(f.x, f.y - 8, '#facc15');
        this.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.6,
          text: 'ARC WARP!',
          color: '#facc15',
          life: 24,
          maxLife: 24,
        });
        sound.playBlink();
      }
    }

    // 6. CHRONO — Zero Hour (Temporal Echo Rewind & Stasis Dome)
    if (move.specialTag === 'chrono_echo_rewind') {
      const echoIdx = this.riftSeals.findIndex(
        (s) => s.ownerSlot === f.slot && s.kind === 'chrono_echo'
      );
      if (echoIdx >= 0) {
        const echo = this.riftSeals[echoIdx];
        this.riftSeals.splice(echoIdx, 1);
        f.anchorActive = false;
        this.delayedSlashes.push({
          ownerSlot: f.slot,
          x: f.x,
          y: f.y - 10,
          angle: 0.45,
          length: 64,
          timer: 12,
          color: '#14b8a6',
          damage: 9,
          knockback: 5.5,
          kbGrowth: 0.055,
        });
        this.spawnBlinkBurst(f.x, f.y - 10, '#14b8a6');
        f.x = echo.x;
        f.y = echo.y;
        f.vx = 0;
        f.vy = 0;
        f.facing = foe.x >= f.x ? 1 : -1;
        f.damagePercent = Math.max(0, f.damagePercent - 5);
        f.hp = Math.min(f.maxHp, f.hp + 45);
        this.spawnBlinkBurst(f.x, f.y - 10, '#fbbf24');
        this.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'ZERO REWIND!',
          color: '#fbbf24',
          life: 30,
          maxLife: 30,
        });
        sound.playBlink();
      } else {
        this.riftSeals.push({
          ownerSlot: f.slot,
          x: f.x,
          y: f.y,
          ttl: 540,
          pulse: 0,
          color: '#14b8a6',
          kind: 'chrono_echo',
        });
        f.anchorX = f.x;
        f.anchorY = f.y;
        f.anchorActive = true;
        this.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.6,
          text: 'ECHO SAVED',
          color: '#2dd4bf',
          life: 24,
          maxLife: 24,
        });
        sound.playHakiPulse();
      }
    }

    if (move.specialTag === 'chrono_stasis_bubble') {
      this.stasisFields = this.stasisFields.filter((sf) => sf.ownerSlot !== f.slot);
      const sx = f.x + f.facing * 56;
      const sy = f.y - 10;
      this.stasisFields.push({
        ownerSlot: f.slot,
        x: sx,
        y: sy,
        radius: 52,
        ttl: 195,
        maxTtl: 195,
      });
      this.callouts.push({
        x: sx,
        y: sy - 42,
        vy: -0.5,
        text: 'STASIS DOME!',
        color: '#2dd4bf',
        life: 28,
        maxLife: 28,
      });
      sound.playHakiPulse();
    }

    // 7. SOL — Ashen Phoenix (Remote Cinder Stack Detonation, Chain Grapple & Berserk Mantle)
    if (move.specialTag === 'sol_chain_grapple') {
      this.projectiles.push({
        id: this.nextProjId++,
        ownerSlot: f.slot,
        x: f.x + f.facing * 20,
        y: f.y - 10,
        vx: f.facing * 9.8,
        vy: 0,
        radius: 7,
        damage: 6.5,
        baseKnockback: 4.5,
        knockbackGrowth: 0.032,
        angleDeg: 35,
        ttl: 24,
        color: '#f97316',
        kind: 'chain_hook',
      });
      sound.playSwing(0.9, true);
    }

    if (move.specialTag === 'sol_hellfire_mantle') {
      if (f.gauge >= 40 && f.overdriveTimer <= 0) {
        f.gauge = Math.max(0, f.gauge - 40);
        f.overdriveTimer = 210; // 3.5s Phoenix Berserk Mantle!
        this.shockwaves.push({
          x: f.x,
          y: f.y - 10,
          radius: 6,
          maxRadius: 64,
          color: '#f97316',
          life: 18,
          maxLife: 18,
          lineWidth: 3,
        });
        this.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'PHOENIX MANTLE!',
          color: '#fde047',
          life: 30,
          maxLife: 30,
        });
        sound.playOverdrive();
      } else if (f.overdriveTimer <= 0) {
        this.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.5,
          text: 'NEED 40% IGNITION',
          color: '#fb923c',
          life: 22,
          maxLife: 22,
        });
      }
    }

    // 8. NYX — Mirror Sovereign (Prism Barrage, Wormhole Portals & Spatial Swap)
    if (move.specialTag === 'nyx_prism_barrage') {
      for (const vyOff of [-1.2, 1.1]) {
        this.projectiles.push({
          id: this.nextProjId++,
          ownerSlot: f.slot,
          x: f.x + f.facing * 22,
          y: f.y - 12,
          vx: f.facing * 9.2,
          vy: vyOff,
          radius: 6.5,
          damage: 5.5,
          baseKnockback: 3.8,
          knockbackGrowth: 0.035,
          angleDeg: 42,
          ttl: 52,
          color: '#ec4899',
          kind: 'prism_beam',
        });
      }
      sound.playSwing(1.25);
    }

    if (move.specialTag === 'nyx_portal_gate') {
      this.portals = this.portals.filter((pr) => pr.ownerSlot !== f.slot);
      const ax = f.x + f.facing * 36;
      const ay = f.y - 12;
      const bx = Math.max(
        this.stage.blastLeft + 75,
        Math.min(this.stage.blastRight - 75, foe.x - foe.facing * 48)
      );
      const by = Math.max(this.stage.blastTop + 75, foe.y - 14);
      this.portals.push({
        ownerSlot: f.slot,
        ax,
        ay,
        bx,
        by,
        ttl: 360,
        cooldown: 0,
      });
      this.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.6,
        text: 'RIFT GATES OPEN!',
        color: '#ec4899',
        life: 28,
        maxLife: 28,
      });
      sound.playBlink();
    }

    if (move.specialTag === 'nyx_spatial_swap') {
      const dist = Math.hypot(foe.x - f.x, foe.y - f.y);
      if (dist < 210 && foe.action !== 'ko_respawn') {
        this.spawnBlinkBurst(f.x, f.y - 10, '#ec4899');
        this.spawnBlinkBurst(foe.x, foe.y - 10, '#38bdf8');
        const tx = f.x;
        const ty = f.y;
        f.x = foe.x;
        f.y = foe.y;
        foe.x = tx;
        foe.y = ty;
        f.facing = foe.x >= f.x ? 1 : -1;
        foe.hitstopFrames = 8;
        this.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'SPATIAL SWAP!',
          color: '#38bdf8',
          life: 30,
          maxLife: 30,
        });
        sound.playBlink();
      }
    }

    // 9. JIN — Thread Sovereign (Autonomous Mecha-Puppet "Karasu" & Razor Strings)
    if (f.id === 'jin' && f.puppetActive) {
      // Every Jin attack triggers a synchronized Karasu Mecha-Slash!
      f.puppetAttackTimer = 14;
      f.puppetVx += f.facing * 6.5;

      if (move.specialTag === 'jin_puppet_command') {
        // Station Karasu behind the opponent for a 2v1 pincer AND fire a Chakra Saw-Disc!
        const flankX = Math.max(
          this.stage.blastLeft + 70,
          Math.min(this.stage.blastRight - 70, foe.x + f.facing * 52)
        );
        f.anchorX = flankX;
        f.anchorY = foe.y - 14;
        f.anchorActive = true;
        f.suspendTimer = 165; // Hold pincer station for 2.75s
        f.puppetVx = (flankX - f.puppetX) * 0.28;
        f.puppetVy = (f.anchorY - f.puppetY) * 0.25;

        this.projectiles.push({
          id: this.nextProjId++,
          ownerSlot: f.slot,
          x: f.puppetX + f.facing * 14,
          y: f.puppetY - 6,
          vx: f.facing * 9.6,
          vy: 0,
          radius: 8,
          damage: 7.5,
          baseKnockback: 4.6,
          knockbackGrowth: 0.042,
          angleDeg: 38,
          ttl: 44,
          color: '#2dd4bf',
          kind: 'sonic_blade',
        });

        this.callouts.push({
          x: f.puppetX,
          y: f.puppetY - 26,
          vy: -0.6,
          text: 'KARASU PINCER!',
          color: '#2dd4bf',
          life: 24,
          maxLife: 24,
        });
      } else if (move.specialTag === 'jin_thread_guillotine') {
        // Snap Karasu behind the opponent first so the Chakra Wires stretch straight through the foe!
        const behindFoeX = Math.max(
          this.stage.blastLeft + 65,
          Math.min(this.stage.blastRight - 65, foe.x + f.facing * 58)
        );
        this.spawnBlinkBurst(f.puppetX, f.puppetY, '#8b5cf6');
        f.puppetX = behindFoeX;
        f.puppetY = foe.y - 12;
        f.puppetVx = 0;
        f.puppetVy = 0;
        f.anchorX = behindFoeX;
        f.anchorY = foe.y - 12;
        f.anchorActive = true;
        f.suspendTimer = 110;
        this.spawnBlinkBurst(f.puppetX, f.puppetY, '#2dd4bf');
      } else if (move.specialTag === 'jin_marionette_lift') {
        // Karasu rockets above Jin to hoist him upward!
        f.puppetX = f.x + f.facing * 18;
        f.puppetY = f.y - 42;
        f.puppetVy = -9.5;
        f.anchorActive = false;
        f.suspendTimer = 0;
      } else if (move.specialTag === 'jin_puppet_ambush') {
        // Teleport Karasu directly above the opponent for an overhead Mecha-Slam!
        this.spawnBlinkBurst(f.puppetX, f.puppetY, '#6366f1');
        f.puppetX = foe.x;
        f.puppetY = foe.y - 38;
        f.puppetVx = 0;
        f.puppetVy = 9.0;
        f.anchorX = foe.x;
        f.anchorY = foe.y - 10;
        f.anchorActive = true;
        f.suspendTimer = 95;
        this.spawnBlinkBurst(f.puppetX, f.puppetY, '#2dd4bf');
        this.callouts.push({
          x: f.puppetX,
          y: f.puppetY - 24,
          vy: -0.6,
          text: 'PUPPET AMBUSH!',
          color: '#2dd4bf',
          life: 26,
          maxLife: 26,
        });
        sound.playBlink();
      }
    }

    f.action = 'attack';
    f.actionFrame = 0;
    f.currentMove = move;
    f.moveHitConnected = false;
    f.moveHitsDone = 0;
    f.chargeFrames = 0;
  }

  private detonateRiftSeal(owner: FighterState, seal: RiftSeal): void {
    this.shockwaves.push({
      x: seal.x,
      y: seal.y,
      radius: 10,
      maxRadius: 96,
      color: '#10b981',
      life: 22,
      maxLife: 22,
      lineWidth: 3.5,
    });
    this.spawnHitSparks(seal.x, seal.y, '#6ee7b7', 18);
    this.shakeMag = 9;
    sound.playHit(1.5, true);

    const foe = this.fighters[1 - owner.slot];
    const dist = Math.hypot(foe.x - seal.x, foe.y - 8 - seal.y);
    if (dist < 88 && foe.invulnFrames <= 0) {
      if (foe.action === 'kenji_haki') {
        this.triggerKenjiCounter(foe, owner);
        return;
      }
      this.applyHitToFighter(owner, foe, {
        offsetX: 0,
        offsetY: 0,
        width: 90,
        height: 90,
        damage: 16 + owner.armorStacks * 4,
        baseKnockback: 7.4,
        knockbackGrowth: 0.082,
        angleDeg: 85,
        hitstop: 12,
        breaksArmor: true,
      });
      owner.armorStacks = 0;
    }
  }

  private detonateRaijinRodNetwork(
    raijin: FighterState,
    foe: FighterState,
    rods: RiftSeal[]
  ): void {
    const r1 = rods[0];
    const r2 = rods[rods.length - 1];
    this.shakeMag = 11;
    this.impactFrames = 2;
    sound.playHit(1.5, true);

    for (const r of rods) {
      this.shockwaves.push({
        x: r.x,
        y: r.y - 10,
        radius: 8,
        maxRadius: 82,
        color: '#facc15',
        life: 20,
        maxLife: 20,
        lineWidth: 3.5,
      });
      this.spawnHitSparks(r.x, r.y - 10, '#38bdf8', 16);
    }

    // Check if foe is close to the line segment connecting r1 and r2
    const dx = r2.x - r1.x;
    const dy = r2.y - r1.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((foe.x - r1.x) * dx + (foe.y - r1.y) * dy) / lenSq));
    const projX = r1.x + t * dx;
    const projY = r1.y + t * dy;
    const dist = Math.hypot(foe.x - projX, foe.y - 8 - projY);

    if (dist < 62 && foe.invulnFrames <= 0) {
      this.callouts.push({
        x: foe.x,
        y: foe.y - 38,
        vy: -0.7,
        text: 'CHAIN VOLTAGE!',
        color: '#facc15',
        life: 30,
        maxLife: 30,
      });
      this.applyHitToFighter(raijin, foe, {
        offsetX: 0,
        offsetY: 0,
        width: 80,
        height: 80,
        damage: 17,
        baseKnockback: 7.6,
        knockbackGrowth: 0.082,
        angleDeg: 80,
        hitstop: 12,
        breaksArmor: true,
      });
    }
  }

  private updateJinPuppet(jin: FighterState, foe: FighterState): void {
    if (jin.suspendTimer > 0) {
      jin.suspendTimer--;
      if (jin.suspendTimer <= 0) {
        jin.anchorActive = false;
      }
    }

    // Desired hover anchor:
    // - If stationed via J / Side+J / Down+J (`anchorActive`), hold the flanking pincer station!
    // - Otherwise, stalk aggressively in front of Jin toward the opponent (`68px` vanguard lead)!
    let targetX: number;
    let targetY: number;
    if (jin.anchorActive && jin.suspendTimer > 0) {
      targetX = jin.anchorX;
      targetY = jin.anchorY;
    } else if (jin.action === 'attack') {
      const dirToFoe = foe.x >= jin.x ? 1 : -1;
      const vanguardDist = Math.min(96, Math.max(58, Math.abs(foe.x - jin.x) * 0.85));
      targetX = jin.x + dirToFoe * vanguardDist;
      targetY = foe.y - 12;
    } else {
      targetX = jin.x + jin.facing * 64;
      targetY = jin.y - 16;
    }

    jin.puppetVx += (targetX - jin.puppetX) * 0.12;
    jin.puppetVy += (targetY - jin.puppetY) * 0.14;
    jin.puppetVx *= 0.78;
    jin.puppetVy *= 0.78;
    jin.puppetX += jin.puppetVx;
    jin.puppetY += jin.puppetVy;

    // Synchronized Karasu Attack Hitbox & Slash Arc whenever Jin attacks!
    if (jin.puppetAttackTimer === 7) {
      this.slashArcs.push({
        x: jin.puppetX + jin.facing * 6,
        y: jin.puppetY - 6,
        angleStart: -1.1,
        angleEnd: 0.9,
        radius: 26,
        thickness: 5,
        color: '#2dd4bf',
        coreColor: '#ffffff',
        life: 8,
        maxLife: 8,
        facing: foe.x >= jin.puppetX ? 1 : -1,
      });

      if (foe.action !== 'ko_respawn' && foe.invulnFrames <= 0) {
        const dist = Math.hypot(foe.x - jin.puppetX, foe.y - 8 - jin.puppetY);
        if (dist <= 46) {
          this.spawnHitSparks(jin.puppetX, jin.puppetY - 4, '#2dd4bf', 10);
          this.applyHitToFighter(jin, foe, {
            offsetX: 0,
            offsetY: 0,
            width: 44,
            height: 44,
            damage: 5.5,
            baseKnockback: 4.2,
            knockbackGrowth: 0.04,
            angleDeg: 58,
            hitstop: 5,
          });
        }
      }
    }
  }

  private triggerJinThreadGuillotine(jin: FighterState, foe: FighterState): void {
    const dx = jin.puppetX - jin.x;
    const dy = jin.puppetY - (jin.y - 12);
    const wireLen = Math.hypot(dx, dy);
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((foe.x - jin.x) * dx + (foe.y - 8 - (jin.y - 12)) * dy) / lenSq));
    const px = jin.x + t * dx;
    const py = jin.y - 12 + t * dy;
    const dist = Math.hypot(foe.x - px, foe.y - 8 - py);

    this.delayedSlashes.push({
      ownerSlot: jin.slot,
      x: (jin.x + jin.puppetX) * 0.5,
      y: (jin.y - 12 + jin.puppetY) * 0.5,
      angle: Math.atan2(dy, dx),
      length: Math.min(220, Math.max(60, wireLen)),
      timer: 8,
      color: '#2dd4bf',
      damage: 7.5,
      knockback: 5.2,
      kbGrowth: 0.052,
    });

    if (dist <= 48 && wireLen <= 280 && foe.invulnFrames <= 0 && foe.action !== 'ko_respawn') {
      this.callouts.push({
        x: foe.x,
        y: foe.y - 36,
        vy: -0.6,
        text: 'WIRE GUILLOTINE!',
        color: '#2dd4bf',
        life: 26,
        maxLife: 26,
      });
      this.applyHitToFighter(jin, foe, {
        offsetX: 0,
        offsetY: 0,
        width: 54,
        height: 54,
        damage: 12.5,
        baseKnockback: 5.8,
        knockbackGrowth: 0.06,
        angleDeg: 65,
        hitstop: 8,
        pullTarget: true,
        breaksArmor: true,
      });
    }
  }

  private applyPhysics(
    f: FighterState,
    inp: InputState,
    speedMult: number,
    gravityScale = 1.0,
    inAttack = false
  ): void {
    const prevY = f.y;
    const stats = f.spec.stats;
    const stageGravMult = this.stage.gravityMult ?? 1.0;

    if (!f.grounded) {
      const grav = stats.gravity * gravityScale * stageGravMult;
      const maxFall =
        (f.fastFalling ? stats.fastFallSpeed : stats.fallSpeed) *
        (stageGravMult < 1 ? 0.85 : 1.0);
      f.vy = Math.min(maxFall, f.vy + grav);
    }

    if (inAttack && f.grounded) {
      f.vx *= 0.85;
    }

    // Stage Wind Hazard (Phantom Maglev Express high-speed slipstream gusts!)
    if (this.stage.windHazard && this.countdownFrames <= 18) {
      const cycle = this.tick % 360;
      if (cycle >= 240 && cycle <= 335) {
        const push = f.grounded ? 0.12 : 0.24;
        f.vx -= push;
        if (cycle === 240 && f.slot === 0) {
          this.callouts.push({
            x: 0,
            y: -45,
            vy: -0.3,
            text: 'SLIPSTREAM GUST!',
            color: '#facc15',
            life: 32,
            maxLife: 32,
          });
        }
      }
    }

    f.x += f.vx;
    f.y += f.vy;

    // Dynamic Moving & Static Platform Collisions
    let landed = false;
    let landedOnPlat = false;
    const footY = f.y + 18;
    const prevFootY = prevY + 18;

    // 1. If already grounded, check if standing on a moving or static platform and ride its delta!
    if (f.grounded && f.vy >= 0) {
      let ridingPlat = null;
      for (const rawPlat of this.stage.platforms) {
        if (!rawPlat.isMain && f.dropThroughTimer > 0) continue;
        const p = resolvePlatformAtTick(rawPlat, this.tick);
        const prevPlatY = p.y - p.vy;
        if (
          f.x >= p.left - 8 &&
          f.x <= p.right + 8 &&
          Math.abs(prevFootY - prevPlatY) <= 8
        ) {
          ridingPlat = p;
          break;
        }
      }
      if (ridingPlat) {
        f.x += ridingPlat.vx;
        f.y = ridingPlat.y - 18;
        f.vy = 0;
        f.onPlatform = !ridingPlat.isMain;
      } else {
        f.grounded = false;
        f.onPlatform = false;
      }
    }

    // 2. If airborne and falling downward, check landing on any platform top surface
    if (!f.grounded && f.vy >= 0) {
      for (const rawPlat of this.stage.platforms) {
        if (!rawPlat.isMain && f.dropThroughTimer > 0) continue;
        const p = resolvePlatformAtTick(rawPlat, this.tick);
        const prevPlatY = p.y - p.vy;
        if (f.x >= p.left - 8 && f.x <= p.right + 8) {
          if (prevFootY <= prevPlatY + 8 && footY >= p.y - 2) {
            f.y = p.y - 18;
            f.vy = 0;
            f.x += p.vx;
            landed = true;
            landedOnPlat = !p.isMain;
            break;
          }
        }
      }
    }

    if (landed) {
      f.grounded = true;
      f.onPlatform = landedOnPlat;
      f.jumpsLeft = 2;
      f.airDashAvailable = true;
      f.fastFalling = false;
      f.squashX = 1.24;
      f.squashY = 0.78;
      this.spawnDust(f.x, f.y + 18, 0);
      if (f.action === 'air' || f.action === 'airdodge') {
        f.action = 'idle';
        f.actionFrame = 0;
      }
    }

    // 3. Stage Updraft Jump Pads (Twin Abyss Rift & Möbius Continuum)
    if (this.stage.jumpPads && !inp.down && f.vy >= -2) {
      for (const pad of this.stage.jumpPads) {
        if (
          Math.abs(f.x - pad.x) <= pad.width * 0.5 + 4 &&
          Math.abs(f.y + 18 - pad.y) <= 10
        ) {
          f.vy = pad.boostVy;
          f.grounded = false;
          f.onPlatform = false;
          f.jumpsLeft = 2;
          f.airDashAvailable = true;
          f.fastFalling = false;
          f.squashX = 0.74;
          f.squashY = 1.32;
          if (f.action === 'idle' || f.action === 'walk' || f.action === 'dash') {
            f.action = 'air';
            f.actionFrame = 0;
          }
          this.shockwaves.push({
            x: pad.x,
            y: pad.y,
            radius: 4,
            maxRadius: 28,
            color: pad.color,
            life: 12,
            maxLife: 12,
            lineWidth: 2.5,
          });
          this.spawnHitSparks(pad.x, pad.y - 4, pad.color, 8);
          sound.playJumpPad();
          break;
        }
      }
    }

    // 4. Spatial Horizontal Wrap-Around (Möbius Continuum stage mechanic!)
    if (this.stage.wrapHorizontal && this.config.ruleset !== 'hp') {
      const wrapEdge = this.stage.wrapEdgeX ?? 300;
      const speed = Math.hypot(f.vx, f.vy);
      // Only wrap when not flying out in a fatal high-speed knockout!
      if (speed < 11.2 && Math.abs(f.x) > wrapEdge && f.y > -220 && f.y < 190) {
        this.spawnBlinkBurst(f.x, f.y - 8, this.stage.accentColor);
        f.x = f.x > 0 ? -(wrapEdge - 14) : wrapEdge - 14;
        for (const node of f.scarf) {
          node.x = f.x;
          node.y = f.y - 16;
        }
        this.spawnBlinkBurst(f.x, f.y - 8, '#f8fafc');
        sound.playBlink();
      }
    }

    // HP Mode Arena Wall Boundaries (allows awesome wall-bounces!)
    if (this.config.ruleset === 'hp') {
      if (f.x < this.stage.wallLeft) {
        f.x = this.stage.wallLeft;
        if (f.action === 'hitstun' && Math.abs(f.vx) > 5.5) {
          f.vx = Math.abs(f.vx) * 0.78;
          f.vy -= 2.2;
          this.shakeMag = Math.max(this.shakeMag, 6);
          this.spawnHitSparks(f.x, f.y - 6, '#f8fafc', 10);
          sound.playHit(1.1, false);
        } else {
          f.vx = Math.max(0, f.vx);
        }
      } else if (f.x > this.stage.wallRight) {
        f.x = this.stage.wallRight;
        if (f.action === 'hitstun' && Math.abs(f.vx) > 5.5) {
          f.vx = -Math.abs(f.vx) * 0.78;
          f.vy -= 2.2;
          this.shakeMag = Math.max(this.shakeMag, 6);
          this.spawnHitSparks(f.x, f.y - 6, '#f8fafc', 10);
          sound.playHit(1.1, false);
        } else {
          f.vx = Math.min(0, f.vx);
        }
      }
    }

    void speedMult;
  }

  private checkBounds(f: FighterState): void {
    const s = this.stage;
    const out =
      f.x < s.blastLeft ||
      f.x > s.blastRight ||
      f.y < s.blastTop ||
      f.y > s.blastBottom;

    if (!out) return;

    if (this.config.ruleset === 'hp' && f.y <= s.blastBottom) {
      return;
    }

    // Ring-out KO!
    sound.playKO();
    this.shakeMag = 16;
    this.impactFrames = 4;
    this.spawnHitSparks(
      Math.max(-360, Math.min(360, f.x)),
      Math.max(-200, Math.min(200, f.y)),
      f.spec.accentColor,
      36
    );
    this.shockwaves.push({
      x: Math.max(-360, Math.min(360, f.x)),
      y: Math.max(-200, Math.min(200, f.y)),
      radius: 10,
      maxRadius: 150,
      color: '#ffffff',
      life: 24,
      maxLife: 24,
      lineWidth: 5,
    });

    if (this.config.mode === 'training') {
      const [spawnP1X, spawnP2X] = this.stage.spawnX ?? [-110, 110];
      f.x = f.slot === 0 ? spawnP1X : spawnP2X;
      f.y = this.stage.platforms[0].y - 60;
      f.vx = 0;
      f.vy = 0;
      f.damagePercent = 0;
      f.hp = f.maxHp;
      f.action = 'air';
      f.hitstunFrames = 0;
      return;
    }

    if (this.config.ruleset === 'stock') {
      f.stocks--;
      if (f.stocks <= 0) {
        f.action = 'ko_respawn';
        this.triggerTimeDilation(0.22, 34);
        this.winnerSlot = (1 - f.slot) as 0 | 1;
        this.emitHUD(true);
      } else {
        f.action = 'ko_respawn';
        f.actionFrame = 0;
        f.vx = 0;
        f.vy = 0;
        this.emitHUD(true);
      }
    } else {
      // Fell into pit in HP mode -> instant KO
      f.hp = 0;
      f.action = 'ko_respawn';
      this.triggerTimeDilation(0.22, 34);
      this.winnerSlot = (1 - f.slot) as 0 | 1;
      this.emitHUD(true);
    }
  }

  private getActiveHitboxRect(f: FighterState): { x: number; y: number; w: number; h: number } | null {
    if (f.action !== 'attack' || !f.currentMove) return null;
    const m = f.currentMove;
    const effFrame = Math.floor(f.actionFrame * (f.overdriveTimer > 0 ? 1.35 : 1.0));
    if (effFrame < m.startup || effFrame >= m.startup + m.active || m.hitbox.width <= 0) {
      return null;
    }
    return {
      x: f.x + m.hitbox.offsetX * f.facing - m.hitbox.width * 0.5,
      y: f.y + m.hitbox.offsetY - m.hitbox.height * 0.5,
      w: m.hitbox.width,
      h: m.hitbox.height,
    };
  }

  private rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private resolveCombatCollisions(): void {
    const f1 = this.fighters[0];
    const f2 = this.fighters[1];
    if (f1.action === 'ko_respawn' || f2.action === 'ko_respawn') return;

    const hb1 = this.getActiveHitboxRect(f1);
    const hb2 = this.getActiveHitboxRect(f2);

    // 1. Anime Weapon CLASH! If both attacks collide mid-swing
    if (hb1 && hb2 && !f1.moveHitConnected && !f2.moveHitConnected && this.rectsOverlap(hb1, hb2)) {
      const d1 = f1.currentMove!.hitbox.damage;
      const d2 = f2.currentMove!.hitbox.damage;
      if (Math.abs(d1 - d2) <= 5) {
        f1.moveHitConnected = true;
        f2.moveHitConnected = true;
        f1.hitstopFrames = 10;
        f2.hitstopFrames = 10;
        f1.vx = -f1.facing * 5.2;
        f2.vx = -f2.facing * 5.2;
        const cx = (f1.x + f2.x) * 0.5;
        const cy = (f1.y + f2.y) * 0.5 - 8;
        this.spawnHitSparks(cx, cy, '#fef08a', 20);
        this.shockwaves.push({
          x: cx,
          y: cy,
          radius: 6,
          maxRadius: 56,
          color: '#ffffff',
          life: 16,
          maxLife: 16,
          lineWidth: 3,
        });
        this.callouts.push({
          x: cx,
          y: cy - 24,
          vy: -0.7,
          text: 'CLASH!',
          color: '#fef08a',
          life: 28,
          maxLife: 28,
        });
        this.shakeMag = 8;
        sound.playClash();
        return;
      }
    }

    // 2. Check Hitbox vs Hurtbox for both directions
    for (let i = 0; i < 2; i++) {
      const attacker = this.fighters[i];
      const defender = this.fighters[1 - i];
      const hb = i === 0 ? hb1 : hb2;
      if (!hb) continue;

      const m = attacker.currentMove!;
      const canHitAgain =
        !attacker.moveHitConnected ||
        (m.multiHitInterval && attacker.actionFrame % m.multiHitInterval === 0 && attacker.moveHitsDone < 3);
      if (!canHitAgain) continue;

      const hurt = { x: defender.x - 11, y: defender.y - 28, w: 22, h: 46 };
      if (!this.rectsOverlap(hb, hurt)) continue;

      // Check Defender Observation Haki Counter!
      if (defender.action === 'kenji_haki') {
        attacker.moveHitConnected = true;
        this.triggerKenjiCounter(defender, attacker);
        return;
      }

      // Check Defender Parry / Invulnerability
      if (defender.invulnFrames > 0) {
        if (defender.action === 'parry') {
          attacker.moveHitConnected = true;
          attacker.hitstopFrames = 14;
          defender.hitstopFrames = 9;
          // Stagger attacker on parried blow!
          attacker.vx = -attacker.facing * 4.6;
          attacker.action = 'hitstun';
          attacker.actionFrame = 0;
          attacker.currentMove = null;
          attacker.hitstunFrames = 18;

          defender.invulnFrames = 16;
          defender.parryCooldown = 0;
          defender.countersLanded++;
          defender.gauge = Math.min(100, defender.gauge + 26);
          defender.ultimateGauge = Math.min(100, defender.ultimateGauge + 18);
          this.impactFrames = 3;
          this.triggerTimeDilation(0.25, 18);
          this.shakeMag = Math.max(this.shakeMag, 8);
          this.shockwaves.push({
            x: defender.x + defender.facing * 10,
            y: defender.y - 10,
            radius: 6,
            maxRadius: 56,
            color: '#f8fafc',
            life: 16,
            maxLife: 16,
            lineWidth: 3,
          });
          this.spawnHitSparks(defender.x + defender.facing * 10, defender.y - 10, '#fef08a', 18);
          this.callouts.push({
            x: defender.x,
            y: defender.y - 36,
            vy: -0.7,
            text: 'PARRY!',
            color: '#fef08a',
            life: 28,
            maxLife: 28,
          });
          sound.playClash();
        }
        continue;
      }

      // Land Hit!
      attacker.moveHitConnected = true;
      attacker.moveHitsDone++;
      if (m.category === 'special') attacker.specialsLanded++;

      // Velo Overdrive resets air-dash on hit!
      if (attacker.overdriveTimer > 0) {
        attacker.airDashAvailable = true;
      }

      // Charge multiplier for Strongs
      const chargeRatio = m.canCharge ? Math.min(1, attacker.chargeFrames / (m.maxCharge ?? 40)) : 0;
      const dmgMult = 1 + chargeRatio * 0.45 + (attacker.armorStacks > 0 && m.category === 'strong' ? attacker.armorStacks * 0.15 : 0);
      const kbMult = 1 + chargeRatio * 0.35;
      if (m.category === 'strong' && attacker.armorStacks > 0) attacker.armorStacks = 0;

      this.applyHitToFighter(attacker, defender, m.hitbox, dmgMult, kbMult);
    }
  }

  private triggerKenjiCounter(kenji: FighterState, attacker: FighterState): void {
    kenji.action = 'attack';
    kenji.actionFrame = 0;
    kenji.currentMove = kenji.spec.moves.kenji_counter_slash;
    kenji.moveHitConnected = false;
    kenji.moveHitsDone = 0;
    kenji.invulnFrames = 18;
    kenji.countersLanded++;
    kenji.gauge = Math.min(100, kenji.gauge + 25);
    kenji.ultimateGauge = Math.min(100, kenji.ultimateGauge + 18);

    // Blink behind attacker!
    this.spawnBlinkBurst(kenji.x, kenji.y - 10, '#ef4444');
    kenji.x = attacker.x - attacker.facing * 32;
    kenji.y = attacker.y;
    kenji.vx = 0;
    kenji.vy = 0;
    kenji.facing = attacker.x >= kenji.x ? 1 : -1;
    this.spawnBlinkBurst(kenji.x, kenji.y - 10, '#f59e0b');

    attacker.hitstopFrames = 14;
    this.impactFrames = 4;
    this.triggerTimeDilation(0.22, 22);
    this.shakeMag = 10;
    this.callouts.push({
      x: kenji.x,
      y: kenji.y - 38,
      vy: -0.6,
      text: 'HAKI COUNTER!',
      color: '#f59e0b',
      life: 36,
      maxLife: 36,
    });
    sound.playCounter();
  }

  private applyHitToFighter(
    attacker: FighterState,
    defender: FighterState,
    hitbox: MoveData['hitbox'],
    dmgMult = 1,
    kbMult = 1
  ): void {
    const damage = hitbox.damage * dmgMult;

    // Check Defender Kinetic Super Armor (Bram)
    const defArmor =
      defender.currentMove?.superArmorFrames &&
      defender.actionFrame >= defender.currentMove.superArmorFrames[0] &&
      defender.actionFrame <= defender.currentMove.superArmorFrames[1] &&
      !hitbox.breaksArmor;

    if (defArmor && damage < 16) {
      defender.damagePercent += damage * 0.7;
      defender.hp = Math.max(1, defender.hp - damage * 7);
      defender.armorStacks = Math.min(3, defender.armorStacks + 1);
      defender.flashWhiteFrames = 4;
      attacker.hitstopFrames = 5;
      this.spawnHitSparks(defender.x, defender.y - 8, '#facc15', 10);
      this.callouts.push({
        x: defender.x,
        y: defender.y - 36,
        vy: -0.6,
        text: 'ARMOR!',
        color: '#facc15',
        life: 22,
        maxLife: 22,
      });
      sound.playHit(0.8, false);
      return;
    }

    // Apply damage
    defender.damagePercent += damage;
    defender.hp = Math.max(0, defender.hp - Math.round(damage * 10));
    defender.flashWhiteFrames = 4;
    defender.squashX = 1.25;
    defender.squashY = 0.75;

    // Sol Cinder Stack Application (only when move explicitly applies Cinder, never on Supernova detonation!)
    if (hitbox.appliesCinder) {
      defender.cinderMarks = Math.min(5, defender.cinderMarks + 1);
    }

    // Gauge & Ultimate Awakening Gauge gain
    attacker.gauge = Math.min(100, attacker.gauge + damage * 1.6);
    defender.gauge = Math.min(100, defender.gauge + damage * 0.9);
    if (!hitbox.unblockable) {
      attacker.ultimateGauge = Math.min(100, attacker.ultimateGauge + damage * 1.45);
      defender.ultimateGauge = Math.min(100, defender.ultimateGauge + damage * 1.15);
    }

    // Combo & Stat Tracking
    attacker.totalDamageDealt += damage;
    defender.comboCountReceived++;
    defender.comboDamageReceived += damage;
    if (defender.comboCountReceived > attacker.maxComboDealt) {
      attacker.maxComboDealt = defender.comboCountReceived;
    }
    if (this.config.mode === 'training' && attacker.slot === 0) {
      this.lastComboHits = defender.comboCountReceived;
      this.lastComboDamage = Math.round(defender.comboDamageReceived);
    }

    // Calculate Knockback!
    let kbForce: number;
    if (this.config.ruleset === 'stock') {
      const weightMod = 100 / defender.spec.stats.weight;
      kbForce =
        (hitbox.baseKnockback + defender.damagePercent * hitbox.knockbackGrowth) *
        weightMod *
        kbMult;
    } else {
      // HP mode: tighter combo-friendly knockback
      kbForce = (hitbox.baseKnockback * 0.85 + damage * hitbox.knockbackGrowth * 2.2) * kbMult;
    }

    if (hitbox.pullTarget) {
      // Bram Singularity Pull: yanks opponent straight toward Bram!
      const dx = attacker.x + attacker.facing * 26 - defender.x;
      const dy = attacker.y - 10 - defender.y;
      const dist = Math.hypot(dx, dy) || 1;
      defender.vx = (dx / dist) * Math.min(11, Math.max(5.5, dist * 0.14));
      defender.vy = (dy / dist) * 5 - 2.2;
      defender.grounded = false;
    } else {
      const rad = (hitbox.angleDeg * Math.PI) / 180;
      const dir = attacker.x <= defender.x ? 1 : -1;
      defender.vx = Math.cos(rad) * kbForce * dir;
      defender.vy = -Math.sin(rad) * kbForce;
      if (defender.vy < -0.5) defender.grounded = false;
    }

    defender.action = 'hitstun';
    defender.actionFrame = 0;
    defender.currentMove = null;
    defender.hitstunFrames = Math.max(12, Math.round(kbForce * 2.95) + (hitbox.hitstunBonus ?? 0));

    // Hitstop & Impact Frame Juice
    const hs = hitbox.hitstop;
    attacker.hitstopFrames = hs;
    defender.hitstopFrames = hs;

    const isHeavy = damage >= 14 || kbForce >= 9.0;
    this.shakeMag = Math.max(this.shakeMag, isHeavy ? 11 : 4.5);
    if (isHeavy) {
      this.impactFrames = 2;
      if (damage >= 16 || kbForce >= 10.2) {
        this.triggerTimeDilation(0.32, 14);
      }
      this.shockwaves.push({
        x: (attacker.x + defender.x) * 0.5,
        y: defender.y - 8,
        radius: 6,
        maxRadius: 64,
        color: attacker.spec.secondaryColor,
        life: 16,
        maxLife: 16,
        lineWidth: 3,
      });
    }

    this.spawnHitSparks(
      defender.x,
      defender.y - 8,
      attacker.spec.secondaryColor,
      isHeavy ? 18 : 9
    );
    sound.playHit(kbForce / 8, isHeavy);

    // HP Mode KO check
    if (this.config.ruleset === 'hp' && defender.hp <= 0) {
      if (this.config.mode === 'training') {
        defender.hp = defender.maxHp;
      } else {
        this.impactFrames = 5;
        this.triggerTimeDilation(0.22, 34);
        this.shakeMag = 16;
        this.winnerSlot = attacker.slot;
        sound.playKO();
        this.emitHUD(true);
      }
    }
  }

  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.ttl--;

      if (p.ttl <= 0 || Math.abs(p.x) > 620) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const target = this.fighters[1 - p.ownerSlot];
      const owner = this.fighters[p.ownerSlot];
      if (target.action === 'ko_respawn') continue;

      const dist = Math.hypot(target.x - p.x, target.y - 8 - p.y);
      if (dist < p.radius + 16) {
        // Kenji Observation Haki counters projectiles too!
        if (target.action === 'kenji_haki') {
          this.projectiles.splice(i, 1);
          this.triggerKenjiCounter(target, owner);
          continue;
        }

        // Reflectable attacks (e.g. Conqueror Repulse) or Standing Parry (`P`)!
        if (
          target.action === 'parry' ||
          (target.action === 'attack' && target.currentMove?.hitbox.reflectsProjectiles)
        ) {
          p.ownerSlot = target.slot;
          p.vx = -p.vx * 1.5;
          p.damage *= 1.35;
          p.color = target.spec.secondaryColor;
          p.ttl = 50;
          target.countersLanded++;
          target.gauge = Math.min(100, target.gauge + 20);
          this.spawnHitSparks(p.x, p.y, '#fef08a', 14);
          this.callouts.push({
            x: target.x,
            y: target.y - 34,
            vy: -0.7,
            text: 'PARRY REFLECT!',
            color: '#fef08a',
            life: 26,
            maxLife: 26,
          });
          sound.playClash();
          continue;
        }

        if (target.invulnFrames <= 0) {
          const isHook = p.kind === 'chain_hook';
          this.applyHitToFighter(owner, target, {
            offsetX: 0,
            offsetY: 0,
            width: p.radius * 2,
            height: p.radius * 2,
            damage: p.damage,
            baseKnockback: p.baseKnockback,
            knockbackGrowth: p.knockbackGrowth,
            angleDeg: p.angleDeg,
            hitstop: isHook ? 8 : 5,
            isProjectile: true,
            pullTarget: isHook,
            appliesCinder: isHook,
          });
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private updateStasisFields(): void {
    for (let i = this.stasisFields.length - 1; i >= 0; i--) {
      const sf = this.stasisFields[i];
      sf.ttl--;
      if (sf.ttl <= 0) {
        this.stasisFields.splice(i, 1);
        continue;
      }
      // Slow opposing fighter inside Stasis Dome
      const foe = this.fighters[1 - sf.ownerSlot];
      if (foe.action !== 'ko_respawn' && Math.hypot(foe.x - sf.x, foe.y - 10 - sf.y) < sf.radius) {
        foe.stasisSlowTimer = 4;
      }
      // Slow opposing projectiles inside Stasis Dome
      for (const p of this.projectiles) {
        if (p.ownerSlot !== sf.ownerSlot && Math.hypot(p.x - sf.x, p.y - sf.y) < sf.radius) {
          p.vx *= 0.85;
          p.vy *= 0.85;
        }
      }
    }
  }

  private updatePortals(): void {
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pr = this.portals[i];
      pr.ttl--;
      if (pr.cooldown > 0) pr.cooldown--;
      if (pr.ttl <= 0) {
        this.portals.splice(i, 1);
        continue;
      }
      if (pr.cooldown > 0) continue;

      const owner = this.fighters[pr.ownerSlot];
      const foe = this.fighters[1 - pr.ownerSlot];

      // 1. Teleport owner when dashing/air-dashing through Gate A or Gate B!
      if (owner.action === 'dash' || owner.action === 'airdodge') {
        const dA = Math.hypot(owner.x - pr.ax, owner.y - 10 - pr.ay);
        const dB = Math.hypot(owner.x - pr.bx, owner.y - 10 - pr.by);
        if (dA < 26) {
          pr.cooldown = 28;
          this.spawnBlinkBurst(pr.ax, pr.ay, '#ec4899');
          owner.x = pr.bx;
          owner.y = pr.by;
          owner.facing = foe.x >= owner.x ? 1 : -1;
          this.spawnBlinkBurst(pr.bx, pr.by, '#38bdf8');
          sound.playBlink();
        } else if (dB < 26) {
          pr.cooldown = 28;
          this.spawnBlinkBurst(pr.bx, pr.by, '#38bdf8');
          owner.x = pr.ax;
          owner.y = pr.ay;
          owner.facing = foe.x >= owner.x ? 1 : -1;
          this.spawnBlinkBurst(pr.ax, pr.ay, '#ec4899');
          sound.playBlink();
        }
      }

      // 2. Teleport owner's projectiles through Gate A -> Gate B aimed at opponent!
      for (const p of this.projectiles) {
        if (p.ownerSlot === pr.ownerSlot && Math.hypot(p.x - pr.ax, p.y - pr.ay) < 22) {
          pr.cooldown = 16;
          p.x = pr.bx;
          p.y = pr.by;
          const ang = Math.atan2(foe.y - 10 - pr.by, foe.x - pr.bx);
          const spd = Math.hypot(p.vx, p.vy) * 1.15;
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
          this.spawnBlinkBurst(pr.bx, pr.by, '#ec4899');
          sound.playBlink();
          break;
        }
      }
    }
  }

  private updateDelayedSlashes(): void {
    for (let i = this.delayedSlashes.length - 1; i >= 0; i--) {
      const ds = this.delayedSlashes[i];
      ds.timer--;
      if (ds.timer <= 0) {
        this.spawnHitSparks(ds.x, ds.y, ds.color, 10);
        this.slashArcs.push({
          x: ds.x,
          y: ds.y,
          angleStart: ds.angle - 0.5,
          angleEnd: ds.angle + 0.5,
          radius: 26,
          thickness: 5,
          color: ds.color,
          coreColor: '#ffffff',
          life: 10,
          maxLife: 10,
          facing: 1,
        });
        sound.playSwing(1.4);

        const foe = this.fighters[1 - ds.ownerSlot];
        const owner = this.fighters[ds.ownerSlot];
        if (foe.action !== 'ko_respawn' && Math.hypot(foe.x - ds.x, foe.y - 8 - ds.y) < 38) {
          if (foe.action === 'kenji_haki') {
            this.triggerKenjiCounter(foe, owner);
          } else if (foe.invulnFrames <= 0) {
            this.applyHitToFighter(owner, foe, {
              offsetX: 0,
              offsetY: 0,
              width: 44,
              height: 44,
              damage: ds.damage,
              baseKnockback: ds.knockback,
              knockbackGrowth: ds.kbGrowth,
              angleDeg: 72,
              hitstop: 5,
            });
          }
        }
        this.delayedSlashes.splice(i, 1);
      }
    }
  }

  private updateRiftSeals(): void {
    for (let i = this.riftSeals.length - 1; i >= 0; i--) {
      this.riftSeals[i].ttl--;
      this.riftSeals[i].pulse++;
      if (this.riftSeals[i].ttl <= 0) {
        this.riftSeals.splice(i, 1);
      }
    }
  }

  private updateScarf(f: FighterState): void {
    const anchorX = f.x - f.facing * 2;
    const anchorY = f.y - 18;
    f.scarf[0].x = anchorX;
    f.scarf[0].y = anchorY;

    const windX = -f.facing * 1.15 - f.vx * 0.25;
    for (let i = 1; i < f.scarf.length; i++) {
      const prev = f.scarf[i - 1];
      const cur = f.scarf[i];
      cur.x += windX;
      cur.y += Math.sin(this.tick * 0.2 + i) * 0.35 + 0.15;

      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      const segLen = 4.5;
      if (dist > segLen) {
        cur.x = prev.x + (dx / dist) * segLen;
        cur.y = prev.y + (dy / dist) * segLen;
      }
    }
  }

  private spawnAfterimage(f: FighterState, color: string): void {
    this.afterimages.push({
      x: f.x,
      y: f.y,
      facing: f.facing,
      action: f.action,
      moveKey: f.currentMove?.key ?? null,
      moveFrame: f.actionFrame,
      color,
      alpha: 0.65,
      poseSeed: this.tick,
      weaponType: f.spec.weaponType,
    });
  }

  private spawnMoveArc(f: FighterState, m: MoveData): void {
    const style = m.hitbox.slashStyle ?? 'arc';
    let aStart = -1.2;
    let aEnd = 0.6;
    let rad = 28;
    let ox = 10;
    let oy = -8;

    if (style === 'upper') {
      aStart = -2.2;
      aEnd = -0.3;
      rad = 32;
      oy = -16;
    } else if (style === 'slam') {
      aStart = -0.3;
      aEnd = 1.6;
      rad = 30;
      oy = 4;
    } else if (style === 'thrust') {
      aStart = -0.25;
      aEnd = 0.25;
      rad = 36;
      ox = 12;
    } else if (style === 'burst') {
      aStart = -Math.PI;
      aEnd = Math.PI;
      rad = m.category === 'strong' ? 36 : 26;
      ox = m.hitbox.offsetX * 0.45;
    }

    this.slashArcs.push({
      x: f.x + ox * f.facing,
      y: f.y + oy,
      angleStart: aStart,
      angleEnd: aEnd,
      radius: rad,
      thickness: m.category === 'strong' || m.category === 'special' ? 7 : 4.5,
      color: f.spec.accentColor,
      coreColor: '#ffffff',
      life: 9,
      maxLife: 9,
      facing: f.facing,
    });
  }

  private spawnHitSparks(x: number, y: number, color: string, count: number): void {
    // Central 4-point anime star flare
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: count >= 16 ? 7.5 : 4.8,
      color: '#ffffff',
      life: count >= 16 ? 12 : 8,
      maxLife: count >= 16 ? 12 : 8,
      gravity: 0,
      drag: 1,
      shape: 'flare',
      angle: Math.random() * 0.6,
      spin: 0.08,
    });

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.6 + Math.random() * 7.8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.2 + Math.random() * 2.8,
        color: i % 3 === 0 ? '#ffffff' : color,
        life: 11 + Math.floor(Math.random() * 11),
        maxLife: 22,
        gravity: 0.14,
        drag: 0.91,
        shape: i % 5 === 0 ? 'flare' : i % 2 === 0 ? 'spark' : 'pixel',
        angle: ang,
        spin: 0.14,
      });
    }
  }

  private spawnDashWindCone(x: number, y: number, angle: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 2.2,
      vy: Math.sin(angle) * 2.2,
      size: 6,
      color: '#f8fafc',
      life: 10,
      maxLife: 10,
      gravity: 0,
      drag: 0.88,
      shape: 'wind_cone',
      angle,
    });
    this.particles.push({
      x: x - Math.cos(angle) * 8,
      y: y - Math.sin(angle) * 8,
      vx: Math.cos(angle) * 1.4,
      vy: Math.sin(angle) * 1.4,
      size: 5,
      color,
      life: 12,
      maxLife: 12,
      gravity: 0,
      drag: 0.88,
      shape: 'wind_cone',
      angle,
    });
  }

  private spawnBlinkBurst(x: number, y: number, color: string): void {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius: 36,
      color,
      life: 12,
      maxLife: 12,
      lineWidth: 2.2,
    });
    this.spawnHitSparks(x, y, color, 10);
  }

  private spawnDust(x: number, y: number, dir: number): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y - 2,
        vx: -dir * (0.9 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.6,
        vy: -0.6 - Math.random() * 1.5,
        size: 2.5 + Math.random() * 1.5,
        color: i % 2 === 0 ? '#94a3b8' : '#64748b',
        life: 15,
        maxLife: 15,
        gravity: i % 3 === 0 ? 0.16 : 0.02,
        drag: 0.9,
        shape: i % 3 === 0 ? 'debris' : 'pixel',
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  private resolveTimeOver(): void {
    const f1 = this.fighters[0];
    const f2 = this.fighters[1];
    if (this.config.ruleset === 'stock') {
      if (f1.stocks !== f2.stocks) {
        this.winnerSlot = f1.stocks > f2.stocks ? 0 : 1;
      } else if (Math.abs(f1.damagePercent - f2.damagePercent) > 0.5) {
        this.winnerSlot = f1.damagePercent < f2.damagePercent ? 0 : 1;
      } else {
        this.winnerSlot = 'draw';
      }
    } else {
      if (f1.hp !== f2.hp) {
        this.winnerSlot = f1.hp > f2.hp ? 0 : 1;
      } else {
        this.winnerSlot = 'draw';
      }
    }
    this.emitHUD(true);
  }

  private getGaugeLabel(id: FighterId): string {
    switch (id) {
      case 'kuro':
        return 'VOID';
      case 'velo':
        return 'VELOCITY';
      case 'kenji':
        return 'FOCUS';
      case 'bram':
        return 'IMPACT';
      case 'raijin':
        return 'VOLTAGE';
      case 'chrono':
        return 'TEMPORAL';
      case 'sol':
        return 'IGNITION';
      case 'nyx':
        return 'ASTRAL';
      case 'jin':
        return 'CHAKRA';
    }
  }

  private getFighterStatusBanner(f: FighterState, foe: FighterState): string | null {
    if (f.action === 'ultimate') return 'ULTIMATE AWAKENING';
    if (f.action === 'taunt') return 'TAUNT (+ULT)';
    if (f.action === 'kuro_suspend') return 'VOID SUSPENDED';
    if (f.action === 'kenji_haki') return 'OBSERVATION HAKI';
    if (f.overdriveTimer > 0) {
      return f.id === 'sol' ? 'PHOENIX MANTLE' : 'HYPER OVERDRIVE';
    }
    if (f.ultimateGauge >= 100) return 'ULTIMATE READY [V]';
    if (f.stasisSlowTimer > 0) return 'TIME SLOWED';
    if (f.id === 'bram' && f.armorStacks > 0) return `ARMOR x${f.armorStacks}`;
    if (f.id === 'raijin') {
      const rods = this.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      ).length;
      if (rods > 0) return `THUNDER RODS: ${rods}/2`;
    }
    if (f.id === 'chrono' && f.anchorActive) return 'ECHO ANCHOR READY';
    if (f.id === 'sol' && foe.cinderMarks > 0) {
      return foe.cinderMarks >= 3
        ? `SUPERNOVA READY (${foe.cinderMarks}/5)`
        : `FOE CINDERS: ${foe.cinderMarks}/3`;
    }
    if (f.id === 'nyx' && this.portals.some((pr) => pr.ownerSlot === f.slot)) {
      return 'WORMHOLE ACTIVE';
    }
    if (f.id === 'jin') {
      if (f.puppetAttackTimer > 0) return 'KARASU SYNC';
      if (f.anchorActive && f.suspendTimer > 0) return 'KARASU PINCER';
    }
    return null;
  }

  private emitHUD(force: boolean): void {
    if (!force && !this.canvas) return;
    const f1 = this.fighters[0];
    const f2 = this.fighters[1];
    const elapsedSec = Math.floor(this.matchFrames / 60);
    const timerSeconds = this.config.mode === 'vs_ai' ? Math.max(0, 99 - elapsedSec) : elapsedSec;

    let countdownLabel: HUDState['countdownLabel'] = null;
    if (this.countdownFrames > 63) countdownLabel = '3';
    else if (this.countdownFrames > 41) countdownLabel = '2';
    else if (this.countdownFrames > 18) countdownLabel = '1';
    else if (this.countdownFrames > 0) countdownLabel = 'FIGHT!';

    this.onHUDUpdate({
      p1: {
        id: f1.id,
        name: f1.spec.name,
        title: f1.spec.title,
        accentColor: f1.spec.accentColor,
        secondaryColor: f1.spec.secondaryColor,
        damagePercent: Math.round(f1.damagePercent),
        hp: Math.round(f1.hp),
        maxHp: f1.maxHp,
        stocks: f1.stocks,
        gauge: Math.round(f1.gauge),
        gaugeLabel: this.getGaugeLabel(f1.id),
        ultimateGauge: Math.round(f1.ultimateGauge),
        ultimateName: f1.spec.ultimateName,
        isOverdrive: f1.overdriveTimer > 0,
        isSuspended: f1.action === 'kuro_suspend',
        isHakiActive: f1.action === 'kenji_haki',
        armorStacks: f1.armorStacks,
        cinderMarks: f1.cinderMarks,
        statusBanner: this.getFighterStatusBanner(f1, f2),
        comboCount: f2.comboCountReceived,
      },
      p2: {
        id: f2.id,
        name: f2.spec.name,
        title: f2.spec.title,
        accentColor: f2.spec.accentColor,
        secondaryColor: f2.spec.secondaryColor,
        damagePercent: Math.round(f2.damagePercent),
        hp: Math.round(f2.hp),
        maxHp: f2.maxHp,
        stocks: f2.stocks,
        gauge: Math.round(f2.gauge),
        gaugeLabel: this.getGaugeLabel(f2.id),
        ultimateGauge: Math.round(f2.ultimateGauge),
        ultimateName: f2.spec.ultimateName,
        isOverdrive: f2.overdriveTimer > 0,
        isSuspended: f2.action === 'kuro_suspend',
        isHakiActive: f2.action === 'kenji_haki',
        armorStacks: f2.armorStacks,
        cinderMarks: f2.cinderMarks,
        statusBanner: this.getFighterStatusBanner(f2, f1),
        comboCount: f1.comboCountReceived,
      },
      timerSeconds,
      ruleset: this.config.ruleset,
      mode: this.config.mode,
      stocksCount: this.config.stocksCount,
      paused: this.paused,
      countdownLabel,
      winnerSlot: this.winnerSlot,
      training: {
        dummyBehavior: this.trainingBehavior,
        showHitboxes: this.showHitboxes,
        autoHeal: this.autoHeal,
        lastComboHits: this.lastComboHits,
        lastComboDamage: this.lastComboDamage,
      },
      matchStats: {
        p1MaxCombo: f1.maxComboDealt,
        p1DamageDealt: Math.round(f1.totalDamageDealt),
        p1Counters: f1.countersLanded,
        p2MaxCombo: f2.maxComboDealt,
        p2DamageDealt: Math.round(f2.totalDamageDealt),
        p2Counters: f2.countersLanded,
        durationSeconds: elapsedSec,
      },
    });
  }
}
