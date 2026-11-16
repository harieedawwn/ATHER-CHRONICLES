import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Crown,
  Diamond,
  Flame,
  Heart,
  Layers,
  Maximize2,
  Minus,
  Orbit,
  Shield,
  Shuffle,
  Sparkles,
  Star,
  Swords,
  Train,
  Wind,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { sound } from '../game/audio';
import { createFighter } from '../game/engine';
import { FIGHTER_LIST, FIGHTERS } from '../game/fighters';
import { HDPixelRenderer } from '../game/renderer';
import { STAGE_LIST, STAGES } from '../game/stages';
import {
  AIDifficulty,
  FighterId,
  FighterSpec,
  MatchConfig,
  Ruleset,
  StageId,
  WeaponType,
} from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface MatchSetupProps {
  config: MatchConfig;
  onChange: (next: MatchConfig) => void;
  onBack: () => void;
  onStartFight: () => void;
}

const EXPO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Convert raw fighter physics stats into 1..5 visual energy pips
function getVisualStatPips(spec: FighterSpec): {
  speed: number;
  aerial: number;
  weight: number;
} {
  // Note: stats are scaled in fighters.ts (dashSpeed ~3.9..5.4, airSpeed ~2.1..2.9, weight 88..116)
  const spdNorm = Math.round(((spec.stats.dashSpeed - 3.7) / 1.7) * 4) + 1;
  const airNorm = Math.round(((spec.stats.airSpeed - 2.0) / 0.95) * 4) + 1;
  const wgtNorm = Math.round(((spec.stats.weight - 86) / 30) * 4) + 1;
  return {
    speed: Math.max(1, Math.min(5, spdNorm)),
    aerial: Math.max(1, Math.min(5, airNorm)),
    weight: Math.max(1, Math.min(5, wgtNorm)),
  };
}

// Custom Vector Weapon Class Emblem
const WeaponEmblem: React.FC<{ weapon: WeaponType; color: string }> = ({ weapon, color }) => {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      {weapon === 'dagger' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <circle cx="6" cy="18" r="2.5" />
          <path d="M8 16 L19 5 L15 15 Z" fill={color} fillOpacity="0.35" />
        </g>
      )}
      {weapon === 'gauntlet' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <polygon points="5,9 15,6 19,12 15,18 5,15" fill={color} fillOpacity="0.35" />
          <line x1="9" y1="12" x2="16" y2="12" stroke="#ffffff" />
        </g>
      )}
      {weapon === 'katana' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <path d="M4 20 Q12 12 20 3" />
          <line x1="6" y1="14" x2="10" y2="18" stroke="#ffffff" />
        </g>
      )}
      {weapon === 'titan' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <rect x="5" y="6" width="12" height="12" fill={color} fillOpacity="0.35" />
          <path d="M17 7 L21 9 M17 12 L21 12 M17 17 L21 15" stroke="#ffffff" />
        </g>
      )}
      {weapon === 'spear' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <line x1="4" y1="20" x2="16" y2="8" />
          <polygon points="14,6 21,3 18,10" fill={color} />
        </g>
      )}
      {weapon === 'scythe' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <line x1="6" y1="21" x2="18" y2="5" />
          <path d="M18 5 Q8 2 4 11 Q11 8 17 9 Z" fill={color} fillOpacity="0.45" />
        </g>
      )}
      {weapon === 'chains' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <line x1="4" y1="19" x2="14" y2="10" strokeDasharray="3 2" />
          <circle cx="17" cy="7" r="4" fill={color} fillOpacity="0.45" />
        </g>
      )}
      {weapon === 'orbs' && (
        <g stroke={color} strokeWidth="1.8" fill="none">
          <circle cx="12" cy="12" r="7" strokeDasharray="4 2" />
          <polygon points="12,6 15,12 12,18 9,12" fill={color} />
        </g>
      )}
      {weapon === 'claws' && (
        <g stroke={color} strokeWidth="2" fill="none">
          <path d="M5 17 Q11 10 19 6 M7 19 Q13 12 20 10 M9 21 Q15 15 21 14" />
        </g>
      )}
    </svg>
  );
};

// Mini Visual Stage Topology Silhouette SVG for Stage Cards
const StageTopologyMini: React.FC<{ stageId: StageId; accent: string }> = ({
  stageId,
  accent,
}) => {
  return (
    <svg
      viewBox="0 0 120 44"
      className="w-full h-9 bg-[#05070e]/90 border border-slate-800/90"
      aria-hidden="true"
    >
      {stageId === 'void_flat' && (
        <g>
          <circle cx="60" cy="14" r="7" fill="none" stroke={accent} strokeWidth="1.4" />
          <rect x="20" y="21" width="3" height="10" fill="#1e3a5f" />
          <rect x="97" y="21" width="3" height="10" fill="#1e3a5f" />
          <rect x="12" y="30" width="96" height="6" fill={accent} />
          <line x1="6" y1="38" x2="114" y2="38" stroke={accent} strokeOpacity="0.4" />
        </g>
      )}
      {stageId === 'torii' && (
        <g>
          <circle cx="60" cy="14" r="8" fill={accent} fillOpacity="0.28" />
          <rect x="18" y="31" width="84" height="7" fill={accent} />
          <rect x="22" y="21" width="22" height="3" fill="#f8fafc" />
          <rect x="76" y="21" width="22" height="3" fill="#f8fafc" />
          <rect x="48" y="12" width="24" height="3" fill="#fbbf24" />
        </g>
      )}
      {stageId === 'dojo' && (
        <g>
          <rect x="20" y="33" width="80" height="6" fill={accent} />
          <rect x="46" y="16" width="28" height="3" fill="#facc15" />
          <rect x="28" y="7" width="18" height="2.5" fill="#fde047" />
          <rect x="74" y="7" width="18" height="2.5" fill="#fde047" />
          <rect x="18" y="23" width="18" height="3" fill="#38bdf8" />
          <rect x="84" y="23" width="18" height="3" fill="#38bdf8" />
          <path d="M27 6 L27 29 M93 6 L93 29" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 1" />
        </g>
      )}
      {stageId === 'monolith' && (
        <g>
          {/* Split Chasm + Moving Bridge + 2 Updraft Jump Pads */}
          <rect x="8" y="30" width="40" height="8" fill={accent} />
          <rect x="72" y="30" width="40" height="8" fill={accent} />
          <rect x="49" y="22" width="22" height="3" fill="#f8fafc" />
          <rect x="14" y="13" width="20" height="3" fill="#a7f3d0" />
          <rect x="86" y="13" width="20" height="3" fill="#a7f3d0" />
          <path d="M42 28 L42 15 M78 28 L78 15" stroke="#2dd4bf" strokeWidth="1.5" />
        </g>
      )}
      {stageId === 'coliseum' && (
        <g>
          {/* Colossal 1080px Wide Arena + 5 Platforms + Outer Jump Catapults */}
          <rect x="3" y="32" width="114" height="7" fill={accent} />
          <rect x="10" y="20" width="20" height="3" fill="#f8fafc" />
          <rect x="90" y="20" width="20" height="3" fill="#f8fafc" />
          <rect x="33" y="22" width="18" height="3" fill="#fbbf24" />
          <rect x="69" y="22" width="18" height="3" fill="#fbbf24" />
          <rect x="47" y="11" width="26" height="3" fill="#fde047" />
        </g>
      )}
      {stageId === 'hypercube' && (
        <g>
          <rect x="52" y="6" width="16" height="11" fill="none" stroke="#ec4899" strokeWidth="1.2" />
          <rect x="10" y="32" width="100" height="5" fill={accent} />
          <rect x="12" y="15" width="18" height="3" fill="#22d3ee" />
          <rect x="90" y="15" width="18" height="3" fill="#22d3ee" />
          <rect x="32" y="22" width="18" height="3" fill="#ec4899" />
          <rect x="70" y="22" width="18" height="3" fill="#ec4899" />
        </g>
      )}
      {stageId === 'tesseract' && (
        <g>
          {/* Compact Loop + Warp Edges + Orbiting Platforms */}
          <line x1="12" y1="6" x2="12" y2="38" stroke="#e879f9" strokeWidth="2" strokeDasharray="3 2" />
          <line x1="108" y1="6" x2="108" y2="38" stroke="#e879f9" strokeWidth="2" strokeDasharray="3 2" />
          <rect x="28" y="31" width="64" height="6" fill={accent} />
          <circle cx="60" cy="18" r="8" fill="none" stroke="#facc15" strokeWidth="1.2" strokeDasharray="2 2" />
        </g>
      )}
      {stageId === 'train' && (
        <g>
          {/* 3 Coupled High-Speed Bullet Train Cars + Catenary Decks */}
          <rect x="4" y="29" width="33" height="8" fill={accent} />
          <rect x="42" y="29" width="36" height="8" fill={accent} />
          <rect x="83" y="29" width="33" height="8" fill={accent} />
          <rect x="26" y="19" width="22" height="3" fill="#38bdf8" />
          <rect x="72" y="19" width="22" height="3" fill="#38bdf8" />
          <rect x="48" y="10" width="24" height="3" fill="#facc15" />
        </g>
      )}
    </svg>
  );
};

// Visual Segmented Stat Bar Component (5 Glowing Energy Pips)
const SegmentedStatBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  pips: number;
  color: string;
}> = ({ icon, label, pips, color }) => {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((idx) => {
          const active = idx <= pips;
          return (
            <span
              key={idx}
              className="w-5 h-2.5 -skew-x-12 transition-all duration-300"
              style={{
                backgroundColor: active ? color : '#111827',
                border: `1px solid ${active ? color : '#334155'}`,
                boxShadow: active ? `0 0 8px ${color}66` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export const MatchSetup: React.FC<MatchSetupProps> = ({
  config,
  onChange,
  onBack,
  onStartFight,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [setupStep, setSetupStep] = useState<'fighters' | 'stage'>('fighters');
  const [selectingSlot, setSelectingSlot] = useState<'p1' | 'p2'>('p1');

  const p1Spec = FIGHTERS[config.p1Fighter];
  const p2Spec = FIGHTERS[config.p2Fighter];
  const activeInspectSpec = selectingSlot === 'p1' ? p1Spec : p2Spec;
  const activeStats = getVisualStatPips(activeInspectSpec);
  const activeStage = STAGES[config.stageId] ?? STAGES.torii;

  const update = (patch: Partial<MatchConfig>) => {
    onChange({ ...config, ...patch });
  };

  const randomizeCurrentStep = () => {
    sound.unlock();
    if (setupStep === 'fighters') {
      const ids = FIGHTER_LIST.map((f) => f.id);
      const p1 = ids[Math.floor(Math.random() * ids.length)];
      const remaining = ids.filter((id) => id !== p1);
      const p2 = remaining[Math.floor(Math.random() * remaining.length)];
      sound.playUiSelectFighter(selectingSlot === 'p1' ? p1 : p2);
      update({ p1Fighter: p1, p2Fighter: p2 });
    } else {
      const stageIds = STAGE_LIST.map((s) => s.id);
      const randomStage = stageIds[Math.floor(Math.random() * stageIds.length)];
      sound.playUiSelectStage(randomStage);
      update({ stageId: randomStage });
    }
  };

  // Live 60FPS Canvas Preview (Zoomed-in Face-Off in Step 1, Wide Full-Arena View in Step 2)
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 450;

    const renderer = new HDPixelRenderer();
    let tick = 0;
    let raf = 0;

    const stage = STAGES[config.stageId] ?? STAGES.torii;
    const isFighterStep = setupStep === 'fighters';
    const spawnX = isFighterStep ? [-56, 56] : stage.spawnX ?? [-95, 95];
    const groundY = stage.platforms[0].y - 18;

    const f1 = createFighter(0, config.p1Fighter, spawnX[0], groundY, 1, config.stocksCount);
    const f2 = createFighter(1, config.p2Fighter, spawnX[1], groundY, -1, config.stocksCount);
    f1.grounded = true;
    f2.grounded = true;
    f1.invulnFrames = 0;
    f2.invulnFrames = 0;

    const loop = () => {
      tick++;
      f1.actionFrame = tick;
      f2.actionFrame = tick + 19;

      for (const f of [f1, f2]) {
        f.scarf[0].x = f.x - f.facing * 2;
        f.scarf[0].y = f.y - 18;
        for (let i = 1; i < f.scarf.length; i++) {
          f.scarf[i].x = f.scarf[i - 1].x - f.facing * 4.2;
          f.scarf[i].y = f.scarf[i - 1].y + Math.sin(tick * 0.12 + i * 0.8) * 1.1;
        }
      }

      renderer.render(canvas, {
        stage,
        fighters: [f1, f2],
        projectiles: [],
        riftSeals: [],
        stasisFields: [],
        portals: [],
        delayedSlashes: [],
        afterimages: [],
        slashArcs: [],
        shockwaves: [],
        particles: [],
        callouts: [],
        camX: isFighterStep ? 0 : Math.sin(tick * 0.008) * (stage.wallRight > 400 ? 110 : 35),
        camY: isFighterStep ? groundY - 18 : stage.id === 'dojo' ? groundY - 95 : groundY - 52,
        camZoom: isFighterStep ? 1.52 : stage.wallRight > 450 ? 0.68 : stage.id === 'dojo' ? 0.78 : 0.88,
        shakeX: 0,
        shakeY: 0,
        impactFrames: 0,
        impactInverted: false,
        showHitboxes: false,
        tick,
      });
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [config.p1Fighter, config.p2Fighter, config.stageId, config.stocksCount, setupStep]);

  // Stage visual mechanic badges helper
  const getStageVisualBadges = (stageId: StageId) => {
    switch (stageId) {
      case 'void_flat':
        return [
          { icon: <Minus className="w-3.5 h-3.5 text-sky-400" />, label: '620px Pure Flat Sanctuary' },
          { icon: <Shield className="w-3.5 h-3.5 text-amber-400" />, label: 'Solid Crystal Monolith' },
        ];
      case 'torii':
        return [
          { icon: <Layers className="w-3.5 h-3.5 text-rose-400" />, label: '560px Tri-Platform Shrine' },
          { icon: <Swords className="w-3.5 h-3.5 text-amber-400" />, label: 'Solid Stone & Timber' },
        ];
      case 'dojo':
        return [
          { icon: <ArrowUp className="w-3.5 h-3.5 text-amber-400" />, label: '5-Tier Vertical Pagoda' },
          { icon: <Layers className="w-3.5 h-3.5 text-sky-400" />, label: 'Chain Elevators + High Roof' },
        ];
      case 'monolith':
        return [
          { icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />, label: 'Twin Abyss Fortresses' },
          { icon: <Sparkles className="w-3.5 h-3.5 text-rose-400" />, label: 'Moving Bridge + Geysers' },
        ];
      case 'coliseum':
        return [
          { icon: <Maximize2 className="w-3.5 h-3.5 text-amber-400" />, label: 'Colossal 1080px Arena' },
          { icon: <Flame className="w-3.5 h-3.5 text-orange-400" />, label: '5 Tiers + Launch Catapults' },
        ];
      case 'hypercube':
        return [
          { icon: <Box className="w-3.5 h-3.5 text-pink-400" />, label: 'Wide 720px Cyber Overpass' },
          { icon: <Layers className="w-3.5 h-3.5 text-sky-400" />, label: 'Hover Drones + Cyber Towers' },
        ];
      case 'tesseract':
        return [
          { icon: <Orbit className="w-3.5 h-3.5 text-purple-400" />, label: 'Compact 430px Warp Cage' },
          { icon: <Wind className="w-3.5 h-3.5 text-amber-300" />, label: '0.78× Low Gravity + Pendulum' },
        ];
      case 'train':
        return [
          { icon: <Train className="w-3.5 h-3.5 text-sky-400" />, label: '920px 3-Car Bullet Train' },
          { icon: <Wind className="w-3.5 h-3.5 text-amber-400" />, label: 'Catenary Decks + Wind Gusts' },
        ];
    }
  };

  return (
    <div className="w-full h-dvh bg-[#06070d] bg-halftone text-slate-100 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Broadcast Navigation & 2-Step Progress Bar */}
      <header className="flex items-center justify-between gap-4 px-5 sm:px-8 py-2.5 border-b border-slate-800/90 bg-[#090d18]/95 shrink-0">
        <button
          onMouseEnter={() => sound.playUiHover()}
          onClick={() => {
            sound.unlock();
            sound.playUiBack();
            if (setupStep === 'stage') {
              setSetupStep('fighters');
            } else {
              onBack();
            }
          }}
          className="clip-corner-sm flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{setupStep === 'stage' ? 'Fighters' : 'Title'}</span>
        </button>

        {/* Interactive 2-Step Progress Switcher */}
        <div className="flex items-center gap-2">
          <button
            onMouseEnter={() => sound.playUiHover()}
            onClick={() => {
              sound.unlock();
              sound.playUiClick();
              setSetupStep('fighters');
            }}
            className={`clip-slant flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              setupStep === 'fighters'
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="font-mono-num font-extrabold">01</span>
            <span>Select Challengers</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden sm:block" />

          <button
            onMouseEnter={() => sound.playUiHover()}
            onClick={() => {
              sound.unlock();
              sound.playUiClick();
              setSetupStep('stage');
            }}
            className={`clip-slant flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              setupStep === 'stage'
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="font-mono-num font-extrabold">02</span>
            <span>Select Battleground</span>
          </button>
        </div>

        {/* Right Actions: Randomize + Primary Step Action */}
        <div className="flex items-center gap-2.5">
          <button
            onMouseEnter={() => sound.playUiHover()}
            onClick={randomizeCurrentStep}
            className="clip-corner-sm flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 transition-colors cursor-pointer"
            title="Randomize Selection"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Random</span>
          </button>

          {setupStep === 'fighters' ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={() => sound.playUiHover()}
              onClick={() => {
                sound.unlock();
                sound.playUiConfirm();
                setSetupStep('stage');
              }}
              className="clip-blade-r flex items-center gap-2 px-5 py-1.5 text-sm font-display font-bold tracking-wider uppercase text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
            >
              <span>Next: Select Map</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={() => sound.playUiHover()}
              onClick={() => {
                sound.unlock();
                sound.playUiConfirm();
                onStartFight();
              }}
              className="clip-blade-r flex items-center gap-2 px-6 py-1.5 text-sm font-display font-bold tracking-wider uppercase text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 transition-colors cursor-pointer shadow-md shadow-amber-500/25"
            >
              <Swords className="w-4 h-4" />
              <span>Engage Duel</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* =====================================================================
          STEP 1: CHALLENGER SELECT (100% Zero-Scroll Viewport)
         ===================================================================== */}
      {setupStep === 'fighters' ? (
        <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-5 sm:px-8 py-3 gap-3 min-h-0">
          {/* Upper Showcase Area: Left Live Face-Off Canvas + Right Visual Stat & Special Panel */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            {/* Left 7 Columns: Active P1/P2 Slot Switcher + Live 60FPS Face-Off Canvas */}
            <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-0">
              {/* P1 vs P2 Slot Selector Cards */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <button
                  onMouseEnter={() => sound.playUiHover()}
                  onClick={() => {
                    sound.unlock();
                    sound.playUiToggle(true);
                    setSelectingSlot('p1');
                  }}
                  className={`clip-corner-sm relative flex items-center gap-3 p-2.5 border text-left transition-all cursor-pointer ${
                    selectingSlot === 'p1'
                      ? 'bg-[#12192e] border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.18)]'
                      : 'bg-[#0a0f1d]/85 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <FighterPortrait spec={p1Spec} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-400 text-slate-950 -skew-x-12">
                        PLAYER 1
                      </span>
                      {selectingSlot === 'p1' && (
                        <span className="text-[10px] font-mono-num font-bold text-amber-300">
                          ● PICKING
                        </span>
                      )}
                    </div>
                    <div className="font-display text-2xl font-bold text-slate-50 leading-none mt-1 truncate uppercase">
                      {p1Spec.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{p1Spec.title}</div>
                  </div>
                </button>

                <button
                  onMouseEnter={() => sound.playUiHover()}
                  onClick={() => {
                    sound.unlock();
                    sound.playUiToggle(false);
                    setSelectingSlot('p2');
                  }}
                  className={`clip-corner-sm relative flex items-center gap-3 p-2.5 border text-left transition-all cursor-pointer ${
                    selectingSlot === 'p2'
                      ? 'bg-[#1b1120] border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                      : 'bg-[#0a0f1d]/85 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <FighterPortrait spec={p2Spec} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-500 text-white -skew-x-12">
                        {config.mode === 'vs_ai' ? 'AI CHALLENGER' : 'DUMMY'}
                      </span>
                      {selectingSlot === 'p2' && (
                        <span className="text-[10px] font-mono-num font-bold text-rose-400">
                          ● PICKING
                        </span>
                      )}
                    </div>
                    <div className="font-display text-2xl font-bold text-slate-50 leading-none mt-1 truncate uppercase">
                      {p2Spec.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{p2Spec.title}</div>
                  </div>
                </button>
              </div>

              {/* Live 60FPS Face-Off Canvas Showcase */}
              <div className="clip-corner-cut relative flex-1 bg-[#090d18] border border-slate-800 overflow-hidden min-h-[150px]">
                <canvas
                  ref={previewCanvasRef}
                  className="pixel-canvas w-full h-full object-cover block"
                />
                <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />

                {/* Bottom VS Nameplate Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/80 to-transparent px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WeaponEmblem weapon={p1Spec.weaponType} color={p1Spec.accentColor} />
                    <div>
                      <div
                        className="font-display text-2xl font-bold leading-none uppercase"
                        style={{ color: p1Spec.accentColor }}
                      >
                        {p1Spec.name}
                      </div>
                      <div className="text-[10px] text-slate-300 uppercase tracking-wider">
                        {p1Spec.archetype}
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rotate-45 bg-amber-400 border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-md">
                    <span className="-rotate-45 font-display text-base font-bold text-slate-950">
                      VS
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div
                        className="font-display text-2xl font-bold leading-none uppercase"
                        style={{ color: p2Spec.accentColor }}
                      >
                        {p2Spec.name}
                      </div>
                      <div className="text-[10px] text-slate-300 uppercase tracking-wider">
                        {p2Spec.archetype}
                      </div>
                    </div>
                    <WeaponEmblem weapon={p2Spec.weaponType} color={p2Spec.accentColor} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Visual Fighter Attributes (Segmented Stat Bars + 4 Visual Special Icons) */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInspectSpec.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: EXPO_EASE }}
                className="lg:col-span-5 clip-corner-cut bg-[#0b101e]/95 border border-slate-800 p-4 flex flex-col justify-between min-h-0"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: activeInspectSpec.accentColor,
                }}
              >
                {/* Fighter Identity Header */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800/90">
                  <div className="flex items-center gap-3 min-w-0">
                    <FighterPortrait spec={activeInspectSpec} size={48} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-3xl font-bold text-slate-50 leading-none uppercase truncate">
                          {activeInspectSpec.name}
                        </h2>
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold text-slate-950 uppercase -skew-x-12 shrink-0"
                          style={{ backgroundColor: activeInspectSpec.accentColor }}
                        >
                          {activeInspectSpec.archetype}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {activeInspectSpec.signatureSummary}
                      </p>
                    </div>
                  </div>
                  <WeaponEmblem
                    weapon={activeInspectSpec.weaponType}
                    color={activeInspectSpec.secondaryColor}
                  />
                </div>

                {/* Visual 5-Segment Energy Stat Bars (No Raw Numbers!) */}
                <div className="py-2 px-3 bg-[#060913]/90 border border-slate-800/90 space-y-1 my-2">
                  <SegmentedStatBar
                    icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                    label="Dash Velocity"
                    pips={activeStats.speed}
                    color="#f59e0b"
                  />
                  <SegmentedStatBar
                    icon={<Wind className="w-3.5 h-3.5 text-sky-400" />}
                    label="Aerial Control"
                    pips={activeStats.aerial}
                    color="#38bdf8"
                  />
                  <SegmentedStatBar
                    icon={<Shield className="w-3.5 h-3.5 text-emerald-400" />}
                    label="Armor Weight"
                    pips={activeStats.weight}
                    color="#10b981"
                  />
                </div>

                {/* Visual 4-Direction Special Kit Cards */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      dirIcon: <Sparkles className="w-3 h-3 text-amber-400" />,
                      keyTag: 'J',
                      title: activeInspectSpec.moves.nspecial.name,
                      desc: activeInspectSpec.specialNotes.neutral.split(':')[1] ?? activeInspectSpec.specialNotes.neutral,
                    },
                    {
                      dirIcon: <ArrowRight className="w-3 h-3 text-sky-400" />,
                      keyTag: 'A/D + J',
                      title: activeInspectSpec.moves.sspecial.name,
                      desc: activeInspectSpec.specialNotes.side.split(':')[1] ?? activeInspectSpec.specialNotes.side,
                    },
                    {
                      dirIcon: <ArrowUp className="w-3 h-3 text-emerald-400" />,
                      keyTag: 'W + J',
                      title: activeInspectSpec.moves.uspecial.name,
                      desc: activeInspectSpec.specialNotes.up.split(':')[1] ?? activeInspectSpec.specialNotes.up,
                    },
                    {
                      dirIcon: <ArrowDown className="w-3 h-3 text-rose-400" />,
                      keyTag: 'S + J',
                      title: activeInspectSpec.moves.dspecial.name,
                      desc: activeInspectSpec.specialNotes.down.split(':')[1] ?? activeInspectSpec.specialNotes.down,
                    },
                  ].map((sp) => (
                    <div
                      key={sp.keyTag}
                      className="clip-corner-sm p-2 bg-[#060913]/90 border border-slate-800/90 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {sp.title}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-num font-bold bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                          {sp.dirIcon}
                          {sp.keyTag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                        {sp.desc.trim()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Unblockable Ultimate [V] & Signature Taunt [T] Strip */}
                <div className="clip-corner-sm mt-2 p-2 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-[#060913] border border-amber-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-mono-num font-extrabold bg-amber-400 text-slate-950 -skew-x-12 shrink-0">
                        V · ULTIMATE
                      </span>
                      <span className="font-display text-sm font-bold text-amber-300 uppercase tracking-wider truncate">
                        {activeInspectSpec.ultimateName}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                      {activeInspectSpec.ultimateDescription}
                    </p>
                  </div>
                  <span
                    title={`Taunt Quote: "${activeInspectSpec.tauntQuote}"`}
                    className="px-2 py-1 text-[9px] font-mono-num font-bold bg-slate-900 border border-slate-700 text-emerald-300 shrink-0"
                  >
                    T · TAUNT (+ULT)
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom 9-Fighter Dock + Next Step Action Bar */}
          <div className="shrink-0 bg-[#090d18]/95 border border-slate-800 p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 grid grid-cols-3 sm:grid-cols-9 gap-2">
              {FIGHTER_LIST.map((f) => {
                const isP1 = config.p1Fighter === f.id;
                const isP2 = config.p2Fighter === f.id;
                const isSelected = selectingSlot === 'p1' ? isP1 : isP2;

                return (
                  <motion.button
                    key={f.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onMouseEnter={() => sound.playUiHover()}
                    onClick={() => {
                      sound.unlock();
                      sound.playUiSelectFighter(f.id as FighterId);
                      if (selectingSlot === 'p1') {
                        update({ p1Fighter: f.id as FighterId });
                      } else {
                        update({ p2Fighter: f.id as FighterId });
                      }
                    }}
                    className={`clip-corner-sm relative flex flex-col items-center p-1.5 border transition-colors cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'bg-[#161f38] border-transparent'
                        : 'bg-[#060913] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {isP1 && (
                      <motion.div
                        layoutId="p1DockFrame"
                        className="absolute inset-0 border-2 border-amber-400 pointer-events-none"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}
                    {isP2 && !isP1 && (
                      <motion.div
                        layoutId="p2DockFrame"
                        className="absolute inset-0 border-2 border-rose-500 pointer-events-none"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}

                    {/* Top P1 / P2 Badges */}
                    <div className="absolute top-1 right-1 flex gap-0.5 z-10">
                      {isP1 && (
                        <span className="px-1 text-[8px] font-mono-num font-extrabold bg-amber-400 text-slate-950">
                          P1
                        </span>
                      )}
                      {isP2 && (
                        <span className="px-1 text-[8px] font-mono-num font-extrabold bg-rose-500 text-white">
                          P2
                        </span>
                      )}
                    </div>

                    <FighterPortrait spec={f} size={42} />
                    <span className="font-display text-base font-bold text-slate-100 leading-none mt-1 uppercase truncate w-full text-center">
                      {f.name}
                    </span>
                    <div
                      className="h-0.5 w-full mt-1"
                      style={{ backgroundColor: f.accentColor }}
                    />
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onMouseEnter={() => sound.playUiHover()}
              onClick={() => {
                sound.unlock();
                sound.playUiConfirm();
                setSetupStep('stage');
              }}
              className="clip-blade-r px-6 py-3 sm:py-0 flex items-center justify-center gap-2 font-display text-2xl font-bold uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shrink-0 shadow-lg shadow-amber-500/20"
            >
              <span>Select Stage</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </main>
      ) : (
        /* =====================================================================
           STEP 2: BATTLEGROUND & RULESET SELECT (100% Zero-Scroll Viewport)
           ===================================================================== */
        <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-5 sm:px-8 py-3 gap-3 min-h-0">
          {/* Upper Area: Left 7 Cols Widescreen Stage Preview + Right 5 Cols Visual Ruleset & Matchup */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            {/* Left 7 Cols: Widescreen 60FPS Live Arena Preview */}
            <div className="lg:col-span-7 clip-corner-cut relative bg-[#090d18] border border-slate-800 overflow-hidden flex flex-col min-h-[180px]">
              <canvas
                ref={previewCanvasRef}
                className="pixel-canvas w-full h-full object-cover block flex-1"
              />
              <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-25" />

              {/* Top-Left Visual Hazard & Mechanic Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                {getStageVisualBadges(config.stageId).map((b) => (
                  <div
                    key={b.label}
                    className="clip-corner-sm flex items-center gap-1.5 px-2.5 py-1 bg-[#060913]/90 border border-slate-700/90 text-xs font-bold text-slate-100 backdrop-blur-xs"
                  >
                    {b.icon}
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>

              {/* Bottom Stage Identity Banner */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/85 to-transparent px-5 py-3 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-4xl font-bold text-slate-50 leading-none uppercase tracking-wide">
                      {activeStage.name}
                    </h2>
                    <span
                      className="px-2 py-0.5 text-[10px] font-mono-num font-bold uppercase text-slate-950 -skew-x-12"
                      style={{ backgroundColor: activeStage.accentColor }}
                    >
                      {activeStage.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{activeStage.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Visual Ruleset, Stock Gems, AI Star Rank & Launch */}
            <div className="lg:col-span-5 clip-corner-cut bg-[#0b101e]/95 border border-slate-800 p-4 flex flex-col justify-between min-h-0">
              {/* Visual Ruleset Selector */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Combat Mode Ruleset
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        id: 'stock',
                        title: 'Stock Ring-Out',
                        sub: 'Blast-Zone KO (%)',
                        icon: <Zap className="w-4 h-4 text-amber-400" />,
                      },
                      {
                        id: 'hp',
                        title: 'Stamina 1000 HP',
                        sub: 'Wall-Bounce & Health',
                        icon: <Heart className="w-4 h-4 text-rose-400" />,
                      },
                    ] as { id: Ruleset; title: string; sub: string; icon: React.ReactNode }[]
                  ).map((r) => {
                    const active = config.ruleset === r.id;
                    return (
                      <button
                        key={r.id}
                        onMouseEnter={() => sound.playUiHover()}
                        onClick={() => {
                          sound.unlock();
                          sound.playUiToggle(r.id === 'stock');
                          update({ ruleset: r.id });
                        }}
                        className={`clip-corner-sm p-2.5 text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#161f38] border-amber-400 text-slate-50 shadow-md'
                            : 'bg-[#060913]/90 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {r.icon}
                          <span className="font-display text-xl font-bold uppercase leading-none">
                            {r.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{r.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Stock Gems & Visual AI Rank Stars */}
              {config.mode === 'vs_ai' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
                  {config.ruleset === 'stock' && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Life Stocks
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[2, 3, 5].map((cnt) => {
                          const active = config.stocksCount === cnt;
                          return (
                            <button
                              key={cnt}
                              onMouseEnter={() => sound.playUiHover()}
                              onClick={() => {
                                sound.unlock();
                                sound.playUiClick();
                                update({ stocksCount: cnt });
                              }}
                              className={`clip-corner-sm py-2 px-1 flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                  : 'bg-[#060913] border-slate-800 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: cnt }).map((_, i) => (
                                  <Diamond
                                    key={i}
                                    className="w-2.5 h-2.5 fill-current"
                                  />
                                ))}
                              </div>
                              <span className="font-mono-num text-[10px] font-bold">
                                {cnt} STOCKS
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={`space-y-1.5 ${config.ruleset === 'stock' ? '' : 'sm:col-span-2'}`}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      AI Challenger Rank
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'easy', label: 'Initiate', stars: 1 },
                          { id: 'normal', label: 'Challenger', stars: 2 },
                          { id: 'boss', label: 'Master', stars: 3 },
                        ] as { id: AIDifficulty; label: string; stars: number }[]
                      ).map((d) => {
                        const active = config.aiDifficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            onMouseEnter={() => sound.playUiHover()}
                            onClick={() => {
                              sound.unlock();
                              sound.playUiClick();
                              update({ aiDifficulty: d.id });
                            }}
                            className={`clip-corner-sm py-2 px-1 flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                              active
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                : 'bg-[#060913] border-slate-800 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-0.5">
                              {d.stars === 3 ? (
                                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              ) : (
                                Array.from({ length: d.stars }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-current" />
                                ))
                              )}
                            </div>
                            <span className="font-mono-num text-[10px] font-bold uppercase">
                              {d.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Locked Matchup Summary + Big Launch Button */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/90">
                <div className="flex items-center justify-between bg-[#060913] border border-slate-800 p-2">
                  <div className="flex items-center gap-2">
                    <FighterPortrait spec={p1Spec} size={34} />
                    <div>
                      <div className="font-display text-lg font-bold text-amber-400 leading-none uppercase">
                        {p1Spec.name}
                      </div>
                      <div className="text-[9px] text-slate-400">PLAYER 1</div>
                    </div>
                  </div>

                  <button
                    onMouseEnter={() => sound.playUiHover()}
                    onClick={() => {
                      sound.unlock();
                      sound.playUiBack();
                      setSetupStep('fighters');
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono-num font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    Change Fighters
                  </button>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className="font-display text-lg font-bold text-rose-400 leading-none uppercase">
                        {p2Spec.name}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {config.mode === 'vs_ai' ? 'AI' : 'DUMMY'}
                      </div>
                    </div>
                    <FighterPortrait spec={p2Spec} size={34} />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onMouseEnter={() => sound.playUiHover()}
                  onClick={() => {
                    sound.unlock();
                    sound.playUiConfirm();
                    onStartFight();
                  }}
                  className="clip-blade-r w-full py-3 flex items-center justify-center gap-3 font-display text-3xl font-bold tracking-wider uppercase text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 transition-all cursor-pointer shadow-[0_0_28px_rgba(245,158,11,0.3)]"
                >
                  <Swords className="w-6 h-6" />
                  <span>Fight on {activeStage.name}</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Bottom 8-Stage Visual Gallery Strip (With Mini Topology Silhouettes) */}
          <div className="shrink-0 bg-[#090d18]/95 border border-slate-800 p-2.5">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {STAGE_LIST.map((s) => {
                const active = config.stageId === s.id;
                return (
                  <motion.button
                    key={s.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onMouseEnter={() => sound.playUiHover()}
                    onClick={() => {
                      sound.unlock();
                      sound.playUiSelectStage(s.id as StageId);
                      update({ stageId: s.id as StageId });
                    }}
                    className={`clip-corner-sm relative p-2 text-left border transition-all cursor-pointer overflow-hidden ${
                      active
                        ? 'bg-[#161f38] border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.22)]'
                        : 'bg-[#060913] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <StageTopologyMini stageId={s.id} accent={s.accentColor} />
                    <div className="font-display text-base font-bold text-slate-100 leading-none uppercase truncate mt-1.5">
                      {s.name}
                    </div>
                    <div
                      className="text-[9px] font-mono-num truncate mt-0.5"
                      style={{ color: active ? '#fbbf24' : '#94a3b8' }}
                    >
                      {s.tag}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </main>
      )}
    </div>
  );
};
