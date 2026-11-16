// Per-frame fighter state machine: timers, stances, hitstun, charge, jump squat, and delegation.
// Exports: startMove, stepTaunt, stepFighter.
// Depends on: @/game/types, @/game/specials, ./context, ./fighterAttackAndTaunt, ./locomotionAndBuffers, ./physics, ./scarf, ./vfxSpawners.

import {
  stepKenjiHaki,
  stepKuroSuspend,
  stepUltimate,
  updateJinPuppet,
} from '@/game/specials';
import { FighterState, InputState } from '@/game/types';
import { EngineContext } from './context';
import { startMove, stepActiveAttack, stepTaunt } from './fighterAttackAndTaunt';
import { stepLocomotion, tryConsumeActionBuffers } from './locomotionAndBuffers';
import { applyPhysics, checkBounds } from './physics';
import { updateScarf } from './scarf';
import { spawnAfterimage, spawnDust } from './vfxSpawners';

export function stepFighter(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  inp: InputState
): void {
  if (f.invulnFrames > 0) f.invulnFrames--;
  if (f.parryCooldown > 0) f.parryCooldown--;
  if (f.dropThroughTimer > 0) f.dropThroughTimer--;
  if (f.flashWhiteFrames > 0) f.flashWhiteFrames--;
  if (f.stasisSlowTimer > 0) f.stasisSlowTimer--;
  if (f.puppetAttackTimer > 0) f.puppetAttackTimer--;

  if (f.id === 'jin' && f.puppetActive) {
    updateJinPuppet(ctx, f, foe);
  }

  f.squashX += (1 - f.squashX) * 0.24;
  f.squashY += (1 - f.squashY) * 0.24;

  if (f.hitstopFrames > 0) {
    f.hitstopFrames--;
    f.vibrateX =
      f.action === 'hitstun'
        ? (f.hitstopFrames % 2 === 0 ? 1 : -1) * 2.6
        : (f.hitstopFrames % 2 === 0 ? 1 : -1) * 0.8;
    return;
  }
  f.vibrateX = 0;

  if (f.stasisSlowTimer > 0 && ctx.tick % 2 === 1) {
    updateScarf(ctx, f);
    return;
  }

  const isOverdrive = f.overdriveTimer > 0;
  if (f.overdriveTimer > 0) {
    f.overdriveTimer--;
    f.gauge = Math.max(0, (f.overdriveTimer / 330) * 100);
    if (ctx.tick % 2 === 0) {
      spawnAfterimage(
        ctx,
        f,
        f.id === 'sol'
          ? ctx.tick % 4 === 0
            ? '#f97316'
            : '#fde047'
          : ctx.tick % 4 === 0
          ? '#06b6d4'
          : '#facc15'
      );
    }
  }
  const speedMult = (isOverdrive ? 1.18 : 1.0) * (f.stasisSlowTimer > 0 ? 0.45 : 1.0);

  if (f.action === 'ko_respawn') {
    f.actionFrame++;
    if (f.actionFrame >= 42) {
      const [spawnP1X, spawnP2X] = ctx.stage.spawnX ?? [-110, 110];
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

  if (f.action === 'kuro_suspend') {
    stepKuroSuspend(ctx, f, foe, startMove);
    return;
  }
  if (f.action === 'kenji_haki') {
    stepKenjiHaki(ctx, f);
    return;
  }
  if (f.action === 'taunt') {
    stepTaunt(ctx, f, foe, inp, speedMult);
    return;
  }
  if (f.action === 'ultimate') {
    stepUltimate(ctx, f, foe, inp);
    return;
  }

  if (f.action === 'hitstun') {
    f.hitstunFrames--;
    if (f.suspendTimer > 0) {
      f.suspendTimer--;
      f.vx = 0;
      f.vy = 0;
      updateScarf(ctx, f);
      return;
    }
    if (ctx.tick % 3 === 0 && Math.hypot(f.vx, f.vy) > 5) {
      ctx.particles.push({
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
    applyPhysics(ctx, f, inp, 1.0);
    updateScarf(ctx, f);
    checkBounds(ctx, f);
    return;
  }

  if (f.action === 'parry' || f.action === 'airdodge') {
    if (f.action === 'airdodge') {
      f.vx *= 0.92;
      f.vy *= 0.92;
      if (ctx.tick % 2 === 0) spawnAfterimage(ctx, f, f.spec.accentColor);
    } else {
      f.vx *= 0.78;
    }
    if (f.actionFrame >= (f.action === 'parry' ? 14 : 16)) {
      f.action = f.grounded ? 'idle' : 'air';
      f.actionFrame = 0;
    }
    applyPhysics(ctx, f, inp, speedMult);
    updateScarf(ctx, f);
    checkBounds(ctx, f);
    return;
  }

  if (f.action === 'strong_charge' && f.currentMove) {
    f.vx *= 0.78;
    f.chargeFrames++;
    if (ctx.tick % 3 === 0) {
      ctx.particles.push({
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
    const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
    if (f.chargeFrames % 6 === 1) {
      ctx.sound.playChargePulse(f.id, Math.min(1, f.chargeFrames / maxC), pan);
    }
    if (!inp.strong || f.chargeFrames >= maxC) {
      f.action = 'attack';
      f.actionFrame = 0;
      f.moveHitConnected = false;
      f.moveHitsDone = 0;
      if (f.id === 'jin' && f.puppetActive) {
        f.puppetAttackTimer = 14;
        f.puppetVx += f.facing * 7.5;
      }
      ctx.sound.playAttackSwing(f.id, f.currentMove.key, f.currentMove.category, pan);
    }
    applyPhysics(ctx, f, inp, speedMult);
    updateScarf(ctx, f);
    return;
  }

  if (f.action === 'attack' && f.currentMove) {
    stepActiveAttack(ctx, f, foe, inp, speedMult, isOverdrive);
    return;
  }

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
      spawnDust(ctx, f.x, f.y + 18, 0);
      ctx.sound.playJump(isShort, f.id, false, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    }
    applyPhysics(ctx, f, inp, speedMult);
    updateScarf(ctx, f);
    return;
  }

  const dirX: -1 | 0 | 1 = inp.right && !inp.left ? 1 : inp.left && !inp.right ? -1 : 0;
  const dirY: -1 | 0 | 1 = inp.down && !inp.up ? 1 : inp.up && !inp.down ? -1 : 0;

  if (
    tryConsumeActionBuffers(ctx, f, foe, dirX, dirY, speedMult, (fighter, move, opponent) =>
      startMove(ctx, fighter, move, opponent)
    )
  ) {
    return;
  }

  stepLocomotion(ctx, f, dirX, dirY, speedMult);
  applyPhysics(ctx, f, inp, speedMult);
  updateScarf(ctx, f);
  checkBounds(ctx, f);
}

export { startMove, stepTaunt };
