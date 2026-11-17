import { blendPoseArc, sampleAttack, locomotionPose, hitShake } from './poseKit';
import {
  Fx,
  Trail,
  ChromaticSplit,
  CameraKick,
  energyRamp,
  drawGlow,
  drawInkSplat,
  drawImpactFrame,
  hexToRgb,
  drawShockRing,
  drawStreak,
  drawStarFlare,
  drawArcSweep,
  vrand,
} from './vfxKit';
import { getAuthoredMove } from './movePoses';
import type { VfxEvent } from './engine/context';
import {
  Afterimage,
  DelayedSlash,
  FighterAction,
  FighterState,
  FloatingCallout,
  MoveData,
  MoveKey,
  Particle,
  PortalPair,
  Projectile,
  RiftSeal,
  ShockwaveRing,
  SlashArc,
  StageSpec,
  StasisField,
  WeaponType,
} from './types';
import { resolvePlatformAtTick } from './stages';

export const RENDER_W = 800;
export const RENDER_H = 450;

interface Vec2 {
  x: number;
  y: number;
}

interface SkeletonPose {
  hip: Vec2;
  spine: Vec2;
  chest: Vec2;
  head: Vec2;
  shoulderF: Vec2;
  elbowF: Vec2;
  handF: Vec2;
  shoulderB: Vec2;
  elbowB: Vec2;
  handB: Vec2;
  kneeF: Vec2;
  footF: Vec2;
  kneeB: Vec2;
  footB: Vec2;
  weaponAngle: number;
  weaponReach: number;
  offhandWeaponAngle?: number;
  sheathed?: boolean;
  smearAlpha?: number;
  smearSpan?: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function easeOutExpo(t: number): number {
  const c = clamp01(t);
  return c >= 1 ? 1 : 1 - Math.pow(2, -10 * c);
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function blendPose(a: SkeletonPose, b: SkeletonPose, t: number): SkeletonPose {
  return blendPoseArc(a, b, t);
}

// Staggered Kinetic-Chain & Circular Arc Swing Blender (Hip -> Torso -> Shoulder -> Elbow -> Hand/Weapon)
function blendStrikeSwingPose(windup: SkeletonPose, strike: SkeletonPose, t: number): SkeletonPose {
  const k = clamp01(t);
  // Core (hips & spine) leads the kinetic chain early; weapon arm whips through with an arc
  const bodyK = easeOutCubic(Math.min(1, k * 1.18));
  const armK = easeInOutCubic(k);
  const arcBell = Math.sin(k * Math.PI);
  const dy = strike.handF.y - windup.handF.y;
  const arcLiftY = dy < -4 ? -arcBell * 4.5 : dy > 4 ? -arcBell * 5.2 : -arcBell * 3.4;
  const arcOutX = arcBell * 3.8;

  const baseBlend = blendPose(windup, strike, armK);
  return {
    ...baseBlend,
    hip: lerpVec(windup.hip, strike.hip, bodyK),
    spine: lerpVec(windup.spine, strike.spine, bodyK),
    chest: lerpVec(windup.chest, strike.chest, bodyK),
    head: lerpVec(windup.head, strike.head, bodyK),
    kneeF: lerpVec(windup.kneeF, strike.kneeF, bodyK),
    footF: lerpVec(windup.footF, strike.footF, bodyK),
    kneeB: lerpVec(windup.kneeB, strike.kneeB, bodyK),
    footB: lerpVec(windup.footB, strike.footB, bodyK),
    shoulderF: {
      x: baseBlend.shoulderF.x + arcOutX * 0.35,
      y: baseBlend.shoulderF.y + arcLiftY * 0.35,
    },
    elbowF: {
      x: baseBlend.elbowF.x + arcOutX * 0.7,
      y: baseBlend.elbowF.y + arcLiftY * 0.75,
    },
    handF: {
      x: baseBlend.handF.x + arcOutX,
      y: baseBlend.handF.y + arcLiftY,
    },
  };
}

export interface RenderSceneData {
  stage: StageSpec;
  fighters: [FighterState, FighterState];
  projectiles: Projectile[];
  riftSeals: RiftSeal[];
  stasisFields?: StasisField[];
  portals?: PortalPair[];
  delayedSlashes: DelayedSlash[];
  afterimages: Afterimage[];
  slashArcs: SlashArc[];
  shockwaves: ShockwaveRing[];
  particles: Particle[];
  callouts: FloatingCallout[];
  vfxEvents?: VfxEvent[];
  camX: number;
  camY: number;
  camZoom: number;
  camAngle?: number;
  camYaw?: number;
  camPitch?: number;
  ultBackdropMode?: 'none' | 'stage25d' | 'speedlines' | 'impact_bw' | 'climax_flash';
  shakeX: number;
  shakeY: number;
  impactFrames: number;
  impactInverted: boolean;
  timeDilation?: number;
  showHitboxes: boolean;
  tick: number;
}

export class HDPixelRenderer {
  private buffer: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private smoothedPoses = new Map<
    number,
    { pose: SkeletonPose; x: number; y: number; facing: 1 | -1; tick: number }
  >();
  private weaponTrails = new Map<number, { trail: Trail; lastTick: number; weaponType: WeaponType }>();
  private projectileTrails = new Map<number, { trail: Trail; lastTick: number }>();
  private inkSplats: {
    x: number;
    y: number;
    r: number;
    age: number;
    life: number;
    color: string;
    seed: number;
    isBlink?: boolean;
  }[] = [];
  private fx = new Fx();
  private chromaticSplit = new ChromaticSplit();
  private chromaticFrames = 0;
  private cameraKick = new CameraKick();
  private lastFxTick = -1;
  private lastChargeEmitTick = -1;

  constructor() {
    this.buffer = document.createElement('canvas');
    this.buffer.width = RENDER_W;
    this.buffer.height = RENDER_H;
    const ctx = this.buffer.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.bctx = ctx;
    this.bctx.imageSmoothingEnabled = false;
  }

  public render(targetCanvas: HTMLCanvasElement, scene: RenderSceneData): void {
    const ctx = this.bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    if (scene.vfxEvents && scene.vfxEvents.length > 0) {
      for (const ev of scene.vfxEvents) {
        if (ev.type === 'dash') {
          this.fx.pool.emit({
            x: ev.x,
            y: ev.y,
            count: 8,
            angle: ev.dir + Math.PI,
            spread: 0.35,
            speed: [5, 11],
            life: [7, 13],
            size: [1.5, 2.8],
            drag: 0.88,
            kind: 'streak',
            ramp: energyRamp(ev.color),
            stretch: 1.9,
          });
        } else if (ev.type === 'blink') {
          const ramp = energyRamp(ev.color);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.fx.pool.emit({
              x: ev.x + Math.cos(a) * 26,
              y: ev.y + Math.sin(a) * 26,
              count: 1,
              angle: a + Math.PI,
              spread: 0.15,
              speed: [3.5, 5.5],
              life: [6, 9],
              size: [1.4, 2.4],
              drag: 0.92,
              kind: 'streak',
              ramp,
              stretch: 1.7,
            });
          }
          this.fx.pool.emit({
            x: ev.x,
            y: ev.y,
            count: 10,
            angle: 0,
            spread: Math.PI * 2,
            speed: [4, 9],
            life: [8, 14],
            size: [1.5, 2.6],
            drag: 0.89,
            kind: 'streak',
            ramp,
            stretch: 1.8,
          });
          this.inkSplats.push({
            x: ev.x,
            y: ev.y,
            r: 22,
            age: 0,
            life: 10,
            color: ev.color,
            seed: ev.seed ?? scene.tick,
            isBlink: true,
          });
        } else if (ev.type === 'ko') {
          this.fx.impact({
            x: ev.x,
            y: ev.y,
            dir: ev.dir,
            power: 1.0,
            color: ev.color,
          });
          this.chromaticFrames = 6;
          this.cameraKick.hit(1.0, ev.dir);
          this.inkSplats.push({
            x: ev.x,
            y: ev.y,
            r: 34,
            age: 0,
            life: 24,
            color: ev.color,
            seed: ev.seed ?? scene.tick,
          });
        } else {
          this.fx.impact({
            x: ev.x,
            y: ev.y,
            dir: ev.dir,
            power: ev.power,
            color: ev.color,
            ground: ev.ground,
          });
          if (ev.power > 0.75 && !ev.ground) {
            this.chromaticFrames = 5;
            this.cameraKick.hit(ev.power, ev.dir);
          }
        }
      }
      scene.vfxEvents.length = 0;
    }
    if (scene.tick !== this.lastFxTick) {
      this.lastFxTick = scene.tick;
      this.fx.update();
      this.cameraKick.step();
      if (this.chromaticFrames > 0) this.chromaticFrames--;
      for (const s of this.inkSplats) s.age++;
      this.inkSplats = this.inkSplats.filter((s) => s.age < s.life);
    }

    const has25DUltBackdrop =
      scene.ultBackdropMode !== undefined && scene.ultBackdropMode !== 'none';

    // 1. Background & Parallax Stage (or Full 2.5D Perspective Stage / Speed-Line Backdrop during Ultimates)
    if (scene.impactFrames > 0) {
      this.drawImpactBackground(ctx, scene.impactInverted, scene.tick);
    } else if (has25DUltBackdrop) {
      this.drawParallaxStage(ctx, scene);
      this.drawUltimate25DBackdrop(ctx, scene);
    } else {
      this.drawParallaxStage(ctx, scene);
    }

    // 2. World-space Camera Transform (with 2.5D camera banking, zoom & directional CameraKick)
    const kick = this.cameraKick.offset;
    ctx.save();
    ctx.translate(
      Math.round(RENDER_W * 0.5 + scene.shakeX + kick.ox),
      Math.round(RENDER_H * 0.5 + scene.shakeY + kick.oy)
    );
    if (scene.camAngle) {
      ctx.rotate(scene.camAngle);
    }
    ctx.scale(scene.camZoom * kick.zoom, scene.camZoom * kick.zoom);
    ctx.translate(-scene.camX, -scene.camY);

    // 3. Stage Platforms, Jump Pads & Spatial Boundaries (hidden during aerial sky-chase speedlines for pure 2.5D clarity)
    if (scene.ultBackdropMode !== 'speedlines' && scene.ultBackdropMode !== 'impact_bw') {
      this.drawPlatforms(ctx, scene.stage, scene.impactFrames > 0, scene.tick);
    }

    // 4. Ground / Anchor / Rift Seals / Stasis Fields / Portals
    for (const f of scene.fighters) {
      if (f.anchorActive && f.id === 'kuro') {
        this.drawKuroAnchor(ctx, f.anchorX, f.anchorY, f.spec.accentColor, scene.tick);
      }
    }
    if (scene.stasisFields) {
      for (const sf of scene.stasisFields) {
        this.drawStasisField(ctx, sf, scene.tick);
      }
    }
    if (scene.portals) {
      for (const pr of scene.portals) {
        this.drawPortalPair(ctx, pr, scene.tick);
      }
    }
    this.drawRaijinRodNetwork(ctx, scene.riftSeals, scene.tick);
    for (const seal of scene.riftSeals) {
      this.drawRiftSeal(ctx, seal, scene.tick);
    }

    // 5. Afterimages
    for (const ghost of scene.afterimages) {
      this.drawGhostStickman(ctx, ghost);
    }

    // 6. Kenji Observation Foresight Rings & Ink / Blink Splat Underlays
    this.drawObservationForesight(ctx, scene.fighters, scene.tick);
    this.drawInkAndBlinkSplats(ctx);

    // 7. Fighters (Sorted by 2.5D Z-depth so foreground fighter renders cleanly in front of background fighter!)
    const sortedFighters = [...scene.fighters].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
    for (const f of sortedFighters) {
      this.drawFighter(
        ctx,
        f,
        scene.impactFrames > 0 || scene.ultBackdropMode === 'impact_bw',
        scene.impactInverted,
        scene.tick
      );
    }

    // 8. Delayed Anime Slash Cuts (Velo)
    for (const ds of scene.delayedSlashes) {
      this.drawDelayedSlash(ctx, ds, scene.tick);
    }

    // 9. Projectiles
    for (const p of scene.projectiles) {
      this.drawProjectile(ctx, p, scene.tick);
    }

    // 10. Tapered Crescent Slash Arcs & Shockwave Rings
    for (const arc of scene.slashArcs) {
      this.drawSlashArc(ctx, arc);
    }
    for (const sw of scene.shockwaves) {
      this.drawShockwave(ctx, sw);
    }

    // 10.5. Crystal-Clear 2.5D Martial & Weapon Ultimate FX (No obscuring circles or dark filters!)
    this.drawUltimate25DActionFX(
      ctx,
      scene.fighters,
      scene.tick,
      scene.camYaw ?? 0,
      scene.camPitch ?? 0
    );

    // 11. Particles (Sparks, 4-Point Flares, Debris, Wind Cones) + Layered vfxKit Impact Stack
    for (const pt of scene.particles) {
      this.drawParticle(ctx, pt);
    }
    this.fx.draw(ctx);

    // 12. Optional Training Hitboxes (Fighters + Stage Platforms & Jump Pads)
    if (scene.showHitboxes) {
      this.drawDebugBoxes(ctx, scene.fighters, scene.stage, scene.tick);
    }

    // 13. Floating Anime Callouts
    for (const c of scene.callouts) {
      const alpha = Math.min(1, c.life / (c.maxLife * 0.35));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 13px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#05070d';
      ctx.fillText(c.text, Math.round(c.x) + 1, Math.round(c.y) + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, Math.round(c.x), Math.round(c.y));
      ctx.restore();
    }

    ctx.restore();

    // 14. Cinematic Letterbox / Speed Lines on Impact, Ultimate Cut-In, or Time-Dilation Slow-Mo
    this.drawUltimateCutsceneOverlay(ctx, scene.fighters, scene.tick);
    if (this.fx.impactFrameFrames > 0) {
      drawImpactFrame(ctx, RENDER_W, RENDER_H, this.fx.impactFrameFrames);
    }
    if (this.chromaticFrames > 0) {
      this.chromaticSplit.apply(ctx, this.buffer, 4);
    }
    if (scene.impactFrames > 0) {
      this.drawImpactSpeedLines(ctx, scene.impactInverted, scene.tick);
    } else if (scene.timeDilation !== undefined && scene.timeDilation < 0.85) {
      this.drawTimeDilationVignette(ctx, scene.timeDilation, scene.tick);
    }

    // 15. Blit crisp HD-Pixel buffer onto display canvas
    const tctx = targetCanvas.getContext('2d');
    if (tctx) {
      tctx.imageSmoothingEnabled = false;
      tctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      tctx.drawImage(this.buffer, 0, 0, targetCanvas.width, targetCanvas.height);
    }
  }

  private drawImpactBackground(
    ctx: CanvasRenderingContext2D,
    inverted: boolean,
    tick: number
  ): void {
    ctx.fillStyle = inverted ? '#f8fafc' : '#05070d';
    ctx.fillRect(0, 0, RENDER_W, RENDER_H);

    ctx.save();
    ctx.translate(RENDER_W * 0.5, RENDER_H * 0.5);
    ctx.strokeStyle = inverted ? '#090d16' : '#f8fafc';
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + (tick % 3) * 0.06;
      ctx.lineWidth = i % 3 === 0 ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 55, Math.sin(angle) * 55);
      ctx.lineTo(Math.cos(angle) * 520, Math.sin(angle) * 520);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawImpactSpeedLines(ctx: CanvasRenderingContext2D, inverted: boolean, tick: number): void {
    ctx.save();
    ctx.strokeStyle = inverted ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const y = (i * 31 + tick * 23) % RENDER_H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(110 + ((i * 29) % 85), y);
      ctx.moveTo(RENDER_W, y + 9);
      ctx.lineTo(RENDER_W - (110 + ((i * 19) % 85)), y + 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTimeDilationVignette(
    ctx: CanvasRenderingContext2D,
    dilation: number,
    tick: number
  ): void {
    const strength = clamp01((1 - dilation) * 1.15);
    ctx.save();
    // Subtle anime letterbox bars & radial focus lines
    const barH = Math.round(14 * strength);
    ctx.fillStyle = `rgba(3, 5, 11, ${0.72 * strength})`;
    ctx.fillRect(0, 0, RENDER_W, barH);
    ctx.fillRect(0, RENDER_H - barH, RENDER_W, barH);

    ctx.translate(RENDER_W * 0.5, RENDER_H * 0.5);
    ctx.strokeStyle = `rgba(226, 232, 240, ${0.24 * strength})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + tick * 0.012;
      const rIn = 185 + ((i * 19) % 35);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * rIn, Math.sin(ang) * rIn);
      ctx.lineTo(Math.cos(ang) * 460, Math.sin(ang) * 460);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawUltimate25DBackdrop(
    ctx: CanvasRenderingContext2D,
    scene: RenderSceneData
  ): void {
    const caster = scene.fighters.find((f) => f.action === 'ultimate');
    if (!caster) return;
    const mode = scene.ultBackdropMode ?? 'stage25d';
    const yaw = scene.camYaw ?? 0;
    const pitch = scene.camPitch ?? 0;
    const tick = scene.tick;
    const accent = caster.spec.accentColor;
    const secondary = caster.spec.secondaryColor;

    ctx.save();

    if (mode === 'impact_bw') {
      // High-Contrast Anime Impact Frame Backdrop (Behind fighters, 100% razor-sharp silhouette readability)
      const inv = tick % 4 < 2;
      ctx.fillStyle = inv ? '#f8fafc' : '#05070d';
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);

      ctx.translate(RENDER_W * 0.5 + yaw * 80, RENDER_H * 0.45 + pitch * 60);
      ctx.strokeStyle = inv ? '#05070d' : accent;
      for (let i = 0; i < 44; i++) {
        const ang = (i / 44) * Math.PI * 2 + (tick % 3) * 0.04;
        ctx.lineWidth = i % 3 === 0 ? 4.2 : 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 48, Math.sin(ang) * 48);
        ctx.lineTo(Math.cos(ang) * 540, Math.sin(ang) * 540);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (mode === 'speedlines') {
      // Act IV Aerial Sky-Chase & Climax Pose: Dynamic 2.5D Diagonal Speed-Line Tunnel
      const skyGrad = ctx.createLinearGradient(0, 0, 0, RENDER_H);
      skyGrad.addColorStop(0, '#040711');
      skyGrad.addColorStop(0.5, '#0b1329');
      skyGrad.addColorStop(1, '#111c38');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);

      // Perspective vanishing point shifts dynamically with 2.5D camYaw & camPitch
      const vx = RENDER_W * 0.5 - yaw * 240;
      const vy = RENDER_H * 0.36 + pitch * 190;

      // Subtle glowing horizon core in the distance (never obscuring foreground fighters)
      const rad = ctx.createRadialGradient(vx, vy, 8, vx, vy, 340);
      rad.addColorStop(0, `${accent}44`);
      rad.addColorStop(0.55, `${secondary}22`);
      rad.addColorStop(1, 'rgba(4, 7, 17, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);

      // 3D Perspective Speed-Line Tunnel radiating from vanishing point
      for (let i = 0; i < 48; i++) {
        const ang = (i / 48) * Math.PI * 2 + yaw * 0.35;
        const speedOffset = ((tick * 28 + i * 47) % 380) + 75;
        const r1 = speedOffset;
        const r2 = speedOffset + 95 + (i % 3) * 35;
        ctx.strokeStyle = i % 3 === 0 ? accent : i % 2 === 0 ? secondary : '#e2e8f0';
        ctx.globalAlpha = i % 3 === 0 ? 0.55 : 0.28;
        ctx.lineWidth = i % 4 === 0 ? 2.6 : 1.3;
        ctx.beginPath();
        ctx.moveTo(vx + Math.cos(ang) * r1, vy + Math.sin(ang) * r1);
        ctx.lineTo(vx + Math.cos(ang) * r2, vy + Math.sin(ang) * r2);
        ctx.stroke();
      }

      // Receding 3D speed rings in depth
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) {
        const ringR = ((tick * 9 + r * 95) % 380) + 40;
        ctx.beginPath();
        ctx.ellipse(vx, vy, ringR * 1.35, ringR * 0.78, yaw * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    // Default 'stage25d' or 'climax_flash': Full 2.5D Perspective Stage Floor & Horizon Grid
    const horizonY = Math.round(
      Math.max(135, Math.min(340, RENDER_H * 0.56 - pitch * 210))
    );
    const vanishX = Math.round(RENDER_W * 0.5 - yaw * 310);

    // 1. Crisp 2.5D Perspective Floor Plane from horizonY to bottom of screen
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, RENDER_H);
    floorGrad.addColorStop(0, '#070b16');
    floorGrad.addColorStop(0.35, '#0d1528');
    floorGrad.addColorStop(1, '#050811');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, RENDER_W, RENDER_H - horizonY);

    // 2. Perspective Longitudinal 3D Floor Lines converging at (vanishX, horizonY)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, RENDER_W, RENDER_H - horizonY);
    ctx.clip();

    const numRays = 22;
    for (let i = -numRays; i <= numRays; i++) {
      const bottomX = vanishX + i * 95 + yaw * 180;
      ctx.strokeStyle = i % 4 === 0 ? accent : '#334155';
      ctx.globalAlpha = i % 4 === 0 ? 0.5 : 0.26;
      ctx.lineWidth = i % 4 === 0 ? 1.8 : 1.0;
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(bottomX, RENDER_H + 40);
      ctx.stroke();
    }

    // 3. Foreshortened Horizontal 3D Depth Tile Lines ($y(z)$ quadratic spacing)
    const floorH = RENDER_H - horizonY;
    for (let d = 1; d <= 12; d++) {
      const norm = d / 12;
      const perspT = Math.pow(norm, 1.85);
      const rowY = Math.round(horizonY + perspT * floorH);
      ctx.strokeStyle = d % 3 === 0 ? secondary : '#1e293b';
      ctx.globalAlpha = (0.18 + perspT * 0.42) * (mode === 'climax_flash' ? 1.3 : 1);
      ctx.lineWidth = d >= 9 ? 2.0 : 1.1;
      ctx.beginPath();
      ctx.moveTo(0, rowY);
      ctx.lineTo(RENDER_W, rowY);
      ctx.stroke();
    }

    // 4. 3D Parallax Background Monoliths / Stage Pillars rotating with camYaw
    for (let p = -4; p <= 4; p++) {
      if (p === 0) continue;
      const colX = Math.round(vanishX + p * 145 - yaw * 160);
      const colW = Math.round(14 + Math.abs(p) * 3);
      const colH = Math.round(68 + Math.abs(p) * 18);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(colX - colW * 0.5, horizonY - colH, colW, colH);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(colX - colW * 0.5, horizonY - colH, colW, colH);
    }
    ctx.restore();

    // 5. Glowing 2.5D Horizon Rim Line
    ctx.strokeStyle = mode === 'climax_flash' ? '#fde047' : accent;
    ctx.globalAlpha = mode === 'climax_flash' ? 0.85 : 0.65;
    ctx.lineWidth = mode === 'climax_flash' ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(RENDER_W, horizonY);
    ctx.stroke();

    ctx.restore();
  }

  private drawUltimate25DActionFX(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    tick: number,
    camYaw: number,
    camPitch: number
  ): void {
    for (let i = 0; i < 2; i++) {
      const f = fighters[i];
      if (f.action !== 'ultimate') continue;
      const foe = fighters[1 - i];
      const af = f.actionFrame;
      const accent = f.spec.accentColor;
      const secondary = f.spec.secondaryColor;

      ctx.save();
      try {
        // =====================================================================
        // ACT I (Frames 1..60): LOW-ANGLE 2.5D HERO STANCE & FLOOR SHOCK-RINGS
        // =====================================================================
        if (af <= 60) {
          const prog = af / 60;
          // 2.5D foreshortened ground pressure ellipses under caster's feet (NO screen-covering shapes!)
          for (let r = 0; r < 3; r++) {
            const ringProg = ((prog * 3 + r * 0.33) % 1);
            const rx = 18 + ringProg * 68;
            const ry = Math.max(4, rx * (0.26 + Math.abs(camPitch) * 0.25));
            ctx.strokeStyle = r % 2 === 0 ? accent : secondary;
            ctx.globalAlpha = (1 - ringProg) * 0.85;
            ctx.lineWidth = 2.2 - ringProg * 1.4;
            ctx.beginPath();
            ctx.ellipse(f.x, f.y + 2, rx, ry, camYaw * 0.2, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Vertical rising aura wisps around the fighter's boots & weapon only
          for (let w = 0; w < 6; w++) {
            const wx = f.x + Math.sin(tick * 0.25 + w * 1.1) * 24;
            const wy = f.y - ((tick * 4 + w * 13) % 52);
            ctx.strokeStyle = w % 2 === 0 ? '#ffffff' : accent;
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(wx, wy + 10);
            ctx.lineTo(wx, wy);
            ctx.stroke();
          }

          // At frame 32+: crisp weapon glint at hand position
          if (af >= 32) {
            const gx = f.x + f.facing * 16;
            const gy = f.y - 18;
            const glintR = 14 + Math.sin(af * 0.6) * 5;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(gx - glintR, gy);
            ctx.lineTo(gx + glintR, gy);
            ctx.moveTo(gx, gy - glintR);
            ctx.lineTo(gx, gy + glintR);
            ctx.stroke();
          }
          continue;
        }

        // =====================================================================
        // ACT II (Frames 61..126): HIGH-SPEED 2.5D PURSUIT RUSH CONE & STEP SPARKS
        // =====================================================================
        if (af <= 126 && !f.moveHitConnected) {
          // Aerodynamic Mach shock-cone at chest/weapon tip + ground dust trail
          const tipX = f.x + f.facing * 24;
          const tipY = f.y - 16;
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - f.facing * 44, tipY - 18);
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - f.facing * 44, tipY + 18);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          for (let s = 0; s < 5; s++) {
            const sx = f.x - f.facing * (12 + s * 16 + (tick % 9));
            const sy = f.y - 6 - (s % 3) * 11;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - f.facing * 22, sy);
            ctx.stroke();
          }
          continue;
        }

        if (!f.moveHitConnected) continue;

        // =====================================================================
        // ACT III (Frames 127..306): 6-BEAT MULTI-ANGLE 2.5D MARTIAL & WEAPON COMBO
        // =====================================================================
        if (af >= 127 && af <= 306) {
          const cFrame = af - 127;
          const beatIdx = Math.min(5, Math.floor(cFrame / 30));
          const bTick = cFrame - beatIdx * 30;

          // 2.5D Foreshortened Floor Shadow & Combat Ring under the clash point
          const midX = (f.x + foe.x) * 0.5;
          const floorY = Math.max(f.y, foe.y) + 2;
          if (bTick >= 7 && bTick <= 18) {
            const splatR = 16 + (bTick - 7) * 1.1;
            drawInkSplat(ctx, foe.x, foe.y - 10, splatR, beatIdx * 17 + 5, '#0b0b14');
            drawInkSplat(ctx, foe.x + f.facing * 4, foe.y - 13, splatR * 0.78, beatIdx * 17 + 11, accent);
          }
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.48;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(
            midX,
            floorY,
            56 + Math.sin(cFrame * 0.2) * 8,
            13 + Math.abs(camPitch) * 12,
            camYaw * 0.3,
            0,
            Math.PI * 2
          );
          ctx.stroke();

          // Beat 4 (Earth-Shattering Slam): Cracked 3D Floor Slabs erupting around victim
          if (beatIdx === 4 && bTick >= 10) {
            const slamAlpha = Math.max(0, 1 - (bTick - 10) / 20);
            ctx.save();
            ctx.globalAlpha = slamAlpha;
            for (let slab = -3; slab <= 3; slab++) {
              if (slab === 0) continue;
              const sx = foe.x + slab * 22;
              const sy = foe.y + 2 - Math.abs(slab) * 2;
              ctx.save();
              ctx.translate(sx, sy);
              ctx.rotate(slab * 0.18);
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(-9, -6, 18, 8);
              ctx.strokeStyle = accent;
              ctx.lineWidth = 1.4;
              ctx.strokeRect(-9, -6, 18, 8);
              ctx.restore();
            }
            ctx.restore();
          }

          // Beat 5 (Skyward Launcher): Vertical 2.5D Launch Pillar shooting straight up from floor
          if (beatIdx === 5 && bTick >= 9) {
            const pAlpha = Math.max(0, 1 - (bTick - 9) / 21);
            ctx.save();
            ctx.globalAlpha = pAlpha * 0.75;
            const beamW = 26 * (1 - (bTick - 9) / 28);
            ctx.fillStyle = accent;
            ctx.fillRect(foe.x - beamW * 0.5, foe.y - 160, beamW, 180);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(foe.x - beamW * 0.22, foe.y - 160, beamW * 0.44, 180);
            ctx.restore();
          }

          // Character-Specific Physical Martial / Weapon Prop Visuals during Act III
          this.drawCharacter25DComboProp(ctx, f, foe, beatIdx, bTick, camYaw);
          continue;
        }

        // =====================================================================
        // ACT IV (Frames 307..375): AERIAL SKY-CHASE & FOREGROUND CLIMAX POSE
        // =====================================================================
        if (af >= 307 && af <= 375) {
          const aFrame = af - 307;
          if (aFrame < 38) {
            // Aerial Sky-Chase: High-velocity slipstream ribbons trailing the ascending fighter
            ctx.strokeStyle = accent;
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 2.2;
            for (let r = -1; r <= 1; r += 2) {
              ctx.beginPath();
              ctx.moveTo(f.x + r * 12, f.y);
              ctx.lineTo(f.x + r * 26 - f.vx * 4, f.y + 68);
              ctx.stroke();
            }
          } else {
            // Foreground Climax Pose (f.z = -56): Crisp weapon/hand charge flare at foreground fighter
            const cProg = (aFrame - 38) / 31;
            const hx = f.x + f.facing * (f.id === 'kenji' ? -6 : 14);
            const hy = f.y - (f.id === 'kenji' ? 6 : 22);
            const flareR = 12 + Math.sin(cProg * Math.PI * 4) * 6 + cProg * 18;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(hx - flareR * 1.6, hy);
            ctx.lineTo(hx + flareR * 1.6, hy);
            ctx.moveTo(hx, hy - flareR * 1.6);
            ctx.lineTo(hx, hy + flareR * 1.6);
            ctx.stroke();

            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(hx, hy, flareR * 0.65, 0, Math.PI * 2);
            ctx.stroke();
          }
          continue;
        }

        // =====================================================================
        // ACT V (Frames 376..450): CATACLYSMIC 2.5D FINISHER IMPACT
        // =====================================================================
        if (af >= 376) {
          const fFrame = af - 376;
          this.drawCharacter25DFinisherFX(ctx, f, foe, fFrame, camYaw, camPitch);
        }
      } finally {
        ctx.restore();
      }
    }
  }

  private drawCharacter25DComboProp(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    foe: FighterState,
    beatIdx: number,
    bTick: number,
    camYaw: number
  ): void {
    const accent = f.spec.accentColor;
    const secondary = f.spec.secondaryColor;

    switch (f.id) {
      case 'kuro': {
        // Kuro: 2 physical shadow-clone silhouettes flanking the victim in 2.5D depth + kunai wires
        const cloneX = foe.x - f.facing * (34 + Math.sin(bTick * 0.3) * 8);
        const cloneY = foe.y - (beatIdx === 2 ? 12 : 0);
        ctx.save();
        ctx.globalAlpha = 0.55;
        this.drawStickSkeleton(
          ctx,
          cloneX,
          cloneY,
          (-f.facing) as 1 | -1,
          this.computePose(
            'ultimate',
            null,
            null,
            f.actionFrame,
            (-f.facing) as 1 | -1,
            0,
            0,
            true,
            'dagger',
            'ult_flank_slash'
          ),
          '#090d16',
          accent,
          accent,
          secondary,
          'dagger',
          0.88,
          0.88,
          true,
          0.55
        );
        ctx.restore();
        break;
      }
      case 'velo': {
        // Velo: Jet-heel exhaust cones & Mach shock rings around his kicking leg / gauntlet
        const gx = f.x + f.facing * 18;
        const gy = f.y - 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 8, 20, f.facing * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'kenji': {
        // Kenji: Lingering razor-thin crimson & white katana slash lines hanging in 3D space
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.4;
        const ang = (beatIdx * 0.65 - 0.4) * f.facing + camYaw * 0.25;
        const len = 62;
        ctx.beginPath();
        ctx.moveTo(foe.x - Math.cos(ang) * len, foe.y - 16 - Math.sin(ang) * len);
        ctx.lineTo(foe.x + Math.cos(ang) * len, foe.y - 16 + Math.sin(ang) * len);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;
      }
      case 'bram': {
        // Bram: Jagged 3D basalt rock pillars erupting from the stage floor behind the victim
        const numRocks = 3;
        for (let r = 0; r < numRocks; r++) {
          const rx = foe.x + (r - 1) * 26;
          const rh = 24 + (r % 2) * 14;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(rx - 9, foe.y + 2);
          ctx.lineTo(rx - 3, foe.y + 2 - rh);
          ctx.lineTo(rx + 8, foe.y + 2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }
      case 'raijin': {
        // Raijin: 2 planted 3D Thunder Naginata lightning rods flanking the victim with live electric arcs
        for (let side = -1; side <= 1; side += 2) {
          const rx = foe.x + side * 52;
          const ry = foe.y + 2;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + side * 4, ry - 48);
          ctx.stroke();
          if (bTick % 3 === 0) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(rx + side * 4, ry - 42);
            ctx.lineTo((rx + foe.x) * 0.5, foe.y - 26 + (bTick % 9));
            ctx.lineTo(foe.x, foe.y - 16);
            ctx.stroke();
          }
        }
        break;
      }
      case 'chrono': {
        // Chrono: Golden temporal Echo-Clone swinging a synchronized scythe from the opposite Z-plane
        const echoX = foe.x - f.facing * 38;
        ctx.save();
        ctx.globalAlpha = 0.5;
        this.drawStickSkeleton(
          ctx,
          echoX,
          foe.y,
          (-f.facing) as 1 | -1,
          this.computePose(
            'ultimate',
            null,
            null,
            f.actionFrame,
            (-f.facing) as 1 | -1,
            0,
            0,
            true,
            'scythe',
            'ult_flank_slash'
          ),
          '#fde047',
          '#06b6d4',
          '#fde047',
          '#06b6d4',
          'scythe',
          0.9,
          0.9,
          true,
          0.5
        );
        ctx.restore();
        break;
      }
      case 'sol': {
        // Sol: Blazing 3D meteor-chain links whipping from Sol's hand around the opponent
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(f.x + f.facing * 12, f.y - 14);
        ctx.quadraticCurveTo(
          (f.x + foe.x) * 0.5,
          foe.y - 38 + Math.sin(bTick * 0.5) * 14,
          foe.x,
          foe.y - 14
        );
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'nyx': {
        // Nyx: Sleek 2.5D vertical wormhole portal ellipses on either side of the victim (never covering them)
        for (let side = -1; side <= 1; side += 2) {
          const px = foe.x + side * 48;
          const py = foe.y - 16;
          ctx.strokeStyle = side === -1 ? '#ec4899' : '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(px, py, 7, 24, side * 0.15, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'jin': {
        // Jin: Articulated Karasu Battle-Puppet flanking the victim on the opposite side + taut strings
        const pupX = foe.x + f.facing * 42;
        const pupY = foe.y - 6;
        ctx.strokeStyle = '#2dd4bf';
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(f.x + f.facing * 14, f.y - 18);
        ctx.lineTo(pupX, pupY - 16);
        ctx.stroke();

        this.drawStickSkeleton(
          ctx,
          pupX,
          pupY,
          (-f.facing) as 1 | -1,
          this.computePose(
            'ultimate',
            null,
            null,
            f.actionFrame,
            (-f.facing) as 1 | -1,
            0,
            0,
            true,
            'claws',
            'ult_rapid_flurry'
          ),
          '#1e1b4b',
          '#f43f5e',
          '#f43f5e',
          '#2dd4bf',
          'claws',
          0.92,
          0.92,
          true,
          0.82
        );
        break;
      }
    }
  }

  private drawCharacter25DFinisherFX(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    foe: FighterState,
    fFrame: number,
    camYaw: number,
    camPitch: number
  ): void {
    const accent = f.spec.accentColor;
    const secondary = f.spec.secondaryColor;
    const alpha = fFrame <= 20 ? 1 : Math.max(0, 1 - (fFrame - 20) / 52);

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Character-signature physical finisher slash / beam / meteor impact
    if (f.id === 'kenji' || f.id === 'kuro' || f.id === 'chrono') {
      // Crisp full-stage 3D dimensional katana/scythe/kunai cut-lines slicing behind and across the target
      const cuts = [
        { ang: -0.28 + camYaw * 0.2, col: accent, w: 5.5 },
        { ang: 0.34 - camYaw * 0.2, col: secondary, w: 4.2 },
        { ang: -0.04, col: '#fde047', w: 3.5 },
      ];
      for (const c of cuts) {
        ctx.strokeStyle = c.col;
        ctx.lineWidth = c.w * alpha;
        ctx.beginPath();
        ctx.moveTo(foe.x - Math.cos(c.ang) * 280, foe.y - 18 - Math.sin(c.ang) * 280);
        ctx.lineTo(foe.x + Math.cos(c.ang) * 280, foe.y - 18 + Math.sin(c.ang) * 280);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = c.w * 0.42 * alpha;
        ctx.stroke();
      }
    } else if (f.id === 'raijin' || f.id === 'sol' || f.id === 'velo') {
      // Diagonal sky-to-ground thunder/solar/mach dive pillar erupting from the impact point
      const ang = f.facing * 0.32;
      ctx.save();
      ctx.translate(foe.x, foe.y);
      ctx.rotate(ang);
      const colW = (38 + Math.sin(fFrame * 0.8) * 8) * alpha;
      ctx.fillStyle = accent;
      ctx.fillRect(-colW * 0.5, -320, colW, 340);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-colW * 0.24, -320, colW * 0.48, 340);
      ctx.restore();
    } else {
      // Bram / Nyx / Jin: Erupting 2.5D Ground Impact Crater & Upward Shock Pillars
      for (let p = -2; p <= 2; p++) {
        const px = foe.x + p * 28;
        const ph = (110 - Math.abs(p) * 22) * alpha;
        ctx.fillStyle = p % 2 === 0 ? accent : secondary;
        ctx.fillRect(px - 6, foe.y - ph, 12, ph);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2.5, foe.y - ph, 5, ph);
      }
    }

    // 2. 2.5D Foreshortened Multi-Ring Floor Blast Wave (Drawn cleanly on the 3D ground plane)
    for (let r = 0; r < 2; r++) {
      const rx = 28 + fFrame * (4.8 + r * 2.2);
      const ry = Math.max(8, rx * (0.28 + Math.abs(camPitch) * 0.25));
      ctx.strokeStyle = r === 0 ? '#fde047' : accent;
      ctx.lineWidth = (4.5 - r * 1.5) * alpha;
      ctx.beginPath();
      ctx.ellipse(foe.x, foe.y + 2, rx, ry, camYaw * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawUltimateCutsceneOverlay(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    tick: number
  ): void {
    const caster = fighters.find(
      (f) =>
        f.action === 'ultimate' &&
        (f.actionFrame <= 126 || (f.moveHitConnected && f.actionFrame <= 450))
    );
    if (!caster) return;
    const af = caster.actionFrame;

    ctx.save();

    // 1. Sleek Widescreen 2.5D Cinema Letterbox Bars (Never obscuring the center of the screen!)
    const barH = af <= 60 ? 32 : af <= 126 ? 22 : 28;
    ctx.fillStyle = 'rgba(4, 6, 12, 0.94)';
    ctx.fillRect(0, 0, RENDER_W, barH);
    ctx.fillRect(0, RENDER_H - barH, RENDER_W, barH);

    // Glowing accent trim on letterbox bars
    ctx.fillStyle = caster.spec.accentColor;
    ctx.fillRect(0, barH - 2, RENDER_W, 2);
    ctx.fillRect(0, RENDER_H - barH, RENDER_W, 2);

    // 2. Act I Low-Angle Hero Cut-In Ribbon at Top-Center (Frames 3..58)
    if (af >= 3 && af <= 58) {
      const slideIn = Math.min(1, (af - 3) / 7);
      const fadeOut = af >= 48 ? 1 - (af - 48) / 11 : 1;
      ctx.globalAlpha = slideIn * fadeOut;

      ctx.save();
      ctx.translate(RENDER_W * 0.5, 68);
      ctx.rotate(-0.035 * caster.facing);

      ctx.fillStyle = 'rgba(6, 9, 18, 0.92)';
      ctx.fillRect(-320, -24, 640, 48);
      ctx.fillStyle = caster.spec.accentColor;
      ctx.fillRect(-320, -24, 640, 2.5);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-320, 21.5, 640, 2.5);

      ctx.textAlign = 'center';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = caster.spec.secondaryColor;
      ctx.fillText(
        `${caster.spec.name} // "${caster.spec.tauntQuote}"`,
        0,
        -7
      );

      ctx.font = '900 20px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caster.spec.ultimateName, 0, 14);
      ctx.restore();
    }

    // 3. Act II Unblockable Pursuit Alert on Top Bar (Frames 61..126)
    if (af >= 61 && af <= 126 && !caster.moveHitConnected) {
      const pulse = tick % 6 < 3;
      ctx.textAlign = 'center';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = pulse ? '#ef4444' : '#fde047';
      ctx.fillText(
        `⚠ ${caster.spec.ultimateName} — UNBLOCKABLE RUSH! EVADE NOW! ⚠`,
        RENDER_W * 0.5,
        barH - 6
      );
    }

    // 4. Live Choreographed Stage Readout cleanly inside Bottom Letterbox Bar
    if (caster.ultStageLabel) {
      ctx.textAlign = 'center';
      ctx.font = '900 13px "Chakra Petch", sans-serif';
      ctx.fillStyle = af >= 376 ? '#fde047' : '#f8fafc';
      ctx.fillText(
        `${caster.spec.ultimateName}  //  ${caster.ultStageLabel}`,
        RENDER_W * 0.5,
        RENDER_H - 8
      );
    }

    ctx.restore();
  }

  // ===========================================================================
  // HD-PIXEL ART STAGE & PLATFORM PRIMITIVES
  // ===========================================================================

  private drawPixelDitherBand(
    ctx: CanvasRenderingContext2D,
    y: number,
    h: number,
    colorTop: string,
    colorBot: string,
    px = 2
  ): void {
    ctx.fillStyle = colorTop;
    ctx.fillRect(0, y, RENDER_W, h);
    ctx.fillStyle = colorBot;
    const rows = Math.floor(h / px);
    for (let r = 0; r < rows; r++) {
      const ratio = r / Math.max(1, rows - 1);
      for (let c = 0; c < Math.ceil(RENDER_W / px); c++) {
        const bayer = ((r & 1) << 1) | ((c & 1) ^ (r & 1)); // 0..3 Bayer 2x2
        if (ratio * 4 > bayer + 0.3) {
          ctx.fillRect(c * px, y + r * px, px, px);
        }
      }
    }
  }

  private drawPixelDisc(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    baseColor: string,
    lightColor: string,
    craterColor: string,
    px = 2
  ): void {
    const rSteps = Math.ceil(radius / px);
    for (let dy = -rSteps; dy <= rSteps; dy++) {
      const y = cy + dy * px;
      const dxMax = Math.floor(Math.sqrt(Math.max(0, rSteps * rSteps - dy * dy)));
      if (dxMax <= 0) continue;
      const leftX = cx - dxMax * px;
      const spanW = dxMax * 2 * px;
      ctx.fillStyle = baseColor;
      ctx.fillRect(leftX, y, spanW, px);
      // Pixel rim highlight on upper-left crescent
      if (dy < rSteps * 0.55) {
        ctx.fillStyle = lightColor;
        ctx.fillRect(leftX, y, Math.max(px, Math.floor(spanW * 0.24)), px);
      }
    }
    // Pixel craters / surface texture
    ctx.fillStyle = craterColor;
    ctx.fillRect(cx + Math.round(radius * 0.18), cy - Math.round(radius * 0.22), px * 5, px * 3);
    ctx.fillRect(cx + Math.round(radius * 0.24), cy - Math.round(radius * 0.32), px * 3, px * 5);
    ctx.fillRect(cx - Math.round(radius * 0.12), cy + Math.round(radius * 0.24), px * 4, px * 2);
    ctx.fillRect(cx + Math.round(radius * 0.34), cy + Math.round(radius * 0.12), px * 3, px * 3);
  }

  private drawPixelSakuraTree(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    flip: 1 | -1,
    tick: number
  ): void {
    const sway = Math.round(Math.sin(tick * 0.03 + baseX * 0.05) * 2);
    // 1. Gnarled Pixel-Art Bark Trunk & Roots
    ctx.fillStyle = '#1c1018';
    ctx.fillRect(baseX - 9, baseY - 22, 18, 22);
    ctx.fillRect(baseX - 13, baseY - 6, 26, 6);
    ctx.fillRect(baseX - 7 + flip * 3, baseY - 44, 14, 24);
    ctx.fillRect(baseX - 5 + flip * 8, baseY - 64, 11, 22);
    // Bark highlights
    ctx.fillStyle = '#3b212f';
    ctx.fillRect(baseX - 5, baseY - 20, 4, 18);
    ctx.fillRect(baseX - 3 + flip * 3, baseY - 42, 4, 20);
    // Reaching boughs
    ctx.fillStyle = '#1c1018';
    ctx.fillRect(baseX + flip * 10, baseY - 56, 28 * flip, 6);
    ctx.fillRect(baseX - flip * 18, baseY - 48, 22, 5);

    // 2. Multi-Tone Pixel Blossom Canopy Clusters
    const clusters = [
      { ox: -22 * flip, oy: -54, w: 34, h: 18 },
      { ox: 14 * flip, oy: -64, w: 42, h: 20 },
      { ox: -4 * flip, oy: -78, w: 46, h: 22 },
      { ox: 28 * flip, oy: -50, w: 32, h: 16 },
    ];
    for (const cl of clusters) {
      const cx = Math.round(baseX + cl.ox + sway);
      const cy = Math.round(baseY + cl.oy);
      const hw = Math.round(cl.w * 0.5);
      // Deep shadow layer
      ctx.fillStyle = '#881337';
      ctx.fillRect(cx - hw, cy + 4, cl.w, cl.h - 2);
      ctx.fillRect(cx - hw + 4, cy, cl.w - 8, cl.h + 4);
      // Mid blossom pink
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(cx - hw + 2, cy, cl.w - 4, cl.h - 4);
      // Bright sakura pink
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(cx - hw + 4, cy - 2, cl.w - 8, Math.round(cl.h * 0.55));
      // Top white-pink pixel clusters
      ctx.fillStyle = '#ffe4e6';
      for (let px = cx - hw + 6; px < cx + hw - 8; px += 8) {
        ctx.fillRect(px, cy - 2 + ((px * 3) % 4), 4, 3);
      }
    }
  }

  private drawPixelGear(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    teeth: number,
    angle: number,
    darkCol: string,
    midCol: string,
    lightCol: string
  ): void {
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.rotate(angle);
    // Pixel teeth
    ctx.fillStyle = midCol;
    for (let i = 0; i < teeth; i++) {
      ctx.save();
      ctx.rotate((i / teeth) * Math.PI * 2);
      ctx.fillRect(-4, -radius - 6, 8, 8);
      ctx.fillStyle = lightCol;
      ctx.fillRect(-3, -radius - 6, 6, 2);
      ctx.fillStyle = midCol;
      ctx.restore();
    }
    // Outer ring
    ctx.strokeStyle = midCol;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = lightCol;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 1, 0, Math.PI * 2);
    ctx.stroke();
    // Spokes
    ctx.fillStyle = darkCol;
    for (let s = 0; s < 4; s++) {
      ctx.save();
      ctx.rotate((s / 4) * Math.PI);
      ctx.fillRect(-3, -radius + 4, 6, (radius - 4) * 2);
      ctx.restore();
    }
    // Hub
    ctx.fillStyle = lightCol;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  private drawParallaxStage(ctx: CanvasRenderingContext2D, scene: RenderSceneData): void {
    const { stage, camX, camY, tick } = scene;

    // 1. Stepped Pixel-Art Sky Bands + Bayer Dithering Transitions
    ctx.fillStyle = stage.skyTop;
    ctx.fillRect(0, 0, RENDER_W, 130);
    this.drawPixelDitherBand(ctx, 110, 44, stage.skyTop, stage.skyMid, 2);
    ctx.fillStyle = stage.skyMid;
    ctx.fillRect(0, 154, RENDER_W, 130);
    this.drawPixelDitherBand(ctx, 260, 48, stage.skyMid, stage.skyBottom, 2);
    ctx.fillStyle = stage.skyBottom;
    ctx.fillRect(0, 308, RENDER_W, RENDER_H - 308);

    // 2. Twinkling Pixel Starfield & Constellations
    for (let i = 0; i < 56; i++) {
      const sx = Math.floor((((i * 137 + 50 - camX * 0.04) % RENDER_W) + RENDER_W) % RENDER_W);
      const sy = Math.floor((i * 73 + 14) % (RENDER_H * 0.58));
      const twinkle = (tick + i * 13) % 40 < 6;
      if (i % 7 === 0) {
        // 5-pixel cross star
        ctx.fillStyle = twinkle ? '#ffffff' : stage.accentColor;
        ctx.fillRect(sx, sy, 2, 2);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
        ctx.fillRect(sx - 2, sy, 6, 1);
        ctx.fillRect(sx, sy - 2, 1, 6);
      } else {
        ctx.fillStyle = twinkle ? '#ffffff' : 'rgba(226, 232, 240, 0.45)';
        const sz = i % 4 === 0 ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
      }
    }

    if (stage.id === 'void_flat') {
      // =======================================================================
      // 1. HORIZON ZERO: Sunken Astral Sanctuary, Shattered Eclipse & Mirror Sea
      // =======================================================================
      const ex = Math.round(RENDER_W * 0.5 - camX * 0.06);
      const ey = Math.round(126 - camY * 0.05);

      // Pixel-stepped Eclipse Corona Rings
      this.drawPixelDisc(ctx, ex, ey, 78, '#0c2342', '#1e426e', '#08172e', 3);
      this.drawPixelDisc(ctx, ex, ey, 60, '#38bdf8', '#e0f2fe', '#0284c7', 2);
      this.drawPixelDisc(ctx, ex, ey, 50, '#030611', '#0f172a', '#050b1c', 2);

      // Floating shattered pixel-art astral ring fragments around eclipse
      for (let f = 0; f < 14; f++) {
        const ang = (f / 14) * Math.PI * 2 + tick * 0.004;
        const fx = Math.round(ex + Math.cos(ang) * 92);
        const fy = Math.round(ey + Math.sin(ang) * 32);
        ctx.fillStyle = f % 2 === 0 ? '#e0f2fe' : '#38bdf8';
        ctx.fillRect(fx - 3, fy - 2, 6, 4);
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(fx - 2, fy + 2, 4, 2);
      }

      // Distant Sunken Astral Temple Columns & Broken Architraves in Parallax
      const ruinPositions = [-320, -210, -115, 115, 210, 320];
      for (let i = 0; i < ruinPositions.length; i++) {
        const rx = Math.round(RENDER_W * 0.5 + ruinPositions[i] - camX * 0.16);
        const rh = 75 + (i % 3) * 28;
        const ry = 292 - rh;
        // Fluted pixel column
        ctx.fillStyle = '#0f203c';
        ctx.fillRect(rx - 10, ry, 20, rh);
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(rx - 8, ry, 4, rh);
        ctx.fillRect(rx, ry, 4, rh);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(rx - 10, ry, 2, rh);
        // Stepped Corinthian capital / jagged ruin top
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(rx - 14, ry - 6, 28, 6);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(rx - 14, ry - 6, 28, 2);
      }

      // Infinite Pixel-Art Mirror Ocean & Shimmering Reflection Scanlines
      const horizonY = 290;
      this.drawPixelDitherBand(ctx, horizonY - 12, 14, '#162947', '#061024', 2);
      ctx.fillStyle = '#061024';
      ctx.fillRect(0, horizonY, RENDER_W, RENDER_H - horizonY);
      for (let r = 0; r < 24; r++) {
        const ry = horizonY + r * 6;
        const waveShift = Math.round(Math.sin(tick * 0.06 + r * 0.7) * 8);
        const rw = Math.max(14, 140 - r * 4);
        ctx.fillStyle = r % 3 === 0 ? '#7dd3fc' : '#0284c7';
        ctx.fillRect(ex - rw + waveShift, ry, rw * 2, 2);
        if (r % 2 === 0) {
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(ex - Math.round(rw * 0.4) - waveShift, ry, Math.round(rw * 0.8), 2);
        }
      }
    } else if (stage.id === 'torii') {
      // =======================================================================
      // 2. CRIMSON TORII: Blood Moon, Pixel Mt. Fuji, Torii Shrine & Sakura Trees
      // =======================================================================
      const mx = Math.round(RENDER_W * 0.5 - camX * 0.06);
      const my = Math.round(122 - camY * 0.05);
      this.drawPixelDisc(ctx, mx, my, 66, '#be123c', '#fda4af', '#881337', 2);

      // Far Pixel-Art Mount Fuji Silhouette with Snow-Cap
      const fujiX = Math.round(RENDER_W * 0.5 - 110 - camX * 0.09);
      const fujiBaseY = 295;
      for (let row = 0; row < 110; row += 2) {
        const ratio = row / 110;
        const halfW = Math.round(18 + Math.pow(ratio, 1.35) * 195);
        ctx.fillStyle = row < 34 ? '#fecdd3' : row < 44 && (row + fujiX) % 4 === 0 ? '#fda4af' : '#180c24';
        ctx.fillRect(fujiX - halfW, fujiBaseY - 110 + row, halfW * 2, 2);
      }

      // Layered Pixel-Art Pine Mountain Ridges
      this.drawMountainLayer(ctx, camX * 0.14, '#140b21', 292, 48, 0.008);
      this.drawMountainLayer(ctx, camX * 0.24, '#21102e', 326, 34, 0.015);

      // Grand Pixel-Art Vermilion Torii Gate in Midground
      const gx = Math.round(RENDER_W * 0.5 - camX * 0.32);
      const gy = Math.round(302 - camY * 0.18);
      // Stone pedestals (Kamebara)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(gx - 70, gy + 10, 22, 24);
      ctx.fillRect(gx + 48, gy + 10, 22, 24);
      // Vermilion pillars (Hashira) with pixel shading
      ctx.fillStyle = '#9f1239';
      ctx.fillRect(gx - 65, gy - 98, 14, 112);
      ctx.fillRect(gx + 51, gy - 98, 14, 112);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(gx - 63, gy - 98, 4, 112);
      ctx.fillRect(gx + 53, gy - 98, 4, 112);
      // Lower tie-beam (Nuki)
      ctx.fillStyle = '#881337';
      ctx.fillRect(gx - 78, gy - 76, 156, 9);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(gx - 66, gy - 76, 16, 9);
      ctx.fillRect(gx + 50, gy - 76, 16, 9);
      ctx.fillRect(gx - 8, gy - 96, 16, 22); // Gaku-zuka tablet
      // Curved top lintel (Kasagi) with upturned pixel eaves
      ctx.fillStyle = '#be123c';
      ctx.fillRect(gx - 88, gy - 104, 176, 8);
      ctx.fillStyle = '#090612';
      ctx.fillRect(gx - 94, gy - 111, 188, 7);
      ctx.fillRect(gx - 100, gy - 115, 16, 5);
      ctx.fillRect(gx + 84, gy - 115, 16, 5);
      // Sacred Shimenawa rope & white zig-zag Shide paper talismans
      ctx.fillStyle = '#d97706';
      ctx.fillRect(gx - 50, gy - 66, 100, 4);
      ctx.fillStyle = '#f8fafc';
      for (let sh = -36; sh <= 36; sh += 24) {
        ctx.fillRect(gx + sh - 2, gy - 62, 4, 6);
        ctx.fillRect(gx + sh, gy - 57, 4, 6);
        ctx.fillRect(gx + sh - 2, gy - 52, 4, 5);
      }

      // Twin Gnarled Pixel-Art Sakura Trees framing the shrine
      this.drawPixelSakuraTree(ctx, gx - 165, gy + 14, -1, tick);
      this.drawPixelSakuraTree(ctx, gx + 165, gy + 14, 1, tick);

      // Carved Stone Toro Lanterns with flickering pixel fire
      for (const side of [-1, 1]) {
        const lx = gx + side * 112;
        const ly = gy + 4;
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 6, ly - 24, 12, 28);
        ctx.fillStyle = '#475569';
        ctx.fillRect(lx - 10, ly - 28, 20, 5);
        ctx.fillRect(lx - 8, ly - 12, 16, 4);
        ctx.fillStyle = (tick + side * 7) % 8 < 4 ? '#fde047' : '#fb923c';
        ctx.fillRect(lx - 3, ly - 22, 6, 8);
      }

      // Drifting 2-tone pixel sakura petals
      for (let i = 0; i < 36; i++) {
        const px = Math.floor((((i * 79 - tick * 0.9 - camX * 0.25) % RENDER_W) + RENDER_W) % RENDER_W);
        const py = Math.floor((i * 43 + tick * 0.6 + Math.sin(tick * 0.04 + i) * 9) % RENDER_H);
        ctx.fillStyle = i % 2 === 0 ? '#ffe4e6' : '#fb7185';
        ctx.fillRect(px, py, 3, 2);
        ctx.fillRect(px + 1, py + 2, 2, 1);
      }
    } else if (stage.id === 'dojo') {
      // =======================================================================
      // 3. CLOUD PAGODA: 5-Story Pixel Pagoda, Floating Waterfalls & Pulley Chains
      // =======================================================================
      // Distant Wuxia Floating Sky-Peaks & Cascading Pixel Waterfalls
      for (const side of [-1, 1]) {
        const pkX = Math.round(RENDER_W * 0.5 + side * 245 - camX * 0.1);
        const pkY = Math.round(170 - camY * 0.06);
        ctx.fillStyle = '#0d1f36';
        ctx.fillRect(pkX - 34, pkY - 50, 68, 95);
        ctx.fillRect(pkX - 22, pkY - 78, 44, 30);
        ctx.fillRect(pkX - 18, pkY + 45, 36, 26);
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(pkX - 34, pkY - 50, 12, 90);
        // Animated pixel waterfall pouring from floating island
        const wfX = pkX + side * 8;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(wfX - 4, pkY + 10, 8, 160);
        ctx.fillStyle = '#e0f2fe';
        for (let wy = 0; wy < 150; wy += 12) {
          const dropY = pkY + 10 + ((wy + tick * 3) % 150);
          ctx.fillRect(wfX - 2, dropY, 4, 6);
        }
      }

      // Grand 5-Story Pixel-Art Cloud Pagoda
      const px = Math.round(RENDER_W * 0.5 - camX * 0.16);
      const py = Math.round(300 - camY * 0.12);
      for (let tier = 0; tier < 5; tier++) {
        const tw = 164 - tier * 24;
        const ty = py - tier * 38;
        // Timber walls & glowing shoji lattice windows
        ctx.fillStyle = '#170f11';
        ctx.fillRect(px - Math.round(tw * 0.44), ty - 28, Math.round(tw * 0.88), 28);
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(px - Math.round(tw * 0.42), ty - 26, 4, 24);
        ctx.fillRect(px + Math.round(tw * 0.42) - 4, ty - 26, 4, 24);
        // Illuminated paper shoji panels
        ctx.fillStyle = '#fbbf24';
        for (let wx = -Math.round(tw * 0.26); wx <= Math.round(tw * 0.22); wx += 18) {
          ctx.fillRect(px + wx, ty - 20, 8, 14);
        }
        // Scalloped pixel roof tiles & upturned golden eaves
        const roofW = Math.round(tw * 1.24);
        ctx.fillStyle = '#091526';
        ctx.fillRect(px - Math.round(roofW * 0.5), ty - 35, roofW, 8);
        ctx.fillStyle = '#1e3a5f';
        for (let rx = -Math.round(roofW * 0.48); rx < Math.round(roofW * 0.48); rx += 8) {
          ctx.fillRect(px + rx, ty - 35, 5, 6);
        }
        // Upturned dragon eave tips & golden wind-chimes
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(px - Math.round(roofW * 0.5) - 6, ty - 39, 10, 5);
        ctx.fillRect(px + Math.round(roofW * 0.5) - 4, ty - 39, 10, 5);
        ctx.fillRect(px - Math.round(roofW * 0.5) - 2, ty - 27, 2, 7);
        ctx.fillRect(px + Math.round(roofW * 0.5), ty - 27, 2, 7);
      }
      // Golden Sorin Spire at peak
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px - 3, py - 228, 6, 38);
      for (let r = 0; r < 5; r++) {
        ctx.fillRect(px - 8 + r, py - 198 - r * 6, 16 - r * 2, 2);
      }

      // Pixel-Art Sunset Cloud Banks
      for (let c = 0; c < 7; c++) {
        const cx = Math.round(((c * 155 + tick * 0.4 - camX * 0.22) % (RENDER_W + 180)) - 90);
        const cy = 278 + (c % 2) * 26;
        ctx.fillStyle = '#162d4c';
        ctx.fillRect(cx - 48, cy, 96, 22);
        ctx.fillRect(cx - 34, cy - 10, 68, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cx - 32, cy - 12, 64, 3);
      }
    } else if (stage.id === 'monolith') {
      // =======================================================================
      // 4. TWIN ABYSS RIFT: Subterranean Crystal Chasm, Monolith Statues & Falls
      // =======================================================================
      const rx = Math.round(RENDER_W * 0.5 - camX * 0.12);

      // Cavern ceiling pixel stalactites
      ctx.fillStyle = '#051017';
      for (let s = 0; s < 26; s++) {
        const sx = Math.round(((s * 41 - camX * 0.08) % RENDER_W + RENDER_W) % RENDER_W);
        const sh = 18 + ((s * 29) % 44);
        ctx.fillRect(sx - 6, 0, 12, Math.round(sh * 0.5));
        ctx.fillRect(sx - 3, 0, 6, sh);
        if (s % 4 === 0) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(sx - 1, sh - 4, 2, 6);
          ctx.fillStyle = '#051017';
        }
      }

      // Central Emerald Abyss Energy Pillar
      for (let b = -36; b <= 36; b += 4) {
        const alpha = (1 - Math.abs(b) / 40) * 0.28;
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.fillRect(rx + b, 0, 4, RENDER_H);
      }

      // Twin Weeping Ancient Monolith Guardian Statues with Aether Waterfalls
      for (const side of [-1, 1]) {
        const mx = Math.round(RENDER_W * 0.5 + side * 145 - camX * 0.2);
        const my = Math.round(185 - camY * 0.1);
        // Chiseled stone head & torso
        ctx.fillStyle = '#0c1f24';
        ctx.fillRect(mx - 24, my - 46, 48, 140);
        ctx.fillStyle = '#16353d';
        ctx.fillRect(mx - 20, my - 42, 14, 130);
        // Glowing emerald visor eyes & weeping aether waterfalls
        ctx.fillStyle = '#34d399';
        ctx.fillRect(mx - 14, my - 22, 10, 4);
        ctx.fillRect(mx + 4, my - 22, 10, 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(mx - 11, my - 18, 4, 210);
        ctx.fillRect(mx + 7, my - 18, 4, 210);
        ctx.fillStyle = '#a7f3d0';
        for (let wy = 0; wy < 190; wy += 16) {
          const dy = my - 16 + ((wy + tick * 3.5) % 190);
          ctx.fillRect(mx - 10, dy, 2, 6);
          ctx.fillRect(mx + 8, dy + 6, 2, 6);
        }
      }

      // Background Giant Pixel Emerald Crystal Clusters
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const cx = Math.round(RENDER_W * 0.5 + i * 110 - camX * 0.26);
        const cy = Math.round(255 + Math.sin(tick * 0.03 + i) * 8);
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(cx - 10, cy - 30, 20, 56);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(cx - 6, cy - 38, 12, 64);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(cx - 4, cy - 36, 4, 58);
      }
    } else if (stage.id === 'coliseum') {
      // =======================================================================
      // 5. TITAN COLISEUM: Fallen Pixel Colossus, 3-Tier Arches & Cheering Crowd!
      // =======================================================================
      const cx = Math.round(RENDER_W * 0.5 - camX * 0.14);
      const cy = Math.round(235 - camY * 0.08);

      // 1. Colossal Pixel-Art Fallen Titan Skull Helm & Shattered Runic Greatsword!
      // Titan horned skull & pauldrons in background
      ctx.fillStyle = '#23100b';
      ctx.fillRect(cx - 95, cy - 42, 190, 95); // Titan shoulders
      ctx.fillRect(cx - 42, cy - 92, 84, 56); // Titan great-helm
      ctx.fillStyle = '#3b1a11';
      ctx.fillRect(cx - 38, cy - 88, 32, 48);
      // Giant curved pixel horns on the fallen Titan
      for (let h = 0; h < 7; h++) {
        ctx.fillStyle = h > 4 ? '#78350f' : '#451a03';
        ctx.fillRect(cx - 48 - h * 10, cy - 82 - h * 7, 14, 12);
        ctx.fillRect(cx + 34 + h * 10, cy - 82 - h * 7, 14, 12);
      }
      // Glowing cracked eye sockets of the Titan
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(cx - 26, cy - 64, 16, 6);
      ctx.fillRect(cx + 10, cy - 64, 16, 6);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 20, cy - 63, 6, 4);
      ctx.fillRect(cx + 14, cy - 63, 6, 4);

      // Colossal Runic Greatsword impaling the Titan's chest
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(cx - 18, cy - 205, 36, 175); // Blade body
      ctx.fillStyle = '#44403c';
      ctx.fillRect(cx - 16, cy - 205, 10, 170); // Lit blade bevel
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(cx - 4, cy - 195, 8, 155); // Central blood fuller
      // Glowing molten runes etched down the greatsword fuller
      ctx.fillStyle = '#f97316';
      for (let r = 0; r < 6; r++) {
        ctx.fillRect(cx - 2, cy - 185 + r * 22, 4, 10);
      }
      // Ornate winged pixel crossguard & pommel
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(cx - 68, cy - 214, 136, 14);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 64, cy - 212, 128, 4);
      ctx.fillRect(cx - 8, cy - 216, 16, 18);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(cx - 9, cy - 260, 18, 44);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 14, cy - 272, 28, 12);

      // 2. Multi-Tier Pixel-Art Coliseum Stone Arches & Animated Cheering Spectators!
      const wallTopY = Math.round(238 - camY * 0.14);
      ctx.fillStyle = '#190b07';
      ctx.fillRect(0, wallTopY, RENDER_W, RENDER_H - wallTopY);

      const scrollX = Math.round(camX * 0.28);
      for (let tier = 0; tier < 2; tier++) {
        const ty = wallTopY + tier * 54;
        ctx.fillStyle = '#2d140d';
        ctx.fillRect(0, ty, RENDER_W, 8);
        ctx.fillStyle = '#431e13';
        ctx.fillRect(0, ty, RENDER_W, 2);

        for (let col = -2; col < 16; col++) {
          const ax = col * 64 - ((scrollX % 64 + 64) % 64);
          // Stone arch pillar
          ctx.fillStyle = '#2d140d';
          ctx.fillRect(ax, ty + 8, 16, 46);
          ctx.fillStyle = '#431e13';
          ctx.fillRect(ax + 2, ty + 8, 4, 46);
          // Stepped pixel arch lintel
          ctx.fillStyle = '#2d140d';
          ctx.fillRect(ax + 16, ty + 8, 8, 6);
          ctx.fillRect(ax + 56, ty + 8, 8, 6);

          // Animated Cheering Spectator Silhouettes inside the arch!
          for (let sp = 0; sp < 4; sp++) {
            const sx = ax + 20 + sp * 10;
            const bounce = ((tick + col * 7 + sp * 5) % 16) < 8 ? -2 : 0;
            const sy = ty + 38 + bounce;
            ctx.fillStyle = sp % 2 === 0 ? '#0c0504' : '#3b1810';
            ctx.fillRect(sx, sy, 6, 12); // torso
            ctx.fillRect(sx + 1, sy - 5, 4, 4); // head
            // Raised cheering weapon/arm
            if ((col + sp) % 3 === 0) {
              ctx.fillRect(sx + 5, sy - 6, 2, 8);
            }
          }

          // Hanging Crimson & Gold Legion Banner or Roaring Lion Brazier on pillars
          if (tier === 0 && col % 2 === 0) {
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(ax + 2, ty + 14, 12, 28);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(ax + 2, ty + 14, 12, 2);
            ctx.fillRect(ax + 6, ty + 20, 4, 12);
          } else if (tier === 1 && col % 2 !== 0) {
            const flk = ((tick + col * 3) % 6) - 3;
            ctx.fillStyle = '#451a03';
            ctx.fillRect(ax, ty + 2, 16, 6);
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(ax + 2, ty - 8 + flk, 12, 10 - flk);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(ax + 5, ty - 4 + flk, 6, 6);
          }
        }
      }
    } else if (stage.id === 'hypercube') {
      // =======================================================================
      // 6. CYBER-GRID 3D: Cyberpunk Skyline, Neon Billboards, Flying Cars & 4D Core
      // =======================================================================
      const horizonY = Math.round(220 - camY * 0.12);
      const vpX = Math.round(RENDER_W * 0.5 - camX * 0.2);

      // 1. Dense Pixel-Art Cyberpunk Megacity Skyline & Animated Neon Hologram Signs
      for (let i = 0; i < 16; i++) {
        const bw = 42 + (i % 3) * 16;
        const bh = 85 + ((i * 47) % 105);
        const bx = Math.round((((i * 62 - camX * 0.14) % (RENDER_W + 120)) + RENDER_W + 120) % (RENDER_W + 120) - 60);
        const by = horizonY - bh + 18;
        ctx.fillStyle = '#07051a';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#150d3a';
        ctx.fillRect(bx + 2, by + 2, 6, bh - 4);
        // Pixel window grid
        ctx.fillStyle = i % 2 === 0 ? '#06b6d4' : '#ec4899';
        for (let wy = by + 10; wy < horizonY + 8; wy += 8) {
          for (let wx = bx + 10; wx < bx + bw - 8; wx += 8) {
            if ((wx + wy + i) % 3 !== 0) {
              ctx.fillRect(wx, wy, 4, 3);
            }
          }
        }
        // Glowing Neon Rooftop Hologram Billboards
        if (i % 3 === 0) {
          const holoCol = i % 2 === 0 ? '#22d3ee' : '#f472b6';
          ctx.strokeStyle = holoCol;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 6, by - 22, bw - 12, 18);
          ctx.fillStyle = holoCol;
          ctx.fillRect(bx + 10, by - 18, bw - 20, 3);
          ctx.fillRect(bx + 14, by - 12, bw - 28, 5);
        }
      }

      // 2. Flying Pixel Spinner Cars streaking across 3 sky-lanes!
      for (let car = 0; car < 8; car++) {
        const dir = car % 2 === 0 ? 1 : -1;
        const speed = 2.5 + (car % 3) * 1.2;
        const cx = Math.round((((car * 130 + tick * speed * dir) % (RENDER_W + 80)) + RENDER_W + 80) % (RENDER_W + 80) - 40);
        const cy = 70 + car * 18;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - 6, cy, 12, 4);
        ctx.fillStyle = dir > 0 ? '#f43f5e' : '#38bdf8';
        ctx.fillRect(cx - dir * 18, cy + 1, 14, 2); // tail-light streak
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + dir * 5, cy + 1, 3, 2); // headlight
      }

      // 3. 3D Receding Synthwave Pixel Grid Floor & Rotating 4D Tesseract
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.36)';
      ctx.lineWidth = 1;
      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(vpX + i * 14, horizonY + 18);
        ctx.lineTo(vpX + i * 95, RENDER_H);
        ctx.stroke();
      }
      const zOffset = (tick * 0.035) % 1;
      for (let d = 1; d <= 10; d++) {
        const norm = (d - zOffset) / 10;
        const yBot = horizonY + 18 + Math.pow(norm, 2.1) * (RENDER_H - horizonY - 18);
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.14 + norm * 0.42})`;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(yBot));
        ctx.lineTo(RENDER_W, Math.round(yBot));
        ctx.stroke();
      }

      const hx = vpX;
      const hy = Math.round(126 - camY * 0.08);
      const ax = tick * 0.016;
      const ay = tick * 0.022;
      const wPulse = 0.48 + Math.sin(tick * 0.03) * 0.14;

      const projectVerts = (scale: number, phaseOffset: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let idx = 0; idx < 8; idx++) {
          const vx = (idx & 1 ? 1 : -1) * scale;
          const vy = (idx & 2 ? 1 : -1) * scale;
          const vz = (idx & 4 ? 1 : -1) * scale;
          const cY = Math.cos(ay + phaseOffset);
          const sY = Math.sin(ay + phaseOffset);
          const rx1 = vx * cY - vz * sY;
          const rz1 = vx * sY + vz * cY;
          const cX = Math.cos(ax);
          const sX = Math.sin(ax);
          const ry2 = vy * cX - rz1 * sX;
          const rz2 = vy * sX + rz1 * cX;
          const fov = 160 / (160 + rz2);
          pts.push({ x: hx + rx1 * fov, y: hy + ry2 * fov });
        }
        return pts;
      };

      const outerPts = projectVerts(44, 0);
      const innerPts = projectVerts(44 * wPulse, 0.35);
      const edges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(outerPts[i].x, outerPts[i].y);
        ctx.lineTo(innerPts[i].x, innerPts[i].y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(outerPts[a].x, outerPts[a].y);
        ctx.lineTo(outerPts[b].x, outerPts[b].y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(innerPts[a].x, innerPts[a].y);
        ctx.lineTo(innerPts[b].x, innerPts[b].y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (stage.id === 'tesseract') {
      // =======================================================================
      // 7. MÖBIUS CONTINUUM: Clockwork Cathedral Gears, Planet & Escher Stairs
      // =======================================================================
      const cx = Math.round(RENDER_W * 0.5 - camX * 0.1);
      const cy = Math.round(165 - camY * 0.08);

      // Ringed Pixel Planet in upper-left cosmos
      const px = Math.round(165 - camX * 0.05);
      const py = Math.round(92 - camY * 0.04);
      this.drawPixelDisc(ctx, px, py, 26, '#6b21a8', '#e879f9', '#3b0764', 2);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 48, 10, -0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Interlocking Pixel-Art Brass & Gold Clockwork Gears
      this.drawPixelGear(ctx, cx - 64, cy - 18, 52, 12, tick * 0.008, '#451a03', '#b45309', '#facc15');
      this.drawPixelGear(ctx, cx + 62, cy + 16, 44, 10, -tick * 0.01, '#3b0764', '#7e22ce', '#e879f9');
      this.drawPixelGear(ctx, cx, cy - 42, 34, 8, -tick * 0.014, '#451a03', '#d97706', '#fef08a');

      // Floating Escher Pixel-Art Marble Staircases & Arcane Pillars
      for (let s = -2; s <= 2; s++) {
        if (s === 0) continue;
        const sx = Math.round(RENDER_W * 0.5 + s * 145 - camX * 0.22);
        const sy = Math.round(205 + Math.sin(tick * 0.025 + s) * 12);
        for (let step = 0; step < 6; step++) {
          const stX = sx + step * 9 * Math.sign(s);
          const stY = sy - step * 7;
          ctx.fillStyle = '#2e1065';
          ctx.fillRect(stX, stY, 12, 22);
          ctx.fillStyle = '#c084fc';
          ctx.fillRect(stX, stY, 12, 3);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(stX + 2, stY + 6, 4, 8);
        }
      }
    } else if (stage.id === 'train') {
      // =======================================================================
      // 8. PHANTOM MAGLEV: High-Speed Megacity Skyline, Viaduct & Catenary Gantries
      // =======================================================================
      const speedScroll = tick * 10;

      // 1. Far Pixel-Art Megacity Skyscrapers with Window Grids
      for (let i = 0; i < 15; i++) {
        const bw = 46 + (i % 3) * 18;
        const bh = 130 + ((i * 53) % 130);
        const bx = Math.round(RENDER_W - (((i * 74 + speedScroll * 0.3) % (RENDER_W + 120)) - 40));
        const by = RENDER_H - 125 - bh;
        ctx.fillStyle = '#070e1c';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#111e36';
        ctx.fillRect(bx + 2, by + 2, 8, bh - 4);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.38)' : 'rgba(244, 63, 94, 0.34)';
        for (let wy = by + 10; wy < RENDER_H - 135; wy += 10) {
          ctx.fillRect(bx + 10, wy, bw - 20, 3);
        }
      }

      // 2. High-Speed Steel Viaduct Bridge & Suspension Cables scrolling beneath the train
      const bridgeY = Math.round(318 - camY * 0.35);
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(0, bridgeY, RENDER_W, 42);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, bridgeY, RENDER_W, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, bridgeY + 6, RENDER_W, 2);
      for (let t = 0; t < 18; t++) {
        const tx = Math.round(RENDER_W - (((t * 56 + speedScroll * 1.8) % (RENDER_W + 64)) - 32));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tx, bridgeY + 8, 8, 34);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(tx + 12, bridgeY + 14, 36, 6);
      }

      // 3. Whipping Overhead Steel Catenary Gantries & Warning Lights
      for (let g = 0; g < 3; g++) {
        const gx = Math.round(RENDER_W - (((g * 330 + speedScroll * 1.7) % (RENDER_W + 240)) - 80));
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(gx, 32, 14, RENDER_H - 115);
        ctx.fillStyle = '#334155';
        ctx.fillRect(gx + 2, 32, 4, RENDER_H - 115);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(gx + 2, 78, 10, 20);
        ctx.fillStyle = '#05070d';
        ctx.fillRect(gx + 2, 84, 10, 4);
        ctx.fillRect(gx + 2, 92, 10, 4);
      }

      // 4. Slipstream Wind Gust overlay streaks when wind hazard is active!
      const cycle = tick % 360;
      if (cycle >= 220 && cycle <= 335) {
        const isGusting = cycle >= 240;
        ctx.fillStyle = isGusting ? 'rgba(250, 204, 21, 0.65)' : 'rgba(250, 204, 21, 0.28)';
        for (let w = 0; w < 20; w++) {
          const wx = Math.round(RENDER_W - (((w * 97 + tick * 28) % (RENDER_W + 160)) - 80));
          const wy = (w * 37 + 30) % (RENDER_H - 80);
          ctx.fillRect(wx - (isGusting ? 96 : 42), wy, isGusting ? 96 : 42, isGusting ? 2 : 1);
        }
      }
    }

    const mist = ctx.createLinearGradient(0, RENDER_H - 96, 0, RENDER_H);
    mist.addColorStop(0, 'rgba(7, 10, 18, 0)');
    mist.addColorStop(1, 'rgba(7, 10, 18, 0.68)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, RENDER_H - 96, RENDER_W, 96);
  }

  private drawMountainLayer(
    ctx: CanvasRenderingContext2D,
    offset: number,
    color: string,
    baseY: number,
    amp: number,
    freq: number
  ): void {
    // Stepped Pixel-Art Mountain Silhouette (4px integer steps)
    ctx.fillStyle = color;
    for (let x = 0; x < RENDER_W; x += 4) {
      const wx = x + offset;
      const h = Math.sin(wx * freq) * amp + Math.cos(wx * freq * 2.1) * (amp * 0.45);
      const topY = Math.round((baseY - Math.abs(h)) / 2) * 2;
      ctx.fillRect(x, topY, 4, RENDER_H - topY);
    }
  }

  private drawPlatforms(
    ctx: CanvasRenderingContext2D,
    stage: StageSpec,
    isImpact: boolean,
    tick: number
  ): void {
    // 1. Spatial Wrap-Around Portals on Möbius Continuum (`tesseract`)
    if (stage.wrapHorizontal && !isImpact) {
      const edgeX = stage.wrapEdgeX ?? 285;
      for (const side of [-1, 1]) {
        const wx = side * edgeX;
        // Pixel-art rift pillar
        ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
        ctx.fillRect(wx - 4, -170, 8, 325);
        for (let py = -165; py < 150; py += 12) {
          const offset = Math.round(Math.sin(tick * 0.12 + py * 0.08) * 3);
          ctx.fillStyle = (py + tick) % 24 < 12 ? '#e879f9' : '#facc15';
          ctx.fillRect(wx - 2 + offset, py, 4, 7);
        }
      }
    }

    // 2. Coupled Train Flexible Gangway Bellows & Energy Conduits between 3 Maglev Cars!
    if (stage.id === 'train' && !isImpact) {
      for (const gapX of [-160, 160]) {
        // Flexible accordion gangway connector
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(gapX - 22, 132, 44, 36);
        ctx.fillStyle = '#1e293b';
        for (let gx = gapX - 18; gx <= gapX + 14; gx += 6) {
          ctx.fillRect(gx, 130, 3, 40);
        }
        // High-voltage plasma coupling arc
        ctx.fillStyle = tick % 4 < 2 ? '#facc15' : '#38bdf8';
        ctx.fillRect(gapX - 22, 146, 44, 3);
      }
    }

    // 3. Cloud Pagoda (`dojo`) Vertical Iron Elevator Chains from the Sky
    if (stage.id === 'dojo' && !isImpact) {
      for (const rawPlat of stage.platforms) {
        if (!rawPlat.isMain && rawPlat.motion?.axis === 'y') {
          const p = resolvePlatformAtTick(rawPlat, tick);
          const cx = Math.round(p.x);
          const topY = Math.round(p.top);
          // Twin pixel iron chains going up to ceiling pulley
          for (const chainOff of [-p.width * 0.36, p.width * 0.36]) {
            const chX = Math.round(cx + chainOff);
            for (let cy = -240; cy < topY; cy += 8) {
              ctx.fillStyle = '#334155';
              ctx.fillRect(chX - 2, cy, 4, 5);
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(chX - 1, cy + 1, 2, 3);
            }
          }
        }
      }
    }

    // 4. Render each static or moving platform with authentic HD-Pixel Art Tile Masonry!
    for (const rawPlat of stage.platforms) {
      const p = resolvePlatformAtTick(rawPlat, tick);
      const left = Math.round(p.left);
      const top = Math.round(p.top);
      const w = Math.round(p.width);
      const h = Math.round(p.thickness);

      if (p.isMain) {
        if (p.style === 'mirror') {
          // ===================================================================
          // HORIZON ZERO: Pixel-Art Astral Crystal-Stone Causeway & Water Steps
          // ===================================================================
          ctx.fillStyle = isImpact ? '#1e293b' : '#09152b';
          ctx.fillRect(left, top, w, h);

          // Stepped crystal masonry blocks
          const brickW = 32;
          for (let row = 0; row < 3; row++) {
            const by = top + 4 + row * 12;
            const stagger = (row % 2) * 16;
            for (let bx = left + 4; bx < left + w - 8; bx += brickW) {
              const bw = Math.min(brickW - 2, left + w - 4 - bx);
              ctx.fillStyle = row === 0 ? '#162c4e' : '#0d1e38';
              ctx.fillRect(bx + (row % 2 === 1 && bx === left + 4 ? 0 : stagger % 8), by, bw, 10);
              ctx.fillStyle = '#1e40af';
              ctx.fillRect(bx, by, bw, 2);
              // Glowing cyan astral rune inlay on top course
              if (row === 0 && ((bx - left) / brickW) % 2 === 0) {
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(bx + 8, by + 4, bw - 16, 2);
              }
            }
          }
          // Crisp mirror top rim + animated waterline ripples
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(left + 4, top, w - 8, 1);
          if (!isImpact) {
            ctx.fillStyle = '#7dd3fc';
            for (let rx = left - 12; rx < left + w + 12; rx += 18) {
              const wave = Math.round(Math.sin(tick * 0.08 + rx * 0.05) * 3);
              ctx.fillRect(rx + wave, top + h - 2, 10, 2);
            }
          }
        } else if (p.style === 'train') {
          // ===================================================================
          // PHANTOM MAGLEV: Pixel-Art Armored Bullet Train Cars (3-Car Convoy!)
          // ===================================================================
          const isFrontCar = p.x > 100;
          const isRearCar = p.x < -100;

          // Main armored car hull
          ctx.fillStyle = isImpact ? '#1e293b' : '#0f172a';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(left + 4, top + 5, w - 8, h - 18);
          ctx.fillStyle = '#334155';
          ctx.fillRect(left + 6, top + 6, w - 12, 8);

          // Aerodynamic Front Bullet Nose Cone & Headlights
          if (isFrontCar && !isImpact) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(left + w, top + 8, 18, h - 22);
            ctx.fillRect(left + w + 18, top + 18, 12, h - 32);
            // Cockpit armored cyan windshield
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(left + w - 16, top + 10, 28, 10);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(left + w - 12, top + 11, 20, 3);
            // Piercing headlight beam
            ctx.fillStyle = 'rgba(254, 240, 138, 0.24)';
            ctx.beginPath();
            ctx.moveTo(left + w + 30, top + 24);
            ctx.lineTo(left + w + 190, top - 10);
            ctx.lineTo(left + w + 190, top + 64);
            ctx.closePath();
            ctx.fill();
          }

          // Rear Artillery Car Afterburner Thrusters
          if (isRearCar && !isImpact) {
            const jetLen = 22 + (tick % 4) * 6;
            ctx.fillStyle = '#f97316';
            ctx.fillRect(left - jetLen, top + 16, jetLen, 14);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(left - Math.round(jetLen * 0.65), top + 19, Math.round(jetLen * 0.65), 8);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(left - 10, top + 21, 10, 4);
          }

          // Illuminated pixel passenger / plasma-reactor windows & vertical steel ribs
          for (let wx = left + 18; wx < left + w - 28; wx += 32) {
            // Vertical rivet rib
            ctx.fillStyle = '#090d16';
            ctx.fillRect(wx - 6, top + 6, 3, h - 20);
            // Window frame
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(wx, top + 16, 20, 11);
            ctx.fillStyle = '#7dd3fc';
            ctx.fillRect(wx + 2, top + 17, 16, 4);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(wx + 4, top + 18, 6, 2);
          }

          // Hazard stripes & non-slip roof walkway
          ctx.fillStyle = '#facc15';
          ctx.fillRect(left, top, w, 3);
          ctx.fillRect(left + 4, top + 34, w - 8, 3);
          ctx.fillStyle = '#05070d';
          for (let hx = left + 8; hx < left + w - 12; hx += 12) {
            ctx.fillRect(hx, top + 34, 6, 3);
          }
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(left + 2, top, w - 4, 1);

          // Undercarriage Maglev Bogies, Coils & High-Speed Rail Sparks
          ctx.fillStyle = '#020617';
          ctx.fillRect(left + 10, top + h - 14, w - 20, 14);
          ctx.fillStyle = '#334155';
          for (let bx = left + 22; bx < left + w - 30; bx += 44) {
            ctx.fillRect(bx, top + h - 12, 28, 10);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(bx + 6, top + h - 8, 16, 3);
            ctx.fillStyle = '#334155';
          }
          if (!isImpact && tick % 2 === 0) {
            ctx.fillStyle = '#fde047';
            const sx = left + 18 + ((tick * 23) % Math.max(20, w - 36));
            ctx.fillRect(sx, top + h - 2, 10, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx + 2, top + h - 2, 4, 2);
          }
        } else if (p.style === 'holo') {
          // ===================================================================
          // CYBER-GRID 3D: Cyberpunk Steel-Girders, Server Cells & Neon Deck
          // ===================================================================
          ctx.fillStyle = '#070b19';
          ctx.fillRect(left, top, w, h);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(left, top, w, h);

          // Pixel circuit modules & animated data LEDs along the girder
          for (let cx = left + 10; cx < left + w - 28; cx += 32) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(cx, top + 6, 24, h - 12);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx + 2, top + 8, 20, 6);
            const ledOn = ((cx + Math.floor(tick * 0.25) * 8) % 32) < 16;
            ctx.fillStyle = ledOn ? '#22d3ee' : '#ec4899';
            ctx.fillRect(cx + 4, top + 18, 6, 4);
            ctx.fillRect(cx + 14, top + 18, 6, 4);
          }
          // Downward hover-thruster pods on outer ends & center
          for (const podOff of [left + 28, Math.round(p.x), left + w - 28]) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(podOff - 14, top + h, 28, 8);
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(podOff - 10, top + h + 8, 20, 4 + (tick % 3) * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(podOff - 5, top + h + 8, 10, 3);
          }
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left + 4, top, w - 8, 1);
        } else if (p.style === 'obsidian') {
          // ===================================================================
          // TWIN ABYSS RIFT: Jagged Volcanic Obsidian Fortress & Crystal Teeth
          // ===================================================================
          ctx.fillStyle = isImpact ? '#1e293b' : '#061014';
          ctx.fillRect(left, top, w, h);

          // Layered volcanic basalt courses with glowing emerald ley-lines
          const courseH = 16;
          for (let row = 0; row < Math.min(9, Math.floor(h / courseH)); row++) {
            const ry = top + 4 + row * courseH;
            const stagger = (row % 2) * 18;
            for (let bx = left + 4; bx < left + w - 8; bx += 36) {
              const bw = Math.min(34, left + w - 4 - bx);
              ctx.fillStyle = row === 0 ? '#112830' : row % 2 === 0 ? '#0b1c22' : '#081419';
              ctx.fillRect(bx + (stagger % 6), ry, bw, courseH - 2);
              ctx.fillStyle = '#16353d';
              ctx.fillRect(bx + (stagger % 6), ry, bw, 2);
              if (row === 1 && ((bx - left) / 36) % 2 === 0) {
                ctx.fillStyle = '#10b981';
                ctx.fillRect(bx + 8, ry + 5, 14, 3);
              }
            }
          }
          // Glowing emerald crystal stalactites jutting from the cliff sides
          ctx.fillStyle = '#10b981';
          ctx.fillRect(left - 4, top + 14, 4, 24);
          ctx.fillRect(left + w, top + 14, 4, 24);
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#a7f3d0';
          ctx.fillRect(left + 3, top, w - 6, 1);
        } else if (p.style === 'gold') {
          // ===================================================================
          // MÖBIUS CONTINUUM: Ornate Gilded Astral Marble & Clockwork Frieze
          // ===================================================================
          ctx.fillStyle = '#170d2e';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#2e1065';
          ctx.fillRect(left + 4, top + 5, w - 8, h - 10);
          // Golden Greek-key / celestial filigree frieze blocks
          for (let gx = left + 12; gx < left + w - 20; gx += 24) {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(gx, top + 9, 18, 12);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(gx + 2, top + 11, 14, 3);
            ctx.fillRect(gx + 6, top + 16, 6, 4);
            ctx.fillStyle = '#c084fc';
            ctx.fillRect(gx + 7, top + 12, 4, 4);
          }
          // Stepped golden corbel base underneath
          ctx.fillStyle = '#78350f';
          ctx.fillRect(left + 16, top + h, w - 32, 8);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(left + 4, top, w - 8, 1);
        } else {
          // ===================================================================
          // STONE & WOOD MAIN FOUNDATIONS (Crimson Torii, Cloud Pagoda, Coliseum)
          // ===================================================================
          const isWood = p.style === 'wood';
          const isColiseum = stage.id === 'coliseum';

          // Deep solid foundation body
          ctx.fillStyle = isImpact ? '#1e293b' : isColiseum ? '#1c0d08' : isWood ? '#1c110d' : '#0c1322';
          ctx.fillRect(left, top, w, h);

          // Top heavy curb stones / temple timber beam
          const brickW = isColiseum ? 40 : 32;
          for (let bx = left; bx < left + w; bx += brickW) {
            const bw = Math.min(brickW - 2, left + w - bx);
            ctx.fillStyle = isColiseum ? '#3b1a10' : isWood ? '#451a03' : '#1e293b';
            ctx.fillRect(bx + 1, top + 3, bw, 12);
            ctx.fillStyle = isColiseum ? '#5c2818' : isWood ? '#78350f' : '#334155';
            ctx.fillRect(bx + 2, top + 4, bw - 2, 3);
          }

          // Multi-course pixel masonry wall extending down
          for (let row = 1; row < 8; row++) {
            const ry = top + 6 + row * 16;
            if (ry >= top + h - 8) break;
            const stagger = (row % 2) * (brickW * 0.5);
            for (let bx = left + 4; bx < left + w - 8; bx += brickW) {
              const bw = Math.min(brickW - 2, left + w - 4 - bx);
              const shade = (bx + row * 17) % 3 === 0;
              ctx.fillStyle = isColiseum
                ? shade ? '#2a120b' : '#33160e'
                : isWood
                ? shade ? '#27150e' : '#311b12'
                : shade ? '#111c30' : '#17253d';
              ctx.fillRect(bx + (stagger % 8), ry, bw, 14);
              ctx.fillStyle = isColiseum ? '#472014' : isWood ? '#4d2719' : '#263859';
              ctx.fillRect(bx + (stagger % 8), ry, bw, 2);
            }
          }

          // Outer reinforced stone corner buttresses (shows solid vertical cliff walls!)
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left, top, 4, Math.min(90, h));
          ctx.fillRect(left + w - 4, top, 4, Math.min(90, h));

          // Top surface trim & accent line
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(left + 3, top, w - 6, 1);
        }
      } else {
        // =====================================================================
        // ELEVATED & MOVING SOLID PIXEL-ART PLATFORMS (Eaves, Bridges, Drones)
        // =====================================================================
        if (p.style === 'wood') {
          // Japanese Shrine / Pagoda Timber Eave Platform with Curved Ends & Brackets
          ctx.fillStyle = '#27120b';
          ctx.fillRect(left, top, w, h);
          // Upturned eave tips
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left - 4, top - 2, 6, 4);
          ctx.fillRect(left + w - 2, top - 2, 6, 4);
          // Interlocking timber blocks (Dougong brackets)
          ctx.fillStyle = '#451a03';
          for (let tx = left + 4; tx < left + w - 8; tx += 16) {
            ctx.fillRect(tx, top + 3, 12, h - 5);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(tx + 1, top + 4, 10, 2);
            ctx.fillStyle = '#451a03';
          }
          // Underside solid beam so players clearly see it is a solid physical block
          ctx.fillStyle = '#0f0705';
          ctx.fillRect(left + 2, top + h - 2, w - 4, 2);
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left, top, w, 2.5);
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(left + 2, top, w - 4, 1);
        } else if (p.style === 'gold') {
          // Gilded Tribune / Celestial Platform with Winged Trim
          ctx.fillStyle = '#451a03';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(left + 2, top + 2, w - 4, h - 4);
          for (let gx = left + 8; gx < left + w - 12; gx += 16) {
            ctx.fillStyle = '#fde047';
            ctx.fillRect(gx, top + 4, 10, 3);
          }
          ctx.fillStyle = '#facc15';
          ctx.fillRect(left - 2, top, w + 4, 2.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left + 2, top, w - 4, 1);
        } else if (p.style === 'obsidian') {
          // Floating Obsidian Rune Slab with Crystal Underside Teeth
          ctx.fillStyle = '#061217';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#112a32';
          ctx.fillRect(left + 3, top + 3, w - 6, h - 5);
          // Glowing rune slots
          ctx.fillStyle = '#10b981';
          for (let rx = left + 10; rx < left + w - 14; rx += 20) {
            ctx.fillRect(rx, top + 5, 10, 3);
          }
          // Hanging crystal teeth underneath
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(left + 16, top + h, 10, 5);
          ctx.fillRect(left + w - 26, top + h, 10, 5);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(left, top, w, 2.5);
          ctx.fillStyle = '#a7f3d0';
          ctx.fillRect(left + 2, top, w - 4, 1);
        } else if (p.style === 'holo') {
          // Cyberpunk Hover-Drone Platform
          ctx.fillStyle = '#090d1e';
          ctx.fillRect(left, top, w, h);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(left, top, w, h);
          ctx.fillStyle = '#ec4899';
          for (let hx = left + 8; hx < left + w - 12; hx += 18) {
            ctx.fillRect(hx, top + 4, 10, 3);
          }
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(left, top, w, 2.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left + 2, top, w - 4, 1);
        } else if (p.style === 'train') {
          // Overhead Catenary Spoiler / Pantograph Deck
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#334155';
          for (let tx = left + 6; tx < left + w - 10; tx += 14) {
            ctx.fillRect(tx, top + 3, 8, h - 5);
          }
          ctx.fillStyle = '#facc15';
          ctx.fillRect(left, top, w, 2.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left + 2, top, w - 4, 1);
        } else {
          // Carved Stone Bastion Deck
          ctx.fillStyle = '#1c1917';
          ctx.fillRect(left, top, w, h);
          for (let sx = left + 4; sx < left + w - 10; sx += 18) {
            ctx.fillStyle = '#334155';
            ctx.fillRect(sx, top + 3, 14, h - 5);
          }
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left, top, w, 2.5);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(left + 2, top, w - 4, 1);
        }

        // Thruster / pulley glow under moving platforms
        if (rawPlat.motion && !isImpact) {
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(Math.round(p.x - 12), top + h, 24, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(p.x - 5), top + h + 1, 10, 2);
        }
      }
    }

    // 5. Stage Updraft Jump Pads (Twin Abyss Rift, Titan Coliseum & Möbius Continuum)
    if (stage.jumpPads && !isImpact) {
      for (const pad of stage.jumpPads) {
        const px = Math.round(pad.x);
        const py = Math.round(pad.y);
        const hw = Math.round(pad.width * 0.5);
        // Pixel-art mechanical / rune jump pad housing
        ctx.fillStyle = '#090d16';
        ctx.fillRect(px - hw - 2, py - 4, pad.width + 4, 6);
        ctx.fillStyle = pad.color;
        ctx.fillRect(px - hw, py - 3, pad.width, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - hw + 4, py - 2, pad.width - 8, 2);
        // Rising animated pixel updraft wind chevrons
        for (let c = 0; c < 3; c++) {
          const lift = (tick * 1.4 + c * 11) % 32;
          const alpha = 1 - lift / 32;
          ctx.strokeStyle = pad.color;
          ctx.globalAlpha = alpha * 0.88;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(px - 10, py - 6 - lift);
          ctx.lineTo(px, py - 13 - lift);
          ctx.lineTo(px + 10, py - 6 - lift);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawKuroAnchor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    tick: number
  ): void {
    ctx.save();
    const pulse = 1 + Math.sin(tick * 0.25) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), 15 * pulse, 5 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Vertical void tether pillar
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y));
    ctx.lineTo(Math.round(x), Math.round(y - 26));
    ctx.stroke();
    ctx.fillStyle = '#f5d0fe';
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 18, 4, 14);
    ctx.restore();
  }

  private drawRiftSeal(ctx: CanvasRenderingContext2D, seal: RiftSeal, tick: number): void {
    if (seal.kind === 'raijin_rod') {
      ctx.save();
      const x = Math.round(seal.x);
      const y = Math.round(seal.y);
      // Base grounding ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Vertical Thunder Spire
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.lineTo(x, y - 22);
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.lineTo(x, y - 22);
      ctx.stroke();
      // Prongs
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 14);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x + 6, y - 14);
      ctx.stroke();
      // Crackling orb at apex
      ctx.fillStyle = tick % 4 < 2 ? '#ffffff' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y - 23, 3.5 + Math.sin(tick * 0.4) * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (seal.kind === 'chrono_echo') {
      ctx.save();
      const x = Math.round(seal.x);
      const y = Math.round(seal.y);
      ctx.globalAlpha = 0.72 + Math.sin(tick * 0.25) * 0.15;
      // Clockwork floor glyph
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, y + 16, 15, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Holographic temporal silhouette of Chrono
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y - 24, 5.2, 0, Math.PI * 2);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y);
      ctx.lineTo(x - 6, y + 16);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y + 16);
      ctx.moveTo(x - 9, y - 11);
      ctx.lineTo(x + 9, y - 11);
      ctx.stroke();
      // Rotating miniature clock hands on chest
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + Math.cos(tick * 0.15) * 8, y - 11 + Math.sin(tick * 0.15) * 8);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(Math.round(seal.x), Math.round(seal.y));
    ctx.rotate(tick * 0.05);
    ctx.strokeStyle = seal.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeStyle = '#a7f3d0';
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5 + Math.sin(tick * 0.25) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRaijinRodNetwork(
    ctx: CanvasRenderingContext2D,
    seals: RiftSeal[],
    tick: number
  ): void {
    const rods = seals.filter((s) => s.kind === 'raijin_rod');
    if (rods.length < 2) return;
    ctx.save();
    for (let i = 0; i < rods.length - 1; i++) {
      const a = rods[i];
      const b = rods[i + 1];
      const ax = a.x;
      const ay = a.y - 20;
      const bx = b.x;
      const by = b.y - 20;
      // Outer electric glow
      ctx.strokeStyle = tick % 2 === 0 ? '#38bdf8' : '#facc15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(Math.round(ax), Math.round(ay));
      const steps = 6;
      for (let s = 1; s < steps; s++) {
        const u = s / steps;
        const jx = lerp(ax, bx, u) + Math.sin(tick * 0.7 + s * 2.1) * 5;
        const jy = lerp(ay, by, u) + Math.cos(tick * 0.6 + s * 1.7) * 5;
        ctx.lineTo(Math.round(jx), Math.round(jy));
      }
      ctx.lineTo(Math.round(bx), Math.round(by));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawStasisField(ctx: CanvasRenderingContext2D, sf: StasisField, tick: number): void {
    ctx.save();
    const x = Math.round(sf.x);
    const y = Math.round(sf.y);
    const r = sf.radius;
    const alpha = Math.min(1, sf.ttl / 25);

    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#14b8a6';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Clock dial ticks around perimeter
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6 + tick * 0.01;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * (r - 5), y + Math.sin(ang) * (r - 5));
      ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      ctx.stroke();
    }

    // Rotating hour & minute hands inside dome
    const hAng = tick * 0.03;
    const mAng = -tick * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(hAng) * (r * 0.45), y + Math.sin(hAng) * (r * 0.45));
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(mAng) * (r * 0.72), y + Math.sin(mAng) * (r * 0.72));
    ctx.stroke();
    ctx.restore();
  }

  private drawPortalPair(ctx: CanvasRenderingContext2D, pr: PortalPair, tick: number): void {
    ctx.save();
    const alpha = Math.min(1, pr.ttl / 24);
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.round(pr.ax), Math.round(pr.ay));
    ctx.lineTo(Math.round(pr.bx), Math.round(pr.by));
    ctx.stroke();
    ctx.setLineDash([]);

    const gates = [
      { x: pr.ax, y: pr.ay, col: '#ec4899', sec: '#38bdf8' },
      { x: pr.bx, y: pr.by, col: '#38bdf8', sec: '#ec4899' },
    ];
    for (const g of gates) {
      const gx = Math.round(g.x);
      const gy = Math.round(g.y);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(gx, gy, 9, 19, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = g.col;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 10 + Math.sin(tick * 0.2) * 1.5, 20, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = g.sec;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 6, 13, 0, tick * 0.15, tick * 0.15 + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawObservationForesight(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    tick: number
  ): void {
    for (let i = 0; i < 2; i++) {
      const kenji = fighters[i];
      if (kenji.id !== 'kenji') continue;
      const foe = fighters[1 - i];
      if (
        foe.action === 'strong_charge' ||
        (foe.action === 'attack' && foe.currentMove && foe.actionFrame < foe.currentMove.startup)
      ) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const r = 24 + Math.sin(tick * 0.4) * 3;
        ctx.beginPath();
        ctx.arc(Math.round(foe.x), Math.round(foe.y - 10), r, 0, Math.PI * 2);
        ctx.stroke();
        // Danger crosshair ticks
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.round(foe.x - r - 4), Math.round(foe.y - 10));
        ctx.lineTo(Math.round(foe.x - r + 3), Math.round(foe.y - 10));
        ctx.moveTo(Math.round(foe.x + r - 3), Math.round(foe.y - 10));
        ctx.lineTo(Math.round(foe.x + r + 4), Math.round(foe.y - 10));
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Character-distinct base stance & detailed 3-phase frame-accurate keyframe poses
  private computePose(
    action: FighterAction,
    move: MoveData | null,
    moveKey: MoveKey | null,
    frame: number,
    facing: 1 | -1,
    vx: number,
    vy: number,
    grounded: boolean,
    weaponType: WeaponType,
    ultPose?: FighterState['ultPose']
  ): SkeletonPose {
    const bulk = weaponType === 'titan' ? 1.24 : 1.0;
    const t = frame * 0.14;

    // 1. Character-Specific Neutral Base Stance
    let base: SkeletonPose = {
      hip: { x: 0, y: -1 },
      spine: { x: 1, y: -8 },
      chest: { x: 1.5, y: -15 },
      head: { x: 2.5, y: -25 },
      shoulderF: { x: 3 * bulk, y: -14 },
      elbowF: { x: 7.5 * bulk, y: -10 },
      handF: { x: 13 * bulk, y: -8 },
      shoulderB: { x: -2.5 * bulk, y: -14 },
      elbowB: { x: -6.5 * bulk, y: -10 },
      handB: { x: -10 * bulk, y: -6 },
      kneeF: { x: 6, y: 8 },
      footF: { x: 8.5, y: 18 },
      kneeB: { x: -5, y: 8 },
      footB: { x: -8.5, y: 18 },
      weaponAngle: -0.35,
      weaponReach: 15,
      smearAlpha: 0,
      smearSpan: 0,
    };

    if (weaponType === 'dagger') {
      // Kuro: Low stealth ninja stance, reverse-grip kunai behind back, front hand in shadow sign
      base = {
        ...base,
        hip: { x: -1, y: 1 },
        spine: { x: 2, y: -6 },
        chest: { x: 4, y: -13 },
        head: { x: 5.5, y: -22 },
        elbowF: { x: 9, y: -9 },
        handF: { x: 12, y: -14 },
        elbowB: { x: -7, y: -9 },
        handB: { x: -12, y: -5 },
        kneeF: { x: 8, y: 9 },
        footF: { x: 10, y: 18 },
        kneeB: { x: -7, y: 9 },
        footB: { x: -10, y: 18 },
        weaponAngle: 2.5, // Reverse-grip blade angle
        weaponReach: 13,
      };
    } else if (weaponType === 'gauntlet') {
      // Velo: Dynamic rhythmic boxer/speedster guard
      const bounce = Math.abs(Math.sin(t * 1.4)) * 1.8;
      base = {
        ...base,
        hip: { x: 0, y: -1 - bounce * 0.6 },
        spine: { x: 1.5, y: -8 - bounce * 0.8 },
        chest: { x: 2.5, y: -15 - bounce },
        head: { x: 4, y: -24.5 - bounce },
        elbowF: { x: 7, y: -9 - bounce },
        handF: { x: 12.5, y: -15 - bounce },
        elbowB: { x: -3, y: -9 - bounce },
        handB: { x: 5, y: -13 - bounce },
        kneeF: { x: 6, y: 8 },
        footF: { x: 9, y: 18 - (bounce > 1.2 ? 1 : 0) },
        kneeB: { x: -6, y: 8 },
        footB: { x: -9, y: 18 },
        weaponAngle: -0.2,
        weaponReach: 10,
      };
    } else if (weaponType === 'katana') {
      // Kenji: Calm Iaido samurai posture, hand resting on katana hilt at left hip
      base = {
        ...base,
        hip: { x: 0, y: -2 },
        spine: { x: 0.5, y: -9 },
        chest: { x: 1, y: -16 },
        head: { x: 2, y: -26 },
        elbowF: { x: 4, y: -9 },
        handF: { x: 3, y: -3 },
        elbowB: { x: -5, y: -9 },
        handB: { x: -2, y: -2 },
        kneeF: { x: 5.5, y: 8 },
        footF: { x: 7.5, y: 18 },
        kneeB: { x: -5.5, y: 8 },
        footB: { x: -7.5, y: 18 },
        weaponAngle: 2.75,
        weaponReach: 21,
        sheathed: true,
      };
    } else if (weaponType === 'titan') {
      // Bram: Heavy brawler stance with wide shoulders and grounded knees
      base = {
        ...base,
        hip: { x: 0, y: 0 },
        spine: { x: 1, y: -8 },
        chest: { x: 2, y: -15 },
        head: { x: 3.5, y: -24.5 },
        shoulderF: { x: 5, y: -14 },
        elbowF: { x: 10, y: -8 },
        handF: { x: 15, y: -12 },
        shoulderB: { x: -5, y: -14 },
        elbowB: { x: -9, y: -8 },
        handB: { x: -4, y: -11 },
        kneeF: { x: 8, y: 9 },
        footF: { x: 11, y: 18 },
        kneeB: { x: -8, y: 9 },
        footB: { x: -11, y: 18 },
        weaponAngle: -0.3,
        weaponReach: 12,
      };
    } else if (weaponType === 'spear') {
      // Raijin: Wide martial dragoon stance holding Thunder Naginata diagonally across body
      base = {
        ...base,
        hip: { x: 0, y: 0 },
        spine: { x: 1.5, y: -8 },
        chest: { x: 2.5, y: -15 },
        head: { x: 3.5, y: -25 },
        elbowF: { x: 8, y: -10 },
        handF: { x: 14, y: -11 },
        elbowB: { x: -6, y: -8 },
        handB: { x: -4, y: -5 },
        kneeF: { x: 8.5, y: 8 },
        footF: { x: 11.5, y: 18 },
        kneeB: { x: -7.5, y: 8 },
        footB: { x: -10.5, y: 18 },
        weaponAngle: -0.32,
        weaponReach: 25,
      };
    } else if (weaponType === 'scythe') {
      // Chrono: Aristocratic reaper stance with Great-Scythe draped behind shoulder
      base = {
        ...base,
        hip: { x: 0, y: -2 },
        spine: { x: 0, y: -9.5 },
        chest: { x: 0.5, y: -16.5 },
        head: { x: 1.5, y: -26.5 },
        elbowF: { x: 5, y: -12 },
        handF: { x: 8, y: -16 },
        elbowB: { x: -6, y: -12 },
        handB: { x: -9, y: -7 },
        kneeF: { x: 5, y: 8 },
        footF: { x: 7, y: 18 },
        kneeB: { x: -5, y: 8 },
        footB: { x: -7, y: 18 },
        weaponAngle: -2.15,
        weaponReach: 24,
      };
    } else if (weaponType === 'chains') {
      // Sol: Feral pyromancer crouch with glowing Meteor Chains coiled around forearms
      base = {
        ...base,
        hip: { x: -1, y: 1 },
        spine: { x: 2, y: -6.5 },
        chest: { x: 4, y: -13.5 },
        head: { x: 5.5, y: -23 },
        elbowF: { x: 9, y: -8 },
        handF: { x: 15, y: -10 },
        elbowB: { x: -6, y: -8 },
        handB: { x: -11, y: -5 },
        kneeF: { x: 8, y: 9 },
        footF: { x: 11, y: 18 },
        kneeB: { x: -7, y: 9 },
        footB: { x: -10, y: 18 },
        weaponAngle: 0.15,
        weaponReach: 22,
      };
    } else if (weaponType === 'orbs') {
      // Nyx: Effortless mid-air levitation posture with one knee tucked and hands channeling Prism Orbs
      const floatY = Math.sin(t * 1.1) * 2.2 - 3.5;
      base = {
        ...base,
        hip: { x: 0, y: floatY },
        spine: { x: 0.5, y: -8 + floatY },
        chest: { x: 1, y: -15 + floatY },
        head: { x: 2, y: -25 + floatY },
        elbowF: { x: 7, y: -12 + floatY },
        handF: { x: 13, y: -15 + floatY },
        elbowB: { x: -6, y: -12 + floatY },
        handB: { x: -10, y: -15 + floatY },
        kneeF: { x: 5, y: 5 + floatY },
        footF: { x: 2, y: 12 + floatY },
        kneeB: { x: -3, y: 7 + floatY },
        footB: { x: -5, y: 15 + floatY },
        weaponAngle: 0,
        weaponReach: 20,
      };
    } else if (weaponType === 'claws') {
      // Jin: Puppet master stance with raised fingers manipulating chakra threads
      base = {
        ...base,
        hip: { x: -1, y: -1 },
        spine: { x: 0.5, y: -8.5 },
        chest: { x: 2, y: -15.5 },
        head: { x: 3.5, y: -25 },
        elbowF: { x: 8, y: -13 },
        handF: { x: 14, y: -18 },
        elbowB: { x: -4, y: -12 },
        handB: { x: 4, y: -16 },
        kneeF: { x: 6, y: 8 },
        footF: { x: 8.5, y: 18 },
        kneeB: { x: -6, y: 8 },
        footB: { x: -8.5, y: 18 },
        weaponAngle: -0.25,
        weaponReach: 16,
      };
    }

    if (action === 'idle') {
      const breath = Math.sin(t * 0.72) * 1.15;
      const sway = Math.cos(t * 0.36) * 0.75;
      base.hip.x += sway * 0.45;
      base.hip.y += Math.max(0, breath * 0.35);
      base.spine.x += sway * 0.65;
      base.spine.y += breath * 0.6;
      base.chest.x += sway * 0.85;
      base.chest.y += breath;
      base.head.x += sway;
      base.head.y += breath * 1.05;
      base.shoulderF.y += breath * 0.9;
      base.shoulderB.y += breath * 0.9;
      base.elbowF.y += Math.sin(t * 0.72 - 0.4) * 0.9;
      base.handF.y += Math.sin(t * 0.72 - 0.6) * 1.25;
      base.elbowB.y -= Math.cos(t * 0.72) * 0.7;
      base.handB.y -= Math.cos(t * 0.72 - 0.3) * 1.0;
      base.kneeF.x += sway * 0.35;
      base.kneeB.x += sway * 0.25;
      return base;
    }

    if (action === 'walk' || action === 'dash') {
      const isDash = action === 'dash';
      const phase = frame * (isDash ? 0.28 : 0.18);
      const speedRatio = clamp01(Math.abs(vx) / (isDash ? 5.2 : 3.2));
      const intensity = (isDash ? 1.6 : 1.0) * (0.65 + speedRatio * 0.35);
      const loco = locomotionPose(base, phase, intensity);
      const stride = Math.sin(phase);
      return {
        ...loco,
        handF:
          isDash && weaponType === 'dagger'
            ? { x: -8.5, y: -5.5 }
            : loco.handF,
        weaponAngle: isDash ? 2.65 : -0.78 + stride * 0.14,
        sheathed: weaponType === 'katana' && !isDash ? true : false,
      };
    }

    if (action === 'parry') {
      // Crisp defensive deflection guard stance (`P` while standing still)
      const brace = easeOutCubic(Math.min(1, frame / 5));
      return blendPose(base, {
        ...base,
        hip: { x: -1.5, y: 0 },
        spine: { x: 0, y: -7.5 },
        chest: { x: 1, y: -14.5 },
        head: { x: 2.5, y: -24 },
        elbowF: { x: 8, y: -11 },
        handF: { x: 11, y: -17 },
        elbowB: { x: 4, y: -8 },
        handB: { x: 9, y: -13 },
        kneeF: { x: 7, y: 9 },
        footF: { x: 10, y: 18 },
        kneeB: { x: -7, y: 9 },
        footB: { x: -11, y: 18 },
        weaponAngle: -1.35, // Vertical/diagonal guard blade
        weaponReach: base.weaponReach + 2,
        sheathed: false,
      }, brace);
    }

    if (action === 'jump_squat') {
      const coil = easeOutCubic(Math.min(1, frame / 3));
      return blendPose(base, {
        ...base,
        hip: { x: -1.5, y: 4.5 },
        spine: { x: 1.5, y: -2.5 },
        chest: { x: 4, y: -9 },
        head: { x: 5.5, y: -18 },
        kneeF: { x: 9.5, y: 11.5 },
        kneeB: { x: -7.5, y: 11.5 },
        handF: { x: -5, y: 2 },
        handB: { x: -9, y: 0 },
      }, coil);
    }

    if (action === 'air' || action === 'airdodge') {
      // Continuous vertical velocity blend between rising tuck, apex float, and falling brace
      const riseFactor = clamp01((-vy + 1.5) / 4.5);
      const tilt = Math.max(-5, Math.min(5, vx * facing * 0.72));
      const vyStretch = Math.max(-3.0, Math.min(3.0, vy * 0.32));
      return {
        ...base,
        hip: { x: -tilt * 0.2, y: -2 },
        spine: { x: tilt * 0.5, y: -9 - vyStretch * 0.2 },
        chest: { x: tilt, y: -15.5 - vyStretch * 0.35 },
        head: { x: tilt + 1.8, y: -25 - vyStretch * 0.4 },
        kneeF: { x: 7.8 + tilt * 0.3, y: lerp(6.5, 1.5, riseFactor) },
        footF: { x: 4 + tilt * 0.2, y: lerp(15.5, 9.5, riseFactor) },
        kneeB: { x: -6 - tilt * 0.2, y: lerp(8.5, 4.5, riseFactor) },
        footB: { x: -9.5 - tilt * 0.3, y: lerp(16.5, 12.0, riseFactor) },
        elbowF: { x: 8 + tilt * 0.4, y: lerp(-12 + vyStretch * 0.5, -15, riseFactor) },
        handF: { x: 12.5 + tilt * 0.5, y: lerp(-14 + vyStretch * 0.7, -19.5, riseFactor) },
        elbowB: { x: -8, y: lerp(-11 + vyStretch * 0.5, -14, riseFactor) },
        handB: { x: -12.5, y: lerp(-10 + vyStretch * 0.7, -16.5, riseFactor) },
        weaponAngle: lerp(-0.42 + vyStretch * 0.08, -1.15, riseFactor),
        sheathed: false,
      };
    }

    if (action === 'hitstun') {
      // Dedicated 2.5D Ultimate Victim Choreography Poses (Smooth recoil & reaction curves)
      if (ultPose === 'ult_victim_gut') {
        const shudder = Math.sin(frame * 0.85) * 1.2;
        return {
          ...base,
          hip: { x: -4 + shudder, y: 2 },
          spine: { x: 2 + shudder, y: -4 },
          chest: { x: 8 + shudder, y: -9 },
          head: { x: 13 + shudder, y: -15 },
          elbowF: { x: 4, y: -3 },
          handF: { x: 1, y: 2 },
          elbowB: { x: -2, y: -4 },
          handB: { x: 0, y: 2 },
          kneeF: { x: 3, y: 10 },
          footF: { x: -2, y: 18 },
          kneeB: { x: -6, y: 11 },
          footB: { x: -11, y: 18 },
          weaponAngle: 1.4,
        };
      }
      if (ultPose === 'ult_victim_recoil') {
        const snap = Math.sin(frame * 0.48) * 3.0;
        return {
          ...base,
          hip: { x: -3, y: 0 },
          spine: { x: -7, y: -7 },
          chest: { x: -11 + snap * 0.5, y: -13 },
          head: { x: -16 + snap, y: -21 - Math.abs(snap) * 0.4 },
          elbowF: { x: 8, y: -18 },
          handF: { x: 15, y: -25 },
          elbowB: { x: -13, y: -15 },
          handB: { x: -20, y: -21 },
          kneeF: { x: 9, y: 8 },
          footF: { x: 14, y: 18 },
          kneeB: { x: -7, y: 9 },
          footB: { x: -12, y: 18 },
          weaponAngle: -2.4,
        };
      }
      if (ultPose === 'ult_victim_ground') {
        const bounce = Math.sin(frame * 0.65) * 1.2;
        return {
          ...base,
          hip: { x: 0, y: 11 + bounce },
          spine: { x: -8, y: 12 + bounce },
          chest: { x: -15, y: 11 + bounce },
          head: { x: -22, y: 13 + bounce },
          elbowF: { x: -12, y: 15 },
          handF: { x: -6, y: 18 },
          elbowB: { x: -19, y: 14 },
          handB: { x: -25, y: 17 },
          kneeF: { x: 9, y: 13 },
          footF: { x: 17, y: 17 },
          kneeB: { x: 7, y: 15 },
          footB: { x: 14, y: 18 },
          weaponAngle: 0.15,
        };
      }
      if (ultPose === 'ult_victim_air') {
        const spin = Math.sin(frame * 0.35) * 2.8;
        return {
          ...base,
          hip: { x: 0, y: -2 },
          spine: { x: -5, y: -8 },
          chest: { x: -9, y: -14 },
          head: { x: -14, y: -20 + spin * 0.5 },
          elbowF: { x: 6, y: -20 + spin },
          handF: { x: 12, y: -27 + spin },
          elbowB: { x: -14, y: -18 - spin },
          handB: { x: -21, y: -24 - spin },
          kneeF: { x: 8, y: 4 },
          footF: { x: 13, y: 11 },
          kneeB: { x: -8, y: 6 },
          footB: { x: -14, y: 13 },
          weaponAngle: -2.6,
        };
      }

      const recoil = Math.sin(frame * 0.65) * 1.4;
      const kbX = Math.max(-6, Math.min(6, -vx * facing * 0.55));
      const kbY = Math.max(-4, Math.min(5, -vy * 0.4));
      return {
        ...base,
        hip: { x: -2 + kbX * 0.3, y: -1 + kbY * 0.2 },
        spine: { x: -4.5 + kbX * 0.6, y: -7.5 + kbY * 0.5 },
        chest: { x: -6.8 + kbX + recoil, y: -13.5 + kbY * 0.8 },
        head: { x: -10 + kbX * 1.2 + recoil, y: -22 + kbY },
        elbowF: { x: 5 + kbX * 0.5, y: -16 + kbY },
        handF: { x: 10 + kbX * 0.8, y: -21 + kbY * 1.2 },
        elbowB: { x: -10 + kbX * 0.5, y: -12 + kbY },
        handB: { x: -15 + kbX * 0.8, y: -16 + kbY * 1.2 },
        kneeF: { x: 7 - kbX * 0.3, y: 6 - kbY * 0.4 },
        footF: { x: 11 - kbX * 0.5, y: 12 - kbY * 0.6 },
        kneeB: { x: -6 - kbX * 0.3, y: 9 },
        footB: { x: -10 - kbX * 0.5, y: 16 },
        weaponAngle: -2.25 + kbX * 0.08,
      };
    }

    if (action === 'kuro_suspend') {
      // Mid-air zero-gravity coiled assassin pose
      const hover = Math.sin(frame * 0.25) * 1.5;
      return {
        ...base,
        hip: { x: -2, y: 0 + hover },
        spine: { x: 2, y: -6 + hover },
        chest: { x: 5.5, y: -12 + hover },
        head: { x: 8, y: -20.5 + hover },
        kneeF: { x: 9.5, y: 3 + hover },
        footF: { x: 3, y: 11 + hover },
        kneeB: { x: -6.5, y: 5 + hover },
        footB: { x: -11, y: 13 + hover },
        elbowF: { x: 7, y: -17 + hover },
        handF: { x: 14, y: -22 + hover },
        elbowB: { x: -8, y: -14 + hover },
        handB: { x: -13, y: -18 + hover },
        weaponAngle: -1.85,
        weaponReach: base.weaponReach + 3,
      };
    }

    if (action === 'kenji_haki') {
      // Serene one-hand-on-katana-hilt Observation Haki focus stance
      return {
        ...base,
        hip: { x: 0, y: -1 },
        spine: { x: 0.5, y: -8.5 },
        chest: { x: 1.5, y: -15.5 },
        head: { x: 3, y: -25 },
        elbowF: { x: 5, y: -9 },
        handF: { x: 4, y: -3 },
        elbowB: { x: -5, y: -9 },
        handB: { x: -1, y: -3 },
        weaponAngle: 2.7,
        sheathed: true,
      };
    }

    if (action === 'strong_charge') {
      const coil = easeOutCubic(Math.min(1, frame / 10));
      const tremble = Math.sin(frame * 0.9) * 0.85;
      return blendPose(base, {
        ...base,
        hip: { x: -3 + tremble * 0.5, y: 1.5 },
        spine: { x: -4.5 + tremble, y: -6 },
        chest: { x: -6 + tremble, y: -12.5 },
        head: { x: -4 + tremble, y: -22 },
        elbowF: { x: -6, y: -11 },
        handF: { x: -11 + tremble, y: -15 },
        elbowB: { x: -12, y: -12 },
        handB: { x: -17 + tremble, y: -16 },
        kneeF: { x: 8, y: 9 },
        footF: { x: 12, y: 18 },
        kneeB: { x: -9, y: 9 },
        footB: { x: -13, y: 18 },
        weaponAngle: -2.65,
        weaponReach: base.weaponReach + 3,
        sheathed: weaponType === 'katana',
      }, coil);
    }

    if (action === 'taunt') {
      // Signature character taunt flourish pose!
      const wave = Math.sin(frame * 0.24);
      const bob = Math.cos(frame * 0.24) * 1.4;
      return {
        ...base,
        hip: { x: 0, y: -1 + bob * 0.5 },
        spine: { x: 1.5, y: -9 + bob * 0.5 },
        chest: { x: 3, y: -16 + bob },
        head: { x: 4.5, y: -26 + bob },
        elbowF: { x: 10, y: -18 + wave * 3 },
        handF: { x: 16, y: -26 + wave * 5 },
        elbowB: { x: -7, y: -12 },
        handB: { x: -4, y: -6 },
        kneeF: { x: 7, y: 8 },
        footF: { x: 10, y: 18 },
        kneeB: { x: -6, y: 9 },
        footB: { x: -9, y: 18 },
        weaponAngle: -Math.PI * 0.45 + wave * 0.45,
        weaponReach: base.weaponReach + 3,
        sheathed: weaponType === 'katana' && frame > 24,
      };
    }

    if (action === 'ultimate') {
      const p = ultPose ?? 'ult_charge';
      // Local beat frame inside Act III 30-frame beats (127..306)
      const beatLocal = frame >= 127 && frame <= 306 ? (frame - 127) % 30 : frame % 30;
      const beatSwing = easeInOutCubic(Math.min(1, beatLocal / 9));

      // 1. Act I Low-Angle Hero Charge Pose ('ult_charge')
      if (p === 'ult_charge') {
        const readyBlend = easeInOutCubic(clamp01((frame - 22) / 20));
        const breathe = Math.sin(frame * 0.18) * 1.4;
        if (weaponType === 'katana') {
          return {
            ...base,
            hip: { x: -2, y: 2.5 + breathe * 0.5 },
            spine: { x: 2, y: -5 + breathe * 0.5 },
            chest: { x: 5.5, y: -11.5 + breathe },
            head: { x: 8, y: -21 + breathe },
            elbowF: { x: 2, y: -5 },
            handF: { x: -1, y: 1 },
            elbowB: { x: -6, y: -6 },
            handB: { x: -4, y: 1 },
            kneeF: { x: 11, y: 10 },
            footF: { x: 15, y: 18 },
            kneeB: { x: -9, y: 11 },
            footB: { x: -14, y: 18 },
            weaponAngle: 2.78,
            weaponReach: base.weaponReach + 5,
            sheathed: true,
          };
        }
        return {
          ...base,
          hip: { x: -2, y: lerp(0, 2, readyBlend) + breathe * 0.5 },
          spine: { x: lerp(1, 3, readyBlend), y: -6 + breathe * 0.5 },
          chest: { x: lerp(3, 7, readyBlend), y: -13 + breathe },
          head: { x: lerp(4.5, 9, readyBlend), y: -23 + breathe },
          elbowF: { x: lerp(7, 14, readyBlend), y: lerp(-11, -20, readyBlend) },
          handF: { x: lerp(11, 21, readyBlend), y: lerp(-7, -28, readyBlend) },
          elbowB: { x: -9, y: -12 },
          handB: { x: -15, y: -16 },
          kneeF: { x: 10, y: 9 },
          footF: { x: 14, y: 18 },
          kneeB: { x: -8, y: 10 },
          footB: { x: -13, y: 18 },
          weaponAngle: lerpAngle(-2.35, -Math.PI * 0.42, readyBlend),
          weaponReach: base.weaponReach + 6,
          sheathed: false,
        };
      }

      // 2. Act II & Beat 3 High-Speed Sprint Pose ('ult_sprint')
      if (p === 'ult_sprint') {
        const cyc = frame * 0.36;
        const stride = Math.sin(cyc);
        const bob = Math.sin(cyc * 2 - 0.3) * 1.8;
        return {
          ...base,
          hip: { x: 4.5, y: 1.2 + bob },
          spine: { x: 9.5, y: -5.2 + bob },
          chest: { x: 13.5, y: -11.2 + bob },
          head: { x: 17, y: -19.8 + bob },
          kneeF: { x: 6.5 + stride * 11.5, y: 8 - Math.max(0, Math.cos(cyc)) * 5.2 },
          footF: { x: 4.5 + stride * 16.5, y: 18 - Math.max(0, Math.cos(cyc)) * 6.8 },
          kneeB: { x: 6.5 - stride * 11.5, y: 8 - Math.max(0, -Math.cos(cyc)) * 5.2 },
          footB: { x: 4.5 - stride * 16.5, y: 18 - Math.max(0, -Math.cos(cyc)) * 6.8 },
          elbowF: { x: 2 - stride * 7.5, y: -10 + bob },
          handF: { x: -7 - stride * 9.5, y: -12 + bob },
          elbowB: { x: 14 + stride * 6.5, y: -10 + bob },
          handB: { x: 21 + stride * 8.5, y: -12 + bob },
          weaponAngle: weaponType === 'katana' ? 2.85 : -2.6,
          weaponReach: base.weaponReach + 5,
          sheathed: weaponType === 'katana',
        };
      }

      // 3. Beat 0 Armor-Piercing Gut-Strike / Hilt-Smash ('ult_gut_strike')
      if (p === 'ult_gut_strike') {
        const coilPose: SkeletonPose = {
          ...base,
          hip: { x: -3, y: 2 },
          spine: { x: -4, y: -5 },
          chest: { x: -5, y: -12 },
          head: { x: -2, y: -21 },
          elbowF: { x: -8, y: -11 },
          handF: { x: -14, y: -13 },
          elbowB: { x: 6, y: -10 },
          handB: { x: 12, y: -12 },
          kneeF: { x: 9, y: 9 },
          footF: { x: 13, y: 18 },
          kneeB: { x: -9, y: 10 },
          footB: { x: -15, y: 18 },
          weaponAngle: -2.4,
          weaponReach: base.weaponReach + 4,
          sheathed: false,
        };
        const strikePose: SkeletonPose = {
          ...base,
          hip: { x: 7, y: 1 },
          spine: { x: 12, y: -6 },
          chest: { x: 16, y: -12 },
          head: { x: 19, y: -21 },
          elbowF: { x: 22, y: -10 },
          handF: { x: 33, y: -8 },
          elbowB: { x: -5, y: -11 },
          handB: { x: -13, y: -9 },
          kneeF: { x: 15, y: 8 },
          footF: { x: 21, y: 18 },
          kneeB: { x: -10, y: 10 },
          footB: { x: -17, y: 18 },
          weaponAngle: 0.05,
          weaponReach: base.weaponReach + 9,
          sheathed: false,
          smearAlpha: beatLocal < 14 ? 0.85 : 0.25,
          smearSpan: 1.8,
        };
        return blendStrikeSwingPose(coilPose, strikePose, beatSwing);
      }

      // 4. Beat 1 Cross-Up 2.5D Flank Spinning Kick / Reverse Cleave ('ult_flank_slash')
      if (p === 'ult_flank_slash') {
        const coilPose: SkeletonPose = {
          ...base,
          hip: { x: -2, y: 1 },
          spine: { x: -3, y: -6 },
          chest: { x: -4, y: -13 },
          head: { x: -1, y: -22 },
          elbowF: { x: -7, y: -14 },
          handF: { x: -13, y: -18 },
          elbowB: { x: 5, y: -11 },
          handB: { x: 11, y: -14 },
          kneeF: { x: 6, y: 6 },
          footF: { x: 4, y: 14 },
          kneeB: { x: -6, y: 9 },
          footB: { x: -10, y: 18 },
          weaponAngle: 2.2,
          weaponReach: base.weaponReach + 5,
          sheathed: false,
        };
        const strikePose: SkeletonPose = {
          ...base,
          hip: { x: 3, y: -2 },
          spine: { x: 7, y: -9 },
          chest: { x: 11, y: -15 },
          head: { x: 14, y: -24 },
          elbowF: { x: 19, y: -18 },
          handF: { x: 29, y: -22 },
          elbowB: { x: -8, y: -14 },
          handB: { x: -16, y: -18 },
          kneeF: { x: 15, y: -2 },
          footF: { x: 26, y: -6 },
          kneeB: { x: -4, y: 9 },
          footB: { x: -7, y: 18 },
          weaponAngle: -0.58,
          weaponReach: base.weaponReach + 10,
          sheathed: false,
          smearAlpha: beatLocal < 14 ? 0.88 : 0.25,
          smearSpan: 2.2,
        };
        return blendStrikeSwingPose(coilPose, strikePose, beatSwing);
      }

      // 5. Beat 2 Close-Quarters Martial & Weapon Combination ('ult_rapid_flurry')
      if (p === 'ult_rapid_flurry') {
        // Smooth continuous 3-hit martial-arts combination over the 30-frame beat (10 frames per strike)
        const comboPhase = (beatLocal % 10) / 10;
        const strikeIdx = Math.floor(beatLocal / 10) % 3;
        const swingCurve = Math.sin(comboPhase * Math.PI);
        const alt = strikeIdx === 1 ? -1 : 1;
        const isKick = strikeIdx === 2;
        return {
          ...base,
          hip: { x: 3 + swingCurve * 3.5, y: 0 },
          spine: { x: 7 + swingCurve * 4, y: -7.5 },
          chest: { x: 10.5 + swingCurve * 5, y: -13.5 },
          head: { x: 13 + swingCurve * 4.5, y: -22.5 },
          elbowF: { x: 10 + swingCurve * 12, y: -12 + alt * 4 * swingCurve },
          handF: { x: 16 + swingCurve * 16, y: -10 + alt * 8 * swingCurve },
          elbowB: { x: 10 - swingCurve * 8, y: -11 - alt * 3 * swingCurve },
          handB: { x: 16 - swingCurve * 12, y: -9 - alt * 6 * swingCurve },
          kneeF: {
            x: isKick ? 8 + swingCurve * 10 : 11,
            y: isKick ? 8 - swingCurve * 9 : 8,
          },
          footF: {
            x: isKick ? 12 + swingCurve * 16 : 16,
            y: isKick ? 18 - swingCurve * 22 : 18,
          },
          kneeB: { x: -8, y: 9 },
          footB: { x: -14, y: 18 },
          weaponAngle: lerpAngle(-1.6 * alt, 0.55 * alt, easeInOutCubic(comboPhase)),
          weaponReach: base.weaponReach + 5 + swingCurve * 5,
          sheathed: false,
          smearAlpha: 0.35 + swingCurve * 0.55,
          smearSpan: 1.9,
        };
      }

      // 6. Beat 4 Overhead Earth-Shattering Slam ('ult_heavy_slam')
      if (p === 'ult_heavy_slam') {
        const highRaisePose: SkeletonPose = {
          ...base,
          hip: { x: -1, y: -3 },
          spine: { x: 1, y: -11 },
          chest: { x: 3, y: -19 },
          head: { x: 5, y: -28 },
          elbowF: { x: 4, y: -26 },
          handF: { x: 2, y: -36 },
          elbowB: { x: -2, y: -24 },
          handB: { x: -4, y: -34 },
          kneeF: { x: 9, y: 4 },
          footF: { x: 6, y: 13 },
          kneeB: { x: -6, y: 6 },
          footB: { x: -10, y: 15 },
          weaponAngle: -2.1,
          weaponReach: base.weaponReach + 8,
          sheathed: false,
        };
        const slamPose: SkeletonPose = {
          ...base,
          hip: { x: 4, y: 3 },
          spine: { x: 9, y: -3 },
          chest: { x: 14, y: -8 },
          head: { x: 17, y: -16 },
          elbowF: { x: 18, y: -2 },
          handF: { x: 25, y: 8 },
          elbowB: { x: 12, y: -3 },
          handB: { x: 19, y: 7 },
          kneeF: { x: 13, y: 10 },
          footF: { x: 18, y: 18 },
          kneeB: { x: -9, y: 11 },
          footB: { x: -15, y: 18 },
          weaponAngle: 0.78,
          weaponReach: base.weaponReach + 11,
          sheathed: false,
          smearAlpha: beatLocal < 16 ? 0.92 : 0.25,
          smearSpan: 2.4,
        };
        return blendStrikeSwingPose(highRaisePose, slamPose, easeInOutCubic(Math.min(1, beatLocal / 12)));
      }

      // 7. Beat 5 Skyward Uppercut Launcher ('ult_launcher')
      if (p === 'ult_launcher') {
        const crouchCoil: SkeletonPose = {
          ...base,
          hip: { x: -2, y: 4 },
          spine: { x: 2, y: -3 },
          chest: { x: 5, y: -9 },
          head: { x: 7, y: -18 },
          elbowF: { x: 4, y: -3 },
          handF: { x: 8, y: 5 },
          elbowB: { x: -6, y: -5 },
          handB: { x: -10, y: 1 },
          kneeF: { x: 11, y: 11 },
          footF: { x: 15, y: 18 },
          kneeB: { x: -8, y: 11 },
          footB: { x: -13, y: 18 },
          weaponAngle: 1.25,
          weaponReach: base.weaponReach + 6,
          sheathed: false,
        };
        const launchPose: SkeletonPose = {
          ...base,
          hip: { x: 2, y: -4 },
          spine: { x: 5, y: -12 },
          chest: { x: 8, y: -20 },
          head: { x: 10, y: -30 },
          elbowF: { x: 14, y: -26 },
          handF: { x: 18, y: -38 },
          elbowB: { x: -6, y: -14 },
          handB: { x: -12, y: -9 },
          kneeF: { x: 11, y: 2 },
          footF: { x: 14, y: 11 },
          kneeB: { x: -5, y: 8 },
          footB: { x: -8, y: 17 },
          weaponAngle: -1.35,
          weaponReach: base.weaponReach + 11,
          sheathed: false,
          smearAlpha: beatLocal < 15 ? 0.92 : 0.3,
          smearSpan: 2.5,
        };
        return blendStrikeSwingPose(crouchCoil, launchPose, easeOutCubic(Math.min(1, beatLocal / 10)));
      }

      // 8. Act IV Aerial Sky-Chase Pose ('ult_sky_chase')
      if (p === 'ult_sky_chase') {
        const wave = Math.sin(frame * 0.25) * 3;
        return {
          ...base,
          hip: { x: 2, y: -3 },
          spine: { x: 6, y: -11 },
          chest: { x: 10, y: -18 },
          head: { x: 13, y: -27 },
          elbowF: { x: 15, y: -22 + wave * 0.5 },
          handF: { x: 23, y: -28 + wave },
          elbowB: { x: -8, y: -15 },
          handB: { x: -15, y: -19 },
          kneeF: { x: 10, y: 1 },
          footF: { x: 6, y: 9 },
          kneeB: { x: -6, y: 5 },
          footB: { x: -11, y: 14 },
          weaponAngle: -0.95 + wave * 0.08,
          weaponReach: base.weaponReach + 8,
          sheathed: false,
        };
      }

      // 9. Act IV Foreground 2.5D Climax Pose ('ult_sheathe_climax')
      if (p === 'ult_sheathe_climax') {
        if (weaponType === 'katana') {
          return {
            ...base,
            hip: { x: 0, y: 0 },
            spine: { x: 1, y: -8 },
            chest: { x: 2, y: -15 },
            head: { x: 4, y: -24.5 },
            elbowF: { x: -5, y: -9 },
            handF: { x: -6, y: -2 },
            elbowB: { x: -8, y: -8 },
            handB: { x: -7, y: -2 },
            kneeF: { x: 7, y: 9 },
            footF: { x: 11, y: 18 },
            kneeB: { x: -7, y: 9 },
            footB: { x: -11, y: 18 },
            weaponAngle: 2.82,
            weaponReach: base.weaponReach + 4,
            sheathed: true,
          };
        }
        const tremble = Math.sin(frame * 0.65) * 1.1;
        return {
          ...base,
          hip: { x: -3 + tremble * 0.4, y: 1 },
          spine: { x: -4 + tremble, y: -7 },
          chest: { x: -5 + tremble, y: -14 },
          head: { x: -2 + tremble, y: -24 },
          elbowF: { x: 10, y: -24 },
          handF: { x: 16 + tremble, y: -35 },
          elbowB: { x: -10, y: -18 },
          handB: { x: -16 + tremble, y: -26 },
          kneeF: { x: 9, y: 8 },
          footF: { x: 13, y: 18 },
          kneeB: { x: -9, y: 9 },
          footB: { x: -13, y: 18 },
          weaponAngle: -1.65,
          weaponReach: base.weaponReach + 10,
          sheathed: false,
        };
      }

      // 10. Act V Cataclysmic Finisher Dive ('ult_finisher_dive')
      if (p === 'ult_finisher_dive') {
        return {
          ...base,
          hip: { x: 4, y: -2 },
          spine: { x: 9, y: -8 },
          chest: { x: 15, y: -13 },
          head: { x: 19, y: -20 },
          elbowF: { x: 22, y: -9 },
          handF: { x: 33, y: -3 },
          elbowB: { x: -7, y: -15 },
          handB: { x: -15, y: -20 },
          kneeF: { x: 12, y: 4 },
          footF: { x: 7, y: 12 },
          kneeB: { x: -9, y: 3 },
          footB: { x: -16, y: 10 },
          weaponAngle: 0.45,
          weaponReach: base.weaponReach + 12,
          sheathed: false,
          smearAlpha: 0.9,
          smearSpan: 2.5,
        };
      }

      // 11. Act V Full-Extension Cataclysmic Finisher Cleave ('ult_finisher_cleave')
      if (weaponType === 'katana') {
        return {
          ...base,
          hip: { x: 0, y: 0 },
          spine: { x: 1, y: -8 },
          chest: { x: 2, y: -15 },
          head: { x: 4, y: -24.5 },
          elbowF: { x: -6, y: -9 },
          handF: { x: -7, y: -1 },
          elbowB: { x: -8, y: -8 },
          handB: { x: -7, y: -2 },
          kneeF: { x: 7, y: 9 },
          footF: { x: 11, y: 18 },
          kneeB: { x: -7, y: 9 },
          footB: { x: -11, y: 18 },
          weaponAngle: 2.82,
          weaponReach: base.weaponReach + 4,
          sheathed: true,
        };
      }
      return {
        ...base,
        hip: { x: 6, y: 0 },
        spine: { x: 11, y: -7 },
        chest: { x: 15, y: -13 },
        head: { x: 18, y: -22 },
        elbowF: { x: 23, y: -12 },
        handF: { x: 34, y: -9 },
        elbowB: { x: -6, y: -11 },
        handB: { x: -14, y: -8 },
        kneeF: { x: 15, y: 8 },
        footF: { x: 21, y: 18 },
        kneeB: { x: -10, y: 10 },
        footB: { x: -17, y: 18 },
        weaponAngle: 0.08,
        weaponReach: base.weaponReach + 13,
        sheathed: false,
        smearAlpha: frame <= 405 ? 0.9 : 0,
        smearSpan: 2.5,
      };
    }

    // 2. Detailed 3-Phase Attack Keyframe System (Smooth Windup -> Curved Active Swing + Impact Hold -> Fluid Follow-Through)
    if (action === 'attack' && moveKey) {
      const startup = move?.startup ?? 8;
      const active = move?.active ?? 8;
      const recovery = move?.recovery ?? 14;

      // Authored (offset-based) poses win; moves not yet authored fall back to the legacy keyframes.
      const authored = getAuthoredMove(base, moveKey, weaponType, grounded);
      const windupPose = authored?.windup ?? this.getMoveWindupPose(base, moveKey, weaponType, grounded);
      const strikePose = authored?.strike ?? this.getMoveStrikePose(base, moveKey, weaponType, grounded);
      const followPose = authored?.follow ?? this.getMoveFollowPose(strikePose, moveKey, grounded);

      return sampleAttack(base, windupPose, strikePose, followPose, { startup, active, recovery }, frame, authored?.style);
    }

    return base;
  }

  private getMoveWindupPose(
    base: SkeletonPose,
    moveKey: MoveKey,
    weaponType: WeaponType,
    grounded: boolean
  ): SkeletonPose {
    switch (moveKey) {
      case 'jab1':
        return {
          ...base,
          chest: { x: -2, y: -15 },
          head: { x: 0, y: -25 },
          elbowF: { x: -4, y: -11 },
          handF: { x: -2, y: -12 },
          elbowB: { x: 4, y: -10 },
          handB: { x: 9, y: -12 },
          weaponAngle: -2.2,
        };
      case 'jab2':
        return {
          ...base,
          chest: { x: 2, y: -15 },
          elbowB: { x: -8, y: -12 },
          handB: { x: -12, y: -14 },
          elbowF: { x: 6, y: -8 },
          handF: { x: 10, y: -5 },
          weaponAngle: 1.8,
        };
      case 'jab3':
      case 'ftilt':
      case 'fstrong':
      case 'sspecial':
      case 'kenji_counter_slash':
        return {
          ...base,
          hip: { x: -3, y: 1 },
          spine: { x: -4, y: -6 },
          chest: { x: -5.5, y: -13 },
          head: { x: -2, y: -23 },
          elbowF: { x: -8, y: -12 },
          handF: { x: -14, y: -15 },
          elbowB: { x: -10, y: -10 },
          handB: { x: -15, y: -12 },
          kneeF: { x: 6, y: 9 },
          footF: { x: 10, y: 18 },
          kneeB: { x: -8, y: 9 },
          footB: { x: -13, y: 18 },
          weaponAngle: weaponType === 'katana' ? 2.8 : -2.6,
          sheathed: weaponType === 'katana',
        };
      case 'utilt':
      case 'uair':
      case 'ustrong':
      case 'uspecial':
        return {
          ...base,
          hip: { x: 0, y: 3 },
          spine: { x: 2, y: -4 },
          chest: { x: 4, y: -10 },
          head: { x: 5, y: -19 },
          elbowF: { x: 3, y: -4 },
          handF: { x: 6, y: 4 },
          elbowB: { x: -5, y: -5 },
          handB: { x: -8, y: 1 },
          kneeF: { x: 9, y: 11 },
          kneeB: { x: -7, y: 11 },
          weaponAngle: 1.2,
        };
      case 'dtilt':
      case 'dstrong':
        return {
          ...base,
          hip: { x: -2, y: 5 },
          spine: { x: 1, y: -2 },
          chest: { x: 3, y: -7 },
          head: { x: 5, y: -16 },
          elbowF: { x: -5, y: -3 },
          handF: { x: -10, y: 1 },
          kneeF: { x: 8, y: 12 },
          footF: { x: 6, y: 18 },
          weaponAngle: -2.4,
        };
      case 'dair':
      case 'kuro_suspend_dunk':
      case 'dspecial':
        return {
          ...base,
          hip: { x: -2, y: -4 },
          spine: { x: 0, y: -11 },
          chest: { x: 2, y: -18 },
          head: { x: 4, y: -27 },
          elbowF: { x: 4, y: -24 },
          handF: { x: 0, y: -31 },
          elbowB: { x: -4, y: -22 },
          handB: { x: -6, y: -28 },
          kneeF: { x: 9, y: 1 },
          footF: { x: 4, y: 8 },
          weaponAngle: -2.1,
        };
      case 'bair':
        return {
          ...base,
          chest: { x: 4, y: -14 },
          head: { x: 2, y: -24 },
          kneeB: { x: 2, y: 4 },
          footB: { x: 5, y: 10 },
          elbowB: { x: 4, y: -10 },
          handB: { x: 8, y: -8 },
          weaponAngle: -0.4,
        };
      default:
        return {
          ...base,
          chest: { x: -2, y: grounded ? -14 : -15 },
          elbowF: { x: -5, y: -12 },
          handF: { x: -9, y: -14 },
          weaponAngle: -2.2,
        };
    }
  }

  private getMoveStrikePose(
    base: SkeletonPose,
    moveKey: MoveKey,
    weaponType: WeaponType,
    grounded: boolean
  ): SkeletonPose {
    switch (moveKey) {
      case 'jab1':
        return {
          ...base,
          hip: { x: 2, y: -1 },
          spine: { x: 4.5, y: -8 },
          chest: { x: 7, y: -14.5 },
          head: { x: 8.5, y: -24 },
          shoulderF: { x: 9, y: -14 },
          elbowF: { x: 16, y: -13.5 },
          handF: { x: 25, y: -13 },
          elbowB: { x: -4, y: -10 },
          handB: { x: -9, y: -7 },
          footF: { x: 12, y: 18 },
          weaponAngle: -0.05,
          weaponReach: base.weaponReach + 4,
          smearSpan: 0.75,
        };
      case 'jab2':
        return {
          ...base,
          hip: { x: 3, y: -1 },
          spine: { x: 6, y: -8 },
          chest: { x: 8.5, y: -14.5 },
          head: { x: 10, y: -24 },
          elbowB: { x: 15, y: -14 },
          handB: { x: 24, y: -15 },
          elbowF: { x: 4, y: -9 },
          handF: { x: 19, y: -11 },
          footF: { x: 13.5, y: 18 },
          weaponAngle: -0.35,
          weaponReach: base.weaponReach + 5,
          smearSpan: 1.1,
        };
      case 'jab3':
        return {
          ...base,
          hip: { x: 4, y: -2 },
          spine: { x: 7, y: -9 },
          chest: { x: 9.5, y: -15 },
          head: { x: 11, y: -24.5 },
          elbowF: { x: 17, y: -16 },
          handF: { x: 26, y: -18 },
          elbowB: { x: -5, y: -9 },
          handB: { x: -11, y: -5 },
          kneeF: { x: 12, y: 4 },
          footF: { x: 21, y: 0 }, // High anime roundhouse / lunging finisher
          kneeB: { x: -6, y: 9 },
          footB: { x: -9, y: 18 },
          weaponAngle: -0.45,
          weaponReach: base.weaponReach + 6,
          smearSpan: 1.5,
        };
      case 'ftilt':
        return {
          ...base,
          hip: { x: 4, y: 0 },
          spine: { x: 7, y: -7.5 },
          chest: { x: 10, y: -14 },
          head: { x: 12, y: -23.5 },
          elbowF: { x: 18, y: -13 },
          handF: { x: 28, y: -11 },
          elbowB: { x: -5, y: -11 },
          handB: { x: -12, y: -8 },
          kneeF: { x: 11, y: 8 },
          footF: { x: 16, y: 18 },
          footB: { x: -12, y: 18 },
          weaponAngle: 0.08,
          weaponReach: base.weaponReach + 7,
          smearSpan: 1.4,
        };
      case 'utilt':
      case 'uair':
      case 'ustrong':
      case 'uspecial':
        return {
          ...base,
          hip: { x: 1, y: -3 },
          spine: { x: 2, y: -11 },
          chest: { x: 3, y: -18.5 },
          head: { x: 4, y: -28 },
          elbowF: { x: 7, y: -26 },
          handF: { x: 9, y: -36 },
          elbowB: { x: -4, y: -14 },
          handB: { x: -8, y: -9 },
          kneeF: { x: 7, y: grounded ? 7 : 3 },
          footF: { x: 9, y: grounded ? 17 : 11 },
          kneeB: { x: -6, y: grounded ? 8 : 10 },
          footB: { x: -9, y: grounded ? 18 : 16 },
          weaponAngle: -Math.PI * 0.52,
          weaponReach: base.weaponReach + 7,
          smearSpan: 1.7,
        };
      case 'dtilt':
      case 'dstrong':
        return {
          ...base,
          hip: { x: 2, y: 7 },
          spine: { x: 5, y: 1 },
          chest: { x: 8, y: -4.5 },
          head: { x: 10, y: -13.5 },
          elbowF: { x: 14, y: 1 },
          handF: { x: 24, y: 6 },
          elbowB: { x: -6, y: -1 },
          handB: { x: -12, y: 4 },
          kneeF: { x: 15, y: 12 },
          footF: { x: 26, y: 17 },
          kneeB: { x: -8, y: 13 },
          footB: { x: -13, y: 18 },
          weaponAngle: 0.32,
          weaponReach: base.weaponReach + 6,
          smearSpan: 1.4,
        };
      case 'dair':
      case 'kuro_suspend_dunk':
      case 'dspecial':
        return {
          ...base,
          hip: { x: 1, y: 1 },
          spine: { x: 4, y: -5 },
          chest: { x: 7, y: -10.5 },
          head: { x: 9, y: -19 },
          elbowF: { x: 11, y: 2 },
          handF: { x: 15, y: 16 },
          elbowB: { x: -4, y: -8 },
          handB: { x: -9, y: -13 },
          kneeF: { x: 8, y: 9 },
          footF: { x: 10, y: 20 },
          kneeB: { x: -6, y: 4 },
          footB: { x: -10, y: 11 },
          weaponAngle: Math.PI * 0.46,
          weaponReach: base.weaponReach + 7,
          smearSpan: 1.7,
        };
      case 'bair':
        return {
          ...base,
          hip: { x: -2, y: -1 },
          spine: { x: -4, y: -8 },
          chest: { x: -6, y: -14 },
          head: { x: -8, y: -23 },
          kneeB: { x: -14, y: -1 },
          footB: { x: -26, y: -3 },
          elbowB: { x: -13, y: -11 },
          handB: { x: -22, y: -10 },
          elbowF: { x: 6, y: -10 },
          handF: { x: 11, y: -7 },
          weaponAngle: Math.PI,
          weaponReach: base.weaponReach + 5,
          smearSpan: 1.4,
        };
      case 'nair': {
        const spin = -0.8;
        return {
          ...base,
          chest: { x: 2, y: -14 },
          elbowF: { x: 12, y: -14 },
          handF: { x: 22, y: -12 },
          elbowB: { x: -12, y: -12 },
          handB: { x: -22, y: -10 },
          kneeF: { x: 14, y: 2 },
          footF: { x: 22, y: 4 },
          kneeB: { x: -14, y: 4 },
          footB: { x: -22, y: 8 },
          weaponAngle: spin,
          weaponReach: base.weaponReach + 5,
          smearSpan: 2.2,
        };
      }
      default:
        // fstrong, sspecial, fair, kenji_counter_slash, nspecial
        return {
          ...base,
          hip: { x: 5, y: 0 },
          spine: { x: 8.5, y: -7 },
          chest: { x: 12, y: -13 },
          head: { x: 14.5, y: -22 },
          shoulderF: { x: 13, y: -12.5 },
          elbowF: { x: 20, y: -12 },
          handF: { x: 30, y: -10 },
          elbowB: { x: -4, y: -11 },
          handB: { x: -12, y: -8 },
          kneeF: { x: 13, y: grounded ? 9 : 6 },
          footF: { x: 18, y: grounded ? 18 : 13 },
          kneeB: { x: -8, y: grounded ? 10 : 8 },
          footB: { x: -15, y: grounded ? 18 : 15 },
          weaponAngle: weaponType === 'katana' ? 0.12 : 0.05,
          weaponReach: base.weaponReach + 9,
          sheathed: false,
          smearSpan: 1.8,
        };
    }
  }

  private getMoveFollowPose(
    strike: SkeletonPose,
    moveKey: MoveKey,
    grounded: boolean
  ): SkeletonPose {
    if (moveKey === 'utilt' || moveKey === 'uair' || moveKey === 'ustrong' || moveKey === 'uspecial') {
      return {
        ...strike,
        chest: { x: strike.chest.x - 1, y: strike.chest.y - 1.5 },
        handF: { x: strike.handF.x - 5.5, y: strike.handF.y + 3.5 },
        weaponAngle: strike.weaponAngle - 0.44,
        smearAlpha: 0,
      };
    }
    return {
      ...strike,
      hip: { x: strike.hip.x + 1.2, y: strike.hip.y + (grounded ? 1.2 : 0) },
      chest: { x: strike.chest.x + 2.2, y: strike.chest.y + (grounded ? 1.8 : 0.5) },
      head: { x: strike.head.x + 2.0, y: strike.head.y + (grounded ? 1.5 : 0.5) },
      elbowF: { x: strike.elbowF.x - 1.5, y: strike.elbowF.y + 2.5 },
      handF: { x: strike.handF.x - 3.2, y: strike.handF.y + 4.5 },
      weaponAngle: strike.weaponAngle + 0.48,
      smearAlpha: 0,
    };
  }

  private drawCharacterHeadAndHair(
    ctx: CanvasRenderingContext2D,
    head: Vec2,
    chest: Vec2,
    bodyColor: string,
    outlineColor: string,
    accentColor: string,
    secondaryColor: string,
    weaponType: WeaponType,
    hasEyeTrail: boolean,
    vx = 0,
    vy = 0
  ): void {
    const hx = head.x;
    const hy = head.y;
    const isFlashOrImpact =
      bodyColor === '#ffffff' || bodyColor === '#05070d' || bodyColor === '#f8fafc';
    const darkInk = isFlashOrImpact ? outlineColor : '#04060c';
    const windLagX = Math.max(-5.5, Math.min(4.5, -vx * 0.55));
    const windLagY = Math.max(-4.0, Math.min(4.5, -vy * 0.4));

    // 0. Sculpted Neck & High Collar connecting Chest to Head
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = weaponType === 'titan' ? 6.5 : 4.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(chest.x, chest.y - 1);
    ctx.lineTo(hx - 0.5, hy + 3);
    ctx.stroke();

    ctx.strokeStyle = isFlashOrImpact
      ? bodyColor
      : weaponType === 'katana' || weaponType === 'spear' || weaponType === 'chains' || weaponType === 'orbs'
      ? '#eab688'
      : '#1e293b';
    ctx.lineWidth = weaponType === 'titan' ? 3.8 : 2.6;
    ctx.beginPath();
    ctx.moveTo(chest.x, chest.y - 1);
    ctx.lineTo(hx - 0.5, hy + 3);
    ctx.stroke();

    // 1. Multi-Lock Dynamic Back Hair / Ponytail / Flowing Mane (reacts to vx/vy!)
    if (weaponType === 'dagger') {
      // KURO: Multi-Spike Midnight Shinobi Hair with Violet Rim Highlights
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx - 1, hy - 6);
      ctx.lineTo(hx - 15 + windLagX, hy - 11 + windLagY);
      ctx.lineTo(hx - 9 + windLagX * 0.5, hy - 4);
      ctx.lineTo(hx - 17 + windLagX, hy - 2 + windLagY);
      ctx.lineTo(hx - 10 + windLagX * 0.5, hy + 2);
      ctx.lineTo(hx - 14 + windLagX, hy + 5 + windLagY);
      ctx.lineTo(hx - 4, hy + 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isFlashOrImpact ? bodyColor : '#2e1065';
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 5.5);
      ctx.lineTo(hx - 13.5 + windLagX, hy - 9.8 + windLagY);
      ctx.lineTo(hx - 8 + windLagX * 0.5, hy - 3.8);
      ctx.lineTo(hx - 15 + windLagX, hy - 1.5 + windLagY);
      ctx.lineTo(hx - 6, hy + 2.5);
      ctx.closePath();
      ctx.fill();

      // Hair rim highlight
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 6);
      ctx.lineTo(hx - 13 + windLagX, hy - 9.5 + windLagY);
      ctx.stroke();
    } else if (weaponType === 'gauntlet') {
      // VELO: High-Velocity Golden-Cyan Aero Spikes Streaming Backward
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 6.5);
      ctx.lineTo(hx - 15 + windLagX, hy - 13 + windLagY);
      ctx.lineTo(hx - 8 + windLagX * 0.5, hy - 5.5);
      ctx.lineTo(hx - 17 + windLagX, hy - 5 + windLagY);
      ctx.lineTo(hx - 9 + windLagX * 0.5, hy - 1);
      ctx.lineTo(hx - 14 + windLagX, hy + 3 + windLagY);
      ctx.lineTo(hx - 5, hy + 1);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 6);
      ctx.lineTo(hx - 13.5 + windLagX, hy - 11.5 + windLagY);
      ctx.lineTo(hx - 7.5 + windLagX * 0.5, hy - 5);
      ctx.lineTo(hx - 15 + windLagX, hy - 4.5 + windLagY);
      ctx.lineTo(hx - 6, hy + 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'katana') {
      // KENJI: Flowing Samurai Topknot Ponytail & Fluttering Crimson Hachimaki Tails
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 5);
      ctx.quadraticCurveTo(hx - 12, hy - 11, hx - 16 + windLagX, hy - 5 + windLagY);
      ctx.quadraticCurveTo(hx - 11, hy - 1, hx - 5, hy - 1);
      ctx.closePath();
      ctx.fill();
      // Crimson headband ribbon tails
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 2);
      ctx.quadraticCurveTo(hx - 13, hy + 1, hx - 18 + windLagX * 1.2, hy + 4 + windLagY);
      ctx.stroke();
    } else if (weaponType === 'spear') {
      // RAIJIN: Wild Crackling Silver-White Storm-God Mane
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx + 3, hy - 6);
      ctx.lineTo(hx - 6 + windLagX * 0.6, hy - 16 + windLagY);
      ctx.lineTo(hx - 4, hy - 9);
      ctx.lineTo(hx - 16 + windLagX, hy - 13 + windLagY);
      ctx.lineTo(hx - 9, hy - 4);
      ctx.lineTo(hx - 17 + windLagX, hy - 1 + windLagY);
      ctx.lineTo(hx - 9, hy + 2);
      ctx.lineTo(hx - 14 + windLagX, hy + 7 + windLagY);
      ctx.lineTo(hx - 4, hy + 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isFlashOrImpact ? bodyColor : '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 5.5);
      ctx.lineTo(hx - 5.5 + windLagX * 0.6, hy - 14 + windLagY);
      ctx.lineTo(hx - 3.5, hy - 8);
      ctx.lineTo(hx - 14 + windLagX, hy - 11.5 + windLagY);
      ctx.lineTo(hx - 8, hy - 3.5);
      ctx.lineTo(hx - 15 + windLagX, hy - 1 + windLagY);
      ctx.lineTo(hx - 5, hy + 2.5);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'chains') {
      // SOL: Multi-Layered Blazing Phoenix Flame Crown
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx + 3.5, hy - 5);
      ctx.lineTo(hx + windLagX * 0.4, hy - 17 + windLagY);
      ctx.lineTo(hx - 3, hy - 9);
      ctx.lineTo(hx - 12 + windLagX, hy - 16 + windLagY);
      ctx.lineTo(hx - 7.5, hy - 5);
      ctx.lineTo(hx - 16 + windLagX, hy - 6 + windLagY);
      ctx.lineTo(hx - 5, hy + 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(hx + 3, hy - 5);
      ctx.lineTo(hx + windLagX * 0.4, hy - 15.5 + windLagY);
      ctx.lineTo(hx - 3, hy - 8.5);
      ctx.lineTo(hx - 11 + windLagX, hy - 14.5 + windLagY);
      ctx.lineTo(hx - 7, hy - 5);
      ctx.lineTo(hx - 14.5 + windLagX, hy - 5.5 + windLagY);
      ctx.lineTo(hx - 5, hy + 1.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx + 1.5, hy - 5);
      ctx.lineTo(hx - 1.5 + windLagX * 0.3, hy - 12.5 + windLagY);
      ctx.lineTo(hx - 8.5 + windLagX * 0.7, hy - 9.5 + windLagY);
      ctx.lineTo(hx - 4, hy - 3);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'orbs') {
      // NYX: Long Cascading Starlight Hair Tresses with Nebula Highlights
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(hx - 1, hy - 6);
      ctx.quadraticCurveTo(hx - 16 + windLagX, hy + 1, hx - 15 + windLagX * 1.3, hy + 17 + windLagY);
      ctx.lineTo(hx - 7 + windLagX, hy + 14 + windLagY);
      ctx.lineTo(hx - 3, hy + 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isFlashOrImpact ? bodyColor : '#4a044e';
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 5);
      ctx.quadraticCurveTo(hx - 14 + windLagX, hy + 1, hx - 13.5 + windLagX * 1.3, hy + 15.5 + windLagY);
      ctx.lineTo(hx - 4, hy + 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 3);
      ctx.quadraticCurveTo(hx - 11 + windLagX, hy + 3, hx - 11 + windLagX * 1.2, hy + 13 + windLagY);
      ctx.stroke();
    }

    // 2. Sculpted Anime Head & Angled Jawline (No longer a flat circle!)
    const headR = weaponType === 'titan' ? 6.8 : 5.7;
    ctx.fillStyle = darkInk;
    ctx.beginPath();
    ctx.arc(hx, hy - 0.5, headR + 1.4, Math.PI * 0.65, Math.PI * 2.15);
    ctx.lineTo(hx + headR + 1.2, hy + 1.8);
    ctx.lineTo(hx + 2.2, hy + headR + 1.4); // Sculpted anime chin point!
    ctx.lineTo(hx - headR * 0.85, hy + headR * 0.75);
    ctx.closePath();
    ctx.fill();

    // Base Cranium / Helmet Fill
    const isHumanFace =
      weaponType === 'katana' ||
      weaponType === 'spear' ||
      weaponType === 'chains' ||
      weaponType === 'orbs' ||
      weaponType === 'gauntlet';
    ctx.fillStyle = isFlashOrImpact
      ? bodyColor
      : weaponType === 'titan'
      ? '#132a23'
      : weaponType === 'scythe'
      ? '#0f1f26'
      : '#1e293b';
    ctx.beginPath();
    ctx.arc(hx, hy - 0.5, headR, 0, Math.PI * 2);
    ctx.fill();

    // Cel-Shaded Anime Face / Jaw Plane for Exposed Faces
    if (isHumanFace && !isFlashOrImpact) {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(hx - 1.5, hy - 3.5);
      ctx.lineTo(hx + headR - 0.2, hy - 2.5);
      ctx.lineTo(hx + headR - 0.4, hy + 1.8);
      ctx.lineTo(hx + 2.0, hy + headR - 0.2); // Chin
      ctx.lineTo(hx - 2.2, hy + 3.5);
      ctx.closePath();
      ctx.fill();

      // Warm cheek/jaw cel shadow
      ctx.fillStyle = '#f59e0b';
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(hx - 2.2, hy + 1.5);
      ctx.lineTo(hx + 2.0, hy + headR - 0.2);
      ctx.lineTo(hx - 2.2, hy + 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 3. Character-Specific Headgear, Masks, Horns, Hats, Visors & Expressive Eyes
    if (weaponType === 'dagger') {
      // KURO: Armored Shinobi Half-Mask with Metallic Nose Bridge + Forehead Plate + Slanted Violet Eye
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(hx - 5.2, hy - 0.2);
      ctx.lineTo(hx + 6.2, hy - 0.6);
      ctx.lineTo(hx + 4.2, hy + 5.8);
      ctx.lineTo(hx - 4.2, hy + 5.0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(hx - 4.5, hy + 0.2);
      ctx.lineTo(hx + 5.8, hy - 0.2);
      ctx.stroke();

      // Forehead protector band with metallic shinobi plate
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx - 5.5, hy - 4.8, 11.2, 2.0);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(hx + 0.5, hy - 4.6, 4.2, 1.5);

      // Slanted assassin eye with glowing iris & white specular glint
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx + 0.5, hy - 1.6);
      ctx.lineTo(hx + 5.8, hy - 3.0);
      ctx.lineTo(hx + 5.2, hy - 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 2.3, 1.6, 1.5);
    } else if (weaponType === 'gauntlet') {
      // VELO: Wrap-Around Aerodynamic Cyber-Visor Goggles + Winged Comms Fin
      ctx.fillStyle = '#090d16';
      ctx.fillRect(hx - 4.5, hy - 3.8, 11.2, 4.4);
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx - 1.2, hy - 3.2);
      ctx.lineTo(hx + 6.8, hy - 3.6);
      ctx.lineTo(hx + 5.8, hy + 0.2);
      ctx.lineTo(hx - 1.2, hy - 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2.5, hy - 3.0, 2.8, 1.3);
      // Side speed-wing antenna fin
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(hx - 0.5, hy - 1);
      ctx.lineTo(hx - 8.5, hy - 4.5);
      ctx.lineTo(hx - 5, hy + 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'katana') {
      // KENJI: Fierce Samurai Eye + Woven Bamboo Ronin Kasa (Conical Hat) with Ribbed Texture!
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx + 1.0, hy - 2.2, 4.8, 1.0); // Fierce eyebrow
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 1.5, hy - 1.4, 4.4, 2.0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.4, hy - 1.4, 1.6, 1.5);

      ctx.save();
      ctx.translate(hx + 0.5, hy - 4.4);
      ctx.rotate(0.11);
      // Dark under-brim shadow
      ctx.fillStyle = '#04060c';
      ctx.beginPath();
      ctx.ellipse(0, 1.2, 14.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Conical hat body
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-14.5, 0.6);
      ctx.lineTo(0, -7.2);
      ctx.lineTo(14.5, 0.6);
      ctx.closePath();
      ctx.fill();
      // Lit top slope & bamboo ribs
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, -7.2);
      ctx.lineTo(14.2, 0.6);
      ctx.lineTo(1.5, 0.6);
      ctx.closePath();
      ctx.fill();
      // Crimson rim & golden kasa finial
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-14, 0.6);
      ctx.lineTo(14, 0.6);
      ctx.stroke();
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-2.2, -7.2, 4.4, 2.2);
      ctx.restore();
    } else if (weaponType === 'titan') {
      // BRAM: Segmented Juggernaut Great-Helm + Mandible Jawplate + Blazing T-Visor + Bull Horns
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx - 5.5, hy - 0.2, 12, 6.5);
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx - 4.2, hy + 1.4, 10, 3.4);
      // Rivet studs on jawplate
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx - 3, hy + 2.4, 1.5, 1.5);
      ctx.fillRect(hx + 2.5, hy + 2.4, 1.5, 1.5);
      // Blazing T-Visor slit
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 0.5, hy - 2.6, 6.2, 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 2.3, 2.2, 1.6);
      // Twin Curved Titan Bull Horns
      ctx.strokeStyle = darkInk;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 4);
      ctx.quadraticCurveTo(hx - 9, hy - 12.5, hx + 3.5, hy - 14.5);
      ctx.stroke();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 4);
      ctx.quadraticCurveTo(hx - 9, hy - 12.5, hx + 3.5, hy - 14.5);
      ctx.stroke();
    } else if (weaponType === 'spear') {
      // RAIJIN: Storm-God Golden Oni Diadem + Tall Jagged Lightning Horn + Crackling Eyes
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx - 5.2, hy - 4.5, 11, 2.0);
      ctx.beginPath();
      ctx.moveTo(hx + 1.8, hy - 4.2);
      ctx.lineTo(hx + 8.5, hy - 14);
      ctx.lineTo(hx + 4.8, hy - 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 1.5, hy - 2.0, 4.4, 2.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 2.0, 1.8, 1.6);
    } else if (weaponType === 'scythe') {
      // CHRONO: Aristocratic Pointed Reaper Cowl + Floating Sundial Crown + Golden Monocle
      ctx.fillStyle = '#09151b';
      ctx.beginPath();
      ctx.moveTo(hx - 9.5, hy - 10.5);
      ctx.lineTo(hx + 7, hy - 4.8);
      ctx.lineTo(hx + 5.2, hy + 5.2);
      ctx.lineTo(hx - 6.8, hy + 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Floating Golden Sundial Crown above hood
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 13.5);
      ctx.lineTo(hx + 3.4, hy - 8.5);
      ctx.lineTo(hx - 3.4, hy - 8.5);
      ctx.closePath();
      ctx.fill();
      // Glowing Clockwork Monocle Eye
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx + 2.8, hy - 1.2, 2.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 2, hy - 2, 2.1, 2.1);
    } else if (weaponType === 'chains') {
      // SOL: Winged Phoenix Brow Circlet + Fierce Blazing Solar Eyes
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx - 4.5, hy - 4.2);
      ctx.lineTo(hx + 7.5, hy - 2.6);
      ctx.lineTo(hx + 3.2, hy - 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2.0, hy - 2.2, 3.8, 2.0);
    } else if (weaponType === 'orbs') {
      // NYX: Twin Crescent-Moon Empress Horns + Forehead Star Diamond + Luminous Eyes
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 5);
      ctx.quadraticCurveTo(hx - 6.5, hy - 12.5, hx - 1, hy - 14.5);
      ctx.moveTo(hx + 2, hy - 5);
      ctx.quadraticCurveTo(hx + 6.5, hy - 12.5, hx + 2.2, hy - 14.5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2, hy - 5.6, 2.4, 2.4);
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 1.5, hy - 2, 4.2, 2.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 2, 1.8, 1.8);
    } else if (weaponType === 'claws') {
      // JIN: Sculpted Cyber-Kitsune Mask with Pointed Ears, Jaw Collar & Triple-Slit Teal Visor
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(hx - 3.5, hy - 6);
      ctx.lineTo(hx - 6.5, hy - 12.8);
      ctx.lineTo(hx + 1, hy - 6);
      ctx.lineTo(hx + 4.5, hy - 12.8);
      ctx.lineTo(hx + 5.8, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // High armoured collar covering jaw
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx - 5.2, hy + 0.4, 11, 5.2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(hx - 5.2, hy + 0.4, 11, 5.2);
      // Triple-slit glowing cyber visor
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 1, hy - 3.1, 5.0, 1.3);
      ctx.fillRect(hx + 1.8, hy - 1.1, 4.2, 1.3);
    }

    if (hasEyeTrail) {
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(hx + 2.5, hy - 1.5);
      ctx.lineTo(hx - 16 + windLagX, hy - 3.5 + windLagY);
      ctx.stroke();
    }
  }

  private drawCharacterBodyAndGarments(
    ctx: CanvasRenderingContext2D,
    pose: SkeletonPose,
    bodyColor: string,
    outlineColor: string,
    accentColor: string,
    secondaryColor: string,
    weaponType: WeaponType,
    limbW: number,
    outlineW: number,
    vx = 0,
    vy = 0
  ): void {
    const isFlashOrImpact =
      bodyColor === '#ffffff' || bodyColor === '#05070d' || bodyColor === '#f8fafc';
    const darkInk = isFlashOrImpact ? outlineColor : '#04060c';

    // Rich 3-Tone Cel-Shaded Costume Palette per Character (never blends into dark background!)
    let clothBase = '#1e293b';
    let clothLight = '#334155';
    let clothDeep = '#0f172a';
    let pantsColor = '#111827';
    let bootColor = '#1e293b';
    let skinOrSleeve = '#1e293b';

    if (isFlashOrImpact) {
      clothBase = bodyColor;
      clothLight = bodyColor;
      clothDeep = bodyColor;
      pantsColor = bodyColor;
      bootColor = bodyColor;
      skinOrSleeve = bodyColor;
    } else if (weaponType === 'dagger') {
      // KURO: Midnight Violet Shinobi Flak Armor & Shadow Wraps
      clothBase = '#2e1065';
      clothLight = '#4c1d95';
      clothDeep = '#170936';
      pantsColor = '#1e1b4b';
      bootColor = '#312e81';
      skinOrSleeve = '#1e1b4b';
    } else if (weaponType === 'gauntlet') {
      // VELO: Deep Cobalt-Cyan Sprinter Jacket & White-Trim Track Greaves
      clothBase = '#0c4a6e';
      clothLight = '#0284c7';
      clothDeep = '#082f49';
      pantsColor = '#0f172a';
      bootColor = '#0369a1';
      skinOrSleeve = '#0284c7';
    } else if (weaponType === 'katana') {
      // KENJI: Crimson-Trimmed Ronin Haori over Slate Gi & Wide Indigo Hakama
      clothBase = '#1e293b';
      clothLight = '#334155';
      clothDeep = '#0f172a';
      pantsColor = '#172554';
      bootColor = '#f8fafc'; // White Samurai Tabi & Waraji
      skinOrSleeve = '#1e293b';
    } else if (weaponType === 'titan') {
      // BRAM: Heavy Emerald-Obsidian Juggernaut Plate Armor
      clothBase = '#064e3b';
      clothLight = '#047857';
      clothDeep = '#022c22';
      pantsColor = '#0f2922';
      bootColor = '#065f46';
      skinOrSleeve = '#064e3b';
    } else if (weaponType === 'spear') {
      // RAIJIN: Royal Storm-Blue Martial Gi & Muscular Arms with Golden Bracers
      clothBase = '#1e3a8a';
      clothLight = '#2563eb';
      clothDeep = '#172554';
      pantsColor = '#0f172a';
      bootColor = '#1d4ed8';
      skinOrSleeve = '#eab688'; // Muscular martial-artist arms
    } else if (weaponType === 'scythe') {
      // CHRONO: Aristocratic Abyssal-Teal Tailcoat & Brass Clockwork Trim
      clothBase = '#134e4a';
      clothLight = '#0f766e';
      clothDeep = '#042f2e';
      pantsColor = '#09191f';
      bootColor = '#115e59';
      skinOrSleeve = '#134e4a';
    } else if (weaponType === 'chains') {
      // SOL: Ashen-Phoenix Open-Chest Flame Gi, Muscular Torso & Molten Wraps
      clothBase = '#7c2d12';
      clothLight = '#c2410c';
      clothDeep = '#431407';
      pantsColor = '#1c1917';
      bootColor = '#9a3412';
      skinOrSleeve = '#eab688'; // Muscular pyromancer arms
    } else if (weaponType === 'orbs') {
      // NYX: Regal Astral-Magenta Armored Bodice & Cosmic Gown
      clothBase = '#701a75';
      clothLight = '#a21caf';
      clothDeep = '#4a044e';
      pantsColor = '#2e1065';
      bootColor = '#86198f';
      skinOrSleeve = '#701a75';
    } else if (weaponType === 'claws') {
      // JIN: Cyber-Indigo Puppeteer Trenchcoat & Neon Circuit Seams
      clothBase = '#1e1b4b';
      clothLight = '#3730a3';
      clothDeep = '#0f172a';
      pantsColor = '#0f172a';
      bootColor = '#312e81';
      skinOrSleeve = '#1e1b4b';
    }

    // Helper: Draw a 3-Tone Cel-Shaded Anatomical Limb Segment (Dark Ink Border + Base + Directional Rim Highlight)
    const drawCelLimb = (
      a: Vec2,
      b: Vec2,
      wStart: number,
      wEnd: number,
      fillCol: string,
      litCol: string,
      rimCol: string,
      isFront: boolean
    ) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // 1) Crisp Dark Ink Outer Silhouette
      const ow1 = wStart * 0.5 + 1.4;
      const ow2 = wEnd * 0.5 + 1.4;
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * ow1, a.y + ny * ow1);
      ctx.lineTo(b.x + nx * ow2, b.y + ny * ow2);
      ctx.lineTo(b.x - nx * ow2, b.y - ny * ow2);
      ctx.lineTo(a.x - nx * ow1, a.y - ny * ow1);
      ctx.closePath();
      ctx.fill();

      // 2) Main Garment / Muscle Fill
      const iw1 = wStart * 0.5;
      const iw2 = wEnd * 0.5;
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * iw1, a.y + ny * iw1);
      ctx.lineTo(b.x + nx * iw2, b.y + ny * iw2);
      ctx.lineTo(b.x - nx * iw2, b.y - ny * iw2);
      ctx.lineTo(a.x - nx * iw1, a.y - ny * iw1);
      ctx.closePath();
      ctx.fill();

      // 3) Cel-Shaded Lit Half-Plane on Front Edge
      if (!isFlashOrImpact && isFront) {
        ctx.fillStyle = litCol;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * iw1, a.y + ny * iw1);
        ctx.lineTo(b.x + nx * iw2, b.y + ny * iw2);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(a.x, a.y);
        ctx.closePath();
        ctx.fill();

        // Crisp colored rim-light line along leading edge
        ctx.strokeStyle = rimCol;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * iw1, a.y + ny * iw1);
        ctx.lineTo(b.x + nx * iw2, b.y + ny * iw2);
        ctx.stroke();
      }
    };

    // Helper: Draw Articulated Combat Boot / Greave Shoe / Samurai Tabi at Foot Joint
    const drawCombatBoot = (knee: Vec2, foot: Vec2, isFront: boolean) => {
      const shinAng = Math.atan2(foot.y - knee.y, foot.x - knee.x);
      const bootAng = Math.max(-0.55, Math.min(0.65, shinAng - Math.PI * 0.5)) * 0.5;
      ctx.save();
      ctx.translate(foot.x, foot.y);
      ctx.rotate(bootAng);

      // Boot silhouette border
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(-3.6, -3.2);
      ctx.lineTo(3.2, -2.5);
      ctx.lineTo(7.2, 0.8);
      ctx.lineTo(6.8, 2.8);
      ctx.lineTo(-3.8, 2.8);
      ctx.closePath();
      ctx.fill();

      // Boot upper body
      ctx.fillStyle = isFront ? bootColor : clothDeep;
      ctx.beginPath();
      ctx.moveTo(-2.6, -2.2);
      ctx.lineTo(2.4, -1.6);
      ctx.lineTo(6.0, 0.8);
      ctx.lineTo(5.6, 1.8);
      ctx.lineTo(-2.8, 1.8);
      ctx.closePath();
      ctx.fill();

      // Sole & ankle cuff highlight
      if (!isFlashOrImpact) {
        ctx.fillStyle = isFront ? secondaryColor : accentColor;
        ctx.fillRect(-2.6, 1.2, 8.2, 1.0);
        if (weaponType === 'katana') {
          // Red Waraji sandal strap over white Tabi
          ctx.fillStyle = accentColor;
          ctx.fillRect(0.5, -1.2, 1.8, 2.4);
        }
      }
      ctx.restore();
    };

    // Helper: Draw Sculpted Martial Fist / Armored Glove at Hand Joint
    const drawGlovedFist = (elbow: Vec2, hand: Vec2, isFront: boolean) => {
      const armAng = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
      ctx.save();
      ctx.translate(hand.x, hand.y);
      ctx.rotate(armAng);
      const r = weaponType === 'titan' ? 3.8 : 2.7;

      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.arc(0, 0, r + 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isFlashOrImpact
        ? bodyColor
        : isFront
        ? accentColor
        : clothLight;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashOrImpact && isFront) {
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(0.2, -r * 0.6, r * 0.7, r * 1.2);
      }
      ctx.restore();
    };

    const windCoatX = Math.max(-7, Math.min(5, -vx * 0.75));
    const windCoatY = Math.max(-5, Math.min(5, -vy * 0.45));

    // =========================================================================
    // 1. VELOCITY-REACTIVE BACK COAT-TAILS / HAORI / CAPE (behind legs & torso)
    // =========================================================================
    if (
      weaponType === 'scythe' ||
      weaponType === 'dagger' ||
      weaponType === 'orbs' ||
      weaponType === 'claws' ||
      weaponType === 'katana' ||
      weaponType === 'spear'
    ) {
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.moveTo(pose.spine.x - 2, pose.spine.y - 2);
      ctx.quadraticCurveTo(
        pose.hip.x - 12 + windCoatX * 0.6,
        pose.hip.y + 5,
        pose.hip.x - 16 + windCoatX,
        pose.hip.y + 15 + windCoatY
      );
      ctx.lineTo(pose.hip.x - 5 + windCoatX * 0.6, pose.hip.y + 12 + windCoatY * 0.6);
      ctx.lineTo(pose.hip.x + 2, pose.hip.y + 14 + windCoatY * 0.4);
      ctx.lineTo(pose.hip.x + 4, pose.hip.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = clothDeep;
      ctx.beginPath();
      ctx.moveTo(pose.spine.x - 1, pose.spine.y - 1);
      ctx.quadraticCurveTo(
        pose.hip.x - 10 + windCoatX * 0.6,
        pose.hip.y + 5,
        pose.hip.x - 14.5 + windCoatX,
        pose.hip.y + 13.5 + windCoatY
      );
      ctx.lineTo(pose.hip.x - 5 + windCoatX * 0.6, pose.hip.y + 10.5 + windCoatY * 0.6);
      ctx.lineTo(pose.hip.x + 1.5, pose.hip.y + 12.5 + windCoatY * 0.4);
      ctx.lineTo(pose.hip.x + 3, pose.hip.y);
      ctx.closePath();
      ctx.fill();

      // Glowing hem border on coat-tails
      ctx.strokeStyle =
        weaponType === 'scythe' || weaponType === 'claws' ? secondaryColor : accentColor;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x - 14 + windCoatX, pose.hip.y + 13.5 + windCoatY);
      ctx.lineTo(pose.hip.x - 5 + windCoatX * 0.6, pose.hip.y + 10.5 + windCoatY * 0.6);
      ctx.lineTo(pose.hip.x + 1.5, pose.hip.y + 12.5 + windCoatY * 0.4);
      ctx.stroke();
    }

    // =========================================================================
    // 2. BACK ARM & BACK LEG (Sculpted Thigh, Calf Greave, Boot & Forearm)
    // =========================================================================
    drawCelLimb(
      pose.shoulderB,
      pose.elbowB,
      limbW * 1.35,
      limbW * 1.1,
      clothDeep,
      clothBase,
      outlineColor,
      false
    );
    drawCelLimb(
      pose.elbowB,
      pose.handB,
      limbW * 1.3,
      limbW * 0.95,
      clothDeep,
      clothBase,
      outlineColor,
      false
    );
    drawGlovedFist(pose.elbowB, pose.handB, false);

    const thighMult = weaponType === 'katana' ? 2.25 : weaponType === 'titan' ? 1.75 : 1.55;
    const calfMult = weaponType === 'katana' ? 1.65 : weaponType === 'titan' ? 1.55 : 1.35;
    drawCelLimb(
      pose.hip,
      pose.kneeB,
      limbW * thighMult,
      limbW * (thighMult * 0.8),
      clothDeep,
      pantsColor,
      outlineColor,
      false
    );
    drawCelLimb(
      pose.kneeB,
      pose.footB,
      limbW * calfMult,
      limbW * 0.95,
      clothDeep,
      bootColor,
      outlineColor,
      false
    );
    drawCombatBoot(pose.kneeB, pose.footB, false);

    // =========================================================================
    // 3. SCULPTED ANATOMICAL V-TAPER TORSO, PELVIS, BELT & ARMOR CHESTPLATE
    // =========================================================================
    const chestHalfW = weaponType === 'titan' ? 7.2 : weaponType === 'spear' ? 5.6 : 4.8;
    const waistHalfW = weaponType === 'titan' ? 5.2 : 3.4;
    const hipHalfW = weaponType === 'titan' ? 5.6 : 4.0;

    // 3A) Pelvis / Hip Block & Tassets (Kusazuri / Belt Skirt)
    ctx.fillStyle = darkInk;
    ctx.beginPath();
    ctx.moveTo(pose.spine.x - waistHalfW - 1.3, pose.spine.y);
    ctx.lineTo(pose.spine.x + waistHalfW + 1.3, pose.spine.y);
    ctx.lineTo(pose.hip.x + hipHalfW + 1.5, pose.hip.y + 4);
    ctx.lineTo(pose.hip.x - hipHalfW - 1.5, pose.hip.y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.moveTo(pose.spine.x - waistHalfW, pose.spine.y);
    ctx.lineTo(pose.spine.x + waistHalfW, pose.spine.y);
    ctx.lineTo(pose.hip.x + hipHalfW, pose.hip.y + 3);
    ctx.lineTo(pose.hip.x - hipHalfW, pose.hip.y + 3);
    ctx.closePath();
    ctx.fill();

    // 3B) Sculpted V-Taper Ribcage & Chest Polygon
    ctx.fillStyle = darkInk;
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - chestHalfW - 1.4, pose.chest.y - 2);
    ctx.lineTo(pose.chest.x + chestHalfW + 1.4, pose.chest.y - 2);
    ctx.lineTo(pose.spine.x + waistHalfW + 1.4, pose.spine.y + 1);
    ctx.lineTo(pose.spine.x - waistHalfW - 1.4, pose.spine.y + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = clothBase;
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - chestHalfW, pose.chest.y - 1);
    ctx.lineTo(pose.chest.x + chestHalfW, pose.chest.y - 1);
    ctx.lineTo(pose.spine.x + waistHalfW, pose.spine.y + 0.5);
    ctx.lineTo(pose.spine.x - waistHalfW, pose.spine.y + 0.5);
    ctx.closePath();
    ctx.fill();

    // Front Cel-Shaded Chest Light Plane & Rim Highlight
    if (!isFlashOrImpact) {
      ctx.fillStyle =
        weaponType === 'chains' ? '#eab688' : clothLight; // Sol exposes muscular solar chest!
      ctx.beginPath();
      ctx.moveTo(pose.chest.x - 1, pose.chest.y - 1);
      ctx.lineTo(pose.chest.x + chestHalfW, pose.chest.y - 1);
      ctx.lineTo(pose.spine.x + waistHalfW, pose.spine.y + 0.5);
      ctx.lineTo(pose.spine.x - 0.5, pose.spine.y + 0.5);
      ctx.closePath();
      ctx.fill();

      // Crisp front torso rim-light edge
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(pose.chest.x + chestHalfW, pose.chest.y - 1);
      ctx.lineTo(pose.spine.x + waistHalfW, pose.spine.y + 0.5);
      ctx.stroke();

      // Waist Obi Sash / Tactical Belt + Buckle
      ctx.fillStyle =
        weaponType === 'katana' || weaponType === 'dagger' || weaponType === 'chains'
          ? accentColor
          : '#0f172a';
      ctx.fillRect(
        pose.spine.x - waistHalfW - 0.5,
        pose.spine.y - 1.2,
        waistHalfW * 2 + 1,
        2.8
      );
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(pose.spine.x + 0.5, pose.spine.y - 1.4, 3.2, 3.0);
    }

    // Character-Specific Chest Armor, Haori Lapels, Harnesses & Reactor Cores
    if (!isFlashOrImpact) {
      if (weaponType === 'dagger') {
        // Kuro: Crossed Shinobi Kunai Harness & Violet Core
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x - 3.5, pose.chest.y - 1);
        ctx.lineTo(pose.spine.x + 3.5, pose.spine.y);
        ctx.moveTo(pose.chest.x + 3.5, pose.chest.y - 1);
        ctx.lineTo(pose.spine.x - 3.5, pose.spine.y);
        ctx.stroke();
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(pose.chest.x - 1, pose.chest.y + 1, 2.2, 2.2);
      } else if (weaponType === 'gauntlet') {
        // Velo: Glowing Cyan-Gold Turbine Chest Core & Racing Stripes
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(pose.chest.x + 1.5, pose.chest.y + 1.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pose.chest.x + 1, pose.chest.y + 1, 1.5, 1.5);
      } else if (weaponType === 'katana') {
        // Kenji: White Inner Kosode Collar V-Lapel & Crimson Haori Trim
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x - 1.5, pose.chest.y - 1.5);
        ctx.lineTo(pose.chest.x + 2.5, pose.chest.y + 4);
        ctx.lineTo(pose.chest.x + 4, pose.chest.y - 1.5);
        ctx.stroke();
      } else if (weaponType === 'titan') {
        // Bram: Glowing Emerald Gravity Furnace Core & Segmented Rib Plates
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x - 5.5, pose.chest.y + 1.5);
        ctx.lineTo(pose.chest.x + 5.5, pose.chest.y + 1.5);
        ctx.stroke();
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(pose.chest.x + 0.5, pose.chest.y, 3.2, 3.2);
      } else if (weaponType === 'spear') {
        // Raijin: Golden Cloud-Pattern Gi Lapel & Shimenawa Rope Belt
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x - 2, pose.chest.y - 1);
        ctx.lineTo(pose.spine.x + 2, pose.spine.y);
        ctx.stroke();
      } else if (weaponType === 'scythe') {
        // Chrono: Golden Clockwork Astrolabe Heart on Chest
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(pose.chest.x + 1.5, pose.chest.y + 1.5, 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = accentColor;
        ctx.fillRect(pose.chest.x + 1, pose.chest.y + 1, 1.5, 1.5);
      } else if (weaponType === 'chains') {
        // Sol: Blazing Phoenix Brand Tattoo on Chest & Flame Sash Tails
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(pose.chest.x + 2, pose.chest.y + 1.5, 2.0, 0, Math.PI * 2);
        ctx.fill();
      } else if (weaponType === 'orbs') {
        // Nyx: Faceted Astral Star-Gem on Chest Bodice
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x + 2, pose.chest.y - 1);
        ctx.lineTo(pose.chest.x + 4, pose.chest.y + 1.5);
        ctx.lineTo(pose.chest.x + 2, pose.chest.y + 4);
        ctx.lineTo(pose.chest.x, pose.chest.y + 1.5);
        ctx.closePath();
        ctx.fill();
      } else if (weaponType === 'claws') {
        // Jin: Glowing Teal Chakra-Circuit Ribs on Trenchcoat
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(pose.chest.x - 2, pose.chest.y);
        ctx.lineTo(pose.chest.x + 3.5, pose.chest.y + 1);
        ctx.moveTo(pose.chest.x - 2, pose.chest.y + 3);
        ctx.lineTo(pose.chest.x + 3, pose.chest.y + 4);
        ctx.stroke();
      }
    }

    // =========================================================================
    // 4. FRONT LEG (Sculpted Thigh, Knee Poleyn Armor, Calf Greave & Boot)
    // =========================================================================
    drawCelLimb(
      pose.hip,
      pose.kneeF,
      limbW * (thighMult + 0.1),
      limbW * (thighMult * 0.82),
      pantsColor,
      clothLight,
      outlineColor,
      true
    );
    drawCelLimb(
      pose.kneeF,
      pose.footF,
      limbW * (calfMult + 0.08),
      limbW * 1.0,
      bootColor,
      clothLight,
      outlineColor,
      true
    );

    // Knee Guard (Poleyn) highlight on Front Knee
    if (!isFlashOrImpact && weaponType !== 'katana') {
      ctx.fillStyle = darkInk;
      ctx.fillRect(pose.kneeF.x - 2.2, pose.kneeF.y - 2.5, 4.8, 4.5);
      ctx.fillStyle = weaponType === 'titan' ? secondaryColor : accentColor;
      ctx.fillRect(pose.kneeF.x - 1.2, pose.kneeF.y - 1.6, 3.0, 2.8);
    }

    drawCombatBoot(pose.kneeF, pose.footF, true);

    if (weaponType === 'gauntlet' && !isFlashOrImpact) {
      // VELO: Winged Aero-Jet Exhaust Fins on Both Ankles
      for (const ft of [pose.footF, pose.footB]) {
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(ft.x + 2, ft.y - 1);
        ctx.lineTo(ft.x - 7, ft.y - 5);
        ctx.lineTo(ft.x - 4, ft.y + 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(ft.x - 5.5, ft.y - 3, 3, 2);
      }
    }

    // =========================================================================
    // 5. FRONT ARM, FOREARM VAMBRACE, SHOULDER PAULDRONS & GLOVED FIST
    // =========================================================================
    drawCelLimb(
      pose.shoulderF,
      pose.elbowF,
      limbW * 1.45,
      limbW * 1.18,
      skinOrSleeve,
      clothLight,
      outlineColor,
      true
    );
    drawCelLimb(
      pose.elbowF,
      pose.handF,
      limbW * 1.4,
      limbW * 1.05,
      clothBase,
      accentColor,
      secondaryColor,
      true
    );
    drawGlovedFist(pose.elbowF, pose.handF, true);

    // Sculpted Shoulder Pauldrons / Sode / Haori Sleeves
    if (!isFlashOrImpact) {
      if (weaponType === 'titan') {
        for (const sh of [pose.shoulderF, pose.shoulderB]) {
          ctx.fillStyle = darkInk;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y - 1, 6.2, Math.PI * 0.85, Math.PI * 2.15);
          ctx.fill();
          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y - 1, 4.8, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(sh.x - 2, sh.y - 4.5, 4, 2.2);
        }
      } else {
        // Layered Shoulder Guard / Sleeve Cap on Front Shoulder
        ctx.fillStyle = darkInk;
        ctx.beginPath();
        ctx.arc(pose.shoulderF.x, pose.shoulderF.y - 0.5, 4.4, Math.PI * 0.8, Math.PI * 2.1);
        ctx.fill();
        ctx.fillStyle = clothLight;
        ctx.beginPath();
        ctx.arc(pose.shoulderF.x, pose.shoulderF.y - 0.5, 3.2, Math.PI * 0.9, Math.PI * 2.05);
        ctx.fill();
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(pose.shoulderF.x - 3, pose.shoulderF.y + 0.5);
        ctx.lineTo(pose.shoulderF.x + 3.2, pose.shoulderF.y + 0.5);
        ctx.stroke();
      }
    }

    void outlineW;
  }

  private drawMasterworkWeapon(
    ctx: CanvasRenderingContext2D,
    pose: SkeletonPose,
    accentColor: string,
    secondaryColor: string,
    weaponType: WeaponType,
    alpha: number
  ): void {
    const wx = pose.handF.x;
    const wy = pose.handF.y;
    const reach = pose.weaponReach;

    // 1. Multi-Layered Sweeping Ribbon Smear on Active Swing Frames (replaces flat arc fill)
    if (pose.smearAlpha && pose.smearAlpha > 0.05 && pose.smearSpan && !pose.sheathed) {
      drawArcSweep(
        ctx,
        {
          x: wx,
          y: wy,
          facing: 1,
          angleStart: pose.weaponAngle - pose.smearSpan,
          angleEnd: pose.weaponAngle + 0.08,
          radius: reach + 8,
          thickness: weaponType === 'dagger' ? 2.8 : weaponType === 'titan' ? 5.2 : 3.8,
          color: accentColor,
          coreColor: '#ffffff',
        },
        clamp01(1 - pose.smearAlpha * 0.75)
      );
    }

    // 2. Detailed Multi-Part Weapon Rendering per Fighter
    if (weaponType === 'scythe') {
      // =====================================================================
      // CHRONO: "ZERO HOUR" PENDULUM GREAT-SCYTHE
      // Ergonomic S-shaft + Astrolabe pommel + Clockwork gear collar +
      // Massive curved crescent reaper blade with glowing teal fuller & white edge!
      // =====================================================================
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(pose.weaponAngle);

      const backLen = 16;
      const shaftLen = reach + 7;

      // 1) Scythe Snath (Polearm Shaft) with dark outline & golden-bronze core
      ctx.strokeStyle = '#05070d';
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-backLen, 1.5);
      ctx.quadraticCurveTo(4, -2, shaftLen, 0);
      ctx.stroke();

      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-backLen, 1.5);
      ctx.quadraticCurveTo(4, -2, shaftLen, 0);
      ctx.stroke();

      // Mid-shaft ergonomic side grip handle (nib)
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(2, -1);
      ctx.lineTo(4, -6);
      ctx.stroke();

      // Rear Astrolabe Ring Pommel Counterweight
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-backLen - 2.5, 2, 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.fillRect(-backLen - 3.5, 1, 2, 2);

      // 2) Massive Curved Crescent Reaper Blade (sweeping perpendicular & inward!)
      // Outer dark-steel spine & silhouette border
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.moveTo(shaftLen - 2, -2);
      ctx.lineTo(shaftLen + 5, -6); // Rear counter-spike
      ctx.lineTo(shaftLen + 3, 1);
      // Sweeping outer spine curve of the scythe blade
      ctx.quadraticCurveTo(shaftLen + 17, 13, shaftLen - 9, 29);
      // Razor inner harvesting curve
      ctx.quadraticCurveTo(shaftLen + 7, 13, shaftLen - 3, 2);
      ctx.closePath();
      ctx.fill();

      // Inner Glowing Teal Energy Blade Body
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(shaftLen - 1, -1);
      ctx.lineTo(shaftLen + 3.5, -4.5);
      ctx.lineTo(shaftLen + 2, 1);
      ctx.quadraticCurveTo(shaftLen + 14.5, 12.5, shaftLen - 8, 27.5);
      ctx.quadraticCurveTo(shaftLen + 7.5, 12.5, shaftLen - 2, 2);
      ctx.closePath();
      ctx.fill();

      // Golden Spine Ridge along the top of the scythe blade
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shaftLen, 0);
      ctx.quadraticCurveTo(shaftLen + 14, 12, shaftLen - 4, 24);
      ctx.stroke();

      // White-Hot Razor Inner Cutting Edge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(shaftLen - 1, 2.5);
      ctx.quadraticCurveTo(shaftLen + 7.5, 12.5, shaftLen - 8, 27.5);
      ctx.stroke();

      // 3) Clockwork Gear Collar at Shaft-Blade Junction
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(shaftLen, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.arc(shaftLen, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (weaponType === 'katana') {
      // =====================================================================
      // KENJI: "MURAMASA" CRIMSON ODACHI KATANA & LACQUERED SAYA SCABBARD
      // =====================================================================
      // 1) Ornate Lacquered Saya (Scabbard) at left hip with golden Sageo knot
      ctx.save();
      ctx.strokeStyle = '#05070d';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x + 5, pose.hip.y - 2);
      ctx.quadraticCurveTo(pose.hip.x - 8, pose.hip.y + 4, pose.hip.x - 22, pose.hip.y + 8);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x + 5, pose.hip.y - 2);
      ctx.quadraticCurveTo(pose.hip.x - 8, pose.hip.y + 4, pose.hip.x - 22, pose.hip.y + 8);
      ctx.stroke();

      // Golden Kurikata cord tie on scabbard
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(pose.hip.x - 3, pose.hip.y, 3, 3);

      if (pose.sheathed) {
        // Hilt & Golden Tsuba protruding forward from scabbard when sheathed
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(pose.hip.x + 4, pose.hip.y - 5, 2.2, 6);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(pose.hip.x + 5, pose.hip.y - 2);
        ctx.lineTo(pose.hip.x + 12, pose.hip.y - 5);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.restore();
        // 2) Drawn Curved Odachi Katana in Hand!
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(pose.weaponAngle);
        const bladeLen = reach + 9;

        // Tsuka (Wrapped Hilt behind hand)
        ctx.strokeStyle = '#05070d';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(-7.5, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Golden Tsuba (Circular Handguard) & Habaki Collar
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(-0.5, -5, 2.4, 10);
        ctx.fillRect(1.5, -2.2, 2.5, 4.4);

        // Curved Single-Edged Katana Blade Polygon
        ctx.fillStyle = '#05070d';
        ctx.beginPath();
        ctx.moveTo(3, -2.2);
        ctx.quadraticCurveTo(bladeLen * 0.55, -4.5, bladeLen, -1.5);
        ctx.lineTo(bladeLen + 3, 0.5);
        ctx.quadraticCurveTo(bladeLen * 0.55, -0.5, 3, 2.0);
        ctx.closePath();
        ctx.fill();

        // Crimson Energy Core & Tempered White Hamon Edge
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(3.5, -1.2);
        ctx.quadraticCurveTo(bladeLen * 0.55, -3.2, bladeLen + 1.5, -0.2);
        ctx.quadraticCurveTo(bladeLen * 0.55, -0.8, 3.5, 1.2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(4, 1.0);
        ctx.quadraticCurveTo(bladeLen * 0.55, -0.8, bladeLen + 2, 0.2);
        ctx.stroke();

        ctx.restore();
      }
    } else if (weaponType === 'dagger') {
      // =====================================================================
      // KURO: TWIN ABYSSAL RING-KUNAI & REVERSE-GRIP SHADOW TANTO
      // =====================================================================
      const drawKunai = (hx: number, hy: number, ang: number, scaleLen: number) => {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ang);

        // Pommel Finger-Ring at rear of hilt
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(-5.5, 0, 2.6, 0, Math.PI * 2);
        ctx.stroke();

        // Hilt & Notched Crossguard
        ctx.fillStyle = '#05070d';
        ctx.fillRect(-3, -1.5, 4, 3);
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(1, -4.5);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(1, 4.5);
        ctx.closePath();
        ctx.fill();

        // Wide Diamond/Leaf Curved Kunai Blade Polygon
        ctx.fillStyle = '#05070d';
        ctx.beginPath();
        ctx.moveTo(2, -2.5);
        ctx.lineTo(scaleLen * 0.45, -4.8);
        ctx.lineTo(scaleLen + 4, 0);
        ctx.lineTo(scaleLen * 0.45, 4.8);
        ctx.lineTo(2, 2.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(2.5, -1.5);
        ctx.lineTo(scaleLen * 0.45, -3.2);
        ctx.lineTo(scaleLen + 2.5, 0);
        ctx.lineTo(scaleLen * 0.45, 3.2);
        ctx.lineTo(2.5, 1.5);
        ctx.closePath();
        ctx.fill();

        // White-hot center fuller & edge
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(scaleLen + 2, 0);
        ctx.stroke();

        ctx.restore();
      };

      drawKunai(wx, wy, pose.weaponAngle, reach + 2);
      drawKunai(pose.handB.x, pose.handB.y, 2.4, 11);
    } else if (weaponType === 'spear') {
      // =====================================================================
      // RAIJIN: "AME-NO-MURAKUMO" THUNDER NAGINATA / DRAGON HALBERD
      // =====================================================================
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(pose.weaponAngle);

      const backLen = 17;
      const shaftEnd = reach + 2;

      // 1) Long Polearm Shaft with Golden Butt-Spike (Ishizuki)
      ctx.strokeStyle = '#05070d';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(-backLen, 0);
      ctx.lineTo(shaftEnd, 0);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-backLen, 0);
      ctx.lineTo(shaftEnd, 0);
      ctx.stroke();

      // Golden Butt-Cap Spike
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-backLen, -2.5);
      ctx.lineTo(-backLen - 5, 0);
      ctx.lineTo(-backLen, 2.5);
      ctx.closePath();
      ctx.fill();

      // 2) Fluttering Crimson/Gold Tassel & Twin Lightning-Bolt Side Prongs at Collar
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(shaftEnd - 2, 1);
      ctx.lineTo(shaftEnd - 7, 7);
      ctx.lineTo(shaftEnd - 3, 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(shaftEnd - 2, -6);
      ctx.lineTo(shaftEnd + 3, 0);
      ctx.lineTo(shaftEnd - 2, 6);
      ctx.stroke();

      // 3) Wide Sweeping Curved Naginata Halberd Blade
      const tipX = shaftEnd + 16;
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.moveTo(shaftEnd, -2.5);
      ctx.quadraticCurveTo(shaftEnd + 9, -6.5, tipX + 2, -2);
      ctx.lineTo(tipX, 2);
      ctx.quadraticCurveTo(shaftEnd + 8, 3.5, shaftEnd, 2.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(shaftEnd + 1, -1.5);
      ctx.quadraticCurveTo(shaftEnd + 9, -5.0, tipX, -1.2);
      ctx.quadraticCurveTo(shaftEnd + 8, 2.2, shaftEnd + 1, 1.2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(shaftEnd + 2, -1.2);
      ctx.quadraticCurveTo(shaftEnd + 9, -4.5, tipX, -1.2);
      ctx.stroke();

      ctx.restore();
    } else if (weaponType === 'gauntlet') {
      // =====================================================================
      // VELO: "MACH-V" TURBINE PISTON GAUNTLETS
      // =====================================================================
      const drawPistonGauntlet = (el: Vec2, hd: Vec2) => {
        const ang = Math.atan2(hd.y - el.y, hd.x - el.x);
        ctx.save();
        ctx.translate(hd.x, hd.y);
        ctx.rotate(ang);

        // Armored Forearm Cowl & Exhaust Fin
        ctx.fillStyle = '#05070d';
        ctx.beginPath();
        ctx.moveTo(-8, -4.5);
        ctx.lineTo(4.5, -5.2);
        ctx.lineTo(6.5, 0);
        ctx.lineTo(4.5, 5.2);
        ctx.lineTo(-8, 4.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(-6.5, -3.2);
        ctx.lineTo(3.5, -3.8);
        ctx.lineTo(5.2, 0);
        ctx.lineTo(3.5, 3.8);
        ctx.lineTo(-6.5, 3.2);
        ctx.closePath();
        ctx.fill();

        // Glowing Golden Impact Knuckle Studs & Plasma Core
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(2, -3.5, 2.5, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -1.2, 3.5, 2.4);

        ctx.restore();
      };

      drawPistonGauntlet(pose.elbowB, pose.handB);
      drawPistonGauntlet(pose.elbowF, pose.handF);
    } else if (weaponType === 'titan') {
      // =====================================================================
      // BRAM: "EARTHSHAKER" TECTONIC PILE-BUNKER CRUSHER CESTUS
      // =====================================================================
      const drawTitanCestus = (el: Vec2, hd: Vec2) => {
        const ang = Math.atan2(hd.y - el.y, hd.x - el.x);
        ctx.save();
        ctx.translate(hd.x, hd.y);
        ctx.rotate(ang);

        // Massive Siege Gauntlet Housing
        ctx.fillStyle = '#05070d';
        ctx.beginPath();
        ctx.moveTo(-10, -6.5);
        ctx.lineTo(6, -7.5);
        ctx.lineTo(9, 0);
        ctx.lineTo(6, 7.5);
        ctx.lineTo(-10, 6.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0f2922';
        ctx.fillRect(-8, -5, 13, 10);

        ctx.fillStyle = accentColor;
        ctx.fillRect(-6, -4, 10, 8);

        // 3 Jagged Front Crusher Claws / Knuckle Spikes
        ctx.fillStyle = secondaryColor;
        for (const ky of [-4.5, 0, 4.5]) {
          ctx.beginPath();
          ctx.moveTo(4, ky - 1.8);
          ctx.lineTo(9.5, ky);
          ctx.lineTo(4, ky + 1.8);
          ctx.closePath();
          ctx.fill();
        }

        // Glowing Gravity Core on back of fist
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -2, 3.5, 4);

        ctx.restore();
      };

      drawTitanCestus(pose.elbowB, pose.handB);
      drawTitanCestus(pose.elbowF, pose.handF);
    } else if (weaponType === 'chains') {
      // =====================================================================
      // SOL: "IGNIS" KUSARIGAMA SICKLE & 8-SPIKED MOLTEN MORNINGSTAR FLAIL
      // =====================================================================
      // 1) Off-hand (handB) Blazing Phoenix Kusarigama Sickle (Kama)
      ctx.save();
      ctx.translate(pose.handB.x, pose.handB.y);
      ctx.rotate(2.2);
      ctx.strokeStyle = '#05070d';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      // Curved molten sickle blade
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.quadraticCurveTo(12, 6, 3, 12);
      ctx.quadraticCurveTo(8, 5, 5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2) Main-hand (handF) Interlocking Chain Links & Spiked Morningstar Meteor
      const tipX = wx + Math.cos(pose.weaponAngle) * (reach + 3);
      const tipY = wy + Math.sin(pose.weaponAngle) * (reach + 3);
      const ctrlX = (wx + tipX) * 0.5;
      const ctrlY = (wy + tipY) * 0.5 + 6;

      // Draw 6 distinct metallic chain links along the quadratic curve
      const links = 6;
      for (let i = 0; i <= links; i++) {
        const u = i / links;
        const inv = 1 - u;
        const lx = inv * inv * wx + 2 * inv * u * ctrlX + u * u * tipX;
        const ly = inv * inv * wy + 2 * inv * u * ctrlY + u * u * tipY;
        ctx.fillStyle = '#05070d';
        ctx.fillRect(Math.round(lx - 2), Math.round(ly - 2), 4, 4);
        ctx.fillStyle = i % 2 === 0 ? secondaryColor : accentColor;
        ctx.fillRect(Math.round(lx - 1.2), Math.round(ly - 1.2), 2.4, 2.4);
      }

      // 8-Spiked Molten Morningstar Head
      ctx.save();
      ctx.translate(Math.round(tipX), Math.round(tipY));
      ctx.rotate(pose.weaponAngle);
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      ctx.fill();

      // 8 Radiating spikes
      ctx.fillStyle = secondaryColor;
      for (let s = 0; s < 8; s++) {
        const sAng = (s * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sAng - 0.25) * 4, Math.sin(sAng - 0.25) * 4);
        ctx.lineTo(Math.cos(sAng) * 8.5, Math.sin(sAng) * 8.5);
        ctx.lineTo(Math.cos(sAng + 0.25) * 4, Math.sin(sAng + 0.25) * 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    } else if (weaponType === 'orbs') {
      // =====================================================================
      // NYX: CELESTIAL ASTROLABE PRISM ORBS & LUMINOUS ASTRAL CHAKRAM
      // =====================================================================
      const tipX = wx + Math.cos(pose.weaponAngle) * (reach * 0.85);
      const tipY = wy + Math.sin(pose.weaponAngle) * (reach * 0.85);
      const orbPts = [
        { x: tipX, y: tipY, r: 6.5 },
        { x: pose.chest.x - 13, y: pose.chest.y - 9, r: 5.0 },
        { x: pose.chest.x + 2, y: pose.chest.y - 20, r: 5.0 },
      ];
      for (const op of orbPts) {
        ctx.save();
        ctx.translate(Math.round(op.x), Math.round(op.y));
        // Outer Golden/Cyan Astrolabe Ring
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, op.r, 0, Math.PI * 2);
        ctx.stroke();

        // 4-Point Faceted Star Prism inside ring
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(0, -op.r - 1.5);
        ctx.lineTo(op.r * 0.55, 0);
        ctx.lineTo(0, op.r + 1.5);
        ctx.lineTo(-op.r * 0.55, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-op.r - 1.5, 0);
        ctx.lineTo(0, -op.r * 0.55);
        ctx.lineTo(op.r + 1.5, 0);
        ctx.lineTo(0, op.r * 0.55);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -1.5, 3, 3);
        ctx.restore();
      }
    } else if (weaponType === 'claws') {
      // =====================================================================
      // JIN: RAZOR CHAKRA-LOOM GAUNTLETS & 3-TALON CURVED PLASMA CLAWS
      // =====================================================================
      for (const [idx, h] of [pose.handF, pose.handB].entries()) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(idx === 0 ? pose.weaponAngle : pose.weaponAngle + 0.35);

        // Chakra-Spool Wrist Bracer
        ctx.fillStyle = '#05070d';
        ctx.fillRect(-3.5, -3.5, 6, 7);
        ctx.fillStyle = accentColor;
        ctx.fillRect(-2.5, -2.5, 4, 5);

        // 3 Long Curved Plasma-Wire Talons
        for (let c = -1; c <= 1; c++) {
          const yOff = c * 2.6;
          const clawLen = idx === 0 ? 13 - Math.abs(c) * 2 : 9.5;
          ctx.strokeStyle = '#05070d';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(2, yOff);
          ctx.quadraticCurveTo(clawLen * 0.6, yOff - 2.2, clawLen, yOff + 1.5);
          ctx.stroke();

          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(2, yOff);
          ctx.quadraticCurveTo(clawLen * 0.6, yOff - 2.2, clawLen, yOff + 1.5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  private drawStickSkeleton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: 1 | -1,
    pose: SkeletonPose,
    bodyColor: string,
    outlineColor: string,
    accentColor: string,
    secondaryColor: string,
    weaponType: WeaponType,
    squashX: number,
    squashY: number,
    drawWeapon: boolean,
    alpha = 1,
    hasEyeTrail = false,
    vx = 0,
    vy = 0
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(facing * squashX, squashY);

    const limbW = weaponType === 'titan' ? 4.8 : 3.5;
    const outlineW = limbW + 2.4;
    const localVx = vx * facing;

    // 1. Sculpted Cel-Shaded Body, Garments, Coats, Hakama, Pauldrons, Greaves, Boots & Fists
    this.drawCharacterBodyAndGarments(
      ctx,
      pose,
      bodyColor,
      outlineColor,
      accentColor,
      secondaryColor,
      weaponType,
      limbW,
      outlineW,
      localVx,
      vy
    );

    // 2. Character-Distinct Head, Jawline, Hair, Helmet, Hat, Horns & Mask
    this.drawCharacterHeadAndHair(
      ctx,
      pose.head,
      pose.chest,
      bodyColor,
      outlineColor,
      accentColor,
      secondaryColor,
      weaponType,
      hasEyeTrail,
      localVx,
      vy
    );

    // 3. Hand-Crafted Multi-Layered Masterwork Weapon
    if (drawWeapon) {
      this.drawMasterworkWeapon(
        ctx,
        pose,
        accentColor,
        secondaryColor,
        weaponType,
        alpha
      );
    }

    ctx.restore();
  }

  private computeWeaponTipLocal(pose: SkeletonPose, weaponType: WeaponType): Vec2 {
    const wx = pose.handF.x;
    const wy = pose.handF.y;
    const reach = pose.weaponReach;
    const ang = pose.weaponAngle;
    const c = Math.cos(ang);
    const s = Math.sin(ang);

    switch (weaponType) {
      case 'scythe': {
        const shaftLen = reach + 7;
        const lx = shaftLen + 6;
        const ly = 14;
        return { x: wx + c * lx - s * ly, y: wy + s * lx + c * ly };
      }
      case 'katana': {
        if (pose.sheathed) return { x: pose.hip.x + 12, y: pose.hip.y - 5 };
        const bladeLen = reach + 9;
        return { x: wx + c * (bladeLen + 2), y: wy + s * (bladeLen + 2) };
      }
      case 'dagger': {
        const scaleLen = reach + 2;
        return { x: wx + c * (scaleLen + 4), y: wy + s * (scaleLen + 4) };
      }
      case 'spear': {
        const tipX = reach + 18;
        return { x: wx + c * tipX, y: wy + s * tipX };
      }
      case 'gauntlet': {
        const gAng = Math.atan2(wy - pose.elbowF.y, wx - pose.elbowF.x);
        return { x: wx + Math.cos(gAng) * 6.5, y: wy + Math.sin(gAng) * 6.5 };
      }
      case 'titan': {
        const tAng = Math.atan2(wy - pose.elbowF.y, wx - pose.elbowF.x);
        return { x: wx + Math.cos(tAng) * 9.5, y: wy + Math.sin(tAng) * 9.5 };
      }
      case 'chains':
        return { x: wx + c * (reach + 3), y: wy + s * (reach + 3) };
      case 'orbs':
        return { x: wx + c * (reach * 0.85), y: wy + s * (reach * 0.85) };
      case 'claws':
        return { x: wx + c * 13, y: wy + s * 13 };
    }
  }

  private getWeaponTrailWidth(weaponType: WeaponType, move: MoveData | null, action: FighterAction): number {
    if (weaponType === 'dagger') {
      if (action === 'ultimate' || move?.category === 'strong' || move?.category === 'special') return 9;
      if (move?.key.startsWith('jab')) return 6;
      return 7.5;
    }
    if (action === 'ultimate' || move?.category === 'strong' || move?.category === 'special') {
      return weaponType === 'titan' || weaponType === 'scythe' ? 26 : 23;
    }
    if (move?.key.startsWith('jab')) {
      return 11;
    }
    return 15;
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    isImpact: boolean,
    impactInverted: boolean,
    tick: number
  ): void {
    if (f.action === 'ko_respawn') {
      this.weaponTrails.get(f.slot)?.trail.clear();
      return;
    }

    // 0. Dynamic Ground Contact Shadow beneath Fighter
    if (!isImpact) {
      const shadowScale = f.grounded ? 1.0 : Math.max(0.35, 1 - Math.abs(106 - f.y) / 140);
      if (shadowScale > 0.36) {
        const shadowY = f.grounded ? f.y + 18 : 124;
        ctx.save();
        ctx.fillStyle = `rgba(2, 6, 23, ${0.46 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.round(f.x),
          Math.round(shadowY),
          (f.id === 'bram' ? 16 : 12.5) * shadowScale,
          3.2 * shadowScale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    }

    // 1. Character-Specific Ambient & State Auras
    if (f.overdriveTimer > 0) {
      // Velo Overdrive electric aura & jagged lightning arcs
      ctx.save();
      ctx.strokeStyle = tick % 4 < 2 ? '#06b6d4' : '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(f.x), Math.round(f.y - 6), 23 + Math.sin(tick * 0.5) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Procedural lightning bolts around body
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      for (let b = 0; b < 2; b++) {
        const startAng = (tick * 0.35 + b * Math.PI) % (Math.PI * 2);
        let lx = f.x + Math.cos(startAng) * 14;
        let ly = f.y - 8 + Math.sin(startAng) * 18;
        ctx.beginPath();
        ctx.moveTo(Math.round(lx), Math.round(ly));
        for (let seg = 0; seg < 3; seg++) {
          lx += (vrand() - 0.5) * 14;
          ly -= 6 + vrand() * 6;
          ctx.lineTo(Math.round(lx), Math.round(ly));
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (f.action === 'kenji_haki' || f.hakiTimer > 0) {
      // Observation Haki concentric crimson-gold ripples + third-eye horizon gleam
      ctx.save();
      for (let r = 0; r < 3; r++) {
        const rad = ((tick * 2.2 + r * 14) % 46) + 10;
        const alpha = 1 - rad / 56;
        ctx.strokeStyle =
          r % 2 === 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(Math.round(f.x), Math.round(f.y - 10), rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Horizontal eye lens flare
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(f.x - 22), Math.round(f.y - 25));
      ctx.lineTo(Math.round(f.x + 22), Math.round(f.y - 25));
      ctx.stroke();
      ctx.restore();
    }

    if (f.action === 'parry') {
      // Crisp Aether Guard Ring when pressing `P` while standing still
      ctx.save();
      const pulse = 22 + Math.sin(tick * 0.6) * 2;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(Math.round(f.x + f.facing * 4), Math.round(f.y - 8), pulse, -1.3, 1.3);
      ctx.stroke();
      ctx.strokeStyle = f.spec.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.round(f.x), Math.round(f.y - 8), pulse + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (f.action === 'kuro_suspend') {
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(Math.round(f.x), Math.round(f.y - 6), 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = f.spec.accentColor;
      ctx.beginPath();
      ctx.moveTo(Math.round(f.x - 16), Math.round(f.y + 12));
      ctx.lineTo(Math.round(f.x + 16), Math.round(f.y + 12));
      ctx.stroke();
      ctx.restore();
    }

    // Bram orbiting gravity shards when he has Kinetic Armor stacks
    if (f.id === 'bram' && f.armorStacks > 0 && !isImpact) {
      ctx.save();
      for (let s = 0; s < f.armorStacks; s++) {
        const ang = tick * 0.08 + (s * Math.PI * 2) / f.armorStacks;
        const gx = Math.round(f.x + Math.cos(ang) * 18);
        const gy = Math.round(f.y - 10 + Math.sin(ang) * 8);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(gx - 2, gy - 2, 5, 5);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
      ctx.restore();
    }

    // Raijin Floating Thunder Drum Ring (Taiko Halo behind shoulders)
    if (f.id === 'raijin' && !isImpact) {
      ctx.save();
      const drumCount = 6;
      const ringR = 16;
      const cx = Math.round(f.x - f.facing * 3);
      const cy = Math.round(f.y - 16);
      for (let d = 0; d < drumCount; d++) {
        const ang = tick * 0.03 + (d * Math.PI * 2) / drumCount;
        const dx = Math.round(cx + Math.cos(ang) * ringR);
        const dy = Math.round(cy + Math.sin(ang) * ringR);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(dx, dy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = d % 2 === 0 ? '#facc15' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(dx, dy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Chrono Clockwork Halo behind back
    if (f.id === 'chrono' && !isImpact) {
      ctx.save();
      const cx = Math.round(f.x - f.facing * 2);
      const cy = Math.round(f.y - 16);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#14b8a6';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(tick * 0.08) * 11, cy + Math.sin(tick * 0.08) * 11);
      ctx.stroke();
      ctx.restore();
    }

    // Sol Phoenix Fire Wings when airborne or in Phoenix Berserk state
    if (f.id === 'sol' && (!f.grounded || f.overdriveTimer > 0) && !isImpact) {
      ctx.save();
      const flap = Math.sin(tick * 0.35) * 5;
      const cx = Math.round(f.x - f.facing * 2);
      const cy = Math.round(f.y - 14);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx - 16, cy - 18 + flap, cx - 26, cy - 8 + flap);
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + 16, cy - 18 + flap, cx + 26, cy - 8 + flap);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 20, cy - 12 + flap);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 20, cy - 12 + flap);
      ctx.stroke();
      ctx.restore();
    }

    // Jin Autonomous Mecha-Puppet "Karasu" & Glowing Chakra Threads!
    if (f.id === 'jin' && f.puppetActive && !isImpact) {
      this.drawJinPuppetAndStrings(ctx, f, tick);
    }

    // Orbiting Cinder Marks (applied by Sol's attacks) on any fighter!
    if (f.cinderMarks > 0 && !isImpact) {
      ctx.save();
      for (let c = 0; c < f.cinderMarks; c++) {
        const ang = tick * 0.14 + (c * Math.PI * 2) / f.cinderMarks;
        const mx = Math.round(f.x + Math.cos(ang) * 16);
        const my = Math.round(f.y - 12 + Math.sin(ang) * 10);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(mx - 1, my - 1, 2, 2);
      }
      ctx.restore();
    }

    // Stasis Slow Aura when inside Chrono's Stasis Field
    if (f.stasisSlowTimer > 0 && !isImpact) {
      ctx.save();
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(Math.round(f.x - 13), Math.round(f.y - 29), 26, 46);
      ctx.restore();
    }

    // 2. Flowing Cel-Shaded Verlet Scarf / Cape Ribbon (with dark border & highlight fold!)
    if (!isImpact && f.scarf.length > 2) {
      ctx.save();
      // Dark Ink Outer Border
      ctx.strokeStyle = '#04060c';
      ctx.lineCap = 'round';
      for (let i = 0; i < f.scarf.length - 1; i++) {
        ctx.lineWidth = Math.max(2.6, 7.0 - i * 0.62);
        ctx.beginPath();
        ctx.moveTo(f.scarf[i].x, f.scarf[i].y);
        ctx.lineTo(f.scarf[i + 1].x, f.scarf[i + 1].y);
        ctx.stroke();
      }
      // Main Scarf Body Fill
      ctx.strokeStyle = f.spec.scarfColor;
      for (let i = 0; i < f.scarf.length - 1; i++) {
        ctx.lineWidth = Math.max(1.4, 4.8 - i * 0.5);
        ctx.beginPath();
        ctx.moveTo(f.scarf[i].x, f.scarf[i].y);
        ctx.lineTo(f.scarf[i + 1].x, f.scarf[i + 1].y);
        ctx.stroke();
      }
      // Top Edge Highlight Trim
      ctx.strokeStyle = f.spec.secondaryColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let i = 0; i < f.scarf.length; i++) {
        if (i === 0) ctx.moveTo(f.scarf[i].x, f.scarf[i].y - 1.2);
        else ctx.lineTo(f.scarf[i].x, f.scarf[i].y - 1.2);
      }
      ctx.stroke();
      ctx.restore();
    }

    const rawPose = this.computePose(
      f.action,
      f.currentMove,
      f.currentMove?.key ?? null,
      f.actionFrame,
      f.facing,
      f.vx,
      f.vy,
      f.grounded,
      f.spec.weaponType,
      f.ultPose
    );

    // Continuous Per-Fighter Skeleton Pose Interpolation (eliminates 1-frame state-transition snapping!)
    const prevRecord = this.smoothedPoses.get(f.slot);
    let pose = rawPose;
    if (
      prevRecord &&
      Math.abs(tick - prevRecord.tick) <= 6 &&
      Math.hypot(f.x - prevRecord.x, f.y - prevRecord.y) < 110
    ) {
      const blendRate =
        f.action === 'attack'
          ? 1
          : f.action === 'ultimate'
          ? 0.36
          : f.action === 'walk' || f.action === 'dash'
          ? 0.34
          : 0.32;
      pose = blendPose(prevRecord.pose, rawPose, blendRate);
    }
    this.smoothedPoses.set(f.slot, {
      pose,
      x: f.x,
      y: f.y,
      facing: f.facing,
      tick,
    });

    const hasSuperArmor =
      f.currentMove?.superArmorFrames &&
      f.actionFrame >= f.currentMove.superArmorFrames[0] &&
      f.actionFrame <= f.currentMove.superArmorFrames[1];

    let bodyColor = f.spec.bodyColor;
    let outlineColor = f.spec.accentColor;
    let accent = f.spec.accentColor;
    let secondary = f.spec.secondaryColor;

    if (isImpact) {
      bodyColor = impactInverted ? '#05070d' : '#f8fafc';
      outlineColor = impactInverted ? '#f8fafc' : '#05070d';
      accent = outlineColor;
      secondary = outlineColor;
    } else if (f.flashWhiteFrames > 0) {
      bodyColor = '#ffffff';
      outlineColor = '#ffffff';
    } else if (hasSuperArmor) {
      outlineColor = '#facc15';
    } else if (f.action === 'parry') {
      outlineColor = '#ffffff';
    }

    const alpha = f.invulnFrames > 0 && tick % 4 < 2 ? 0.58 : 1;
    const hasEyeTrail =
      f.action === 'dash' ||
      f.action === 'airdodge' ||
      f.action === 'ultimate' ||
      f.overdriveTimer > 0 ||
      f.action === 'kuro_suspend' ||
      f.action === 'kenji_haki' ||
      (f.action === 'attack' && f.currentMove?.category === 'special');

    // 2.5D Z-Depth Foreshortening Scale ($S(z) = \frac{260}{260 + z}$, negative z = closer to camera = larger!)
    const zScale = f.z ? Math.max(0.68, Math.min(1.52, 260 / (260 + f.z))) : 1;

    const shake =
      f.action === 'hitstun' && f.hitstopFrames > 0
        ? hitShake(f.hitstopFrames, 2.2, f.slot)
        : { x: 0, y: 0 };

    const drawX = f.x + (f.vibrateX || 0) + shake.x;
    const drawY = f.y + shake.y;
    const sx = f.squashX * zScale;
    const sy = f.squashY * zScale;

    // Weapon-tip Trail per fighter (docs/VFX_SKILL.md Section 6.1)
    const maxAge =
      f.spec.weaponType === 'dagger'
        ? 6
        : f.spec.weaponType === 'chains' || f.spec.weaponType === 'scythe'
        ? 14
        : 9;
    let trailEntry = this.weaponTrails.get(f.slot);
    if (!trailEntry || trailEntry.weaponType !== f.spec.weaponType) {
      trailEntry = { trail: new Trail(16, maxAge), lastTick: tick - 1, weaponType: f.spec.weaponType };
      this.weaponTrails.set(f.slot, trailEntry);
    }
    if (prevRecord && Math.hypot(f.x - prevRecord.x, f.y - prevRecord.y) > 110) {
      trailEntry.trail.clear();
    }
    if (tick !== trailEntry.lastTick) {
      trailEntry.lastTick = tick;
      if ((pose.smearAlpha ?? 0) > 0.15 && !pose.sheathed) {
        const tipLocal = this.computeWeaponTipLocal(pose, f.spec.weaponType);
        const tipX = drawX + f.facing * sx * tipLocal.x;
        const tipY = drawY + sy * tipLocal.y;
        trailEntry.trail.push(tipX, tipY);
      }
      trailEntry.trail.step();
    }
    if (!isImpact && trailEntry.trail.length >= 2) {
      trailEntry.trail.draw(ctx, {
        color: f.spec.accentColor,
        core: '#ffffff',
        width: this.getWeaponTrailWidth(f.spec.weaponType, f.currentMove, f.action),
        alpha,
      });
    }

    // Charge-Up Inward Streaks & Weapon Hand Glow (docs/VFX_SKILL.md Section 3)
    if (
      !isImpact &&
      (f.action === 'strong_charge' || (f.action === 'ultimate' && f.actionFrame <= 60))
    ) {
      if (tick % 2 === 0 && this.lastChargeEmitTick !== tick) {
        this.lastChargeEmitTick = tick;
        const ramp = energyRamp(f.spec.accentColor);
        for (let k = 0; k < 4; k++) {
          const ang = vrand() * Math.PI * 2;
          const dist = 32 + vrand() * 12;
          this.fx.pool.emit({
            x: f.x + Math.cos(ang) * dist,
            y: f.y - 10 + Math.sin(ang) * dist,
            count: 1,
            angle: ang + Math.PI,
            spread: 0.14,
            speed: [3, 5],
            life: [8, 12],
            size: [1.5, 2.4],
            drag: 0.96,
            kind: 'streak',
            ramp,
            stretch: 1.7,
          });
        }
      }
      const handWorldX = drawX + f.facing * sx * pose.handF.x;
      const handWorldY = drawY + sy * pose.handF.y;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(
        ctx,
        handWorldX,
        handWorldY,
        14 + Math.sin(tick * 0.4) * 4,
        hexToRgb(f.spec.accentColor),
        0.85
      );
      ctx.restore();
    }

    this.drawStickSkeleton(
      ctx,
      drawX,
      drawY,
      f.facing,
      pose,
      bodyColor,
      outlineColor,
      accent,
      secondary,
      f.spec.weaponType,
      sx,
      sy,
      true,
      alpha,
      hasEyeTrail,
      f.vx,
      f.vy
    );

    // Player indicator caret above head
    if (!isImpact) {
      ctx.save();
      ctx.fillStyle = f.slot === 0 ? '#f8fafc' : f.spec.accentColor;
      const py = Math.round(f.y - 42 + Math.sin(tick * 0.1) * 1.5);
      const px = Math.round(f.x);
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 4);
      ctx.lineTo(px + 3, py - 4);
      ctx.lineTo(px, py);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawJinPuppetAndStrings(
    ctx: CanvasRenderingContext2D,
    jin: FighterState,
    tick: number
  ): void {
    ctx.save();
    const px = Math.round(jin.puppetX);
    const py = Math.round(jin.puppetY + Math.sin(tick * 0.16) * 2.5);
    const attacking = jin.puppetAttackTimer > 0;
    const dir = jin.facing;

    // 1. Razor Chakra Strings from Jin's hands to Karasu's 4 joints
    ctx.strokeStyle = attacking ? 'rgba(45, 212, 191, 0.92)' : 'rgba(45, 212, 191, 0.5)';
    ctx.lineWidth = attacking ? 1.5 : 1.0;
    const jx = Math.round(jin.x + dir * 12);
    const jy = Math.round(jin.y - 16);
    const joints = [
      { x: px, y: py - 18 },
      { x: px + dir * 12, y: py - 8 },
      { x: px - dir * 10, y: py - 5 },
    ];
    for (const jt of joints) {
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.quadraticCurveTo((jx + jt.x) * 0.5, Math.min(jy, jt.y) - 9, jt.x, jt.y);
      ctx.stroke();
    }

    // 2. Karasu Tattered Shadow Cloak & Segmented Mecha-Oni Ribcage
    ctx.fillStyle = '#090d18';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 11);
    ctx.lineTo(px + 8, py - 11);
    ctx.lineTo(px + 5, py + 7);
    ctx.lineTo(px, py + 12);
    ctx.lineTo(px - 6, py + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ribcage horizontal armor bars
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - 5, py - 7);
    ctx.lineTo(px + 5, py - 7);
    ctx.moveTo(px - 4, py - 3);
    ctx.lineTo(px + 4, py - 3);
    ctx.stroke();

    // 3. 4 Articulated Bladed Mecha-Samurai Arms
    const slashAng = attacking ? Math.sin(tick * 1.1) * 0.9 : 0.25;
    const armreach = attacking ? 21 : 13;
    ctx.strokeStyle = '#05070d';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(px + 7, py - 10);
    ctx.lineTo(px + dir * armreach, py - 11 + Math.sin(slashAng) * 12);
    ctx.moveTo(px - 7, py - 6);
    ctx.lineTo(px + dir * (armreach - 2), py - 1 - Math.sin(slashAng) * 12);
    ctx.stroke();

    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(px + 7, py - 10);
    ctx.lineTo(px + dir * armreach, py - 11 + Math.sin(slashAng) * 12);
    ctx.moveTo(px - 7, py - 6);
    ctx.lineTo(px + dir * (armreach - 2), py - 1 - Math.sin(slashAng) * 12);
    ctx.stroke();

    // 4. Horned Mecha-Oni Head & Glowing 3-Eye Visor
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(px, py - 17, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Twin Oni Horns on Karasu
    ctx.fillStyle = '#2dd4bf';
    ctx.beginPath();
    ctx.moveTo(px - 3, py - 21);
    ctx.lineTo(px - 6, py - 27);
    ctx.lineTo(px - 1, py - 22);
    ctx.moveTo(px + 3, py - 21);
    ctx.lineTo(px + 6, py - 27);
    ctx.lineTo(px + 1, py - 22);
    ctx.fill();

    // Glowing 3-eyed visor
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(px - 3, py - 18, 6, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + dir * 1, py - 18, 2, 1.5);
    ctx.restore();
  }

  private drawGhostStickman(ctx: CanvasRenderingContext2D, g: Afterimage): void {
    const wType = g.weaponType ?? 'gauntlet';
    const pose = this.computePose(
      g.action,
      null,
      g.moveKey,
      g.moveFrame,
      g.facing,
      0,
      0,
      true,
      wType
    );
    this.drawStickSkeleton(
      ctx,
      g.x,
      g.y,
      g.facing,
      pose,
      g.color,
      g.color,
      g.color,
      g.color,
      wType,
      1,
      1,
      false,
      g.alpha,
      false
    );
  }

  private drawDelayedSlash(
    ctx: CanvasRenderingContext2D,
    ds: DelayedSlash,
    tick: number
  ): void {
    ctx.save();
    ctx.translate(Math.round(ds.x), Math.round(ds.y));
    ctx.rotate(ds.angle);
    const imminent = ds.timer < 7;
    const half = ds.length * 0.5;

    // Outer glow diamond slash
    ctx.fillStyle = ds.color;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(0, imminent ? -4.5 : -2.2);
    ctx.lineTo(half, 0);
    ctx.lineTo(0, imminent ? 4.5 : 2.2);
    ctx.closePath();
    ctx.fill();

    // White hot core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-half * 0.8, 0);
    ctx.lineTo(0, imminent ? -2 : -1);
    ctx.lineTo(half * 0.8, 0);
    ctx.lineTo(0, imminent ? 2 : 1);
    ctx.closePath();
    ctx.fill();

    // Center glint star
    if (tick % 2 === 0 || imminent) {
      ctx.fillRect(-2, -6, 4, 12);
    }
    ctx.restore();
  }

  private drawInkAndBlinkSplats(ctx: CanvasRenderingContext2D): void {
    for (const s of this.inkSplats) {
      const t = clamp01(s.age / s.life);
      if (s.isBlink) {
        const col = hexToRgb(s.color);
        // Contracting ring at origin + expanding shock ring
        drawShockRing(ctx, s.x, s.y, 1 - t, s.r * 1.15, 4, col);
        drawShockRing(ctx, s.x, s.y, t, s.r * 1.55, 4.5, col);
        if (s.color === '#a855f7' || s.color === '#e879f9') {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          drawInkSplat(ctx, s.x, s.y, s.r * (0.65 + t * 0.35), s.seed, '#0b0b14');
          ctx.restore();
        } else {
          drawStarFlare(ctx, s.x, s.y, s.r * 0.42, t * 1.2, col, 1 - t);
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 1 - Math.pow(t, 1.6);
        const rad = s.r * (0.7 + t * 0.45);
        drawInkSplat(ctx, s.x, s.y, rad, s.seed, '#0b0b14');
        drawInkSplat(ctx, s.x + 5, s.y - 3, rad * 0.8, s.seed + 7, s.color);
        ctx.restore();
      }
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, tick: number): void {
    // 1. Ribbon Trail per projectile (docs/VFX_SKILL.md Section 3)
    let pTrail = this.projectileTrails.get(p.id);
    if (!pTrail) {
      pTrail = { trail: new Trail(10, 7), lastTick: tick - 1 };
      this.projectileTrails.set(p.id, pTrail);
    }
    if (tick !== pTrail.lastTick) {
      pTrail.lastTick = tick;
      pTrail.trail.push(p.x, p.y);
      pTrail.trail.step();
    }
    pTrail.trail.draw(ctx, {
      color: p.color,
      core: '#ffffff',
      width: p.radius * 1.8,
    });

    const col = hexToRgb(p.color);
    const dir = p.vx >= 0 ? 1 : -1;

    // 2. Soft Additive Glow Halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, p.x, p.y, p.radius * 2.8, col, 0.7);
    ctx.restore();

    // 3. Crescent Energy Body + White-Hot Core
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.scale(dir, 1);

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 4, -1.25, 1.25);
    ctx.arc(-4, 0, p.radius + 1, 1.1, -1.1, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(1, 0, p.radius, -0.95, 0.95);
    ctx.arc(-2, 0, p.radius * 0.7, 0.85, -0.85, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Rotating 4-Point Star Flare at Nose
    drawStarFlare(
      ctx,
      p.x + dir * p.radius * 0.6,
      p.y,
      p.radius * 0.6,
      tick * 0.25,
      col,
      0.95
    );
  }

  // Tapered Crescent Anime Slash Arc with outer glow & white-hot core
  private drawSlashArc(ctx: CanvasRenderingContext2D, arc: SlashArc): void {
    // Sweeping tapered ribbon (see docs/VFX_SKILL.md): head races along the arc, tail lags and fades.
    const progress = clamp01(1 - arc.life / arc.maxLife);
    drawArcSweep(
      ctx,
      {
        x: Math.round(arc.x),
        y: Math.round(arc.y),
        facing: arc.facing,
        angleStart: arc.angleStart,
        angleEnd: arc.angleEnd,
        radius: arc.radius,
        thickness: arc.thickness,
        color: arc.color,
        coreColor: arc.coreColor,
      },
      progress
    );
  }

  private drawShockwave(ctx: CanvasRenderingContext2D, sw: ShockwaveRing): void {
    const t = clamp01(1 - sw.life / sw.maxLife);
    drawShockRing(ctx, Math.round(sw.x), Math.round(sw.y), t, sw.maxRadius, Math.max(2, sw.lineWidth * 2.4), hexToRgb(sw.color));
  }

  private drawParticle(ctx: CanvasRenderingContext2D, pt: Particle): void {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    const sz = Math.max(1, pt.size);

    if (pt.shape === 'spark') {
      // Tapered, velocity-stretched additive streak with hot core
      ctx.globalAlpha = 1;
      drawStreak(ctx, pt.x, pt.y, pt.vx, pt.vy, sz, hexToRgb(pt.color), Math.min(1, alpha * 1.25), 2.3);
    } else if (pt.shape === 'flare') {
      // Glowing 4-point anime star
      ctx.globalAlpha = 1;
      drawStarFlare(ctx, pt.x, pt.y, sz, pt.angle ?? 0, hexToRgb(pt.color), alpha);
    } else if (pt.shape === 'debris') {
      // Rotating stone/stage rubble chunk
      ctx.translate(Math.round(pt.x), Math.round(pt.y));
      ctx.rotate(pt.angle ?? 0);
      ctx.fillStyle = pt.color;
      ctx.fillRect(-sz * 0.6, -sz * 0.5, sz * 1.2, sz);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-sz * 0.6, -sz * 0.5, sz * 0.8, 1.2);
    } else if (pt.shape === 'wind_cone') {
      // 3-Layer Sonic Dash Cone + Squashed Shock Ring (docs/VFX_SKILL.md Section 3)
      const col = hexToRgb(pt.color);
      const t = clamp01(1 - alpha);
      ctx.globalAlpha = 1;
      drawShockRing(ctx, Math.round(pt.x), Math.round(pt.y), t, sz * 4.2, 4, col, 0.45);
      ctx.translate(Math.round(pt.x), Math.round(pt.y));
      ctx.rotate(pt.angle ?? 0);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, 0, 0, sz * 2.5, col, alpha * 0.65);
      ctx.strokeStyle = pt.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-11, -14);
      ctx.moveTo(9, 0);
      ctx.lineTo(-11, 14);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-9, -12);
      ctx.moveTo(9, 0);
      ctx.lineTo(-9, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - sz * 0.5), Math.round(pt.y - sz * 0.5), sz, sz);
    }
    ctx.restore();
  }

  private drawDebugBoxes(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    stage: StageSpec,
    tick: number
  ): void {
    ctx.save();
    // 1. Platform collision surface hitboxes
    for (const rawPlat of stage.platforms) {
      const p = resolvePlatformAtTick(rawPlat, tick);
      ctx.strokeStyle = p.isMain ? '#38bdf8' : '#facc15';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(Math.round(p.left), Math.round(p.y), Math.round(p.width), Math.round(p.thickness));
    }
    if (stage.jumpPads) {
      for (const pad of stage.jumpPads) {
        ctx.strokeStyle = '#ec4899';
        ctx.strokeRect(Math.round(pad.x - pad.width * 0.5), Math.round(pad.y - 10), pad.width, 12);
      }
    }

    // 2. Fighter hurtboxes & active attack hitboxes
    for (const f of fighters) {
      ctx.strokeStyle =
        f.action === 'kenji_haki' || f.action === 'parry' ? '#f59e0b' : '#22c55e';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(f.x - 10), Math.round(f.y - 28), 20, 46);

      if (f.action === 'attack' && f.currentMove) {
        const m = f.currentMove;
        if (
          f.actionFrame >= m.startup &&
          f.actionFrame < m.startup + m.active &&
          m.hitbox.width > 0
        ) {
          const hx = f.x + m.hitbox.offsetX * f.facing - m.hitbox.width * 0.5;
          const hy = f.y + m.hitbox.offsetY - m.hitbox.height * 0.5;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
          ctx.fillRect(Math.round(hx), Math.round(hy), m.hitbox.width, m.hitbox.height);
          ctx.strokeStyle = '#ef4444';
          ctx.strokeRect(Math.round(hx), Math.round(hy), m.hitbox.width, m.hitbox.height);
        }
      }
    }
    ctx.restore();
  }
}
