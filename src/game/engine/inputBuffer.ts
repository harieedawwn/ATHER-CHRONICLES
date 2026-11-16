/**
 * Purpose: Manages per-fighter input buffering (8-frame TTL) and double-tap dash detection.
 * Exports: updateFighterInputBuffer, consumeBuffered
 * Depends on: ../types, ./context, ./vfxSpawners
 */

import { BufferedInput, FighterState, InputState } from '../types';
import { EngineContext } from './context';
import { spawnDust } from './vfxSpawners';

export function updateFighterInputBuffer(
  ctx: EngineContext,
  f: FighterState,
  inp: InputState
): void {
  const dirX: -1 | 0 | 1 = inp.right && !inp.left ? 1 : inp.left && !inp.right ? -1 : 0;
  const dirY: -1 | 0 | 1 = inp.down && !inp.up ? 1 : inp.up && !inp.down ? -1 : 0;

  // Age buffer
  for (let i = f.buffer.length - 1; i >= 0; i--) {
    f.buffer[i].ttl--;
    if (f.buffer[i].ttl <= 0) f.buffer.splice(i, 1);
  }

  const pushBuf = (type: BufferedInput['type']) => {
    f.buffer.push({ type, dirX, dirY, ttl: 8 });
  };

  if (inp.ultimate && !f.prevInput.ultimate) pushBuf('ultimate');
  if (inp.taunt && !f.prevInput.taunt) pushBuf('taunt');
  if (inp.special && !f.prevInput.special) pushBuf('special');
  if (inp.strong && !f.prevInput.strong) pushBuf('strong');
  if (inp.light && !f.prevInput.light) pushBuf('light');
  if (inp.shortHop && !f.prevInput.shortHop) pushBuf('shortHop');
  if (inp.jump && !f.prevInput.jump) pushBuf('jump');
  if (inp.dash && !f.prevInput.dash) pushBuf('dash');

  // Double-tap direction dash detection
  if (f.tapDirTimer > 0) f.tapDirTimer--;
  if (dirX !== 0 && ((dirX < 0 && !f.prevInput.left) || (dirX > 0 && !f.prevInput.right))) {
    if (f.tapDirTimer > 0 && f.lastTapDir === dirX && f.grounded && f.action === 'idle') {
      f.action = 'dash';
      f.actionFrame = 0;
      f.facing = dirX;
      f.vx = dirX * f.spec.stats.dashSpeed * (f.overdriveTimer > 0 ? 1.45 : 1);
      spawnDust(ctx, f.x, f.y + 18, dirX);
    }
    f.lastTapDir = dirX;
    f.tapDirTimer = 13;
  }

  f.prevInput = { ...inp };
}

export function consumeBuffered(
  f: FighterState,
  type: BufferedInput['type']
): BufferedInput | null {
  const idx = f.buffer.findIndex((b) => b.type === type);
  if (idx >= 0) {
    const item = f.buffer[idx];
    f.buffer.splice(idx, 1);
    return item;
  }
  return null;
}
