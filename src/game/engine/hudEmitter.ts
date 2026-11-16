// HUD state snapshot builder, fighter status banners, gauge labels, and time-over winner resolution.
// Exports: getGaugeLabel, getFighterStatusBanner, buildHUDState, resolveTimeOver.
// Depends on: @/game/types, ./context.

import { FighterId, FighterState, HUDState } from '@/game/types';
import { EngineContext } from './context';

export function resolveTimeOver(ctx: EngineContext): void {
  const f1 = ctx.fighters[0];
  const f2 = ctx.fighters[1];
  if (ctx.config.ruleset === 'stock') {
    if (f1.stocks !== f2.stocks) {
      ctx.winnerSlot = f1.stocks > f2.stocks ? 0 : 1;
    } else if (Math.abs(f1.damagePercent - f2.damagePercent) > 0.5) {
      ctx.winnerSlot = f1.damagePercent < f2.damagePercent ? 0 : 1;
    } else {
      ctx.winnerSlot = 'draw';
    }
  } else {
    if (f1.hp !== f2.hp) {
      ctx.winnerSlot = f1.hp > f2.hp ? 0 : 1;
    } else {
      ctx.winnerSlot = 'draw';
    }
  }
  ctx.emitHUD(true);
}

export function getGaugeLabel(id: FighterId): string {
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

export function getFighterStatusBanner(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState
): string | null {
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
    const rods = ctx.riftSeals.filter(
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
  if (f.id === 'nyx' && ctx.portals.some((pr) => pr.ownerSlot === f.slot)) {
    return 'WORMHOLE ACTIVE';
  }
  if (f.id === 'jin') {
    if (f.puppetAttackTimer > 0) return 'KARASU SYNC';
    if (f.anchorActive && f.suspendTimer > 0) return 'KARASU PINCER';
  }
  return null;
}

function buildFighterSnapshot(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState
): HUDState['p1'] {
  return {
    id: f.id,
    name: f.spec.name,
    title: f.spec.title,
    accentColor: f.spec.accentColor,
    secondaryColor: f.spec.secondaryColor,
    damagePercent: Math.round(f.damagePercent),
    hp: Math.round(f.hp),
    maxHp: f.maxHp,
    stocks: f.stocks,
    gauge: Math.round(f.gauge),
    gaugeLabel: getGaugeLabel(f.id),
    ultimateGauge: Math.round(f.ultimateGauge),
    ultimateName: f.spec.ultimateName,
    isOverdrive: f.overdriveTimer > 0,
    isSuspended: f.action === 'kuro_suspend',
    isHakiActive: f.action === 'kenji_haki',
    armorStacks: f.armorStacks,
    cinderMarks: f.cinderMarks,
    statusBanner: getFighterStatusBanner(ctx, f, foe),
    comboCount: foe.comboCountReceived,
  };
}

export function buildHUDState(ctx: EngineContext): HUDState {
  const f1 = ctx.fighters[0];
  const f2 = ctx.fighters[1];
  const elapsedSec = Math.floor(ctx.matchFrames / 60);
  const timerSeconds = ctx.config.mode === 'vs_ai' ? Math.max(0, 99 - elapsedSec) : elapsedSec;

  let countdownLabel: HUDState['countdownLabel'] = null;
  if (ctx.countdownFrames > 63) countdownLabel = '3';
  else if (ctx.countdownFrames > 41) countdownLabel = '2';
  else if (ctx.countdownFrames > 18) countdownLabel = '1';
  else if (ctx.countdownFrames > 0) countdownLabel = 'FIGHT!';

  return {
    p1: buildFighterSnapshot(ctx, f1, f2),
    p2: buildFighterSnapshot(ctx, f2, f1),
    timerSeconds,
    ruleset: ctx.config.ruleset,
    mode: ctx.config.mode,
    stocksCount: ctx.config.stocksCount,
    paused: ctx.paused,
    countdownLabel,
    winnerSlot: ctx.winnerSlot,
    training: {
      dummyBehavior: ctx.trainingBehavior,
      showHitboxes: ctx.showHitboxes,
      autoHeal: ctx.autoHeal,
      lastComboHits: ctx.lastComboHits,
      lastComboDamage: ctx.lastComboDamage,
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
  };
}
