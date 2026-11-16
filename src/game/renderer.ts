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

function easeInOutQuad(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

function blendPose(a: SkeletonPose, b: SkeletonPose, t: number): SkeletonPose {
  const k = clamp01(t);
  return {
    hip: lerpVec(a.hip, b.hip, k),
    spine: lerpVec(a.spine, b.spine, k),
    chest: lerpVec(a.chest, b.chest, k),
    head: lerpVec(a.head, b.head, k),
    shoulderF: lerpVec(a.shoulderF, b.shoulderF, k),
    elbowF: lerpVec(a.elbowF, b.elbowF, k),
    handF: lerpVec(a.handF, b.handF, k),
    shoulderB: lerpVec(a.shoulderB, b.shoulderB, k),
    elbowB: lerpVec(a.elbowB, b.elbowB, k),
    handB: lerpVec(a.handB, b.handB, k),
    kneeF: lerpVec(a.kneeF, b.kneeF, k),
    footF: lerpVec(a.footF, b.footF, k),
    kneeB: lerpVec(a.kneeB, b.kneeB, k),
    footB: lerpVec(a.footB, b.footB, k),
    weaponAngle: lerp(a.weaponAngle, b.weaponAngle, k),
    weaponReach: lerp(a.weaponReach, b.weaponReach, k),
    offhandWeaponAngle:
      a.offhandWeaponAngle !== undefined && b.offhandWeaponAngle !== undefined
        ? lerp(a.offhandWeaponAngle, b.offhandWeaponAngle, k)
        : b.offhandWeaponAngle ?? a.offhandWeaponAngle,
    sheathed: k < 0.5 ? a.sheathed : b.sheathed,
    smearAlpha: lerp(a.smearAlpha ?? 0, b.smearAlpha ?? 0, k),
    smearSpan: lerp(a.smearSpan ?? 0, b.smearSpan ?? 0, k),
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
  camX: number;
  camY: number;
  camZoom: number;
  camAngle?: number;
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

    // 1. Background & Parallax Stage
    if (scene.impactFrames > 0) {
      this.drawImpactBackground(ctx, scene.impactInverted, scene.tick);
    } else {
      this.drawParallaxStage(ctx, scene);
    }

    // 2. World-space Camera Transform (with dynamic Dutch Angle rotation during Ultimates!)
    ctx.save();
    ctx.translate(
      Math.round(RENDER_W * 0.5 + scene.shakeX),
      Math.round(RENDER_H * 0.5 + scene.shakeY)
    );
    if (scene.camAngle) {
      ctx.rotate(scene.camAngle);
    }
    ctx.scale(scene.camZoom, scene.camZoom);
    ctx.translate(-scene.camX, -scene.camY);

    // 3. Stage Platforms, Jump Pads & Spatial Boundaries
    this.drawPlatforms(ctx, scene.stage, scene.impactFrames > 0, scene.tick);

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

    // 6. Kenji Observation Foresight Rings
    this.drawObservationForesight(ctx, scene.fighters, scene.tick);

    // 7. Fighters
    for (const f of scene.fighters) {
      this.drawFighter(ctx, f, scene.impactFrames > 0, scene.impactInverted, scene.tick);
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

    // 10.5. Character-Specific Ultimate World Spectacles (Telegraphs & Cataclysms)
    this.drawUltimateWorldSpectacle(ctx, scene.fighters, scene.tick);

    // 11. Particles (Sparks, 4-Point Flares, Debris, Wind Cones)
    for (const pt of scene.particles) {
      this.drawParticle(ctx, pt);
    }

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

  private drawUltimateWorldSpectacle(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    tick: number
  ): void {
    for (const f of fighters) {
      if (f.action !== 'ultimate') continue;
      const af = f.actionFrame;
      const zx = f.anchorX;
      const zy = f.anchorY;

      ctx.save();
      try {
        // 1. Cutscene Awakening Pillar on Caster (Frames 1..44)
        if (af <= 44) {
          const pRatio = af / 44;
          ctx.strokeStyle = f.spec.secondaryColor;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.arc(f.x, f.y - 12, 18 + Math.sin(tick * 0.4) * 6 + pRatio * 18, 0, Math.PI * 2);
          ctx.stroke();

          // Rising awakening rings
          for (let r = 0; r < 3; r++) {
            const ry = f.y + 16 - ((af * 2.2 + r * 18) % 52);
            ctx.strokeStyle = r % 2 === 0 ? '#fde047' : f.spec.accentColor;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.ellipse(f.x, ry, 22 - r * 3, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (af >= 45 && af <= 82) {
          // 2. Telegraph & Evasion Window (Frames 45..82) — Distinct Danger Zone + Character Construct!
          const tProg = (af - 45) / 37; // 0 -> 1 as detonation approaches
          const pulse = 0.55 + Math.sin(tick * 0.65) * 0.35;
          let halfW = 86;
          let halfH = 74;
          if (f.id === 'kenji' || f.id === 'raijin') {
            halfW = 108;
            halfH = 64;
          } else if (f.id === 'velo' || f.id === 'chrono') {
            halfW = 78;
            halfH = 82;
          }

          // Unblockable Danger Zone Perimeter Box & Fill
          ctx.fillStyle = `rgba(239, 68, 68, ${0.11 + tProg * 0.16})`;
          ctx.fillRect(zx - halfW, zy - halfH, halfW * 2, halfH * 2);
          ctx.strokeStyle = tick % 4 < 2 ? '#ef4444' : '#fde047';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 5]);
          ctx.strokeRect(zx - halfW, zy - halfH, halfW * 2, halfH * 2);
          ctx.setLineDash([]);

          // Shrinking Lock-On Countdown Ring inside the Danger Zone
          ctx.strokeStyle = f.spec.secondaryColor;
          ctx.lineWidth = 2.2;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(zx, zy, Math.max(8, (1 - tProg) * 68), 0, Math.PI * 2);
          ctx.stroke();

          // Character-Specific Telegraph Visuals
          if (f.id === 'kuro') {
            // Giant Blood-Moon Eclipse & Phantom Grim Reaper Scythe hovering above zone
            ctx.fillStyle = 'rgba(168, 85, 247, 0.28)';
            ctx.beginPath();
            ctx.arc(zx, zy - 46, 36, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e879f9';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(zx, zy - 46, 44, -Math.PI * 0.8, Math.PI * 0.2);
            ctx.stroke();
          } else if (f.id === 'velo') {
            // Orbital Laser Lock-On Crosshair & Diagonal Re-entry Vector Line
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(zx, zy);
            ctx.stroke();
            ctx.strokeStyle = '#facc15';
            ctx.beginPath();
            ctx.ellipse(zx, zy + 12, 54, 14, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else if (f.id === 'kenji') {
            // Conqueror Haki Black-Crimson Sever Horizon Line
            ctx.strokeStyle = tick % 2 === 0 ? '#ef4444' : '#090d16';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(zx - halfW - 14, zy);
            ctx.lineTo(zx + halfW + 14, zy);
            ctx.stroke();
          } else if (f.id === 'bram') {
            // Event Horizon Black Hole Singularity Core
            ctx.fillStyle = '#05070d';
            ctx.beginPath();
            ctx.arc(zx, zy, 18 + Math.sin(tick * 0.5) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2.8;
            ctx.stroke();
          } else if (f.id === 'raijin') {
            // 4 Celestial Thunder Pillar Target Markers
            for (let p = -1.5; p <= 1.5; p += 1) {
              const px = zx + p * 54;
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(px, zy - 140);
              ctx.lineTo(px, zy + 24);
              ctx.stroke();
            }
          } else if (f.id === 'chrono') {
            // Giant XII Golden Cathedral Clockface spinning toward Midnight
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(zx, zy, 62, 0, Math.PI * 2);
            ctx.stroke();
            const handAng = -Math.PI * 0.5 + tProg * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(zx, zy);
            ctx.lineTo(zx + Math.cos(handAng) * 52, zy + Math.sin(handAng) * 52);
            ctx.moveTo(zx, zy);
            ctx.lineTo(zx, zy - 38);
            ctx.stroke();
          } else if (f.id === 'sol') {
            // Condensing Miniature Supernova Sun & Phoenix Wings
            const sunR = 16 + tProg * 28;
            ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
            ctx.beginPath();
            ctx.arc(zx, zy - 24, sunR + 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(zx, zy - 24, sunR, 0, Math.PI * 2);
            ctx.fill();
          } else if (f.id === 'nyx') {
            // Twin Abyssal Wormhole Gates flanking the target zone
            for (const side of [-1, 1]) {
              ctx.strokeStyle = side < 0 ? '#ec4899' : '#38bdf8';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.ellipse(zx + side * 72, zy - 18, 12, 38, side * 0.25, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (f.id === 'jin') {
            // Crimson-Teal Calamity Chakra Web across the zone
            ctx.strokeStyle = pulse > 0.6 ? '#2dd4bf' : '#f43f5e';
            ctx.lineWidth = 1.6;
            for (let w = -3; w <= 3; w++) {
              ctx.beginPath();
              ctx.moveTo(f.puppetX, f.puppetY);
              ctx.lineTo(zx + w * 26, zy + 24);
              ctx.stroke();
            }
          }
        } else if (af >= 83 && af <= 115) {
          // 3. Cataclysm Detonation Visuals (Frames 83..115)
          const cProg = (af - 83) / 32;
          const alpha = Math.max(0, 1 - cProg);
          ctx.globalAlpha = alpha;

          if (f.id === 'kuro') {
            // Colossal Crescent Reaper Guillotine Arc & Underworld Pillars
            ctx.strokeStyle = '#e879f9';
            ctx.lineWidth = 14 * alpha;
            ctx.beginPath();
            ctx.arc(zx, zy - 10, 82, -Math.PI * 0.85, Math.PI * 0.45);
            ctx.stroke();
          } else if (f.id === 'velo') {
            // Orbital Plasma Meteor Pillar & Mach Shock Cone
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(zx - 32 * alpha, zy - 220, 64 * alpha, 245);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(zx - 14 * alpha, zy - 220, 28 * alpha, 245);
          } else if (f.id === 'kenji') {
            // Horizon-Splitting Amaterasu Sever & Criss-Cross Judgment Cuts
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 10 * alpha;
            ctx.beginPath();
            ctx.moveTo(zx - 140, zy);
            ctx.lineTo(zx + 140, zy);
            ctx.stroke();
            for (let j = -2; j <= 2; j++) {
              ctx.strokeStyle = j % 2 === 0 ? '#ffffff' : '#f59e0b';
              ctx.lineWidth = 3 * alpha;
              ctx.beginPath();
              ctx.moveTo(zx + j * 38 - 28, zy - 56);
              ctx.lineTo(zx + j * 38 + 28, zy + 56);
              ctx.stroke();
            }
          } else if (f.id === 'bram') {
            // Tectonic Emerald Spires & Crushed Singularity Dome
            ctx.fillStyle = '#10b981';
            for (let s = -2; s <= 2; s++) {
              const sx = zx + s * 34;
              const sh = (75 - Math.abs(s) * 12) * alpha;
              ctx.beginPath();
              ctx.moveTo(sx - 14, zy + 22);
              ctx.lineTo(sx, zy + 22 - sh);
              ctx.lineTo(sx + 14, zy + 22);
              ctx.closePath();
              ctx.fill();
            }
          } else if (f.id === 'raijin') {
            // 4 Colossal Celestial Lightning Pillars
            for (let p = -1.5; p <= 1.5; p += 1) {
              const px = zx + p * 54;
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(px - 14 * alpha, zy - 220, 28 * alpha, 244);
              ctx.fillStyle = '#fde047';
              ctx.fillRect(px - 6 * alpha, zy - 220, 12 * alpha, 244);
            }
          } else if (f.id === 'chrono') {
            // Shattered Golden Stained-Glass Cathedral Clock Shards
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 3.5 * alpha;
            for (let k = 0; k < 12; k++) {
              const ang = (k / 12) * Math.PI * 2;
              const r = 20 + cProg * 78;
              ctx.beginPath();
              ctx.moveTo(zx + Math.cos(ang) * (r - 16), zy + Math.sin(ang) * (r - 16));
              ctx.lineTo(zx + Math.cos(ang + 0.22) * (r + 14), zy + Math.sin(ang + 0.22) * (r + 14));
              ctx.stroke();
            }
          } else if (f.id === 'sol') {
            // Towering Phoenix Inferno Pillar
            ctx.fillStyle = '#f97316';
            ctx.fillRect(zx - 58 * alpha, zy - 210, 116 * alpha, 236);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(zx - 28 * alpha, zy - 210, 56 * alpha, 236);
          } else if (f.id === 'nyx') {
            // Intersecting Dimensional Hyper-Beams
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 18 * alpha;
            ctx.beginPath();
            ctx.moveTo(zx - 82, zy - 58);
            ctx.lineTo(zx + 82, zy + 42);
            ctx.moveTo(zx + 82, zy - 58);
            ctx.lineTo(zx - 82, zy + 42);
            ctx.stroke();
          } else if (f.id === 'jin') {
            // Awakened Karasu 6-Blade Cross Guillotine
            ctx.strokeStyle = '#2dd4bf';
            ctx.lineWidth = 5 * alpha;
            for (let b = 0; b < 6; b++) {
              const ang = (b / 6) * Math.PI + cProg * 1.5;
              ctx.beginPath();
              ctx.moveTo(zx - Math.cos(ang) * 84, zy - Math.sin(ang) * 84);
              ctx.lineTo(zx + Math.cos(ang) * 84, zy + Math.sin(ang) * 84);
              ctx.stroke();
            }
          }
        }
      } finally {
        ctx.restore();
      }
    }
  }

  private drawUltimateCutsceneOverlay(
    ctx: CanvasRenderingContext2D,
    fighters: [FighterState, FighterState],
    tick: number
  ): void {
    const caster = fighters.find((f) => f.action === 'ultimate' && f.actionFrame <= 82);
    if (!caster) return;
    const af = caster.actionFrame;

    ctx.save();

    // 1. Cinematic Widescreen Anime Letterbox Bars (Frames 1..82)
    const barProgress = af <= 44 ? Math.min(1, af / 8) : Math.max(0.35, 1 - (af - 44) / 50);
    const barH = Math.round(28 * barProgress);
    ctx.fillStyle = 'rgba(4, 6, 12, 0.92)';
    ctx.fillRect(0, 0, RENDER_W, barH);
    ctx.fillRect(0, RENDER_H - barH, RENDER_W, barH);

    // Accent border lines on letterbox bars
    ctx.fillStyle = caster.spec.accentColor;
    ctx.fillRect(0, barH - 2, RENDER_W, 2);
    ctx.fillRect(0, RENDER_H - barH, RENDER_W, 2);

    // 2. Diagonal Anime Cut-In Banner during Cutscene Freeze (Frames 4..44)
    if (af >= 4 && af <= 44) {
      const slideIn = Math.min(1, (af - 4) / 7);
      const fadeOut = af >= 36 ? 1 - (af - 36) / 9 : 1;
      ctx.globalAlpha = slideIn * fadeOut;

      // Diagonal speed-line ribbon across top-middle of screen
      ctx.save();
      ctx.translate(RENDER_W * 0.5, 92);
      ctx.rotate(-0.055 * caster.facing);

      ctx.fillStyle = 'rgba(7, 10, 18, 0.92)';
      ctx.fillRect(-420, -28, 840, 56);
      ctx.fillStyle = caster.spec.accentColor;
      ctx.fillRect(-420, -28, 840, 3);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-420, 25, 840, 3);

      // Speed streaks inside banner
      ctx.strokeStyle = caster.spec.secondaryColor;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const sx = ((i * 97 + tick * 28) % 800) - 400;
        const sy = -22 + (i % 5) * 11;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 65, sy);
        ctx.stroke();
      }

      // Caster Name + Ultimate Art Title
      ctx.textAlign = 'center';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = caster.spec.secondaryColor;
      ctx.fillText(
        `${caster.spec.name} // UNBLOCKABLE ULTIMATE AWAKENING`,
        0,
        -9
      );

      ctx.font = '900 24px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caster.spec.ultimateName, 0, 17);
      ctx.restore();
    }

    // 3. Evasion Phase HUD Warning Banner (Frames 45..82)
    if (af >= 45 && af <= 82) {
      const pulse = tick % 8 < 4;
      ctx.textAlign = 'center';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.fillStyle = pulse ? '#ef4444' : '#fde047';
      ctx.fillText(
        `⚠ ${caster.spec.ultimateName} — UNBLOCKABLE! RUN OR DODGE OUT OF THE DANGER ZONE! ⚠`,
        RENDER_W * 0.5,
        barH + 18
      );
    }

    ctx.restore();
  }

  private drawParallaxStage(ctx: CanvasRenderingContext2D, scene: RenderSceneData): void {
    const { stage, camX, camY, tick } = scene;
    const grad = ctx.createLinearGradient(0, 0, 0, RENDER_H);
    grad.addColorStop(0, stage.skyTop);
    grad.addColorStop(0.55, stage.skyMid);
    grad.addColorStop(1, stage.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, RENDER_W, RENDER_H);

    // Distant stars / atmospheric motes
    ctx.fillStyle = 'rgba(248, 250, 252, 0.35)';
    for (let i = 0; i < 42; i++) {
      const sx = (((i * 137 + 50 - camX * 0.04) % RENDER_W) + RENDER_W) % RENDER_W;
      const sy = (i * 73 + 20) % (RENDER_H * 0.62);
      const sz = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), sz, sz);
    }

    if (stage.id === 'void_flat') {
      // HORIZON ZERO: Total Solar Eclipse + Infinite Mirror Water Horizon
      const ex = Math.round(RENDER_W * 0.5 - camX * 0.06);
      const ey = Math.round(138 - camY * 0.05);
      const pulse = Math.sin(tick * 0.03) * 4;

      // Outer corona glow
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.arc(ex, ey, 94 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Rotating solar rays
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(tick * 0.004);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 58, Math.sin(a) * 58);
        ctx.lineTo(Math.cos(a) * (88 + (i % 2) * 18), Math.sin(a) * (88 + (i % 2) * 18));
        ctx.stroke();
      }
      ctx.restore();

      // Bright diamond ring + black eclipse core
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey, 54, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#030611';
      ctx.beginPath();
      ctx.arc(ex, ey, 52, 0, Math.PI * 2);
      ctx.fill();

      // Mirror water reflection lines on the lower horizon
      const horizonY = 305;
      ctx.fillStyle = 'rgba(7, 15, 34, 0.85)';
      ctx.fillRect(0, horizonY, RENDER_W, RENDER_H - horizonY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 1;
      for (let r = 0; r < 14; r++) {
        const ry = horizonY + r * 10;
        const rw = Math.max(12, 130 - r * 7 + Math.sin(tick * 0.08 + r) * 12);
        ctx.beginPath();
        ctx.moveTo(ex - rw, ry);
        ctx.lineTo(ex + rw, ry);
        ctx.stroke();
      }
    } else if (stage.id === 'torii') {
      // CRIMSON TORII SHRINE: Blood Moon, Layered Mountains, Torii & Sakura Petals
      const mx = Math.round(RENDER_W * 0.5 - camX * 0.07);
      const my = Math.round(135 - camY * 0.05);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
      ctx.beginPath();
      ctx.arc(mx, my, 96, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(mx, my, 64, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(mx - 10, my - 10, 48, 0, Math.PI * 2);
      ctx.fill();

      this.drawMountainLayer(ctx, camX * 0.12, '#140f24', 290, 55, 0.008);
      this.drawMountainLayer(ctx, camX * 0.22, '#1d142f', 330, 38, 0.014);

      const gx = Math.round(RENDER_W * 0.5 - camX * 0.35);
      const gy = Math.round(305 - camY * 0.2);
      ctx.fillStyle = '#180c1e';
      ctx.fillRect(gx - 58, gy - 95, 12, 130);
      ctx.fillRect(gx + 46, gy - 95, 12, 130);
      ctx.fillStyle = '#be123c';
      ctx.fillRect(gx - 78, gy - 102, 156, 10);
      ctx.fillStyle = '#0c0816';
      ctx.fillRect(gx - 86, gy - 112, 172, 9);
      ctx.fillRect(gx - 66, gy - 78, 132, 7);

      // Drifting sakura petals
      ctx.fillStyle = '#fda4af';
      for (let i = 0; i < 22; i++) {
        const px = (((i * 83 - tick * 0.85 - camX * 0.25) % RENDER_W) + RENDER_W) % RENDER_W;
        const py = (i * 47 + tick * 0.55 + Math.sin(tick * 0.04 + i) * 8) % RENDER_H;
        ctx.fillRect(Math.floor(px), Math.floor(py), 3, 2);
      }

      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const lx = Math.round(RENDER_W * 0.5 + i * 135 - camX * 0.28);
        const ly = Math.round(250 + Math.sin(tick * 0.03 + i) * 6 - camY * 0.15);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
        ctx.fillRect(lx - 8, ly - 8, 16, 20);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(lx - 3, ly - 4, 6, 9);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(lx - 2, ly - 2, 4, 5);
      }
    } else if (stage.id === 'dojo') {
      // CLOUD PAGODA DOJO: Grand Multi-Tier Pagoda Silhouette, Scrolling Clouds & Banners
      const px = Math.round(RENDER_W * 0.5 - camX * 0.14);
      const py = Math.round(285 - camY * 0.1);
      ctx.fillStyle = '#0b1829';
      for (let tier = 0; tier < 4; tier++) {
        const tw = 150 - tier * 26;
        const ty = py - tier * 38;
        ctx.fillRect(px - tw * 0.5, ty - 28, tw, 26);
        ctx.beginPath();
        ctx.moveTo(px - tw * 0.65, ty - 26);
        ctx.lineTo(px + tw * 0.65, ty - 26);
        ctx.lineTo(px + tw * 0.48, ty - 38);
        ctx.lineTo(px - tw * 0.48, ty - 38);
        ctx.closePath();
        ctx.fill();
      }
      // Spire
      ctx.fillRect(px - 3, py - 190, 6, 40);

      // Drifting golden-rimmed cloud banks
      for (let c = 0; c < 6; c++) {
        const cx = (((c * 175 + tick * 0.35 - camX * 0.2) % (RENDER_W + 160)) - 80);
        const cy = 265 + (c % 2) * 32;
        ctx.fillStyle = 'rgba(30, 58, 95, 0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.arc(cx + 34, cy + 6, 32, 0, Math.PI * 2);
        ctx.arc(cx - 32, cy + 8, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = -1; i <= 1; i += 2) {
        const lx = Math.round(RENDER_W * 0.5 + i * 190 - camX * 0.22);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
        ctx.beginPath();
        ctx.arc(lx, 125, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(lx - 7, 108, 14, 22);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lx - 4, 112, 8, 14);
      }
    } else if (stage.id === 'monolith') {
      // TWIN ABYSS RIFT: Swirling Chasm Vortex, Ley-Line Beams & Floating Rune Obelisks
      const rx = Math.round(RENDER_W * 0.5 - camX * 0.1);
      const ry = Math.round(285 - camY * 0.08);

      // Vertical emerald energy beam shooting from the central chasm
      const beamGrad = ctx.createLinearGradient(rx - 45, 0, rx + 45, 0);
      beamGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
      beamGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.22)');
      beamGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(rx - 45, 0, 90, RENDER_H);

      for (let r = 95; r >= 25; r -= 18) {
        ctx.strokeStyle = r === 43 ? '#34d399' : 'rgba(16, 185, 129, 0.32)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rx, ry, r * 1.5, r * 0.5, Math.sin(tick * 0.015) * 0.12, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const sx = Math.round(RENDER_W * 0.5 + i * 115 - camX * 0.22);
        const sy = Math.round(200 + Math.sin(tick * 0.03 + i * 1.3) * 12);
        ctx.fillStyle = '#0f292e';
        ctx.fillRect(sx - 10, sy - 28, 20, 56);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx - 2, sy - 16, 4, 32);
      }
    } else if (stage.id === 'coliseum') {
      // TITAN COLISEUM: Giant Ancient Sword Monument, Grand Arches & Burning Braziers
      const cx = Math.round(RENDER_W * 0.5 - camX * 0.12);
      const cy = Math.round(240 - camY * 0.08);

      // Giant planted Greatsword monument in the distance
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#27120b';
      ctx.fillRect(-16, -150, 32, 220); // giant blade
      ctx.fillStyle = '#431e12';
      ctx.fillRect(-4, -150, 8, 200); // fuller
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-58, -156, 116, 16); // crossguard
      ctx.fillRect(-10, -210, 20, 54); // grip
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-6, -152, 12, 8); // glowing core rune
      ctx.restore();

      // Background coliseum arches
      ctx.fillStyle = '#1a0c08';
      ctx.fillRect(0, 275, RENDER_W, 175);
      for (let i = -4; i <= 4; i++) {
        const ax = Math.round(RENDER_W * 0.5 + i * 92 - camX * 0.24);
        ctx.fillStyle = '#2e150f';
        ctx.fillRect(ax - 12, 225, 24, 95);
        // Fire braziers on alternate pillars
        if (i % 2 === 0) {
          const flk = Math.sin(tick * 0.25 + i) * 4;
          ctx.fillStyle = 'rgba(249, 115, 22, 0.24)';
          ctx.beginPath();
          ctx.arc(ax, 212, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(ax - 9, 222);
          ctx.lineTo(ax, 198 + flk);
          ctx.lineTo(ax + 9, 222);
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.fillRect(ax - 3, 212, 6, 8);
        }
      }
    } else if (stage.id === 'hypercube') {
      // CYBER-GRID 3D: True 3D Receding Perspective Horizon Grid & Rotating 4D Tesseract!
      const horizonY = Math.round(215 - camY * 0.12);
      const vpX = Math.round(RENDER_W * 0.5 - camX * 0.2);

      // 1. 3D Perspective Floor & Ceiling Grids
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.34)';
      ctx.lineWidth = 1;
      // Radial perspective rays from vanishing point
      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(vpX + i * 14, horizonY + 18);
        ctx.lineTo(vpX + i * 95, RENDER_H);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vpX + i * 14, horizonY - 18);
        ctx.lineTo(vpX + i * 95, 0);
        ctx.stroke();
      }
      // Scrolling horizontal Z-depth lines
      const zOffset = (tick * 0.035) % 1;
      for (let d = 1; d <= 10; d++) {
        const norm = (d - zOffset) / 10;
        const yBot = horizonY + 18 + Math.pow(norm, 2.1) * (RENDER_H - horizonY - 18);
        const yTop = horizonY - 18 - Math.pow(norm, 2.1) * (horizonY - 18);
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.12 + norm * 0.38})`;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(yBot));
        ctx.lineTo(RENDER_W, Math.round(yBot));
        ctx.moveTo(0, Math.round(yTop));
        ctx.lineTo(RENDER_W, Math.round(yTop));
        ctx.stroke();
      }

      // 2. Rotating 3D/4D Projected Hypercube (Tesseract) in the center sky!
      const hx = vpX;
      const hy = Math.round(135 - camY * 0.08);
      const ax = tick * 0.016;
      const ay = tick * 0.022;
      const wPulse = 0.48 + Math.sin(tick * 0.03) * 0.14;

      const projectVerts = (scale: number, phaseOffset: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let idx = 0; idx < 8; idx++) {
          const vx = (idx & 1 ? 1 : -1) * scale;
          const vy = (idx & 2 ? 1 : -1) * scale;
          const vz = (idx & 4 ? 1 : -1) * scale;
          // Rotate Y
          const cY = Math.cos(ay + phaseOffset);
          const sY = Math.sin(ay + phaseOffset);
          const rx1 = vx * cY - vz * sY;
          const rz1 = vx * sY + vz * cY;
          // Rotate X
          const cX = Math.cos(ax);
          const sX = Math.sin(ax);
          const ry2 = vy * cX - rz1 * sX;
          const rz2 = vy * sX + rz1 * cX;
          const fov = 160 / (160 + rz2);
          pts.push({ x: hx + rx1 * fov, y: hy + ry2 * fov });
        }
        return pts;
      };

      const outerPts = projectVerts(46, 0);
      const innerPts = projectVerts(46 * wPulse, 0.35);
      const edges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      // 4D hyper-connectors between inner and outer cubes
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.5)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(outerPts[i].x, outerPts[i].y);
        ctx.lineTo(innerPts[i].x, innerPts[i].y);
        ctx.stroke();
      }
      // Outer cube
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(outerPts[a].x, outerPts[a].y);
        ctx.lineTo(outerPts[b].x, outerPts[b].y);
        ctx.stroke();
      }
      // Inner cube
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.4;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(innerPts[a].x, innerPts[a].y);
        ctx.lineTo(innerPts[b].x, innerPts[b].y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (stage.id === 'tesseract') {
      // MÖBIUS CONTINUUM: Rotating Golden Armillary Spheres & Surreal Floating Staircases
      const cx = Math.round(RENDER_W * 0.5 - camX * 0.1);
      const cy = Math.round(165 - camY * 0.08);
      ctx.save();
      ctx.translate(cx, cy);
      for (let r = 0; r < 3; r++) {
        ctx.save();
        ctx.rotate(tick * (0.01 + r * 0.006) * (r % 2 === 0 ? 1 : -1));
        ctx.strokeStyle = r === 1 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(192, 132, 252, 0.38)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 105 - r * 20, 42 + r * 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Impossible Escher floating stair segments in background
      ctx.fillStyle = 'rgba(46, 16, 101, 0.7)';
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
      for (let s = -2; s <= 2; s++) {
        if (s === 0) continue;
        const sx = Math.round(RENDER_W * 0.5 + s * 145 - camX * 0.22);
        const sy = Math.round(190 + Math.sin(tick * 0.025 + s) * 14);
        ctx.beginPath();
        for (let step = 0; step < 5; step++) {
          ctx.rect(sx + step * 8 * Math.sign(s), sy - step * 7, 10, 18);
        }
        ctx.fill();
        ctx.stroke();
      }
    } else if (stage.id === 'train') {
      // PHANTOM MAGLEV EXPRESS: High-Speed Parallax Metropolis Skyscrapers & Wind Gusts
      const speedScroll = tick * 9;
      // Distant skyline
      ctx.fillStyle = '#091122';
      for (let i = 0; i < 14; i++) {
        const bw = 48 + (i % 3) * 18;
        const bh = 120 + ((i * 53) % 130);
        const bx = RENDER_W - (((i * 75 + speedScroll * 0.35) % (RENDER_W + 120)) - 40);
        ctx.fillRect(Math.round(bx), RENDER_H - 130 - bh, bw, bh);
        // Neon building window strips
        ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.28)';
        ctx.fillRect(Math.round(bx + 8), RENDER_H - 120 - bh, 4, bh - 20);
        ctx.fillRect(Math.round(bx + bw - 14), RENDER_H - 120 - bh, 4, bh - 20);
        ctx.fillStyle = '#091122';
      }

      // High-speed overhead steel catenary gantries whipping past
      for (let g = 0; g < 3; g++) {
        const gx = RENDER_W - (((g * 340 + speedScroll * 1.6) % (RENDER_W + 240)) - 80);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(Math.round(gx), 45, 10, RENDER_H - 140);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(Math.round(gx + 2), 85, 6, 18);
      }

      // Slipstream Wind Gust overlay streaks when wind hazard is active!
      const cycle = tick % 360;
      if (cycle >= 220 && cycle <= 335) {
        const isGusting = cycle >= 240;
        ctx.strokeStyle = isGusting
          ? 'rgba(250, 204, 21, 0.55)'
          : 'rgba(250, 204, 21, 0.22)';
        ctx.lineWidth = isGusting ? 2 : 1;
        for (let w = 0; w < 18; w++) {
          const wx = RENDER_W - (((w * 97 + tick * 26) % (RENDER_W + 160)) - 80);
          const wy = (w * 37 + 30) % (RENDER_H - 80);
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx - (isGusting ? 95 : 42), wy);
          ctx.stroke();
        }
      }
    }

    const mist = ctx.createLinearGradient(0, RENDER_H - 110, 0, RENDER_H);
    mist.addColorStop(0, 'rgba(9, 13, 22, 0)');
    mist.addColorStop(1, 'rgba(9, 13, 22, 0.76)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, RENDER_H - 110, RENDER_W, 110);
  }

  private drawMountainLayer(
    ctx: CanvasRenderingContext2D,
    offset: number,
    color: string,
    baseY: number,
    amp: number,
    freq: number
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, RENDER_H);
    for (let x = 0; x <= RENDER_W; x += 8) {
      const wx = x + offset;
      const h = Math.sin(wx * freq) * amp + Math.cos(wx * freq * 2.1) * (amp * 0.45);
      ctx.lineTo(x, Math.round(baseY - Math.abs(h)));
    }
    ctx.lineTo(RENDER_W, RENDER_H);
    ctx.closePath();
    ctx.fill();
  }

  private drawPlatforms(
    ctx: CanvasRenderingContext2D,
    stage: StageSpec,
    isImpact: boolean,
    tick: number
  ): void {
    // 1. Spatial Wrap-Around Portals on Möbius Continuum (`tesseract`)
    if (stage.wrapHorizontal && !isImpact) {
      const edgeX = stage.wrapEdgeX ?? 300;
      for (const side of [-1, 1]) {
        const wx = side * edgeX;
        ctx.save();
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -tick * 0.6 * side;
        ctx.beginPath();
        ctx.moveTo(wx, -160);
        ctx.lineTo(wx, 155);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Render each static or moving platform with bespoke architectural styling
    for (const rawPlat of stage.platforms) {
      const p = resolvePlatformAtTick(rawPlat, tick);
      const left = Math.round(p.left);
      const top = Math.round(p.y);
      const w = Math.round(p.width);
      const h = Math.round(p.thickness);

      if (p.isMain) {
        if (p.style === 'mirror') {
          // Sleek Horizon Zero glass-water slab
          ctx.fillStyle = isImpact ? '#1e293b' : '#091326';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left + 6, top, w - 12, 1);
          // Subtle reflection pillars underneath
          ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
          ctx.fillRect(left + 16, top + h, w - 32, 65);
        } else if (p.style === 'train') {
          // High-Speed Maglev Bullet Train Car Roof & Body
          ctx.fillStyle = isImpact ? '#1e293b' : '#0f172a';
          ctx.fillRect(left, top, w, 54);
          // Aerodynamic sloped nose/tail bevels
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(left + 4, top + 6, w - 8, 38);
          // Glowing passenger / reactor windows
          ctx.fillStyle = '#38bdf8';
          for (let wx = left + 22; wx < left + w - 28; wx += 34) {
            ctx.fillRect(wx, top + 16, 20, 9);
          }
          // Gold hazard stripe & white roof rail
          ctx.fillStyle = '#facc15';
          ctx.fillRect(left, top, w, 3);
          ctx.fillRect(left, top + 34, w, 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(left, top, w, 1);
          // Maglev undercarriage bogies & high-speed rail sparks
          ctx.fillStyle = '#020617';
          ctx.fillRect(left + 12, top + 54, w - 24, 14);
          if (!isImpact && tick % 2 === 0) {
            ctx.fillStyle = '#fde047';
            const sx = left + 20 + ((tick * 19) % Math.max(20, w - 40));
            ctx.fillRect(sx, top + 64, 8, 2);
          }
        } else if (p.style === 'holo') {
          // 3D Cyber-Grid Neon Wireframe Deck
          ctx.fillStyle = 'rgba(8, 15, 34, 0.92)';
          ctx.fillRect(left, top, w, h);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(left, top, w, h);
          // Internal diagonal wireframe truss
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let tx = left; tx < left + w - 20; tx += 25) {
            ctx.moveTo(tx, top);
            ctx.lineTo(tx + 25, top + h);
            ctx.moveTo(tx + 25, top);
            ctx.lineTo(tx, top + h);
          }
          ctx.stroke();
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(left, top, w, 2);
        } else {
          // Classic Stone / Obsidian / Gold / Wood Main Stage Foundation
          ctx.fillStyle = isImpact ? '#1e293b' : '#0f172a';
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = isImpact ? '#475569' : '#1e293b';
          ctx.fillRect(left + 4, top + 6, w - 8, h - 10);
          ctx.fillStyle = '#070a12';
          ctx.fillRect(left + 22, top + h, w - 44, 210);
          ctx.fillStyle = '#334155';
          for (let bx = left + 18; bx < left + w - 24; bx += 42) {
            ctx.fillRect(bx, top + 8, 18, 2);
          }
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(left, top, w, 3);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(left, top, w, 1);
        }
      } else {
        // Elevated / Moving Semi-Solid Platforms
        ctx.fillStyle = p.style === 'holo' ? 'rgba(6, 182, 212, 0.25)' : '#1e293b';
        ctx.fillRect(left, top, w, h);
        ctx.fillStyle = stage.accentColor;
        ctx.fillRect(left, top, w, 2.5);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(left + 2, top, w - 4, 1);

        // Thruster / pulley glow under moving platforms
        if (rawPlat.motion && !isImpact) {
          ctx.fillStyle = stage.accentColor;
          ctx.fillRect(Math.round(p.x - 10), top + h, 20, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(p.x - 4), top + h + 1, 8, 2);
        }
      }
    }

    // 3. Coupled Train Energy Bridge between Left & Right Maglev Cars
    if (stage.id === 'train' && !isImpact) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-20, 134);
      ctx.lineTo(20, 134);
      ctx.stroke();
    }

    // 4. Stage Updraft Jump Pads (Twin Abyss Rift & Möbius Continuum)
    if (stage.jumpPads && !isImpact) {
      for (const pad of stage.jumpPads) {
        const px = Math.round(pad.x);
        const py = Math.round(pad.y);
        const hw = Math.round(pad.width * 0.5);
        // Glowing pad base
        ctx.fillStyle = pad.color;
        ctx.fillRect(px - hw, py - 3, pad.width, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - hw + 4, py - 2, pad.width - 8, 2);
        // Rising animated updraft wind chevrons
        for (let c = 0; c < 3; c++) {
          const lift = ((tick * 1.4 + c * 11) % 32);
          const alpha = 1 - lift / 32;
          ctx.strokeStyle = pad.color;
          ctx.globalAlpha = alpha * 0.85;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(px - 9, py - 6 - lift);
          ctx.lineTo(px, py - 12 - lift);
          ctx.lineTo(px + 9, py - 6 - lift);
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
    weaponType: WeaponType
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
      const breath = Math.sin(t) * 1.2;
      base.chest.y += breath;
      base.head.y += breath * 1.1;
      base.handF.y += Math.cos(t) * 1.1;
      base.handB.y -= Math.cos(t) * 0.9;
      return base;
    }

    if (action === 'walk' || action === 'dash') {
      const isDash = action === 'dash';
      const spd = isDash ? 0.56 : 0.28;
      const cycle = frame * spd;
      const stride = Math.sin(cycle);
      const liftF = Math.max(0, Math.cos(cycle)) * (isDash ? 7 : 4.5);
      const liftB = Math.max(0, -Math.cos(cycle)) * (isDash ? 7 : 4.5);
      const lean = isDash ? 9.5 : 4.0;
      const bob = Math.abs(stride) * (isDash ? 2.2 : 1.3);

      return {
        ...base,
        hip: { x: isDash ? 2 : 0, y: -1 + bob },
        spine: { x: lean * 0.5, y: -8 + bob },
        chest: { x: lean, y: -13.5 + bob },
        head: { x: lean + 3.5, y: -22.5 + bob },
        shoulderF: { x: lean + 1, y: -12.5 + bob },
        shoulderB: { x: lean - 2, y: -12.5 + bob },
        kneeF: { x: stride * (isDash ? 10 : 7) + 3, y: 8 - liftF * 0.5 },
        footF: { x: stride * (isDash ? 15 : 11), y: 18 - liftF },
        kneeB: { x: -stride * (isDash ? 10 : 7), y: 8 - liftB * 0.5 },
        footB: { x: -stride * (isDash ? 15 : 11), y: 18 - liftB },
        elbowF: { x: lean - stride * 6, y: -9 + bob },
        handF: {
          x: isDash && weaponType === 'dagger' ? -8 : lean - stride * 10 + 3,
          y: isDash && weaponType === 'dagger' ? -6 : -6 + bob,
        },
        elbowB: { x: lean + stride * 6 - 3, y: -9 + bob },
        handB: { x: lean + stride * 9 - 5, y: -5 + bob },
        weaponAngle: isDash ? 2.65 : -0.9,
        sheathed: weaponType === 'katana' && !isDash ? true : false,
      };
    }

    if (action === 'parry') {
      // Crisp defensive deflection guard stance (`P` while standing still)
      const brace = easeOutExpo(Math.min(1, frame / 4));
      return {
        ...base,
        hip: { x: -1.5 * brace, y: 0 },
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
      };
    }

    if (action === 'jump_squat') {
      return {
        ...base,
        hip: { x: -1, y: 4 },
        spine: { x: 1.5, y: -3 },
        chest: { x: 3.5, y: -9.5 },
        head: { x: 5, y: -18.5 },
        kneeF: { x: 9, y: 11 },
        kneeB: { x: -7, y: 11 },
        handF: { x: -5, y: 2 },
        handB: { x: -9, y: 0 },
      };
    }

    if (action === 'air' || action === 'airdodge') {
      const rising = vy < 0;
      const tilt = Math.sign(vx) * facing * 2.8;
      return {
        ...base,
        hip: { x: 0, y: -2 },
        spine: { x: tilt * 0.5, y: -9 },
        chest: { x: tilt, y: -15.5 },
        head: { x: tilt + 1.5, y: -25 },
        kneeF: { x: 7.5, y: rising ? 2 : 6.5 },
        footF: { x: 4, y: rising ? 10 : 15.5 },
        kneeB: { x: -6, y: rising ? 5 : 8.5 },
        footB: { x: -9.5, y: rising ? 12.5 : 16.5 },
        elbowF: { x: 8, y: rising ? -15 : -12 },
        handF: { x: 12, y: rising ? -19 : -14 },
        elbowB: { x: -8, y: rising ? -14 : -11 },
        handB: { x: -12, y: rising ? -16 : -10 },
        weaponAngle: rising ? -1.1 : -0.45,
        sheathed: false,
      };
    }

    if (action === 'hitstun') {
      const recoil = Math.sin(frame * 0.8) * 1.5;
      return {
        ...base,
        hip: { x: -2, y: -1 },
        spine: { x: -4.5, y: -7.5 },
        chest: { x: -6.5 + recoil, y: -13.5 },
        head: { x: -9.5 + recoil, y: -22 },
        elbowF: { x: 5, y: -16 },
        handF: { x: 10, y: -21 },
        elbowB: { x: -10, y: -12 },
        handB: { x: -15, y: -16 },
        kneeF: { x: 7, y: 6 },
        footF: { x: 11, y: 12 },
        kneeB: { x: -6, y: 9 },
        footB: { x: -10, y: 16 },
        weaponAngle: -2.2,
      };
    }

    if (action === 'kuro_suspend') {
      // Mid-air zero-gravity coiled assassin pose
      const hover = Math.sin(frame * 0.35) * 1.5;
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
      const tremble = Math.sin(frame * 1.6) * 1.2;
      return {
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
      };
    }

    if (action === 'taunt') {
      // Signature character taunt flourish pose!
      const wave = Math.sin(frame * 0.35);
      const bob = Math.cos(frame * 0.35) * 1.5;
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
      // 3-Phase Ultimate Pose: Cutscene Awakening (0..44) -> Telegraph Channel (45..82) -> Cataclysm Strike (83..135)
      if (frame <= 44) {
        const hover = Math.sin(frame * 0.3) * 2;
        return {
          ...base,
          hip: { x: -1, y: -3 + hover },
          spine: { x: 1, y: -11 + hover },
          chest: { x: 3, y: -18 + hover },
          head: { x: 4, y: -28 + hover },
          elbowF: { x: 9, y: -23 + hover },
          handF: { x: 14, y: -33 + hover },
          elbowB: { x: -8, y: -19 + hover },
          handB: { x: -13, y: -27 + hover },
          kneeF: { x: 8, y: 4 + hover },
          footF: { x: 5, y: 13 + hover },
          kneeB: { x: -6, y: 7 + hover },
          footB: { x: -9, y: 16 + hover },
          weaponAngle: weaponType === 'katana' ? 2.75 : -Math.PI * 0.55,
          weaponReach: base.weaponReach + 5,
          sheathed: weaponType === 'katana',
        };
      } else if (frame <= 82) {
        const tremble = Math.sin(frame * 1.8) * 1.4;
        return {
          ...base,
          hip: { x: -3 + tremble * 0.5, y: 1 },
          spine: { x: -4 + tremble, y: -7 },
          chest: { x: -5 + tremble, y: -14 },
          head: { x: -2 + tremble, y: -24 },
          elbowF: { x: -7, y: -16 },
          handF: { x: -13 + tremble, y: -22 },
          elbowB: { x: -11, y: -13 },
          handB: { x: -16 + tremble, y: -17 },
          kneeF: { x: 9, y: 9 },
          footF: { x: 13, y: 18 },
          kneeB: { x: -9, y: 9 },
          footB: { x: -14, y: 18 },
          weaponAngle: weaponType === 'katana' ? 2.8 : -2.5,
          weaponReach: base.weaponReach + 6,
          sheathed: weaponType === 'katana',
        };
      } else {
        // Cataclysm Strike Pose!
        return {
          ...base,
          hip: { x: 6, y: 0 },
          spine: { x: 10, y: -7 },
          chest: { x: 14, y: -13 },
          head: { x: 16, y: -22 },
          elbowF: { x: 22, y: -12 },
          handF: { x: 32, y: -9 },
          elbowB: { x: -5, y: -11 },
          handB: { x: -13, y: -8 },
          kneeF: { x: 14, y: 8 },
          footF: { x: 20, y: 18 },
          kneeB: { x: -9, y: 10 },
          footB: { x: -16, y: 18 },
          weaponAngle: 0.08,
          weaponReach: base.weaponReach + 11,
          sheathed: false,
          smearAlpha: frame <= 98 ? 0.9 : 0,
          smearSpan: 2.2,
        };
      }
    }

    // 2. Detailed 3-Phase Attack Keyframe System (Windup -> Active Strike -> Follow-Through/Recovery)
    if (action === 'attack' && moveKey) {
      const startup = move?.startup ?? 5;
      const active = move?.active ?? 5;
      const recovery = move?.recovery ?? 10;

      const inWindup = frame < startup;
      const inActive = frame >= startup && frame < startup + active;
      const windupT = easeInOutQuad(frame / Math.max(1, startup));
      const activeT = easeOutExpo((frame - startup) / Math.max(1, active));
      const recovT = easeInOutQuad((frame - startup - active) / Math.max(1, recovery));

      const windupPose = this.getMoveWindupPose(base, moveKey, weaponType, grounded);
      const strikePose = this.getMoveStrikePose(base, moveKey, weaponType, grounded);
      const followPose = this.getMoveFollowPose(strikePose, moveKey, grounded);

      if (inWindup) {
        return blendPose(base, windupPose, windupT);
      } else if (inActive) {
        const p = blendPose(windupPose, strikePose, activeT);
        p.smearAlpha = 0.85 * (1 - activeT * 0.4);
        p.smearSpan = strikePose.smearSpan ?? 1.1;
        return p;
      } else {
        const holdFollow = clamp01(recovT * 1.8);
        if (recovT < 0.45) {
          return blendPose(strikePose, followPose, holdFollow);
        }
        return blendPose(followPose, base, (recovT - 0.45) / 0.55);
      }
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
        handF: { x: strike.handF.x - 4, y: strike.handF.y + 3 },
        weaponAngle: strike.weaponAngle - 0.35,
        smearAlpha: 0,
      };
    }
    return {
      ...strike,
      chest: { x: strike.chest.x + 1.5, y: strike.chest.y + (grounded ? 1 : 0) },
      handF: { x: strike.handF.x - 2, y: strike.handF.y + 3 },
      weaponAngle: strike.weaponAngle + 0.38,
      smearAlpha: 0,
    };
  }

  private drawCharacterHeadAndHair(
    ctx: CanvasRenderingContext2D,
    head: Vec2,
    bodyColor: string,
    outlineColor: string,
    accentColor: string,
    secondaryColor: string,
    weaponType: WeaponType,
    hasEyeTrail: boolean
  ): void {
    const hx = Math.round(head.x);
    const hy = Math.round(head.y);

    // 1. Back Hair / Crown / Hood Elements (behind head sphere)
    if (weaponType === 'dagger') {
      // KURO: Swept-back spiky shinobi hair & shadow cowl
      ctx.fillStyle = outlineColor;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 6);
      ctx.lineTo(hx - 14, hy - 9);
      ctx.lineTo(hx - 9, hy - 3);
      ctx.lineTo(hx - 15, hy - 2);
      ctx.lineTo(hx - 7, hy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'gauntlet') {
      // VELO: High-velocity lightning-bolt hair spikes streaming backward
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 6);
      ctx.lineTo(hx - 13, hy - 11);
      ctx.lineTo(hx - 8, hy - 5);
      ctx.lineTo(hx - 15, hy - 5);
      ctx.lineTo(hx - 6, hy);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'katana') {
      // KENJI: Samurai topknot ponytail (chonmage) & fluttering crimson headband tails
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 6);
      ctx.lineTo(hx - 12, hy - 10);
      ctx.lineTo(hx - 14, hy - 5);
      ctx.lineTo(hx - 5, hy - 2);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'spear') {
      // RAIJIN: Wild crackling storm-god spiky mane
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 6);
      ctx.lineTo(hx - 6, hy - 14);
      ctx.lineTo(hx - 4, hy - 8);
      ctx.lineTo(hx - 14, hy - 11);
      ctx.lineTo(hx - 8, hy - 4);
      ctx.lineTo(hx - 15, hy - 2);
      ctx.lineTo(hx - 5, hy + 2);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'chains') {
      // SOL: Blazing multi-layered Phoenix Flame Mane
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(hx + 3, hy - 5);
      ctx.lineTo(hx, hy - 15);
      ctx.lineTo(hx - 3, hy - 8);
      ctx.lineTo(hx - 11, hy - 14);
      ctx.lineTo(hx - 7, hy - 5);
      ctx.lineTo(hx - 14, hy - 6);
      ctx.lineTo(hx - 5, hy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 5);
      ctx.lineTo(hx - 2, hy - 12);
      ctx.lineTo(hx - 8, hy - 9);
      ctx.lineTo(hx - 4, hy - 3);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'orbs') {
      // NYX: Long flowing cosmic empress hair cascading behind shoulders
      ctx.fillStyle = outlineColor;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 5);
      ctx.quadraticCurveTo(hx - 14, hy + 2, hx - 12, hy + 14);
      ctx.lineTo(hx - 4, hy + 9);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Sculpted Head / Jaw Base Silhouette
    const headR = weaponType === 'titan' ? 6.8 : 5.6;
    ctx.fillStyle = outlineColor;
    ctx.beginPath();
    ctx.arc(hx, hy, headR + 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Character-Specific Headgear, Masks, Horns, Hats & Visors
    if (weaponType === 'dagger') {
      // KURO: High Shinobi Face-Mask covering lower face + Slanted Violet Assassin Eye + Forehead Protector
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy);
      ctx.lineTo(hx + 6, hy - 0.5);
      ctx.lineTo(hx + 4.5, hy + 5.5);
      ctx.lineTo(hx - 4, hy + 5);
      ctx.closePath();
      ctx.fill();
      // Forehead shinobi band
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx - 5, hy - 4.5, 10.5, 1.8);
      // Sharp slanted eye & vertical scar
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx + 0.5, hy - 1.5);
      ctx.lineTo(hx + 5.5, hy - 2.8);
      ctx.lineTo(hx + 5, hy - 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3, hy - 2.2, 1.5, 1.5);
    } else if (weaponType === 'gauntlet') {
      // VELO: Wrap-around Speedster Cyber-Visor Goggles + Winged Ear Piece
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx - 4, hy - 3.5, 10.5, 4.2);
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx - 1, hy - 3);
      ctx.lineTo(hx + 6.5, hy - 3.5);
      ctx.lineTo(hx + 5.5, hy);
      ctx.lineTo(hx - 1, hy - 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2.5, hy - 2.8, 2.5, 1.2);
      // Side speed-wing antenna
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(hx - 1, hy - 1);
      ctx.lineTo(hx - 8, hy - 4);
      ctx.lineTo(hx - 5, hy + 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'katana') {
      // KENJI: Iconic Wide Woven Ronin Bamboo Kasa (Conical Samurai Straw Hat) + Blazing Eye underneath!
      // Glowing eye under shadow of the hat
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 1.5, hy - 1.5, 4.2, 2.0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 1.5, 1.5, 1.5);
      // Conical Ronin Hat (Kasa) tilted forward
      ctx.save();
      ctx.translate(hx + 0.5, hy - 4.2);
      ctx.rotate(0.12);
      // Dark under-brim shadow
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.ellipse(0, 1, 13.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Conical hat roof
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-13.5, 0.5);
      ctx.lineTo(0, -6.5);
      ctx.lineTo(13.5, 0.5);
      ctx.closePath();
      ctx.fill();
      // Crimson bamboo rim & gold apex ornament
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, 0.5);
      ctx.lineTo(13, 0.5);
      ctx.stroke();
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-2, -6.5, 4, 2);
      ctx.restore();
    } else if (weaponType === 'titan') {
      // BRAM: Horned Juggernaut Titan Helm + Heavy Jawplate + Glowing T-Visor
      // Metallic jawplate
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hx - 5, hy, 11, 6);
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx - 4, hy + 1.5, 9.5, 3);
      // Blazing emerald/gold visor slit
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 0.5, hy - 2.5, 5.8, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3, hy - 2.2, 2, 1.5);
      // Twin Curved Titan Bull Horns sweeping upward & forward!
      ctx.strokeStyle = '#05070d';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 4);
      ctx.quadraticCurveTo(hx - 8, hy - 12, hx + 3, hy - 14);
      ctx.stroke();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 4);
      ctx.quadraticCurveTo(hx - 8, hy - 12, hx + 3, hy - 14);
      ctx.stroke();
    } else if (weaponType === 'spear') {
      // RAIJIN: Storm-God Oni Diadem with Tall Central Lightning Horn
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx - 5, hy - 4.2, 10.5, 1.8);
      // Tall jagged golden lightning horn on brow
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 4);
      ctx.lineTo(hx + 8, hy - 13);
      ctx.lineTo(hx + 4.5, hy - 3.5);
      ctx.closePath();
      ctx.fill();
      // Crackling electric eye
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 1.5, hy - 2, 4.2, 2.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 3.2, hy - 2, 1.6, 1.6);
    } else if (weaponType === 'scythe') {
      // CHRONO: Pointed Gothic Reaper Hood + Floating Golden Sundial Crest + Clockwork Monocle Eye
      ctx.fillStyle = '#09151b';
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 10);
      ctx.lineTo(hx + 6.5, hy - 4.5);
      ctx.lineTo(hx + 5, hy + 5);
      ctx.lineTo(hx - 6.5, hy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Floating Golden Crown/Sundial Crest above hood
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 13);
      ctx.lineTo(hx + 3, hy - 8.5);
      ctx.lineTo(hx - 3, hy - 8.5);
      ctx.closePath();
      ctx.fill();
      // Glowing Clockwork Monocle Eye
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(hx + 2.8, hy - 1.2, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 2, hy - 2, 2, 2);
    } else if (weaponType === 'chains') {
      // SOL: Fierce Phoenix-Beak Brow Guard + Blazing Solar Eyes
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy - 4);
      ctx.lineTo(hx + 7, hy - 2.5);
      ctx.lineTo(hx + 3, hy - 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2, hy - 2.2, 3.5, 2);
    } else if (weaponType === 'orbs') {
      // NYX: Twin Crescent-Moon Empress Horns + Floating Diamond Third-Eye Crown
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 5);
      ctx.quadraticCurveTo(hx - 6, hy - 12, hx - 1, hy - 14);
      ctx.moveTo(hx + 2, hy - 5);
      ctx.quadraticCurveTo(hx + 6, hy - 12, hx + 2, hy - 14);
      ctx.stroke();
      // Glowing third-eye star diamond on forehead
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + 2, hy - 5.5, 2.2, 2.2);
      // Luminous astral eye
      ctx.fillStyle = accentColor;
      ctx.fillRect(hx + 1.5, hy - 2, 4, 2.2);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 3, hy - 2, 1.8, 1.8);
    } else if (weaponType === 'claws') {
      // JIN: Cyber-Kitsune / Oni Mask with Pointed Ears & Triple-Slit Teal Visor
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 6);
      ctx.lineTo(hx - 6, hy - 12);
      ctx.lineTo(hx + 1, hy - 6);
      ctx.lineTo(hx + 4, hy - 12);
      ctx.lineTo(hx + 5.5, hy - 4);
      ctx.closePath();
      ctx.fill();
      // High collar covering jaw
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx - 5, hy + 0.5, 10.5, 5);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(hx - 5, hy + 0.5, 10.5, 5);
      // Triple-slit glowing cyber visor
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(hx + 1, hy - 3, 4.8, 1.3);
      ctx.fillRect(hx + 1.8, hy - 1, 4.0, 1.3);
    }

    if (hasEyeTrail) {
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 1.5);
      ctx.lineTo(hx - 15, hy - 3.5);
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
    outlineW: number
  ): void {
    const strokeTaperedSegment = (
      a: Vec2,
      b: Vec2,
      wStart: number,
      wEnd: number,
      fillCol: string,
      outCol: string
    ) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Outer outline polygon
      const ow1 = wStart * 0.5 + 1.3;
      const ow2 = wEnd * 0.5 + 1.3;
      ctx.fillStyle = outCol;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * ow1, a.y + ny * ow1);
      ctx.lineTo(b.x + nx * ow2, b.y + ny * ow2);
      ctx.lineTo(b.x - nx * ow2, b.y - ny * ow2);
      ctx.lineTo(a.x - nx * ow1, a.y - ny * ow1);
      ctx.closePath();
      ctx.fill();

      // Inner fill polygon
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
    };

    // 1. Back Coat-Tails / Capes / Skirts (behind legs & torso)
    if (weaponType === 'scythe') {
      // CHRONO: Sweeping Gothic Reaper Trenchcoat tails behind legs
      ctx.fillStyle = '#071318';
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pose.spine.x - 3, pose.spine.y);
      ctx.lineTo(pose.hip.x - 15, pose.hip.y + 14);
      ctx.lineTo(pose.hip.x - 4, pose.hip.y + 11);
      ctx.lineTo(pose.hip.x + 2, pose.hip.y + 14);
      ctx.lineTo(pose.hip.x + 4, pose.hip.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (weaponType === 'dagger') {
      // KURO: Split Shinobi Shadow Coat-Tails
      ctx.fillStyle = '#140c24';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x - 2, pose.hip.y - 1);
      ctx.lineTo(pose.hip.x - 13, pose.hip.y + 9);
      ctx.lineTo(pose.hip.x - 5, pose.hip.y + 11);
      ctx.lineTo(pose.hip.x + 1, pose.hip.y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (weaponType === 'orbs') {
      // NYX: Flowing High-Slit Astral Empress Gown Panels
      ctx.fillStyle = '#1f0924';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x - 3, pose.hip.y - 2);
      ctx.quadraticCurveTo(pose.hip.x - 14, pose.hip.y + 7, pose.hip.x - 9, pose.hip.y + 15);
      ctx.lineTo(pose.hip.x + 2, pose.hip.y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (weaponType === 'claws') {
      // JIN: Cyber-Puppeteer Split Duster Coat
      ctx.fillStyle = '#0e1329';
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pose.spine.x - 2, pose.spine.y);
      ctx.lineTo(pose.hip.x - 12, pose.hip.y + 12);
      ctx.lineTo(pose.hip.x - 2, pose.hip.y + 10);
      ctx.lineTo(pose.hip.x + 2, pose.hip.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 2. Back Arm & Back Leg (with character-specific Hakama / Greaves / Thrusters)
    strokeTaperedSegment(pose.shoulderB, pose.elbowB, limbW * 1.05, limbW * 0.9, bodyColor, outlineColor);
    strokeTaperedSegment(pose.elbowB, pose.handB, limbW * 1.15, limbW * 0.85, bodyColor, outlineColor);

    if (weaponType === 'katana') {
      // KENJI: Wide Pleated Samurai Hakama Trousers on Back Leg
      strokeTaperedSegment(pose.hip, pose.kneeB, limbW * 2.1, limbW * 1.8, '#0f172a', outlineColor);
      strokeTaperedSegment(pose.kneeB, pose.footB, limbW * 1.5, limbW * 0.85, bodyColor, outlineColor);
    } else {
      strokeTaperedSegment(pose.hip, pose.kneeB, limbW * 1.25, limbW * 1.0, bodyColor, outlineColor);
      strokeTaperedSegment(pose.kneeB, pose.footB, limbW * 1.15, limbW * 0.85, bodyColor, outlineColor);
    }

    // 3. Sculpted Anatomical Torso / Armor Chestplate (replaces thin spine stick!)
    const chestW = weaponType === 'titan' ? 6.4 : weaponType === 'spear' ? 4.8 : 4.0;
    const waistW = weaponType === 'titan' ? 4.6 : 2.6;
    strokeTaperedSegment(pose.chest, pose.spine, chestW * 2, waistW * 1.9, bodyColor, outlineColor);
    strokeTaperedSegment(pose.spine, pose.hip, waistW * 1.8, waistW * 1.9, bodyColor, outlineColor);

    // Character-Specific Chest Emblem / Sash / Belt Details
    if (weaponType === 'dagger') {
      // Kuro X-Harness Straps across chest
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pose.chest.x - 3, pose.chest.y - 2);
      ctx.lineTo(pose.spine.x + 3, pose.spine.y + 2);
      ctx.moveTo(pose.chest.x + 3, pose.chest.y - 2);
      ctx.lineTo(pose.spine.x - 3, pose.spine.y + 2);
      ctx.stroke();
    } else if (weaponType === 'gauntlet') {
      // Velo Glowing Velocity Reactor Core on chest
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(pose.chest.x + 1, pose.chest.y + 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (weaponType === 'titan') {
      // Bram Tectonic Championship Belt & Chest Plate
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(pose.hip.x - 5, pose.hip.y - 2, 10, 3.2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pose.chest.x - 5, pose.chest.y + 1);
      ctx.lineTo(pose.chest.x + 5, pose.chest.y + 1);
      ctx.stroke();
    } else if (weaponType === 'scythe') {
      // Chrono Golden Clock-Heart on chest
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pose.chest.x + 1, pose.chest.y + 1, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (weaponType === 'chains') {
      // Sol Blazing Solar Sash & Chest Brand
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(pose.hip.x - 4, pose.hip.y - 1.5, 8, 2.5);
    }

    // 4. Front Leg (with Hakama / Aero-Jet Fins / Armored Greaves)
    if (weaponType === 'katana') {
      // KENJI: Wide Pleated Samurai Hakama Trousers on Front Leg + White Tabi Socks
      strokeTaperedSegment(pose.hip, pose.kneeF, limbW * 2.2, limbW * 1.9, '#111827', outlineColor);
      strokeTaperedSegment(pose.kneeF, pose.footF, limbW * 1.5, limbW * 0.9, bodyColor, outlineColor);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pose.footF.x - 2, pose.footF.y - 2, 4.5, 2.5);
    } else {
      strokeTaperedSegment(pose.hip, pose.kneeF, limbW * 1.3, limbW * 1.05, bodyColor, outlineColor);
      strokeTaperedSegment(pose.kneeF, pose.footF, limbW * 1.2, limbW * 0.9, bodyColor, outlineColor);
    }

    if (weaponType === 'gauntlet') {
      // VELO: Winged Aero-Jet Boots on both ankles
      for (const ft of [pose.footF, pose.footB]) {
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(ft.x + 3, ft.y);
        ctx.lineTo(ft.x - 6, ft.y - 4);
        ctx.lineTo(ft.x - 4, ft.y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(ft.x - 5, ft.y - 2, 3, 2);
      }
    } else if (weaponType === 'titan') {
      // BRAM: Heavy Knee-Spike Greaves
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(pose.kneeF.x - 1, pose.kneeF.y - 3, 4, 4);
    }

    // 5. Front Arm & Shoulder Pauldrons
    strokeTaperedSegment(pose.shoulderF, pose.elbowF, limbW * 1.1, limbW * 0.95, bodyColor, outlineColor);
    strokeTaperedSegment(pose.elbowF, pose.handF, limbW * 1.25, limbW * 0.9, bodyColor, outlineColor);

    if (weaponType === 'titan') {
      // BRAM: Massive Segmented Colossus Shoulder Pauldrons
      for (const sh of [pose.shoulderF, pose.shoulderB]) {
        ctx.fillStyle = '#05070d';
        ctx.beginPath();
        ctx.arc(sh.x, sh.y - 1, 5.5, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y - 1, 4.2, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(sh.x - 1.5, sh.y - 4, 3, 2);
      }
    } else if (weaponType === 'spear' || weaponType === 'scythe') {
      // RAIJIN / CHRONO: Ornate Golden Shoulder Epaulettes / Sode Armor
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(pose.shoulderF.x - 4, pose.shoulderF.y - 3);
      ctx.lineTo(pose.shoulderF.x + 5, pose.shoulderF.y - 1);
      ctx.lineTo(pose.shoulderF.x + 3, pose.shoulderF.y + 3);
      ctx.lineTo(pose.shoulderF.x - 3, pose.shoulderF.y + 1);
      ctx.closePath();
      ctx.fill();
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

    // 1. Frame-Accurate Motion Smear Fan on Active Swing Frames
    if (pose.smearAlpha && pose.smearAlpha > 0.05 && pose.smearSpan) {
      ctx.save();
      ctx.globalAlpha = alpha * pose.smearAlpha * 0.45;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.arc(
        wx,
        wy,
        reach + 10,
        pose.weaponAngle - pose.smearSpan,
        pose.weaponAngle + 0.08
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
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
    hasEyeTrail = false
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(facing * squashX, squashY);

    const limbW = weaponType === 'titan' ? 4.5 : 3.2;
    const outlineW = limbW + 2.4;

    // 1. Sculpted Anatomical Body, Garments, Coats, Hakama, Pauldrons & Greaves
    this.drawCharacterBodyAndGarments(
      ctx,
      pose,
      bodyColor,
      outlineColor,
      accentColor,
      secondaryColor,
      weaponType,
      limbW,
      outlineW
    );

    // 2. Character-Distinct Head, Hair, Helmet, Hat, Horns & Mask
    this.drawCharacterHeadAndHair(
      ctx,
      pose.head,
      bodyColor,
      outlineColor,
      accentColor,
      secondaryColor,
      weaponType,
      hasEyeTrail
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

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    isImpact: boolean,
    impactInverted: boolean,
    tick: number
  ): void {
    if (f.action === 'ko_respawn') return;

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
          lx += (Math.random() - 0.5) * 14;
          ly -= 6 + Math.random() * 6;
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

    // 2. Flowing Verlet Scarf
    if (!isImpact && f.scarf.length > 1) {
      ctx.save();
      ctx.strokeStyle = f.spec.scarfColor;
      ctx.lineCap = 'round';
      for (let i = 0; i < f.scarf.length - 1; i++) {
        ctx.lineWidth = Math.max(1.2, 3.8 - i * 0.5);
        ctx.beginPath();
        ctx.moveTo(Math.round(f.scarf[i].x), Math.round(f.scarf[i].y));
        ctx.lineTo(Math.round(f.scarf[i + 1].x), Math.round(f.scarf[i + 1].y));
        ctx.stroke();
      }
      ctx.restore();
    }

    const pose = this.computePose(
      f.action,
      f.currentMove,
      f.currentMove?.key ?? null,
      f.actionFrame,
      f.facing,
      f.vx,
      f.vy,
      f.grounded,
      f.spec.weaponType
    );

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
      f.overdriveTimer > 0 ||
      f.action === 'kuro_suspend' ||
      f.action === 'kenji_haki' ||
      (f.action === 'attack' && f.currentMove?.category === 'special');

    this.drawStickSkeleton(
      ctx,
      f.x + (f.vibrateX || 0),
      f.y,
      f.facing,
      pose,
      bodyColor,
      outlineColor,
      accent,
      secondary,
      f.spec.weaponType,
      f.squashX,
      f.squashY,
      true,
      alpha,
      hasEyeTrail
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

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, tick: number): void {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const dir = p.vx >= 0 ? 1 : -1;
    ctx.scale(dir, 1);

    // Crescent anime energy wave
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

    // Trailing energy tail
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-p.radius, -3 + Math.sin(tick * 0.4) * 2);
    ctx.lineTo(-p.radius - 14, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Tapered Crescent Anime Slash Arc with outer glow & white-hot core
  private drawSlashArc(ctx: CanvasRenderingContext2D, arc: SlashArc): void {
    const progress = clamp01(1 - arc.life / arc.maxLife);
    const alpha = Math.max(0, 1 - Math.pow(progress, 1.6));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(arc.x), Math.round(arc.y));
    ctx.scale(arc.facing, 1);

    const steps = 16;
    const span = arc.angleEnd - arc.angleStart;
    const maxThick = arc.thickness * (1 - progress * 0.35);

    const buildCrescent = (thickScale: number, radOffset: number) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const ang = arc.angleStart + span * u;
        const taper = Math.sin(u * Math.PI); // 0 at ends, 1 in middle
        const r = arc.radius + radOffset + taper * maxThick * thickScale;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const ang = arc.angleStart + span * u;
        const taper = Math.sin(u * Math.PI);
        const r = arc.radius + radOffset - taper * maxThick * thickScale * 0.45;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // Outer chromatic blade glow
    ctx.fillStyle = arc.color;
    buildCrescent(1.15, 0);
    ctx.fill();

    // Inner white-hot razor core
    ctx.fillStyle = arc.coreColor;
    buildCrescent(0.5, 1.2);
    ctx.fill();

    ctx.restore();
  }

  private drawShockwave(ctx: CanvasRenderingContext2D, sw: ShockwaveRing): void {
    const t = clamp01(1 - sw.life / sw.maxLife);
    const rad = lerp(4, sw.maxRadius, easeOutExpo(t));
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = Math.max(1, sw.lineWidth * (1 - t * 0.75));
    ctx.beginPath();
    ctx.arc(Math.round(sw.x), Math.round(sw.y), rad, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary inner echo ring
    if (rad > 16) {
      ctx.globalAlpha = Math.max(0, (1 - t) * 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(sw.x), Math.round(sw.y), rad * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, pt: Particle): void {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    const sz = Math.max(1, pt.size);

    if (pt.shape === 'spark') {
      // High-velocity anime directional streak with hot white center
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = Math.max(1.2, sz * 0.75);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
      ctx.lineTo(Math.round(pt.x - pt.vx * 2.4), Math.round(pt.y - pt.vy * 2.4));
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, sz * 0.35);
      ctx.beginPath();
      ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
      ctx.lineTo(Math.round(pt.x - pt.vx * 1.2), Math.round(pt.y - pt.vy * 1.2));
      ctx.stroke();
    } else if (pt.shape === 'flare') {
      // 4-pointed anime star impact flare
      ctx.translate(Math.round(pt.x), Math.round(pt.y));
      if (pt.angle) ctx.rotate(pt.angle);
      const rLong = sz * 3.2 * alpha;
      const rShort = sz * 0.75 * alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(0, -rLong);
      ctx.lineTo(rShort, -rShort);
      ctx.lineTo(rLong, 0);
      ctx.lineTo(rShort, rShort);
      ctx.lineTo(0, rLong);
      ctx.lineTo(-rShort, rShort);
      ctx.lineTo(-rLong, 0);
      ctx.lineTo(-rShort, -rShort);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -1.5, 3, 3);
    } else if (pt.shape === 'debris') {
      // Rotating stone/stage rubble chunk
      ctx.translate(Math.round(pt.x), Math.round(pt.y));
      ctx.rotate(pt.angle ?? 0);
      ctx.fillStyle = pt.color;
      ctx.fillRect(-sz * 0.6, -sz * 0.5, sz * 1.2, sz);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-sz * 0.6, -sz * 0.5, sz * 0.8, 1.2);
    } else if (pt.shape === 'wind_cone') {
      // Sonic boom chevron cone for `P` Dash
      ctx.translate(Math.round(pt.x), Math.round(pt.y));
      ctx.rotate(pt.angle ?? 0);
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-10, -13);
      ctx.moveTo(8, 0);
      ctx.lineTo(-10, 13);
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
