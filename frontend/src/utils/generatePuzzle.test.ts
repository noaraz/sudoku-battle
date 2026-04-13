import { describe, it, expect } from "vitest";
import { generatePuzzle } from "./puzzle";
import type { Difficulty } from "../models";

describe("generatePuzzle", () => {
  it("is deterministic — same seed + difficulty yields identical puzzle", () => {
    const a = generatePuzzle(12345, "medium");
    const b = generatePuzzle(12345, "medium");
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });

  it("differs across seeds", () => {
    const a = generatePuzzle(1, "easy");
    const b = generatePuzzle(2, "easy");
    expect(a.puzzle).not.toEqual(b.puzzle);
  });

  const difficulties: Array<[Difficulty, number, number]> = [
    ["easy",   36, 42],
    ["medium", 27, 33],
    ["hard",   22, 28],
    ["expert", 18, 26],
  ];

  it.each(difficulties)(
    "%s puzzle has clue count within expected range [%i, %i]",
    (diff, lo, hi) => {
      const { puzzle } = generatePuzzle(99999, diff);
      const clues = puzzle.flat().filter((v) => v !== 0).length;
      expect(clues).toBeGreaterThanOrEqual(lo);
      expect(clues).toBeLessThanOrEqual(hi);
    }
  );

  it("solution has no conflicts (valid completed Sudoku)", () => {
    const { solution } = generatePuzzle(42, "hard");
    for (let r = 0; r < 9; r++) {
      const row = new Set(solution[r]);
      expect(row.size).toBe(9);
    }
    for (let c = 0; c < 9; c++) {
      const col = new Set(solution.map((row) => row[c]));
      expect(col.size).toBe(9);
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const box = new Set<number>();
        for (let dr = 0; dr < 3; dr++)
          for (let dc = 0; dc < 3; dc++)
            box.add(solution[br * 3 + dr][bc * 3 + dc]);
        expect(box.size).toBe(9);
      }
    }
  });

  it("every given in puzzle matches the solution", () => {
    const { puzzle, solution } = generatePuzzle(7, "easy");
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) {
          expect(puzzle[r][c]).toBe(solution[r][c]);
        }
      }
    }
  });
});
