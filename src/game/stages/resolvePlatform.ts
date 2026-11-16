/**
 * Purpose: Computes frame-accurate world coordinates, AABB bounds, and velocity for static or moving stage platforms.
 * Exports: ResolvedPlatform, resolvePlatformAtTick
 * Depends on: ../types
 */

import { StagePlatform } from '../types';

export interface ResolvedPlatform {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  thickness: number;
  isMain: boolean;
  style: NonNullable<StagePlatform['style']>;
}

/**
 * Computes the exact frame-accurate world coordinates, solid AABB bounds, and delta velocity
 * of any static or animated platform at `tick`, shared by both physics & rendering.
 */
export function resolvePlatformAtTick(plat: StagePlatform, tick: number): ResolvedPlatform {
  let x = plat.x;
  let y = plat.y;
  let prevX = plat.x;
  let prevY = plat.y;

  if (plat.motion) {
    const { axis, ampX, ampY, speed, phase } = plat.motion;
    const tNow = tick * speed + phase;
    const tPrev = (tick - 1) * speed + phase;
    if (axis === 'x') {
      x += Math.sin(tNow) * ampX;
      prevX += Math.sin(tPrev) * ampX;
    } else if (axis === 'y') {
      y += Math.sin(tNow) * ampY;
      prevY += Math.sin(tPrev) * ampY;
    } else if (axis === 'orbit') {
      x += Math.cos(tNow) * ampX;
      y += Math.sin(tNow) * ampY;
      prevX += Math.cos(tPrev) * ampX;
      prevY += Math.sin(tPrev) * ampY;
    }
  }

  const width = plat.width;
  const style = plat.style ?? (plat.isMain ? 'stone' : 'wood');
  // Main stage decks have deep solid foundations so fighters can never clip or jump through from below
  const defaultThickness = plat.isMain
    ? style === 'train'
      ? 64
      : style === 'mirror' || style === 'holo' || style === 'gold'
      ? 42
      : 165
    : 12;
  const thickness = plat.thickness ?? defaultThickness;

  return {
    x,
    y,
    vx: x - prevX,
    vy: y - prevY,
    left: x - width * 0.5,
    right: x + width * 0.5,
    top: y,
    bottom: y + thickness,
    width,
    thickness,
    isMain: plat.isMain,
    style,
  };
}
