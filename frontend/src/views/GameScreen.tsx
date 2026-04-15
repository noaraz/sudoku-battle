import { useEffect, useRef } from "react";
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
}

export function GameScreen({ seed, difficulty, onFinish }: GameScreenProps) {
  const game = useGame(seed, difficulty);
  const reported = useRef(false);

  useEffect(() => {
    if (game.isFinished && !reported.current) {
      reported.current = true;
      onFinish(game.timer);
    }
  }, [game.isFinished, game.timer, onFinish]);

  const highlightNum = game.selectedCell
    ? game.board[game.selectedCell.r][game.selectedCell.c].value || null
    : null;

  // In lightning mode, highlight the armed number on the pad; in default mode, highlight the selected cell's value
  const selectedNum = game.lightningMode
    ? game.lightningNum
    : highlightNum;

  return (
    <div className="flex flex-col items-center gap-4 p-4 min-h-screen bg-white dark:bg-gray-900">
      <Timer seconds={game.timer} />
      <Board
        board={game.board}
        selectedCell={game.selectedCell}
        highlightNum={highlightNum}
        onSelectCell={game.selectCell}
      />
      <NumPad numRemaining={game.numRemaining} onInput={game.inputNumber} selectedNum={selectedNum} />
      <ActionBar
        lightningMode={game.lightningMode}
        onUndo={game.undo}
        onErase={game.erase}
        onToggleLightning={game.toggleLightning}
      />
    </div>
  );
}
