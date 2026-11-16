// Attack initiation, active attack frame stepping, and signature taunt execution.
// Exports: startMove, stepTaunt, stepActiveAttack.
// Depends on: @/game/types, @/game/specials, ./context, ./inputBuffer, ./physics, ./scarf, ./vfxSpawners.

import { SPECIAL_HANDLERS } from '@/game/specials';
import { FighterState, InputState, MoveData } from '@/game/types';
import { EngineContext } from './context';
import { consumeBuffered } from './inputBuffer';
import { applyPhysics, checkBounds } from './physics';
import { updateScarf } from './scarf';
import { spawnDust, spawnHitSparks, spawnMoveArc } from './vfxSpawners';

export function startMove(
  ctx: EngineContext,
  f: FighterState,
  move: MoveData,
  foe: FighterState
): void {
  const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
  if (f.id === 'jin' && f.puppetActive) {
    f.puppetAttackTimer = 14;
    f.puppetVx += f.facing * 6.5;
  }

  const handler = move.specialTag ? SPECIAL_HANDLERS[move.specialTag] : undefined;
  if (handler?.onStart?.(ctx, f, move, foe, pan) === 'handled') {
    return;
  }

  f.action = 'attack';
  f.actionFrame = 0;
  f.currentMove = move;
  f.moveHitConnected = false;
  f.moveHitsDone = 0;
  f.chargeFrames = 0;
}

export function stepTaunt(
  ctx: EngineContext,
  f: FighterState,
  _foe: FighterState,
  inp: InputState,
  speedMult: number
): void {
  f.vx *= 0.76;

  if (f.actionFrame === 2) {
    ctx.callouts.push({
      x: f.x,
      y: f.y - 42,
      vy: -0.45,
      text: f.spec.tauntQuote,
      color: f.spec.secondaryColor,
      life: 44,
      maxLife: 44,
    });
    ctx.shockwaves.push({
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

  if (f.actionFrame % 4 === 0 && f.actionFrame < 38) {
    const ang = f.actionFrame * 0.45 + (f.facing > 0 ? 0 : Math.PI);
    ctx.particles.push({
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

  if (f.actionFrame === 14) {
    const prevUlt = f.ultimateGauge;
    f.ultimateGauge = Math.min(100, f.ultimateGauge + 14);
    if (prevUlt < 100 && f.ultimateGauge >= 100) {
      ctx.sound.playUltimateReady(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    }
    f.gauge = Math.min(100, f.gauge + 8);
    if (f.id === 'bram') {
      f.armorStacks = Math.min(3, f.armorStacks + 1);
      ctx.shakeMag = Math.max(ctx.shakeMag, 4.5);
    } else if (f.id === 'jin' && f.puppetActive) {
      f.puppetAttackTimer = 18;
    }
    spawnHitSparks(ctx, f.x + f.facing * 10, f.y - 14, f.spec.secondaryColor, 8);
  }

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
      applyPhysics(ctx, f, inp, speedMult);
      updateScarf(ctx, f);
      checkBounds(ctx, f);
      return;
    }
  }

  if (f.actionFrame >= 46) {
    f.action = f.grounded ? 'idle' : 'air';
    f.actionFrame = 0;
  }

  applyPhysics(ctx, f, inp, speedMult);
  updateScarf(ctx, f);
  checkBounds(ctx, f);
}

export function stepActiveAttack(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  inp: InputState,
  speedMult: number,
  isOverdrive: boolean
): void {
  const m = f.currentMove!;
  const frameStep = isOverdrive ? 1.14 : 1.0;
  const effFrame = Math.floor(f.actionFrame * frameStep);

  if (f.actionFrame >= 1 && f.actionFrame <= 3) {
    if (f.grounded && m.lungeAtFrame === undefined) {
      const coilBack = m.category === 'strong' ? 0.28 : m.category === 'special' ? 0.2 : 0.12;
      f.vx -= f.facing * coilBack;
    }
    if (f.actionFrame === 1) {
      f.squashX = m.category === 'strong' ? 1.11 : 1.05;
      f.squashY = m.category === 'strong' ? 0.9 : 0.95;
    }
  }

  if (
    m.lungeAtFrame !== undefined &&
    f.actionFrame >= m.lungeAtFrame &&
    f.actionFrame <= m.lungeAtFrame + 3
  ) {
    const isFirstLungeFrame = f.actionFrame === m.lungeAtFrame;
    if (m.lungeX !== undefined) {
      const targetLungeVx = f.facing * m.lungeX * (isOverdrive ? 1.14 : 1.0);
      f.vx += (targetLungeVx - f.vx) * (isFirstLungeFrame ? 0.48 : 0.36);
    }
    if (isFirstLungeFrame && m.lungeY !== undefined) {
      f.vy = m.lungeY;
      f.grounded = false;
    }
    if (isFirstLungeFrame) {
      f.squashX = 1.15;
      f.squashY = 0.87;
      if (f.grounded) {
        spawnDust(ctx, f.x - f.facing * 8, f.y + 18, f.facing);
      }
      if (
        m.specialTag === 'kuro_shadow_slash' ||
        m.specialTag === 'velo_mach_blitz' ||
        m.specialTag === 'kenji_iaido_draw'
      ) {
        ctx.sound.playBlink(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
      }
    }
  }

  const handler = m.specialTag ? SPECIAL_HANDLERS[m.specialTag] : undefined;
  handler?.onStep?.(ctx, f, m, foe);

  if (f.actionFrame === m.startup) {
    const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
    if (m.hitbox.width > 0) {
      spawnMoveArc(ctx, f, m);
      ctx.sound.playAttackSwing(f.id, m.key, m.category, pan);

      if (m.lungeAtFrame === undefined) {
        if (f.grounded) {
          const stepImpulse =
            m.category === 'strong'
              ? 2.2
              : m.key === 'jab3' || m.key === 'ftilt' || m.key === 'dtilt'
              ? 1.45
              : m.key === 'utilt'
              ? 0.7
              : 0.95;
          f.vx += f.facing * stepImpulse * speedMult;
          if (m.category === 'strong' || m.key === 'ftilt' || m.key === 'jab3') {
            spawnDust(ctx, f.x - f.facing * 6, f.y + 18, f.facing);
          }
        } else {
          if (m.key === 'fair') f.vx += f.facing * 1.05;
          else if (m.key === 'bair') f.vx -= f.facing * 1.15;
          else if (m.key === 'uair') f.vy = Math.min(f.vy, -1.65);
          else if (m.key === 'dair') f.vy = Math.max(f.vy, 2.1);
        }
      }

      if (m.key === 'utilt' || m.key === 'uair' || m.key === 'ustrong' || m.key === 'uspecial') {
        f.squashX = 0.9;
        f.squashY = 1.13;
      } else {
        f.squashX = m.category === 'strong' ? 1.14 : 1.08;
        f.squashY = m.category === 'strong' ? 0.88 : 0.93;
      }
      for (let s = 1; s < f.scarf.length; s++) {
        f.scarf[s].vx -= f.facing * (2.2 + s * 0.45);
        f.scarf[s].vy -= 1.2;
      }
    }

    handler?.onActiveFrame?.(ctx, f, m, foe, pan);
  }

  if (m.canCancelIntoJab && f.actionFrame >= m.startup + 2) {
    const nextJab = consumeBuffered(f, 'light');
    if (nextJab) {
      startMove(ctx, f, f.spec.moves[m.canCancelIntoJab], foe);
      updateScarf(ctx, f);
      return;
    }
  }

  const total = m.startup + m.active + m.recovery;
  if (effFrame >= total) {
    handler?.onEnd?.(ctx, f, m, foe);
    f.currentMove = null;
    f.action = f.grounded ? 'idle' : 'air';
    f.actionFrame = 0;
  }

  applyPhysics(ctx, f, inp, speedMult, m.gravityScale ?? 1.0, true);
  updateScarf(ctx, f);
  checkBounds(ctx, f);
}
