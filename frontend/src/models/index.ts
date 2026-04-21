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

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface Room {
  room_id: string;
  host: string;
  guest: string | null;
  difficulty: Difficulty;
  seed: number;
  status: RoomStatus;
}

export interface GameResult {
  winner: string;
  winner_time_ms: number;
  loser_time_ms: number | null;
}

export type WsInMessage =
  | { type: "ROOM_STATE"; room_id: string; host: string; guest: string | null; difficulty: string; seed: number; status: string }
  | { type: "COUNTDOWN"; n: number }
  | { type: "OPPONENT_PROGRESS"; cells_filled: number }
  | { type: "GAME_RESULTS"; winner: string; winner_time_ms: number; loser_time_ms: number | null }
  | { type: "OPPONENT_DISCONNECTED" }
  | { type: "ERROR"; code: string; message: string };

export type WsOutMessage =
  | { type: "HEARTBEAT" }
  | { type: "PROGRESS"; cells_filled: number }
  | { type: "SUBMIT_RESULT"; time_ms: number };
