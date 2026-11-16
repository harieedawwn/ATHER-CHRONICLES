// Actionable input buffer consumption (Ultimate, Specials, Strongs, Lights, Dash/Parry, Jump, Taunt) and locomotion.
// Exports: tryConsumeActionBuffers, stepLocomotion.
// Depends on: @/game/types, ./context, ./inputBuffer, ./scarf, ./vfxSpawners.

import { FighterState, MoveData, MoveKey } from '@/game/types';
import { EngineContext } from './context';
import { consumeBuffered } from './inputBuffer';
import { updateScarf } from './scarf';
import {
  spawnAfterimage,
  spawnDashWindCone,
  spawnDust,
  spawnHitSparks,
} from './vfxSpawners';

function handleDashOrParryBuffer(
  ctx: EngineContext,
  f: FighterState,
  moveDirX: -1 | 0 | 1,
  moveDirY: -1 | 0 | 1,
  speedMult: number
): boolean {
  const isMoving = f.grounded ? moveDirX !== 0 : moveDirX !== 0 || moveDirY !== 0;
  const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
  if (isMoving) {
    if (f.grounded) {
      f.action = 'dash';
      f.actionFrame = 0;
      f.facing = moveDirX !== 0 ? moveDirX : f.facing;
      f.vx = f.facing * f.spec.stats.dashSpeed * 1.16 * speedMult;
      f.invulnFrames = 8;
      f.squashX = 1.16;
      f.squashY = 0.86;
      spawnAfterimage(ctx, f, f.spec.accentColor);
      spawnDashWindCone(ctx, f.x + f.facing * 12, f.y - 8, f.facing > 0 ? 0 : Math.PI, f.spec.accentColor);
      spawnDust(ctx, f.x, f.y + 18, f.facing);
      ctx.sound.playDash(f.id, false, pan);
      updateScarf(ctx, f);
      return true;
    }
    if (f.airDashAvailable) {
      f.airDashAvailable = false;
      f.action = 'airdodge';
      f.actionFrame = 0;
      f.invulnFrames = 14;
      const dx = moveDirX !== 0 ? moveDirX : f.facing;
      const dy = moveDirY;
      if (moveDirX !== 0) f.facing = moveDirX;
      const norm = Math.hypot(dx, dy) || 1;
      f.vx = (dx / norm) * 6.8 * speedMult;
      f.vy = (dy / norm) * 5.4 * speedMult;
      f.squashX = 1.15;
      f.squashY = 0.87;
      spawnAfterimage(ctx, f, f.spec.accentColor);
      spawnDashWindCone(ctx, f.x, f.y - 8, Math.atan2(f.vy, f.vx), f.spec.accentColor);
      ctx.sound.playDash(f.id, true, pan);
      updateScarf(ctx, f);
      return true;
    }
  } else if (f.parryCooldown <= 0) {
    f.action = 'parry';
    f.actionFrame = 0;
    f.invulnFrames = 13;
    f.parryCooldown = 26;
    f.vx *= 0.2;
    if (!f.grounded) {
      f.vy = Math.min(0.4, f.vy * 0.25);
    }
    ctx.shockwaves.push({
      x: f.x,
      y: f.y - 8,
      radius: 5,
      maxRadius: 32,
      color: '#f8fafc',
      life: 12,
      maxLife: 12,
      lineWidth: 2.2,
    });
    ctx.particles.push({
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
    ctx.sound.playParryStance(f.id, pan);
    updateScarf(ctx, f);
    return true;
  }
  return false;
}

function handleJumpBuffer(ctx: EngineContext, f: FighterState, isShort: boolean): void {
  const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
  if (f.grounded) {
    f.vy = isShort ? -f.spec.stats.shortHopForce : -f.spec.stats.jumpForce;
    f.grounded = false;
    f.onPlatform = false;
    f.action = 'air';
    f.actionFrame = 0;
    f.squashX = 0.78;
    f.squashY = 1.24;
    spawnDust(ctx, f.x, f.y + 18, 0);
    ctx.sound.playJump(isShort, f.id, false, pan);
  } else if (f.jumpsLeft > 0) {
    f.jumpsLeft--;
    f.vy = isShort ? -f.spec.stats.shortHopForce * 0.95 : -f.spec.stats.jumpForce * 0.95;
    f.fastFalling = false;
    f.action = 'air';
    f.actionFrame = 0;
    f.squashX = 0.8;
    f.squashY = 1.22;
    ctx.shockwaves.push({
      x: f.x,
      y: f.y + 16,
      radius: 3,
      maxRadius: 18,
      color: f.spec.accentColor,
      life: 10,
      maxLife: 10,
      lineWidth: 1.5,
    });
    ctx.sound.playJump(isShort, f.id, true, pan);
  }
}

export function tryConsumeActionBuffers(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  dirX: -1 | 0 | 1,
  dirY: -1 | 0 | 1,
  speedMult: number,
  onStartMove: (fighter: FighterState, move: MoveData, opponent: FighterState) => void
): boolean {
  const bufUlt = consumeBuffered(f, 'ultimate');
  if (bufUlt) {
    if (f.ultimateGauge >= 100) {
      f.facing = bufUlt.dirX !== 0 ? bufUlt.dirX : foe.x >= f.x ? 1 : -1;
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
      ctx.impactFrames = 4;
      ctx.shakeMag = Math.max(ctx.shakeMag, 9);
      ctx.shockwaves.push({
        x: f.x,
        y: f.y - 12,
        radius: 6,
        maxRadius: 88,
        color: f.spec.secondaryColor,
        life: 22,
        maxLife: 22,
        lineWidth: 3.5,
      });
      spawnHitSparks(ctx, f.x, f.y - 14, f.spec.secondaryColor, 20);
      ctx.callouts.push({
        x: f.x,
        y: f.y - 44,
        vy: -0.5,
        text: f.spec.ultimateName,
        color: '#fde047',
        life: 44,
        maxLife: 44,
      });
      ctx.sound.playUltimateActivation(f.id);
      updateScarf(ctx, f);
      return true;
    }
    ctx.callouts.push({
      x: f.x,
      y: f.y - 36,
      vy: -0.5,
      text: `ULTIMATE ${Math.floor(f.ultimateGauge)}%`,
      color: '#94a3b8',
      life: 20,
      maxLife: 20,
    });
  }

  const bufSpec = consumeBuffered(f, 'special');
  if (bufSpec) {
    if (bufSpec.dirX !== 0) f.facing = bufSpec.dirX;
    let moveKey: MoveKey = 'nspecial';
    if (bufSpec.dirY < 0) moveKey = 'uspecial';
    else if (bufSpec.dirY > 0) moveKey = 'dspecial';
    else if (bufSpec.dirX !== 0) moveKey = 'sspecial';
    onStartMove(f, f.spec.moves[moveKey], foe);
    updateScarf(ctx, f);
    return true;
  }

  const bufStrong = consumeBuffered(f, 'strong');
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
      onStartMove(f, move, foe);
    }
    updateScarf(ctx, f);
    return true;
  }

  const bufLight = consumeBuffered(f, 'light');
  if (bufLight) {
    if (!f.grounded) {
      let airKey: MoveKey = 'nair';
      if (bufLight.dirY < 0) airKey = 'uair';
      else if (bufLight.dirY > 0) airKey = 'dair';
      else if (bufLight.dirX !== 0) airKey = bufLight.dirX === f.facing ? 'fair' : 'bair';
      onStartMove(f, f.spec.moves[airKey], foe);
    } else {
      if (bufLight.dirX !== 0) f.facing = bufLight.dirX;
      let gKey: MoveKey = 'jab1';
      if (bufLight.dirY < 0) gKey = 'utilt';
      else if (bufLight.dirY > 0) gKey = 'dtilt';
      else if (bufLight.dirX !== 0) gKey = 'ftilt';
      onStartMove(f, f.spec.moves[gKey], foe);
    }
    updateScarf(ctx, f);
    return true;
  }

  const bufDash = consumeBuffered(f, 'dash');
  if (bufDash) {
    const moveDirX: -1 | 0 | 1 = bufDash.dirX !== 0 ? bufDash.dirX : dirX;
    const moveDirY: -1 | 0 | 1 = bufDash.dirY !== 0 ? bufDash.dirY : dirY;
    if (handleDashOrParryBuffer(ctx, f, moveDirX, moveDirY, speedMult)) {
      return true;
    }
  }

  const bufShort = consumeBuffered(f, 'shortHop');
  const bufJump = consumeBuffered(f, 'jump');
  if (bufShort || bufJump) {
    handleJumpBuffer(ctx, f, Boolean(bufShort));
  }

  const bufTaunt = consumeBuffered(f, 'taunt');
  if (bufTaunt && f.grounded) {
    f.facing = foe.x >= f.x ? 1 : -1;
    f.action = 'taunt';
    f.actionFrame = 0;
    f.currentMove = null;
    f.vx *= 0.25;
    ctx.sound.playTaunt(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    updateScarf(ctx, f);
    return true;
  }

  return false;
}

export function stepLocomotion(
  ctx: EngineContext,
  f: FighterState,
  dirX: -1 | 0 | 1,
  dirY: -1 | 0 | 1,
  speedMult: number
): void {
  if (f.grounded) {
    const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
    if (f.action === 'dash' && f.actionFrame < 9 && ctx.tick % 2 === 0) {
      spawnAfterimage(ctx, f, f.spec.accentColor);
    }
    if (dirX !== 0) {
      const reversingMomentum = Math.sign(dirX) !== Math.sign(f.vx) && Math.abs(f.vx) > 1.8;
      f.facing = dirX;
      const targetVx =
        dirX *
        (f.action === 'dash' ? f.spec.stats.dashSpeed * 1.05 : f.spec.stats.walkSpeed) *
        speedMult;
      if (reversingMomentum) {
        f.vx += (targetVx - f.vx) * 0.14;
        f.squashX = Math.max(f.squashX, 1.1);
        f.squashY = Math.min(f.squashY, 0.91);
        if (ctx.tick % 3 === 0) {
          spawnDust(ctx, f.x - dirX * 8, f.y + 18, -dirX);
          ctx.sound.playSkid(f.id, pan);
        }
      } else {
        f.vx += (targetVx - f.vx) * (f.action === 'dash' ? 0.16 : 0.22);
      }
      if (f.action !== 'dash') f.action = 'walk';

      const stepPeriod = f.action === 'dash' ? 10 : 16;
      if (f.actionFrame % stepPeriod === 0 && Math.abs(f.vx) > 1.1) {
        if (f.action === 'dash') {
          spawnDust(ctx, f.x - f.facing * 4, f.y + 18, f.facing);
        }
        ctx.sound.playFootstep(f.id, f.action === 'dash', pan);
        f.squashX = Math.max(f.squashX, 1.04);
        f.squashY = Math.min(f.squashY, 0.96);
      }
    } else {
      if (Math.abs(f.vx) > 2.6 && ctx.tick % 3 === 0) {
        spawnDust(ctx, f.x + Math.sign(f.vx) * 6, f.y + 18, -Math.sign(f.vx));
        ctx.sound.playSkid(f.id, pan);
      }
      f.vx *= 0.82;
      if (Math.abs(f.vx) < 0.18) {
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
}
