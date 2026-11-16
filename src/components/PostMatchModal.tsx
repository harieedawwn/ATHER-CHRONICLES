import React from 'react';
import { Flame, Home, RotateCcw, Shield, Swords, Trophy, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { sound } from '../game/audio';
import { FIGHTERS } from '../game/fighters';
import { HUDState } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface PostMatchModalProps {
  hud: HUDState;
  onRematch: () => void;
  onChangeFighters: () => void;
  onMainMenu: () => void;
}

const EXPO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const HeadToHeadStatRow: React.FC<{
  label: string;
  icon: React.ReactNode;
  p1Value: number;
  p2Value: number;
  suffix?: string;
  p1Color: string;
  p2Color: string;
}> = ({ label, icon, p1Value, p2Value, suffix = '', p1Color, p2Color }) => {
  const total = Math.max(1, p1Value + p2Value);
  const p1Pct = p1Value === 0 && p2Value === 0 ? 50 : Math.round((p1Value / total) * 100);
  const p2Pct = 100 - p1Pct;

  return (
    <div className="p-2.5 bg-[#06070d]/90 border border-slate-800/90 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono-num font-extrabold text-slate-100">
          {p1Value}
          {suffix}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono-num text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {icon}
          {label}
        </span>
        <span className="font-mono-num font-extrabold text-slate-100">
          {p2Value}
          {suffix}
        </span>
      </div>
      <div className="flex items-center gap-1 h-2 -skew-x-12 overflow-hidden bg-slate-950 p-0.5 border border-slate-800">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${p1Pct}%`, backgroundColor: p1Color }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${p2Pct}%`, backgroundColor: p2Color }}
        />
      </div>
    </div>
  );
};

export const PostMatchModal: React.FC<PostMatchModalProps> = ({
  hud,
  onRematch,
  onChangeFighters,
  onMainMenu,
}) => {
  const winnerSpec =
    hud.winnerSlot === 0
      ? FIGHTERS[hud.p1.id]
      : hud.winnerSlot === 1
      ? FIGHTERS[hud.p2.id]
      : null;

  const title =
    hud.winnerSlot === 'draw'
      ? 'DRAW MATCH'
      : hud.winnerSlot === 0
      ? `${hud.p1.name} VICTORY`
      : `${hud.p2.name} VICTORY`;

  const subtitle =
    hud.winnerSlot === 0
      ? 'Player 1 claims the Zanshin Arena'
      : hud.winnerSlot === 1
      ? 'AI Challenger claims the Zanshin Arena'
      : 'Time expired with equal standing';

  return (
    <AnimatePresence>
      {hud.winnerSlot !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/82 backdrop-blur-xs flex items-center justify-center p-4 select-none"
        >
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.32, ease: EXPO_EASE }}
            className="clip-corner-cut relative w-full max-w-md bg-[#0b0e18] bg-halftone border border-slate-700/90 p-6 overflow-hidden shadow-2xl"
            style={{
              borderTopWidth: 4,
              borderTopColor: winnerSpec?.accentColor ?? '#f59e0b',
            }}
          >
            {/* Header Winner Banner */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
              {winnerSpec && (
                <div
                  className="p-1 border-2 bg-[#06070d]"
                  style={{ borderColor: winnerSpec.accentColor }}
                >
                  <FighterPortrait spec={winnerSpec} size={62} />
                </div>
              )}
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num font-bold uppercase tracking-widest text-amber-400">
                  <Trophy className="w-3.5 h-3.5" />
                  Match Complete · {hud.matchStats.durationSeconds}s
                </div>
                <h2 className="font-display text-5xl font-bold text-slate-50 tracking-wide uppercase leading-none mt-0.5">
                  {title}
                </h2>
                <p className="text-xs font-mono-num text-slate-400 mt-0.5">{subtitle}</p>
              </div>
            </div>

            {/* P1 vs P2 Visual Head-to-Head Breakdown */}
            <div className="my-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-display tracking-wider uppercase px-1">
                <span className="text-lg font-bold" style={{ color: hud.p1.accentColor }}>
                  P1 // {hud.p1.name}
                </span>
                <span className="text-[10px] font-mono-num text-slate-500">HEAD-TO-HEAD</span>
                <span className="text-lg font-bold" style={{ color: hud.p2.accentColor }}>
                  AI // {hud.p2.name}
                </span>
              </div>

              <HeadToHeadStatRow
                label="Damage Output"
                icon={<Flame className="w-3.5 h-3.5 text-amber-400" />}
                p1Value={hud.matchStats.p1DamageDealt}
                p2Value={hud.matchStats.p2DamageDealt}
                suffix="%"
                p1Color={hud.p1.accentColor}
                p2Color={hud.p2.accentColor}
              />

              <HeadToHeadStatRow
                label="Max Combo Chain"
                icon={<Swords className="w-3.5 h-3.5 text-rose-400" />}
                p1Value={hud.matchStats.p1MaxCombo}
                p2Value={hud.matchStats.p2MaxCombo}
                suffix=" HITS"
                p1Color={hud.p1.accentColor}
                p2Color={hud.p2.accentColor}
              />

              <HeadToHeadStatRow
                label="Parries & Counters"
                icon={<Shield className="w-3.5 h-3.5 text-sky-400" />}
                p1Value={hud.matchStats.p1Counters}
                p2Value={hud.matchStats.p2Counters}
                p1Color={hud.p1.accentColor}
                p2Color={hud.p2.accentColor}
              />
            </div>

            <div className="space-y-2.5">
              <button
                onMouseEnter={() => sound.playUiHover()}
                onClick={() => {
                  sound.unlock();
                  sound.playUiConfirm();
                  onRematch();
                }}
                className="clip-blade-r w-full flex items-center justify-center gap-2 py-2.5 text-xl font-display font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-110 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Instant Rematch
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onMouseEnter={() => sound.playUiHover()}
                  onClick={() => {
                    sound.unlock();
                    sound.playUiBack();
                    onChangeFighters();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono-num font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  Switch Fighters
                </button>
                <button
                  onMouseEnter={() => sound.playUiHover()}
                  onClick={() => {
                    sound.unlock();
                    sound.playUiBack();
                    onMainMenu();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono-num font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Title Screen
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
