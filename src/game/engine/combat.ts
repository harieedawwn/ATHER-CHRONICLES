// Melee hitbox/hurtbox collision resolution, anime weapon clash, parry stagger, and Kenji Haki counter triggers.
// Exports: getActiveHitboxRect, rectsOverlap, resolveCombatCollisions.
// Depends on: @/game/types, @/game/specials/kenji, ./context, ./hitApplication, ./vfxSpawners.

import { triggerKenjiCounter } from '@/game/specials/kenji';
import { FighterState } from '@/game/types';
import { EngineContext, triggerTimeDilation } from './context';
import { applyHitToFighter } from './hitApplication';
import { spawnHitSparks } from './vfxSpawners';

export interface HitboxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getActiveHitboxRect(f: FighterState): HitboxRect | null {
  if (f.action !== 'attack' || !f.currentMove) return null;
  const m = f.currentMove;
  const effFrame = Math.floor(f.actionFrame * (f.overdriveTimer > 0 ? 1.35 : 1.0));
  if (effFrame < m.startup || effFrame >= m.startup + m.active || m.hitbox.width <= 0) {
    return null;
  }
  return {
    x: f.x + m.hitbox.offsetX * f.facing - m.hitbox.width * 0.5,
    y: f.y + m.hitbox.offsetY - m.hitbox.height * 0.5,
    w: m.hitbox.width,
    h: m.hitbox.height,
  };
}

export function rectsOverlap(a: HitboxRect, b: HitboxRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function handleParryDeflect(ctx: EngineContext, attacker: FighterState, defender: FighterState): void {
  attacker.moveHitConnected = true;
  attacker.hitstopFrames = 14;
  defender.hitstopFrames = 9;
  attacker.vx = -attacker.facing * 4.6;
  attacker.action = 'hitstun';
  attacker.actionFrame = 0;
  attacker.currentMove = null;
  attacker.hitstunFrames = 18;

  defender.invulnFrames = 16;
  defender.parryCooldown = 0;
  defender.countersLanded++;
  defender.gauge = Math.min(100, defender.gauge + 26);
  const prevUlt = defender.ultimateGauge;
  defender.ultimateGauge = Math.min(100, defender.ultimateGauge + 18);
  if (prevUlt < 100 && defender.ultimateGauge >= 100) {
    ctx.sound.playUltimateReady(defender.id, Math.max(-0.85, Math.min(0.85, defender.x / 360)));
  }
  ctx.impactFrames = 3;
  triggerTimeDilation(ctx, 0.25, 18);
  ctx.shakeMag = Math.max(ctx.shakeMag, 8);
  ctx.shockwaves.push({
    x: defender.x + defender.facing * 10,
    y: defender.y - 10,
    radius: 6,
    maxRadius: 56,
    color: '#f8fafc',
    life: 16,
    maxLife: 16,
    lineWidth: 3,
  });
  spawnHitSparks(ctx, defender.x + defender.facing * 10, defender.y - 10, '#fef08a', 18);
  ctx.callouts.push({
    x: defender.x,
    y: defender.y - 36,
    vy: -0.7,
    text: 'PARRY!',
    color: '#fef08a',
    life: 28,
    maxLife: 28,
  });
  ctx.sound.playParryDeflect(defender.id, Math.max(-0.85, Math.min(0.85, defender.x / 360)));
}

export function resolveCombatCollisions(ctx: EngineContext): void {
  const f1 = ctx.fighters[0];
  const f2 = ctx.fighters[1];
  if (f1.action === 'ko_respawn' || f2.action === 'ko_respawn') return;

  const hb1 = getActiveHitboxRect(f1);
  const hb2 = getActiveHitboxRect(f2);

  if (hb1 && hb2 && !f1.moveHitConnected && !f2.moveHitConnected && rectsOverlap(hb1, hb2)) {
    const d1 = f1.currentMove!.hitbox.damage;
    const d2 = f2.currentMove!.hitbox.damage;
    if (Math.abs(d1 - d2) <= 5) {
      f1.moveHitConnected = true;
      f2.moveHitConnected = true;
      f1.hitstopFrames = 10;
      f2.hitstopFrames = 10;
      f1.vx = -f1.facing * 5.2;
      f2.vx = -f2.facing * 5.2;
      const cx = (f1.x + f2.x) * 0.5;
      const cy = (f1.y + f2.y) * 0.5 - 8;
      spawnHitSparks(ctx, cx, cy, '#fef08a', 20);
      ctx.shockwaves.push({
        x: cx,
        y: cy,
        radius: 6,
        maxRadius: 56,
        color: '#ffffff',
        life: 16,
        maxLife: 16,
        lineWidth: 3,
      });
      ctx.callouts.push({
        x: cx,
        y: cy - 24,
        vy: -0.7,
        text: 'CLASH!',
        color: '#fef08a',
        life: 28,
        maxLife: 28,
      });
      ctx.shakeMag = 8;
      ctx.sound.playClash(Math.max(-0.85, Math.min(0.85, cx / 360)));
      return;
    }
  }

  for (let i = 0; i < 2; i++) {
    const attacker = ctx.fighters[i];
    const defender = ctx.fighters[1 - i];
    const hb = i === 0 ? hb1 : hb2;
    const m = attacker.currentMove;
    if (!hb || !m) continue;
    const canHitAgain =
      !attacker.moveHitConnected ||
      (m.multiHitInterval && attacker.actionFrame % m.multiHitInterval === 0 && attacker.moveHitsDone < 3);
    if (!canHitAgain) continue;

    const hurt = { x: defender.x - 11, y: defender.y - 28, w: 22, h: 46 };
    if (!rectsOverlap(hb, hurt)) continue;

    if (defender.action === 'kenji_haki') {
      attacker.moveHitConnected = true;
      triggerKenjiCounter(ctx, defender, attacker);
      return;
    }

    if (defender.invulnFrames > 0) {
      if (defender.action === 'parry') {
        handleParryDeflect(ctx, attacker, defender);
      }
      continue;
    }

    attacker.moveHitConnected = true;
    attacker.moveHitsDone++;
    if (m.category === 'special') attacker.specialsLanded++;

    if (attacker.overdriveTimer > 0) {
      attacker.airDashAvailable = true;
    }

    const chargeRatio = m.canCharge ? Math.min(1, attacker.chargeFrames / (m.maxCharge ?? 40)) : 0;
    const dmgMult =
      1 +
      chargeRatio * 0.45 +
      (attacker.armorStacks > 0 && m.category === 'strong' ? attacker.armorStacks * 0.15 : 0);
    const kbMult = 1 + chargeRatio * 0.35;
    if (m.category === 'strong' && attacker.armorStacks > 0) attacker.armorStacks = 0;

    applyHitToFighter(ctx, attacker, defender, m.hitbox, dmgMult, kbMult);
  }
}
