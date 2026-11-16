/**
 * Purpose: Special move handlers and mid-air suspension state logic for KURO (Phantom Blink).
 * Exports: KURO_SPECIALS, stepKuroSuspend
 * Depends on: ../engine/context, ../engine/inputBuffer, ../engine/scarf, ../engine/vfxSpawners, ../types, ./types
 */

import { EngineContext } from '../engine/context';
import { consumeBuffered } from '../engine/inputBuffer';
import { updateScarf } from '../engine/scarf';
import { spawnAfterimage, spawnBlinkBurst } from '../engine/vfxSpawners';
import { FighterState, MoveData, SpecialTag } from '../types';
import { SpecialHandler } from './types';

export function stepKuroSuspend(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  startMoveFn: (ctx: EngineContext, f: FighterState, move: MoveData, foe: FighterState) => void
): void {
  f.vx *= 0.72;
  f.vy = 0;
  f.suspendTimer--;

  const lightTap = consumeBuffered(f, 'light');
  const strongTap = consumeBuffered(f, 'strong');
  const specTap = consumeBuffered(f, 'special');

  if (lightTap || strongTap || specTap || f.suspendTimer <= 0) {
    // Execute Void Back-Dunk!
    f.facing = foe.x >= f.x ? 1 : -1;
    startMoveFn(ctx, f, f.spec.moves.kuro_suspend_dunk, foe);
  }
  updateScarf(ctx, f);
}

export const KURO_SPECIALS: Partial<Record<SpecialTag, SpecialHandler>> = {
  kuro_blink_suspend: {
    onStart(ctx, f, _move, foe, pan) {
      f.anchorX = f.x;
      f.anchorY = f.y;
      f.anchorActive = true;
      spawnBlinkBurst(ctx, f.x, f.y - 8, f.spec.accentColor);

      const behindX = foe.x - foe.facing * 36;
      const hoverY = foe.y - 24;
      f.x = Math.max(ctx.stage.blastLeft + 60, Math.min(ctx.stage.blastRight - 60, behindX));
      f.y = Math.max(ctx.stage.blastTop + 60, hoverY);
      f.vx = 0;
      f.vy = 0;
      f.facing = foe.x >= f.x ? 1 : -1;
      f.action = 'kuro_suspend';
      f.actionFrame = 0;
      f.suspendTimer = 42;
      f.currentMove = null;
      f.invulnFrames = 10;
      spawnBlinkBurst(ctx, f.x, f.y - 8, f.spec.secondaryColor);
      ctx.callouts.push({
        x: f.x,
        y: f.y - 36,
        vy: -0.6,
        text: 'SUSPEND!',
        color: '#e879f9',
        life: 28,
        maxLife: 28,
      });
      ctx.sound.playBlink(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
      void pan;
      return 'handled';
    },
  },

  kuro_dunk_return: {
    onEnd(ctx, f) {
      if (f.anchorActive) {
        spawnBlinkBurst(ctx, f.x, f.y - 8, f.spec.accentColor);
        f.x = f.anchorX;
        f.y = f.anchorY;
        f.vx = 0;
        f.vy = 0;
        f.anchorActive = false;
        spawnBlinkBurst(ctx, f.x, f.y - 8, f.spec.secondaryColor);
        ctx.sound.playBlink(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
      }
    },
  },

  kuro_shadow_slash: {
    onStep(ctx, f, m) {
      if (f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active) {
        if (ctx.tick % 2 === 0) {
          spawnAfterimage(ctx, f, f.spec.accentColor);
        }
      }
    },
  },

  kuro_void_ascent: {},
  kuro_abyss_drop: {},
};
