/**
 * Purpose: Special move handlers and Rift Seal planting/detonation logic for BRAM (Iron Rift).
 * Exports: BRAM_SPECIALS, detonateRiftSeal
 * Depends on: ../engine/context, ../engine/hitApplication, ../engine/vfxSpawners, ../types, ./kenji, ./types
 */

import { EngineContext } from '../engine/context';
import { applyHitToFighter } from '../engine/hitApplication';
import { spawnAfterimage, spawnHitSparks } from '../engine/vfxSpawners';
import { FighterState, RiftSeal, SpecialTag } from '../types';
import { triggerKenjiCounter } from './kenji';
import { SpecialHandler } from './types';

export function detonateRiftSeal(
  ctx: EngineContext,
  owner: FighterState,
  seal: RiftSeal
): void {
  ctx.shockwaves.push({
    x: seal.x,
    y: seal.y,
    radius: 10,
    maxRadius: 96,
    color: '#10b981',
    life: 22,
    maxLife: 22,
    lineWidth: 3.5,
  });
  spawnHitSparks(ctx, seal.x, seal.y, '#6ee7b7', 18);
  ctx.shakeMag = 9;
  ctx.sound.playAttackHit(
    'bram',
    ctx.fighters[1 - owner.slot].id,
    'dspecial',
    'special',
    20,
    11,
    true,
    Math.max(-0.85, Math.min(0.85, seal.x / 360))
  );

  const foe = ctx.fighters[1 - owner.slot];
  const dist = Math.hypot(foe.x - seal.x, foe.y - 8 - seal.y);
  if (dist < 88 && foe.invulnFrames <= 0) {
    if (foe.action === 'kenji_haki') {
      triggerKenjiCounter(ctx, foe, owner);
      return;
    }
    applyHitToFighter(ctx, owner, foe, {
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

export const BRAM_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  bram_gravity_pull: {
    onStart(ctx, _f, _move, _foe, pan) {
      ctx.sound.playSpecialSkill('bram', 'bram_gravity_pull', pan);
    },
  },

  bram_comet_tackle: {
    onStep(ctx, f, m) {
      if (f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active) {
        if (ctx.tick % 2 === 0) {
          spawnAfterimage(ctx, f, f.spec.accentColor);
        }
      }
    },
  },

  bram_seismic_leap: {},

  bram_rift_seal: {
    onStart(ctx, f, _move, _foe, pan) {
      const existingIdx = ctx.riftSeals.findIndex(
        (s) => s.ownerSlot === f.slot && (!s.kind || s.kind === 'bram_seal')
      );
      if (existingIdx >= 0) {
        // Detonate existing Rift Seal!
        const seal = ctx.riftSeals[existingIdx];
        ctx.riftSeals.splice(existingIdx, 1);
        detonateRiftSeal(ctx, f, seal);
      } else {
        ctx.riftSeals.push({
          ownerSlot: f.slot,
          x: f.x + f.facing * 18,
          y: f.y - 4,
          ttl: 420,
          pulse: 0,
          color: '#10b981',
          kind: 'bram_seal',
        });
        ctx.shockwaves.push({
          x: f.x + f.facing * 18,
          y: f.y - 4,
          radius: 4,
          maxRadius: 34,
          color: '#10b981',
          life: 14,
          maxLife: 14,
          lineWidth: 2,
        });
        ctx.sound.playHakiPulse('bram', pan);
      }
    },
  },
};
