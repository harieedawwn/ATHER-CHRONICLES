/**
 * Purpose: Factory functions for creating initial FighterState, neutral InputState, and cloth ScarfNode chains.
 * Exports: emptyInput, createScarf, createFighter
 * Depends on: ../fighters, ../types
 */

import { FIGHTERS } from '../fighters';
import { FighterId, FighterState, InputState, ScarfNode } from '../types';

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    shortHop: false,
    light: false,
    strong: false,
    special: false,
    dash: false,
    taunt: false,
    ultimate: false,
  };
}

export function createScarf(x: number, y: number): ScarfNode[] {
  const nodes: ScarfNode[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push({ x: x - i * 3.8, y: y - 16 + i * 0.6, vx: 0, vy: 0 });
  }
  return nodes;
}

export function createFighter(
  slot: 0 | 1,
  id: FighterId,
  x: number,
  y: number,
  facing: 1 | -1,
  stocks: number
): FighterState {
  return {
    slot,
    id,
    spec: FIGHTERS[id],
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    grounded: false,
    onPlatform: false,
    dropThroughTimer: 0,
    jumpsLeft: 2,
    airDashAvailable: true,
    fastFalling: false,
    action: 'idle',
    actionFrame: 0,
    currentMove: null,
    moveHitConnected: false,
    moveHitsDone: 0,
    chargeFrames: 0,
    holdingStrong: false,
    hitstunFrames: 0,
    hitstopFrames: 0,
    invulnFrames: 45,
    parryCooldown: 0,
    damagePercent: 0,
    hp: 1000,
    maxHp: 1000,
    stocks,
    comboCountReceived: 0,
    comboDamageReceived: 0,
    maxComboDealt: 0,
    totalDamageDealt: 0,
    countersLanded: 0,
    specialsLanded: 0,
    gauge: 0,
    ultimateGauge: 0,
    overdriveTimer: 0,
    suspendTimer: 0,
    anchorX: x,
    anchorY: y,
    anchorActive: false,
    hakiTimer: 0,
    hakiCounterTarget: null,
    armorStacks: 0,
    cinderMarks: 0,
    stasisSlowTimer: 0,
    puppetX: x + facing * 34,
    puppetY: y - 12,
    puppetVx: 0,
    puppetVy: 0,
    puppetActive: id === 'jin',
    puppetAttackTimer: 0,
    squashX: 1,
    squashY: 1,
    vibrateX: 0,
    flashWhiteFrames: 0,
    scarf: createScarf(x, y),
    poseBlend: 1,
    lastMoveKey: null,
    prevInput: emptyInput(),
    buffer: [],
    tapDirTimer: 0,
    lastTapDir: 0,
  };
}
