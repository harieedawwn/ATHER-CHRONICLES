/**
 * Purpose: Match configuration, game modes, rulesets, AI difficulty levels, and UI screen views.
 * Exports: Ruleset, GameMode, AIDifficulty, TrainingBehavior, ScreenView, MatchConfig
 * Depends on: ./fighter, ./stage
 */

import { FighterId } from './fighter';
import { StageId } from './stage';

export type Ruleset = 'stock' | 'hp';
export type GameMode = 'vs_ai' | 'training';
export type AIDifficulty = 'easy' | 'normal' | 'boss';
export type TrainingBehavior = 'idle' | 'guard' | 'counter' | 'attack' | 'recover';
export type ScreenView = 'title' | 'setup' | 'battle';

export interface MatchConfig {
  mode: GameMode;
  ruleset: Ruleset;
  p1Fighter: FighterId;
  p2Fighter: FighterId;
  aiDifficulty: AIDifficulty;
  stageId: StageId;
  stocksCount: number;
}
