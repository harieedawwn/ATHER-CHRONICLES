// Visual effect aging (afterimages, slash arcs, shockwaves, particles, callouts) and 5-Act 2.5D Ultimate Camera Director.
// Exports: updateParticlesAndCameraOnly.
// Depends on: @/game/types, ./context.

import { FighterState } from '@/game/types';
import { EngineContext } from './context';

function stepVisualEffects(ctx: EngineContext): void {
  for (let i = ctx.afterimages.length - 1; i >= 0; i--) {
    ctx.afterimages[i].alpha -= 0.065;
    if (ctx.afterimages[i].alpha <= 0) ctx.afterimages.splice(i, 1);
  }

  for (let i = ctx.slashArcs.length - 1; i >= 0; i--) {
    ctx.slashArcs[i].life--;
    if (ctx.slashArcs[i].life <= 0) ctx.slashArcs.splice(i, 1);
  }

  for (let i = ctx.shockwaves.length - 1; i >= 0; i--) {
    ctx.shockwaves[i].life--;
    if (ctx.shockwaves[i].life <= 0) ctx.shockwaves.splice(i, 1);
  }

  for (let i = ctx.particles.length - 1; i >= 0; i--) {
    const p = ctx.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.drag;
    p.vy *= p.drag;
    if (p.spin) {
      p.angle = (p.angle ?? 0) + p.spin;
    }
    p.life--;
    if (p.life <= 0) ctx.particles.splice(i, 1);
  }

  for (let i = ctx.callouts.length - 1; i >= 0; i--) {
    const c = ctx.callouts[i];
    c.y += c.vy;
    c.vy *= 0.92;
    c.life--;
    if (c.life <= 0) ctx.callouts.splice(i, 1);
  }
}

interface CameraTarget {
  targetX: number;
  targetY: number;
  targetZoom: number;
  targetAngle: number;
  targetYaw: number;
  targetPitch: number;
  camLerpSpeed: number;
}

function computeUltimateCameraTarget(
  ctx: EngineContext,
  ultFighter: FighterState,
  ultVictim: FighterState,
  f1: FighterState,
  f2: FighterState
): CameraTarget {
  const uf = ultFighter.actionFrame;
  let targetX = 0;
  let targetY = 55;
  let targetZoom = 1.08;
  let targetAngle = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let camLerpSpeed = 0.24;

  if (uf <= 60) {
    ctx.ultBackdropMode = uf >= 28 ? 'speedlines' : 'stage25d';
    targetX = ultFighter.x + ultFighter.facing * 14;
    targetY = ultFighter.y - 22;
    targetZoom = uf < 30 ? 1.68 : 1.92;
    targetYaw = (uf < 30 ? -0.42 : 0.35) * ultFighter.facing;
    targetPitch = -0.28;
    targetAngle = (uf < 30 ? -0.05 : 0.04) * ultFighter.facing;
  } else if (uf <= 126) {
    ctx.ultBackdropMode = 'stage25d';
    targetX = ultFighter.x * 0.65 + ultFighter.anchorX * 0.35;
    targetY = ultFighter.y - 24;
    targetZoom = 1.24;
    targetYaw = 0.26 * ultFighter.facing;
    targetPitch = -0.1;
    targetAngle = 0.025 * ultFighter.facing;
  } else if (ultFighter.moveHitConnected) {
    if (uf <= 186) {
      const isSecondBeat = uf >= 157;
      ctx.ultBackdropMode =
        (uf >= 127 && uf <= 133) || (uf >= 157 && uf <= 162) ? 'impact_bw' : 'stage25d';
      targetX = (ultFighter.x + ultVictim.x) * 0.5 + (isSecondBeat ? 12 : -14) * ultFighter.facing;
      targetY = (ultFighter.y + ultVictim.y) * 0.5 - 20;
      targetZoom = isSecondBeat ? 1.68 : 1.84;
      targetYaw = (isSecondBeat ? 0.58 : -0.54) * ultFighter.facing;
      targetPitch = isSecondBeat ? 0.14 : -0.22;
      targetAngle = (isSecondBeat ? 0.045 : -0.05) * ultFighter.facing;
      camLerpSpeed = 0.28;
    } else if (uf <= 246) {
      const isChaseBeat = uf >= 217;
      ctx.ultBackdropMode = isChaseBeat ? 'speedlines' : 'stage25d';
      const orbitPhase = (uf - 187) * 0.075;
      targetX = (ultFighter.x + ultVictim.x) * 0.5;
      targetY = (ultFighter.y + ultVictim.y) * 0.5 - 22;
      targetZoom = isChaseBeat ? 1.54 : 1.92;
      targetYaw = Math.sin(orbitPhase) * 0.72 * ultFighter.facing;
      targetPitch = isChaseBeat ? 0.24 : -0.3;
      targetAngle = Math.cos(orbitPhase) * 0.04;
      camLerpSpeed = 0.26;
    } else if (uf <= 306) {
      const isLauncher = uf >= 277;
      ctx.ultBackdropMode =
        uf >= 277 && uf <= 284 ? 'impact_bw' : isLauncher ? 'speedlines' : 'stage25d';
      targetX = (ultFighter.x + ultVictim.x) * 0.5;
      targetY = (ultFighter.y + ultVictim.y) * 0.5 - (isLauncher ? 28 : 18);
      targetZoom = isLauncher ? 1.48 : 1.72;
      targetYaw = (isLauncher ? -0.38 : 0.48) * ultFighter.facing;
      targetPitch = isLauncher ? -0.52 : 0.28;
      targetAngle = (isLauncher ? -0.05 : 0.04) * ultFighter.facing;
      camLerpSpeed = 0.3;
    } else if (uf <= 375) {
      const inClimaxPose = uf >= 342;
      ctx.ultBackdropMode = inClimaxPose ? 'speedlines' : 'stage25d';
      if (
        inClimaxPose &&
        (ultFighter.id === 'kenji' ||
          ultFighter.id === 'chrono' ||
          ultFighter.id === 'nyx' ||
          ultFighter.id === 'jin')
      ) {
        targetX = ultFighter.x * 0.72 + ultVictim.x * 0.28;
        targetY = ultFighter.y * 0.72 + ultVictim.y * 0.28 - 18;
        targetZoom = 1.96;
        targetYaw = -0.44 * ultFighter.facing;
        targetPitch = -0.25;
        targetAngle = -0.04 * ultFighter.facing;
      } else {
        targetX = (ultFighter.x + ultVictim.x) * 0.5;
        targetY = (ultFighter.y + ultVictim.y) * 0.5 - 16;
        targetZoom = inClimaxPose ? 1.78 : 1.46;
        targetYaw = Math.sin((uf - 307) * 0.06) * 0.55;
        targetPitch = inClimaxPose ? 0.38 : -0.35;
        targetAngle = 0.035 * ultFighter.facing;
      }
      camLerpSpeed = 0.25;
    } else if (uf <= 425) {
      if (uf <= 388) {
        ctx.ultBackdropMode = uf % 4 < 2 ? 'impact_bw' : 'climax_flash';
      } else {
        ctx.ultBackdropMode = 'speedlines';
      }
      targetX = ultFighter.anchorX;
      targetY = ultFighter.anchorY - 24;
      targetZoom = uf <= 388 ? 1.55 : 1.05;
      targetYaw = (uf <= 388 ? 0.25 : 0.08) * ultFighter.facing;
      targetPitch = uf <= 388 ? -0.18 : 0.12;
      targetAngle = 0;
      camLerpSpeed = 0.32;
    } else {
      targetX = (f1.x + f2.x) * 0.5;
      targetY = (f1.y + f2.y) * 0.5 - 24;
    }
  } else {
    targetX = (f1.x + f2.x) * 0.5;
    targetY = (f1.y + f2.y) * 0.5 - 24;
  }

  return { targetX, targetY, targetZoom, targetAngle, targetYaw, targetPitch, camLerpSpeed };
}

export function updateParticlesAndCameraOnly(ctx: EngineContext): void {
  stepVisualEffects(ctx);

  const f1 = ctx.fighters[0];
  const f2 = ctx.fighters[1];
  const active1 = f1.action !== 'ko_respawn';
  const active2 = f2.action !== 'ko_respawn';

  let targetX = 0;
  let targetY = 55;
  let targetZoom = 1.08;
  let targetAngle = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let camLerpSpeed = 0.11;
  ctx.ultBackdropMode = 'none';

  const ultFighter = f1.action === 'ultimate' ? f1 : f2.action === 'ultimate' ? f2 : null;
  const ultVictim = ultFighter ? (ultFighter.slot === 0 ? f2 : f1) : null;
  const tauntFighter = f1.action === 'taunt' ? f1 : f2.action === 'taunt' ? f2 : null;

  if (ultFighter && ultVictim) {
    const ultCam = computeUltimateCameraTarget(ctx, ultFighter, ultVictim, f1, f2);
    targetX = ultCam.targetX;
    targetY = ultCam.targetY;
    targetZoom = ultCam.targetZoom;
    targetAngle = ultCam.targetAngle;
    targetYaw = ultCam.targetYaw;
    targetPitch = ultCam.targetPitch;
    camLerpSpeed = ultCam.camLerpSpeed;
  } else if (tauntFighter) {
    targetX = (f1.x + f2.x) * 0.5 + (tauntFighter.x - (f1.x + f2.x) * 0.5) * 0.35;
    targetY = tauntFighter.y - 24;
    targetZoom = 1.22;
    targetAngle = tauntFighter.facing * 0.028;
  } else if (active1 && active2) {
    targetX = (f1.x + f2.x) * 0.5 + (f1.vx + f2.vx) * 2.0;
    targetY = (f1.y + f2.y) * 0.5 - 24;
    const dist = Math.hypot(f1.x - f2.x, f1.y - f2.y);
    const minZoom = ctx.stage.wallRight > 340 ? 0.62 : 0.76;
    targetZoom = Math.max(minZoom, Math.min(1.26, 1.32 - dist / 540));
    if (ctx.timeDilation < 0.5) {
      targetZoom = Math.max(targetZoom, 1.24);
    }
  } else if (active1) {
    targetX = f1.x * 0.65;
    targetY = f1.y - 25;
    targetZoom = 1.05;
  } else if (active2) {
    targetX = f2.x * 0.65;
    targetY = f2.y - 25;
    targetZoom = 1.05;
  }

  const maxCamX = Math.max(240, ctx.stage.wallRight - 130);
  const minCamY = ultFighter ? -260 : ctx.stage.id === 'dojo' ? -210 : -155;
  targetX = Math.max(-maxCamX, Math.min(maxCamX, targetX));
  targetY = Math.max(minCamY, Math.min(115, targetY));

  ctx.camX += (targetX - ctx.camX) * camLerpSpeed;
  ctx.camY += (targetY - ctx.camY) * camLerpSpeed;
  ctx.camZoom += (targetZoom - ctx.camZoom) * (ultFighter ? 0.18 : 0.09);
  ctx.camAngle += (targetAngle - ctx.camAngle) * 0.16;
  ctx.camYaw += (targetYaw - ctx.camYaw) * 0.18;
  ctx.camPitch += (targetPitch - ctx.camPitch) * 0.18;

  if (ctx.shakeMag > 0.2) {
    ctx.shakeX = (Math.random() * 2 - 1) * ctx.shakeMag;
    ctx.shakeY = (Math.random() * 2 - 1) * ctx.shakeMag;
    ctx.shakeMag *= 0.78;
  } else {
    ctx.shakeMag = 0;
    ctx.shakeX = 0;
    ctx.shakeY = 0;
  }
}
