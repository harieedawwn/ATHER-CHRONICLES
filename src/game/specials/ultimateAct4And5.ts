// Ultimate Awakening Act IV (Aerial Sky-Chase, Frames 307..375), Act V (Cataclysmic Finisher, Frames 376..450), and master stepUltimate dispatcher.
// Exports: stepUltimateAct4, stepUltimateAct5, stepUltimate.
// Depends on: @/game/types, @/game/engine/context, @/game/engine/hitApplication, @/game/engine/physics, @/game/engine/scarf, @/game/engine/stageBoundsAndHazards, @/game/engine/vfxSpawners, ./ultimateAct1And2, ./ultimateAct3.

import { EngineContext, triggerTimeDilation } from '@/game/engine/context';
import { applyHitToFighter } from '@/game/engine/hitApplication';
import { applyPhysics } from '@/game/engine/physics';
import { updateScarf } from '@/game/engine/scarf';
import { checkBounds } from '@/game/engine/stageBoundsAndHazards';
import { spawnAfterimage, spawnDust, spawnHitSparks } from '@/game/engine/vfxSpawners';
import { FighterState, InputState } from '@/game/types';
import {
  getUltimateBounds,
  stepUltimateAct1,
  stepUltimateAct2,
  stepUltimateWhiffRecovery,
  UltimateBounds,
} from './ultimateAct1And2';
import { stepUltimateAct3 } from './ultimateAct3';

export function stepUltimateAct4(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  bounds: UltimateBounds
): void {
  const af = f.actionFrame;
  const { groundY } = bounds;
  const cFrame = af - 307;
  const cT = cFrame / 68;
  const aerialY = groundY - 142;

  if (af === 307 || af === 342) {
    ctx.sound.playUltimateFinalCharge(f.id);
  }

  foe.x += (f.anchorX - foe.x) * 0.28;
  foe.y += (aerialY + Math.sin(cFrame * 0.2) * 4 - foe.y) * 0.28;
  foe.z = (foe.z ?? 0) + (24 - (foe.z ?? 0)) * 0.28;
  foe.vx = 0;
  foe.vy = 0;
  foe.vibrateX = af >= 342 ? (af % 2 === 0 ? 1 : -1) * 3.2 : 0;
  foe.action = 'hitstun';
  foe.hitstunFrames = 60;
  foe.ultPose = 'ult_victim_air';

  if (af <= 341) {
    f.ultStageLabel = `${f.spec.ultimateName} // AERIAL PURSUIT`;
    f.ultPose = 'ult_sky_chase';
    const orbitA = (cFrame / 34) * Math.PI * 1.35;
    const tx = f.anchorX + Math.cos(orbitA) * 36;
    const ty = aerialY + Math.sin(orbitA) * 16;
    const tz = Math.sin(orbitA) * 32;
    f.x += (tx - f.x) * 0.25;
    f.y += (ty - f.y) * 0.25;
    f.z = (f.z ?? 0) + (tz - (f.z ?? 0)) * 0.25;
    f.facing = f.anchorX >= f.x ? 1 : -1;
    if (af === 320) {
      ctx.sound.playUltimateBarrageStrike(f.id, 8);
      ctx.impactFrames = 3;
      ctx.shakeMag = 14;
      spawnHitSparks(ctx, foe.x, foe.y - 10, '#fde047', 24);
    }
  } else {
    f.ultStageLabel = `${f.spec.ultimateName} // FINAL EXECUTION`;
    const prepT = (af - 342) / 33;

    if (f.id === 'kenji') {
      f.x += (f.anchorX + 46 - f.x) * 0.22;
      f.y += (groundY - f.y) * 0.24;
      f.z = (f.z ?? 0) + (-56 - (f.z ?? 0)) * 0.22;
      f.facing = 1;
      f.ultPose = 'ult_sheathe_climax';
    } else if (
      f.id === 'velo' ||
      f.id === 'bram' ||
      f.id === 'raijin' ||
      f.id === 'kuro' ||
      f.id === 'sol'
    ) {
      const tx = f.anchorX - f.facing * (1 - prepT) * 24;
      const ty =
        aerialY -
        64 * Math.sin(prepT * Math.PI * 0.5) +
        (prepT > 0.72 ? (prepT - 0.72) * 210 : 0);
      const tz = -36 + prepT * 36;
      f.x += (tx - f.x) * 0.26;
      f.y += (ty - f.y) * 0.26;
      f.z = (f.z ?? 0) + (tz - (f.z ?? 0)) * 0.26;
      f.ultPose = 'ult_finisher_dive';
      if (af % 3 === 0 && prepT > 0.65) spawnAfterimage(ctx, f, '#fde047');
    } else {
      f.x += (f.anchorX - 48 - f.x) * 0.22;
      f.y += (groundY - 22 - f.y) * 0.22;
      f.z = (f.z ?? 0) + (-52 - (f.z ?? 0)) * 0.22;
      f.facing = 1;
      f.ultPose = 'ult_sheathe_climax';
      if (f.id === 'jin') {
        f.puppetActive = true;
        f.puppetX += (foe.x + 28 - f.puppetX) * 0.25;
        f.puppetY += (foe.y - 18 - f.puppetY) * 0.25;
        f.puppetAttackTimer = 15;
      }
    }
  }

  if (af % 2 === 0) {
    const ang = Math.random() * Math.PI * 2;
    const r = 52 + (1 - cT) * 38;
    ctx.particles.push({
      x: foe.x + Math.cos(ang) * r,
      y: foe.y - 10 + Math.sin(ang) * r,
      vx: -Math.cos(ang) * 4.5,
      vy: -Math.sin(ang) * 4.5,
      size: 3.8,
      color: af % 4 === 0 ? '#ffffff' : f.spec.secondaryColor,
      life: 12,
      maxLife: 12,
      gravity: 0,
      drag: 0.9,
      shape: 'flare',
      angle: ang,
      spin: 0.22,
    });
  }

  updateScarf(ctx, f);
}

export function stepUltimateAct5(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  inp: InputState,
  bounds: UltimateBounds
): void {
  const af = f.actionFrame;
  const { groundY } = bounds;

  if (af === 376) {
    foe.vibrateX = 0;
    foe.x = f.anchorX;
    foe.y = f.id === 'kenji' || f.id === 'chrono' || f.id === 'nyx' ? groundY - 64 : groundY;
    foe.z = 0;
    foe.ultPose = 'none';

    if (f.id !== 'kenji' && f.id !== 'chrono' && f.id !== 'nyx' && f.id !== 'jin') {
      f.x = f.anchorX - f.facing * 18;
      f.y = groundY;
    }
    f.z = -18;
    f.ultPose = f.id === 'kenji' ? 'ult_sheathe_climax' : 'ult_finisher_cleave';
    f.ultStageLabel = `${f.spec.ultimateName} // CATACLYSMIC FINISH!!`;

    ctx.sound.playUltimateImpact(f.id);
    ctx.impactFrames = 10;
    triggerTimeDilation(ctx, 0.2, 36);
    ctx.shakeMag = 32;

    [185, 130, 80].forEach((maxR, idx) => {
      ctx.shockwaves.push({
        x: foe.x,
        y: foe.y - 8,
        radius: 10 + idx * 6,
        maxRadius: maxR,
        color: idx === 0 ? f.spec.accentColor : idx === 1 ? '#fde047' : '#ffffff',
        life: 26 - idx * 3,
        maxLife: 26 - idx * 3,
        lineWidth: 4.5 - idx * 0.8,
      });
    });

    spawnHitSparks(ctx, foe.x, foe.y - 10, '#fde047', 42);
    spawnDust(ctx, f.anchorX, groundY + 18, 0);

    if (f.id === 'sol') {
      foe.cinderMarks = 5;
    }

    applyHitToFighter(
      ctx,
      f,
      foe,
      {
        offsetX: 0,
        offsetY: 0,
        width: 220,
        height: 220,
        damage: 24,
        baseKnockback: 11.8,
        knockbackGrowth: 0.11,
        angleDeg: f.id === 'kuro' || f.id === 'bram' ? 68 : 75,
        hitstop: 22,
        breaksArmor: true,
        unblockable: true,
        hitstunBonus: 24,
      },
      1.0,
      1.0
    );

    ctx.callouts.push({
      x: foe.x,
      y: foe.y - 58,
      vy: -0.8,
      text: `${f.spec.ultimateName}!!`,
      color: '#fde047',
      life: 52,
      maxLife: 52,
    });
  }

  if (af === 388 || af === 400) {
    ctx.shakeMag = Math.max(ctx.shakeMag, 14);
    spawnDust(ctx, f.anchorX + (af === 388 ? -36 : 36), groundY + 18, 0);
    spawnHitSparks(ctx, f.anchorX, groundY - 12, f.spec.secondaryColor, 16);
  }

  if (af >= 377) {
    f.z = (f.z ?? 0) * 0.88;
    foe.z = (foe.z ?? 0) * 0.88;
    if (af >= 412) {
      f.ultPose = 'none';
      foe.ultPose = 'none';
      f.ultStageLabel = undefined;
    }
    applyPhysics(ctx, f, inp, 1.0);
  }

  if (af >= 450) {
    f.z = 0;
    foe.z = 0;
    f.ultPose = 'none';
    foe.ultPose = 'none';
    f.ultStageLabel = undefined;
    f.action = f.grounded ? 'idle' : 'air';
    f.actionFrame = 0;
    f.currentMove = null;
  }

  updateScarf(ctx, f);
  checkBounds(ctx, f);
}

export function stepUltimate(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  inp: InputState
): void {
  const af = f.actionFrame;
  const bounds = getUltimateBounds(ctx);

  if (af <= 127 || f.moveHitConnected) {
    f.invulnFrames = Math.max(f.invulnFrames, 4);
  }

  if (af <= 60) {
    stepUltimateAct1(ctx, f, foe, bounds);
    return;
  }
  if (af >= 61 && af <= 126) {
    stepUltimateAct2(ctx, f, foe, bounds);
    return;
  }
  if (!f.moveHitConnected) {
    stepUltimateWhiffRecovery(ctx, f, inp);
    return;
  }
  if (af >= 127 && af <= 306) {
    stepUltimateAct3(ctx, f, foe, bounds);
    return;
  }
  if (af >= 307 && af <= 375) {
    stepUltimateAct4(ctx, f, foe, bounds);
    return;
  }
  stepUltimateAct5(ctx, f, foe, inp, bounds);
}
