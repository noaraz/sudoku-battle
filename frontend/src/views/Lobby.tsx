import type { Difficulty } from "../models";

interface LobbyProps {
  onStart: (difficulty: Difficulty) => void;
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

export function Lobby({ onStart }: LobbyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-screen bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold">Sudoku Battle</h1>
      <p className="text-gray-500 dark:text-gray-400">Pick a difficulty to start</p>
      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => onStart(d)}
            className="capitalize py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-semibold text-lg transition-transform"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
