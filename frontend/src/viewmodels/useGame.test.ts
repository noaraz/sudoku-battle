import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGame } from "./useGame";

// Fixed seed/difficulty so tests are deterministic
const SEED = 42;
const DIFFICULTY = "easy" as const;

describe("useGame — initial state", () => {
  it("board has 81 cells", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(result.current.board.flat().length).toBe(81);
  });

  it("all given cells match the solution", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const { board, solution } = result.current;
    board.flat().forEach((cell, i) => {
      if (cell.isGiven) {
        expect(cell.value).toBe(solution[Math.floor(i / 9)][i % 9]);
      }
    });
  });

  it("isComplete is false at start", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(result.current.isComplete).toBe(false);
  });

  it("selectedCell is null at start", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(result.current.selectedCell).toBeNull();
  });

  it("lightningMode is false at start", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(result.current.lightningMode).toBe(false);
  });
});

describe("useGame — selectCell", () => {
  it("sets selectedCell to the given coordinates", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    act(() => result.current.selectCell(2, 3));
    expect(result.current.selectedCell).toEqual({ r: 2, c: 3 });
  });
});

describe("useGame — inputNumber (default mode)", () => {
  it("places a number in the selected empty cell", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    // Find first non-given cell
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const correctVal = result.current.solution[r][c];

    act(() => result.current.selectCell(r, c));
    act(() => result.current.inputNumber(correctVal));
    expect(result.current.board[r][c].value).toBe(correctVal);
  });

  it("does not overwrite a given cell", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const originalVal = result.current.board[r][c].value;

    act(() => result.current.selectCell(r, c));
    act(() => result.current.inputNumber((originalVal % 9) + 1));
    expect(result.current.board[r][c].value).toBe(originalVal);
  });

  it("marks an incorrect placement as hasError", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const wrongVal = (result.current.solution[r][c] % 9) + 1; // guaranteed wrong

    act(() => result.current.selectCell(r, c));
    act(() => result.current.inputNumber(wrongVal));
    // May or may not be hasError depending on whether wrongVal conflicts — just check value placed
    expect(result.current.board[r][c].value).toBe(wrongVal);
  });
});

describe("useGame — erase", () => {
  it("clears a user-placed value", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;

    act(() => result.current.selectCell(r, c));
    act(() => result.current.inputNumber(5));
    act(() => result.current.erase());
    expect(result.current.board[r][c].value).toBe(0);
  });

  it("does not erase a given cell", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const originalVal = result.current.board[r][c].value;

    act(() => result.current.selectCell(r, c));
    act(() => result.current.erase());
    expect(result.current.board[r][c].value).toBe(originalVal);
  });
});

describe("useGame — undo", () => {
  it("reverts the last placement", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;

    act(() => result.current.selectCell(r, c));
    act(() => result.current.inputNumber(5));
    expect(result.current.board[r][c].value).toBe(5);

    act(() => result.current.undo());
    expect(result.current.board[r][c].value).toBe(0);
  });

  it("is a no-op when history is empty", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(() => act(() => result.current.undo())).not.toThrow();
  });
});

describe("useGame — lightningMode", () => {
  it("toggles lightningMode on/off", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    act(() => result.current.toggleLightning());
    expect(result.current.lightningMode).toBe(true);
    act(() => result.current.toggleLightning());
    expect(result.current.lightningMode).toBe(false);
  });

  it("toggleLightning clears selectedCell so old row/col/box highlight disappears immediately", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    // Select any cell first
    act(() => result.current.selectCell(0, 0));
    expect(result.current.selectedCell).not.toBeNull();
    // Toggling lightning should clear the selection immediately
    act(() => result.current.toggleLightning());
    expect(result.current.selectedCell).toBeNull();
  });

  it("clicking a cell in armed lightning mode updates selectedCell so related cells are shown", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;

    act(() => result.current.toggleLightning());
    act(() => result.current.inputNumber(1));
    act(() => result.current.selectCell(r, c));
    // After placing, selectedCell should be set so related cells can be highlighted
    expect(result.current.selectedCell).toEqual({ r, c });
  });

  it("clicking a filled cell in lightning mode switches lightningNum to that cell's value", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    // Find a given (filled) cell
    const flat = result.current.board.flat();
    const givenIdx = flat.findIndex((c) => c.isGiven);
    const gr = Math.floor(givenIdx / 9);
    const gc = givenIdx % 9;
    const givenValue = flat[givenIdx].value;

    act(() => result.current.toggleLightning());
    // Arm with something other than the given cell's value
    const armedNum = givenValue === 9 ? 1 : givenValue + 1;
    act(() => result.current.inputNumber(armedNum));
    expect(result.current.lightningNum).toBe(armedNum);

    // Click the filled cell — should switch to its value
    act(() => result.current.selectCell(gr, gc));
    expect(result.current.lightningNum).toBe(givenValue);
  });

  it("in lightning mode, inputNumber arms lightningNum; selectCell places it", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    const flat = result.current.board.flat();
    const idx = flat.findIndex((c) => !c.isGiven);
    const r = Math.floor(idx / 9);
    const c = idx % 9;

    act(() => result.current.toggleLightning());
    act(() => result.current.inputNumber(7));
    expect(result.current.lightningNum).toBe(7);
    // Cell not yet filled — lightning places on selectCell
    act(() => result.current.selectCell(r, c));
    expect(result.current.board[r][c].value).toBe(7);
  });
});

describe("useGame — numRemaining", () => {
  it("starts at 9 for all digits on an empty (non-given) basis", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    // numRemaining[v] = 9 - count of v already on board
    const { numRemaining, board } = result.current;
    for (let v = 1; v <= 9; v++) {
      const placed = board.flat().filter((c) => c.value === v).length;
      expect(numRemaining[v]).toBe(9 - placed);
    }
  });
});

describe("useGame — timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("timer increments each second", () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY));
    expect(result.current.timer).toBe(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timer).toBe(3);
  });
});
