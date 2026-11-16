/**
 * Purpose: Special move handlers for CHRONO (Zero Hour): Temporal Echo rewind and Stasis Bubble dome.
 * Exports: CHRONO_SPECIALS
 * Depends on: ../engine/context, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { spawnBlinkBurst } from '../engine/vfxSpawners';
import { SpecialTag } from '../types';
import { SpecialHandler } from './types';

export const CHRONO_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  chrono_echo_rewind: {
    onStart(ctx: EngineContext, f, _move, foe, pan) {
      const echoIdx = ctx.riftSeals.findIndex(
        (s) => s.ownerSlot === f.slot && s.kind === 'chrono_echo'
      );
      if (echoIdx >= 0) {
        const echo = ctx.riftSeals[echoIdx];
        ctx.riftSeals.splice(echoIdx, 1);
        f.anchorActive = false;
        ctx.delayedSlashes.push({
          ownerSlot: f.slot,
          x: f.x,
          y: f.y - 10,
          angle: 0.45,
          length: 64,
          timer: 12,
          color: '#14b8a6',
          damage: 9,
          knockback: 5.5,
          kbGrowth: 0.055,
        });
        spawnBlinkBurst(ctx, f.x, f.y - 10, '#14b8a6');
        f.x = echo.x;
        f.y = echo.y;
        f.vx = 0;
        f.vy = 0;
        f.facing = foe.x >= f.x ? 1 : -1;
        f.damagePercent = Math.max(0, f.damagePercent - 5);
        f.hp = Math.min(f.maxHp, f.hp + 45);
        spawnBlinkBurst(ctx, f.x, f.y - 10, '#fbbf24');
        ctx.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'ZERO REWIND!',
          color: '#fbbf24',
          life: 30,
          maxLife: 30,
        });
        ctx.sound.playSpecialSkill(
          'chrono',
          'chrono_echo_rewind',
          Math.max(-0.85, Math.min(0.85, f.x / 360))
        );
      } else {
        ctx.riftSeals.push({
          ownerSlot: f.slot,
          x: f.x,
          y: f.y,
          ttl: 540,
          pulse: 0,
          color: '#14b8a6',
          kind: 'chrono_echo',
        });
        f.anchorX = f.x;
        f.anchorY = f.y;
        f.anchorActive = true;
        ctx.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.6,
          text: 'ECHO SAVED',
          color: '#2dd4bf',
          life: 24,
          maxLife: 24,
        });
        ctx.sound.playHakiPulse('chrono', pan);
      }
    },
  },

  chrono_stasis_bubble: {
    onStart(ctx: EngineContext, f, _move, _foe, pan) {
      ctx.stasisFields = ctx.stasisFields.filter((sf) => sf.ownerSlot !== f.slot);
      const sx = f.x + f.facing * 56;
      const sy = f.y - 10;
      ctx.stasisFields.push({
        ownerSlot: f.slot,
        x: sx,
        y: sy,
        radius: 52,
        ttl: 195,
        maxTtl: 195,
      });
      ctx.callouts.push({
        x: sx,
        y: sy - 42,
        vy: -0.5,
        text: 'STASIS DOME!',
        color: '#2dd4bf',
        life: 28,
        maxLife: 28,
      });
      ctx.sound.playSpecialSkill('chrono', 'chrono_stasis_bubble', pan);
    },
  },

  chrono_pendulum_reap: {},
  chrono_clock_judgment: {},
};
