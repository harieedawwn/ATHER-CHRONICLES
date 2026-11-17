# SKILL: Fluid fighter animation (poseKit)

Code: `src/game/poseKit.ts` (already integrated in `renderer.ts`: `blendPose` uses `blendPoseArc`, attacks use `sampleAttack`, attack smoothing is disabled). Per-move pose data: `src/game/movePoses.ts`. Review tool: `npm run dev` then `/?anim=<moveKey>&fighter=<id>` (12-frame strip).

## Why the old animation was bad
Plain lerp of joint x,y: hands cut straight lines, limbs shrink/stretch, 2-3 frame startup had no anticipation, and a global smoothing pass mushed the snap.

## What the kit does
- `blendPoseArc`: arms/legs blend by angle + bone length -> arcs, no random stretching.
- `sampleAttack`: coil (anticipation) -> accelerating whip -> overshoot -> hold -> settle -> return. Full extension 1 frame into `active`.
- `locomotionPose`: walk/run cycle. `hitShake`: shake during hit-stop. `ease.*`: easing set.
Tuning: `anticipation` 0.1-0.3, `overshoot` 0.04-0.12, whip exponent in `sampleAttack` (1.3).

## How to author a move (do this every time)
1. Write a 3-line plan as a comment: what the body does in windup / strike / follow, and WHAT LEADS (hips and chest first, hand last).
2. Windup pulls the OPPOSITE way of the strike. Hand/foot travel windup -> strike >= 20px, otherwise the move looks timid.
3. Strike = the single farthest extension of the move. Follow = relaxed, past the strike, weight shifted.
4. Hips/chest shift 3-5px BEFORE the hand. Head stays roughly level (eyes on target).
5. Style per weight: light (jab/tilt) anticipation 0.15 / overshoot 0.06; heavy (strong/smash) 0.30 / 0.12; aerials 0.2 / 0.08.
6. Every move must read differently from its neighbours. Never paste the same pose into two moves.

## Weapon language (keep identity)
katana (kenji): long clean arcs, wrists lead, sheathe-snap recovery. dagger (kuro): short, low, fast, reverse grip, tiny anticipation, big hip twist. gauntlet (velo): bouncy stance, snappy straight punches, quick recovery. titan (bram): slow heavy coil (anticipation 0.35), big overshoot, long recovery, body mass shifts. spear (raijin): thrust along a line, back hand drives, long reach. scythe (chrono): wide circular sweeps, trail lags the hand. chains (sol): whip with delay, wave travels hand -> tip. orbs (nyx): hands conduct, orbs follow with lag. claws (jin): rapid alternating slashes, hunched stance.

## Rules
- Animation only: never change hitboxes, frame data, physics, AI, stats.
- After every batch of moves: `npm run typecheck`, `npm run build`, regression (`npx tsx scripts/regression.ts`) must stay green.
- Judge in the `?anim=` strip. If you cannot see it, say "not visually verified".
- Max 3 fix rounds per problem, then report the exact failure.
