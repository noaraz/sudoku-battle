import { useEffect, useState } from "react";

import { Player } from "../models";
import { createPlayer, getPlayers } from "../services/api";

interface AuthState {
  selectedPlayer: Player | null;
  knownPlayers: Player[];
  selectPlayer: (name: string) => void;
  addPlayer: (name: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "selectedPlayer";

export function useAuth(): AuthState {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([]);

  useEffect(() => {
    getPlayers()
      .then((players) => {
        const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
        setKnownPlayers(sorted);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const storedName = (JSON.parse(stored) as Player).name;
          const match = players.find((p) => p.name === storedName);
          if (match) {
            setSelectedPlayer(match);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      })
      .catch(() => {});
  }, []);

  function selectPlayer(name: string): void {
    const player = knownPlayers.find((p) => p.name === name) ?? { name, wins: 0, played: 0 };
    setSelectedPlayer(player);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  }

  async function addPlayer(name: string): Promise<void> {
    await createPlayer(name);
    const updated = await getPlayers();
    setKnownPlayers([...updated].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function logout(): void {
    setSelectedPlayer(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return { selectedPlayer, knownPlayers, selectPlayer, addPlayer, logout };
}
