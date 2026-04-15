# Sudoku UI Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five UI issues: lightning mode visual feedback, row/column/box cell highlighting, timer color, dominant numpad styling, and armed-number highlight on the numpad in lightning mode.

**Architecture:** All changes are in the React frontend views layer. No ViewModel logic changes needed — `lightningNum` and `selectedCell` are already exposed by `useGame`. The Board gets a new `isRelated` pure helper; GameScreen updates its `highlightNum` derivation; NumPad gains a `selectedNum` prop.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

**Dev workflow:** All commands run inside Docker. Use `docker compose run --rm frontend <cmd>` for one-off commands.

---

## Pre-Step: Create Feature Branch

- [ ] **Create branch**

```bash
cd /Users/noa.raz/workspace/sudoku-battle
git checkout main && git pull
git checkout -b feat/ui-polish
```

---

## Chunk 1: Board — Row/Column/Box Highlighting

### Task 1: `isRelated` helper and board highlight

**Files:**
- Modify: `frontend/src/views/Board.tsx`
- Modify: `frontend/src/views/views.test.tsx`

- [ ] **Step 1: Add failing tests — update imports and add Board tests**

In `frontend/src/views/views.test.tsx`, add two new imports at the top (after the existing imports):

```tsx
import { Board } from "./Board";
import type { Board as BoardType } from "../models";
```

Then add a new describe block at the end of the file:

```tsx
function makeEmptyBoard(): BoardType {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({ value: 0, isGiven: false, hasError: false }))
  );
}

describe("Board — related-cell highlighting", () => {
  it("applies related bg to cells in the same row as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cell = container.querySelector("[data-testid='cell-2-0']");
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("applies related bg to cells in the same column as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cell = container.querySelector("[data-testid='cell-0-4']");
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("applies related bg to cells in the same 3x3 box as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // selectedCell r=2, c=4 → box rows 0-2, cols 3-5 → cell r=0, c=3 is related
    const cell = container.querySelector("[data-testid='cell-0-3']");
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("does not apply related bg to cells outside row/col/box", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // r=0, c=0: different row, column, and box from r=2, c=4
    const cell = container.querySelector("[data-testid='cell-0-0']");
    expect(cell?.className).not.toContain("bg-blue-50");
  });

  it("does not apply related bg to the selected cell itself", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const selected = container.querySelector("[data-testid='cell-2-4']");
    expect(selected?.className).not.toContain("bg-blue-50");
    expect(selected?.className).toContain("bg-blue-500");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `data-testid` attributes don't exist, `bg-blue-50` class not applied.

- [ ] **Step 3: Implement `isRelated` and update Board.tsx**

Replace the full contents of `frontend/src/views/Board.tsx`:

```tsx
import type { Board as BoardType } from "../models";

interface BoardProps {
  board: BoardType;
  selectedCell: { r: number; c: number } | null;
  highlightNum: number | null;
  onSelectCell: (r: number, c: number) => void;
}

function isRelated(
  selectedCell: { r: number; c: number } | null,
  r: number,
  c: number
): boolean {
  if (!selectedCell) return false;
  if (selectedCell.r === r && selectedCell.c === c) return false;
  return (
    selectedCell.r === r ||
    selectedCell.c === c ||
    (Math.floor(selectedCell.r / 3) === Math.floor(r / 3) &&
      Math.floor(selectedCell.c / 3) === Math.floor(c / 3))
  );
}

function cellClass(
  cell: { value: number; isGiven: boolean; hasError: boolean },
  isSelected: boolean,
  isHighlighted: boolean,
  related: boolean
): string {
  const base =
    "flex items-center justify-center text-lg font-semibold select-none cursor-pointer";
  if (isSelected) return `${base} bg-blue-500 text-white`;
  if (isHighlighted && cell.value !== 0)
    return `${base} bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100`;
  if (related) {
    if (cell.hasError) return `${base} bg-blue-50 dark:bg-gray-700 text-red-500`;
    if (cell.isGiven) return `${base} bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100`;
    return `${base} bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400`;
  }
  if (cell.hasError) return `${base} text-red-500`;
  if (cell.isGiven) return `${base} text-gray-900 dark:text-gray-100`;
  return `${base} text-blue-600 dark:text-blue-400`;
}

function boxBorderClass(r: number, c: number): string {
  const bt = r % 3 === 0 ? "border-t-2" : "border-t";
  const bb = r === 8 ? "border-b-2" : "";
  const bl = c % 3 === 0 ? "border-l-2" : "border-l";
  const br = c === 8 ? "border-r-2" : "";
  return `${bt} ${bb} ${bl} ${br} border-gray-800 dark:border-gray-200`;
}

export function Board({ board, selectedCell, highlightNum, onSelectCell }: BoardProps) {
  return (
    <div className="grid grid-cols-9 w-full max-w-[360px] aspect-square">
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isSelected = selectedCell?.r === r && selectedCell?.c === c;
          const isHighlighted = highlightNum !== null && cell.value === highlightNum;
          const related = isRelated(selectedCell, r, c);
          return (
            <div
              key={`${r}-${c}`}
              data-testid={`cell-${r}-${c}`}
              className={`${cellClass(cell, isSelected, isHighlighted, related)} ${boxBorderClass(r, c)}`}
              onClick={() => onSelectCell(r, c)}
            >
              {cell.value !== 0 ? cell.value : ""}
            </div>
          );
        })
      )}
    </div>
  );
}
```

Note: `dark:bg-gray-700` (not `dark:bg-gray-800`) is used for related cells to make the highlight visible in dark mode, since `gray-800` is indistinguishable from the default dark background.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all Board-related tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/noa.raz/workspace/sudoku-battle
git add frontend/src/views/Board.tsx frontend/src/views/views.test.tsx
git commit -m "feat: highlight row/col/box when cell is selected"
```

---

## Chunk 2: NumPad — Dominant Colors + Armed-Number Highlight

### Task 2: `selectedNum` prop and visual improvements

**Files:**
- Modify: `frontend/src/views/NumPad.tsx`
- Modify: `frontend/src/views/views.test.tsx`

- [ ] **Step 1: Write failing tests for `selectedNum` highlight**

Insert these three test cases immediately before the closing `});` of the existing `describe("NumPad", ...)` block in `frontend/src/views/views.test.tsx`:

```tsx
  it("highlights the selectedNum button with blue bg", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[4].className).toContain("bg-blue-500"); // index 4 = digit 5
  });

  it("does not highlight non-selected buttons when selectedNum is set", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].className).not.toContain("bg-blue-500"); // digit 1
  });

  it("no button is highlighted when selectedNum is null", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={null} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn.className).not.toContain("bg-blue-500"));
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `selectedNum` prop doesn't exist yet.

- [ ] **Step 3: Implement `selectedNum` and improved button styles**

Replace the full contents of `frontend/src/views/NumPad.tsx`:

```tsx
interface NumPadProps {
  numRemaining: Record<number, number>;
  onInput: (n: number) => void;
  selectedNum?: number | null;
}

export function NumPad({ numRemaining, onInput, selectedNum = null }: NumPadProps) {
  return (
    <div className="grid grid-cols-9 gap-1 w-full max-w-[360px]">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
        const remaining = numRemaining[n] ?? 0;
        const done = remaining === 0;
        const isArmed = selectedNum === n;
        return (
          <button
            key={n}
            onClick={() => onInput(n)}
            disabled={done}
            className={`flex flex-col items-center justify-center rounded py-2 text-base font-bold
              ${done
                ? "opacity-30 cursor-not-allowed"
                : isArmed
                  ? "bg-blue-500 text-white active:scale-95"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:bg-blue-100 dark:hover:bg-blue-800 active:scale-95"
              }`}
          >
            <span>{n}</span>
            {!done && (
              <span className={`text-[10px] leading-none ${isArmed ? "text-blue-100" : "text-gray-500 dark:text-gray-300"}`}>
                {remaining}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all NumPad tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/noa.raz/workspace/sudoku-battle
git add frontend/src/views/NumPad.tsx frontend/src/views/views.test.tsx
git commit -m "feat: numpad dominant colors and armed-number highlight"
```

---

## Chunk 3: GameScreen + Timer

### Task 3: Lightning board highlight wiring and Timer color

**Files:**
- Modify: `frontend/src/views/GameScreen.tsx`
- Modify: `frontend/src/views/Timer.tsx`
- Modify: `frontend/src/views/views.test.tsx`

- [ ] **Step 1: Write failing test for Timer color**

Insert immediately before the closing `});` of the existing `describe("Timer", ...)` block in `frontend/src/views/views.test.tsx`:

```tsx
  it("renders with muted color class", () => {
    const { container } = render(<Timer seconds={0} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("text-gray-400");
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — no `text-gray-400` class.

- [ ] **Step 3: Update Timer.tsx**

Replace the full contents of `frontend/src/views/Timer.tsx`:

```tsx
interface TimerProps {
  seconds: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Timer({ seconds }: TimerProps) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="text-xl font-mono tabular-nums text-gray-400 dark:text-gray-500">
      {pad(m)}:{pad(s)}
    </div>
  );
}
```

- [ ] **Step 4: Update GameScreen.tsx**

Replace the full contents of `frontend/src/views/GameScreen.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useGame } from "../viewmodels/useGame";
import type { Difficulty } from "../models";
import { Timer } from "./Timer";
import { Board } from "./Board";
import { NumPad } from "./NumPad";
import { ActionBar } from "./ActionBar";

interface GameScreenProps {
  seed: number;
  difficulty: Difficulty;
  onFinish: (seconds: number) => void;
}

export function GameScreen({ seed, difficulty, onFinish }: GameScreenProps) {
  const game = useGame(seed, difficulty);
  const reported = useRef(false);

  useEffect(() => {
    if (game.isFinished && !reported.current) {
      reported.current = true;
      onFinish(game.timer);
    }
  }, [game.isFinished, game.timer, onFinish]);

  // In lightning mode: highlight cells matching the armed number.
  // Otherwise: highlight cells matching the selected cell's value.
  const highlightNum =
    game.lightningMode && game.lightningNum !== null
      ? game.lightningNum
      : game.selectedCell
        ? game.board[game.selectedCell.r][game.selectedCell.c].value || null
        : null;

  return (
    <div className="flex flex-col items-center gap-4 p-4 min-h-screen bg-white dark:bg-gray-900">
      <Timer seconds={game.timer} />
      <Board
        board={game.board}
        selectedCell={game.selectedCell}
        highlightNum={highlightNum}
        onSelectCell={game.selectCell}
      />
      <NumPad
        numRemaining={game.numRemaining}
        onInput={game.inputNumber}
        selectedNum={game.lightningMode ? game.lightningNum : null}
      />
      <ActionBar
        lightningMode={game.lightningMode}
        onUndo={game.undo}
        onErase={game.erase}
        onToggleLightning={game.toggleLightning}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run all tests**

```bash
docker compose run --rm frontend npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/noa.raz/workspace/sudoku-battle
git add frontend/src/views/GameScreen.tsx frontend/src/views/Timer.tsx frontend/src/views/views.test.tsx
git commit -m "feat: lightning mode board highlight, muted timer color"
```

---

## Verification

After all tasks complete, run the full test suite:

```bash
docker compose run --rm frontend npx vitest run --reporter=dot
```

Manual verification checklist:
1. Select a cell → soft blue tint on its entire row, column, and 3×3 box
2. Enable lightning ⚡ → tap "5" on numpad → the "5" button turns solid blue; all 5s on the board are highlighted
3. Timer is muted gray, not stark black/white
4. All numpad buttons are visually bolder (darker gray background)
