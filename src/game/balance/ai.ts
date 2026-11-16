/**
 * Purpose: AI difficulty tuning tables for decision intervals, parry reaction, whiff punish, specials, and Ultimates.
 * Exports: AI_DECISION_INTERVAL, AI_PARRY_REACTION_CHANCE, AI_WHIFF_PUNISH_CHANCE, AI_AIR_DASH_AGGRO_CHANCE, AI_SPECIAL_USAGE_RATE, AI_ULTIMATE_USAGE_RATE
 * Depends on: ../types
 */

import { AIDifficulty } from '../types';

export const AI_DECISION_INTERVAL: Record<AIDifficulty, number> = {
  easy: 15,
  normal: 7,
  boss: 2,
};

export const AI_PARRY_REACTION_CHANCE: Record<AIDifficulty, number> = {
  easy: 0.14,
  normal: 0.42,
  boss: 0.85,
};

export const AI_WHIFF_PUNISH_CHANCE: Record<AIDifficulty, number> = {
  easy: 0.25,
  normal: 0.65,
  boss: 0.94,
};

export const AI_AIR_DASH_AGGRO_CHANCE: Record<AIDifficulty, number> = {
  easy: 0.12,
  normal: 0.45,
  boss: 0.82,
};

export const AI_SPECIAL_USAGE_RATE: Record<AIDifficulty, number> = {
  easy: 0.22,
  normal: 0.48,
  boss: 0.78,
};

export const AI_ULTIMATE_USAGE_RATE: Record<AIDifficulty, number> = {
  easy: 0.35,
  normal: 0.78,
  boss: 0.96,
};
