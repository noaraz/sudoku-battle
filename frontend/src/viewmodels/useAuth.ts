import { useEffect, useState } from "react";

import { Player } from "../models";
import { createPlayer, getPlayers } from "../services/api";

interface AuthState {
  selectedPlayer: Player | null;
  knownPlayers: Player[];
  selectPlayer: (name: string) => void;
  addPlayer: (name: string) => Promise<void>;
}

const STORAGE_KEY = "selectedPlayer";

export function useAuth(): AuthState {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Player) : null;
  });
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([]);

  useEffect(() => {
    getPlayers()
      .then((players) =>
        [...players].sort((a, b) => a.name.localeCompare(b.name))
      )
      .then(setKnownPlayers)
      .catch(() => {
        // silently ignore network errors (e.g. backend not yet running)
      });
  }, []);

  function selectPlayer(name: string): void {
    const player = knownPlayers.find((p) => p.name === name) ?? {
      name,
      wins: 0,
      played: 0,
    };
    setSelectedPlayer(player);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  }

  async function addPlayer(name: string): Promise<void> {
    await createPlayer(name); // throws Error("name taken") on 409
    const updated = await getPlayers();
    setKnownPlayers([...updated].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return { selectedPlayer, knownPlayers, selectPlayer, addPlayer };
}
