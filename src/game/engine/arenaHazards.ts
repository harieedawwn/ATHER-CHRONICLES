// Arena field objects: Chrono Stasis Domes, Nyx Wormhole Portals, Velo Delayed Slashes, and Rift Seals.
// Exports: updateStasisFields, updatePortals, updateDelayedSlashes, updateRiftSeals.
// Depends on: @/game/specials/kenji, ./context, ./hitApplication, ./vfxSpawners.

import { triggerKenjiCounter } from '@/game/specials/kenji';
import { EngineContext } from './context';
import { applyHitToFighter } from './hitApplication';
import { spawnBlinkBurst, spawnHitSparks } from './vfxSpawners';

export function updateStasisFields(ctx: EngineContext): void {
  for (let i = ctx.stasisFields.length - 1; i >= 0; i--) {
    const sf = ctx.stasisFields[i];
    sf.ttl--;
    if (sf.ttl <= 0) {
      ctx.stasisFields.splice(i, 1);
      continue;
    }
    const foe = ctx.fighters[1 - sf.ownerSlot];
    if (foe.action !== 'ko_respawn' && Math.hypot(foe.x - sf.x, foe.y - 10 - sf.y) < sf.radius) {
      foe.stasisSlowTimer = 4;
    }
    for (const p of ctx.projectiles) {
      if (p.ownerSlot !== sf.ownerSlot && Math.hypot(p.x - sf.x, p.y - sf.y) < sf.radius) {
        p.vx *= 0.85;
        p.vy *= 0.85;
      }
    }
  }
}

export function updatePortals(ctx: EngineContext): void {
  for (let i = ctx.portals.length - 1; i >= 0; i--) {
    const pr = ctx.portals[i];
    pr.ttl--;
    if (pr.cooldown > 0) pr.cooldown--;
    if (pr.ttl <= 0) {
      ctx.portals.splice(i, 1);
      continue;
    }
    if (pr.cooldown > 0) continue;

    const owner = ctx.fighters[pr.ownerSlot];
    const foe = ctx.fighters[1 - pr.ownerSlot];

    if (owner.action === 'dash' || owner.action === 'airdodge') {
      const dA = Math.hypot(owner.x - pr.ax, owner.y - 10 - pr.ay);
      const dB = Math.hypot(owner.x - pr.bx, owner.y - 10 - pr.by);
      if (dA < 26) {
        pr.cooldown = 28;
        spawnBlinkBurst(ctx, pr.ax, pr.ay, '#ec4899');
        owner.x = pr.bx;
        owner.y = pr.by;
        owner.facing = foe.x >= owner.x ? 1 : -1;
        spawnBlinkBurst(ctx, pr.bx, pr.by, '#38bdf8');
        ctx.sound.playBlink();
      } else if (dB < 26) {
        pr.cooldown = 28;
        spawnBlinkBurst(ctx, pr.bx, pr.by, '#38bdf8');
        owner.x = pr.ax;
        owner.y = pr.ay;
        owner.facing = foe.x >= owner.x ? 1 : -1;
        spawnBlinkBurst(ctx, pr.ax, pr.ay, '#ec4899');
        ctx.sound.playBlink();
      }
    }

    for (const p of ctx.projectiles) {
      if (p.ownerSlot === pr.ownerSlot && Math.hypot(p.x - pr.ax, p.y - pr.ay) < 22) {
        pr.cooldown = 16;
        p.x = pr.bx;
        p.y = pr.by;
        const ang = Math.atan2(foe.y - 10 - pr.by, foe.x - pr.bx);
        const spd = Math.hypot(p.vx, p.vy) * 1.15;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        spawnBlinkBurst(ctx, pr.bx, pr.by, '#ec4899');
        ctx.sound.playBlink();
        break;
      }
    }
  }
}

export function updateDelayedSlashes(ctx: EngineContext): void {
  for (let i = ctx.delayedSlashes.length - 1; i >= 0; i--) {
    const ds = ctx.delayedSlashes[i];
    ds.timer--;
    if (ds.timer <= 0) {
      spawnHitSparks(ctx, ds.x, ds.y, ds.color, 10);
      ctx.slashArcs.push({
        x: ds.x,
        y: ds.y,
        angleStart: ds.angle - 0.5,
        angleEnd: ds.angle + 0.5,
        radius: 26,
        thickness: 5,
        color: ds.color,
        coreColor: '#ffffff',
        life: 10,
        maxLife: 10,
        facing: 1,
      });
      ctx.sound.playSwing(1.4);

      const foe = ctx.fighters[1 - ds.ownerSlot];
      const owner = ctx.fighters[ds.ownerSlot];
      if (foe.action !== 'ko_respawn' && Math.hypot(foe.x - ds.x, foe.y - 8 - ds.y) < 38) {
        if (foe.action === 'kenji_haki') {
          triggerKenjiCounter(ctx, foe, owner);
        } else if (foe.invulnFrames <= 0) {
          applyHitToFighter(ctx, owner, foe, {
            offsetX: 0,
            offsetY: 0,
            width: 44,
            height: 44,
            damage: ds.damage,
            baseKnockback: ds.knockback,
            knockbackGrowth: ds.kbGrowth,
            angleDeg: 72,
            hitstop: 5,
          });
        }
      }
      ctx.delayedSlashes.splice(i, 1);
    }
  }
}

export function updateRiftSeals(ctx: EngineContext): void {
  for (let i = ctx.riftSeals.length - 1; i >= 0; i--) {
    ctx.riftSeals[i].ttl--;
    ctx.riftSeals[i].pulse++;
    if (ctx.riftSeals[i].ttl <= 0) {
      ctx.riftSeals.splice(i, 1);
    }
  }
}
