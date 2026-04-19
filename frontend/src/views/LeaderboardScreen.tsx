import { Player } from "../models";

interface Props {
  entries: Player[];
  loading: boolean;
  onBack: () => void;
}

export function LeaderboardScreen({ entries, loading, onBack }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-900 px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          aria-label="back"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Scores
        </h1>
      </div>
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No scores yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3"
            >
              <span
                className="text-sm font-bold w-4"
                style={{ color: i === 0 ? "#fbbf24" : "#6b7280" }}
              >
                {i + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {entry.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-gray-900 dark:text-white text-sm">
                {entry.name}
              </span>
              <span className="text-gray-400 text-xs">
                {entry.wins} wins · {entry.played} played
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
