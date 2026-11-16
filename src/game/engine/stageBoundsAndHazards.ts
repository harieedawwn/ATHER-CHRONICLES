// Stage jump pads, horizontal spatial wrap, HP mode wall bounces, and blast-zone KO checks.
// Exports: checkStagePadAndWrap, checkBounds.
// Depends on: @/game/types, ./context, ./vfxSpawners.

import { FighterState, InputState } from '@/game/types';
import { EngineContext, triggerTimeDilation } from './context';
import { spawnBlinkBurst, spawnHitSparks } from './vfxSpawners';

export function checkStagePadAndWrap(
  ctx: EngineContext,
  f: FighterState,
  inp: InputState
): void {
  if (ctx.stage.jumpPads && !inp.down && f.vy >= -2) {
    for (const pad of ctx.stage.jumpPads) {
      if (Math.abs(f.x - pad.x) <= pad.width * 0.5 + 4 && Math.abs(f.y + 18 - pad.y) <= 10) {
        f.vy = pad.boostVy;
        f.grounded = false;
        f.onPlatform = false;
        f.jumpsLeft = 2;
        f.airDashAvailable = true;
        f.fastFalling = false;
        f.squashX = 0.74;
        f.squashY = 1.32;
        if (f.action === 'idle' || f.action === 'walk' || f.action === 'dash') {
          f.action = 'air';
          f.actionFrame = 0;
        }
        ctx.shockwaves.push({
          x: pad.x,
          y: pad.y,
          radius: 4,
          maxRadius: 28,
          color: pad.color,
          life: 12,
          maxLife: 12,
          lineWidth: 2.5,
        });
        spawnHitSparks(ctx, pad.x, pad.y - 4, pad.color, 8);
        ctx.sound.playJumpPad(Math.max(-0.85, Math.min(0.85, pad.x / 360)));
        break;
      }
    }
  }

  if (ctx.stage.wrapHorizontal && ctx.config.ruleset !== 'hp') {
    const wrapEdge = ctx.stage.wrapEdgeX ?? 300;
    const speed = Math.hypot(f.vx, f.vy);
    if (speed < 11.2 && Math.abs(f.x) > wrapEdge && f.y > -220 && f.y < 190) {
      spawnBlinkBurst(ctx, f.x, f.y - 8, ctx.stage.accentColor);
      f.x = f.x > 0 ? -(wrapEdge - 14) : wrapEdge - 14;
      for (const node of f.scarf) {
        node.x = f.x;
        node.y = f.y - 16;
      }
      spawnBlinkBurst(ctx, f.x, f.y - 8, '#f8fafc');
      ctx.sound.playBlink(f.id, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    }
  }

  if (ctx.config.ruleset === 'hp') {
    if (f.x < ctx.stage.wallLeft) {
      f.x = ctx.stage.wallLeft;
      if (f.action === 'hitstun' && Math.abs(f.vx) > 5.5) {
        f.vx = Math.abs(f.vx) * 0.78;
        f.vy -= 2.2;
        ctx.shakeMag = Math.max(ctx.shakeMag, 6);
        spawnHitSparks(ctx, f.x, f.y - 6, '#f8fafc', 10);
        ctx.sound.playWallSlam(f.id, 1.2, -0.75);
      } else {
        f.vx = Math.max(0, f.vx);
      }
    } else if (f.x > ctx.stage.wallRight) {
      f.x = ctx.stage.wallRight;
      if (f.action === 'hitstun' && Math.abs(f.vx) > 5.5) {
        f.vx = -Math.abs(f.vx) * 0.78;
        f.vy -= 2.2;
        ctx.shakeMag = Math.max(ctx.shakeMag, 6);
        spawnHitSparks(ctx, f.x, f.y - 6, '#f8fafc', 10);
        ctx.sound.playWallSlam(f.id, 1.2, 0.75);
      } else {
        f.vx = Math.min(0, f.vx);
      }
    }
  }
}

export function checkBounds(ctx: EngineContext, f: FighterState): void {
  const s = ctx.stage;
  const out =
    f.x < s.blastLeft ||
    f.x > s.blastRight ||
    f.y < s.blastTop ||
    f.y > s.blastBottom;

  if (!out) return;
  if (ctx.config.ruleset === 'hp' && f.y <= s.blastBottom) return;

  ctx.sound.playKO();
  ctx.shakeMag = 16;
  ctx.impactFrames = 4;
  spawnHitSparks(
    ctx,
    Math.max(-360, Math.min(360, f.x)),
    Math.max(-200, Math.min(200, f.y)),
    f.spec.accentColor,
    36
  );
  ctx.shockwaves.push({
    x: Math.max(-360, Math.min(360, f.x)),
    y: Math.max(-200, Math.min(200, f.y)),
    radius: 10,
    maxRadius: 150,
    color: '#ffffff',
    life: 24,
    maxLife: 24,
    lineWidth: 5,
  });

  if (ctx.config.mode === 'training') {
    const [spawnP1X, spawnP2X] = ctx.stage.spawnX ?? [-110, 110];
    f.x = f.slot === 0 ? spawnP1X : spawnP2X;
    f.y = ctx.stage.platforms[0].y - 60;
    f.vx = 0;
    f.vy = 0;
    f.damagePercent = 0;
    f.hp = f.maxHp;
    f.action = 'air';
    f.hitstunFrames = 0;
    return;
  }

  if (ctx.config.ruleset === 'stock') {
    f.stocks--;
    if (f.stocks <= 0) {
      f.action = 'ko_respawn';
      triggerTimeDilation(ctx, 0.22, 34);
      ctx.winnerSlot = (1 - f.slot) as 0 | 1;
      ctx.emitHUD(true);
    } else {
      f.action = 'ko_respawn';
      f.actionFrame = 0;
      f.vx = 0;
      f.vy = 0;
      ctx.emitHUD(true);
    }
  } else {
    f.hp = 0;
    f.action = 'ko_respawn';
    triggerTimeDilation(ctx, 0.22, 34);
    ctx.winnerSlot = (1 - f.slot) as 0 | 1;
    ctx.emitHUD(true);
  }
}
