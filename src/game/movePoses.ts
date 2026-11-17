// Authored attack poses (animation only - never touches hitboxes, frame data or physics).
// Each move is described as OFFSETS from the character's own neutral stance, so every weapon
// type keeps its identity (dagger crouch, gauntlet bounce, titan bulk...).
// +x = forward, -y = up. Shoulders automatically follow the chest.
import type { AttackStyle, PoseLike as SkeletonPose } from './poseKit';
import type { MoveKey, WeaponType } from './types';

type J = 'hip' | 'spine' | 'chest' | 'head' | 'elbowF' | 'handF' | 'elbowB' | 'handB' | 'kneeF' | 'footF' | 'kneeB' | 'footB';
type Off = Partial<Record<J, [number, number]>>;
interface Extra {
  wa?: number; // absolute weapon angle
  wr?: number; // weapon reach delta
  smear?: number;
  sheathed?: boolean;
}

function mk(base: SkeletonPose, off: Off, extra: Extra = {}): SkeletonPose {
  const out: SkeletonPose = { ...base };
  const keys = Object.keys(off) as J[];
  for (const k of keys) {
    const [dx, dy] = off[k]!;
    out[k] = { x: base[k].x + dx, y: base[k].y + dy };
  }
  const c = off.chest ?? [0, 0];
  out.shoulderF = { x: base.shoulderF.x + c[0], y: base.shoulderF.y + c[1] };
  out.shoulderB = { x: base.shoulderB.x + c[0], y: base.shoulderB.y + c[1] };
  out.weaponAngle = extra.wa ?? base.weaponAngle;
  out.weaponReach = base.weaponReach + (extra.wr ?? 0);
  if (extra.smear !== undefined) out.smearSpan = extra.smear;
  if (extra.sheathed !== undefined) out.sheathed = extra.sheathed;
  return out;
}

export interface AuthoredMove {
  windup: SkeletonPose;
  strike: SkeletonPose;
  follow?: SkeletonPose; // omitted -> renderer's generic follow-through
  style: AttackStyle;
}

const LIGHT: AttackStyle = { anticipation: 0.15, overshoot: 0.06 };
const HEAVY: AttackStyle = { anticipation: 0.3, overshoot: 0.12 };
export const MOVE_STYLES = { LIGHT, HEAVY };

export function getAuthoredMove(
  base: SkeletonPose,
  moveKey: MoveKey,
  weaponType: WeaponType,
  grounded: boolean
): AuthoredMove | null {
  const katana = weaponType === 'katana';
  switch (moveKey) {
    // ---------------------------------------------------------------- BATCH A
    case 'jab1':
      // windup: lead fist drawn to the chest, chest/head sink back 3px, guard hand lifts.
      // strike: hips then chest drive forward (3 -> 6px) BEFORE the lead fist snaps out to full reach.
      // follow: fist recoils ~4px, chest settles; trailing hand stays at the chin.
      return {
        windup: mk(base, { hip: [-1.5, 0.5], spine: [-2, 0], chest: [-3, 0.5], head: [-3, 0.5], elbowF: [-13, 1.5], handF: [-15, -2], handB: [5, -5], footF: [-2, 0] }, { wa: -2.2 }),
        strike: mk(base, { hip: [2.5, -0.5], spine: [4, -1], chest: [6, -0.5], head: [7, 0], elbowF: [10, -3], handF: [17, -5], handB: [7, -6], elbowB: [3, -1], footF: [3, 0] }, { wa: -0.05, wr: 4, smear: 0.75 }),
        style: LIGHT,
      };
    case 'jab2':
      // windup: rear shoulder cocks back, rear fist chambered behind the hip, lead hand guards the chin.
      // strike: hips and chest rotate open (4 -> 8px), THEN the rear cross drives long; lead hand snaps back to the chin.
      // follow: rear arm stays extended a beat, body weight over the front foot.
      return {
        windup: mk(base, { hip: [-2, 0.5], spine: [-2, 0], chest: [-2.5, 0.5], head: [-2, 0.5], elbowB: [-3, -2], handB: [-4, -4], elbowF: [-3, -1], handF: [-5, -5], footB: [-2, 0] }, { wa: 1.8 }),
        strike: mk(base, { hip: [3.5, -0.5], spine: [6, -1], chest: [8.5, -0.5], head: [9.5, 0], elbowB: [21, -4.5], handB: [35, -9.5], elbowF: [-4, -0.5], handF: [-8, -4.5], footF: [3.5, 0], kneeB: [2, -1] }, { wa: -0.35, wr: 5, smear: 1.1 }),
        style: LIGHT,
      };
    case 'jab3':
      // windup: body leans back and coils, lead knee chambers high, fists tuck in.
      // strike: hips throw forward (5px), chest follows, the roundhouse foot whips to full height with the lead hand punching alongside.
      // follow: leg stays out, torso overcommits forward before the landing.
      return {
        windup: mk(base, { hip: [-3, 1], spine: [-3.5, 0], chest: [-5, 0], head: [-4, 0.5], elbowF: [-7, 1], handF: [-9, -4], handB: [3, -4], kneeF: [4, -7], footF: [-3, -6], footB: [-2, 0] }, { wa: katana ? 2.8 : -2.6, sheathed: katana }),
        strike: mk(base, { hip: [4.5, -1.5], spine: [7, -1.5], chest: [9.5, -1], head: [11, -0.5], elbowF: [10, -5], handF: [14, -9], elbowB: [-1, 0], handB: [-1, 1], kneeF: [6.5, -4.5], footF: [14, -18], kneeB: [0, 1], footB: [-1, 0] }, { wa: -0.45, wr: 6, smear: 1.5, sheathed: false }),
        style: LIGHT,
      };
    case 'ftilt':
      // windup: weight sinks onto the back leg, hips and chest coil away 5px, weapon hand drawn far back.
      // strike: a lunging step - hips and chest travel forward 6-8px first, then the weapon arm thrusts to full length, back leg trails straight.
      // follow: long lunge held low, weapon hand eases back, torso overextends.
      return {
        windup: mk(base, { hip: [-4, 1.5], spine: [-4.5, 0.5], chest: [-6, 1], head: [-5.5, 1], elbowF: [-13, 1], handF: [-18, -4], handB: [-1, -4], kneeF: [-1, 1.5], footF: [-4, 0], kneeB: [-3, 1], footB: [-5, 0] }, { wa: katana ? 2.6 : -2.4, sheathed: katana }),
        strike: mk(base, { hip: [5, 2], spine: [8, 0.5], chest: [11, 0], head: [13, 0.5], elbowF: [11, -3], handF: [19, -3.5], handB: [-3, 0], kneeF: [9, 1], footF: [13, 0], kneeB: [-4, 2], footB: [-9, 0] }, { wa: 0.08, wr: 7, smear: 1.4, sheathed: false }),
        style: LIGHT,
      };
    case 'dtilt':
      // windup: drop low, hips down and back, front leg tucked under the body, weapon arm cocked high-behind.
      // strike: hips shift forward (4px) and the chest dips, then the front leg sweeps out flat along the floor with the weapon hand low.
      // follow: sweep leg hangs out at full reach, body stays crouched.
      return {
        windup: mk(base, { hip: [-3, 5], spine: [-1, 4], chest: [-1, 5], head: [1, 4], elbowF: [-7, 3], handF: [-12, 0], kneeF: [2, 4], footF: [-2, 0], kneeB: [-2, 3] }, { wa: -2.4 }),
        strike: mk(base, { hip: [3, 8], spine: [7, 6], chest: [9, 4.5], head: [11, 4.5], elbowF: [8, 6], handF: [14, 13], handB: [-3, 4], kneeF: [9, 4], footF: [19, 0], kneeB: [-4, 5], footB: [-6, 0] }, { wa: 0.32, wr: 6, smear: 1.4 }),
        style: LIGHT,
      };
    case 'utilt':
      // windup: low crouch, weapon arm swung down and back behind the hip, knees bent.
      // strike: legs push up, hips lift first (3px) then chest, the arm whips in a big overhead arc to full height.
      // follow: arm overshoots past vertical, body fully extended onto the toes.
      return {
        windup: mk(base, { hip: [-1, 4], spine: [0, 3], chest: [0, 4], head: [1, 4], elbowF: [-4, 7], handF: [-8, 15], handB: [-1, 4], kneeF: [3, 3], kneeB: [-2, 3] }, { wa: 1.2 }),
        strike: mk(base, { hip: [1, -3], spine: [1.5, -5], chest: [2, -4], head: [2.5, -4], elbowF: [1, -16], handF: [-3, -28], handB: [-1, -2], kneeF: [1, -2], footF: [0, -1], kneeB: [-1, -2], footB: [0, -2] }, { wa: -Math.PI * 0.52, wr: 7, smear: 1.7 }),
        style: LIGHT,
      };
    default:
      return null;
  }
}
