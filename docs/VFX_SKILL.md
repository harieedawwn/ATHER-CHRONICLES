# SKILL: Combat VFX that do NOT look like "basic shapes"

READ THIS BEFORE WRITING OR CHANGING ANY EFFECT. Toolbox: `src/game/vfxKit.ts` (already integrated, see "Already wired"). Review tool: `npm run dev` then open `/?vfx=impact-heavy` (also `impact-light`, `impact-ground`, `slash`, `trail`, `ink`; add `&color=%23fb923c` to test a palette).

## 1. What "slop" is (and what to do instead)
Slop = one flat layer, one colour, constant alpha, linear motion, appears instantly, vanishes instantly (a stroked circle, a 1px line, a fixed crescent, a coloured square).
A real effect has ALL of these:
1. **3 layers minimum**: white-hot core, coloured body, soft glow. Never a single fill.
2. **Additive blending** (`globalCompositeOperation = 'lighter'`) for energy/light/fire/lightning. Normal blending only for ink, debris, smoke.
3. **Colour and alpha change over life** (ramp): white -> accent -> deep accent -> transparent. Use `energyRamp(accent)`.
4. **Shape follows motion**: streaks stretch along velocity and taper to a point; trails taper to zero at the tail. No uniform-width lines.
5. **Eased motion**: fast attack, slow decay (`easeOutExpo`, `outCubic`). Never linear lerp for size/radius/alpha.
6. **A timeline**, not a spawn: flash on frame 0, lines frames 0-3, burst 0-8, ring 1-14, embers 2-20. Impact frame / hit-stop on heavy hits.
7. **Scale for the screen**: canvas is 800x450 and a fighter is ~45px tall. A light hit effect is 20-40px across, a heavy hit 60-110px. If it covers the fighter's face for more than 3 frames it is too big.

## 2. Toolbox (src/game/vfxKit.ts)
| Need | Use |
|---|---|
| Sword/limb/weapon swing trail that follows the REAL path | `Trail` (push tip each tick while attack is dangerous, `step()` every tick, `draw()` each frame) |
| Slash arc already stored as {angleStart, angleEnd, radius} | `drawArcSweep(ctx, arc, progress)` (head sweeps, tail fades) |
| Hit impact (flash + speed lines + shards + ring + embers) | `Fx.impact({x,y,dir,power,color,ground})`, then `fx.update()` each tick, `fx.draw(ctx)` each frame |
| Single spark / streak | `drawStreak` |
| Star flare | `drawStarFlare` |
| Shockwave ring | `drawShockRing` (filled annulus; `squash` 0.35 for ground) |
| Many particles without GC lag | `ParticlePool.emit/update/draw` (pooled, max 640) |
| Glow | `drawGlow` / `glowSprite` (cached sprite). NEVER `shadowBlur` in loops (slow on phones and Zalo) |
| Heavy-hit screen punch | `drawImpactFrame` (1-2 frames), `ChromaticSplit.apply` (<=6 frames), `CameraKick`, `slowMoScale` |
| Ink theme (INKBLITZ) | `drawInkSplat`, ink-kind particles |
| Colour tools | `hexToRgb`, `mixRgb`, `rgba`, `energyRamp`, `sampleRamp` |

## 3. Recipes (copy the numbers, then tune by eye in the viewer)
**Light hit (jab, tilt)**: power 0.2-0.35. f0 small flash (r 14-20) + 8-10 radial lines; f0-8 6-9 shards forward (speed 5-9) + 3-4 backsplash streaks; ring maxR ~25, 12 frames. Hit-stop 2-3 frames. Camera kick power 0.1.
**Heavy hit (smash, strong)**: power 0.8-1.0. f0 big flash (r 35-45) + 1-2 frame impact frame invert; 18-20 lines; 16-20 shards (speed 10-20) + embers with gravity; 2 rings (second one white, delayed 2 frames); hit-stop 6-9 frames; camera kick 0.7 along hit direction; `slowMoScale` on kill/launch.
**Weapon trail**: tip position per tick -> `Trail(12-16 points, maxAge 9-10)`. Width: jab 9-12, tilt 14-16, heavy 22-26. Draw BEHIND the weapon sprite, additive. Dagger: thin (6-9), fast fade (maxAge 6). Titan: wide + short dust sparks at the tail. Chains/scythe: longer trail (maxAge 14) because the weapon lags.
**Dash / run**: afterimages tinted with accent at alpha 0.35 -> 0 over 8 frames, additive; 3-5 horizontal streaks behind feet; dust puffs (normal blend, grey, gravity 0.05) on start and stop; NO ring.
**Land / ground slam**: dust ring as flattened ellipse (`ground:true`), 6-10 debris with gravity + bounce, 1 dust column going up, camera kick 0.3-0.8 downward.
**Projectile**: core (white) + body (accent) + `Trail` behind it + muzzle flash on spawn (small `Fx.impact` power 0.2 backwards) + impact `Fx.impact` where it dies.
**Charge-up**: particles spawn on a ring and move INWARD with accelerating speed; glow pulses (sin) and grows; a thin ring contracts; on release do the heavy-hit stack outward.
**Teleport / blink**: old spot: radial lines + contracting ring + afterimage. New spot: flash + expanding ring + 6 streaks outward. 2-frame gap between the two.
**Ultimate / KO**: impact frame (2f) -> hit-stop -> `ChromaticSplit` 4-6px for 4-6f -> slow-mo ramp (`slowMoScale`) -> radial speed lines -> vignette pulse -> ink splat on background for ink characters.

## 4. Character colour rules
- Each fighter has `accentColor` (kenji red, kuro purple, velo cyan, bram green, sol orange, jin violet, nyx pink, raijin blue, chrono teal). Use it for the body layer. Core is always near-white. Deep layer is the accent mixed toward dark navy (`energyRamp` does this).
- Add ONE contrasting accent per effect at most (e.g. yellow sparks on a red blade). Never rainbow.
- Dark/ink effects (Kuro, Nyx): use normal blending for the dark mass first, then a thin additive rim light on top.

## 5. Already wired in the renderer (study these as the pattern)
- `drawSlashArc` -> `drawArcSweep`
- `drawShockwave` -> `drawShockRing`
- `drawParticle` spark -> `drawStreak`, flare -> `drawStarFlare`
Spawners in `src/game/engine/vfxSpawners.ts` still create the old data; only the DRAW changed, so gameplay is untouched.

## 6. Next integration tasks (do in this order, check after each)
1. **Weapon-tip trails per fighter**: renderer keeps `Map<fighterIndex, Trail>`. In `drawFighter`, when the pose has `smearAlpha > 0.15`, push the weapon tip (find how `drawMasterworkWeapon` derives the tip from `handF`, `weaponAngle`, `weaponReach`, `facing` and reuse that exact formula), always `step()`, draw with the move's width/colour. Clear on respawn.
2. **Hit impacts**: add a visual-only queue (for example `ctx.vfxEvents`) filled from `hitApplication.ts` where `spawnHitSparks` is called; the renderer owns one `Fx` and consumes the queue. The queue must NOT be part of simulation state/hash.
3. **Heavy-hit screen punch**: impact frame + chromatic split + camera kick, only when `power > 0.75`, never on every hit.
4. Dash/land/projectile/ultimate recipes from section 3.

## 7. Hard rules
- VFX code must never use `src/game/rng.ts`, never mutate fighters/hitboxes/frame data, never read the clock for gameplay. Use `vrand/vrange/seedVisualRng` from vfxKit.
- `npx tsx scripts/regression.ts` (or `npm test` if bun exists) must still print all scenarios matching the golden file. If it fails, you changed gameplay: revert that part.
- Performance: no per-frame allocation in hot loops except short-lived small objects; cap particles; no `shadowBlur`; `ChromaticSplit` only for a few frames.
- Mobile: must stay smooth on a mid phone and inside Zalo/Facebook in-app browsers.

## 8. Self-review before you report (answer honestly in your report)
For every effect you touched, tick:
[ ] >=3 layers (core/body/glow)  [ ] additive where it is light  [ ] colour ramp over life  [ ] stretched/tapered, not uniform  [ ] eased  [ ] has a frame timeline  [ ] right size for 45px fighters  [ ] looked at it in `?vfx=` at frames 0,1,2,4,7,11,16,22  [ ] regression green.
If you could not look at it, write "not visually verified". Do not say "looks great" without looking.
