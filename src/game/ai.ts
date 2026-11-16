import { createDefaultRng, RngFn } from './rng';
import { AIDifficulty, FighterState, GameMode, InputState, StageSpec, TrainingBehavior } from './types';

function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    shortHop: false,
    light: false,
    strong: false,
    special: false,
    dash: false,
    taunt: false,
    ultimate: false,
  };
}

export class AIController {
  private cooldown = 0;
  private holdJump = 0;
  private holdStrong = 0;
  private strafeDir: -1 | 0 | 1 = 0;
  private strafeTimer = 0;
  private rng: RngFn;

  constructor(rng: RngFn = createDefaultRng()) {
    this.rng = rng;
  }

  public setRng(rng: RngFn): void {
    this.rng = rng;
  }

  public computeInput(
    self: FighterState,
    target: FighterState,
    stage: StageSpec,
    mode: GameMode,
    difficulty: AIDifficulty,
    trainingBehavior: TrainingBehavior,
    tick: number
  ): InputState {
    const inp = emptyInput();

    if (this.holdJump > 0) {
      this.holdJump--;
      inp.jump = true;
    }

    if (self.action === 'strong_charge' && this.holdStrong > 0) {
      this.holdStrong--;
      inp.strong = true;
      return inp;
    }

    if (mode === 'training') {
      return this.computeTrainingInput(self, target, stage, trainingBehavior, tick, inp);
    }

    // Off-stage / Chasm recovery priority (navigates around solid ledges—never tries to phase through from below!)
    const mainPlats = stage.platforms.filter((p) => p.isMain);
    const overAnyMain = mainPlats.some(
      (p) => self.x >= p.x - p.width * 0.5 + 8 && self.x <= p.x + p.width * 0.5 - 8
    );
    const floorY = mainPlats[0]?.y ?? 124;

    if ((!overAnyMain || self.y > floorY + 12) && !self.grounded) {
      let nearestIsland = mainPlats[0];
      let bestDist = Infinity;
      for (const mp of mainPlats) {
        const d = Math.abs(self.x - mp.x);
        if (d < bestDist) {
          bestDist = d;
          nearestIsland = mp;
        }
      }
      if (nearestIsland) {
        const iLeft = nearestIsland.x - nearestIsland.width * 0.5;
        const iRight = nearestIsland.x + nearestIsland.width * 0.5;
        // If below the platform deck, steer slightly outside the ledge first so we don't bonk our head underneath!
        if (self.y > floorY - 6 && self.x > iLeft - 6 && self.x < iRight + 6) {
          const toLeftEdge = Math.abs(self.x - iLeft);
          const toRightEdge = Math.abs(self.x - iRight);
          if (toLeftEdge < toRightEdge) inp.left = true;
          else inp.right = true;
        } else {
          if (self.x < nearestIsland.x - 10) inp.right = true;
          else if (self.x > nearestIsland.x + 10) inp.left = true;
        }
      }

      if (self.y > floorY - 14 && self.jumpsLeft > 0 && tick % 5 === 0) {
        inp.jump = true;
        this.holdJump = 6;
        return inp;
      }
      if (self.y > floorY + 2 && self.action !== 'attack') {
        inp.up = true;
        inp.special = true;
        return inp;
      }
      return inp;
    }

    // Jump across split-island chasms or 3-car train gaps when running toward opponent
    if (mainPlats.length > 1 && self.grounded) {
      for (const mp of mainPlats) {
        const iLeft = mp.x - mp.width * 0.5;
        const iRight = mp.x + mp.width * 0.5;
        if (self.x >= iLeft && self.x <= iRight) {
          const nearLeftEdge = self.x - iLeft < 28 && target.x < iLeft;
          const nearRightEdge = iRight - self.x < 28 && target.x > iRight;
          if (nearLeftEdge || nearRightEdge) {
            inp.jump = true;
            this.holdJump = 7;
            break;
          }
        }
      }
    }

    // Special state: Kuro suspended mid-air -> execute Dunk!
    if (self.action === 'kuro_suspend' && self.suspendTimer < 22) {
      inp.light = true;
      return inp;
    }

    // Cheeky AI Taunt when target was just KO'd and is respawning!
    if (
      target.action === 'ko_respawn' &&
      target.actionFrame === 10 &&
      self.grounded &&
      self.action === 'idle' &&
      this.rng() < 0.65
    ) {
      inp.taunt = true;
      return inp;
    }

    // Evasion Priority: Opponent is unleashing an UNBLOCKABLE Ultimate (`V`)!
    // During Act II (frames 73..132), time unfreezes so opponents can run, dash, or jump out of the rush!
    if (target.action === 'ultimate' && target.actionFrame >= 73 && target.actionFrame <= 132) {
      const evadeSkill = difficulty === 'boss' ? 0.85 : difficulty === 'normal' ? 0.5 : 0.2;
      if (this.rng() < evadeSkill) {
        // Run/dash away from the caster's rush zone or jump high over the sprint
        const dangerCenterX = target.anchorX;
        const fleeDir: -1 | 1 = self.x < dangerCenterX ? -1 : 1;
        if (fleeDir < 0) inp.left = true;
        else inp.right = true;
        if (tick % 8 === 0) inp.dash = true;
        if (self.grounded && Math.abs(self.x - dangerCenterX) < 130 && tick % 10 === 0) {
          inp.jump = true;
          this.holdJump = 8;
        }
        return inp;
      }
    }

    // Difficulty tuning
    const reactEvery = difficulty === 'easy' ? 16 : difficulty === 'normal' ? 7 : 3;
    const aggression = difficulty === 'easy' ? 0.32 : difficulty === 'normal' ? 0.65 : 0.9;
    const specialChance = difficulty === 'easy' ? 0.14 : difficulty === 'normal' ? 0.34 : 0.52;

    if (this.cooldown > 0) this.cooldown--;
    if (this.strafeTimer > 0) this.strafeTimer--;

    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const absDx = Math.abs(dx);
    const dirToTarget: -1 | 1 = dx >= 0 ? 1 : -1;

    // Movement toward or spacing around target
    if (absDx > 52) {
      if (dirToTarget > 0) inp.right = true;
      else inp.left = true;
      if (absDx > 165 && difficulty !== 'easy' && tick % 24 === 0) {
        inp.dash = true;
      }
    } else if (absDx < 22 && this.strafeTimer <= 0) {
      this.strafeDir = this.rng() < 0.5 ? (-dirToTarget as -1 | 1) : dirToTarget;
      this.strafeTimer = 14;
    }

    if (this.strafeTimer > 0) {
      if (this.strafeDir < 0) inp.left = true;
      else if (this.strafeDir > 0) inp.right = true;
    }

    // Chase aerial opponents
    if (dy < -42 && self.grounded && tick % reactEvery === 0) {
      inp.jump = true;
      this.holdJump = 6;
    }

    if (this.cooldown > 0 || tick % reactEvery !== 0) {
      return inp;
    }

    // Unleash AI Ultimate (`V`) when gauge is 100% and target is within strike range!
    if (
      self.ultimateGauge >= 100 &&
      absDx >= 35 &&
      absDx <= 185 &&
      Math.abs(dy) < 55 &&
      target.action !== 'ko_respawn' &&
      this.rng() < (difficulty === 'boss' ? 0.65 : difficulty === 'normal' ? 0.38 : 0.18)
    ) {
      if (dirToTarget > 0) inp.right = true;
      else inp.left = true;
      inp.ultimate = true;
      this.cooldown = 45;
      return inp;
    }

    // Defensive / Counter reactions (Kenji Haki or Dash/Parry)
    const targetAttacking =
      target.action === 'attack' || target.action === 'strong_charge';
    if (targetAttacking && absDx < 78 && Math.abs(dy) < 48) {
      if (self.id === 'kenji' && this.rng() < (difficulty === 'boss' ? 0.72 : difficulty === 'normal' ? 0.42 : 0.12)) {
        inp.special = true; // Neutral J = Observation Haki!
        this.cooldown = 28;
        return inp;
      }
      if (difficulty !== 'easy' && this.rng() < 0.35) {
        inp.dash = true;
        if (dirToTarget > 0) inp.left = true;
        else inp.right = true;
        this.cooldown = 16;
        return inp;
      }
    }

    if (this.rng() > aggression) {
      this.cooldown = 10;
      return inp;
    }

    // Character-specific smart specials
    if (this.rng() < specialChance) {
      if (self.id === 'kuro') {
        if (absDx > 95 && absDx < 260) {
          // Neutral Special: Blink behind & suspend!
          inp.left = false;
          inp.right = false;
          inp.up = false;
          inp.down = false;
          inp.special = true;
          this.cooldown = 36;
          return inp;
        } else if (absDx >= 55 && absDx <= 115 && Math.abs(dy) < 30) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Shadow Sever
          this.cooldown = 24;
          return inp;
        }
      } else if (self.id === 'velo') {
        if (self.gauge >= 45 && self.overdriveTimer <= 0) {
          inp.left = false;
          inp.right = false;
          inp.special = true; // Trigger Overdrive!
          this.cooldown = 25;
          return inp;
        } else if (absDx > 55 && absDx < 160 && Math.abs(dy) < 35) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Mach Judgment
          this.cooldown = 24;
          return inp;
        }
      } else if (self.id === 'kenji') {
        if (absDx > 60 && absDx < 150 && Math.abs(dy) < 30) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Iaido Crimson Draw
          this.cooldown = 26;
          return inp;
        }
      } else if (self.id === 'bram') {
        if (absDx > 90 && absDx < 210 && Math.abs(dy) < 40) {
          inp.left = false;
          inp.right = false;
          inp.special = true; // Singularity Pull!
          this.cooldown = 28;
          return inp;
        } else if (absDx > 50 && absDx < 120) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Comet Tackle
          this.cooldown = 28;
          return inp;
        }
      } else if (self.id === 'raijin') {
        if (absDx > 85 && absDx < 190) {
          inp.left = false;
          inp.right = false;
          inp.special = true; // Plant Thunder Spire or Chain-Detonate!
          this.cooldown = 26;
          return inp;
        } else if (absDx < 55) {
          inp.down = true;
          inp.special = true; // Heavens Judgment sky pillar!
          this.cooldown = 30;
          return inp;
        }
      } else if (self.id === 'chrono') {
        if (absDx > 65 && absDx < 160 && Math.abs(dy) < 35) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Stasis Bubble!
          this.cooldown = 32;
          return inp;
        } else if (absDx < 65) {
          inp.down = true;
          inp.special = true; // XII Bell Judgment!
          this.cooldown = 28;
          return inp;
        }
      } else if (self.id === 'sol') {
        if (target.cinderMarks >= 2) {
          inp.left = false;
          inp.right = false;
          inp.special = true; // Supernova Detonation!
          this.cooldown = 26;
          return inp;
        } else if (absDx > 70 && absDx < 165 && Math.abs(dy) < 30) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Molten Grapple Whip!
          this.cooldown = 26;
          return inp;
        }
      } else if (self.id === 'nyx') {
        if (absDx > 90 && absDx < 220) {
          if (this.rng() < 0.5) {
            if (dirToTarget > 0) inp.right = true;
            else inp.left = true;
            inp.special = true; // Wormhole Gate!
          } else {
            inp.left = false;
            inp.right = false;
            inp.special = true; // Prism Barrage!
          }
          this.cooldown = 25;
          return inp;
        } else if (absDx < 120 && this.rng() < 0.35) {
          inp.down = true;
          inp.special = true; // Spatial Inversion!
          this.cooldown = 32;
          return inp;
        }
      } else if (self.id === 'jin') {
        if (!self.puppetActive || absDx > 95) {
          inp.left = false;
          inp.right = false;
          inp.special = true; // Deploy Karasu Puppet!
          this.cooldown = 24;
          return inp;
        } else if (absDx > 50 && absDx < 140) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
          inp.special = true; // Razor Thread Cross!
          this.cooldown = 26;
          return inp;
        }
      }
    }

    // Close-range melee mixups
    if (absDx < 62 && Math.abs(dy) < 48) {
      const r = this.rng();
      if (!self.grounded) {
        if (dy > 18) inp.down = true;
        else if (dy < -16) inp.up = true;
        else if ((dirToTarget > 0 && self.facing > 0) || (dirToTarget < 0 && self.facing < 0)) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
        }
        inp.light = true;
        this.cooldown = 14;
      } else if (target.damagePercent > 75 || (target.hp < 320 && r < 0.45)) {
        // Go for Strong finisher!
        if (dy < -18) inp.up = true;
        else if (r < 0.3) inp.down = true;
        else if (dirToTarget > 0) inp.right = true;
        else inp.left = true;
        inp.strong = true;
        this.holdStrong = difficulty === 'boss' ? 8 : 14;
        this.cooldown = 28;
      } else {
        // Light combo / tilt
        if (dy < -20) inp.up = true;
        else if (r < 0.25) inp.down = true;
        else if (r < 0.65) {
          if (dirToTarget > 0) inp.right = true;
          else inp.left = true;
        } else {
          inp.left = false;
          inp.right = false;
        }
        inp.light = true;
        this.cooldown = difficulty === 'boss' ? 8 : 13;
      }
    }

    return inp;
  }

  private computeTrainingInput(
    self: FighterState,
    target: FighterState,
    stage: StageSpec,
    behavior: TrainingBehavior,
    tick: number,
    inp: InputState
  ): InputState {
    const mainPlat = stage.platforms[0];
    const halfW = mainPlat.width * 0.5;

    // Recover back to center if knocked off stage (in recover or counter/attack/guard)
    if (behavior !== 'idle') {
      if ((self.x < mainPlat.x - halfW + 15 || self.x > mainPlat.x + halfW - 15) && !self.grounded) {
        if (self.x < 0) inp.right = true;
        else inp.left = true;
        if (self.jumpsLeft > 0 && tick % 8 === 0) {
          inp.jump = true;
          this.holdJump = 5;
        } else if (self.y > mainPlat.y) {
          inp.up = true;
          inp.special = true;
        }
        return inp;
      }
    }

    if (behavior === 'idle') return inp;

    if (behavior === 'recover') {
      if (Math.abs(self.x - 110) > 28 && self.grounded) {
        if (self.x < 110) inp.right = true;
        else inp.left = true;
      }
      return inp;
    }

    const dx = target.x - self.x;
    const absDx = Math.abs(dx);

    if (behavior === 'guard') {
      if (target.action === 'attack' && absDx < 75 && self.parryCooldown <= 0) {
        inp.dash = true; // Triggers parry / evade
      }
      return inp;
    }

    if (behavior === 'counter') {
      if (target.action === 'attack' && absDx < 90 && tick % 4 === 0) {
        if (self.id === 'kenji') {
          inp.special = true;
        } else {
          inp.light = true;
        }
      }
      return inp;
    }

    if (behavior === 'attack') {
      if (absDx > 55) {
        if (dx > 0) inp.right = true;
        else inp.left = true;
      } else if (tick % 36 === 0) {
        if (dx > 0) inp.right = true;
        else inp.left = true;
        inp.light = true;
      } else if (tick % 90 === 0) {
        if (dx > 0) inp.right = true;
        else inp.left = true;
        inp.strong = true;
      }
      return inp;
    }

    return inp;
  }
}
