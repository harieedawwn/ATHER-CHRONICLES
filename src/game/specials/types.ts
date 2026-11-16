/**
 * Purpose: Handler contract for SpecialTag registry entries ({ onStart, onStep, onHit, onActiveFrame, onEnd }).
 * Exports: SpecialHandler
 * Depends on: ../engine/context, ../types
 */

import { EngineContext } from '../engine/context';
import { FighterState, MoveData } from '../types';

export interface SpecialHandler {
  /**
   * Invoked when the special move starts in `startMove`.
   * Return `'handled'` if the handler sets a custom fighter action (e.g., `kuro_suspend`, `kenji_haki`)
   * and should skip setting `f.action = 'attack'`.
   */
  onStart?: (
    ctx: EngineContext,
    f: FighterState,
    move: MoveData,
    foe: FighterState,
    pan: number
  ) => 'handled' | void;

  /**
   * Invoked every frame while `f.action === 'attack'` and `f.currentMove?.specialTag` matches.
   */
  onStep?: (
    ctx: EngineContext,
    f: FighterState,
    move: MoveData,
    foe: FighterState
  ) => void;

  /**
   * Invoked on the exact frame startup completes (`f.actionFrame === m.startup`).
   */
  onActiveFrame?: (
    ctx: EngineContext,
    f: FighterState,
    move: MoveData,
    foe: FighterState,
    pan: number
  ) => void;

  /**
   * Invoked when the move connects with a defender.
   */
  onHit?: (
    ctx: EngineContext,
    attacker: FighterState,
    defender: FighterState,
    move: MoveData
  ) => void;

  /**
   * Invoked when `effFrame >= total` and the move ends.
   */
  onEnd?: (
    ctx: EngineContext,
    f: FighterState,
    move: MoveData,
    foe: FighterState
  ) => void;
}
