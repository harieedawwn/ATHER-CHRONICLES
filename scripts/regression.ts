// Deterministic headless regression test & golden-snapshot verifier for ZANSHIN engine.
// Exports: none (CLI script). Depends on: node:crypto, node:fs, node:path, ../src/game/engine, ../src/game/rng, ../src/game/types.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameEngine } from '@/game/engine';
import { createSeededRng } from '@/game/rng';
import {
  AIDifficulty,
  FighterId,
  FighterState,
  GameMode,
  InputState,
  MatchConfig,
  Ruleset,
  StageId,
  TrainingBehavior,
} from '@/game/types';

interface FighterSnapshot {
  id: FighterId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  onPlatform: boolean;
  jumpsLeft: number;
  airDashAvailable: boolean;
  action: string;
  actionFrame: number;
  moveKey: string | null;
  hitstunFrames: number;
  hitstopFrames: number;
  invulnFrames: number;
  damagePercent: number;
  hp: number;
  stocks: number;
  comboCountReceived: number;
  maxComboDealt: number;
  totalDamageDealt: number;
  countersLanded: number;
  specialsLanded: number;
  gauge: number;
  ultimateGauge: number;
  overdriveTimer: number;
  suspendTimer: number;
  anchorActive: boolean;
  hakiTimer: number;
  armorStacks: number;
  cinderMarks: number;
  stasisSlowTimer: number;
  puppetActive: boolean;
  ultPose: string;
}

interface FrameRecord {
  frame: number;
  tick: number;
  winnerSlot: 0 | 1 | 'draw' | null;
  p1: FighterSnapshot;
  p2: FighterSnapshot;
}

interface ScenarioResult {
  name: string;
  config: MatchConfig;
  frames: number;
  stateHash: string;
  checkpoints: FrameRecord[];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function snapshotFighter(f: FighterState): FighterSnapshot {
  return {
    id: f.id,
    x: round4(f.x),
    y: round4(f.y),
    z: round4(f.z ?? 0),
    vx: round4(f.vx),
    vy: round4(f.vy),
    facing: f.facing,
    grounded: f.grounded,
    onPlatform: f.onPlatform,
    jumpsLeft: f.jumpsLeft,
    airDashAvailable: f.airDashAvailable,
    action: f.action,
    actionFrame: f.actionFrame,
    moveKey: f.currentMove?.key ?? null,
    hitstunFrames: f.hitstunFrames,
    hitstopFrames: f.hitstopFrames,
    invulnFrames: f.invulnFrames,
    damagePercent: round4(f.damagePercent),
    hp: round4(f.hp),
    stocks: f.stocks,
    comboCountReceived: f.comboCountReceived,
    maxComboDealt: f.maxComboDealt,
    totalDamageDealt: round4(f.totalDamageDealt),
    countersLanded: f.countersLanded,
    specialsLanded: f.specialsLanded,
    gauge: round4(f.gauge),
    ultimateGauge: round4(f.ultimateGauge),
    overdriveTimer: f.overdriveTimer,
    suspendTimer: f.suspendTimer,
    anchorActive: f.anchorActive,
    hakiTimer: f.hakiTimer,
    armorStacks: f.armorStacks,
    cinderMarks: f.cinderMarks,
    stasisSlowTimer: f.stasisSlowTimer,
    puppetActive: f.puppetActive,
    ultPose: f.ultPose ?? 'none',
  };
}

function scriptedP1Input(
  frame: number,
  p1: FighterState,
  p2: FighterState
): InputState {
  const dx = p2.x - p1.x;
  const dirToFoe: -1 | 1 = dx >= 0 ? 1 : -1;
  const absDx = Math.abs(dx);
  const inp: InputState = {
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

  // Periodically test taunt, parry, specials, strongs, aerials, and ultimate
  const cycle = frame % 240;

  // Trigger Ultimate when gauge is full and close enough
  if (p1.ultimateGauge >= 100 && absDx < 160 && cycle === 20) {
    if (dirToFoe > 0) inp.right = true;
    else inp.left = true;
    inp.ultimate = true;
    return inp;
  }

  // Approach opponent if far
  if (absDx > 48) {
    if (dirToFoe > 0) inp.right = true;
    else inp.left = true;
    if (cycle === 10 || cycle === 130) {
      inp.dash = true;
    }
  }

  // Execute scripted move rotation across the 240-frame cycle
  if (cycle === 30) {
    inp.taunt = true;
  } else if (cycle === 55) {
    // Neutral Special
    inp.left = false;
    inp.right = false;
    inp.special = true;
  } else if (cycle === 85) {
    // Side Special toward foe
    if (dirToFoe > 0) inp.right = true;
    else inp.left = true;
    inp.special = true;
  } else if (cycle === 115) {
    // Down Special
    inp.left = false;
    inp.right = false;
    inp.down = true;
    inp.special = true;
  } else if (cycle === 145) {
    // Up Special
    inp.up = true;
    inp.special = true;
  } else if (cycle >= 165 && cycle <= 178) {
    // Jab 1 -> 2 -> 3 combo
    inp.left = false;
    inp.right = false;
    inp.light = cycle % 4 === 0;
  } else if (cycle === 190) {
    // Short hop into aerial
    inp.shortHop = true;
  } else if (cycle === 198) {
    if (dirToFoe > 0) inp.right = true;
    else inp.left = true;
    inp.light = true;
  } else if (cycle >= 210 && cycle <= 218) {
    // Charged forward strong
    if (dirToFoe > 0) inp.right = true;
    else inp.left = true;
    inp.strong = true;
  } else if (cycle === 232) {
    // Standing Parry
    inp.left = false;
    inp.right = false;
    inp.dash = true;
  }

  return inp;
}

const SCENARIOS: Array<{
  name: string;
  seed: number;
  frames: number;
  trainingBehavior?: TrainingBehavior;
  config: MatchConfig;
}> = [
  {
    name: 'kuro_vs_velo_stock_easy_torii',
    seed: 1001,
    frames: 720,
    config: {
      mode: 'vs_ai' as GameMode,
      ruleset: 'stock' as Ruleset,
      p1Fighter: 'kuro',
      p2Fighter: 'velo',
      aiDifficulty: 'easy' as AIDifficulty,
      stageId: 'torii' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'kenji_vs_bram_hp_normal_dojo',
    seed: 2002,
    frames: 720,
    config: {
      mode: 'vs_ai' as GameMode,
      ruleset: 'hp' as Ruleset,
      p1Fighter: 'kenji',
      p2Fighter: 'bram',
      aiDifficulty: 'normal' as AIDifficulty,
      stageId: 'dojo' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'raijin_vs_chrono_stock_boss_monolith',
    seed: 3003,
    frames: 720,
    config: {
      mode: 'vs_ai' as GameMode,
      ruleset: 'stock' as Ruleset,
      p1Fighter: 'raijin',
      p2Fighter: 'chrono',
      aiDifficulty: 'boss' as AIDifficulty,
      stageId: 'monolith' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'sol_vs_nyx_hp_boss_tesseract',
    seed: 4004,
    frames: 720,
    config: {
      mode: 'vs_ai' as GameMode,
      ruleset: 'hp' as Ruleset,
      p1Fighter: 'sol',
      p2Fighter: 'nyx',
      aiDifficulty: 'boss' as AIDifficulty,
      stageId: 'tesseract' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'jin_vs_kuro_training_ult_train',
    seed: 5005,
    frames: 600,
    trainingBehavior: 'counter',
    config: {
      mode: 'training' as GameMode,
      ruleset: 'stock' as Ruleset,
      p1Fighter: 'jin',
      p2Fighter: 'kuro',
      aiDifficulty: 'normal' as AIDifficulty,
      stageId: 'train' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'velo_vs_sol_training_ult_coliseum',
    seed: 6006,
    frames: 600,
    trainingBehavior: 'attack',
    config: {
      mode: 'training' as GameMode,
      ruleset: 'hp' as Ruleset,
      p1Fighter: 'velo',
      p2Fighter: 'sol',
      aiDifficulty: 'normal' as AIDifficulty,
      stageId: 'coliseum' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'kenji_vs_chrono_training_ult_void_flat',
    seed: 7007,
    frames: 600,
    trainingBehavior: 'guard',
    config: {
      mode: 'training' as GameMode,
      ruleset: 'stock' as Ruleset,
      p1Fighter: 'kenji',
      p2Fighter: 'chrono',
      aiDifficulty: 'boss' as AIDifficulty,
      stageId: 'void_flat' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'bram_vs_nyx_training_ult_hypercube',
    seed: 8008,
    frames: 600,
    trainingBehavior: 'recover',
    config: {
      mode: 'training' as GameMode,
      ruleset: 'hp' as Ruleset,
      p1Fighter: 'bram',
      p2Fighter: 'nyx',
      aiDifficulty: 'easy' as AIDifficulty,
      stageId: 'hypercube' as StageId,
      stocksCount: 3,
    },
  },
  {
    name: 'raijin_vs_jin_training_ult_torii',
    seed: 9009,
    frames: 600,
    trainingBehavior: 'idle',
    config: {
      mode: 'training' as GameMode,
      ruleset: 'stock' as Ruleset,
      p1Fighter: 'raijin',
      p2Fighter: 'jin',
      aiDifficulty: 'normal' as AIDifficulty,
      stageId: 'torii' as StageId,
      stocksCount: 3,
    },
  },
];

function runAllScenarios(): ScenarioResult[] {
  const results: ScenarioResult[] = [];

  for (const sc of SCENARIOS) {
    const rng = createSeededRng(sc.seed);
    const engine = new GameEngine(sc.config, () => {}, { rng });
    if (sc.trainingBehavior) {
      engine.setTrainingBehavior(sc.trainingBehavior);
    }

    const checkpoints: FrameRecord[] = [];
    for (let f = 1; f <= sc.frames; f++) {
      const [p1, p2] = engine.getFighters();
      const inp = scriptedP1Input(f, p1, p2);
      engine.stepHeadless(inp);

      if (f % 60 === 0 || f === sc.frames) {
        const [curP1, curP2] = engine.getFighters();
        checkpoints.push({
          frame: f,
          tick: engine.getTick(),
          winnerSlot: engine.getWinnerSlot(),
          p1: snapshotFighter(curP1),
          p2: snapshotFighter(curP2),
        });
      }
    }

    const hash = createHash('sha256')
      .update(JSON.stringify(checkpoints))
      .digest('hex');

    results.push({
      name: sc.name,
      config: sc.config,
      frames: sc.frames,
      stateHash: hash,
      checkpoints,
    });
  }

  return results;
}

const goldenPath = path.resolve(process.cwd(), 'scripts/golden-regression.json');
const isRecord = process.argv.includes('--record');

const results = runAllScenarios();

if (isRecord) {
  fs.writeFileSync(goldenPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Recorded ${results.length} golden scenario snapshots to ${goldenPath}`);
  for (const r of results) {
    console.log(`  [GOLDEN] ${r.name}: ${r.stateHash.slice(0, 16)}... (${r.frames} frames)`);
  }
  process.exit(0);
}

if (!fs.existsSync(goldenPath)) {
  console.error(`Golden file not found at ${goldenPath}. Run with --record first.`);
  process.exit(1);
}

const expected: ScenarioResult[] = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
let failed = false;

for (let i = 0; i < expected.length; i++) {
  const exp = expected[i];
  const act = results[i];
  if (!act || exp.stateHash !== act.stateHash) {
    failed = true;
    console.error(`FAIL: Scenario "${exp.name}" hash mismatch!`);
    console.error(`  Expected: ${exp.stateHash}`);
    console.error(`  Actual:   ${act?.stateHash}`);
    if (act) {
      for (let c = 0; c < exp.checkpoints.length; c++) {
        const ec = JSON.stringify(exp.checkpoints[c]);
        const ac = JSON.stringify(act.checkpoints[c]);
        if (ec !== ac) {
          console.error(`  First divergence at frame ${exp.checkpoints[c].frame}:`);
          console.error(`    Expected: ${ec}`);
          console.error(`    Actual:   ${ac}`);
          break;
        }
      }
    }
  } else {
    console.log(`PASS: ${act.name} (${act.stateHash.slice(0, 16)}...)`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`All ${results.length} regression scenarios matched golden snapshots 100%!`);
