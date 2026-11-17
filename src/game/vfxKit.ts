/**
 * vfxKit.ts - production-style 2D combat VFX for canvas (no dependencies).
 *
 * WHY THIS EXISTS: "basic shape" effects (a stroked circle, a fixed crescent,
 * a 1px line) look cheap because they have ONE layer, ONE colour, NO motion
 * logic and NO timing. Every effect here is built from stacked layers:
 *   hot core -> coloured body -> soft glow, additive blending, colour/size
 *   over life, velocity stretch, and a deliberate frame-by-frame timeline.
 *
 * HARD RULE: VFX must NEVER use the simulation RNG (src/game/rng.ts) or touch
 * gameplay state. Use this file's own PRNG so scripts/golden-regression.json stays valid.
 */

/* ------------------------------ canvas factory ------------------------------ */

export type Canvas2D = CanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement;

let canvasFactory: (w: number, h: number) => AnyCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
/** Tests / node-canvas can inject their own canvas creator. */
export function setCanvasFactory(f: (w: number, h: number) => AnyCanvas): void {
  canvasFactory = f;
  glowCache.clear();
}

/* ------------------------------ colour + ramps ------------------------------ */

export type RGB = [number, number, number];

export function hexToRgb(input: string): RGB {
  const str = (input || '').trim();
  if (str.startsWith('rgb')) {
    const m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  let h = str.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [255, 255, 255]; // unknown / named colour: fall back to white
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (c: RGB, a: number): string =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export interface RampStop {
  t: number; // 0 = birth, 1 = death
  c: RGB;
  a: number;
}
export type Ramp = RampStop[];

export function sampleRamp(ramp: Ramp, t: number): { c: RGB; a: number } {
  if (t <= ramp[0].t) return { c: ramp[0].c, a: ramp[0].a };
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i].t) {
      const p = ramp[i - 1];
      const q = ramp[i];
      const u = (t - p.t) / Math.max(1e-6, q.t - p.t);
      return { c: mixRgb(p.c, q.c, u), a: p.a + (q.a - p.a) * u };
    }
  }
  const last = ramp[ramp.length - 1];
  return { c: last.c, a: last.a };
}

/** Hot-white -> accent -> deep accent -> transparent. The standard "energy" ramp. */
export function energyRamp(accentHex: string): Ramp {
  const acc = hexToRgb(accentHex);
  const deep = mixRgb(acc, [10, 6, 30], 0.55);
  return [
    { t: 0, c: [255, 255, 255], a: 1 },
    { t: 0.18, c: mixRgb([255, 255, 255], acc, 0.35), a: 1 },
    { t: 0.5, c: acc, a: 0.85 },
    { t: 1, c: deep, a: 0 },
  ];
}

/* ------------------------------ prng (visual only) ------------------------------ */

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let visualRng = makeRng(0xc0ffee);
export const vrand = (): number => visualRng();
export const vrange = (a: number, b: number): number => a + (b - a) * visualRng();
export function seedVisualRng(seed: number): void {
  visualRng = makeRng(seed);
}

export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inQuad: (t: number) => t * t,
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/* ------------------------------ cached glow sprite ------------------------------ */
/* shadowBlur is very slow on phones / in-app browsers (Zalo). A cached radial
   sprite drawn with 'lighter' gives the same glow at ~1/20 the cost. */

const glowCache = new Map<string, AnyCanvas>();
export function glowSprite(color: RGB, size = 64): AnyCanvas {
  const key = `${color[0] | 0},${color[1] | 0},${color[2] | 0}:${size}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = canvasFactory(size, size);
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, rgba(mixRgb(color, [255, 255, 255], 0.5), 0.85));
  grad.addColorStop(0.5, rgba(color, 0.28));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}
export function drawGlow(ctx: Canvas2D, x: number, y: number, radius: number, color: RGB, alpha = 1): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

/* ------------------------------ ribbon trail ------------------------------ */
/* THE biggest upgrade over a fixed crescent: the trail follows the REAL
   weapon-tip path, tapers to a point at the tail, is smoothed with a
   Catmull-Rom spline (fast whips have only 3-4 samples), and is drawn in
   3 additive passes (glow / body / white-hot core) with a tail->head gradient. */

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export class Trail {
  private pts: TrailPoint[] = [];
  constructor(public maxPoints = 16, public maxAge = 9) {}

  /** call once per sim tick while the weapon is dangerous (smear active). */
  push(x: number, y: number): void {
    this.pts.push({ x, y, age: 0 });
    if (this.pts.length > this.maxPoints) this.pts.shift();
  }
  /** call once per tick ALWAYS so the tail fades after the swing ends. */
  step(): void {
    for (const p of this.pts) p.age++;
    this.pts = this.pts.filter((p) => p.age <= this.maxAge);
  }
  clear(): void {
    this.pts.length = 0;
  }
  get length(): number {
    return this.pts.length;
  }

  /** Catmull-Rom subdivision so low-sample whips are curved, not polygonal. */
  private smooth(sub = 4): { x: number; y: number; u: number }[] {
    const p = this.pts;
    const n = p.length;
    const out: { x: number; y: number; u: number }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = p[Math.max(0, i - 1)];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[Math.min(n - 1, i + 2)];
      for (let s = 0; s < sub; s++) {
        const t = s / sub;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        out.push({ x, y, u: (i + t) / Math.max(1, n - 1) });
      }
    }
    if (n > 0) out.push({ x: p[n - 1].x, y: p[n - 1].y, u: 1 });
    return out;
  }

  draw(
    ctx: Canvas2D,
    o: { color: string; core?: string; width: number; alpha?: number; additive?: boolean; taperPow?: number }
  ): void {
    if (this.pts.length < 2) return;
    const path = this.smooth();
    const m = path.length;
    if (m < 2) return;
    const col = hexToRgb(o.color);
    const core = hexToRgb(o.core ?? '#ffffff');
    const tp = o.taperPow ?? 0.85;
    const newest = this.pts[this.pts.length - 1];
    const headFade = clamp01(1 - newest.age / (this.maxAge + 1));

    const passes: { w: number; c: RGB; a: number }[] = [
      { w: 1.9, c: col, a: 0.22 }, // soft outer glow
      { w: 1.0, c: col, a: 0.65 }, // coloured body
      { w: 0.36, c: core, a: 1 }, // white-hot core
    ];

    ctx.save();
    if (o.additive !== false) ctx.globalCompositeOperation = 'lighter';
    for (const pass of passes) {
      const L: [number, number][] = [];
      const R: [number, number][] = [];
      for (let i = 0; i < m; i++) {
        const a = path[Math.max(0, i - 1)];
        const b = path[Math.min(m - 1, i + 1)];
        let tx = b.x - a.x;
        let ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        const w = o.width * pass.w * Math.pow(path[i].u, tp) * 0.5;
        L.push([path[i].x - ty * w, path[i].y + tx * w]);
        R.push([path[i].x + ty * w, path[i].y - tx * w]);
      }
      const tail = path[0];
      const head = path[m - 1];
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, rgba(pass.c, 0));
      grad.addColorStop(0.55, rgba(pass.c, pass.a * 0.55 * headFade * (o.alpha ?? 1)));
      grad.addColorStop(1, rgba(pass.c, pass.a * headFade * (o.alpha ?? 1)));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < m; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = m - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ------------------------------ pooled particles ------------------------------ */

export type ParticleKind = 'streak' | 'shard' | 'dot' | 'ember' | 'ink';

export interface EmitSpec {
  x: number;
  y: number;
  count: number;
  angle: number; // radians, direction of travel
  spread: number; // radians, total cone width
  speed: [number, number];
  life: [number, number]; // frames
  size: [number, number];
  drag?: number; // 0.9 = strong, 0.98 = light
  gravity?: number;
  kind: ParticleKind;
  ramp: Ramp;
  additive?: boolean;
  stretch?: number; // streak length per unit speed
}

const MAX_P = 640;

export class ParticlePool {
  private n = 0;
  private x = new Float32Array(MAX_P);
  private y = new Float32Array(MAX_P);
  private vx = new Float32Array(MAX_P);
  private vy = new Float32Array(MAX_P);
  private life = new Float32Array(MAX_P);
  private maxLife = new Float32Array(MAX_P);
  private size = new Float32Array(MAX_P);
  private drag = new Float32Array(MAX_P);
  private grav = new Float32Array(MAX_P);
  private stretch = new Float32Array(MAX_P);
  private kind: ParticleKind[] = new Array(MAX_P);
  private add = new Uint8Array(MAX_P);
  private ramp: Ramp[] = new Array(MAX_P);

  get count(): number {
    return this.n;
  }

  emit(s: EmitSpec): void {
    for (let k = 0; k < s.count && this.n < MAX_P; k++) {
      const i = this.n++;
      const a = s.angle + (vrand() - 0.5) * s.spread;
      const sp = vrange(s.speed[0], s.speed[1]);
      this.x[i] = s.x;
      this.y[i] = s.y;
      this.vx[i] = Math.cos(a) * sp;
      this.vy[i] = Math.sin(a) * sp;
      this.maxLife[i] = this.life[i] = vrange(s.life[0], s.life[1]);
      this.size[i] = vrange(s.size[0], s.size[1]);
      this.drag[i] = s.drag ?? 0.93;
      this.grav[i] = s.gravity ?? 0;
      this.stretch[i] = s.stretch ?? 1.6;
      this.kind[i] = s.kind;
      this.add[i] = s.additive === false ? 0 : 1;
      this.ramp[i] = s.ramp;
    }
  }

  update(dt = 1): void {
    for (let i = 0; i < this.n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.remove(i);
        continue;
      }
      this.vx[i] *= Math.pow(this.drag[i], dt);
      this.vy[i] = this.vy[i] * Math.pow(this.drag[i], dt) + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      i++;
    }
  }

  private remove(i: number): void {
    const l = --this.n;
    if (i === l) return;
    this.x[i] = this.x[l];
    this.y[i] = this.y[l];
    this.vx[i] = this.vx[l];
    this.vy[i] = this.vy[l];
    this.life[i] = this.life[l];
    this.maxLife[i] = this.maxLife[l];
    this.size[i] = this.size[l];
    this.drag[i] = this.drag[l];
    this.grav[i] = this.grav[l];
    this.stretch[i] = this.stretch[l];
    this.kind[i] = this.kind[l];
    this.add[i] = this.add[l];
    this.ramp[i] = this.ramp[l];
  }

  clear(): void {
    this.n = 0;
  }

  draw(ctx: Canvas2D): void {
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      // pass 0 = normal blend (ink, debris), pass 1 = additive (energy)
      ctx.globalCompositeOperation = pass === 1 ? 'lighter' : 'source-over';
      for (let i = 0; i < this.n; i++) {
        if (this.add[i] !== pass) continue;
        const t = 1 - this.life[i] / this.maxLife[i];
        const { c, a } = sampleRamp(this.ramp[i], t);
        if (a <= 0.01) continue;
        const k = this.kind[i];
        const sz = this.size[i] * (k === 'ember' ? 1 - t * 0.6 : 1 - t * 0.35);
        if (k === 'streak' || k === 'shard') {
          const sp = Math.hypot(this.vx[i], this.vy[i]);
          const len = Math.max(sz, sp * this.stretch[i]);
          const ux = this.vx[i] / (sp || 1);
          const uy = this.vy[i] / (sp || 1);
          const hx = this.x[i];
          const hy = this.y[i];
          const tx = hx - ux * len;
          const ty = hy - uy * len;
          const w = sz * (k === 'shard' ? 0.9 : 0.5);
          // tapered kite: sharp tail, fat head, short front point
          ctx.fillStyle = rgba(c, a);
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx - ux * len * 0.25 - uy * w, hy - uy * len * 0.25 + ux * w);
          ctx.lineTo(hx + ux * w * 0.9, hy + uy * w * 0.9);
          ctx.lineTo(hx - ux * len * 0.25 + uy * w, hy - uy * len * 0.25 - ux * w);
          ctx.closePath();
          ctx.fill();
          // hot core
          ctx.fillStyle = rgba([255, 255, 255], a * 0.9 * (1 - t));
          ctx.beginPath();
          ctx.moveTo(tx + ux * len * 0.45, ty + uy * len * 0.45);
          ctx.lineTo(hx - uy * w * 0.3, hy + ux * w * 0.3);
          ctx.lineTo(hx + uy * w * 0.3, hy - ux * w * 0.3);
          ctx.closePath();
          ctx.fill();
        } else if (k === 'ink') {
          ctx.fillStyle = rgba(c, a);
          ctx.beginPath();
          ctx.arc(this.x[i], this.y[i], sz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // dot / ember: glow sprite, not a flat circle
          const flick = k === 'ember' ? 0.7 + 0.3 * Math.sin((i * 7.1 + t * 40) % 6.283) : 1;
          drawGlow(ctx, this.x[i], this.y[i], sz * 2.6, c, a * flick);
        }
      }
    }
    ctx.restore();
  }
}

/* ------------------------------ impact stack ------------------------------ */
/* A hit is NOT one effect. It is a stack on a strict timeline:
     f0   white flash disc (+ optional impact frame invert)
     f0-3 radial speed lines
     f0-8 directional shards + streaks (stretched, ramped)
     f1-14 shockwave annulus (filled, thinning, easeOutExpo)
     f2-20 debris / embers with gravity
   Power 0..1 scales counts, sizes, lifetimes, ring radius. */

interface Ring {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
  thick: number;
  squash: number; // 1 = circle, 0.35 = ground ellipse
  color: RGB;
}
interface Flash {
  x: number;
  y: number;
  age: number;
  life: number;
  r: number;
  color: RGB;
}
interface Burst {
  x: number;
  y: number;
  age: number;
  life: number;
  angles: number[];
  lens: number[];
  r0: number;
  color: RGB;
}

export class Fx {
  readonly pool = new ParticlePool();
  private rings: Ring[] = [];
  private flashes: Flash[] = [];
  private bursts: Burst[] = [];
  /** set by impact(); the renderer should read & reset it to trigger overlays. */
  impactFrameFrames = 0;

  impact(o: { x: number; y: number; dir: number; power: number; color: string; ground?: boolean }): void {
    const p = clamp01(o.power);
    const acc = hexToRgb(o.color);
    const ramp = energyRamp(o.color);
    const n = 6 + Math.round(p * 14);

    this.flashes.push({ x: o.x, y: o.y, age: 0, life: 4 + Math.round(p * 2), r: 14 + p * 26, color: acc });

    const angles: number[] = [];
    const lens: number[] = [];
    const lines = 10 + Math.round(p * 10);
    for (let i = 0; i < lines; i++) {
      angles.push((i / lines) * Math.PI * 2 + vrange(-0.12, 0.12));
      lens.push(vrange(0.55, 1) * (12 + p * 26));
    }
    this.bursts.push({ x: o.x, y: o.y, age: 0, life: 5, angles, lens, r0: 4 + p * 4, color: acc });

    // forward-biased shards (the hit direction), plus a looser backsplash
    this.pool.emit({ x: o.x, y: o.y, count: n, angle: o.dir, spread: 0.9, speed: [5 + p * 5, 11 + p * 9], life: [8, 15 + p * 6], size: [1.6, 3 + p * 2], drag: 0.9, kind: 'shard', ramp, stretch: 1.9 });
    this.pool.emit({ x: o.x, y: o.y, count: Math.ceil(n * 0.6), angle: o.dir + Math.PI, spread: 1.6, speed: [2, 6 + p * 3], life: [6, 12], size: [1.2, 2.2], drag: 0.88, kind: 'streak', ramp, stretch: 1.4 });
    this.pool.emit({ x: o.x, y: o.y, count: 3 + Math.round(p * 6), angle: o.dir - Math.PI / 2, spread: Math.PI * 1.2, speed: [1.5, 4.5], life: [16, 28], size: [1.2, 2.4], drag: 0.95, gravity: 0.12, kind: 'ember', ramp });

    this.rings.push({ x: o.x, y: o.y, age: 0, life: 12 + Math.round(p * 6), maxR: 22 + p * 46, thick: 5 + p * 7, squash: o.ground ? 0.35 : 1, color: acc });
    if (p > 0.6) this.rings.push({ x: o.x, y: o.y, age: -2, life: 14 + Math.round(p * 6), maxR: 14 + p * 30, thick: 3 + p * 4, squash: o.ground ? 0.35 : 1, color: mixRgb(acc, [255, 255, 255], 0.5) });
    if (p > 0.75) this.impactFrameFrames = 2;
  }

  update(): void {
    this.pool.update(1);
    for (const r of this.rings) r.age++;
    for (const f of this.flashes) f.age++;
    for (const b of this.bursts) b.age++;
    this.rings = this.rings.filter((r) => r.age < r.life);
    this.flashes = this.flashes.filter((f) => f.age < f.life);
    this.bursts = this.bursts.filter((b) => b.age < b.life);
    if (this.impactFrameFrames > 0) this.impactFrameFrames--;
  }

  draw(ctx: Canvas2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const f of this.flashes) {
      const t = f.age / f.life;
      const r = f.r * (0.6 + ease.outCubic(t) * 0.8);
      drawGlow(ctx, f.x, f.y, r, f.color, (1 - t) * (f.age <= 1 ? 1 : 0.8));
    }

    for (const b of this.bursts) {
      const t = b.age / b.life;
      const a = 1 - t;
      for (let i = 0; i < b.angles.length; i++) {
        const ang = b.angles[i];
        const r1 = b.r0 + b.lens[i] * ease.outCubic(Math.min(1, t * 1.6));
        const r2 = b.r0 + (r1 - b.r0) * Math.min(1, t * 1.4);
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const w = 1.6 * (1 - t);
        ctx.fillStyle = rgba(i % 3 === 0 ? [255, 255, 255] : b.color, a);
        ctx.beginPath();
        ctx.moveTo(b.x + ux * r2, b.y + uy * r2);
        ctx.lineTo(b.x + ux * (r1 * 0.7) - uy * w, b.y + uy * (r1 * 0.7) + ux * w);
        ctx.lineTo(b.x + ux * r1, b.y + uy * r1);
        ctx.lineTo(b.x + ux * (r1 * 0.7) + uy * w, b.y + uy * (r1 * 0.7) - ux * w);
        ctx.closePath();
        ctx.fill();
      }
    }

    for (const r of this.rings) {
      if (r.age < 0) continue;
      drawShockRing(ctx, r.x, r.y, r.age / r.life, r.maxR, r.thick, r.color, r.squash);
    }
    ctx.restore();

    this.pool.draw(ctx);
  }
}


/* ------------------------------ standalone draw helpers ------------------------------ */
/* Drop-in replacements for the "basic shape" draws. Call them inside any existing
   draw function; they need no state. */

/** Shockwave: FILLED annulus that thins out, white inner rim, easeOutExpo growth. t = 0..1. */
export function drawShockRing(ctx: Canvas2D, x: number, y: number, t: number, maxR: number, thick: number, color: RGB, squash = 1): void {
  const rad = 4 + (maxR - 4) * ease.outExpo(t);
  const th = Math.max(0.6, thick * (1 - t) * (1 - t * 0.4));
  const a = (1 - t) * (1 - t);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.fillStyle = rgba(color, a * 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.arc(0, 0, Math.max(0.1, rad - th), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.fillStyle = rgba([255, 255, 255], a * 0.75);
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.arc(0, 0, Math.max(0.1, rad - th * 0.35), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();
}

/** One tapered, velocity-stretched streak with a white-hot core (replaces a 1px line spark). */
export function drawStreak(ctx: Canvas2D, x: number, y: number, vx: number, vy: number, size: number, color: RGB, alpha: number, stretch = 2): void {
  const sp = Math.hypot(vx, vy);
  if (sp < 0.01 || alpha <= 0.01) return;
  const len = Math.max(size * 2, sp * stretch);
  const ux = vx / sp;
  const uy = vy / sp;
  const w = size * 0.55;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x - ux * len, y - uy * len);
  ctx.lineTo(x - ux * len * 0.25 - uy * w, y - uy * len * 0.25 + ux * w);
  ctx.lineTo(x + ux * w, y + uy * w);
  ctx.lineTo(x - ux * len * 0.25 + uy * w, y - uy * len * 0.25 - ux * w);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba([255, 255, 255], alpha * 0.9);
  ctx.beginPath();
  ctx.moveTo(x - ux * len * 0.55, y - uy * len * 0.55);
  ctx.lineTo(x - uy * w * 0.3, y + ux * w * 0.3);
  ctx.lineTo(x + uy * w * 0.3, y - ux * w * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 4-point anime star with glow halo (replaces a plain octagon flare). life01 = remaining life 0..1. */
export function drawStarFlare(ctx: Canvas2D, x: number, y: number, size: number, angle: number, color: RGB, life01: number): void {
  const rl = size * 3.4 * (0.35 + 0.65 * life01);
  const rs = size * 0.55 * life01;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, rl * 0.9, color, life01);
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = rgba(mixRgb(color, [255, 255, 255], 0.4), life01);
  ctx.beginPath();
  ctx.moveTo(0, -rl);
  ctx.quadraticCurveTo(rs * 0.5, -rs * 0.5, rl, 0);
  ctx.quadraticCurveTo(rs * 0.5, rs * 0.5, 0, rl);
  ctx.quadraticCurveTo(-rs * 0.5, rs * 0.5, -rl, 0);
  ctx.quadraticCurveTo(-rs * 0.5, -rs * 0.5, 0, -rl);
  ctx.fill();
  ctx.fillStyle = rgba([255, 255, 255], life01);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, size * 0.35), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Slash arc that SWEEPS (head races along the arc, tail lags and fades) instead of
 * appearing as a static crescent. progress = 0..1 over the arc's life.
 * Geometry is the same data the game already stores (angleStart/End, radius, facing).
 */
export function drawArcSweep(
  ctx: Canvas2D,
  a: { x: number; y: number; facing: number; angleStart: number; angleEnd: number; radius: number; thickness: number; color: string; coreColor?: string },
  progress: number
): void {
  const head = ease.outCubic(clamp01(progress * 2.2));
  const tail = clamp01((progress - 0.15) / 0.85);
  const tr = new Trail(32, 99);
  const steps = 14;
  const u0 = ease.inQuad(tail) * head;
  const span = a.angleEnd - a.angleStart;
  for (let i = 0; i <= steps; i++) {
    const u = u0 + (head - u0) * (i / steps);
    const ang = a.angleStart + span * u;
    tr.push(Math.cos(ang) * a.radius * a.facing, Math.sin(ang) * a.radius);
  }
  ctx.save();
  ctx.translate(a.x, a.y);
  tr.draw(ctx, { color: a.color, core: a.coreColor ?? '#ffffff', width: a.thickness * 2.6, alpha: 1 - Math.pow(progress, 1.8), taperPow: 0.7 });
  ctx.restore();
}

/* ------------------------------ screen-space ------------------------------ */

/** 1-2 frame "impact frame": inverts the whole canvas (difference blend) then flashes duotone. */
export function drawImpactFrame(ctx: Canvas2D, w: number, h: number, framesLeft: number): void {
  if (framesLeft <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (framesLeft === 1) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255,40,70,0.55)';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Real RGB channel split. Costs 2 scratch canvases; use only for 2-6 frames on heavy hits. */
export class ChromaticSplit {
  private a: AnyCanvas | null = null;
  private b: AnyCanvas | null = null;
  apply(ctx: Canvas2D, src: AnyCanvas, px: number): void {
    const w = src.width;
    const h = src.height;
    if (!this.a || this.a.width !== w || this.a.height !== h) {
      this.a = canvasFactory(w, h);
      this.b = canvasFactory(w, h);
    }
    const A = this.a.getContext('2d')!;
    const B = this.b!.getContext('2d')!;
    const tint = (g: CanvasRenderingContext2D, color: string) => {
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    };
    tint(A, '#ff0000');
    tint(B, '#0000ff');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.a, -px, 0);
    ctx.drawImage(this.b!, px, 0);
    ctx.restore();
  }
}

/** Camera kick: zoom punch + DIRECTIONAL damped shake (along the hit vector, not random). */
export class CameraKick {
  private t = 99;
  private power = 0;
  private dir = 0;
  hit(power: number, dir: number): void {
    this.t = 0;
    this.power = Math.max(this.power * 0.5, clamp01(power));
    this.dir = dir;
  }
  step(): void {
    this.t++;
    if (this.t > 24) this.power = 0;
  }
  get offset(): { ox: number; oy: number; zoom: number } {
    if (this.power <= 0) return { ox: 0, oy: 0, zoom: 1 };
    const decay = Math.exp(-this.t * 0.24);
    const osc = Math.cos(this.t * 1.7) * decay * this.power * 7;
    return { ox: Math.cos(this.dir) * osc, oy: Math.sin(this.dir) * osc * 0.7, zoom: 1 + this.power * 0.045 * decay };
  }
}

/** Time-scale curve for slow-mo on big hits: dips fast, recovers with ease. frame 0 = impact. */
export function slowMoScale(frame: number, power: number): number {
  const dur = 18;
  if (frame >= dur) return 1;
  const dip = 1 - 0.75 * clamp01(power);
  const t = frame / dur;
  return dip + (1 - dip) * ease.outCubic(t);
}

/* ------------------------------ ink ------------------------------ */

/** Ink splat: wobbly blob + elongated teardrop satellites. Use for INKBLITZ-style hits/KOs. */
export function drawInkSplat(ctx: Canvas2D, x: number, y: number, r: number, seed: number, color = '#0b0b14'): void {
  const rnd = makeRng(seed);
  ctx.save();
  ctx.fillStyle = color;
  const n = 11;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.72 + rnd() * 0.5);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  ctx.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  ctx.closePath();
  ctx.fill();
  const drops = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < drops; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (1.15 + rnd() * 1.1);
    const dr = r * (0.07 + rnd() * 0.16);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d * 0.9;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, dr * 2.1, dr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
