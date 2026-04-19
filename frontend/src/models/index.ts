export type Difficulty = "easy" | "medium" | "hard" | "expert";

/** Raw 9x9 grid: 0 = empty, 1–9 = digit */
export type RawBoard = number[][];

export interface Cell {
  value: number;      // 0 = empty
  isGiven: boolean;
  hasError: boolean;
}

export type Board = Cell[][];

export interface Player {
  name: string;
  wins: number;
  played: number;
}
