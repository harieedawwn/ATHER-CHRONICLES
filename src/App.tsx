import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleHUD } from './components/BattleHUD';
import { MatchSetup } from './components/MatchSetup';
import { PostMatchModal } from './components/PostMatchModal';
import { ScreenTransition, TransitionKind } from './components/ScreenTransition';
import { TitleScreen } from './components/TitleScreen';
import { sound } from './game/audio';
import { GameEngine } from './game/engine';
import {
  GameMode,
  HUDState,
  InputState,
  MatchConfig,
  ScreenView,
  TrainingBehavior,
} from './game/types';

const STORAGE_KEY = 'inkblitz_match_config_v1';

const DEFAULT_CONFIG: MatchConfig = {
  mode: 'vs_ai',
  ruleset: 'stock',
  p1Fighter: 'raijin',
  p2Fighter: 'chrono',
  aiDifficulty: 'normal',
  stageId: 'torii',
  stocksCount: 3,
};

function loadConfig(): MatchConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('title');
  const [config, setConfig] = useState<MatchConfig>(loadConfig);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>('none');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const transitionTimers = useRef<number[]>([]);

  const clearTransitionTimers = () => {
    for (const id of transitionTimers.current) {
      window.clearTimeout(id);
    }
    transitionTimers.current = [];
  };

  const runScreenTransition = useCallback(
    (kind: TransitionKind, nextScreen: ScreenView, holdMs: number, onMidpoint?: () => void) => {
      clearTransitionTimers();
      setTransitionKind(kind);
      const t1 = window.setTimeout(() => {
        onMidpoint?.();
        setScreen(nextScreen);
      }, Math.round(holdMs * 0.48));
      const t2 = window.setTimeout(() => {
        setTransitionKind('none');
      }, holdMs);
      transitionTimers.current.push(t1, t2);
    },
    []
  );

  useEffect(() => {
    return () => clearTransitionTimers();
  }, []);

  const updateConfig = useCallback((next: MatchConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      updateConfig({ ...config, mode });
      runScreenTransition('slash', 'setup', 520);
    },
    [config, updateConfig, runScreenTransition]
  );

  const handleStartFight = useCallback(() => {
    sound.playClash();
    runScreenTransition(
      config.mode === 'vs_ai' ? 'vs_curtain' : 'slash',
      'battle',
      config.mode === 'vs_ai' ? 920 : 520,
      () => {
        setMatchKey((k) => k + 1);
      }
    );
  }, [config.mode, runScreenTransition]);

  const handleBackToTitle = useCallback(() => {
    runScreenTransition('slash', 'title', 500);
  }, [runScreenTransition]);

  const handleGoToSetup = useCallback(() => {
    runScreenTransition('slash', 'setup', 500);
  }, [runScreenTransition]);

  useEffect(() => {
    if (screen !== 'battle') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(config, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;
    engine.mount(canvas);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [screen, matchKey, config]);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartMatch();
  }, []);

  const handleTrainingBehavior = useCallback((b: TrainingBehavior) => {
    engineRef.current?.setTrainingBehavior(b);
  }, []);

  const handleToggleHitboxes = useCallback(() => {
    if (!engineRef.current || !hud) return;
    engineRef.current.setShowHitboxes(!hud.training.showHitboxes);
  }, [hud]);

  const handleToggleAutoHeal = useCallback(() => {
    if (!engineRef.current || !hud) return;
    engineRef.current.setAutoHeal(!hud.training.autoHeal);
  }, [hud]);

  const handleResetTraining = useCallback(() => {
    engineRef.current?.resetTrainingPositions();
  }, []);

  const handleTouchInput = useCallback((patch: Partial<InputState>) => {
    engineRef.current?.setTouchInput(patch);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#05070e] overflow-hidden">
      <ScreenTransition kind={transitionKind} config={config} />

      {screen === 'title' && <TitleScreen onSelectMode={handleSelectMode} />}

      {screen === 'setup' && (
        <MatchSetup
          config={config}
          onChange={updateConfig}
          onBack={handleBackToTitle}
          onStartFight={handleStartFight}
        />
      )}

      {screen === 'battle' && (
        <div className="relative w-full h-full bg-[#05070e] flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            className="pixel-canvas w-full h-full object-contain"
          />
          {hud && (
            <>
              <BattleHUD
                hud={hud}
                onTogglePause={handleTogglePause}
                onRestart={handleRestart}
                onChangeFighters={handleGoToSetup}
                onMainMenu={handleBackToTitle}
                onTrainingBehavior={handleTrainingBehavior}
                onToggleHitboxes={handleToggleHitboxes}
                onToggleAutoHeal={handleToggleAutoHeal}
                onResetTraining={handleResetTraining}
                onTouchInput={handleTouchInput}
              />
              <PostMatchModal
                hud={hud}
                onRematch={handleRestart}
                onChangeFighters={handleGoToSetup}
                onMainMenu={handleBackToTitle}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
