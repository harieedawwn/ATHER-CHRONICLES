/**
 * Purpose: Applies attack damage, super-armor absorption, knockback velocity, hitstun/hitstop, and HP-mode KOs.
 * Exports: applyHitToFighter
 * Depends on: ../types, ./context, ./vfxSpawners
 */

import { FighterState, MoveData } from '../types';
import { EngineContext } from './context';
import { spawnDust, spawnHitSparks } from './vfxSpawners';

function tryAbsorbWithSuperArmor(
  ctx: EngineContext,
  attacker: FighterState,
  defender: FighterState,
  hitbox: MoveData['hitbox'],
  damage: number,
  pan: number
): boolean {
  const defArmor =
    defender.currentMove?.superArmorFrames &&
    defender.actionFrame >= defender.currentMove.superArmorFrames[0] &&
    defender.actionFrame <= defender.currentMove.superArmorFrames[1] &&
    !hitbox.breaksArmor;

  if (defArmor && damage < 16) {
    defender.damagePercent += damage * 0.7;
    defender.hp = Math.max(1, defender.hp - damage * 7);
    defender.armorStacks = Math.min(3, defender.armorStacks + 1);
    defender.flashWhiteFrames = 4;
    attacker.hitstopFrames = 5;
    spawnHitSparks(ctx, defender.x, defender.y - 8, '#facc15', 10);
    ctx.callouts.push({
      x: defender.x,
      y: defender.y - 36,
      vy: -0.6,
      text: 'ARMOR!',
      color: '#facc15',
      life: 22,
      maxLife: 22,
    });
    ctx.sound.playArmorAbsorb(defender.id, pan);
    return true;
  }
  return false;
}

function awardHitGaugesAndStats(
  ctx: EngineContext,
  attacker: FighterState,
  defender: FighterState,
  hitbox: MoveData['hitbox'],
  damage: number,
  pan: number
): void {
  // Sol Cinder Stack Application (only when move explicitly applies Cinder, never on Supernova detonation!)
  if (hitbox.appliesCinder) {
    defender.cinderMarks = Math.min(5, defender.cinderMarks + 1);
  }

  // Gauge & Ultimate Awakening Gauge gain
  attacker.gauge = Math.min(100, attacker.gauge + damage * 1.6);
  defender.gauge = Math.min(100, defender.gauge + damage * 0.9);
  if (!hitbox.unblockable) {
    const prevAttUlt = attacker.ultimateGauge;
    const prevDefUlt = defender.ultimateGauge;
    attacker.ultimateGauge = Math.min(100, attacker.ultimateGauge + damage * 1.45);
    defender.ultimateGauge = Math.min(100, defender.ultimateGauge + damage * 1.15);
    if (prevAttUlt < 100 && attacker.ultimateGauge >= 100) {
      ctx.sound.playUltimateReady(attacker.id, Math.max(-0.85, Math.min(0.85, attacker.x / 360)));
    }
    if (prevDefUlt < 100 && defender.ultimateGauge >= 100) {
      ctx.sound.playUltimateReady(defender.id, pan);
    }
  }

  // Combo & Stat Tracking
  attacker.totalDamageDealt += damage;
  defender.comboCountReceived++;
  defender.comboDamageReceived += damage;
  if (defender.comboCountReceived > attacker.maxComboDealt) {
    attacker.maxComboDealt = defender.comboCountReceived;
  }
  if (ctx.config.mode === 'training' && attacker.slot === 0) {
    ctx.lastComboHits = defender.comboCountReceived;
    ctx.lastComboDamage = Math.round(defender.comboDamageReceived);
  }
}

export function applyHitToFighter(
  ctx: EngineContext,
  attacker: FighterState,
  defender: FighterState,
  hitbox: MoveData['hitbox'],
  dmgMult = 1,
  kbMult = 1
): void {
  const damage = hitbox.damage * dmgMult;
  const pan = Math.max(-0.85, Math.min(0.85, defender.x / 360));

  if (tryAbsorbWithSuperArmor(ctx, attacker, defender, hitbox, damage, pan)) {
    return;
  }

  // Apply damage
  defender.damagePercent += damage;
  defender.hp = Math.max(0, defender.hp - Math.round(damage * 10));
  defender.flashWhiteFrames = 4;
  defender.squashX = 1.25;
  defender.squashY = 0.75;

  awardHitGaugesAndStats(ctx, attacker, defender, hitbox, damage, pan);

  // Calculate Knockback!
  let kbForce: number;
  if (ctx.config.ruleset === 'stock') {
    const weightMod = 100 / defender.spec.stats.weight;
    kbForce =
      (hitbox.baseKnockback + defender.damagePercent * hitbox.knockbackGrowth) *
      weightMod *
      kbMult;
  } else {
    // HP mode: tighter combo-friendly knockback
    kbForce = (hitbox.baseKnockback * 0.85 + damage * hitbox.knockbackGrowth * 2.2) * kbMult;
  }

  if (hitbox.pullTarget) {
    // Bram Singularity Pull: yanks opponent straight toward Bram!
    const dx = attacker.x + attacker.facing * 26 - defender.x;
    const dy = attacker.y - 10 - defender.y;
    const dist = Math.hypot(dx, dy) || 1;
    defender.vx = (dx / dist) * Math.min(11, Math.max(5.5, dist * 0.14));
    defender.vy = (dy / dist) * 5 - 2.2;
    defender.grounded = false;
  } else {
    const rad = (hitbox.angleDeg * Math.PI) / 180;
    const dir = attacker.x <= defender.x ? 1 : -1;
    defender.vx = Math.cos(rad) * kbForce * dir;
    defender.vy = -Math.sin(rad) * kbForce;
    if (defender.vy < -0.5) defender.grounded = false;
  }

  defender.action = 'hitstun';
  defender.actionFrame = 0;
  defender.currentMove = null;
  defender.hitstunFrames = Math.max(12, Math.round(kbForce * 2.95) + (hitbox.hitstunBonus ?? 0));

  // Hitstop & Impact Frame Juice + Newtonian Attacker Recoil
  const hs = hitbox.hitstop;
  attacker.hitstopFrames = hs;
  defender.hitstopFrames = hs;
  attacker.squashX = 1.15;
  attacker.squashY = 0.88;

  if (!hitbox.isProjectile && !hitbox.unblockable) {
    if (attacker.grounded) {
      attacker.vx -= attacker.facing * Math.min(2.2, 0.45 + damage * 0.08);
    } else if (attacker.currentMove?.key === 'dair') {
      attacker.vy = Math.min(attacker.vy, -5.2);
    } else if (attacker.currentMove?.key === 'fair' || attacker.currentMove?.key === 'nair') {
      attacker.vy = Math.min(attacker.vy, -1.8);
    }
  }

  if (defender.grounded || Math.abs(defender.vx) > 4.5) {
    spawnDust(ctx, defender.x, defender.y + 18, attacker.facing);
  }
  for (let s = 1; s < defender.scarf.length; s++) {
    defender.scarf[s].vx += defender.vx * 0.65;
    defender.scarf[s].vy += defender.vy * 0.45 - 1.5;
  }

  const isHeavy = damage >= 14 || kbForce >= 9.0;
  ctx.shakeMag = Math.max(ctx.shakeMag, isHeavy ? 11 : 4.5);
  if (isHeavy) {
    ctx.impactFrames = 2;
    if (damage >= 16 || kbForce >= 10.2) {
      ctx.triggerTimeDilation(0.32, 14);
    }
    ctx.shockwaves.push({
      x: (attacker.x + defender.x) * 0.5,
      y: defender.y - 8,
      radius: 6,
      maxRadius: 64,
      color: attacker.spec.secondaryColor,
      life: 16,
      maxLife: 16,
      lineWidth: 3,
    });
  }

  spawnHitSparks(ctx, defender.x, defender.y - 8, attacker.spec.secondaryColor, isHeavy ? 18 : 9);
  ctx.sound.playAttackHit(
    attacker.id,
    defender.id,
    attacker.currentMove?.key ?? null,
    attacker.currentMove?.category ?? null,
    damage,
    kbForce,
    isHeavy,
    pan
  );

  // HP Mode KO check
  if (ctx.config.ruleset === 'hp' && defender.hp <= 0) {
    if (ctx.config.mode === 'training') {
      defender.hp = defender.maxHp;
    } else {
      ctx.impactFrames = 5;
      ctx.triggerTimeDilation(0.22, 34);
      ctx.shakeMag = 16;
      ctx.winnerSlot = attacker.slot;
      ctx.sound.playKO();
      ctx.emitHUD(true);
    }
  }
}
