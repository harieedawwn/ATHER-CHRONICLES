/**
 * Purpose: Verlet cloth simulation and distance constraint solver for each fighter's trailing scarf.
 * Exports: updateScarf
 * Depends on: ../types, ./context
 */

import { FighterState } from '../types';
import { EngineContext } from './context';

export function updateScarf(ctx: EngineContext, f: FighterState): void {
  const anchorX = f.x - f.facing * 2.5;
  const anchorY = f.y - 17;
  f.scarf[0].x = anchorX;
  f.scarf[0].y = anchorY;
  f.scarf[0].vx = f.vx;
  f.scarf[0].vy = f.vy;

  const speed = Math.hypot(f.vx, f.vy);
  const waveAmp = 0.32 + Math.min(1.1, speed * 0.08);
  const windX = -f.facing * (1.1 + Math.min(1.8, Math.abs(f.vx) * 0.22)) - f.vx * 0.34;
  const gravityY = 0.16 - Math.min(0.28, Math.abs(f.vx) * 0.04) - f.vy * 0.16;

  for (let i = 1; i < f.scarf.length; i++) {
    const prev = f.scarf[i - 1];
    const cur = f.scarf[i];

    // Verlet velocity integration with damping, gravity, and sinusoidal cloth flutter
    cur.vx = cur.vx * 0.78 + windX * 0.26;
    cur.vy =
      cur.vy * 0.78 +
      gravityY +
      Math.sin(ctx.tick * 0.24 - i * 0.75) * waveAmp;

    cur.x += cur.vx;
    cur.y += cur.vy;

    // Distance constraint solver (2 relaxation passes for taut, responsive cloth physics)
    const segLen = 3.8;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > segLen || dist < segLen * 0.65) {
      const targetX = prev.x + (dx / dist) * segLen;
      const targetY = prev.y + (dy / dist) * segLen;
      cur.vx += (targetX - cur.x) * 0.55;
      cur.vy += (targetY - cur.y) * 0.55;
      cur.x = targetX;
      cur.y = targetY;
    }
  }
}
