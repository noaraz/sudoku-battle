import type { Difficulty } from "../models";

const KEY = (d: Difficulty) => `bestTime:${d}`;

export function getBestTime(difficulty: Difficulty): number | null {
  const raw = localStorage.getItem(KEY(difficulty));
  return raw === null ? null : Number(raw);
}

export function recordTime(difficulty: Difficulty, seconds: number): void {
  const best = getBestTime(difficulty);
  if (best === null || seconds < best) {
    localStorage.setItem(KEY(difficulty), String(seconds));
  }
}
