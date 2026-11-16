/**
 * Purpose: Special move handlers for SOL (Ashen Phoenix): Cinder Supernova detonation, Chain Grapple, and Hellfire Mantle.
 * Exports: SOL_SPECIALS
 * Depends on: ../engine/context, ../engine/hitApplication, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { applyHitToFighter } from '../engine/hitApplication';
import { spawnHitSparks } from '../engine/vfxSpawners';
import { SpecialTag } from '../types';
import { SpecialHandler } from './types';

export const SOL_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  sol_supernova: {
    onActiveFrame(ctx: EngineContext, f, _move, foe, pan) {
      const distToFoe = Math.hypot(foe.x - f.x, foe.y - f.y);
      if (foe.cinderMarks >= 3 && distToFoe <= 210 && foe.action !== 'ko_respawn') {
        ctx.sound.playSpecialSkill('sol', 'sol_supernova', pan);
        const stacks = foe.cinderMarks;
        foe.cinderMarks = 0;
        f.moveHitConnected = true; // Prevent melee whip from double-hitting or re-applying Cinder
        ctx.shockwaves.push({
          x: foe.x,
          y: foe.y - 10,
          radius: 8,
          maxRadius: 46 + stacks * 10,
          color: '#f97316',
          life: 20,
          maxLife: 20,
          lineWidth: 3.5,
        });
        spawnHitSparks(ctx, foe.x, foe.y - 10, '#fde047', 12 + stacks * 3);
        ctx.callouts.push({
          x: foe.x,
          y: foe.y - 40,
          vy: -0.8,
          text: `${stacks}x SUPERNOVA!`,
          color: '#fde047',
          life: 32,
          maxLife: 32,
        });
        if (foe.invulnFrames <= 0) {
          applyHitToFighter(ctx, f, foe, {
            offsetX: 0,
            offsetY: 0,
            width: 64,
            height: 64,
            damage: 5 + stacks * 2.4,
            baseKnockback: 4.8 + stacks * 0.45,
            knockbackGrowth: 0.052 + stacks * 0.005,
            angleDeg: 78,
            hitstop: 7 + stacks,
            breaksArmor: stacks >= 4,
            appliesCinder: false,
          });
        }
      } else if (foe.cinderMarks > 0 && foe.cinderMarks < 3 && distToFoe > 68) {
        ctx.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.5,
          text: `NEED 3 CINDERS (${foe.cinderMarks}/3)`,
          color: '#fb923c',
          life: 22,
          maxLife: 22,
        });
      }
    },
  },

  sol_chain_grapple: {
    onStart(ctx: EngineContext, f, _move, _foe, pan) {
      ctx.projectiles.push({
        id: ctx.nextProjId++,
        ownerSlot: f.slot,
        x: f.x + f.facing * 20,
        y: f.y - 10,
        vx: f.facing * 9.8,
        vy: 0,
        radius: 7,
        damage: 6.5,
        baseKnockback: 4.5,
        knockbackGrowth: 0.032,
        angleDeg: 35,
        ttl: 24,
        color: '#f97316',
        kind: 'chain_hook',
      });
      ctx.sound.playSpecialSkill('sol', 'sol_chain_grapple', pan);
    },
  },

  sol_phoenix_dive: {},

  sol_hellfire_mantle: {
    onStart(ctx: EngineContext, f, _move, _foe, pan) {
      if (f.gauge >= 40 && f.overdriveTimer <= 0) {
        f.gauge = Math.max(0, f.gauge - 40);
        f.overdriveTimer = 210; // 3.5s Phoenix Berserk Mantle!
        ctx.shockwaves.push({
          x: f.x,
          y: f.y - 10,
          radius: 6,
          maxRadius: 64,
          color: '#f97316',
          life: 18,
          maxLife: 18,
          lineWidth: 3,
        });
        ctx.callouts.push({
          x: f.x,
          y: f.y - 38,
          vy: -0.7,
          text: 'PHOENIX MANTLE!',
          color: '#fde047',
          life: 30,
          maxLife: 30,
        });
        ctx.sound.playOverdrive('sol', pan);
      } else if (f.overdriveTimer <= 0) {
        ctx.callouts.push({
          x: f.x,
          y: f.y - 36,
          vy: -0.5,
          text: 'NEED 40% IGNITION',
          color: '#fb923c',
          life: 22,
          maxLife: 22,
        });
      }
    },
  },
};
