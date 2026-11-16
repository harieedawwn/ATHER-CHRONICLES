/**
 * Purpose: Special move handlers, Observation Haki stance, and universal counter execution for KENJI (Crimson Eye).
 * Exports: KENJI_SPECIALS, stepKenjiHaki, triggerKenjiCounter
 * Depends on: ../engine/context, ../engine/scarf, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { updateScarf } from '../engine/scarf';
import { spawnAfterimage, spawnBlinkBurst } from '../engine/vfxSpawners';
import { FighterState, SpecialTag } from '../types';
import { SpecialHandler } from './types';

export function stepKenjiHaki(ctx: EngineContext, f: FighterState): void {
  f.vx *= 0.8;
  f.vy *= 0.8;
  f.hakiTimer--;
  if (f.hakiTimer <= 0) {
    f.action = f.grounded ? 'idle' : 'air';
    f.actionFrame = 0;
  }
  updateScarf(ctx, f);
}

export function triggerKenjiCounter(
  ctx: EngineContext,
  kenji: FighterState,
  attacker: FighterState
): void {
  kenji.action = 'attack';
  kenji.actionFrame = 0;
  kenji.currentMove = kenji.spec.moves.kenji_counter_slash;
  kenji.moveHitConnected = false;
  kenji.moveHitsDone = 0;
  kenji.invulnFrames = 18;
  kenji.countersLanded++;
  kenji.gauge = Math.min(100, kenji.gauge + 25);
  const prevUlt = kenji.ultimateGauge;
  kenji.ultimateGauge = Math.min(100, kenji.ultimateGauge + 18);
  if (prevUlt < 100 && kenji.ultimateGauge >= 100) {
    ctx.sound.playUltimateReady(kenji.id, Math.max(-0.85, Math.min(0.85, kenji.x / 360)));
  }

  // Blink behind attacker!
  spawnBlinkBurst(ctx, kenji.x, kenji.y - 10, '#ef4444');
  kenji.x = attacker.x - attacker.facing * 32;
  kenji.y = attacker.y;
  kenji.vx = 0;
  kenji.vy = 0;
  kenji.facing = attacker.x >= kenji.x ? 1 : -1;
  spawnBlinkBurst(ctx, kenji.x, kenji.y - 10, '#f59e0b');

  attacker.hitstopFrames = 14;
  ctx.impactFrames = 4;
  ctx.triggerTimeDilation(0.22, 22);
  ctx.shakeMag = 10;
  ctx.callouts.push({
    x: kenji.x,
    y: kenji.y - 38,
    vy: -0.6,
    text: 'HAKI COUNTER!',
    color: '#f59e0b',
    life: 36,
    maxLife: 36,
  });
  ctx.sound.playCounter(Math.max(-0.85, Math.min(0.85, kenji.x / 360)));
}

export const KENJI_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  kenji_haki_stance: {
    onStart(ctx, f, _move, _foe, pan) {
      f.action = 'kenji_haki';
      f.actionFrame = 0;
      f.hakiTimer = 34;
      f.currentMove = null;
      ctx.shockwaves.push({
        x: f.x,
        y: f.y - 10,
        radius: 6,
        maxRadius: 48,
        color: '#ef4444',
        life: 18,
        maxLife: 18,
        lineWidth: 2,
      });
      ctx.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.5,
        text: 'OBSERVATION',
        color: '#f59e0b',
        life: 26,
        maxLife: 26,
      });
      ctx.sound.playHakiPulse('kenji', pan);
      return 'handled';
    },
  },

  kenji_iaido_draw: {
    onStep(ctx, f, m) {
      if (f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active) {
        if (ctx.tick % 2 === 0) {
          spawnAfterimage(ctx, f, f.spec.accentColor);
        }
      }
    },
  },

  kenji_dragon_ascent: {},
  kenji_repulse: {},
  kenji_counter_exec: {},
};
