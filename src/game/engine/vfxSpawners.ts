/**
 * Purpose: Spawns combat visual effects (afterimages, slash arcs, hit sparks, dash wind cones, blink bursts, dust).
 * Exports: spawnAfterimage, spawnMoveArc, spawnHitSparks, spawnDashWindCone, spawnBlinkBurst, spawnDust
 * Depends on: ../types, ./context
 */

import { FighterState, MoveData } from '../types';
import { vrand } from '../vfxKit';
import { EngineContext } from './context';

export function spawnAfterimage(ctx: EngineContext, f: FighterState, color: string): void {
  ctx.afterimages.push({
    x: f.x,
    y: f.y,
    facing: f.facing,
    action: f.action,
    moveKey: f.currentMove?.key ?? null,
    moveFrame: f.actionFrame,
    color,
    alpha: 0.65,
    poseSeed: ctx.tick,
    weaponType: f.spec.weaponType,
  });
}

export function spawnMoveArc(ctx: EngineContext, f: FighterState, m: MoveData): void {
  const style = m.hitbox.slashStyle ?? 'arc';
  let aStart = -1.2;
  let aEnd = 0.6;
  let rad = 28;
  let ox = 10;
  let oy = -8;

  if (style === 'upper') {
    aStart = -2.2;
    aEnd = -0.3;
    rad = 32;
    oy = -16;
  } else if (style === 'slam') {
    aStart = -0.3;
    aEnd = 1.6;
    rad = 30;
    oy = 4;
  } else if (style === 'thrust') {
    aStart = -0.25;
    aEnd = 0.25;
    rad = 36;
    ox = 12;
  } else if (style === 'burst') {
    aStart = -Math.PI;
    aEnd = Math.PI;
    rad = m.category === 'strong' ? 36 : 26;
    ox = m.hitbox.offsetX * 0.45;
  }

  ctx.slashArcs.push({
    x: f.x + ox * f.facing,
    y: f.y + oy,
    angleStart: aStart,
    angleEnd: aEnd,
    radius: rad,
    thickness: m.category === 'strong' || m.category === 'special' ? 7 : 4.5,
    color: f.spec.accentColor,
    coreColor: '#ffffff',
    life: 14,
    maxLife: 14,
    facing: f.facing,
  });
}

export function spawnHitSparks(
  ctx: EngineContext,
  x: number,
  y: number,
  color: string,
  count: number
): void {
  // Central 4-point anime star flare
  ctx.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    size: count >= 16 ? 7.5 : 4.8,
    color: '#ffffff',
    life: count >= 16 ? 12 : 8,
    maxLife: count >= 16 ? 12 : 8,
    gravity: 0,
    drag: 1,
    shape: 'flare',
    angle: vrand() * 0.6,
    spin: 0.08,
  });

  for (let i = 0; i < count; i++) {
    const ang = vrand() * Math.PI * 2;
    const spd = 2.6 + vrand() * 7.8;
    ctx.particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: 2.2 + vrand() * 2.8,
      color: i % 3 === 0 ? '#ffffff' : color,
      life: 11 + Math.floor(vrand() * 11),
      maxLife: 22,
      gravity: 0.14,
      drag: 0.91,
      shape: i % 5 === 0 ? 'flare' : i % 2 === 0 ? 'spark' : 'pixel',
      angle: ang,
      spin: 0.14,
    });
  }
}

export function spawnDashWindCone(
  ctx: EngineContext,
  x: number,
  y: number,
  angle: number,
  color: string
): void {
  ctx.vfxEvents.push({
    type: 'dash',
    x,
    y,
    dir: angle,
    power: 0.5,
    color,
  });
  ctx.particles.push({
    x,
    y,
    vx: Math.cos(angle) * 2.2,
    vy: Math.sin(angle) * 2.2,
    size: 6,
    color: '#f8fafc',
    life: 10,
    maxLife: 10,
    gravity: 0,
    drag: 0.88,
    shape: 'wind_cone',
    angle,
  });
  ctx.particles.push({
    x: x - Math.cos(angle) * 8,
    y: y - Math.sin(angle) * 8,
    vx: Math.cos(angle) * 1.4,
    vy: Math.sin(angle) * 1.4,
    size: 5,
    color,
    life: 12,
    maxLife: 12,
    gravity: 0,
    drag: 0.88,
    shape: 'wind_cone',
    angle,
  });
}

export function spawnBlinkBurst(
  ctx: EngineContext,
  x: number,
  y: number,
  color: string
): void {
  ctx.vfxEvents.push({
    type: 'blink',
    x,
    y,
    dir: 0,
    power: 0.65,
    color,
    seed: ctx.tick,
  });
  ctx.shockwaves.push({
    x,
    y,
    radius: 4,
    maxRadius: 36,
    color,
    life: 12,
    maxLife: 12,
    lineWidth: 2.2,
  });
  spawnHitSparks(ctx, x, y, color, 10);
}

export function spawnDust(ctx: EngineContext, x: number, y: number, dir: number): void {
  for (let i = 0; i < 6; i++) {
    ctx.particles.push({
      x: x + (vrand() - 0.5) * 14,
      y: y - 2,
      vx: -dir * (0.9 + vrand() * 2.2) + (vrand() - 0.5) * 1.6,
      vy: -0.6 - vrand() * 1.5,
      size: 2.5 + vrand() * 1.5,
      color: i % 2 === 0 ? '#94a3b8' : '#64748b',
      life: 15,
      maxLife: 15,
      gravity: i % 3 === 0 ? 0.16 : 0.02,
      drag: 0.9,
      shape: i % 3 === 0 ? 'debris' : 'pixel',
      angle: vrand() * Math.PI,
      spin: (vrand() - 0.5) * 0.25,
    });
  }
}
