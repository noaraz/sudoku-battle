import { useState } from "react";
import type { Player } from "../models";

interface Props {
  players: Player[];
  currentPlayer: string;
  onChallenge: (toPlayer: string, difficulty: string) => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  onBack: () => void;
}

const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

export function BattleMenu({ players, currentPlayer, onChallenge, onJoinByCode, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const others = players.filter((p) => p.name !== currentPlayer);

  async function handleChallenge(name: string) {
    try {
      setError(null);
      await onChallenge(name, difficulty);
    } catch {
      setError("Failed to send challenge. Please try again.");
    }
  }

  async function handleJoin() {
    if (code.trim().length !== 6) { setError("Enter a 6-character room code."); return; }
    try {
      setError(null);
      await onJoinByCode(code.trim().toUpperCase());
    } catch {
      setError("Room not found. Check the code and try again.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="mb-4 text-zinc-400 hover:text-white text-sm">← Back</button>
        <h1 className="text-2xl font-bold mb-6 text-center">Battle</h1>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-1 rounded text-sm capitalize ${difficulty === d ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4 mb-4">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Challenge a Player</p>
          {others.length === 0 ? (
            <p className="text-zinc-500 text-sm">No other players registered yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {others.map((p) => (
                <div key={p.name} className="flex items-center gap-3 bg-zinc-900 rounded-lg p-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <button
                    onClick={() => handleChallenge(p.name)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Challenge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Join by Room Code</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="K7X2AB"
              className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-center font-mono tracking-widest text-sm"
              maxLength={6}
            />
            <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 text-sm font-bold">
              Join
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
