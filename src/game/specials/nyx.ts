/**
 * Purpose: Special move handlers for NYX (Mirror Sovereign): Prism Barrage lasers, Wormhole Gates, and Spatial Swap.
 * Exports: NYX_SPECIALS
 * Depends on: ../engine/context, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { spawnBlinkBurst } from '../engine/vfxSpawners';
import { SpecialTag } from '../types';
import { SpecialHandler } from './types';

export const NYX_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  nyx_prism_barrage: {
    onStart(ctx: EngineContext, f, _move, _foe, pan) {
      for (const vyOff of [-1.2, 1.1]) {
        ctx.projectiles.push({
          id: ctx.nextProjId++,
          ownerSlot: f.slot,
          x: f.x + f.facing * 22,
          y: f.y - 12,
          vx: f.facing * 9.2,
          vy: vyOff,
          radius: 6.5,
          damage: 5.5,
          baseKnockback: 3.8,
          knockbackGrowth: 0.035,
          angleDeg: 42,
          ttl: 52,
          color: '#ec4899',
          kind: 'prism_beam',
        });
      }
      ctx.sound.playSpecialSkill('nyx', 'nyx_prism_barrage', pan);
    },
  },

  nyx_portal_gate: {
    onStart(ctx: EngineContext, f, _move, foe, pan) {
      ctx.portals = ctx.portals.filter((pr) => pr.ownerSlot !== f.slot);
      const ax = f.x + f.facing * 36;
      const ay = f.y - 12;
      const bx = Math.max(
        ctx.stage.blastLeft + 75,
        Math.min(ctx.stage.blastRight - 75, foe.x - foe.facing * 48)
      );
      const by = Math.max(ctx.stage.blastTop + 75, foe.y - 14);
      ctx.portals.push({
        ownerSlot: f.slot,
        ax,
        ay,
        bx,
        by,
        ttl: 360,
        cooldown: 0,
      });
      ctx.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.6,
        text: 'RIFT GATES OPEN!',
        color: '#ec4899',
        life: 28,
        maxLife: 28,
      });
      ctx.sound.playSpecialSkill('nyx', 'nyx_portal_gate', pan);
    },
  },

  nyx_star_ascension: {},

  nyx_spatial_swap: {
    onStart(ctx: EngineContext, f, _move, foe, pan) {
      const dist = Math.hypot(foe.x - f.x, foe.y - f.y);
      if (dist < 210 && foe.action !== 'ko_respawn') {
        spawnBlinkBurst(ctx, f.x, f.y - 10, '#ec4899');
        spawnBlinkBurst(ctx, foe.x, foe.y - 10, '#38bdf8');
        const tx = f.x;
        const ty = f.y;
        f.x = foe.x;
        f.y = foe.y;
        foe.x = tx;
        foe.y = ty;
        f.facing = foe.x >= f.x ? 1 : -1;
        foe.hitstopFrames = 8;
        ctx.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'SPATIAL SWAP!',
          color: '#38bdf8',
          life: 30,
          maxLife: 30,
        });
        ctx.sound.playSpecialSkill('nyx', 'nyx_spatial_swap', pan);
      }
    },
  },
};
