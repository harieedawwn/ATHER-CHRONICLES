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

export type Ruleset = 'stock' | 'hp';
export type GameMode = 'vs_ai' | 'training';
export type AIDifficulty = 'easy' | 'normal' | 'boss';
export type StageId =
  | 'void_flat'
  | 'torii'
  | 'dojo'
  | 'monolith'
  | 'coliseum'
  | 'hypercube'
  | 'tesseract'
  | 'train';
export type TrainingBehavior = 'idle' | 'guard' | 'counter' | 'attack' | 'recover';

export type ScreenView = 'title' | 'setup' | 'battle';

export type MoveKey =
  | 'jab1'
  | 'jab2'
  | 'jab3'
  | 'ftilt'
  | 'utilt'
  | 'dtilt'
  | 'nair'
  | 'fair'
  | 'bair'
  | 'uair'
  | 'dair'
  | 'fstrong'
  | 'ustrong'
  | 'dstrong'
  | 'nspecial'
  | 'sspecial'
  | 'uspecial'
  | 'dspecial'
  | 'kuro_suspend_dunk'
  | 'kenji_counter_slash';

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

export type MoveCategory = 'light' | 'strong' | 'special' | 'aerial';

export interface HitboxSpec {
  offsetX: number; // relative to fighter center, multiplied by facing
  offsetY: number;
  width: number;
  height: number;
  damage: number;
  baseKnockback: number;
  knockbackGrowth: number;
  angleDeg: number; // 0 = forward, 90 = up, -90 = meteor down
  hitstop: number;
  hitstunBonus?: number;
  isProjectile?: boolean;
  isLauncher?: boolean;
  isMeteor?: boolean;
  breaksArmor?: boolean;
  unblockable?: boolean;
  reflectsProjectiles?: boolean;
  pullTarget?: boolean;
  wallBounce?: boolean;
  appliesCinder?: boolean;
  slashStyle?: 'arc' | 'thrust' | 'slam' | 'burst' | 'wave' | 'upper';
}

export type SpecialTag =
  | 'kuro_blink_suspend'
  | 'kuro_dunk_return'
  | 'kuro_shadow_slash'
  | 'kuro_void_ascent'
  | 'kuro_abyss_drop'
  | 'velo_overdrive'
  | 'velo_mach_blitz'
  | 'velo_volt_zip'
  | 'velo_decoy_sweep'
  | 'kenji_haki_stance'
  | 'kenji_iaido_draw'
  | 'kenji_dragon_ascent'
  | 'kenji_repulse'
  | 'kenji_counter_exec'
  | 'bram_gravity_pull'
  | 'bram_comet_tackle'
  | 'bram_seismic_leap'
  | 'bram_rift_seal'
  | 'raijin_rod_plant'
  | 'raijin_flash_lance'
  | 'raijin_sky_fall'
  | 'raijin_sky_pillar'
  | 'chrono_echo_rewind'
  | 'chrono_stasis_bubble'
  | 'chrono_pendulum_reap'
  | 'chrono_clock_judgment'
  | 'sol_supernova'
  | 'sol_chain_grapple'
  | 'sol_phoenix_dive'
  | 'sol_hellfire_mantle'
  | 'nyx_prism_barrage'
  | 'nyx_portal_gate'
  | 'nyx_star_ascension'
  | 'nyx_spatial_swap'
  | 'jin_puppet_command'
  | 'jin_thread_guillotine'
  | 'jin_marionette_lift'
  | 'jin_puppet_ambush';

export interface MoveData {
  key: MoveKey;
  name: string;
  category: MoveCategory;
  startup: number; // frames before active
  active: number; // active frames
  recovery: number; // frames after active
  canCharge?: boolean;
  maxCharge?: number;
  superArmorFrames?: [number, number];
  invulnFrames?: [number, number];
  lungeX?: number;
  lungeY?: number;
  lungeAtFrame?: number;
  keepMomentum?: boolean;
  gravityScale?: number;
  hitbox: HitboxSpec;
  multiHitInterval?: number;
  canCancelIntoJab?: MoveKey;
  specialTag?: SpecialTag;
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

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shortHop: boolean;
  light: boolean;
  strong: boolean;
  special: boolean;
  dash: boolean;
  taunt: boolean;
  ultimate: boolean;
}

export interface BufferedInput {
  type: 'jump' | 'shortHop' | 'light' | 'strong' | 'special' | 'dash' | 'taunt' | 'ultimate';
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  ttl: number;
}

export interface ScarfNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Afterimage {
  x: number;
  y: number;
  facing: 1 | -1;
  action: FighterAction;
  moveKey: MoveKey | null;
  moveFrame: number;
  color: string;
  alpha: number;
  poseSeed: number;
  weaponType?: WeaponType;
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

  // Visual helpers
  squashX: number;
  squashY: number;
  vibrateX: number;
  flashWhiteFrames: number;
  scarf: ScarfNode[];
  poseBlend: number;
  lastMoveKey: MoveKey | null;

  // Input tracking
  prevInput: InputState;
  buffer: BufferedInput[];
  tapDirTimer: number;
  lastTapDir: -1 | 0 | 1;
}

export interface Projectile {
  id: number;
  ownerSlot: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  baseKnockback: number;
  knockbackGrowth: number;
  angleDeg: number;
  ttl: number;
  color: string;
  kind: 'void_wave' | 'sonic_blade' | 'haki_slash' | 'gravity_orb' | 'prism_beam' | 'chain_hook';
  teleported?: boolean;
}

export interface RiftSeal {
  ownerSlot: 0 | 1;
  x: number;
  y: number;
  ttl: number;
  pulse: number;
  color: string;
  kind?: 'bram_seal' | 'raijin_rod' | 'chrono_echo';
}

export interface StasisField {
  ownerSlot: 0 | 1;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  color?: string;
}

export interface PortalPair {
  ownerSlot: 0 | 1;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ttl: number;
  cooldown: number;
  color?: string;
  secondaryColor?: string;
}

export interface DelayedSlash {
  ownerSlot: 0 | 1;
  x: number;
  y: number;
  angle: number;
  length: number;
  timer: number;
  color: string;
  damage: number;
  knockback: number;
  kbGrowth: number;
}

export interface SlashArc {
  x: number;
  y: number;
  angleStart: number;
  angleEnd: number;
  radius: number;
  thickness: number;
  color: string;
  coreColor: string;
  life: number;
  maxLife: number;
  facing: 1 | -1;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  lineWidth: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  shape: 'pixel' | 'spark' | 'ring' | 'ink' | 'flare' | 'debris' | 'wind_cone';
  angle?: number;
  spin?: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface PlatformMotion {
  axis: 'x' | 'y' | 'orbit';
  ampX: number;
  ampY: number;
  speed: number;
  phase: number;
}

export interface StageJumpPad {
  x: number;
  y: number;
  width: number;
  boostVy: number;
  color: string;
}

export interface StagePlatform {
  x: number;
  y: number;
  width: number;
  thickness?: number;
  isMain: boolean;
  style?: 'stone' | 'wood' | 'holo' | 'obsidian' | 'gold' | 'train' | 'mirror';
  motion?: PlatformMotion;
}

export interface StageSpec {
  id: StageId;
  name: string;
  subtitle: string;
  tag: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accentColor: string;
  platforms: StagePlatform[];
  spawnX?: [number, number];
  gravityMult?: number;
  wrapHorizontal?: boolean;
  wrapEdgeX?: number;
  windHazard?: boolean;
  jumpPads?: StageJumpPad[];
  blastLeft: number;
  blastRight: number;
  blastTop: number;
  blastBottom: number;
  wallLeft: number; // used in HP mode
  wallRight: number; // used in HP mode
}

export interface MatchConfig {
  mode: GameMode;
  ruleset: Ruleset;
  p1Fighter: FighterId;
  p2Fighter: FighterId;
  aiDifficulty: AIDifficulty;
  stageId: StageId;
  stocksCount: number;
}

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
