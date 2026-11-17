// Mutable simulation state and callback contract shared across engine subsystems and special handlers.
// Exports: EngineContext, UltBackdropMode, triggerTimeDilation, clearTimeDilation.
// Depends on: ../types.

import {
  Afterimage,
  DelayedSlash,
  FighterState,
  FloatingCallout,
  MatchConfig,
  Particle,
  PortalPair,
  Projectile,
  RiftSeal,
  ShockwaveRing,
  SlashArc,
  SoundInterface,
  StageSpec,
  StasisField,
  TrainingBehavior,
} from '../types';

export type UltBackdropMode =
  | 'none'
  | 'stage25d'
  | 'speedlines'
  | 'impact_bw'
  | 'climax_flash';

export interface VfxEvent {
  type?: 'impact' | 'dash' | 'blink' | 'ko';
  x: number;
  y: number;
  dir: number;
  power: number;
  color: string;
  ground?: boolean;
  seed?: number;
}

export interface EngineContext {
  config: MatchConfig;
  stage: StageSpec;
  fighters: [FighterState, FighterState];

  projectiles: Projectile[];
  riftSeals: RiftSeal[];
  stasisFields: StasisField[];
  portals: PortalPair[];
  delayedSlashes: DelayedSlash[];
  afterimages: Afterimage[];
  slashArcs: SlashArc[];
  shockwaves: ShockwaveRing[];
  particles: Particle[];
  callouts: FloatingCallout[];
  vfxEvents: VfxEvent[];

  nextProjId: number;
  tick: number;
  matchFrames: number;
  countdownFrames: number;
  paused: boolean;
  winnerSlot: 0 | 1 | 'draw' | null;
  timeDilation: number;
  timeDilationTimer: number;
  slowMoStep: number;

  // Camera & Juice (including 2.5D Ultimate Camera Rig)
  camX: number;
  camY: number;
  camZoom: number;
  camAngle: number;
  camYaw: number;
  camPitch: number;
  ultBackdropMode: UltBackdropMode;
  shakeMag: number;
  shakeX: number;
  shakeY: number;
  impactFrames: number;
  impactInverted: boolean;

  // Training state
  trainingBehavior: TrainingBehavior;
  showHitboxes: boolean;
  autoHeal: boolean;
  lastComboHits: number;
  lastComboDamage: number;

  // Headless-safe injected services
  sound: SoundInterface;
  emitHUD: (force: boolean) => void;
  triggerTimeDilation: (scale: number, frames: number) => void;
  clearTimeDilation: () => void;
}

export function triggerTimeDilation(ctx: EngineContext, scale: number, frames: number): void {
  ctx.timeDilation = scale;
  ctx.timeDilationTimer = Math.max(ctx.timeDilationTimer, frames);
  ctx.sound.setTimeDilationDuck(scale < 0.75);
}

export function clearTimeDilation(ctx: EngineContext): void {
  ctx.timeDilation = 1.0;
  ctx.timeDilationTimer = 0;
  ctx.slowMoStep = 0;
  ctx.sound.setTimeDilationDuck(false);
}
