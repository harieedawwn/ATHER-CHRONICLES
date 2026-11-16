// Single 60Hz simulation tick orchestrator: countdown, input buffering, cutscene locks, combat, hazards, and timer.
// Exports: stepSimulationTick.
// Depends on: @/game/ai, @/game/types, ./arenaHazards, ./camera, ./combat, ./context, ./createFighter, ./fighterStep, ./hudEmitter, ./inputBuffer, ./physics, ./projectiles, ./scarf.

import { AIController } from '@/game/ai';
import { FighterState, InputState } from '@/game/types';
import {
  updateDelayedSlashes,
  updatePortals,
  updateRiftSeals,
  updateStasisFields,
} from './arenaHazards';
import { updateParticlesAndCameraOnly } from './camera';
import { resolveCombatCollisions } from './combat';
import { EngineContext } from './context';
import { emptyInput } from './createFighter';
import { stepFighter } from './fighterStep';
import { resolveTimeOver } from './hudEmitter';
import { updateFighterInputBuffer } from './inputBuffer';
import { applyPhysics } from './physics';
import { updateProjectiles } from './projectiles';
import { updateScarf } from './scarf';

export function stepSimulationTick(
  c: EngineContext,
  ai: AIController,
  readPlayerInput: () => InputState,
  p1InputOverride?: InputState
): void {
  c.tick++;
  c.sound.stepEnvironment(c.stage.id, c.tick);

  if (c.countdownFrames > 0) {
    if (c.countdownFrames === 85) c.sound.playCountdownTick(3);
    else if (c.countdownFrames === 63) c.sound.playCountdownTick(2);
    else if (c.countdownFrames === 41) c.sound.playCountdownTick(1);
    else if (c.countdownFrames === 18) c.sound.playFightStart();

    c.countdownFrames--;
    if (
      c.countdownFrames === 84 ||
      c.countdownFrames === 62 ||
      c.countdownFrames === 40 ||
      c.countdownFrames === 17 ||
      c.countdownFrames === 0
    ) {
      c.emitHUD(true);
    }

    if (c.countdownFrames > 18) {
      for (const f of c.fighters) {
        f.actionFrame++;
        applyPhysics(c, f, emptyInput(), 1.0);
        updateScarf(c, f);
      }
      updateParticlesAndCameraOnly(c);
      return;
    }
  }

  if (c.winnerSlot === null && c.config.mode === 'vs_ai') {
    c.matchFrames++;
  }

  if (c.impactFrames > 0) {
    c.impactFrames--;
    c.impactInverted = !c.impactInverted;
  }

  const p1Input =
    c.winnerSlot === null ? (p1InputOverride ?? readPlayerInput()) : emptyInput();
  const p2Input =
    c.winnerSlot === null
      ? ai.computeInput(
          c.fighters[1],
          c.fighters[0],
          c.stage,
          c.config.mode,
          c.config.aiDifficulty,
          c.trainingBehavior,
          c.tick
        )
      : emptyInput();

  const inputs: [InputState, InputState] = [p1Input, p2Input];

  for (let i = 0; i < 2; i++) {
    updateFighterInputBuffer(c, c.fighters[i], inputs[i]);
  }

  const isLockedByUlt = (caster: FighterState) =>
    caster.action === 'ultimate' &&
    (caster.actionFrame < 72 ||
      (caster.moveHitConnected && caster.actionFrame >= 133 && caster.actionFrame < 340));

  if (isLockedByUlt(c.fighters[0])) {
    stepFighter(c, c.fighters[0], c.fighters[1], inputs[0]);
    updateScarf(c, c.fighters[1]);
    updateParticlesAndCameraOnly(c);
    return;
  }
  if (isLockedByUlt(c.fighters[1])) {
    stepFighter(c, c.fighters[1], c.fighters[0], inputs[1]);
    updateScarf(c, c.fighters[0]);
    updateParticlesAndCameraOnly(c);
    return;
  }

  for (let i = 0; i < 2; i++) {
    stepFighter(c, c.fighters[i], c.fighters[1 - i], inputs[i]);
  }

  resolveCombatCollisions(c);
  updateProjectiles(c);
  updateDelayedSlashes(c);
  updateRiftSeals(c);
  updateStasisFields(c);
  updatePortals(c);

  if (c.config.mode === 'training' && c.autoHeal) {
    const p1 = c.fighters[0];
    if (p1.action !== 'ultimate' && p1.ultimateGauge < 100) {
      p1.ultimateGauge = Math.min(100, p1.ultimateGauge + 1.5);
    }
    const dummy = c.fighters[1];
    if (dummy.hitstunFrames === 0 && dummy.action !== 'hitstun') {
      if (dummy.damagePercent > 0) {
        dummy.damagePercent = Math.max(0, dummy.damagePercent - 1.8);
      }
      if (dummy.hp < dummy.maxHp) {
        dummy.hp = Math.min(dummy.maxHp, dummy.hp + 15);
      }
    }
  }

  if (c.config.mode === 'vs_ai' && c.winnerSlot === null) {
    const remaining = 99 - Math.floor(c.matchFrames / 60);
    if (remaining <= 0) {
      resolveTimeOver(c);
    }
  }

  updateParticlesAndCameraOnly(c);
}
