// Ultimate Awakening Act I (Frames 1..60), Act II Unblockable Pursuit (Frames 61..126), and Whiff Recovery (Frames 127..156).
// Exports: getUltimateBounds, stepUltimateAct1, stepUltimateAct2, stepUltimateWhiffRecovery.
// Depends on: @/game/types, @/game/engine/context, @/game/engine/physics, @/game/engine/scarf, @/game/engine/vfxSpawners.

import { EngineContext } from '@/game/engine/context';
import { applyPhysics, checkBounds } from '@/game/engine/physics';
import { updateScarf } from '@/game/engine/scarf';
import {
  spawnAfterimage,
  spawnDashWindCone,
  spawnDust,
  spawnHitSparks,
} from '@/game/engine/vfxSpawners';
import { FighterState, InputState } from '@/game/types';

export interface UltimateBounds {
  minSafeX: number;
  maxSafeX: number;
  groundY: number;
}

export function getUltimateBounds(ctx: EngineContext): UltimateBounds {
  const mainPlats = ctx.stage.platforms.filter((p) => p.isMain);
  const minSafeX =
    mainPlats.length > 0
      ? Math.min(...mainPlats.map((p) => p.x - p.width * 0.5)) + 32
      : -220;
  const maxSafeX =
    mainPlats.length > 0
      ? Math.max(...mainPlats.map((p) => p.x + p.width * 0.5)) - 32
      : 220;
  const groundY = (mainPlats[0]?.y ?? 124) - 18;
  return { minSafeX, maxSafeX, groundY };
}

export function stepUltimateAct1(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  bounds: UltimateBounds
): void {
  const af = f.actionFrame;
  f.vx *= 0.4;
  f.vy = 0;
  f.z = -32;
  f.ultPose = 'ult_charge';
  f.ultStageLabel = `${f.spec.ultimateName} // AWAKENING`;

  if (af === 28) {
    ctx.impactFrames = 2;
    ctx.shakeMag = Math.max(ctx.shakeMag, 9);
    ctx.shockwaves.push({
      x: f.x,
      y: f.y + 14,
      radius: 8,
      maxRadius: 88,
      color: '#fde047',
      life: 18,
      maxLife: 18,
      lineWidth: 3,
    });
    spawnHitSparks(ctx, f.x + f.facing * 12, f.y - 14, f.spec.secondaryColor, 20);
    spawnDust(ctx, f.x, f.y + 18, 0);
  }

  if (af % 3 === 0) {
    ctx.particles.push({
      x: f.x + (Math.random() - 0.5) * 48,
      y: f.y + 18,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -1.8 - Math.random() * 2.4,
      size: 3 + Math.random() * 2,
      color: af % 6 === 0 ? '#fde047' : f.spec.secondaryColor,
      life: 18,
      maxLife: 18,
      gravity: -0.04,
      drag: 0.96,
      shape: af % 6 === 0 ? 'debris' : 'spark',
      angle: Math.random() * Math.PI,
      spin: 0.15,
    });
  }

  if (af === 60) {
    f.facing = foe.x >= f.x ? 1 : -1;
    const distToFoe = Math.min(280, Math.max(115, Math.abs(foe.x - f.x)));
    f.anchorX = Math.max(bounds.minSafeX, Math.min(bounds.maxSafeX, f.x + f.facing * distToFoe));
    f.anchorY = foe.grounded ? foe.y : bounds.groundY;
  }
  updateScarf(ctx, f);
}

function confirmUltimateCatch(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  bounds: UltimateBounds
): boolean {
  if (foe.action === 'parry' || foe.action === 'kenji_haki') {
    foe.invulnFrames = 0;
    ctx.sound.playGuardShatter(Math.max(-0.85, Math.min(0.85, foe.x / 360)));
    ctx.callouts.push({
      x: foe.x,
      y: foe.y - 52,
      vy: -0.8,
      text: 'GUARD SHATTERED!',
      color: '#ef4444',
      life: 38,
      maxLife: 38,
    });
  }
  if (foe.invulnFrames > 0) return false;

  f.moveHitConnected = true;
  f.specialsLanded++;
  f.actionFrame = 127;
  f.anchorX = Math.max(bounds.minSafeX + 64, Math.min(bounds.maxSafeX - 64, foe.x));
  f.anchorY = bounds.groundY;

  const dir = f.facing;
  f.x = f.anchorX - dir * 24;
  f.y = bounds.groundY;
  f.z = -38;
  f.ultPose = 'ult_gut_strike';

  foe.x = f.anchorX;
  foe.y = bounds.groundY;
  foe.z = 12;
  foe.vx = 0;
  foe.vy = 0;
  foe.facing = (-dir) as 1 | -1;
  foe.grounded = true;
  foe.action = 'hitstun';
  foe.hitstunFrames = 320;
  foe.ultPose = 'ult_victim_gut';
  foe.flashWhiteFrames = 6;
  foe.squashX = 0.72;
  foe.squashY = 1.28;

  ctx.impactFrames = 6;
  ctx.shakeMag = 18;
  spawnHitSparks(ctx, foe.x, foe.y - 12, '#fde047', 28);
  spawnDust(ctx, foe.x, bounds.groundY + 18, dir);
  ctx.sound.playUltimateBarrageStrike(f.id, 0);
  updateScarf(ctx, f);
  return true;
}

export function stepUltimateAct2(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  bounds: UltimateBounds
): void {
  const af = f.actionFrame;
  const { minSafeX, maxSafeX, groundY } = bounds;

  if (af === 61) {
    f.z = 0;
    f.ultPose = 'ult_sprint';
    f.ultStageLabel = 'UNBLOCKABLE PURSUIT — DODGE OR RUN!';
    ctx.callouts.push({
      x: f.x,
      y: f.y - 48,
      vy: -0.35,
      text: '⚠ UNBLOCKABLE RUSH — DODGE NOW!',
      color: '#ef4444',
      life: 44,
      maxLife: 44,
    });
    ctx.sound.playDash(f.id, false, Math.max(-0.85, Math.min(0.85, f.x / 360)));
  }

  f.ultPose = 'ult_sprint';

  if ((af - 62) % 5 === 0 && af <= 122) {
    const stepIdx = Math.floor((af - 62) / 5);
    ctx.sound.playUltimateSprintStep(f.id, stepIdx);
    spawnDust(ctx, f.x, f.y + 18, f.facing);
    spawnDashWindCone(
      ctx,
      f.x + f.facing * 12,
      f.y - 10,
      f.facing > 0 ? 0 : Math.PI,
      f.spec.accentColor
    );
    spawnAfterimage(ctx, f, stepIdx % 2 === 0 ? f.spec.accentColor : f.spec.secondaryColor);
  }

  if (af <= 98) {
    const desiredX = f.anchorX + (foe.x - f.anchorX) * 0.25;
    f.anchorX = Math.max(minSafeX, Math.min(maxSafeX, desiredX));
    f.anchorY = foe.grounded ? foe.y : groundY;
    f.facing = f.anchorX >= f.x ? 1 : -1;
  }

  if (f.id === 'velo') {
    const zig = Math.sin(af * 0.55) * 14;
    f.x = Math.max(minSafeX, Math.min(maxSafeX, f.x + (f.anchorX - f.x) * 0.16));
    f.y = groundY - 6 + zig * 0.4;
    f.z = zig * 1.4;
  } else if (f.id === 'jin') {
    f.puppetActive = true;
    f.puppetX += (f.anchorX - f.puppetX) * 0.28;
    f.puppetY += (f.anchorY - 18 - f.puppetY) * 0.28;
    f.puppetAttackTimer = 8;
    f.x = Math.max(minSafeX, Math.min(maxSafeX, f.x + (f.anchorX - f.facing * 24 - f.x) * 0.15));
    f.y = groundY;
  } else {
    const rushTargetX = f.anchorX - f.facing * 14;
    f.x = Math.max(minSafeX, Math.min(maxSafeX, f.x + (rushTargetX - f.x) * 0.17));
    f.y = groundY;
    f.z = 0;
  }

  if (af >= 72 && !f.moveHitConnected && foe.action !== 'ko_respawn') {
    const halfW = f.id === 'kenji' || f.id === 'raijin' || f.id === 'chrono' ? 96 : 86;
    const halfH = 76;
    const puppetHit =
      f.id === 'jin' && f.puppetActive && Math.hypot(foe.x - f.puppetX, foe.y - f.puppetY) <= 56;
    const inZone =
      (Math.abs(foe.x - f.anchorX) <= halfW && Math.abs(foe.y - f.anchorY) <= halfH) ||
      Math.hypot(foe.x - f.x, foe.y - f.y) <= 68 ||
      puppetHit;

    if (inZone && confirmUltimateCatch(ctx, f, foe, bounds)) {
      return;
    }
  }

  if (af === 126 && !f.moveHitConnected) {
    f.z = 0;
    f.ultPose = 'none';
    f.ultStageLabel = undefined;
    ctx.sound.playWallSlam(f.id, 1.2, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    ctx.shakeMag = 9;
    spawnDust(ctx, f.x, groundY + 18, f.facing);
    ctx.callouts.push({
      x: foe.x,
      y: foe.y - 42,
      vy: -0.7,
      text: 'ULTIMATE EVADED!',
      color: '#38bdf8',
      life: 36,
      maxLife: 36,
    });
  }

  updateScarf(ctx, f);
}

export function stepUltimateWhiffRecovery(
  ctx: EngineContext,
  f: FighterState,
  inp: InputState
): void {
  f.z = 0;
  f.ultPose = 'none';
  f.ultStageLabel = undefined;
  applyPhysics(ctx, f, inp, 1.0);
  if (f.actionFrame >= 156) {
    f.action = f.grounded ? 'idle' : 'air';
    f.actionFrame = 0;
    f.currentMove = null;
  }
  updateScarf(ctx, f);
  checkBounds(ctx, f);
}
