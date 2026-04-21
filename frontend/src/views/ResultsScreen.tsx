import type { Difficulty } from "../models";
import { getBestTime } from "../utils/bestTimes";

interface BattleResult {
  winner: string;
  winner_time_ms: number;
  loser_time_ms: number | null;
  playerName: string;
  opponentName: string;
}

interface ResultsScreenProps {
  difficulty: Difficulty;
  seconds: number;
  onPlayAgain: () => void;
  battleResult?: BattleResult;
  onViewScores?: () => void;
}

function format(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ResultsScreen({ difficulty, seconds, onPlayAgain, battleResult, onViewScores }: ResultsScreenProps) {
  if (battleResult) {
    const { winner, winner_time_ms, playerName, opponentName } = battleResult;
    const youWon = winner === playerName;
    const fmtMs = (ms: number) => {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    const loserName = winner === playerName ? opponentName : playerName;
    const isYou = loserName === playerName;

    return (
      <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xs text-center">
          <div className="text-5xl mb-3">{youWon ? "👑" : "😤"}</div>
          <h2 className={`text-2xl font-bold mb-8 ${youWon ? "text-white" : "text-zinc-400"}`}>
            {youWon ? "You won!" : "You lost"}
          </h2>

          <div className="flex flex-col gap-3 mb-8">
            <div className={`flex items-center gap-3 rounded-lg p-3 ${winner === playerName ? "bg-blue-600" : "bg-zinc-800"}`}>
              <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-sm font-bold">
                {winner.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-left text-sm">{winner} 👑</span>
              <span className="font-mono text-sm">{fmtMs(winner_time_ms)}</span>
            </div>

            <div className={`flex items-center gap-3 rounded-lg p-3 bg-zinc-800 ${isYou ? "border border-zinc-600" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                {loserName.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-left text-sm text-zinc-400">{loserName}{isYou ? " (you)" : ""}</span>
              <span className="font-mono text-sm text-zinc-400">DNF</span>
            </div>
          </div>

          <div className="flex gap-3">
            {onViewScores && (
              <button onClick={onViewScores} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-3 text-sm text-zinc-300">
                Scores
              </button>
            )}
            <button onClick={onPlayAgain} className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg py-3 text-sm font-bold">
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

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
