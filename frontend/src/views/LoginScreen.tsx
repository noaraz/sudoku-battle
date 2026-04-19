import { useState } from "react";

import { Player } from "../models";

interface Props {
  knownPlayers: Player[];
  onSelect: (name: string) => void;
  onAdd: (name: string) => Promise<void>;
}

export function LoginScreen({ knownPlayers, onSelect, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await onAdd(name);
      onSelect(name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add player");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Who's playing?
      </h1>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {knownPlayers.length === 0 && !adding && (
          <p className="text-gray-400 text-sm text-center py-4">
            No players yet — add one below.
          </p>
        )}
        {knownPlayers.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.name)}
            className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {p.name[0].toUpperCase()}
            </div>
            <span className="flex-1 text-left text-gray-900 dark:text-white text-sm">
              {p.name}
            </span>
            <span className="text-gray-400 text-xs">{p.wins} wins</span>
          </button>
        ))}
        {adding ? (
          <div className="flex flex-col gap-2 mt-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="Your name"
              className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={() => void handleAdd()}
              className="bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-gray-400 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-3 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 text-gray-400 hover:border-zinc-400 transition-colors"
          >
            <div className="w-8 h-8 rounded-full border border-dashed border-zinc-400 flex items-center justify-center text-zinc-400 text-lg">
              +
            </div>
            <span className="text-sm">Add player</span>
          </button>
        )}
      </div>
    </div>
  );
}
