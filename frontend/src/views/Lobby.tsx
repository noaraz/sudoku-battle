import { useState } from "react";

import { Difficulty } from "../models";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

interface Props {
  onSolo: (difficulty: Difficulty) => void;
  onScores: () => void;
}

export function Lobby({ onSolo, onScores }: Props) {
  const [showDifficulty, setShowDifficulty] = useState(false);

  if (showDifficulty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
        <button
          onClick={() => setShowDifficulty(false)}
          className="mb-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 self-start"
        >
          ← Back
        </button>
        <div className="w-full max-w-sm flex flex-col gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => onSolo(d)}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-4 rounded-xl text-base capitalize transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => setShowDifficulty(true)}
          className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl px-5 py-4 transition-colors"
        >
          <span className="text-2xl">🧩</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Solo
            </div>
            <div className="text-gray-400 text-xs">Play at your own pace</div>
          </div>
        </button>

        <div className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-5 py-4 opacity-40 cursor-not-allowed">
          <span className="text-2xl">⚔️</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Battle
            </div>
            <div className="text-gray-400 text-xs">coming soon</div>
          </div>
        </div>

        <button
          onClick={onScores}
          className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl px-5 py-4 transition-colors"
        >
          <span className="text-2xl">📊</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Scores
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
