// 4-way solid AABB platform physics and gravity/landing simulation.
// Exports: applyPhysics, checkBounds.
// Depends on: @/game/types, @/game/stages, ./context, ./stageBoundsAndHazards, ./vfxSpawners.

import { resolvePlatformAtTick } from '@/game/stages';
import { FighterState, InputState } from '@/game/types';
import { EngineContext } from './context';
import { checkBounds, checkStagePadAndWrap } from './stageBoundsAndHazards';
import { spawnDust, spawnHitSparks } from './vfxSpawners';

const HALF_BODY_W = 9;
const FOOT_OFFSET = 18;
const HEAD_OFFSET = 26;

function resolveGroundedRide(ctx: EngineContext, f: FighterState, prevFootY: number): void {
  if (!f.grounded || f.vy < 0) return;
  let ridingPlat = null;
  for (const rawPlat of ctx.stage.platforms) {
    const p = resolvePlatformAtTick(rawPlat, ctx.tick);
    const prevPlatTop = p.top - p.vy;
    if (
      f.x >= p.left - HALF_BODY_W &&
      f.x <= p.right + HALF_BODY_W &&
      Math.abs(prevFootY - prevPlatTop) <= 8
    ) {
      ridingPlat = p;
      break;
    }
  }
  if (ridingPlat) {
    f.x += ridingPlat.vx;
    f.y = ridingPlat.top - FOOT_OFFSET;
    f.vy = 0;
    f.onPlatform = !ridingPlat.isMain;
  } else {
    f.grounded = false;
    f.onPlatform = false;
  }
}

function resolvePlatformWalls(
  ctx: EngineContext,
  f: FighterState,
  p: ReturnType<typeof resolvePlatformAtTick>,
  prevX: number,
  prevFootY: number
): void {
  const prevPlatTop = p.top - p.vy;
  const prevPlatLeft = p.left - p.vx;
  const prevPlatRight = p.right - p.vx;
  const bodyTop = f.y - HEAD_OFFSET + 4;
  const bodyBottom = f.y + FOOT_OFFSET - 4;
  if (bodyBottom <= p.top + 3 || bodyTop >= p.bottom - 2) return;

  const pan = Math.max(-0.85, Math.min(0.85, f.x / 360));
  if (prevX + HALF_BODY_W <= prevPlatLeft + 6 && f.x + HALF_BODY_W > p.left) {
    f.x = p.left - HALF_BODY_W;
    if (f.action === 'hitstun' && f.vx > 5.0) {
      f.vx = -f.vx * 0.72;
      ctx.shakeMag = Math.max(ctx.shakeMag, 5);
      spawnHitSparks(ctx, p.left, f.y - 6, '#f8fafc', 8);
      ctx.sound.playWallSlam(f.id, Math.abs(f.vx) / 6, pan);
    } else {
      f.vx = Math.min(0, f.vx);
      if (p.isMain && f.vy > 1.2) {
        f.vy = Math.min(f.vy, 2.0);
        f.jumpsLeft = Math.max(f.jumpsLeft, 1);
        if (ctx.tick % 4 === 0) {
          spawnDust(ctx, p.left, f.y, 1);
          ctx.sound.playWallSlide(f.id, pan);
        }
      }
    }
  } else if (prevX - HALF_BODY_W >= prevPlatRight - 6 && f.x - HALF_BODY_W < p.right) {
    f.x = p.right + HALF_BODY_W;
    if (f.action === 'hitstun' && f.vx < -5.0) {
      f.vx = -f.vx * 0.72;
      ctx.shakeMag = Math.max(ctx.shakeMag, 5);
      spawnHitSparks(ctx, p.right, f.y - 6, '#f8fafc', 8);
      ctx.sound.playWallSlam(f.id, Math.abs(f.vx) / 6, pan);
    } else {
      f.vx = Math.max(0, f.vx);
      if (p.isMain && f.vy > 1.2) {
        f.vy = Math.min(f.vy, 2.0);
        f.jumpsLeft = Math.max(f.jumpsLeft, 1);
        if (ctx.tick % 4 === 0) {
          spawnDust(ctx, p.right, f.y, -1);
          ctx.sound.playWallSlide(f.id, pan);
        }
      }
    }
  } else if (
    f.x + HALF_BODY_W > p.left + 4 &&
    f.x - HALF_BODY_W < p.right - 4 &&
    prevFootY > prevPlatTop + 7
  ) {
    if (!p.isMain) {
      f.y = p.bottom + HEAD_OFFSET;
      f.vy = Math.max(0.5, f.vy);
    } else {
      const distLeft = Math.abs(f.x - p.left);
      const distRight = Math.abs(f.x - p.right);
      f.x = distLeft < distRight ? p.left - HALF_BODY_W : p.right + HALF_BODY_W;
      f.vx = 0;
    }
  }
}

function resolveAirbornePlatforms(
  ctx: EngineContext,
  f: FighterState,
  prevX: number,
  prevFootY: number,
  prevHeadY: number,
  impactVy: number
): { landed: boolean; landedOnPlat: boolean } {
  let landed = false;
  let landedOnPlat = false;
  if (f.grounded) return { landed, landedOnPlat };

  for (const rawPlat of ctx.stage.platforms) {
    const p = resolvePlatformAtTick(rawPlat, ctx.tick);
    const prevPlatTop = p.top - p.vy;
    const prevPlatBottom = p.bottom - p.vy;
    const footY = f.y + FOOT_OFFSET;
    const headY = f.y - HEAD_OFFSET;

    if (
      f.vy >= 0 &&
      f.x >= p.left - HALF_BODY_W &&
      f.x <= p.right + HALF_BODY_W &&
      prevFootY <= prevPlatTop + 7 &&
      footY >= p.top - 2
    ) {
      f.y = p.top - FOOT_OFFSET;
      f.x += p.vx;

      if (f.action === 'hitstun' && impactVy > 6.2 && f.hitstunFrames > 6) {
        f.vy = -impactVy * 0.56;
        f.vx *= 0.86;
        f.grounded = false;
        f.squashX = 1.38;
        f.squashY = 0.64;
        ctx.shakeMag = Math.max(ctx.shakeMag, 6.5);
        ctx.shockwaves.push({
          x: f.x,
          y: p.top,
          radius: 5,
          maxRadius: 36,
          color: '#f8fafc',
          life: 12,
          maxLife: 12,
          lineWidth: 2.2,
        });
        spawnDust(ctx, f.x, p.top, 0);
        ctx.sound.playWallSlam(f.id, 1.15, Math.max(-0.85, Math.min(0.85, f.x / 360)));
        break;
      }

      f.vy = 0;
      landed = true;
      landedOnPlat = !p.isMain;
      break;
    }

    if (
      f.vy < 0 &&
      f.x + HALF_BODY_W > p.left + 2 &&
      f.x - HALF_BODY_W < p.right - 2 &&
      prevHeadY >= prevPlatBottom - 9 &&
      headY < p.bottom
    ) {
      f.y = p.bottom + HEAD_OFFSET;
      f.vy = Math.max(0.65, -f.vy * 0.26);
      f.squashX = 1.18;
      f.squashY = 0.84;
      spawnDust(ctx, f.x, p.bottom + 2, 0);
      ctx.sound.playCeilingBonk(Math.max(-0.85, Math.min(0.85, f.x / 360)));
      continue;
    }

    resolvePlatformWalls(ctx, f, p, prevX, prevFootY);
  }

  return { landed, landedOnPlat };
}

export function applyPhysics(
  ctx: EngineContext,
  f: FighterState,
  inp: InputState,
  speedMult: number,
  gravityScale = 1.0,
  inAttack = false
): void {
  const prevX = f.x;
  const prevY = f.y;
  const stats = f.spec.stats;
  const stageGravMult = ctx.stage.gravityMult ?? 1.0;

  if (!f.grounded) {
    const grav = stats.gravity * gravityScale * stageGravMult;
    const maxFall =
      (f.fastFalling ? stats.fastFallSpeed : stats.fallSpeed) *
      (stageGravMult < 1 ? 0.85 : 1.0);
    f.vy = Math.min(maxFall, f.vy + grav);
  }

  if (inAttack && f.grounded) {
    f.vx *= 0.85;
  }

  if (ctx.stage.windHazard && ctx.countdownFrames <= 18) {
    const cycle = ctx.tick % 360;
    if (cycle >= 240 && cycle <= 335) {
      const push = f.grounded ? 0.12 : 0.24;
      f.vx -= push;
      if (cycle === 240 && f.slot === 0) {
        ctx.callouts.push({
          x: 0,
          y: -45,
          vy: -0.3,
          text: 'SLIPSTREAM GUST!',
          color: '#facc15',
          life: 32,
          maxLife: 32,
        });
      }
    }
  }

  f.x += f.vx;
  f.y += f.vy;

  const prevFootY = prevY + FOOT_OFFSET;
  const prevHeadY = prevY - HEAD_OFFSET;
  resolveGroundedRide(ctx, f, prevFootY);

  const impactVy = f.vy;
  const { landed, landedOnPlat } = resolveAirbornePlatforms(
    ctx,
    f,
    prevX,
    prevFootY,
    prevHeadY,
    impactVy
  );

  if (landed) {
    f.grounded = true;
    f.onPlatform = landedOnPlat;
    f.jumpsLeft = 2;
    f.airDashAvailable = true;
    f.fastFalling = false;
    const weightRatio = f.spec.stats.weight / 100;
    const fallFactor = Math.min(1.5, Math.max(0.5, impactVy / 6.5)) * weightRatio;
    f.squashX = Math.min(1.42, 1.14 + fallFactor * 0.14);
    f.squashY = Math.max(0.66, 0.88 - fallFactor * 0.12);
    spawnDust(ctx, f.x, f.y + 18, 0);
    ctx.sound.playLand(f.id, impactVy, Math.max(-0.85, Math.min(0.85, f.x / 360)));
    if (impactVy > 7.2 || (f.spec.stats.weight >= 115 && impactVy > 5.2)) {
      spawnDust(ctx, f.x - 8, f.y + 18, -1);
      spawnDust(ctx, f.x + 8, f.y + 18, 1);
      ctx.shakeMag = Math.max(ctx.shakeMag, 2.6 * weightRatio);
    }
    if (f.action === 'air' || f.action === 'airdodge') {
      f.action = 'idle';
      f.actionFrame = 0;
    }
  }

  checkStagePadAndWrap(ctx, f, inp);
  void speedMult;
}

export { checkBounds };
