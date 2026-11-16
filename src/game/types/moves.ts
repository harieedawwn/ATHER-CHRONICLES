/**
 * Purpose: Frame data, hitbox specifications, move keys, categories, and special-move tags.
 * Exports: MoveKey, MoveCategory, HitboxSpec, SpecialTag, MoveData
 * Depends on: none
 */

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
