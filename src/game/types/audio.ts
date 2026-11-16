/**
 * Purpose: Headless-safe audio interface injected into the simulation engine so game logic has zero Web Audio dependencies.
 * Exports: SoundInterface
 * Depends on: ./fighter, ./moves, ./stage
 */

import { FighterId } from './fighter';
import { MoveCategory, MoveKey, SpecialTag } from './moves';
import { StageId } from './stage';

export interface SoundInterface {
  unlock(): void;
  setTimeDilationDuck(active: boolean): void;
  stepEnvironment(stageId: StageId, tick: number): void;
  playCountdownTick(num: 3 | 2 | 1): void;
  playFightStart(): void;
  playChargePulse(id: FighterId, ratio: number, pan?: number): void;
  playAttackSwing(id: FighterId, moveKey: MoveKey, category: MoveCategory, pan?: number): void;
  playBlink(id?: FighterId, pan?: number): void;
  playSpecialSkill(id: FighterId, tag: SpecialTag, pan?: number): void;
  playJump(isShort: boolean, id: FighterId, isDouble?: boolean, pan?: number): void;
  playUltimateActivation(id: FighterId): void;
  playDash(id: FighterId, isAir: boolean, pan?: number): void;
  playParryStance(id: FighterId, pan?: number): void;
  playTaunt(id: FighterId, pan?: number): void;
  playSkid(id: FighterId, pan?: number): void;
  playFootstep(id: FighterId, isDash: boolean, pan?: number): void;
  playUltimateReady(id: FighterId, pan?: number): void;
  playUltimateSprintStep(id: FighterId, stepIdx: number): void;
  playGuardShatter(pan?: number): void;
  playUltimateBarrageStrike(id: FighterId, hitIdx: number): void;
  playWallSlam(id: FighterId, intensity?: number, pan?: number): void;
  playUltimateFinalCharge(id: FighterId): void;
  playUltimateImpact(id: FighterId): void;
  playOverdrive(id: FighterId, pan?: number): void;
  playHakiPulse(id: FighterId, pan?: number): void;
  playAttackHit(
    attackerId: FighterId,
    defenderId: FighterId,
    moveKey: MoveKey | null,
    category: MoveCategory | null,
    damage: number,
    kbForce: number,
    isHeavy: boolean,
    pan?: number
  ): void;
  playCeilingBonk(pan?: number): void;
  playWallSlide(id: FighterId, pan?: number): void;
  playLand(id: FighterId, impactVy?: number, pan?: number): void;
  playJumpPad(pan?: number): void;
  playKO(): void;
  playClash(pan?: number): void;
  playParryDeflect(id: FighterId, pan?: number): void;
  playCounter(pan?: number): void;
  playArmorAbsorb(id: FighterId, pan?: number): void;
  playSwing(pitch?: number): void;
}
