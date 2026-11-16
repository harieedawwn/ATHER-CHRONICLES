// Projectile simulation, lifetime expiration, parry reflection, and hit application.
// Exports: updateProjectiles.
// Depends on: @/game/specials/kenji, ./context, ./hitApplication, ./vfxSpawners.

import { triggerKenjiCounter } from '@/game/specials/kenji';
import { EngineContext } from './context';
import { applyHitToFighter } from './hitApplication';
import { spawnHitSparks } from './vfxSpawners';

export function updateProjectiles(ctx: EngineContext): void {
  for (let i = ctx.projectiles.length - 1; i >= 0; i--) {
    const p = ctx.projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.ttl--;

    if (p.ttl <= 0 || Math.abs(p.x) > 620) {
      ctx.projectiles.splice(i, 1);
      continue;
    }

    const target = ctx.fighters[1 - p.ownerSlot];
    const owner = ctx.fighters[p.ownerSlot];
    if (target.action === 'ko_respawn') continue;

    const dist = Math.hypot(target.x - p.x, target.y - 8 - p.y);
    if (dist < p.radius + 16) {
      if (target.action === 'kenji_haki') {
        ctx.projectiles.splice(i, 1);
        triggerKenjiCounter(ctx, target, owner);
        continue;
      }

      if (
        target.action === 'parry' ||
        (target.action === 'attack' && target.currentMove?.hitbox.reflectsProjectiles)
      ) {
        p.ownerSlot = target.slot;
        p.vx = -p.vx * 1.5;
        p.damage *= 1.35;
        p.color = target.spec.secondaryColor;
        p.ttl = 50;
        target.countersLanded++;
        target.gauge = Math.min(100, target.gauge + 20);
        spawnHitSparks(ctx, p.x, p.y, '#fef08a', 14);
        ctx.callouts.push({
          x: target.x,
          y: target.y - 34,
          vy: -0.7,
          text: 'PARRY REFLECT!',
          color: '#fef08a',
          life: 26,
          maxLife: 26,
        });
        ctx.sound.playParryDeflect(target.id, Math.max(-0.85, Math.min(0.85, target.x / 360)));
        continue;
      }

      if (target.invulnFrames <= 0) {
        const isHook = p.kind === 'chain_hook';
        applyHitToFighter(ctx, owner, target, {
          offsetX: 0,
          offsetY: 0,
          width: p.radius * 2,
          height: p.radius * 2,
          damage: p.damage,
          baseKnockback: p.baseKnockback,
          knockbackGrowth: p.knockbackGrowth,
          angleDeg: p.angleDeg,
          hitstop: isHook ? 8 : 5,
          isProjectile: true,
          pullTarget: isHook,
          appliesCinder: isHook,
        });
        ctx.projectiles.splice(i, 1);
      }
    }
  }
}
