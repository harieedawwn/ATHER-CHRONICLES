/**
 * Purpose: Core fighter identifiers, weapon archetypes, action states, spec definitions, and runtime fighter state.
 * Exports: FighterId, WeaponType, FighterAction, ScarfNode, FighterSpec,UltPose, FighterState
 * Depends on: ./moves, ./input
 */

import { BufferedInput, InputState } from './input';
import { MoveData, MoveKey } from './moves';

export type FighterId =
  | 'kuro'
  | 'velo'
  | 'kenji'
  | 'bram'
  | 'raijin'
  | 'chrono'
  | 'sol'
  | 'nyx'
  | 'jin';

export type WeaponType =
  | 'dagger'
  | 'gauntlet'
  | 'katana'
  | 'titan'
  | 'spear'
  | 'scythe'
  | 'chains'
  | 'orbs'
  | 'claws';

export type FighterAction =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'jump_squat'
  | 'air'
  | 'attack'
  | 'strong_charge'
  | 'hitstun'
  | 'airdodge'
  | 'parry'
  | 'taunt'
  | 'ultimate'
  | 'kuro_suspend'
  | 'kenji_haki'
  | 'ko_respawn';

export type UltPose =
  | 'none'
  | 'ult_charge'
  | 'ult_sprint'
  | 'ult_gut_strike'
  | 'ult_flank_slash'
  | 'ult_rapid_flurry'
  | 'ult_heavy_slam'
  | 'ult_launcher'
  | 'ult_sky_chase'
  | 'ult_sheathe_climax'
  | 'ult_finisher_dive'
  | 'ult_finisher_cleave'
  | 'ult_victim_gut'
  | 'ult_victim_recoil'
  | 'ult_victim_ground'
  | 'ult_victim_air';

export interface ScarfNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FighterSpec {
  id: FighterId;
  name: string;
  title: string;
  tagline: string;
  archetype: string;
  signatureSummary: string;
  ultimateName: string;
  ultimateDescription: string;
  tauntQuote: string;
  accentColor: string;
  secondaryColor: string;
  glowColor: string;
  bodyColor: string;
  scarfColor: string;
  weaponType: WeaponType;
  stats: {
    walkSpeed: number;
    dashSpeed: number;
    airSpeed: number;
    jumpForce: number;
    shortHopForce: number;
    gravity: number;
    fallSpeed: number;
    fastFallSpeed: number;
    weight: number;
  };
  specialNotes: {
    neutral: string;
    side: string;
    up: string;
    down: string;
  };
  moves: Record<MoveKey, MoveData>;
}

export interface FighterState {
  slot: 0 | 1;
  id: FighterId;
  spec: FighterSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  onPlatform: boolean;
  dropThroughTimer: number;
  jumpsLeft: number;
  airDashAvailable: boolean;
  fastFalling: boolean;

  action: FighterAction;
  actionFrame: number;
  currentMove: MoveData | null;
  moveHitConnected: boolean;
  moveHitsDone: number;
  chargeFrames: number;
  holdingStrong: boolean;

  hitstunFrames: number;
  hitstopFrames: number;
  invulnFrames: number;
  parryCooldown: number;

  // Damage / Life
  damagePercent: number;
  hp: number;
  maxHp: number;
  stocks: number;

  // Combo & stats tracking
  comboCountReceived: number;
  comboDamageReceived: number;
  maxComboDealt: number;
  totalDamageDealt: number;
  countersLanded: number;
  specialsLanded: number;

  // Unique Fighter Mechanics
  gauge: number; // 0..100
  ultimateGauge: number; // 0..100 (V button Ultimate Art)
  overdriveTimer: number; // Velo Hyper-Speed / Sol Hellfire Mantle frames
  suspendTimer: number; // Kuro mid-air suspension frames
  anchorX: number; // Kuro / Chrono anchor X
  anchorY: number; // Kuro / Chrono anchor Y
  anchorActive: boolean;
  hakiTimer: number; // Kenji Observation Haki active stance frames
  hakiCounterTarget: number | null;
  armorStacks: number; // Bram Kinetic Armor / Sol Cinder stacks on foe
  cinderMarks: number; // Cinder stacks applied on this fighter by Sol
  stasisSlowTimer: number; // Chrono Stasis slow effect on this fighter

  // Jin Puppet State
  puppetX: number;
  puppetY: number;
  puppetVx: number;
  puppetVy: number;
  puppetActive: boolean;
  puppetAttackTimer: number;

  // Visual helpers & 2.5D Ultimate Choreography state
  squashX: number;
  squashY: number;
  vibrateX: number;
  flashWhiteFrames: number;
  scarf: ScarfNode[];
  poseBlend: number;
  lastMoveKey: MoveKey | null;
  z?: number; // 2.5D depth coordinate (-60 foreground close-up .. +60 background depth)
  ultPose?: UltPose;
  ultStageLabel?: string;

  // Input tracking
  prevInput: InputState;
  buffer: BufferedInput[];
  tapDirTimer: number;
  lastTapDir: -1 | 0 | 1;
}
