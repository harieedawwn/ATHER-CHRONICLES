/**
 * poseKit.ts - 2D stick-fighter animation kit (no dependencies).
 *
 * Works on the same joint layout as ATHER-CHRONICLES `SkeletonPose`
 * (hip, spine, chest, head, shoulder/elbow/hand F+B, knee/foot F+B, weapon fields).
 *
 * What it fixes versus plain lerp of x,y joint positions:
 *  1. Limbs SWING IN ARCS (angle interpolation) instead of cutting straight lines.
 *  2. Limb lengths blend smoothly, so no random stretching/shrinking mid-swing.
 *  3. Attacks get anticipation -> whip -> overshoot -> hold -> settle -> return.
 *  4. Walk/run cycle with contact/lift, counter-swing and hip bob.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface PoseLike {
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

/* ------------------------------ math + easing ------------------------------ */

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest-path angle lerp (radians). */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

export const ease = {
  linear: (t: number) => t,
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

/* ------------------------------ arc limb blend ------------------------------ */

interface Limb {
  a1: number; // upper segment angle (canvas coords: 0 = +x, PI/2 = down)
  l1: number;
  a2: number; // lower segment angle (absolute)
  l2: number;
}

function toLimb(root: Vec2, mid: Vec2, end: Vec2): Limb {
  return {
    a1: Math.atan2(mid.y - root.y, mid.x - root.x),
    l1: Math.hypot(mid.x - root.x, mid.y - root.y),
    a2: Math.atan2(end.y - mid.y, end.x - mid.x),
    l2: Math.hypot(end.x - mid.x, end.y - mid.y),
  };
}

function mixLimb(p: Limb, q: Limb, t: number): Limb {
  return {
    a1: lerpAngle(p.a1, q.a1, t),
    l1: lerp(p.l1, q.l1, t),
    a2: lerpAngle(p.a2, q.a2, t),
    l2: lerp(p.l2, q.l2, t),
  };
}

function solveLimb(root: Vec2, L: Limb): { mid: Vec2; end: Vec2 } {
  const mid = { x: root.x + Math.cos(L.a1) * L.l1, y: root.y + Math.sin(L.a1) * L.l1 };
  const end = { x: mid.x + Math.cos(L.a2) * L.l2, y: mid.y + Math.sin(L.a2) * L.l2 };
  return { mid, end };
}

/**
 * Drop-in replacement for the old `blendPose`: torso/head blend by position,
 * arms and legs blend by ANGLE so hands and feet travel on arcs.
 * `extrapolate` lets t go slightly outside 0..1 (used for overshoot).
 */
export function blendPoseArc<T extends PoseLike>(a: T, b: T, t: number, extrapolate = false): T {
  const k = extrapolate ? Math.max(-0.6, Math.min(1.6, t)) : clamp01(t);

  const hip = lerpVec(a.hip, b.hip, k);
  const shoulderF = lerpVec(a.shoulderF, b.shoulderF, k);
  const shoulderB = lerpVec(a.shoulderB, b.shoulderB, k);

  const armF = solveLimb(shoulderF, mixLimb(toLimb(a.shoulderF, a.elbowF, a.handF), toLimb(b.shoulderF, b.elbowF, b.handF), k));
  const armB = solveLimb(shoulderB, mixLimb(toLimb(a.shoulderB, a.elbowB, a.handB), toLimb(b.shoulderB, b.elbowB, b.handB), k));
  const legF = solveLimb(hip, mixLimb(toLimb(a.hip, a.kneeF, a.footF), toLimb(b.hip, b.kneeF, b.footF), k));
  const legB = solveLimb(hip, mixLimb(toLimb(a.hip, a.kneeB, a.footB), toLimb(b.hip, b.kneeB, b.footB), k));

  return {
    ...b,
    hip,
    spine: lerpVec(a.spine, b.spine, k),
    chest: lerpVec(a.chest, b.chest, k),
    head: lerpVec(a.head, b.head, k),
    shoulderF,
    elbowF: armF.mid,
    handF: armF.end,
    shoulderB,
    elbowB: armB.mid,
    handB: armB.end,
    kneeF: legF.mid,
    footF: legF.end,
    kneeB: legB.mid,
    footB: legB.end,
    weaponAngle: lerpAngle(a.weaponAngle, b.weaponAngle, k),
    weaponReach: lerp(a.weaponReach, b.weaponReach, k),
    offhandWeaponAngle:
      a.offhandWeaponAngle !== undefined && b.offhandWeaponAngle !== undefined
        ? lerpAngle(a.offhandWeaponAngle, b.offhandWeaponAngle, k)
        : b.offhandWeaponAngle ?? a.offhandWeaponAngle,
    sheathed: k < 0.5 ? a.sheathed : b.sheathed,
    smearAlpha: lerp(a.smearAlpha ?? 0, b.smearAlpha ?? 0, clamp01(k)),
    smearSpan: lerp(a.smearSpan ?? 0, b.smearSpan ?? 0, clamp01(k)),
  };
}

/* ------------------------------ attack sampler ------------------------------ */

export interface AttackTiming {
  startup: number;
  active: number;
  recovery: number;
}

export interface AttackStyle {
  /** how far past `windup` the body coils before the whip (0.1 - 0.3). */
  anticipation: number;
  /** how far past `strike` the limbs overshoot at impact (0.04 - 0.12). */
  overshoot: number;
}

export const DEFAULT_ATTACK_STYLE: AttackStyle = { anticipation: 0.2, overshoot: 0.08 };

/**
 * Turns the 3 authored poses of a move into a full timeline:
 *   base -> coil (anticipation, easeOut) -> WHIP into strike (accelerating)
 *   -> overshoot at impact -> hold -> settle to follow -> return to base.
 * The strike pose is fully reached one frame into ACTIVE (the first active
 * frame is already ~50% extended).
 * Also fills smearAlpha so slash trails peak during the whip + early active.
 */
export function sampleAttack<T extends PoseLike>(
  base: T,
  windup: T,
  strike: T,
  follow: T,
  timing: AttackTiming,
  frame: number,
  style: AttackStyle = DEFAULT_ATTACK_STYLE
): T {
  const S = Math.max(1, timing.startup);
  const A = Math.max(1, timing.active);
  const R = Math.max(1, timing.recovery);

  const coil = blendPoseArc(base, windup, 1 + style.anticipation, true);
  const over = blendPoseArc(windup, strike, 1 + style.overshoot, true);

  // The whip spans the second half of startup AND the first active frame, so the
  // hit frame is already ~50% extended and the jump between frames stays small
  // even for 2-3 frame startups. Full extension lands one frame into active.
  const split = S * 0.5;
  const whipEnd = S + 1;
  const activeEnd = S + A;

  // 1) coil (easeOut), then whip (accelerating)
  if (frame < split) return blendPoseArc(base, coil, ease.outCubic(frame / split));
  if (frame < whipEnd) {
    const u = (frame - split) / (whipEnd - split);
    const p = blendPoseArc(coil, strike, Math.pow(u, 1.3));
    p.smearAlpha = 0.85 * u;
    p.smearSpan = strike.smearSpan ?? 1.1;
    return p;
  }

  // 2) rest of active: snap to overshoot (first 35%), then settle back toward strike/follow
  if (frame < activeEnd) {
    const u = (frame - whipEnd) / Math.max(1, activeEnd - whipEnd);
    let p: T;
    if (u < 0.35) p = blendPoseArc(strike, over, ease.outCubic(u / 0.35));
    else p = blendPoseArc(over, blendPoseArc(strike, follow, 0.25), ease.inOutCubic((u - 0.35) / 0.65));
    p.smearAlpha = 0.85 * (1 - u * 0.6);
    p.smearSpan = strike.smearSpan ?? 1.1;
    return p;
  }

  // 3) recovery: settle into follow (35%), then return to base
  const r = clamp01((frame - S - A) / R);
  const hold = blendPoseArc(strike, follow, 0.25);
  if (r < 0.35) return blendPoseArc(hold, follow, ease.outCubic(r / 0.35));
  return blendPoseArc(follow, base, ease.inOutCubic((r - 0.35) / 0.65));
}

/* ------------------------------ locomotion ------------------------------ */

/**
 * Procedural walk/run on top of any base pose.
 * phase: radians, advance each tick by ~ speed * 0.18 (walk) / 0.28 (run).
 * intensity: 0 = idle, 1 = walk, 1.6 = run.
 */
export function locomotionPose<T extends PoseLike>(base: T, phase: number, intensity: number): T {
  const swing = 0.62 * intensity;
  const lift = 0.9 * intensity;

  const legAt = (rootPose: Vec2, knee: Vec2, foot: Vec2, ph: number) => {
    const L = toLimb(rootPose, knee, foot);
    const restBend = L.a2 - L.a1;
    L.a1 += Math.sin(ph) * swing;
    // knee bends most while the leg swings forward (foot lifts), little on the stance leg
    L.a2 = L.a1 + restBend + Math.max(0, Math.cos(ph)) * lift * 0.8;
    return solveLimb(rootPose, L);
  };

  const bob = Math.abs(Math.sin(phase)) * 1.6 * intensity;
  const hip = { x: base.hip.x, y: base.hip.y - bob };

  const lf = legAt(hip, base.kneeF, base.footF, phase);
  const lb = legAt(hip, base.kneeB, base.footB, phase + Math.PI);

  const armAt = (shoulder: Vec2, elbow: Vec2, hand: Vec2, ph: number) => {
    const L = toLimb(shoulder, elbow, hand);
    const d = L.a2 - L.a1;
    L.a1 += Math.sin(ph) * 0.45 * intensity;
    L.a2 = L.a1 + d - Math.max(0, -Math.sin(ph)) * 0.35 * intensity;
    return solveLimb(shoulder, L);
  };

  const shoulderF = { x: base.shoulderF.x, y: base.shoulderF.y - bob };
  const shoulderB = { x: base.shoulderB.x, y: base.shoulderB.y - bob };
  // arms counter-swing the legs
  const af = armAt(shoulderF, base.elbowF, base.handF, phase + Math.PI);
  const ab = armAt(shoulderB, base.elbowB, base.handB, phase);

  const lean = 0.8 * intensity;
  return {
    ...base,
    hip,
    spine: { x: base.spine.x + lean * 0.5, y: base.spine.y - bob },
    chest: { x: base.chest.x + lean, y: base.chest.y - bob },
    head: { x: base.head.x + lean * 1.2, y: base.head.y - bob },
    shoulderF,
    elbowF: af.mid,
    handF: af.end,
    shoulderB,
    elbowB: ab.mid,
    handB: ab.end,
    kneeF: lf.mid,
    footF: lf.end,
    kneeB: lb.mid,
    footB: lb.end,
  };
}

/* ------------------------------ hit feel ------------------------------ */

/**
 * Screen/body shake while hit-stop frames remain. Use the offset on the
 * victim (and a smaller one on the camera). `remaining` counts down to 0.
 */
export function hitShake(remaining: number, strength = 2.2, seed = 0): Vec2 {
  if (remaining <= 0) return { x: 0, y: 0 };
  const decay = Math.min(1, remaining / 6);
  const s = (remaining + seed) * 12.9898;
  return { x: Math.sin(s) * strength * decay, y: Math.cos(s * 1.7) * strength * 0.6 * decay };
}
