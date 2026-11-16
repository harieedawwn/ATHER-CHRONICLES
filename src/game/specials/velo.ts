/**
 * Purpose: Special move handlers for VELO (Hyper Flash): Overdrive activation, Sonic Blade projectile, and Mach Judgment delayed slashes.
 * Exports: VELO_SPECIALS
 * Depends on: ../engine/context, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { spawnAfterimage } from '../engine/vfxSpawners';
import { SpecialTag } from '../types';
import { SpecialHandler } from './types';

export const VELO_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  velo_overdrive: {
    onStart(ctx, f, _move, _foe, pan) {
      if (f.gauge >= 35 && f.overdriveTimer <= 0) {
        f.overdriveTimer = 330; // 5.5 seconds of Hyper Speed!
        ctx.shockwaves.push({
          x: f.x,
          y: f.y - 8,
          radius: 8,
          maxRadius: 72,
          color: '#06b6d4',
          life: 20,
          maxLife: 20,
          lineWidth: 3,
        });
        ctx.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'HYPER OVERDRIVE!',
          color: '#facc15',
          life: 36,
          maxLife: 36,
        });
        ctx.shakeMag = 6;
        ctx.sound.playOverdrive('velo', pan);
      } else {
        // Fire Sonic Vacuum Blade projectile!
        ctx.projectiles.push({
          id: ctx.nextProjId++,
          ownerSlot: f.slot,
          x: f.x + f.facing * 20,
          y: f.y - 8,
          vx: f.facing * 8.6,
          vy: 0,
          radius: 7,
          damage: 6,
          baseKnockback: 3.6,
          knockbackGrowth: 0.032,
          angleDeg: 36,
          ttl: 48,
          color: '#06b6d4',
          kind: 'sonic_blade',
        });
        ctx.sound.playAttackSwing('velo', 'nspecial', 'special', pan);
      }
    },
  },

  velo_mach_blitz: {
    onStep(ctx: EngineContext, f, m) {
      if (f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active) {
        if (ctx.tick % 2 === 0) {
          spawnAfterimage(ctx, f, f.spec.accentColor);
        }
        // Velo Mach Blitz spawns delayed anime slash cuts!
        if (f.actionFrame === m.startup + 3) {
          ctx.delayedSlashes.push({
            ownerSlot: f.slot,
            x: f.x + f.facing * 12,
            y: f.y - 10,
            angle: (Math.random() - 0.5) * 1.1,
            length: 56,
            timer: 26,
            color: '#06b6d4',
            damage: 6.5,
            knockback: 4.8,
            kbGrowth: 0.045,
          });
          ctx.delayedSlashes.push({
            ownerSlot: f.slot,
            x: f.x - f.facing * 14,
            y: f.y - 6,
            angle: (Math.random() - 0.5) * 1.2 + 0.6,
            length: 52,
            timer: 32,
            color: '#facc15',
            damage: 6.5,
            knockback: 5.0,
            kbGrowth: 0.048,
          });
        }
      }
    },
  },

  velo_volt_zip: {},
  velo_decoy_sweep: {},
};
