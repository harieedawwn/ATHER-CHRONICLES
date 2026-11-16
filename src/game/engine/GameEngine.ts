// Core fixed-timestep simulation loop, DOM/canvas lifecycle wrapper, and public match control API.
// Exports: GameEngine.
// Depends on: @/game/ai, @/game/audio, @/game/renderer, @/game/rng, @/game/stages, @/game/types, ./camera, ./context, ./createFighter, ./hudEmitter, ./stepSimulation.

import { AIController } from '@/game/ai';
import { sound } from '@/game/audio';
import { HDPixelRenderer, RENDER_H, RENDER_W } from '@/game/renderer';
import { RngFn } from '@/game/rng';
import { STAGES } from '@/game/stages';
import {
  FighterState,
  HUDState,
  InputState,
  MatchConfig,
  SoundInterface,
  TrainingBehavior,
} from '@/game/types';
import { updateParticlesAndCameraOnly } from './camera';
import { clearTimeDilation, EngineContext, triggerTimeDilation } from './context';
import { createFighter, emptyInput } from './createFighter';
import { buildHUDState } from './hudEmitter';
import { stepSimulationTick } from './stepSimulation';

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: HDPixelRenderer | null = null;
  private ai: AIController;
  private ctx: EngineContext;

  private keysDown = new Set<string>();
  private touchInput: InputState = emptyInput();

  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private onHUDUpdate: (hud: HUDState) => void;
  private lastHudEmit = 0;

  constructor(
    config: MatchConfig,
    onHUDUpdate: (hud: HUDState) => void = () => {},
    options?: { rng?: RngFn; sound?: SoundInterface }
  ) {
    this.onHUDUpdate = onHUDUpdate;
    this.ai = new AIController(options?.rng);
    const stage = STAGES[config.stageId] ?? STAGES.torii;
    const startY = stage.platforms[0].y - 18;
    const [spawnP1X, spawnP2X] = stage.spawnX ?? [-115, 115];
    const fighters: [FighterState, FighterState] = [
      createFighter(0, config.p1Fighter, spawnP1X, startY, 1, config.stocksCount),
      createFighter(1, config.p2Fighter, spawnP2X, startY, -1, config.stocksCount),
    ];
    fighters[0].grounded = true;
    fighters[1].grounded = true;
    if (config.mode === 'training') {
      fighters[0].ultimateGauge = 100;
    }

    this.ctx = {
      config,
      stage,
      fighters,
      sound: options?.sound ?? sound,
      projectiles: [],
      riftSeals: [],
      stasisFields: [],
      portals: [],
      delayedSlashes: [],
      afterimages: [],
      slashArcs: [],
      shockwaves: [],
      particles: [],
      callouts: [],
      nextProjId: 1,
      tick: 0,
      matchFrames: 0,
      countdownFrames: config.mode === 'vs_ai' ? 86 : 18,
      paused: false,
      winnerSlot: null,
      timeDilation: 1.0,
      timeDilationTimer: 0,
      slowMoStep: 0,
      camX: 0,
      camY: 55,
      camZoom: 1.24,
      camAngle: 0,
      camYaw: 0,
      camPitch: 0,
      ultBackdropMode: 'none',
      shakeMag: 0,
      shakeX: 0,
      shakeY: 0,
      impactFrames: 0,
      impactInverted: false,
      trainingBehavior: 'idle',
      showHitboxes: false,
      autoHeal: true,
      lastComboHits: 0,
      lastComboDamage: 0,
      emitHUD: (force: boolean) => this.emitHUD(force),
      triggerTimeDilation: (scale: number, frames: number) =>
        triggerTimeDilation(this.ctx, scale, frames),
      clearTimeDilation: () => clearTimeDilation(this.ctx),
    };
  }

  public mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.width = RENDER_W;
    this.canvas.height = RENDER_H;
    if (!this.renderer) {
      this.renderer = new HDPixelRenderer();
    }
    this.bindKeyboard();
    this.lastTime = performance.now();
    this.emitHUD(true);
    this.loop(this.lastTime);
  }

  public destroy(): void {
    this.ctx.sound.setTimeDilationDuck(false);
    cancelAnimationFrame(this.rafId);
    this.unbindKeyboard();
    this.canvas = null;
  }

  public setPaused(val: boolean): void {
    this.ctx.paused = val;
    this.emitHUD(true);
  }

  public togglePause(): void {
    if (this.ctx.winnerSlot !== null) return;
    this.ctx.paused = !this.ctx.paused;
    this.emitHUD(true);
  }

  public setTrainingBehavior(behavior: TrainingBehavior): void {
    this.ctx.trainingBehavior = behavior;
    this.emitHUD(true);
  }

  public setShowHitboxes(val: boolean): void {
    this.ctx.showHitboxes = val;
    this.emitHUD(true);
  }

  public setAutoHeal(val: boolean): void {
    this.ctx.autoHeal = val;
    this.emitHUD(true);
  }

  public resetTrainingPositions(): void {
    const startY = this.ctx.stage.platforms[0].y - 18;
    const [spawnP1X, spawnP2X] = this.ctx.stage.spawnX ?? [-115, 115];
    this.ctx.fighters = [
      createFighter(0, this.ctx.config.p1Fighter, spawnP1X, startY, 1, this.ctx.config.stocksCount),
      createFighter(1, this.ctx.config.p2Fighter, spawnP2X, startY, -1, this.ctx.config.stocksCount),
    ];
    this.ctx.fighters[0].grounded = true;
    this.ctx.fighters[1].grounded = true;
    if (this.ctx.config.mode === 'training') {
      this.ctx.fighters[0].ultimateGauge = 100;
    }
    this.ctx.projectiles = [];
    this.ctx.riftSeals = [];
    this.ctx.stasisFields = [];
    this.ctx.portals = [];
    this.ctx.delayedSlashes = [];
    this.ctx.afterimages = [];
    this.ctx.slashArcs = [];
    this.ctx.shockwaves = [];
    this.ctx.particles = [];
    this.ctx.callouts = [];
    this.ctx.lastComboHits = 0;
    this.ctx.lastComboDamage = 0;
    this.ctx.camAngle = 0;
    this.emitHUD(true);
  }

  public restartMatch(): void {
    this.ctx.winnerSlot = null;
    this.ctx.paused = false;
    this.ctx.matchFrames = 0;
    clearTimeDilation(this.ctx);
    this.ctx.impactFrames = 0;
    this.ctx.camZoom = 1.24;
    this.ctx.camAngle = 0;
    this.resetTrainingPositions();
    this.ctx.countdownFrames = this.ctx.config.mode === 'vs_ai' ? 86 : 18;
    this.emitHUD(true);
  }

  public setTouchInput(partial: Partial<InputState>): void {
    this.ctx.sound.unlock();
    Object.assign(this.touchInput, partial);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.ctx.sound.unlock();
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

    if (!this.ctx.paused) {
      const stepMs = 1000 / 60;
      this.accumulator += dt;
      while (this.accumulator >= stepMs) {
        this.accumulator -= stepMs;
        this.stepWithTimeDilation();
      }
    }

    if (this.canvas && this.renderer) {
      this.renderer.render(this.canvas, {
        stage: this.ctx.stage,
        fighters: this.ctx.fighters,
        projectiles: this.ctx.projectiles,
        riftSeals: this.ctx.riftSeals,
        stasisFields: this.ctx.stasisFields,
        portals: this.ctx.portals,
        delayedSlashes: this.ctx.delayedSlashes,
        afterimages: this.ctx.afterimages,
        slashArcs: this.ctx.slashArcs,
        shockwaves: this.ctx.shockwaves,
        particles: this.ctx.particles,
        callouts: this.ctx.callouts,
        camX: this.ctx.camX,
        camY: this.ctx.camY,
        camZoom: this.ctx.camZoom,
        camAngle: this.ctx.camAngle,
        camYaw: this.ctx.camYaw,
        camPitch: this.ctx.camPitch,
        ultBackdropMode: this.ctx.ultBackdropMode,
        shakeX: this.ctx.shakeX,
        shakeY: this.ctx.shakeY,
        impactFrames: this.ctx.impactFrames,
        impactInverted: this.ctx.impactInverted,
        timeDilation: this.ctx.timeDilation,
        showHitboxes: this.ctx.showHitboxes,
        tick: this.ctx.tick,
      });
    }

    if (now - this.lastHudEmit > 50) {
      this.emitHUD(false);
      this.lastHudEmit = now;
    }
  };

  private stepWithTimeDilation(p1InputOverride?: InputState): void {
    if (this.ctx.timeDilationTimer > 0) {
      this.ctx.timeDilationTimer--;
      if (this.ctx.timeDilationTimer <= 0) {
        clearTimeDilation(this.ctx);
      }
    }
    if (this.ctx.timeDilation < 1.0) {
      this.ctx.slowMoStep += this.ctx.timeDilation;
      if (this.ctx.slowMoStep < 1.0) {
        updateParticlesAndCameraOnly(this.ctx);
        return;
      }
      this.ctx.slowMoStep -= 1.0;
    }
    stepSimulationTick(this.ctx, this.ai, () => this.readPlayerInput(), p1InputOverride);
  }

  public stepHeadless(p1InputOverride?: InputState): void {
    if (this.ctx.paused) return;
    this.stepWithTimeDilation(p1InputOverride);
  }

  public getFighters(): [FighterState, FighterState] {
    return this.ctx.fighters;
  }

  public getTick(): number {
    return this.ctx.tick;
  }

  public getWinnerSlot(): 0 | 1 | 'draw' | null {
    return this.ctx.winnerSlot;
  }

  private emitHUD(force: boolean): void {
    if (!force && !this.canvas) return;
    this.onHUDUpdate(buildHUDState(this.ctx));
  }
}
