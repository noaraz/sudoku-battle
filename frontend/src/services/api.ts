const BASE = import.meta.env.VITE_API_URL ?? "";

export interface PlayerOut {
  name: string;
  wins: number;
  played: number;
  created_at: string;
}

export async function createPlayer(name: string): Promise<PlayerOut> {
  const res = await fetch(`${BASE}/api/v1/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.status === 409) throw new Error("name taken");
  if (!res.ok) throw new Error(`createPlayer failed: ${res.status}`);
  return res.json() as Promise<PlayerOut>;
}

export async function getPlayers(): Promise<PlayerOut[]> {
  const res = await fetch(`${BASE}/api/v1/players`);
  if (!res.ok) throw new Error(`getPlayers failed: ${res.status}`);
  return res.json() as Promise<PlayerOut[]>;
}

export async function getLeaderboard(): Promise<PlayerOut[]> {
  const res = await fetch(`${BASE}/api/v1/leaderboard`);
  if (!res.ok) throw new Error(`getLeaderboard failed: ${res.status}`);
  return res.json() as Promise<PlayerOut[]>;
}
