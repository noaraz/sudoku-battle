import { describe, it, expect } from "vitest";
import {
  mulberry32,
  isValidPlacement,
  hasUniqueSolution,
} from "./puzzle";

// ── mulberry32 ────────────────────────────────────────────────────────────────

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBeCloseTo(r2(), 10);
    expect(r1()).toBeCloseTo(r2(), 10);
  });

  it("returns values in [0, 1)", () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const r1 = mulberry32(1);
    const r2 = mulberry32(2);
    // extremely unlikely that first value matches across seeds
    expect(r1()).not.toBeCloseTo(r2(), 5);
  });
});

// ── isValidPlacement ──────────────────────────────────────────────────────────

describe("isValidPlacement", () => {
  const empty: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  it("allows placing any digit in an empty board", () => {
    expect(isValidPlacement(empty, 0, 0, 5)).toBe(true);
  });

  it("rejects a digit already in the same row", () => {
    const board = empty.map((r) => [...r]);
    board[0][3] = 5;
    expect(isValidPlacement(board, 0, 0, 5)).toBe(false);
  });

  it("rejects a digit already in the same column", () => {
    const board = empty.map((r) => [...r]);
    board[4][0] = 7;
    expect(isValidPlacement(board, 0, 0, 7)).toBe(false);
  });

  it("rejects a digit already in the same 3×3 box", () => {
    const board = empty.map((r) => [...r]);
    board[1][1] = 3;
    expect(isValidPlacement(board, 0, 0, 3)).toBe(false);
  });

  it("allows placement that doesn't violate any constraint", () => {
    const board = empty.map((r) => [...r]);
    board[0][3] = 5;
    board[4][0] = 7;
    board[1][1] = 3;
    expect(isValidPlacement(board, 0, 0, 9)).toBe(true);
  });
});

// ── hasUniqueSolution ─────────────────────────────────────────────────────────

describe("hasUniqueSolution", () => {
  // A well-known minimal puzzle with exactly one solution
  const uniquePuzzle: number[][] = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ];

  it("returns true for a puzzle with exactly one solution", () => {
    expect(hasUniqueSolution(uniquePuzzle)).toBe(true);
  });

  it("returns false for an empty board (many solutions)", () => {
    const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
    expect(hasUniqueSolution(empty)).toBe(false);
  });
});
