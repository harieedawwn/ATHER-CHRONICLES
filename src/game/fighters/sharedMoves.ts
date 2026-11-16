/**
 * Purpose: Merges fighter move overrides with shared defaults and applies martial-arts frame/stat pacing scalars.
 * Exports: createBaseMoves, scaleFighterStats
 * Depends on: ../types, ./baseGroundedMoves, ./baseAerialAndSpecialMoves
 */

import { FighterSpec, MoveData, MoveKey } from '../types';
import { BASE_AERIAL_AND_SPECIAL_MOVES } from './baseAerialAndSpecialMoves';
import { BASE_GROUNDED_MOVES } from './baseGroundedMoves';

export function createBaseMoves(
  overrides: Partial<Record<MoveKey, MoveData>>
): Record<MoveKey, MoveData> {
  const defaults: Record<MoveKey, MoveData> = {
    ...BASE_GROUNDED_MOVES,
    ...BASE_AERIAL_AND_SPECIAL_MOVES,
  };

  const merged: Record<MoveKey, MoveData> = { ...defaults, ...overrides };
  const scaled = {} as Record<MoveKey, MoveData>;
  for (const k of Object.keys(merged) as MoveKey[]) {
    const raw = merged[k];
    // Deliberate, readable martial-arts frame data:
    // - Clear anticipation windup (7..20 frames)
    // - Visible active swing window (7..15 frames)
    // - Smooth follow-through recovery (11..24 frames)
    const scaledStartup = Math.max(7, Math.round(raw.startup * 1.75));
    const scaledActive = Math.max(7, Math.round(raw.active * 1.75));
    const scaledRecovery = Math.max(11, Math.round(raw.recovery * 1.45));
    scaled[k] = {
      ...raw,
      startup: scaledStartup,
      active: scaledActive,
      recovery: scaledRecovery,
      lungeX: raw.lungeX !== undefined ? Number((raw.lungeX * 0.56).toFixed(2)) : undefined,
      lungeY: raw.lungeY !== undefined ? Number((raw.lungeY * 0.72).toFixed(2)) : undefined,
      lungeAtFrame:
        raw.lungeAtFrame !== undefined
          ? Math.max(3, Math.round(raw.lungeAtFrame * 1.65))
          : undefined,
      superArmorFrames: raw.superArmorFrames
        ? [
            Math.round(raw.superArmorFrames[0] * 1.65),
            Math.round(raw.superArmorFrames[1] * 1.65),
          ]
        : undefined,
      invulnFrames: raw.invulnFrames
        ? [Math.round(raw.invulnFrames[0] * 1.65), Math.round(raw.invulnFrames[1] * 1.65)]
        : undefined,
      hitbox: {
        ...raw.hitbox,
        baseKnockback: Number((raw.hitbox.baseKnockback * 0.72).toFixed(2)),
        knockbackGrowth: Number((raw.hitbox.knockbackGrowth * 0.74).toFixed(4)),
        hitstop: Math.max(5, Math.round(raw.hitbox.hitstop * 1.4)),
      },
    };
  }
  return scaled;
}

export function scaleFighterStats(spec: FighterSpec): FighterSpec {
  const s = spec.stats;
  s.walkSpeed = Number((s.walkSpeed * 0.68).toFixed(2));
  s.dashSpeed = Number((s.dashSpeed * 0.62).toFixed(2));
  s.airSpeed = Number((s.airSpeed * 0.66).toFixed(2));
  s.jumpForce = Number((s.jumpForce * 0.68).toFixed(2));
  s.shortHopForce = Number((s.shortHopForce * 0.68).toFixed(2));
  s.gravity = Number((s.gravity * 0.52).toFixed(2));
  s.fallSpeed = Number((s.fallSpeed * 0.58).toFixed(2));
  s.fastFallSpeed = Number((s.fastFallSpeed * 0.6).toFixed(2));
  return spec;
}
