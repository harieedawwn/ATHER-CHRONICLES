// Barrel file & SpecialTag handler registry mapping all 9 fighters' special tags to { onStart, onStep, onHit, onActiveFrame, onEnd }.
// Exports: SPECIAL_HANDLERS, stepUltimate, and fighter-specific stance/puppet helpers.
// Depends on: @/game/types, ./types, ./kuro..jin, ./ultimateAct4And5.

import { SpecialTag } from '@/game/types';
import { BRAM_SPECIALS } from './bram';
import { CHRONO_SPECIALS } from './chrono';
import { JIN_SPECIALS, onJinMoveStart, triggerJinThreadGuillotine, updateJinPuppet } from './jin';
import { KENJI_SPECIALS, stepKenjiHaki, triggerKenjiCounter } from './kenji';
import { KURO_SPECIALS, stepKuroSuspend } from './kuro';
import { NYX_SPECIALS } from './nyx';
import { detonateRaijinRodNetwork, RAIJIN_SPECIALS } from './raijin';
import { SOL_SPECIALS } from './sol';
import { SpecialHandler } from './types';
import { stepUltimate } from './ultimateAct4And5';
import { VELO_SPECIALS } from './velo';

export const SPECIAL_HANDLERS: Partial<Record<SpecialTag, SpecialHandler>> = {
  ...KURO_SPECIALS,
  ...VELO_SPECIALS,
  ...KENJI_SPECIALS,
  ...BRAM_SPECIALS,
  ...RAIJIN_SPECIALS,
  ...CHRONO_SPECIALS,
  ...SOL_SPECIALS,
  ...NYX_SPECIALS,
  ...JIN_SPECIALS,
};

export {
  detonateRaijinRodNetwork,
  onJinMoveStart,
  stepKenjiHaki,
  stepKuroSuspend,
  stepUltimate,
  triggerJinThreadGuillotine,
  triggerKenjiCounter,
  updateJinPuppet,
};
export * from './types';
