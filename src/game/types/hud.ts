/**
 * Purpose: React HUD overlay data contracts emitted by the simulation engine.
 * Exports: FighterHUDInfo, HUDState
 * Depends on: ./fighter, ./match
 */

import { FighterId } from './fighter';
import { GameMode, Ruleset, TrainingBehavior } from './match';

export interface FighterHUDInfo {
  id: FighterId;
  name: string;
  title: string;
  accentColor: string;
  secondaryColor: string;
  damagePercent: number;
  hp: number;
  maxHp: number;
  stocks: number;
  gauge: number;
  gaugeLabel: string;
  ultimateGauge: number;
  ultimateName: string;
  statusBanner: string | null;
  isOverdrive: boolean;
  isSuspended: boolean;
  isHakiActive: boolean;
  armorStacks: number;
  cinderMarks: number;
  comboCount: number;
}

export interface HUDState {
  p1: FighterHUDInfo;
  p2: FighterHUDInfo;
  timerSeconds: number;
  ruleset: Ruleset;
  mode: GameMode;
  stocksCount: number;
  paused: boolean;
  countdownLabel?: '3' | '2' | '1' | 'FIGHT!' | null;
  winnerSlot: 0 | 1 | 'draw' | null;
  training: {
    dummyBehavior: TrainingBehavior;
    showHitboxes: boolean;
    autoHeal: boolean;
    lastComboHits: number;
    lastComboDamage: number;
  };
  matchStats: {
    p1MaxCombo: number;
    p1DamageDealt: number;
    p1Counters: number;
    p2MaxCombo: number;
    p2DamageDealt: number;
    p2Counters: number;
    durationSeconds: number;
  };
}
