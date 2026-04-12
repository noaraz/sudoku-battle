import type { Difficulty, RawBoard } from "../models";

// ── PRNG ──────────────────────────────────────────────────────────────────────

/** mulberry32 — fast seedable PRNG returning floats in [0, 1) */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Constraint checks ─────────────────────────────────────────────────────────

/** Returns true if placing `val` at (r, c) violates no row/col/box constraint. */
export function isValidPlacement(board: RawBoard, r: number, c: number, val: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === val) return false;
    if (board[i][c] === val) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (board[br + dr][bc + dc] === val) return false;
    }
  }
  return true;
}

// ── Solver (counts solutions, caps at 2) ──────────────────────────────────────

function countSolutions(board: RawBoard, limit: number): number {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      let count = 0;
      for (let v = 1; v <= 9; v++) {
        if (isValidPlacement(board, r, c, v)) {
          board[r][c] = v;
          count += countSolutions(board, limit - count);
          board[r][c] = 0;
          if (count >= limit) return count;
        }
      }
      return count;
    }
  }
  return 1; // no empty cell found — full valid board
}

/** Returns true if the board has exactly one solution. */
export function hasUniqueSolution(board: RawBoard): boolean {
  const copy = board.map((r) => [...r]);
  return countSolutions(copy, 2) === 1;
}

// ── Generator ─────────────────────────────────────────────────────────────────

const CLUE_COUNTS: Record<Difficulty, number> = {
  easy: 38,
  medium: 30,
  hard: 25,
  expert: 20,
};

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fillBoard(board: RawBoard, rand: () => number): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
        if (isValidPlacement(board, r, c, v)) {
          board[r][c] = v;
          if (fillBoard(board, rand)) return true;
          board[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

/**
 * Generates a Sudoku puzzle from a numeric seed.
 * Returns `{ puzzle, solution }` as 9×9 grids (0 = empty cell).
 */
export function generatePuzzle(
  seed: number,
  difficulty: Difficulty
): { puzzle: RawBoard; solution: RawBoard } {
  const rand = mulberry32(seed);
  const solution: RawBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(solution, rand);

  const puzzle: RawBoard = solution.map((r) => [...r]);
  const clues = CLUE_COUNTS[difficulty];
  const cells = shuffled(
    Array.from({ length: 81 }, (_, i) => i),
    rand
  );

  let removed = 0;
  for (const idx of cells) {
    if (81 - removed <= clues) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (!hasUniqueSolution(puzzle)) {
      puzzle[r][c] = backup; // restore — uniqueness violated
    } else {
      removed++;
    }
  }

  return { puzzle, solution };
}
