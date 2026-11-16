import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Gamepad2,
  Shield,
  Sparkles,
  Swords,
  Target,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { sound } from '../game/audio';
import { createFighter } from '../game/engine';
import { HDPixelRenderer, RENDER_H, RENDER_W } from '../game/renderer';
import { STAGE_LIST, STAGES } from '../game/stages';
import { GameMode, StageId } from '../game/types';

interface TitleScreenProps {
  onSelectMode: (mode: GameMode) => void;
}

const EXPO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const TitleScreen: React.FC<TitleScreenProps> = ({ onSelectMode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());
  const [bgStageId, setBgStageId] = useState<StageId>('torii');

  const stageSpec = STAGES[bgStageId] ?? STAGES.torii;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = RENDER_W;
    canvas.height = RENDER_H;

    const renderer = new HDPixelRenderer();
    let tick = 0;
    let raf = 0;

    const stage = STAGES[bgStageId] ?? STAGES.torii;
    const groundY = stage.platforms[0].y - 18;
    const [s1, s2] = stage.spawnX ?? [-95, 95];

    const f1 = createFighter(0, 'kenji', s1 * 0.72, groundY, 1, 3);
    const f2 = createFighter(1, 'chrono', s2 * 0.72, groundY, -1, 3);
    f1.grounded = true;
    f2.grounded = true;
    f1.invulnFrames = 0;
    f2.invulnFrames = 0;

    const frame = () => {
      tick++;
      f1.actionFrame = tick;
      f2.actionFrame = tick + 24;

      for (const f of [f1, f2]) {
        f.scarf[0].x = f.x - f.facing * 2;
        f.scarf[0].y = f.y - 18;
        for (let i = 1; i < f.scarf.length; i++) {
          f.scarf[i].x = f.scarf[i - 1].x - f.facing * 4.2;
          f.scarf[i].y = f.scarf[i - 1].y + Math.sin(tick * 0.1 + i * 0.8) * 1.1;
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
        camX: Math.sin(tick * 0.007) * 28,
        camY: 34,
        camZoom: 1.06,
        shakeX: 0,
        shakeY: 0,
        impactFrames: 0,
        impactInverted: false,
        showHitboxes: false,
        tick,
      });
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bgStageId]);

  const toggleMute = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="relative w-full h-dvh bg-[#06070d] flex flex-col justify-between overflow-hidden select-none">
      {/* Live 60FPS Animated Stage Backdrop */}
      <canvas
        ref={canvasRef}
        className="pixel-canvas absolute inset-0 w-full h-full object-cover opacity-85 pointer-events-none"
      />

      {/* Artistic Diagonal Shonen Ink Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#06070d] via-[#06070d]/70 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-[#06070d]/75 pointer-events-none" />
      <div
        className="absolute -left-24 top-0 bottom-0 w-[520px] -skew-x-12 border-r border-amber-500/15 bg-gradient-to-r from-[#06070d]/90 to-transparent pointer-events-none"
      />

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 -skew-x-12">
            <span className="w-2.5 h-6 bg-amber-400" />
            <span className="w-1.5 h-6 bg-rose-500" />
          </div>
          <span className="font-display text-3xl font-bold tracking-wider text-slate-50 uppercase leading-none">
            INKBLITZ
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              sound.unlock();
              setShowControls(true);
            }}
            className="clip-corner-sm flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-100 bg-[#0c101d]/90 border border-slate-700/80 hover:border-amber-400 hover:text-amber-300 transition-all cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4 text-amber-400" />
            <span>Command List</span>
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="clip-corner-sm p-2 text-slate-200 bg-[#0c101d]/90 border border-slate-700/80 hover:border-amber-400 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Main Focal Hero Centerpiece */}
      <main className="relative z-10 flex-1 flex items-center px-6 sm:px-12 max-w-7xl w-full mx-auto min-h-0">
        <motion.div
          className="max-w-xl space-y-7"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: EXPO_EASE }}
        >
          {/* Title Lockup */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-950 bg-amber-400 -skew-x-12">
                9 CHALLENGERS
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-sky-300 bg-sky-500/15 border border-sky-400/40 -skew-x-12">
                8 DYNAMIC STAGES
              </span>
            </div>

            <h1 className="font-display text-7xl sm:text-9xl font-bold tracking-tight uppercase leading-[0.82] italic text-slate-50 drop-shadow-[0_10px_28px_rgba(0,0,0,0.85)]">
              AETHER
              <span
                className="block not-italic transition-colors duration-300"
                style={{ color: stageSpec.accentColor }}
              >
                CHRONICLES
              </span>
            </h1>
          </div>

          {/* Primary Play Action Blades */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <motion.button
              whileHover={{ x: 5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                sound.unlock();
                sound.playSwing(1.0, true);
                onSelectMode('vs_ai');
              }}
              className="clip-blade-r group relative flex items-center justify-between gap-7 px-8 py-4 text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 cursor-pointer shadow-[0_0_32px_rgba(245,158,11,0.3)]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-slate-950/15 -skew-x-12">
                  <Swords className="w-6 h-6 text-slate-950" />
                </div>
                <div className="text-left">
                  <div className="font-display text-3xl font-bold tracking-wider uppercase leading-none">
                    VS AI Arena
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900/80">
                    Stock Knockout or Stamina
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1.5" />
            </motion.button>

            <motion.button
              whileHover={{ x: 5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                sound.unlock();
                sound.playSwing(1.15, false);
                onSelectMode('training');
              }}
              className="clip-blade-r group flex items-center justify-between gap-6 px-7 py-4 text-slate-100 bg-[#0c101d]/90 border border-slate-700/90 hover:border-sky-400 cursor-pointer backdrop-blur-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-sky-500/15 border border-sky-400/30 -skew-x-12">
                  <Target className="w-5 h-5 text-sky-400" />
                </div>
                <div className="text-left">
                  <div className="font-display text-3xl font-bold tracking-wider uppercase leading-none">
                    Training Dojo
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Combo & Hitbox Lab
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-sky-400 transition-transform duration-200 group-hover:translate-x-1.5" />
            </motion.button>
          </div>
        </motion.div>
      </main>

      {/* Bottom Live Stage Ambience Switcher */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 sm:px-12 py-4 shrink-0">
        <div className="flex items-center gap-2.5 text-xs">
          <span
            className="w-2 h-2 rotate-45"
            style={{ backgroundColor: stageSpec.accentColor }}
          />
          <span className="font-bold uppercase tracking-wider text-slate-200">
            {stageSpec.name}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono-num uppercase bg-slate-900/90 border border-slate-700/80 text-slate-300 -skew-x-12">
            {stageSpec.tag}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {STAGE_LIST.map((s) => {
            const active = s.id === bgStageId;
            return (
              <button
                key={s.id}
                onClick={() => setBgStageId(s.id)}
                title={`${s.name} — ${s.tag}`}
                className={`h-2.5 -skew-x-12 transition-all cursor-pointer ${
                  active
                    ? 'w-8 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                    : 'w-3 bg-slate-800 hover:bg-slate-600'
                }`}
              />
            );
          })}
        </div>
      </footer>

      {/* Visual Command List Modal */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowControls(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              transition={{ duration: 0.2, ease: EXPO_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="clip-corner-cut w-full max-w-lg bg-[#0b101e] bg-halftone border border-slate-700 p-6 shadow-2xl"
              style={{ borderTopWidth: 4, borderTopColor: '#f59e0b' }}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Gamepad2 className="w-5 h-5 text-amber-400" />
                  <h2 className="font-display text-3xl font-bold tracking-wider text-slate-50 uppercase leading-none">
                    Combat Command List
                  </h2>
                </div>
                <button
                  onClick={() => setShowControls(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
                  aria-label="Close controls"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  { icon: Wind, label: 'Move & Aim', keys: ['W', 'A', 'S', 'D'], color: '#38bdf8' },
                  { icon: Zap, label: 'Full Jump / Air Jump', keys: ['SPACE'], color: '#facc15' },
                  { icon: Zap, label: 'Tactical Short Hop', keys: ['C'], color: '#a855f7' },
                  { icon: Swords, label: 'Light & Aerial Combos', keys: ['K'], color: '#38bdf8' },
                  { icon: Sparkles, label: 'Strong Charge Smash', keys: ['L'], color: '#f43f5e' },
                  { icon: Sparkles, label: 'Signature Special Arts', keys: ['J'], color: '#f59e0b' },
                  { icon: Wind, label: 'Burst Dash / Air-Dash', keys: ['P + MOVE'], color: '#2dd4bf' },
                  { icon: Shield, label: 'Parry Deflect Stance', keys: ['P (STAND)'], color: '#f8fafc' },
                  { icon: Zap, label: 'Unblockable Ultimate', keys: ['V (100%)'], color: '#ef4444' },
                  { icon: Sparkles, label: 'Signature Taunt (+ULT)', keys: ['T'], color: '#fde047' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="clip-corner-sm flex items-center justify-between gap-2 p-2.5 bg-[#060913]/90 border border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                        <span className="font-semibold text-slate-200">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 font-mono-num text-[11px] font-bold bg-slate-900 border border-slate-600 text-amber-300"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
