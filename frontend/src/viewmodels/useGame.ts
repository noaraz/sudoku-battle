import { useState, useEffect, useCallback, useMemo } from "react";
import { generatePuzzle } from "../utils/puzzle";
import type { Board, Difficulty, RawBoard } from "../models";

interface SelectedCell {
  r: number;
  c: number;
}

interface GameState {
  board: Board;
  solution: RawBoard;
  selectedCell: SelectedCell | null;
  lightningMode: boolean;
  lightningNum: number | null;
  /** Number whose matching cells should be highlighted on the board. */
  highlightNum: number | null;
  timer: number;
  isFinished: boolean;
  undoHistory: RawBoard[];
  isComplete: boolean;
  numRemaining: Record<number, number>;
  selectCell: (r: number, c: number) => void;
  inputNumber: (n: number) => void;
  erase: () => void;
  undo: () => void;
  toggleLightning: () => void;
}

function makeBoard(raw: RawBoard, solution: RawBoard): Board {
  return raw.map((row, r) =>
    row.map((value, c) => ({
      value,
      isGiven: value !== 0,
      hasError: value !== 0 && value !== solution[r][c],
    }))
  );
}

function rawFrom(board: Board): RawBoard {
  return board.map((row) => row.map((c) => c.value));
}


export function useGame(seed: number, difficulty: Difficulty): GameState {
  const { puzzle, solution } = useMemo(
    () => generatePuzzle(seed, difficulty),
    [seed, difficulty]
  );

  // givenMask: true = cell is given (immutable)
  const givenMask = useMemo(
    () => puzzle.map((row) => row.map((v) => v !== 0)),
    [puzzle]
  );

  const [board, setBoard] = useState<Board>(() => makeBoard(puzzle, solution));
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [lightningMode, setLightningMode] = useState(false);
  const [lightningNum, setLightningNum] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [undoHistory, setUndoHistory] = useState<RawBoard[]>([]);

  // Timer
  useEffect(() => {
    if (isFinished) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isFinished]);

  const isComplete = useMemo(() => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c].value !== solution[r][c]) return false;
      }
    }
    return true;
  }, [board, solution]);

  useEffect(() => {
    if (isComplete) setIsFinished(true);
  }, [isComplete]);

  // Which number to highlight on the board:
  // - lightning mode armed → highlight all cells matching the armed number
  // - cell selected → highlight all cells matching that cell's value
  const highlightNum = useMemo(() => {
    if (lightningMode && lightningNum !== null) return lightningNum;
    if (selectedCell) return board[selectedCell.r][selectedCell.c].value || null;
    return null;
  }, [lightningMode, lightningNum, selectedCell, board]);

  const numRemaining = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let v = 1; v <= 9; v++) {
      const placed = board.flat().filter((c) => c.value === v).length;
      counts[v] = 9 - placed;
    }
    return counts;
  }, [board]);

  const placeValue = useCallback(
    (r: number, c: number, value: number) => {
      if (givenMask[r][c]) return;
      setUndoHistory((h) => [...h, rawFrom(board)]);
      setBoard((prev) =>
        prev.map((row, ri) =>
          row.map((cell, ci) => {
            if (ri !== r || ci !== c) return cell;
            return {
              value,
              isGiven: false,
              hasError: value !== 0 && value !== solution[r][c],
            };
          })
        )
      );
    },
    [board, givenMask, solution]
  );

  const selectCell = useCallback(
    (r: number, c: number) => {
      const cellValue = board[r][c].value;
      if (lightningMode && cellValue !== 0) {
        setLightningNum(cellValue);
      } else if (lightningMode && lightningNum !== null) {
        placeValue(r, c, lightningNum);
      }
      setSelectedCell({ r, c });
    },
    [lightningMode, lightningNum, board, placeValue]
  );

  const inputNumber = useCallback(
    (n: number) => {
      if (lightningMode) {
        setLightningNum(n);
        setSelectedCell(null);
        return;
      }
      if (!selectedCell) return;
      placeValue(selectedCell.r, selectedCell.c, n);
    },
    [lightningMode, selectedCell, placeValue]
  );

  const erase = useCallback(() => {
    if (!selectedCell) return;
    placeValue(selectedCell.r, selectedCell.c, 0);
  }, [selectedCell, placeValue]);

  const undo = useCallback(() => {
    if (undoHistory.length === 0) return;
    const prev = undoHistory[undoHistory.length - 1];
    setUndoHistory((h) => h.slice(0, -1));
    setBoard(
      prev.map((row, r) =>
        row.map((value, c) => ({
          value,
          isGiven: givenMask[r][c],
          hasError: value !== 0 && !givenMask[r][c] && value !== solution[r][c],
        }))
      )
    );
  }, [undoHistory, givenMask, solution]);

  const toggleLightning = useCallback(() => {
    setLightningMode((m) => !m);
    setLightningNum(null);
    setSelectedCell(null);
  }, []);

  return {
    board,
    solution,
    selectedCell,
    lightningMode,
    lightningNum,
    highlightNum,
    timer,
    isFinished,
    undoHistory,
    isComplete,
    numRemaining,
    selectCell,
    inputNumber,
    erase,
    undo,
    toggleLightning,
  };
}
