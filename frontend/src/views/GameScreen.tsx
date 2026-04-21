import { useEffect, useMemo, useRef } from "react";
import { useGame } from "../viewmodels/useGame";
import type { Difficulty } from "../models";
import { Timer } from "./Timer";
import { Board } from "./Board";
import { NumPad } from "./NumPad";
import { ActionBar } from "./ActionBar";

interface GameScreenProps {
  seed: number;
  difficulty: Difficulty;
  onFinish: (seconds: number) => void;
  battleMode?: boolean;
  opponentName?: string;
  opponentProgress?: number;
  onProgressChange?: (cellsFilled: number) => void;
}

export function GameScreen({ seed, difficulty, onFinish, battleMode, opponentName, opponentProgress, onProgressChange }: GameScreenProps) {
  const game = useGame(seed, difficulty);
  const reported = useRef(false);

  // Count all filled cells (givens + user) so the bar starts non-empty
  const playerProgress = useMemo(
    () => game.board.flat().filter(c => c.value !== 0).length,
    [game.board]
  );

  useEffect(() => {
    if (game.isFinished && !reported.current) {
      reported.current = true;
      onFinish(game.timer);
    }
  }, [game.isFinished, game.timer, onFinish]);

  // Report progress via WS only when it changes; use ref to avoid stale closure
  const onProgressChangeRef = useRef(onProgressChange);
  useEffect(() => { onProgressChangeRef.current = onProgressChange; }, [onProgressChange]);
  const prevProgress = useRef(-1);
  useEffect(() => {
    if (battleMode && playerProgress !== prevProgress.current) {
      prevProgress.current = playerProgress;
      onProgressChangeRef.current?.(playerProgress);
    }
  }, [playerProgress, battleMode]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 min-h-screen bg-white dark:bg-zinc-900">
      {battleMode && (
        <div className="w-full max-w-[360px] bg-zinc-800 border-b border-zinc-700 px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-blue-400 w-20 shrink-0">You</span>
            <div className="flex-1 bg-zinc-700 rounded h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded transition-all duration-300"
                style={{ width: `${((playerProgress ?? 0) / 81) * 100}%` }}
              />
            </div>
            <span className="text-xs text-blue-400 w-8 text-right">{playerProgress ?? 0}/81</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 w-20 shrink-0 truncate">{opponentName ?? "?"}</span>
            <div className="flex-1 bg-zinc-700 rounded h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded transition-all duration-300"
                style={{ width: `${((opponentProgress ?? 0) / 81) * 100}%` }}
              />
            </div>
            <span className="text-xs text-emerald-400 w-8 text-right">{opponentProgress ?? 0}/81</span>
          </div>
        </div>
      )}
      <Timer seconds={game.timer} />
      <Board
        board={game.board}
        selectedCell={game.selectedCell}
        highlightNum={game.highlightNum}
        onSelectCell={game.selectCell}
      />
      <NumPad
        numRemaining={game.numRemaining}
        onInput={game.inputNumber}
        selectedNum={game.lightningMode ? game.lightningNum : null}
      />
      <ActionBar
        lightningMode={game.lightningMode}
        onUndo={game.undo}
        onErase={game.erase}
        onToggleLightning={game.toggleLightning}
      />
    </div>
  );
}
