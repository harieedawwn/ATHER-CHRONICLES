// Ultimate Awakening Act III (6-Beat Martial & Weapon Combo, Frames 127..306).
// Exports: stepUltimateAct3.
// Depends on: @/game/types, @/game/engine/context, @/game/engine/scarf, @/game/engine/vfxSpawners, ./ultimateAct1And2.

import { EngineContext } from '@/game/engine/context';
import { updateScarf } from '@/game/engine/scarf';
import { spawnAfterimage, spawnDust, spawnHitSparks } from '@/game/engine/vfxSpawners';
import { FighterState } from '@/game/types';
import { UltimateBounds } from './ultimateAct1And2';

function moveSmooth(actor: FighterState, tx: number, ty: number, tz: number, rate = 0.28): void {
  actor.x += (tx - actor.x) * rate;
  actor.y += (ty - actor.y) * rate;
  actor.z = (actor.z ?? 0) + (tz - (actor.z ?? 0)) * rate;
}

function applyAct3BeatHit(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  beatIdx: number,
  beatFrame: number,
  groundY: number
): void {
  const isMainBeatHit = beatFrame === 2;
  const isFlurrySubHit = beatIdx === 2 && (beatFrame === 9 || beatFrame === 16 || beatFrame === 23);
  if (!isMainBeatHit && !isFlurrySubHit) return;

  const strikeSoundIdx = Math.min(9, beatIdx * 2 + (isFlurrySubHit ? 1 : 0));
  ctx.sound.playUltimateBarrageStrike(f.id, strikeSoundIdx);

  const hitDmg = isFlurrySubHit ? 1.5 : 3.2;
  foe.damagePercent += hitDmg;
  foe.hp = Math.max(1, foe.hp - Math.round(hitDmg * 10));
  foe.comboCountReceived++;
  foe.comboDamageReceived += hitDmg;
  if (foe.comboCountReceived > f.maxComboDealt) {
    f.maxComboDealt = foe.comboCountReceived;
  }
  f.totalDamageDealt += hitDmg;
  foe.flashWhiteFrames = 4;
  foe.squashX = beatIdx % 2 === 0 ? 1.32 : 0.72;
  foe.squashY = beatIdx % 2 === 0 ? 0.72 : 1.32;

  ctx.impactFrames = beatIdx === 5 ? 5 : isMainBeatHit ? 3 : 1;
  ctx.shakeMag = beatIdx === 5 ? 20 : isMainBeatHit ? 13 : 8;

  const contactX = (f.x + foe.x) * 0.5;
  const contactY = (f.y + foe.y) * 0.5 - 12;
  const arcAngle =
    beatIdx === 0
      ? 0
      : beatIdx === 1
      ? 2.4
      : beatIdx === 2
      ? beatFrame * 0.9
      : beatIdx === 3
      ? -0.5
      : beatIdx === 4
      ? 1.57
      : -1.57;

  ctx.slashArcs.push({
    x: contactX,
    y: contactY,
    angleStart: arcAngle - 1.15,
    angleEnd: arcAngle + 1.15,
    radius: beatIdx === 5 ? 64 : 44,
    thickness: beatIdx === 5 ? 9 : 6,
    color: beatIdx % 2 === 0 ? f.spec.accentColor : f.spec.secondaryColor,
    coreColor: '#ffffff',
    life: 11,
    maxLife: 11,
    facing: f.facing,
  });
  spawnHitSparks(
    ctx,
    foe.x + (Math.random() - 0.5) * 14,
    foe.y - 12 + (Math.random() - 0.5) * 14,
    beatIdx % 2 === 0 ? '#fde047' : f.spec.secondaryColor,
    beatIdx === 5 ? 28 : 16
  );
  if (foe.y >= groundY - 8) {
    spawnDust(ctx, foe.x, groundY + 18, f.facing);
  }
  if (f.id === 'sol') {
    foe.cinderMarks = Math.min(5, beatIdx + 1);
  }
}

export function stepUltimateAct3(
  ctx: EngineContext,
  f: FighterState,
  foe: FighterState,
  bounds: UltimateBounds
): void {
  const af = f.actionFrame;
  const { minSafeX, maxSafeX, groundY } = bounds;
  const beatIdx = Math.floor((af - 127) / 30);
  const beatFrame = (af - 127) % 30;
  const beatT = beatFrame / 29;
  const dir = f.anchorX >= f.x ? 1 : -1;

  foe.vx = 0;
  foe.vy = 0;
  foe.action = 'hitstun';
  foe.hitstunFrames = 60;

  applyAct3BeatHit(ctx, f, foe, beatIdx, beatFrame, groundY);

  if (beatIdx === 0) {
    f.ultStageLabel = `${f.spec.ultimateName} // I. GUARD CRUSH`;
    f.ultPose = 'ult_gut_strike';
    foe.ultPose = 'ult_victim_gut';
    const foeTx = Math.max(minSafeX + 30, Math.min(maxSafeX - 30, f.anchorX + f.facing * beatT * 26));
    moveSmooth(foe, foeTx, groundY, 12 + beatT * 14, 0.32);
    moveSmooth(f, foeTx - f.facing * (22 - beatT * 4), groundY, -38 + beatT * 18, 0.32);
  } else if (beatIdx === 1) {
    f.ultStageLabel = `${f.spec.ultimateName} // II. BLITZ CROSS`;
    f.ultPose = 'ult_flank_slash';
    foe.ultPose = 'ult_victim_recoil';
    f.facing = -dir as 1 | -1;
    const foeTx = f.anchorX + Math.sin(beatT * Math.PI) * 14;
    const foeTy =
      f.id === 'raijin' || f.id === 'kuro' ? groundY - Math.sin(beatT * Math.PI) * 18 : groundY;
    moveSmooth(foe, foeTx, foeTy, -12, 0.28);
    moveSmooth(f, foeTx + dir * (28 - beatT * 10), foeTy, 32 - beatT * 56, 0.26);
    if (beatFrame % 5 === 0) spawnAfterimage(ctx, f, f.spec.accentColor);
  } else if (beatIdx === 2) {
    f.ultStageLabel = `${f.spec.ultimateName} // III. RELENTLESS BARRAGE`;
    f.ultPose = 'ult_rapid_flurry';
    foe.ultPose = beatFrame % 12 < 6 ? 'ult_victim_gut' : 'ult_victim_recoil';
    const sideOsc = Math.sin(beatFrame * 0.36);
    const foeTx = f.anchorX + sideOsc * 5;
    moveSmooth(foe, foeTx, groundY - 6, 0, 0.3);
    moveSmooth(
      f,
      foeTx - f.facing * 22,
      groundY - (f.id === 'velo' || f.id === 'kuro' ? Math.abs(sideOsc) * 10 : 0),
      -24 + sideOsc * 14,
      0.3
    );
    if (f.id === 'jin') {
      f.puppetActive = true;
      f.puppetX += (foe.x + f.facing * 26 - f.puppetX) * 0.3;
      f.puppetY += (foe.y - 14 - f.puppetY) * 0.3;
      f.puppetAttackTimer = 10;
    }
  } else if (beatIdx === 3) {
    f.ultStageLabel = `${f.spec.ultimateName} // IV. SUPERSONIC PURSUIT`;
    f.ultPose = 'ult_flank_slash';
    foe.ultPose = 'ult_victim_recoil';
    const chaseX = f.anchorX - f.facing * 42 + f.facing * beatT * 84;
    const foeTx = Math.max(minSafeX + 28, Math.min(maxSafeX - 28, chaseX));
    const foeTy = groundY - Math.sin(beatT * Math.PI) * 24;
    const foeTz = 24 - beatT * 42;
    moveSmooth(foe, foeTx, foeTy, foeTz, 0.28);
    moveSmooth(f, foeTx - f.facing * 22, foeTy, foeTz - 16, 0.26);
    if (beatFrame % 4 === 0) spawnAfterimage(ctx, f, f.spec.secondaryColor);
  } else if (beatIdx === 4) {
    f.ultStageLabel = `${f.spec.ultimateName} // V. EARTHSHAKER SLAM`;
    f.ultPose = 'ult_heavy_slam';
    foe.ultPose = 'ult_victim_ground';
    const slamDrop = Math.min(1, beatT * 1.85);
    const foeTy = groundY - (1 - slamDrop) * 38;
    moveSmooth(foe, f.anchorX, foeTy, 0, 0.32);
    moveSmooth(f, f.anchorX - f.facing * 18, foeTy - (1 - slamDrop) * 14, -22, 0.3);
    if (beatFrame === 14) {
      ctx.sound.playWallSlam(f.id, 1.4, 0);
      ctx.shakeMag = 18;
      spawnDust(ctx, f.anchorX, groundY + 18, 0);
    }
  } else {
    f.ultStageLabel = `${f.spec.ultimateName} // VI. SKYWARD LAUNCHER`;
    f.ultPose = 'ult_launcher';
    foe.ultPose = 'ult_victim_air';
    const launchT = Math.max(0, (beatFrame - 2) / 27);
    const easeUp = 1 - Math.pow(1 - launchT, 2.2);
    const foeTy = groundY - easeUp * 142;
    moveSmooth(foe, f.anchorX, foeTy, easeUp * 22, 0.32);
    const pursueT = Math.max(0, (beatFrame - 7) / 22);
    moveSmooth(
      f,
      f.anchorX - f.facing * (16 - launchT * 8),
      groundY - Math.pow(pursueT, 1.4) * 124,
      -28,
      0.28
    );
    if (beatFrame % 4 === 0) spawnAfterimage(ctx, f, '#fde047');
  }

  updateScarf(ctx, f);
}
