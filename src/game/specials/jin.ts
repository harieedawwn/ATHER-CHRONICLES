/**
 * Purpose: Special move handlers and autonomous Shadow-Mecha Puppet "Karasu" AI/physics for JIN (Thread Sovereign).
 * Exports: JIN_SPECIALS, onJinMoveStart, updateJinPuppet, triggerJinThreadGuillotine
 * Depends on: ../engine/context, ../engine/hitApplication, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { applyHitToFighter } from '../engine/hitApplication';
import { spawnBlinkBurst, spawnHitSparks } from '../engine/vfxSpawners';
import { FighterState, MoveData, SpecialTag } from '../types';
import { SpecialHandler } from './types';

export function onJinMoveStart(
  ctx: EngineContext,
  f: FighterState,
  move: MoveData,
  foe: FighterState,
  pan: number
): void {
  if (f.id !== 'jin' || !f.puppetActive) return;

  // Every Jin attack triggers a synchronized Karasu Mecha-Slash!
  f.puppetAttackTimer = 14;
  f.puppetVx += f.facing * 6.5;

  const handler = move.specialTag ? JIN_SPECIALS[move.specialTag] : undefined;
  handler?.onStart?.(ctx, f, move, foe, pan);
}

export function updateJinPuppet(
  ctx: EngineContext,
  jin: FighterState,
  foe: FighterState
): void {
  if (jin.suspendTimer > 0) {
    jin.suspendTimer--;
    if (jin.suspendTimer <= 0) {
      jin.anchorActive = false;
    }
  }

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
    ctx.slashArcs.push({
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
        spawnHitSparks(ctx, jin.puppetX, jin.puppetY - 4, '#2dd4bf', 10);
        applyHitToFighter(ctx, jin, foe, {
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

export function triggerJinThreadGuillotine(
  ctx: EngineContext,
  jin: FighterState,
  foe: FighterState
): void {
  const dx = jin.puppetX - jin.x;
  const dy = jin.puppetY - (jin.y - 12);
  const wireLen = Math.hypot(dx, dy);
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(
    0,
    Math.min(1, ((foe.x - jin.x) * dx + (foe.y - 8 - (jin.y - 12)) * dy) / lenSq)
  );
  const px = jin.x + t * dx;
  const py = jin.y - 12 + t * dy;
  const dist = Math.hypot(foe.x - px, foe.y - 8 - py);

  ctx.delayedSlashes.push({
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
    ctx.callouts.push({
      x: foe.x,
      y: foe.y - 36,
      vy: -0.6,
      text: 'WIRE GUILLOTINE!',
      color: '#2dd4bf',
      life: 26,
      maxLife: 26,
    });
    applyHitToFighter(ctx, jin, foe, {
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

export const JIN_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  jin_puppet_command: {
    onStart(ctx, f, _move, foe, pan) {
      if (!f.puppetActive) return;
      ctx.sound.playSpecialSkill('jin', 'jin_puppet_command', pan);
      const flankX = Math.max(
        ctx.stage.blastLeft + 70,
        Math.min(ctx.stage.blastRight - 70, foe.x + f.facing * 52)
      );
      f.anchorX = flankX;
      f.anchorY = foe.y - 14;
      f.anchorActive = true;
      f.suspendTimer = 165;
      f.puppetVx = (flankX - f.puppetX) * 0.28;
      f.puppetVy = (f.anchorY - f.puppetY) * 0.25;

      ctx.projectiles.push({
        id: ctx.nextProjId++,
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

      ctx.callouts.push({
        x: f.puppetX,
        y: f.puppetY - 26,
        vy: -0.6,
        text: 'KARASU PINCER!',
        color: '#2dd4bf',
        life: 24,
        maxLife: 24,
      });
    },
  },

  jin_thread_guillotine: {
    onStart(ctx, f, _move, foe) {
      if (!f.puppetActive) return;
      const behindFoeX = Math.max(
        ctx.stage.blastLeft + 65,
        Math.min(ctx.stage.blastRight - 65, foe.x + f.facing * 58)
      );
      spawnBlinkBurst(ctx, f.puppetX, f.puppetY, '#8b5cf6');
      f.puppetX = behindFoeX;
      f.puppetY = foe.y - 12;
      f.puppetVx = 0;
      f.puppetVy = 0;
      f.anchorX = behindFoeX;
      f.anchorY = foe.y - 12;
      f.anchorActive = true;
      f.suspendTimer = 110;
      spawnBlinkBurst(ctx, f.puppetX, f.puppetY, '#2dd4bf');
    },
    onActiveFrame(ctx, f, _move, foe, pan) {
      ctx.sound.playSpecialSkill('jin', 'jin_thread_guillotine', pan);
      triggerJinThreadGuillotine(ctx, f, foe);
    },
  },

  jin_marionette_lift: {
    onStart(_ctx, f) {
      if (!f.puppetActive) return;
      f.puppetX = f.x + f.facing * 18;
      f.puppetY = f.y - 42;
      f.puppetVy = -9.5;
      f.anchorActive = false;
      f.suspendTimer = 0;
    },
  },

  jin_puppet_ambush: {
    onStart(ctx, f, _move, foe, pan) {
      if (!f.puppetActive) return;
      spawnBlinkBurst(ctx, f.puppetX, f.puppetY, '#6366f1');
      f.puppetX = foe.x;
      f.puppetY = foe.y - 38;
      f.puppetVx = 0;
      f.puppetVy = 9.0;
      f.anchorX = foe.x;
      f.anchorY = foe.y - 10;
      f.anchorActive = true;
      f.suspendTimer = 95;
      spawnBlinkBurst(ctx, f.puppetX, f.puppetY, '#2dd4bf');
      ctx.callouts.push({
        x: f.puppetX,
        y: f.puppetY - 24,
        vy: -0.6,
        text: 'PUPPET AMBUSH!',
        color: '#2dd4bf',
        life: 26,
        maxLife: 26,
      });
      ctx.sound.playBlink('jin', pan);
    },
    onActiveFrame(ctx, f, _move, foe, pan) {
      ctx.sound.playSpecialSkill('jin', 'jin_puppet_ambush', pan);
      ctx.shockwaves.push({
        x: f.puppetX,
        y: f.puppetY,
        radius: 6,
        maxRadius: 56,
        color: '#2dd4bf',
        life: 16,
        maxLife: 16,
        lineWidth: 3,
      });
      spawnHitSparks(ctx, f.puppetX, f.puppetY, '#2dd4bf', 14);
      if (
        foe.action !== 'ko_respawn' &&
        foe.invulnFrames <= 0 &&
        Math.hypot(foe.x - f.puppetX, foe.y - 8 - f.puppetY) <= 52
      ) {
        applyHitToFighter(ctx, f, foe, {
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
    },
  },
};
