import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FIGHTERS } from '../game/fighters';
import { STAGES } from '../game/stages';
import { MatchConfig } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

export type TransitionKind = 'none' | 'slash' | 'vs_curtain';

interface ScreenTransitionProps {
  kind: TransitionKind;
  config: MatchConfig;
}

const EXPO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({ kind, config }) => {
  const p1 = FIGHTERS[config.p1Fighter];
  const p2 = FIGHTERS[config.p2Fighter];
  const stage = STAGES[config.stageId];

  return (
    <AnimatePresence>
      {kind === 'slash' && (
        <motion.div
          key="slash-wipe"
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22, ease: EXPO_EASE } }}
        >
          {/* Upper-Left Katana Shutter */}
          <motion.div
            className="absolute inset-0 bg-[#05070e] bg-halftone flex items-start justify-start p-8"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
            initial={{ x: '-100%', y: '-100%' }}
            animate={{ x: '0%', y: '0%', transition: { duration: 0.28, ease: EXPO_EASE } }}
            exit={{ x: '-100%', y: '-100%', transition: { duration: 0.32, ease: EXPO_EASE } }}
          >
            <span className="font-display text-6xl font-extrabold tracking-widest text-outline-subtle select-none">
              ZANSHIN // SYSTEM
            </span>
          </motion.div>

          {/* Lower-Right Katana Shutter */}
          <motion.div
            className="absolute inset-0 bg-[#090e1a] bg-halftone flex items-end justify-end p-8"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            initial={{ x: '100%', y: '100%' }}
            animate={{ x: '0%', y: '0%', transition: { duration: 0.28, ease: EXPO_EASE } }}
            exit={{ x: '100%', y: '100%', transition: { duration: 0.32, ease: EXPO_EASE } }}
          >
            <span className="font-display text-6xl font-extrabold tracking-widest text-amber-400/20 select-none">
              INK DUELISTS
            </span>
          </motion.div>

          {/* Glowing White-Hot Diagonal Katana Seam */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0 }}
          >
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line
                x1="100"
                y1="0"
                x2="0"
                y2="100"
                stroke="#facc15"
                strokeWidth="0.9"
              />
              <line
                x1="100"
                y1="0"
                x2="0"
                y2="100"
                stroke="#ffffff"
                strokeWidth="0.35"
              />
            </svg>
          </motion.div>
        </motion.div>
      )}

      {kind === 'vs_curtain' && (
        <motion.div
          key="vs-curtain"
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden select-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28, ease: EXPO_EASE } }}
        >
          {/* Left P1 Diagonal Blade */}
          <motion.div
            className="absolute inset-0 bg-[#060913] bg-halftone flex items-center justify-start pl-8 sm:pl-16"
            style={{
              clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)',
            }}
            initial={{ x: '-105%' }}
            animate={{ x: '0%', transition: { duration: 0.34, ease: EXPO_EASE } }}
            exit={{ x: '-105%', transition: { duration: 0.36, ease: EXPO_EASE } }}
          >
            {/* Giant Hollow Watermark */}
            <span
              className="absolute left-4 top-6 font-display text-[9rem] font-extrabold leading-none tracking-tighter opacity-15"
              style={{ color: p1.accentColor }}
            >
              {p1.name}
            </span>

            <div className="relative z-10 flex items-center gap-5">
              <div
                className="p-1.5 border-2 bg-[#05070e]"
                style={{ borderColor: p1.accentColor }}
              >
                <FighterPortrait spec={p1} size={84} />
              </div>
              <div>
                <div className="inline-block px-2 py-0.5 text-[11px] font-mono-num font-bold text-slate-950 bg-amber-400 uppercase mb-1">
                  CHALLENGER 01
                </div>
                <div className="font-display text-5xl sm:text-6xl font-extrabold text-slate-50 leading-none tracking-tight">
                  {p1.name}
                </div>
                <div
                  className="font-mono-num text-xs font-bold uppercase tracking-widest mt-1"
                  style={{ color: p1.secondaryColor }}
                >
                  {p1.title} // {p1.archetype}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right P2 Diagonal Blade */}
          <motion.div
            className="absolute inset-0 bg-[#090d1b] bg-halftone flex items-center justify-end pr-8 sm:pr-16"
            style={{
              clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)',
            }}
            initial={{ x: '105%' }}
            animate={{ x: '0%', transition: { duration: 0.34, ease: EXPO_EASE } }}
            exit={{ x: '105%', transition: { duration: 0.36, ease: EXPO_EASE } }}
          >
            {/* Giant Hollow Watermark */}
            <span
              className="absolute right-4 bottom-6 font-display text-[9rem] font-extrabold leading-none tracking-tighter opacity-15"
              style={{ color: p2.accentColor }}
            >
              {p2.name}
            </span>

            <div className="relative z-10 flex flex-row-reverse items-center gap-5 text-right">
              <div
                className="p-1.5 border-2 bg-[#05070e]"
                style={{ borderColor: p2.accentColor }}
              >
                <FighterPortrait spec={p2} size={84} />
              </div>
              <div>
                <div className="inline-block px-2 py-0.5 text-[11px] font-mono-num font-bold text-white bg-rose-500 uppercase mb-1">
                  {config.mode === 'training' ? 'TRAINING DUMMY' : 'CHALLENGER 02'}
                </div>
                <div className="font-display text-5xl sm:text-6xl font-extrabold text-slate-50 leading-none tracking-tight">
                  {p2.name}
                </div>
                <div
                  className="font-mono-num text-xs font-bold uppercase tracking-widest mt-1"
                  style={{ color: p2.secondaryColor }}
                >
                  {p2.title} // {p2.archetype}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Center Diagonal Slash Line & Spinning VS Emblem */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              transition: { delay: 0.14, duration: 0.26, ease: EXPO_EASE },
            }}
            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.2 } }}
          >
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rotate-45 bg-amber-400 border-4 border-slate-950 shadow-2xl flex items-center justify-center">
                <span className="-rotate-45 font-display text-5xl font-extrabold text-slate-950 tracking-tighter">
                  VS
                </span>
              </div>
            </div>
            <div className="mt-6 px-4 py-1 bg-slate-950/95 border border-slate-700 text-[11px] font-mono-num uppercase tracking-widest text-slate-200">
              STAGE // <span className="text-amber-400 font-bold">{stage.name}</span> ·{' '}
              {config.ruleset === 'stock' ? `${config.stocksCount} STOCKS` : '1000 HP STAMINA'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
