/**
 * Purpose: Fighter registry mapping FighterId to FighterSpec and ordered FIGHTER_LIST for UI/engine lookup.
 * Exports: FIGHTERS, FIGHTER_LIST, createBaseMoves, scaleFighterStats
 * Depends on: ../types, ./sharedMoves, ./kuro, ./velo, ./kenji, ./bram, ./raijin, ./chrono, ./sol, ./nyx, ./jin
 */

import { FighterId, FighterSpec } from '../types';
import { BRAM_SPEC } from './bram';
import { CHRONO_SPEC } from './chrono';
import { JIN_SPEC } from './jin';
import { KENJI_SPEC } from './kenji';
import { KURO_SPEC } from './kuro';
import { NYX_SPEC } from './nyx';
import { RAIJIN_SPEC } from './raijin';
import { createBaseMoves, scaleFighterStats } from './sharedMoves';
import { SOL_SPEC } from './sol';
import { VELO_SPEC } from './velo';

export { createBaseMoves, scaleFighterStats };

export const FIGHTERS: Record<FighterId, FighterSpec> = {
  kuro: KURO_SPEC,
  velo: VELO_SPEC,
  kenji: KENJI_SPEC,
  bram: BRAM_SPEC,
  raijin: RAIJIN_SPEC,
  chrono: CHRONO_SPEC,
  sol: SOL_SPEC,
  nyx: NYX_SPEC,
  jin: JIN_SPEC,
};

export const FIGHTER_LIST: FighterSpec[] = [
  FIGHTERS.kuro,
  FIGHTERS.velo,
  FIGHTERS.kenji,
  FIGHTERS.bram,
  FIGHTERS.raijin,
  FIGHTERS.chrono,
  FIGHTERS.sol,
  FIGHTERS.nyx,
  FIGHTERS.jin,
];
