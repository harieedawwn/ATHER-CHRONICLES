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
  owa?: number; // offhand weapon angle
  smear?: number;
  sheathed?: boolean;
}

function mk(base: SkeletonPose, off: Off, extra: Extra = {}, weaponType?: WeaponType): SkeletonPose {
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
  if (extra.owa !== undefined) out.offhandWeaponAngle = extra.owa;
  if (extra.smear !== undefined) out.smearSpan = extra.smear;
  if (extra.sheathed !== undefined) out.sheathed = extra.sheathed;

  // Per-weapon biomechanical identity (docs/ANIMATION_SKILL.md section 5)
  if (weaponType === 'katana' && !out.sheathed) {
    // Two-handed grip: rear hand stays within ~4px of lead hand on sword swings
    out.handB = { x: out.handF.x - 3, y: out.handF.y + 1.5 };
    out.elbowB = { x: (out.shoulderB.x + out.handB.x) * 0.5 - 2, y: (out.shoulderB.y + out.handB.y) * 0.5 + 3 };
  } else if (weaponType === 'gauntlet') {
    // Pure boxing: non-punching guard hand stays high by the chin (y ≈ -18)
    if ((off.handB?.[0] ?? 0) < (off.handF?.[0] ?? 0)) {
      out.handB = { x: out.chest.x + 4, y: -18 };
      out.elbowB = { x: out.chest.x + 1, y: -11 };
    }
  } else if (weaponType === 'spear') {
    // Long linear thrusts: rear hand slides along the polearm shaft behind lead hand
    out.handB = { x: out.handF.x - Math.cos(out.weaponAngle) * 10, y: out.handF.y - Math.sin(out.weaponAngle) * 10 };
  } else if (weaponType === 'chains' || weaponType === 'orbs' || weaponType === 'claws') {
    if (out.offhandWeaponAngle === undefined) {
      out.offhandWeaponAngle = -out.weaponAngle * 0.85;
    }
  }
  return out;
}

export interface AuthoredMove {
  windup: SkeletonPose;
  strike: SkeletonPose;
  follow: SkeletonPose;
  style: AttackStyle;
}

const LIGHT: AttackStyle = { anticipation: 0.15, overshoot: 0.06 };
const HEAVY: AttackStyle = { anticipation: 0.3, overshoot: 0.12 };
const AERIAL: AttackStyle = { anticipation: 0.2, overshoot: 0.08 };
export const MOVE_STYLES = { LIGHT, HEAVY, AERIAL };

function styleFor(baseStyle: AttackStyle, weaponType: WeaponType): AttackStyle {
  if (weaponType === 'dagger') {
    return { anticipation: Math.max(0.1, baseStyle.anticipation - 0.03), overshoot: baseStyle.overshoot };
  }
  if (weaponType === 'titan') {
    return { anticipation: Math.max(baseStyle.anticipation, 0.35), overshoot: Math.max(baseStyle.overshoot, 0.12) };
  }
  return baseStyle;
}

export function getAuthoredMove(
  base: SkeletonPose,
  moveKey: MoveKey,
  weaponType: WeaponType,
  grounded: boolean
): AuthoredMove | null {
  void grounded;
  const katana = weaponType === 'katana';
  const dagger = weaponType === 'dagger';
  const scythe = weaponType === 'scythe';
  const titan = weaponType === 'titan';
  const lightStyle = styleFor(LIGHT, weaponType);
  const heavyStyle = styleFor(HEAVY, weaponType);
  const aerialStyle = styleFor(AERIAL, weaponType);

  switch (moveKey) {
    // ---------------------------------------------------------------- BATCH A
    case 'jab1':
      // windup: lead fist/weapon pulls back to the ribs (-15px), hips and chest sink back 3px, rear hand guards chin.
      // strike: hips then chest drive forward (3 -> 6px) BEFORE the lead hand snaps out 32px to full horizontal reach.
      // follow: lead fist/weapon settles 5px past target and drops 3px as shoulders relax over the front foot.
      return {
        windup: mk(base, { hip: [-2, 0.5], spine: [-2.5, 0], chest: [-3.5, 0.5], head: [-3, 0.5], elbowF: [-13, 1.5], handF: [-15, -2], handB: [5, -5], footF: [-2, 0] }, { wa: dagger ? 2.5 : -2.2 }, weaponType),
        strike: mk(base, { hip: [3, -0.5], spine: [4.5, -1], chest: [6.5, -0.5], head: [5, 0], elbowF: [10, -3], handF: [18, -5], handB: [6, -6], elbowB: [2, -1], footF: [3, 0] }, { wa: scythe ? 0.45 : -0.05, wr: 4, smear: 0.8 }, weaponType),
        follow: mk(base, { hip: [3.5, 0.5], spine: [5, 0], chest: [6.5, 0.5], head: [5, 0.5], elbowF: [7, -1], handF: [13, -2], handB: [4, -4], footF: [3, 0] }, { wa: 0.18, wr: 2 }, weaponType),
        style: lightStyle,
      };
    case 'jab2':
      // windup: hips twist back 3px, rear shoulder cocks deep behind the torso, lead hand pulls back to guard.
      // strike: hips and chest whip open (4 -> 8.5px) first, THEN the rear cross/slash drives 34px forward across the centerline.
      // follow: torso stays rotated into the cross, striking arm drifts down 4px as weight settles on the lead leg.
      return {
        windup: mk(base, { hip: [-2.5, 0.5], spine: [-3, 0], chest: [-4, 0.5], head: [-2.5, 0.5], elbowB: [-9, -1], handB: [-14, -3], elbowF: [-6, -1], handF: [-9, -4], footB: [-2, 0] }, { wa: 1.85 }, weaponType),
        strike: mk(base, { hip: [4, -0.5], spine: [6.5, -1], chest: [8.5, -0.5], head: [7, 0], elbowB: [18, -4.5], handB: [28, -9], elbowF: [9, -3.5], handF: [16, -7.5], footF: [4, 0], kneeB: [2, -1] }, { wa: -0.35, wr: 5, smear: 1.1 }, weaponType),
        follow: mk(base, { hip: [4.5, 0.5], spine: [7, 0], chest: [8.5, 0.5], head: [7, 0.5], elbowB: [13, -2], handB: [21, -5], elbowF: [6, -1.5], handF: [11, -4], footF: [4, 0] }, { wa: -0.1, wr: 2 }, weaponType),
        style: lightStyle,
      };
    case 'jab3':
      // windup: body coils back 5px, lead knee chambers high toward the chest, weapon hand tucks tight behind the hip.
      // strike: hips hurl forward (5px) and chest follows, whipping the roundhouse kick and weapon hand 26px out in unison.
      // follow: kicking leg and weapon arm hang past the arc before dropping back toward a wide combat stance.
      return {
        windup: mk(base, { hip: [-3.5, 1], spine: [-4, 0], chest: [-5.5, 0], head: [-4, 0.5], elbowF: [-9, 1], handF: [-12, -3], handB: [2, -4], kneeF: [3, -7], footF: [-5, -6], footB: [-2, 0] }, { wa: katana ? 2.8 : -2.6, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [4.5, -1.5], spine: [7, -1.5], chest: [9.5, -1], head: [8, -0.5], elbowF: [10, -5], handF: [15, -9], elbowB: [-2, 0], handB: [-4, 1], kneeF: [7, -5], footF: [16, -18], kneeB: [0, 1], footB: [-1, 0] }, { wa: -0.45, wr: 6, smear: 1.5, sheathed: false }, weaponType),
        follow: mk(base, { hip: [5, 0.5], spine: [7.5, 0], chest: [9.5, 0.5], head: [8, 0.5], elbowF: [7, -2], handF: [11, -4], kneeF: [6, -1], footF: [11, -6], footB: [-2, 0] }, { wa: 0.1, wr: 3, sheathed: false }, weaponType),
        style: lightStyle,
      };
    case 'ftilt':
      // windup: weight sinks onto the rear leg, hips and chest coil back 6px, weapon hand draws 18px behind the shoulder.
      // strike: lunging step — hips and chest surge forward (5 -> 11px) first, then the weapon arm thrusts 37px to full length.
      // follow: deep lunge held low with front knee bent, weapon tip dips 4px past the thrust line as momentum settles.
      return {
        windup: mk(base, { hip: [-4, 1.5], spine: [-5, 0.5], chest: [-6.5, 1], head: [-5, 1], elbowF: [-13, 1], handF: [-18, -4], handB: [-3, -4], kneeF: [-1, 1.5], footF: [-4, 0], kneeB: [-3, 1], footB: [-5, 0] }, { wa: katana ? 2.6 : -2.4, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [5.5, 2], spine: [8.5, 0.5], chest: [11.5, 0], head: [10, 0.5], elbowF: [11, -3], handF: [19, -3.5], handB: [-4, 0], kneeF: [9, 1], footF: [13, 0], kneeB: [-4, 2], footB: [-9, 0] }, { wa: scythe ? 0.55 : 0.08, wr: 7, smear: 1.4, sheathed: false }, weaponType),
        follow: mk(base, { hip: [6, 3], spine: [9, 1.5], chest: [11.5, 1], head: [10, 1], elbowF: [9, -0.5], handF: [16, 1], handB: [-5, 2], kneeF: [9.5, 2], footF: [13, 0], kneeB: [-4, 2.5], footB: [-9, 0] }, { wa: 0.28, wr: 4, sheathed: false }, weaponType),
        style: lightStyle,
      };
    case 'dtilt':
      // windup: crouch low (hips +5px down, -3.5px back), front leg coils under the pelvis, weapon hand cocks high-back.
      // strike: hips slide forward 6.5px and chest dips low BEFORE the lead leg and weapon whip 28px out along the floor.
      // follow: stays in a low split-crouch with the sweeping leg and blade resting near the ground past the strike.
      return {
        windup: mk(base, { hip: [-3.5, 5], spine: [-2, 4], chest: [-2, 5], head: [0, 4], elbowF: [-8, 3], handF: [-13, -1], kneeF: [1, 4], footF: [-3, 0], kneeB: [-2, 3] }, { wa: -2.4 }, weaponType),
        strike: mk(base, { hip: [3, 8], spine: [7, 6], chest: [9.5, 4.5], head: [9, 4.5], elbowF: [8, 6], handF: [15, 13], handB: [-4, 4], kneeF: [9, 4], footF: [19, 0], kneeB: [-4, 5], footB: [-6, 0] }, { wa: 0.35, wr: 6, smear: 1.4 }, weaponType),
        follow: mk(base, { hip: [3.5, 8.5], spine: [7, 6.5], chest: [9, 5.5], head: [8.5, 5], elbowF: [6, 7], handF: [12, 15], handB: [-5, 5], kneeF: [8, 4.5], footF: [16, 0], kneeB: [-4, 5], footB: [-6, 0] }, { wa: 0.5, wr: 3 }, weaponType),
        style: lightStyle,
      };
    case 'utilt':
      // windup: knees bend into a spring crouch, hips drop 4px, weapon hand sweeps down and back (+15px y) behind the knee.
      // strike: legs drive upward, hips rise 7px and chest lifts first, then the weapon arm whips 43px up into a high overhead arc.
      // follow: arm overshoots slightly behind the head at full extension while the fighter balances high on the toes.
      return {
        windup: mk(base, { hip: [-1.5, 4], spine: [-1, 3], chest: [-1, 4], head: [0, 3.5], elbowF: [-5, 7], handF: [-9, 15], handB: [-2, 4], kneeF: [3, 3], kneeB: [-2, 3] }, { wa: 1.25 }, weaponType),
        strike: mk(base, { hip: [1.5, -3], spine: [2, -5], chest: [3, -4.5], head: [2.5, -4], elbowF: [2, -16], handF: [-2, -28], handB: [-2, -3], kneeF: [1, -2], footF: [0, -1], kneeB: [-1, -2], footB: [0, -2] }, { wa: -Math.PI * 0.54, wr: 7, smear: 1.7 }, weaponType),
        follow: mk(base, { hip: [1, -2], spine: [1, -3.5], chest: [1.5, -3], head: [1.5, -3], elbowF: [-2, -15], handF: [-7, -25], handB: [-3, -2], kneeF: [1, -1], footF: [0, 0], kneeB: [-1, -1], footB: [0, 0] }, { wa: -Math.PI * 0.68, wr: 4 }, weaponType),
        style: lightStyle,
      };

    // ---------------------------------------------------------------- BATCH B
    case 'fstrong':
      // windup: deep full-body torque — hips sink back 6px, torso coils away 9px, both hands haul the weapon high behind the back (-22px).
      // strike: explosive forward step — hips and chest hurl 14px -> 19px forward BEFORE the weapon cleaves 45px across into a massive horizontal smash.
      // follow: heavy overcommitment — torso stays leaned far over the planted front knee while the weapon tip drags low past the arc.
      return {
        windup: mk(base, { hip: [-6, 2.5], spine: [-7.5, 1.5], chest: [-9.5, 2], head: [-7, 1.5], elbowF: [-16, -4], handF: [-22, -11], elbowB: [-14, -2], handB: [-20, -8], kneeF: [-2, 2], footF: [-6, 0], kneeB: [-5, 2.5], footB: [-8, 0] }, { wa: katana ? 2.85 : -2.65, wr: 2, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [8, 2.5], spine: [11.5, 1], chest: [15, 0.5], head: [13, 1], elbowF: [15, -2.5], handF: [24, -1.5], elbowB: [-6, 1], handB: [-12, 3], kneeF: [12, 1.5], footF: [17, 0], kneeB: [-6, 3], footB: [-13, 0] }, { wa: scythe ? 0.72 : 0.16, wr: 11, smear: 2.1, sheathed: false }, weaponType),
        follow: mk(base, { hip: [9, titan ? 5.5 : 3.5], spine: [12.5, titan ? 3.5 : 2], chest: [16, titan ? 3 : 1.5], head: [14, 2], elbowF: [12, 2], handF: [19, 6], elbowB: [-8, 2], handB: [-14, 5], kneeF: [13, titan ? 4 : 2.5], footF: [17, 0], kneeB: [-6, 4], footB: [-13, 0] }, { wa: 0.48, wr: 7, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'dstrong':
      // windup: high torso coil before a ground-shattering slam — hips pull back 4px while chest and arms hoist the weapon high overhead (-20px y).
      // strike: hips drop 9px into a wide sumo/split stance first, then the chest and both arms crash 38px downward to cleave both sides of the floor.
      // follow: deep knee-bent recovery near the ground, weapon embedded low while the shoulders heave from the impact.
      return {
        windup: mk(base, { hip: [-4, 1], spine: [-3, -2], chest: [-2, -4], head: [-1, -3], elbowF: [-8, -12], handF: [-14, -20], elbowB: [-10, -10], handB: [-15, -17], kneeF: [2, 1], footF: [-2, -2], kneeB: [-3, 2], footB: [-4, 0] }, { wa: katana ? 2.75 : -2.2, wr: 3, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [3, 9.5], spine: [6, 7.5], chest: [9, 6.5], head: [8, 6], elbowF: [11, 7], handF: [19, 16], elbowB: [-10, 6], handB: [-17, 13], kneeF: [12, 5], footF: [18, 0], kneeB: [-10, 5], footB: [-16, 0] }, { wa: 0.62, owa: 2.52, wr: 10, smear: 2.2, sheathed: false }, weaponType),
        follow: mk(base, { hip: [3.5, titan ? 11 : 10], spine: [6.5, 8.5], chest: [9, 7.5], head: [8, 7], elbowF: [9, 8.5], handF: [15, 18], elbowB: [-9, 7], handB: [-15, 15], kneeF: [12, 5.5], footF: [18, 0], kneeB: [-10, 5.5], footB: [-16, 0] }, { wa: 0.78, owa: 2.4, wr: 6, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'ustrong':
      // windup: deep compressed coil — hips drop +6.5px down and -3px back, torso hunches low, weapon hand winds all the way down by the rear ankle (+18px y).
      // strike: legs detonate upward — hips surge 11px up and chest arches skyward BEFORE the weapon hand rockets 51px straight overhead.
      // follow: full vertical stretch on tiptoes with the weapon held high above the crown before descending back to stance.
      return {
        windup: mk(base, { hip: [-3, 6.5], spine: [-2, 5.5], chest: [-1, 6.5], head: [0, 5], elbowF: [-8, 10], handF: [-13, 18], elbowB: [-6, 8], handB: [-10, 14], kneeF: [5, 4.5], footF: [2, 0], kneeB: [-4, 4.5], footB: [-4, 0] }, { wa: katana ? 2.65 : 1.45, wr: 2, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [2.5, -4.5], spine: [4, -7], chest: [5.5, -7.5], head: [4.5, -6.5], elbowF: [6, -19], handF: [5, -33], elbowB: [-4, -9], handB: [-8, -14], kneeF: [3, -3], footF: [4, -2], kneeB: [-3, -2], footB: [-3, -1] }, { wa: -Math.PI * 0.48, wr: 11, smear: 2.1, sheathed: false }, weaponType),
        follow: mk(base, { hip: [2, -2.5], spine: [3, -4.5], chest: [4, -5], head: [3.5, -4.5], elbowF: [1, -18], handF: [-3, -29], elbowB: [-5, -6], handB: [-9, -10], kneeF: [2, -1], footF: [3, 0], kneeB: [-2, -1], footB: [-2, 0] }, { wa: -Math.PI * 0.62, wr: 7, sheathed: false }, weaponType),
        style: heavyStyle,
      };

    // ---------------------------------------------------------------- BATCH C
    case 'nair':
      // windup: mid-air tuck — knees pull up toward the chest, arms cross inward across the ribs (-14px x).
      // strike: hips pop open first and chest expands, snapping both arms and the lead kick 31px outward into a 360 starburst slash.
      // follow: limbs drift slightly downward from full spread as the aerial spin decelerates.
      return {
        windup: mk(base, { hip: [-1.5, -2], spine: [-2, -2], chest: [-2.5, -1.5], head: [-1.5, -1], elbowF: [-9, 1], handF: [-14, 3], elbowB: [5, 1], handB: [9, 3], kneeF: [4, -6], footF: [-2, -8], kneeB: [-2, -5], footB: [-5, -7] }, { wa: -2.5 }, weaponType),
        strike: mk(base, { hip: [2, -3.5], spine: [3, -4], chest: [4, -4], head: [3.5, -3.5], elbowF: [11, -3], handF: [18, -5], elbowB: [-11, -2], handB: [-19, -5], kneeF: [9, -5], footF: [16, -9], kneeB: [-9, -3], footB: [-15, -6] }, { wa: -0.12, owa: Math.PI - 0.12, wr: 7, smear: 2.3 }, weaponType),
        follow: mk(base, { hip: [1.5, -2], spine: [2, -2.5], chest: [2.5, -2.5], head: [2, -2], elbowF: [8, -1], handF: [14, -2], elbowB: [-8, -1], handB: [-14, -2], kneeF: [6, -3], footF: [11, -5], kneeB: [-6, -2], footB: [-11, -4] }, { wa: 0.15, wr: 4 }, weaponType),
        style: aerialStyle,
      };
    case 'fair':
      // windup: airborne torso arches back (-5px), knees tuck up, weapon arm cocks high above and behind the head (-16px x, -18px y).
      // strike: hips and chest whip forward in mid-air (4 -> 8px) BEFORE the weapon arm cleaves 40px down-forward across the front arc.
      // follow: weapon arm finishes low in front of the shins while the legs trail behind to counterbalance.
      return {
        windup: mk(base, { hip: [-3, -2], spine: [-4, -3], chest: [-5.5, -3.5], head: [-4, -3], elbowF: [-10, -11], handF: [-16, -18], elbowB: [-7, -5], handB: [-12, -9], kneeF: [5, -5], footF: [1, -8], kneeB: [-4, -4], footB: [-8, -7] }, { wa: katana ? 2.7 : -2.15, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [4, -1.5], spine: [6.5, -2], chest: [8.5, -2], head: [7.5, -1.5], elbowF: [12, -1], handF: [19, 4], elbowB: [-6, -2], handB: [-12, -4], kneeF: [7, -3], footF: [3, -6], kneeB: [-7, -1], footB: [-13, -4] }, { wa: scythe ? 0.65 : 0.28, wr: 8, smear: 1.8, sheathed: false }, weaponType),
        follow: mk(base, { hip: [4.5, -0.5], spine: [7, -1], chest: [9, -0.5], head: [8, -0.5], elbowF: [9, 3], handF: [15, 9], elbowB: [-7, -1], handB: [-13, -2], kneeF: [6, -2], footF: [2, -4], kneeB: [-7, 0], footB: [-12, -2] }, { wa: 0.55, wr: 5, sheathed: false }, weaponType),
        style: aerialStyle,
      };
    case 'uair':
      // windup: mid-air coil — chest dips forward and weapon hand sweeps down below the tucked knees (-10px x, +14px y).
      // strike: hips lift and chest arches back (-5px y) first, then the weapon arm and acrobat kick whip 44px straight overhead.
      // follow: weapon arm and kicking leg trail high behind the crown as the torso levels out in the air.
      return {
        windup: mk(base, { hip: [-2, 1], spine: [-1, 1.5], chest: [0, 2], head: [1, 1.5], elbowF: [-6, 7], handF: [-10, 14], elbowB: [-4, 4], handB: [-8, 9], kneeF: [6, -3], footF: [2, -6], kneeB: [-3, -2], footB: [-6, -5] }, { wa: 1.35 }, weaponType),
        strike: mk(base, { hip: [1.5, -4], spine: [1, -5.5], chest: [0.5, -6], head: [0, -5], elbowF: [4, -17], handF: [3, -29], elbowB: [-5, -6], handB: [-10, -10], kneeF: [7, -10], footF: [8, -22], kneeB: [-5, -3], footB: [-9, -6] }, { wa: -Math.PI * 0.55, wr: 8, smear: 1.9 }, weaponType),
        follow: mk(base, { hip: [1, -3], spine: [0, -4], chest: [-1, -4.5], head: [-1, -4], elbowF: [-2, -16], handF: [-6, -26], elbowB: [-6, -5], handB: [-11, -8], kneeF: [5, -7], footF: [4, -15], kneeB: [-5, -2], footB: [-8, -5] }, { wa: -Math.PI * 0.7, wr: 5 }, weaponType),
        style: aerialStyle,
      };
    case 'dair':
      // windup: high aerial suspension — hips and chest lift (-5px y), knees tuck tight, weapon is hoisted high above the head (-24px y).
      // strike: hips and chest plunge downward (+4px y) first, driving the weapon and meteor heel 46px straight down beneath the boots.
      // follow: body stays extended vertically downward with the weapon point aimed at the floor below.
      return {
        windup: mk(base, { hip: [-2, -5], spine: [-1, -6], chest: [0, -6.5], head: [1, -5.5], elbowF: [-4, -15], handF: [-6, -24], elbowB: [-6, -12], handB: [-9, -19], kneeF: [6, -7], footF: [2, -10], kneeB: [-4, -6], footB: [-7, -9] }, { wa: -1.85 }, weaponType),
        strike: mk(base, { hip: [1.5, 2], spine: [3, 3], chest: [4.5, 4], head: [4, 3.5], elbowF: [5, 9], handF: [6, 22], elbowB: [-5, -4], handB: [-10, -8], kneeF: [4, 2], footF: [6, 9], kneeB: [-5, -3], footB: [-9, -6] }, { wa: Math.PI * 0.48, wr: 9, smear: 1.9 }, weaponType),
        follow: mk(base, { hip: [1.5, 3], spine: [3, 4], chest: [4, 5], head: [3.5, 4], elbowF: [4, 11], handF: [4, 24], elbowB: [-6, -3], handB: [-11, -6], kneeF: [3, 3], footF: [5, 10], kneeB: [-5, -2], footB: [-8, -5] }, { wa: Math.PI * 0.54, wr: 6 }, weaponType),
        style: aerialStyle,
      };
    case 'bair':
      // windup: torso twists forward (+5px) in mid-air, weapon hand and rear leg chamber across the front of the chest (+14px x).
      // strike: hips and chest snap backward (-4 -> -8px) first, whipping the weapon and rear heel 38px behind the back (-24px x).
      // follow: torso stays turned toward the rear with the weapon and back kick stretched behind the trailing shoulder.
      return {
        windup: mk(base, { hip: [2.5, -1], spine: [4, -1.5], chest: [5.5, -1.5], head: [4, -1], elbowF: [9, -1], handF: [14, -4], elbowB: [4, 0], handB: [8, -2], kneeF: [5, -3], footF: [2, -6], kneeB: [3, -4], footB: [6, -6] }, { wa: 0.25 }, weaponType),
        strike: mk(base, { hip: [-4, -2], spine: [-6, -2.5], chest: [-8, -2.5], head: [-6.5, -2], elbowF: [-14, -3], handF: [-24, -6], elbowB: [5, -2], handB: [10, -5], kneeF: [4, -2], footF: [2, -5], kneeB: [-12, -5], footB: [-22, -9] }, { wa: Math.PI - 0.12, wr: 8, smear: 1.8 }, weaponType),
        follow: mk(base, { hip: [-4.5, -1], spine: [-6.5, -1.5], chest: [-8.5, -1.5], head: [-7, -1], elbowF: [-12, -1], handF: [-20, -3], elbowB: [4, -1], handB: [8, -3], kneeF: [4, -1], footF: [2, -4], kneeB: [-10, -3], footB: [-18, -6] }, { wa: Math.PI + 0.1, wr: 5 }, weaponType),
        style: aerialStyle,
      };

    // ---------------------------------------------------------------- BATCH D
    case 'nspecial':
      // windup: hips and chest draw back 4.5px while both hands gather inward to the solar plexus (-13px x) to channel energy.
      // strike: hips thrust forward 4px and chest opens wide (7.5px) BEFORE the lead hand blasts 34px forward to release the technique.
      // follow: chest stays proud with the casting arm outstretched and the off-hand counterbalancing behind the shoulder.
      return {
        windup: mk(base, { hip: [-3.5, 1], spine: [-4, 0.5], chest: [-4.5, 1], head: [-3, 0.5], elbowF: [-9, 1], handF: [-13, -2], elbowB: [-8, 2], handB: [-12, 0], kneeF: [0, 1], footF: [-2, 0], kneeB: [-2, 1] }, { wa: katana ? 2.7 : -2.4, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [4, -0.5], spine: [6, -1], chest: [7.5, -1], head: [6.5, -0.5], elbowF: [12, -3.5], handF: [21, -6], elbowB: [-8, -2], handB: [-15, -5], kneeF: [6, 0.5], footF: [8, 0], kneeB: [-4, 1], footB: [-7, 0] }, { wa: -0.04, owa: Math.PI - 0.2, wr: 8, smear: 1.6, sheathed: false }, weaponType),
        follow: mk(base, { hip: [4, 0.5], spine: [5.5, 0], chest: [7, 0], head: [6, 0], elbowF: [10, -2], handF: [17, -3.5], elbowB: [-7, -1], handB: [-13, -3], kneeF: [5, 1], footF: [7, 0], kneeB: [-3, 1], footB: [-6, 0] }, { wa: 0.12, wr: 5, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'sspecial':
      // windup: low sprinter's coil — hips sink back 6.5px and down 3px, torso leans back, weapon hand tucks 20px behind the hip.
      // strike: blitzing lunge — hips and chest rocket 16px -> 25px forward BEFORE the weapon slashes 46px through the horizontal plane.
      // follow: deep skidding lunge with torso low over the lead knee and the weapon trailing past the cut.
      return {
        windup: mk(base, { hip: [-6.5, 3], spine: [-7.5, 2], chest: [-9, 2.5], head: [-7, 2], elbowF: [-14, 0], handF: [-20, -2], elbowB: [-11, 1], handB: [-16, 0], kneeF: [-2, 2.5], footF: [-6, 0], kneeB: [-5, 3], footB: [-9, 0] }, { wa: katana ? 2.85 : -2.7, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [9.5, 2], spine: [13, 0.5], chest: [16.5, -0.5], head: [14.5, 0], elbowF: [16, -3], handF: [26, -4], elbowB: [-8, 0], handB: [-16, 2], kneeF: [13, 1.5], footF: [19, 0], kneeB: [-8, 3], footB: [-16, 0] }, { wa: scythe ? 0.68 : 0.06, wr: 12, smear: 2.2, sheathed: false }, weaponType),
        follow: mk(base, { hip: [10, 3], spine: [13.5, 1.5], chest: [17, 1], head: [15, 1], elbowF: [13, 0], handF: [21, 2], elbowB: [-9, 1], handB: [-17, 4], kneeF: [13.5, 2.5], footF: [19, 0], kneeB: [-8, 3.5], footB: [-16, 0] }, { wa: 0.32, wr: 7, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'uspecial':
      // windup: deep launch crouch — hips drop +7px down, knees bend sharply, weapon hand winds low (+16px y) beside the rear calf.
      // strike: rising dragon leap — hips and chest surge 14px upward with the lead knee driving high BEFORE the weapon pierces 52px skyward.
      // follow: airborne vertical extension with the weapon arm held high above the head and the rear leg trailing straight down.
      return {
        windup: mk(base, { hip: [-3, 7], spine: [-2, 6], chest: [-1.5, 7], head: [0, 5.5], elbowF: [-7, 9], handF: [-11, 16], elbowB: [-5, 7], handB: [-9, 13], kneeF: [5, 5], footF: [1, 0], kneeB: [-4, 5], footB: [-5, 0] }, { wa: katana ? 2.6 : 1.5, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [3, -7], spine: [4.5, -9.5], chest: [6, -10.5], head: [5, -9], elbowF: [8, -21], handF: [8, -35], elbowB: [-6, -10], handB: [-12, -14], kneeF: [10, -10], footF: [6, -15], kneeB: [-5, 1], footB: [-9, 4] }, { wa: -Math.PI * 0.44, wr: 12, smear: 2.3, sheathed: false }, weaponType),
        follow: mk(base, { hip: [2.5, -5], spine: [3.5, -7], chest: [4.5, -8], head: [4, -7], elbowF: [4, -19], handF: [2, -31], elbowB: [-6, -8], handB: [-11, -11], kneeF: [8, -7], footF: [5, -11], kneeB: [-4, 1], footB: [-7, 3] }, { wa: -Math.PI * 0.55, wr: 8, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'dspecial':
      // windup: high focus coil — hips pull back 3px and chest lifts while the weapon is raised high behind the crown (-12px x, -22px y).
      // strike: hips slam +8.5px down into a grounded stance first, then the chest and weapon hand crash 44px downward into the floor.
      // follow: low braced kneel with the weapon anchored toward the ground and the off-hand swept back in counterpoise.
      return {
        windup: mk(base, { hip: [-3, -2], spine: [-2.5, -4], chest: [-2, -5.5], head: [-1, -4.5], elbowF: [-8, -14], handF: [-12, -22], elbowB: [-7, -10], handB: [-11, -16], kneeF: [3, -2], footF: [0, -4], kneeB: [-3, 0], footB: [-4, 0] }, { wa: katana ? 2.75 : -2.05, sheathed: katana }, weaponType),
        strike: mk(base, { hip: [3.5, 8.5], spine: [6.5, 6.5], chest: [9.5, 5.5], head: [8.5, 5], elbowF: [11, 7], handF: [17, 15], elbowB: [-9, 2], handB: [-16, 5], kneeF: [11, 4.5], footF: [16, 0], kneeB: [-8, 5.5], footB: [-14, 0] }, { wa: 0.72, wr: 10, smear: 2.0, sheathed: false }, weaponType),
        follow: mk(base, { hip: [4, 9], spine: [7, 7], chest: [9.5, 6], head: [8.5, 5.5], elbowF: [9, 8], handF: [14, 17], elbowB: [-9, 3], handB: [-15, 7], kneeF: [11, 5], footF: [16, 0], kneeB: [-8, 6], footB: [-14, 0] }, { wa: 0.85, wr: 6, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    case 'kuro_suspend_dunk':
      // windup: suspended zero-gravity coil — hips and chest arch high (-6px y), knees tuck tight, dagger cocks high behind the head (-14px x, -23px y).
      // strike: guillotine dive — hips and chest whip diagonally down-forward (+9px x, +9px y) BEFORE the blade cleaves 50px down through the target.
      // follow: low landing follow-through with torso pitched forward and the reversed blade swept past the front ankle.
      return {
        windup: mk(base, { hip: [-4, -6], spine: [-3.5, -7.5], chest: [-3, -8.5], head: [-1.5, -7], elbowF: [-9, -15], handF: [-14, -23], elbowB: [-7, -11], handB: [-12, -17], kneeF: [7, -8], footF: [1, -12], kneeB: [-4, -6], footB: [-8, -10] }, { wa: -2.1, wr: 3 }, weaponType),
        strike: mk(base, { hip: [5, 3], spine: [8, 3.5], chest: [11, 4], head: [10, 3.5], elbowF: [12, 8], handF: [18, 16], elbowB: [-8, -5], handB: [-15, -9], kneeF: [9, 2], footF: [13, 0], kneeB: [-7, 0], footB: [-13, -3] }, { wa: 0.88, wr: 10, smear: 2.4 }, weaponType),
        follow: mk(base, { hip: [5.5, 4.5], spine: [8.5, 5], chest: [11, 5.5], head: [10, 5], elbowF: [9, 10], handF: [14, 18], elbowB: [-8, -3], handB: [-14, -6], kneeF: [9.5, 3], footF: [13, 0], kneeB: [-7, 2], footB: [-12, 0] }, { wa: 1.05, wr: 6 }, weaponType),
        style: heavyStyle,
      };
    case 'kenji_counter_slash':
      // windup: serene iaido counter coil — hips and chest sink back (-5 -> -7px) with right hand on the hilt at the left hip (-19px x, sheathed).
      // strike: lightning Battōjutsu — hips and chest surge 15px -> 24px forward first, whipping the unsheathed katana 46px across in a wide arc.
      // follow: classic zanshin finish — low wide lunge held dead-still while the blade tip settles horizontally past the cut.
      return {
        windup: mk(base, { hip: [-5, 2], spine: [-6, 1.5], chest: [-7, 1.5], head: [-5, 1], elbowF: [-13, 2], handF: [-19, 3], elbowB: [-11, 2], handB: [-16, 4], kneeF: [-1, 2], footF: [-4, 0], kneeB: [-4, 2.5], footB: [-7, 0] }, { wa: 2.85, sheathed: true }, weaponType),
        strike: mk(base, { hip: [10, 2], spine: [13.5, 0.5], chest: [17, -0.5], head: [15, 0], elbowF: [17, -3.5], handF: [27, -5], elbowB: [13, -2], handB: [24, -3.5], kneeF: [14, 1.5], footF: [20, 0], kneeB: [-8, 3], footB: [-16, 0] }, { wa: 0.04, wr: 13, smear: 2.5, sheathed: false }, weaponType),
        follow: mk(base, { hip: [10.5, 2.5], spine: [14, 1], chest: [17.5, 0.5], head: [15.5, 0.5], elbowF: [15, -1.5], handF: [24, -2], elbowB: [11, 0], handB: [21, -0.5], kneeF: [14, 2], footF: [20, 0], kneeB: [-8, 3.5], footB: [-16, 0] }, { wa: 0.18, wr: 9, sheathed: false }, weaponType),
        style: heavyStyle,
      };
    default:
      return null;
  }
}

