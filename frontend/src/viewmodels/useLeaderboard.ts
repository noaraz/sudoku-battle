import { useState } from "react";

import { Player } from "../models";
import { getLeaderboard } from "../services/api";

interface LeaderboardState {
  entries: Player[];
  loading: boolean;
  load: () => Promise<void>;
}

export function useLeaderboard(): LeaderboardState {
  const [entries, setEntries] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  return { entries, loading, load };
}
