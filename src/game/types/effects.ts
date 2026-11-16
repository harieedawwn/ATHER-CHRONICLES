/**
 * Purpose: Runtime combat entities and visual effect types (projectiles, portals, stasis fields, particles, slashes).
 * Exports: Afterimage, Projectile, RiftSeal, StasisField, PortalPair, DelayedSlash, SlashArc, ShockwaveRing, Particle, FloatingCallout
 * Depends on: ./fighter, ./moves
 */

import { FighterAction, WeaponType } from './fighter';
import { MoveKey } from './moves';

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
