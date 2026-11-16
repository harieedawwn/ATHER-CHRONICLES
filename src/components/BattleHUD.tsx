import React, { useState } from 'react';
import {
  Eye,
  Flame,
  Gamepad2,
  Home,
  Pause,
  Play,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { sound } from '../game/audio';
import { FIGHTERS } from '../game/fighters';
import { FighterHUDInfo, HUDState, InputState, TrainingBehavior } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface BattleHUDProps {
  hud: HUDState;
  onTogglePause: () => void;
  onRestart: () => void;
  onChangeFighters: () => void;
  onMainMenu: () => void;
  onTrainingBehavior: (b: TrainingBehavior) => void;
  onToggleHitboxes: () => void;
  onToggleAutoHeal: () => void;
  onResetTraining: () => void;
  onTouchInput: (patch: Partial<InputState>) => void;
}

const EXPO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FighterCard: React.FC<{
  info: FighterHUDInfo;
  ruleset: 'stock' | 'hp';
  align: 'left' | 'right';
  label: string;
}> = ({ info, ruleset, align, label }) => {
  const spec = FIGHTERS[info.id];
  const isRight = align === 'right';
  const hpPct = Math.max(0, Math.min(100, (info.hp / info.maxHp) * 100));

  const pctColor =
    info.damagePercent >= 120
      ? 'text-rose-400'
      : info.damagePercent >= 65
      ? 'text-amber-300'
      : 'text-slate-50';

  return (
    <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'} gap-1.5`}>
      <div
        className={`clip-corner-sm relative flex items-center gap-3 bg-[#060913]/92 border border-slate-800/95 px-3 py-2 backdrop-blur-xs shadow-xl ${
          isRight ? 'flex-row-reverse text-right' : 'flex-row text-left'
        }`}
        style={{
          borderLeftWidth: isRight ? 1 : 4,
          borderLeftColor: isRight ? undefined : info.accentColor,
          borderRightWidth: isRight ? 4 : 1,
          borderRightColor: isRight ? info.accentColor : undefined,
        }}
      >
        <div
          className="p-0.5 border bg-[#05070e]"
          style={{ borderColor: info.accentColor }}
        >
          <FighterPortrait spec={spec} size={42} />
        </div>

        <div className="min-w-[148px] sm:min-w-[186px]">
          {/* Header Row: Name + Slot Tag */}
          <div
            className={`flex items-baseline gap-2 ${
              isRight ? 'flex-row-reverse justify-start' : 'justify-between'
            }`}
          >
            <div className={`flex items-baseline gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
              <span className="font-display text-2xl font-bold text-slate-50 leading-none tracking-wider uppercase">
                {info.name}
              </span>
              <span className="text-[10px] font-mono-num text-slate-400 uppercase">
                {info.title}
              </span>
            </div>
            <span
              className="px-1.5 py-0.5 text-[10px] font-mono-num font-extrabold text-slate-950 leading-none -skew-x-12"
              style={{ backgroundColor: info.accentColor }}
            >
              {label}
            </span>
          </div>

          {/* Life / Damage Readout */}
          {ruleset === 'stock' ? (
            <div
              className={`flex items-center justify-between gap-3 mt-1 ${
                isRight ? 'flex-row-reverse' : ''
              }`}
            >
              <motion.div
                key={info.damagePercent}
                initial={{ scale: 1.22 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.16, ease: EXPO_EASE }}
                className={`flex items-baseline gap-0.5 ${isRight ? 'flex-row-reverse' : ''}`}
              >
                <span className={`font-mono-num text-2xl font-extrabold leading-none ${pctColor}`}>
                  {info.damagePercent}
                </span>
                <span className="font-mono-num text-xs font-bold text-slate-400">%</span>
              </motion.div>

              <div className="flex items-center gap-1.5 px-1" aria-label={`${info.stocks} stocks remaining`}>
                {Array.from({ length: Math.max(0, info.stocks) }).map((_, idx) => (
                  <span
                    key={idx}
                    className="w-2.5 h-2.5 inline-block rotate-45 border border-slate-950 shadow-xs"
                    style={{
                      backgroundColor: info.accentColor,
                      boxShadow: `0 0 8px ${info.accentColor}88`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="relative w-full h-3 bg-slate-950 border border-slate-700/90 -skew-x-12 overflow-hidden">
                <div
                  className="absolute inset-y-0 bg-rose-400/75 transition-[width] duration-500 ease-expo"
                  style={{
                    width: `${hpPct}%`,
                    right: isRight ? 0 : undefined,
                    left: isRight ? undefined : 0,
                  }}
                />
                <div
                  className="relative h-full transition-[width] duration-75"
                  style={{
                    width: `${hpPct}%`,
                    backgroundColor: hpPct < 25 ? '#ef4444' : info.accentColor,
                    marginLeft: isRight ? 'auto' : undefined,
                  }}
                />
              </div>
              <div
                className={`flex items-center justify-between font-mono-num text-[10px] font-bold text-slate-300 mt-0.5 ${
                  isRight ? 'flex-row-reverse' : ''
                }`}
              >
                <span>
                  HP {info.hp}/{info.maxHp}
                </span>
                <span>{info.damagePercent}% DMG</span>
              </div>
            </div>
          )}

          {/* Signature Gauge Bar */}
          <div className={`mt-1.5 flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
            <div className="flex-1 h-1.5 bg-slate-950 border border-slate-800 -skew-x-12 overflow-hidden">
              <div
                className="h-full transition-[width] duration-150 ease-expo"
                style={{
                  width: `${info.gauge}%`,
                  backgroundColor: info.isOverdrive ? '#facc15' : info.secondaryColor,
                  marginLeft: isRight ? 'auto' : undefined,
                }}
              />
            </div>
            <span className="font-mono-num text-[10px] font-bold text-slate-300 leading-none">
              {info.gaugeLabel} {info.gauge}%
            </span>
          </div>

          {/* Unblockable Ultimate Awakening Bar [V] */}
          <div className={`mt-1 flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex-1 h-2 bg-slate-950 border -skew-x-12 overflow-hidden ${
                info.ultimateGauge >= 100
                  ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
                  : 'border-slate-800'
              }`}
            >
              <div
                className="h-full transition-[width] duration-150 ease-expo"
                style={{
                  width: `${info.ultimateGauge}%`,
                  background:
                    info.ultimateGauge >= 100
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444, #fde047)'
                      : info.accentColor,
                  marginLeft: isRight ? 'auto' : undefined,
                }}
              />
            </div>
            <span
              className={`font-mono-num text-[10px] font-extrabold leading-none ${
                info.ultimateGauge >= 100
                  ? 'px-1 py-0.5 bg-amber-400 text-slate-950 -skew-x-12 animate-pulse'
                  : 'text-amber-300/90'
              }`}
            >
              {info.ultimateGauge >= 100 ? '[V] ULTIMATE' : `ULT ${info.ultimateGauge}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Animated Signature Mechanic Banner & Afflicted Cinder Marks */}
      <div className={`flex items-center gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
        <AnimatePresence>
          {info.statusBanner && (
            <motion.div
              key={info.statusBanner}
              initial={{ opacity: 0, x: isRight ? 12 : -12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: EXPO_EASE }}
              className="px-2.5 py-0.5 text-[10px] font-mono-num font-extrabold uppercase tracking-wider text-slate-950 -skew-x-12 shadow-md"
              style={{ backgroundColor: info.secondaryColor }}
            >
              {info.statusBanner}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {info.cinderMarks > 0 && (
            <motion.div
              key={`cinder-${info.cinderMarks}`}
              initial={{ scale: 1.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1 px-2 py-0.5 bg-orange-950/95 border border-orange-500 text-[10px] font-mono-num font-bold text-orange-300 -skew-x-12"
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>CINDER x{info.cinderMarks}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const BattleHUD: React.FC<BattleHUDProps> = ({
  hud,
  onTogglePause,
  onRestart,
  onChangeFighters,
  onMainMenu,
  onTrainingBehavior,
  onToggleHitboxes,
  onToggleAutoHeal,
  onResetTraining,
  onTouchInput,
}) => {
  const [muted, setMuted] = useState(sound.isMuted());
  const [showTouchPad, setShowTouchPad] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );

  const toggleMute = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  };

  const holdTouch = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput({ [key]: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput({ [key]: false });
    },
    onPointerLeave: () => onTouchInput({ [key]: false }),
    onPointerCancel: () => onTouchInput({ [key]: false }),
  });

  const getComboCallout = (hits: number) => {
    if (hits >= 8) return 'GODLIKE!';
    if (hits >= 5) return 'BLITZKRIEG!';
    return 'RUSHDOWN!';
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4 select-none">
      {/* Top Broadcast Row: P1 Wing Plate · Center Timer & Utility · P2 Wing Plate */}
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-col items-start gap-1.5">
          <FighterCard info={hud.p1} ruleset={hud.ruleset} align="left" label="P1" />
          <AnimatePresence>
            {hud.p1.comboCount >= 2 && (
              <motion.div
                key={hud.p1.comboCount}
                initial={{ scale: 1.35, x: -10, opacity: 0 }}
                animate={{ scale: 1, x: 0, opacity: 1 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: EXPO_EASE }}
                className="clip-blade-r px-3.5 py-1 bg-amber-400 text-slate-950 flex items-baseline gap-2 shadow-lg"
              >
                <span className="font-display text-2xl font-extrabold leading-none">
                  {hud.p1.comboCount} HITS
                </span>
                <span className="font-mono-num text-[10px] font-extrabold uppercase tracking-wider">
                  {getComboCallout(hud.p1.comboCount)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center Timer & Utility Buttons */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <div className="clip-slant bg-[#060913]/95 border border-slate-700/90 px-4 py-1 shadow-lg">
            <span className="font-mono-num text-xl font-extrabold text-slate-50 leading-none block">
              {hud.mode === 'training' ? 'LAB' : String(hud.timerSeconds).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePause}
              title="Pause (Esc)"
              className="p-1.5 bg-[#060913]/90 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-400 transition-colors cursor-pointer"
            >
              {hud.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={toggleMute}
              title="Mute / Unmute"
              className="p-1.5 bg-[#060913]/90 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-400 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowTouchPad((v) => !v)}
              title="Toggle On-Screen Touch Controls"
              className={`p-1.5 bg-[#060913]/90 border text-slate-300 hover:text-slate-100 cursor-pointer ${
                showTouchPad ? 'border-amber-400 text-amber-300' : 'border-slate-800'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <FighterCard
            info={hud.p2}
            ruleset={hud.ruleset}
            align="right"
            label={hud.mode === 'training' ? 'DUMMY' : 'AI'}
          />
          <AnimatePresence>
            {hud.p2.comboCount >= 2 && (
              <motion.div
                key={hud.p2.comboCount}
                initial={{ scale: 1.35, x: 10, opacity: 0 }}
                animate={{ scale: 1, x: 0, opacity: 1 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18, ease: EXPO_EASE }}
                className="clip-blade-l px-3.5 py-1 bg-rose-500 text-white flex items-baseline gap-2 shadow-lg"
              >
                <span className="font-mono-num text-[10px] font-extrabold uppercase tracking-wider">
                  {getComboCallout(hud.p2.comboCount)}
                </span>
                <span className="font-display text-2xl font-extrabold leading-none">
                  {hud.p2.comboCount} HITS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Snappy 3 / 2 / 1 / FIGHT! Pre-Match Countdown Banner */}
      <AnimatePresence mode="wait">
        {hud.countdownLabel && (
          <motion.div
            key={hud.countdownLabel}
            initial={{ scale: 1.65, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.78, opacity: 0 }}
            transition={{ duration: 0.16, ease: EXPO_EASE }}
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
          >
            <div className="relative flex flex-col items-center">
              <span
                className={`font-display font-extrabold italic tracking-tighter uppercase -skew-x-12 select-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)] ${
                  hud.countdownLabel === 'FIGHT!'
                    ? 'text-7xl sm:text-9xl text-amber-400'
                    : 'text-8xl sm:text-9xl text-slate-50'
                }`}
              >
                {hud.countdownLabel}
              </span>
              <div
                className={`h-1.5 -skew-x-12 mt-1 ${
                  hud.countdownLabel === 'FIGHT!' ? 'w-56 bg-amber-400' : 'w-20 bg-sky-400'
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Training Room Controls Strip */}
      {hud.mode === 'training' && (
        <div className="pointer-events-auto self-start mt-auto mb-2 clip-corner-sm flex flex-wrap items-center gap-2 bg-[#060913]/95 border border-slate-800 px-3 py-2 text-xs shadow-lg">
          <div className="font-mono-num text-slate-300 pr-2 border-r border-slate-700">
            Last Combo: <strong className="text-amber-400">{hud.training.lastComboHits} hits</strong> ·{' '}
            <strong className="text-slate-100">{hud.training.lastComboDamage}%</strong>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 mr-1 font-mono-num text-[11px]">DUMMY:</span>
            {(['idle', 'guard', 'counter', 'attack', 'recover'] as TrainingBehavior[]).map((b) => (
              <button
                key={b}
                onClick={() => onTrainingBehavior(b)}
                className={`px-2 py-1 capitalize border font-mono-num text-[11px] cursor-pointer transition-colors ${
                  hud.training.dummyBehavior === b
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleHitboxes}
            className={`flex items-center gap-1 px-2 py-1 border font-mono-num text-[11px] cursor-pointer ${
              hud.training.showHitboxes
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Eye className="w-3 h-3" />
            Hitboxes
          </button>

          <button
            onClick={onToggleAutoHeal}
            className={`px-2 py-1 border font-mono-num text-[11px] cursor-pointer ${
              hud.training.autoHeal
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            Auto-Heal: {hud.training.autoHeal ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={onResetTraining}
            className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400 font-mono-num text-[11px] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      )}

      {/* Optional On-Screen Touch Controls (Mobile / Tablet / Toggle) */}
      {showTouchPad && (
        <div className="pointer-events-auto flex items-end justify-between gap-4 pb-1 mt-auto">
          <div className="grid grid-cols-3 gap-1.5 w-36">
            <div />
            <button
              {...holdTouch('up')}
              className="h-11 bg-slate-900/85 border border-slate-600 text-slate-100 font-bold text-xs active:bg-amber-400 active:text-slate-950 touch-none"
            >
              W
            </button>
            <div />
            <button
              {...holdTouch('left')}
              className="h-11 bg-slate-900/85 border border-slate-600 text-slate-100 font-bold text-xs active:bg-amber-400 active:text-slate-950 touch-none"
            >
              A
            </button>
            <button
              {...holdTouch('down')}
              className="h-11 bg-slate-900/85 border border-slate-600 text-slate-100 font-bold text-xs active:bg-amber-400 active:text-slate-950 touch-none"
            >
              S
            </button>
            <button
              {...holdTouch('right')}
              className="h-11 bg-slate-900/85 border border-slate-600 text-slate-100 font-bold text-xs active:bg-amber-400 active:text-slate-950 touch-none"
            >
              D
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              {...holdTouch('ultimate')}
              className="w-12 h-11 bg-amber-950/90 border border-amber-400 text-amber-200 font-bold text-[11px] active:bg-amber-400 active:text-slate-950 touch-none"
            >
              V · ULT
            </button>
            <button
              {...holdTouch('special')}
              className="w-12 h-11 bg-purple-950/85 border border-purple-400 text-purple-100 font-bold text-xs active:bg-purple-400 active:text-slate-950 touch-none"
            >
              J · SP
            </button>
            <button
              {...holdTouch('light')}
              className="w-12 h-11 bg-sky-950/85 border border-sky-400 text-sky-100 font-bold text-xs active:bg-sky-400 active:text-slate-950 touch-none"
            >
              K · LT
            </button>
            <button
              {...holdTouch('strong')}
              className="w-12 h-11 bg-rose-950/85 border border-rose-400 text-rose-100 font-bold text-xs active:bg-rose-400 active:text-slate-950 touch-none"
            >
              L · ST
            </button>
            <button
              {...holdTouch('taunt')}
              className="w-12 h-11 bg-emerald-950/85 border border-emerald-400 text-emerald-200 font-bold text-[10px] active:bg-emerald-400 active:text-slate-950 touch-none"
            >
              T · TNT
            </button>
            <button
              {...holdTouch('shortHop')}
              className="w-12 h-11 bg-slate-900/85 border border-slate-500 text-slate-100 font-bold text-[11px] active:bg-slate-300 active:text-slate-950 touch-none"
            >
              C · HOP
            </button>
            <button
              {...holdTouch('jump')}
              className="w-12 h-11 bg-amber-950/85 border border-amber-400 text-amber-100 font-bold text-[11px] active:bg-amber-400 active:text-slate-950 touch-none"
            >
              JUMP
            </button>
            <button
              {...holdTouch('dash')}
              className="w-12 h-11 bg-slate-900/85 border border-slate-500 text-slate-100 font-bold text-[11px] active:bg-slate-300 active:text-slate-950 touch-none"
            >
              P · D/P
            </button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      <AnimatePresence>
        {hud.paused && hud.winnerSlot === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 12 }}
              transition={{ duration: 0.22, ease: EXPO_EASE }}
              className="clip-corner-cut w-full max-w-xs bg-[#090e1c] border border-slate-700 p-5 space-y-2.5"
            >
              <h2 className="font-display text-2xl font-extrabold text-slate-100 text-center pb-2 border-b border-slate-800 tracking-wider uppercase">
                MATCH PAUSED
              </h2>
              <button
                onClick={onTogglePause}
                className="clip-blade-r w-full py-2.5 text-sm font-display font-extrabold uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
              >
                Resume Duel
              </button>
              <button
                onClick={onRestart}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-mono-num font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Match
              </button>
              <button
                onClick={onChangeFighters}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-mono-num font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Fighter Select
              </button>
              <button
                onClick={onMainMenu}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-mono-num font-bold uppercase text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                Title Screen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
