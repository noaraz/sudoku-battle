import type { Difficulty } from "../models";
import { getBestTime } from "../utils/bestTimes";

interface ResultsScreenProps {
  difficulty: Difficulty;
  seconds: number;
  onPlayAgain: () => void;
}

function format(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ResultsScreen({ difficulty, seconds, onPlayAgain }: ResultsScreenProps) {
  const best = getBestTime(difficulty);
  const isNewBest = best === seconds;

  return (
    <div className="flex flex-col items-center justify-center gap-6 min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-2xl font-bold">Puzzle Complete!</h2>
      <p className="text-4xl font-mono">{format(seconds)}</p>
      {isNewBest && (
        <p className="text-yellow-400 font-semibold">New personal best!</p>
      )}
      {best !== null && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Best ({difficulty}): {format(best)}
        </p>
      )}
      <button
        onClick={onPlayAgain}
        className="px-8 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-semibold text-lg transition-transform"
      >
        Play Again
      </button>
    </div>
  );
}
