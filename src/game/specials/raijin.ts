/**
 * Purpose: Special move handlers and Lightning Rod network mechanics for RAIJIN (Storm Conduit).
 * Exports: RAIJIN_SPECIALS, detonateRaijinRodNetwork
 * Depends on: ../engine/context, ../engine/hitApplication, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { applyHitToFighter } from '../engine/hitApplication';
import { spawnBlinkBurst, spawnHitSparks } from '../engine/vfxSpawners';
import { FighterState, RiftSeal, SpecialTag } from '../types';
import { SpecialHandler } from './types';

export function detonateRaijinRodNetwork(
  ctx: EngineContext,
  raijin: FighterState,
  foe: FighterState,
  rods: RiftSeal[]
): void {
  const r1 = rods[0];
  const r2 = rods[rods.length - 1];
  ctx.shakeMag = 11;
  ctx.impactFrames = 2;
  ctx.sound.playAttackHit(
    'raijin',
    foe.id,
    'dspecial',
    'special',
    20,
    11,
    true,
    Math.max(-0.85, Math.min(0.85, ((r1.x + r2.x) * 0.5) / 360))
  );

  for (const r of rods) {
    ctx.shockwaves.push({
      x: r.x,
      y: r.y - 10,
      radius: 8,
      maxRadius: 82,
      color: '#facc15',
      life: 20,
      maxLife: 20,
      lineWidth: 3.5,
    });
    spawnHitSparks(ctx, r.x, r.y - 10, '#38bdf8', 16);
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
    ctx.callouts.push({
      x: foe.x,
      y: foe.y - 38,
      vy: -0.7,
      text: 'CHAIN VOLTAGE!',
      color: '#facc15',
      life: 30,
      maxLife: 30,
    });
    applyHitToFighter(ctx, raijin, foe, {
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

export const RAIJIN_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  raijin_rod_plant: {
    onStart(ctx, f, _move, foe, pan) {
      const myRods = ctx.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      );
      if (myRods.length >= 2) {
        detonateRaijinRodNetwork(ctx, f, foe, myRods);
        ctx.riftSeals = ctx.riftSeals.filter(
          (s) => !(s.ownerSlot === f.slot && s.kind === 'raijin_rod')
        );
      } else {
        const rx = f.x + f.facing * 28;
        const ry = f.y;
        ctx.riftSeals.push({
          ownerSlot: f.slot,
          x: rx,
          y: ry,
          ttl: 520,
          pulse: 0,
          color: '#38bdf8',
          kind: 'raijin_rod',
        });
        ctx.shockwaves.push({
          x: rx,
          y: ry - 6,
          radius: 4,
          maxRadius: 36,
          color: '#facc15',
          life: 14,
          maxLife: 14,
          lineWidth: 2.2,
        });
        ctx.callouts.push({
          x: rx,
          y: ry - 34,
          vy: -0.6,
          text: myRods.length === 1 ? 'ROD LINKED!' : 'THUNDER ROD!',
          color: '#38bdf8',
          life: 24,
          maxLife: 24,
        });
        ctx.sound.playSpecialSkill('raijin', 'raijin_rod_plant', pan);
      }
    },
  },

  raijin_flash_lance: {
    onStart(ctx, f, _move, foe) {
      const myRods = ctx.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      );
      if (myRods.length > 0) {
        const targetRod = myRods[myRods.length - 1];
        spawnBlinkBurst(ctx, f.x, f.y - 8, '#38bdf8');
        f.x = targetRod.x - f.facing * 12;
        f.y = targetRod.y;
        f.facing = foe.x >= f.x ? 1 : -1;
        spawnBlinkBurst(ctx, f.x, f.y - 8, '#facc15');
        ctx.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.6,
          text: 'ARC WARP!',
          color: '#facc15',
          life: 24,
          maxLife: 24,
        });
        ctx.sound.playBlink('raijin', Math.max(-0.85, Math.min(0.85, f.x / 360)));
      }
    },
  },

  raijin_sky_fall: {},

  raijin_sky_pillar: {
    onActiveFrame(ctx, f, _move, foe, pan) {
      ctx.sound.playSpecialSkill('raijin', 'raijin_sky_pillar', pan);
      const myRods = ctx.riftSeals.filter(
        (s) => s.ownerSlot === f.slot && s.kind === 'raijin_rod'
      );
      for (const rod of myRods) {
        ctx.shockwaves.push({
          x: rod.x,
          y: rod.y - 8,
          radius: 8,
          maxRadius: 68,
          color: '#38bdf8',
          life: 18,
          maxLife: 18,
          lineWidth: 3,
        });
        spawnHitSparks(ctx, rod.x, rod.y - 12, '#facc15', 14);
        if (Math.hypot(foe.x - rod.x, foe.y - rod.y) < 58 && foe.invulnFrames <= 0) {
          applyHitToFighter(ctx, f, foe, {
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
    },
  },
};
