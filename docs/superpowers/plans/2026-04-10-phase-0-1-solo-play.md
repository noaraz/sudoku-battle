# Phase 0 + Phase 1: Solo Play Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the project (backend + frontend tooling, test suites) and build a fully playable solo Sudoku game in the browser with no auth or network dependency.

**Architecture:** Frontend-only for Phase 1 — MVVM pattern where `src/utils/puzzle.ts` generates puzzles deterministically, `src/viewmodels/useGame.ts` owns all game logic, and thin view components render state. Backend Phase 0 is scaffolding only (no app logic yet).

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + vitest + @testing-library/react (frontend); FastAPI + Python 3.12 + pytest + mypy (backend).

**Spec:** [First Logic Phases Design](../specs/2026-04-10-first-logic-phases-design.md)

---

## Chunk 1: Phase 0 — Project Init

### Task 1: Backend scaffold

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/conftest.py`
- Create: `backend/tests/test_smoke.py`

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "sudoku-battle"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "google-cloud-firestore>=2.19",
    "bcrypt>=4.1",
    "pydantic-settings>=2.4",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "mypy>=1.11",
    "google-cloud-firestore-stubs",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true
```

- [ ] **Step 2: Create `backend/app/__init__.py`** (empty file)

- [ ] **Step 3: Create `backend/app/core/__init__.py`** (empty file)

- [ ] **Step 4: Create `backend/app/core/config.py`**

```python
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    firestore_project_id: str = "sudoku-battle"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Create `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Future: initialise Firestore client here
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


app = create_app()
```

- [ ] **Step 6: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 7: Create `backend/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

- [ ] **Step 8: Create `backend/tests/test_smoke.py`**

```python
from fastapi.testclient import TestClient


def test_app_starts(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
```

- [ ] **Step 9: Install dependencies and run tests**

```bash
cd backend
pip install -e ".[dev]"
pytest -q
```

Expected: `1 passed`

- [ ] **Step 10: Verify mypy**

```bash
cd backend
mypy app/
```

Expected: `Success: no issues found`

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffold — FastAPI skeleton + pytest setup"
```

---

### Task 2: Frontend scaffold

**Files:**
- Create: `frontend/package.json` (via npm create)
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/test-setup.ts`
- Create: `frontend/src/models/index.ts`

- [ ] **Step 1: Scaffold Vite project**

Run inside the `frontend/` directory. When asked to remove existing files (CLAUDE.md, PLAN.md), say **No** — then use the second approach below.

```bash
# Preserve CLAUDE.md and PLAN.md, then scaffold around them:
cd frontend
cp CLAUDE.md /tmp/frontend-CLAUDE.md
cp PLAN.md /tmp/frontend-PLAN.md
npm create vite@latest . -- --template react-ts
# Choose "y" to remove existing files
cp /tmp/frontend-CLAUDE.md CLAUDE.md
cp /tmp/frontend-PLAN.md PLAN.md
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 3: Configure Tailwind — `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Update `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Configure vitest — update `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 6: Create `frontend/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Scaffold `src/` directory structure**

```bash
mkdir -p frontend/src/{models,viewmodels,views,services,utils}
```

Create `frontend/src/models/index.ts`:

```typescript
export {}
```

- [ ] **Step 8: Simplify `frontend/src/App.tsx` to a blank slate**

```typescript
export default function App() {
  return <div>Sudoku Battle</div>
}
```

- [ ] **Step 9: Write smoke test `frontend/src/App.test.tsx`**

```typescript
import { render } from '@testing-library/react'
import App from './App'

test('app renders without crashing', () => {
  render(<App />)
  expect(document.body).toBeInTheDocument()
})
```

- [ ] **Step 10: Run tests**

```bash
cd frontend && npx vitest run
```

Expected: `1 passed`

- [ ] **Step 11: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold — Vite + React + TypeScript + Tailwind + vitest"
```

---

## Chunk 2: Phase 1 — Puzzle Generator

### Task 3: Models

**Files:**
- Modify: `frontend/src/models/index.ts`

- [ ] **Step 1: Define all Phase 1 model types**

```typescript
// frontend/src/models/index.ts

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export interface Cell {
  value: number | null   // current value (null = empty)
  given: boolean         // pre-filled by puzzle generator (immutable)
  isError: boolean       // true when value !== solution at same position
}

// 9×9 grid of Cell. Access: board[row][col]
export type Board = Cell[][]

// 9×9 grid of numbers (0 = empty). Used internally by puzzle generator.
// Access: raw[row][col]
export type RawBoard = number[][]
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/models/index.ts
git commit -m "feat: add Phase 1 model types (Cell, Board, Difficulty, RawBoard)"
```

---

### Task 4: Puzzle generator — PRNG + board validity helpers (TDD)

**Files:**
- Create: `frontend/src/utils/puzzle.ts`
- Create: `frontend/src/utils/puzzle.test.ts`

#### 4a: Seed-based PRNG

- [ ] **Step 1: Write failing test for mulberry32**

```typescript
// frontend/src/utils/puzzle.test.ts
import { describe, it, expect } from 'vitest'
import { mulberry32 } from './puzzle'

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
  })

  it('produces different output for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/utils/puzzle.test.ts
```

Expected: `mulberry32 is not exported`

- [ ] **Step 3: Implement `mulberry32` in `frontend/src/utils/puzzle.ts`**

```typescript
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npx vitest run src/utils/puzzle.test.ts
```

#### 4b: Board validity — `isValidPlacement`

- [ ] **Step 5: Write failing tests for `isValidPlacement`**

Add to `puzzle.test.ts`:

```typescript
import { isValidPlacement } from './puzzle'
import type { RawBoard } from '../models'

describe('isValidPlacement', () => {
  const emptyBoard = (): RawBoard =>
    Array.from({ length: 9 }, () => Array(9).fill(0))

  it('allows placing a number in an empty cell', () => {
    expect(isValidPlacement(emptyBoard(), 0, 0, 5)).toBe(true)
  })

  it('rejects a number already in the same row', () => {
    const board = emptyBoard()
    board[0][3] = 5
    expect(isValidPlacement(board, 0, 0, 5)).toBe(false)
  })

  it('rejects a number already in the same column', () => {
    const board = emptyBoard()
    board[3][0] = 5
    expect(isValidPlacement(board, 0, 0, 5)).toBe(false)
  })

  it('rejects a number already in the same 3x3 box', () => {
    const board = emptyBoard()
    board[1][1] = 5
    expect(isValidPlacement(board, 0, 0, 5)).toBe(false)
  })

  it('allows same number in different box, row, column', () => {
    const board = emptyBoard()
    board[3][3] = 5
    expect(isValidPlacement(board, 0, 0, 5)).toBe(true)
  })
})
```

- [ ] **Step 6: Run — expect FAIL**

- [ ] **Step 7: Implement `isValidPlacement`**

Add to `puzzle.ts`:

```typescript
export function isValidPlacement(board: RawBoard, row: number, col: number, val: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === val) return false
    if (board[i][col] === val) return false
  }
  const boxRow = Math.floor(row / 3) * 3
  const boxCol = Math.floor(col / 3) * 3
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r][c] === val) return false
    }
  }
  return true
}
```

- [ ] **Step 8: Run — expect PASS**

#### 4c: Unique solution checker — `hasUniqueSolution`

- [ ] **Step 9: Write failing test for `hasUniqueSolution`**

```typescript
import { hasUniqueSolution } from './puzzle'

describe('hasUniqueSolution', () => {
  it('returns true for a board with exactly one solution', () => {
    // Near-complete board — last cell [8][8] is 0, only value that fits is 2
    const board: RawBoard = [
      [1,2,3, 4,5,6, 7,8,9],
      [4,5,6, 7,8,9, 1,2,3],
      [7,8,9, 1,2,3, 4,5,6],
      [2,1,4, 3,6,5, 8,9,7],
      [3,6,5, 8,9,7, 2,1,4],
      [8,9,7, 2,1,4, 3,6,5],
      [5,3,1, 6,4,2, 9,7,8],
      [6,4,2, 9,7,8, 5,3,1],
      [9,7,8, 5,3,1, 6,4,0],
    ]
    expect(hasUniqueSolution(board)).toBe(true)
  })

  it('returns false for a board with multiple solutions', () => {
    // A board with very few clues has many solutions.
    // 4 clues in separate rows, columns, and boxes guarantees ambiguity
    // and the solver finds a 2nd solution quickly (no long search).
    const board: RawBoard = Array.from({ length: 9 }, () => Array(9).fill(0))
    board[0][0] = 1
    board[1][3] = 2
    board[2][6] = 3
    board[3][1] = 4
    expect(hasUniqueSolution(board)).toBe(false)
  })
})
```

- [ ] **Step 10: Run — expect FAIL**

- [ ] **Step 11: Implement `hasUniqueSolution`**

Add to `puzzle.ts`. The solver counts solutions and stops as soon as it finds 2.

```typescript
export function hasUniqueSolution(board: RawBoard): boolean {
  // Work on a copy so we don't mutate the input
  const b: RawBoard = board.map(row => [...row])
  let count = 0

  function solve(): void {
    if (count >= 2) return  // found enough — stop early

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] !== 0) continue  // skip filled cells
        for (let v = 1; v <= 9; v++) {
          if (!isValidPlacement(b, r, c, v)) continue
          b[r][c] = v
          solve()
          b[r][c] = 0
          if (count >= 2) return  // propagate early exit
        }
        return  // no valid value found → backtrack
      }
    }
    // Reached here: no empty cells remain → found a complete solution
    count++
  }

  solve()
  return count === 1
}
```

- [ ] **Step 12: Run — expect PASS**

- [ ] **Step 13: Commit**

```bash
git add frontend/src/utils/puzzle.ts frontend/src/utils/puzzle.test.ts
git commit -m "feat: puzzle helpers — mulberry32, isValidPlacement, hasUniqueSolution"
```

---

### Task 5: Puzzle generator — `generatePuzzle` (TDD)

Continuing `puzzle.ts` and `puzzle.test.ts`.

**Return type contract:**
- `puzzle: Board` (`Cell[][]`) — the playable puzzle; non-given cells have `value: null`
- `solution: number[][]` (`RawBoard`) — the fully solved grid; read-only, used for validation

- [ ] **Step 1: Write failing tests for `generatePuzzle`**

```typescript
import { generatePuzzle } from './puzzle'
import type { Board, RawBoard } from '../models'

const CLUE_RANGES: Record<string, [number, number]> = {
  easy:   [35, 42],
  medium: [27, 33],
  hard:   [22, 28],
  expert: [17, 23],
}

describe('generatePuzzle', { timeout: 30000 }, () => {
  it('produces identical puzzle for same seed and difficulty', () => {
    const a = generatePuzzle(12345, 'easy')
    const b = generatePuzzle(12345, 'easy')
    expect(a.puzzle).toEqual(b.puzzle)
    expect(a.solution).toEqual(b.solution)
  })

  it('produces different puzzles for different seeds', () => {
    const a = generatePuzzle(1, 'easy')
    const b = generatePuzzle(2, 'easy')
    expect(a.puzzle).not.toEqual(b.puzzle)
  })

  it.each(['easy', 'medium', 'hard', 'expert'] as const)(
    'produces correct clue count for %s',
    (difficulty) => {
      const { puzzle } = generatePuzzle(999, difficulty)
      const clues = puzzle.flat().filter(c => c.given).length
      const [min, max] = CLUE_RANGES[difficulty]
      expect(clues).toBeGreaterThanOrEqual(min)
      expect(clues).toBeLessThanOrEqual(max)
    }
  )

  it('generates a solution with no row/column/box conflicts', () => {
    const { solution } = generatePuzzle(42, 'medium')
    // solution is RawBoard (number[][]); check each cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = solution[r][c]
        solution[r][c] = 0
        expect(isValidPlacement(solution, r, c, val)).toBe(true)
        solution[r][c] = val
      }
    }
  })

  it('given cells have non-null values', () => {
    const { puzzle } = generatePuzzle(7, 'hard')
    puzzle.flat().filter(c => c.given).forEach(c => {
      expect(c.value).not.toBeNull()
    })
  })

  it('non-given cells start as null with no error', () => {
    const { puzzle } = generatePuzzle(7, 'hard')
    puzzle.flat().filter(c => !c.given).forEach(c => {
      expect(c.value).toBeNull()
      expect(c.isError).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `generatePuzzle`**

Add to `puzzle.ts`:

```typescript
import type { Cell, Board, RawBoard, Difficulty } from '../models'

const TARGET_CLUES: Record<Difficulty, number> = {
  easy: 38,
  medium: 30,
  hard: 25,
  expert: 20,
}

function generateSolvedBoard(rng: () => number): RawBoard {
  const board: RawBoard = Array.from({ length: 9 }, () => Array(9).fill(0))

  function solve(r: number, c: number): boolean {
    if (r === 9) return true
    const nextR = c === 8 ? r + 1 : r
    const nextC = c === 8 ? 0 : c + 1
    const digits = [1,2,3,4,5,6,7,8,9].sort(() => rng() - 0.5)
    for (const d of digits) {
      if (!isValidPlacement(board, r, c, d)) continue
      board[r][c] = d
      if (solve(nextR, nextC)) return true
      board[r][c] = 0
    }
    return false
  }

  solve(0, 0)
  return board
}

export function generatePuzzle(
  seed: number,
  difficulty: Difficulty,
): { puzzle: Board; solution: RawBoard } {
  const rng = mulberry32(seed)
  const solved = generateSolvedBoard(rng)

  // snapshot the solution before we start removing cells
  const solution: RawBoard = solved.map(row => [...row])

  // Copy the solved board to punch holes in
  const work: RawBoard = solved.map(row => [...row])

  // Shuffle all positions, then try to remove each one
  const positions = Array.from({ length: 81 }, (_, i) => i).sort(() => rng() - 0.5)
  const target = TARGET_CLUES[difficulty]
  let clues = 81

  for (const pos of positions) {
    if (clues <= target) break
    const r = Math.floor(pos / 9)
    const c = pos % 9
    const backup = work[r][c]
    work[r][c] = 0
    if (hasUniqueSolution(work)) {
      clues--
    } else {
      work[r][c] = backup  // restore — removing this cell breaks uniqueness
    }
  }

  // Build the Cell[][] puzzle
  const puzzle: Board = work.map((row, r) =>
    row.map((val, c): Cell => ({
      value: val !== 0 ? val : null,
      given: val !== 0,
      isError: false,
    }))
  )

  return { puzzle, solution }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npx vitest run src/utils/puzzle.test.ts
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/puzzle.ts frontend/src/utils/puzzle.test.ts
git commit -m "feat: generatePuzzle — seed-based Sudoku generator with uniqueness guarantee"
```

---

### Task 6: Best times utility (TDD)

**Files:**
- Create: `frontend/src/utils/bestTimes.ts`
- Create: `frontend/src/utils/bestTimes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/utils/bestTimes.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getBestTime, saveBestTime } from './bestTimes'

beforeEach(() => {
  localStorage.clear()
})

describe('bestTimes', () => {
  it('returns null when no best time recorded', () => {
    expect(getBestTime('easy')).toBeNull()
  })

  it('saves and retrieves a best time', () => {
    saveBestTime('easy', 120)
    expect(getBestTime('easy')).toBe(120)
  })

  it('saves best time per difficulty independently', () => {
    saveBestTime('easy', 100)
    saveBestTime('hard', 300)
    expect(getBestTime('easy')).toBe(100)
    expect(getBestTime('hard')).toBe(300)
    expect(getBestTime('medium')).toBeNull()
  })

  it('overwrites with a better (lower) time', () => {
    saveBestTime('easy', 120)
    saveBestTime('easy', 90)
    expect(getBestTime('easy')).toBe(90)
  })

  it('does not overwrite with a worse (higher) time', () => {
    saveBestTime('easy', 90)
    saveBestTime('easy', 120)
    expect(getBestTime('easy')).toBe(90)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `bestTimes.ts`**

```typescript
// frontend/src/utils/bestTimes.ts
import type { Difficulty } from '../models'

const key = (difficulty: Difficulty): string => `sudoku_best_${difficulty}`

export function getBestTime(difficulty: Difficulty): number | null {
  const raw = localStorage.getItem(key(difficulty))
  return raw !== null ? Number(raw) : null
}

export function saveBestTime(difficulty: Difficulty, seconds: number): void {
  const current = getBestTime(difficulty)
  if (current === null || seconds < current) {
    localStorage.setItem(key(difficulty), String(seconds))
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npx vitest run src/utils/bestTimes.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/bestTimes.ts frontend/src/utils/bestTimes.test.ts
git commit -m "feat: bestTimes utility — localStorage personal best per difficulty"
```

---

## Chunk 3: Phase 1 — useGame Hook

### Task 7: useGame hook (TDD)

**Files:**
- Create: `frontend/src/viewmodels/useGame.ts`
- Create: `frontend/src/viewmodels/useGame.test.ts`

**Interface contract** (matches spec):
- `board: Board` — 2D `Cell[][]`, access via `board[r][c]`
- `solution: RawBoard` — 2D `number[][]`, read-only
- `selectedCell: [number, number] | null` — `[row, col]` tuple
- `selectCell(r, c)` — selects or places (in lightning mode)

Tests use `renderHook` from `@testing-library/react`.

#### 7a: Setup + initial state

- [ ] **Step 1: Write failing tests for initial state**

```typescript
// frontend/src/viewmodels/useGame.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGame } from './useGame'

const SEED = 12345
const DIFFICULTY = 'easy' as const

// Helper: find first non-given cell position [r, c]
function firstEmpty(board: import('../models').Board): [number, number] {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!board[r][c].given) return [r, c]
    }
  }
  throw new Error('No empty cells found')
}

describe('useGame — initial state', () => {
  it('starts with no selected cell', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.selectedCell).toBeNull()
  })

  it('starts with lightning mode off', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.lightningMode).toBe(false)
  })

  it('starts with timer at 0', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.timer).toBe(0)
  })

  it('starts not finished', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.isFinished).toBe(false)
  })

  it('board is 9 rows of 9 cells', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.board).toHaveLength(9)
    result.current.board.forEach(row => expect(row).toHaveLength(9))
  })

  it('given cells have non-null values', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    result.current.board.flat().filter(c => c.given).forEach(c => {
      expect(c.value).not.toBeNull()
    })
  })

  it('non-given cells start empty', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    result.current.board.flat().filter(c => !c.given).forEach(c => {
      expect(c.value).toBeNull()
    })
  })

  it('numRemaining is correct at start', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    for (let n = 1; n <= 9; n++) {
      const placed = result.current.board.flat().filter(c => c.value === n && c.given).length
      expect(result.current.numRemaining[n]).toBe(9 - placed)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/viewmodels/useGame.test.ts
```

- [ ] **Step 3: Create `frontend/src/viewmodels/useGame.ts`**

```typescript
import { useState, useCallback, useEffect, useRef } from 'react'
import type { Board, RawBoard, Difficulty } from '../models'
import { generatePuzzle } from '../utils/puzzle'

export interface GameViewModel {
  board: Board
  solution: RawBoard
  selectedCell: [number, number] | null
  selectedNum: number | null
  lightningMode: boolean
  lightningNum: number | null
  timer: number
  isFinished: boolean
  numRemaining: Record<number, number>
  hasErrors: boolean
  isComplete: boolean
  selectCell: (r: number, c: number) => void
  inputNumber: (n: number) => void
  erase: () => void
  undo: () => void
  toggleLightning: () => void
}

interface HistoryEntry {
  r: number
  c: number
  prev: number | null
}

export function useGame(seed: number, difficulty: Difficulty): GameViewModel {
  const { puzzle: initial, solution } = generatePuzzle(seed, difficulty)

  const [board, setBoard] = useState<Board>(initial)
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [selectedNum, setSelectedNum] = useState<number | null>(null)
  const [lightningMode, setLightningMode] = useState(false)
  const [lightningNum, setLightningNum] = useState<number | null>(null)
  const [timer, setTimer] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [undoHistory, setUndoHistory] = useState<HistoryEntry[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStarted = useRef(false)
  // boardRef always holds the latest board value, avoiding stale closures in callbacks
  const boardRef = useRef<Board>(initial)

  // Keep boardRef in sync with state so callbacks always read latest board
  useEffect(() => { boardRef.current = board }, [board])

  // Derived state
  const flat = board.flat()
  const numRemaining = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => {
      const n = i + 1
      return [n, 9 - flat.filter(c => c.value === n).length]
    })
  ) as Record<number, number>
  const hasErrors = flat.some(c => c.isError)
  const isComplete = flat.every(c => c.value !== null) && !hasErrors

  // Stop timer and mark finished when complete
  useEffect(() => {
    if (isComplete && !isFinished) {
      setIsFinished(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isComplete, isFinished])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startTimerIfNeeded() {
    if (!timerStarted.current) {
      timerStarted.current = true
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    }
  }

  const placeValue = useCallback(
    (r: number, c: number, value: number | null) => {
      // Read current board from ref to avoid stale closures
      const prev = boardRef.current[r][c]
      if (prev.given) return
      setUndoHistory(h => [...h, { r, c, prev: prev.value }])
      setBoard(b => {
        const cell = b[r][c]
        if (cell.given) return b
        const newIsError = value !== null && value !== solution[r][c]
        const newRow = [...b[r]]
        newRow[c] = { ...cell, value, isError: newIsError }
        const next = [...b]
        next[r] = newRow
        return next
      })
    },
    [solution],  // board removed — read via boardRef to avoid stale closure
  )

  const selectCell = useCallback(
    (r: number, c: number) => {
      if (lightningMode && lightningNum !== null) {
        const cell = boardRef.current[r][c]
        if (!cell.given) {
          startTimerIfNeeded()
          placeValue(r, c, lightningNum)
        }
        setSelectedCell([r, c])
      } else {
        setSelectedCell([r, c])
        setSelectedNum(boardRef.current[r][c].value)
      }
    },
    [lightningMode, lightningNum, placeValue],
  )

  const inputNumber = useCallback(
    (n: number) => {
      if (lightningMode) {
        setLightningNum(n)
        setSelectedCell(null)  // re-arming clears selection
      } else {
        if (selectedCell === null) return
        const [r, c] = selectedCell
        if (boardRef.current[r][c].given) return
        startTimerIfNeeded()
        placeValue(r, c, n)
        setSelectedNum(n)
      }
    },
    [lightningMode, selectedCell, placeValue],
  )

  const erase = useCallback(() => {
    if (lightningMode) return  // no-op in lightning mode
    if (selectedCell === null) return
    const [r, c] = selectedCell
    if (boardRef.current[r][c].given) return
    startTimerIfNeeded()
    placeValue(r, c, null)
  }, [lightningMode, selectedCell, placeValue])

  const undo = useCallback(() => {
    setUndoHistory(h => {
      if (h.length === 0) return h
      const last = h[h.length - 1]
      setBoard(prev => {
        const newIsError = last.prev !== null && last.prev !== solution[last.r][last.c]
        const newRow = [...prev[last.r]]
        newRow[last.c] = { ...prev[last.r][last.c], value: last.prev, isError: newIsError }
        const next = [...prev]
        next[last.r] = newRow
        return next
      })
      return h.slice(0, -1)
    })
  }, [solution])

  const toggleLightning = useCallback(() => {
    setLightningMode(m => !m)
    setLightningNum(null)
    setSelectedCell(null)
  }, [])

  return {
    board, solution, selectedCell, selectedNum,
    lightningMode, lightningNum, timer, isFinished,
    numRemaining, hasErrors, isComplete,
    selectCell, inputNumber, erase, undo, toggleLightning,
  }
}
```

- [ ] **Step 4: Run initial state tests — expect PASS**

```bash
cd frontend && npx vitest run src/viewmodels/useGame.test.ts
```

#### 7b: inputNumber — default mode

- [ ] **Step 5: Write failing tests for inputNumber in default mode**

Add to `useGame.test.ts`:

```typescript
describe('useGame — inputNumber (default mode)', () => {
  it('places number in selected cell', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(7) })
    expect(result.current.board[r][c].value).toBe(7)
  })

  it('does not place number when no cell selected', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const before = result.current.board.map(row => row.map(c => c.value))
    act(() => { result.current.inputNumber(5) })
    expect(result.current.board.map(row => row.map(c => c.value))).toEqual(before)
  })

  it('does not overwrite a given cell', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    let gr = -1, gc = -1
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (result.current.board[r][c].given) { gr = r; gc = c; break outer }
      }
    }
    const original = result.current.board[gr][gc].value
    act(() => { result.current.selectCell(gr, gc) })
    act(() => { result.current.inputNumber(8) })
    expect(result.current.board[gr][gc].value).toBe(original)
  })

  it('marks cell as error when placed value conflicts with solution', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    const correctVal = result.current.solution[r][c]
    const wrongVal = correctVal === 1 ? 2 : 1
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(wrongVal) })
    expect(result.current.board[r][c].isError).toBe(true)
  })

  it('does not mark cell as error when value matches solution', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    const correctVal = result.current.solution[r][c]
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(correctVal) })
    expect(result.current.board[r][c].isError).toBe(false)
  })
})
```

- [ ] **Step 6: Run — expect PASS**

#### 7c: Lightning mode

- [ ] **Step 7: Write failing tests for lightning mode**

```typescript
describe('useGame — lightning mode', () => {
  it('toggleLightning turns lightning mode on', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { result.current.toggleLightning() })
    expect(result.current.lightningMode).toBe(true)
  })

  it('inputNumber in lightning mode arms lightningNum', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { result.current.toggleLightning() })
    act(() => { result.current.inputNumber(3) })
    expect(result.current.lightningNum).toBe(3)
    expect(result.current.selectedCell).toBeNull()
  })

  it('inputNumber with different number re-arms and clears selectedCell', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { result.current.toggleLightning() })
    act(() => { result.current.inputNumber(3) })
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(5) })  // switch to 5
    expect(result.current.lightningNum).toBe(5)
    expect(result.current.selectedCell).toBeNull()
  })

  it('selectCell in lightning mode with armed number places value', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { result.current.toggleLightning() })
    act(() => { result.current.inputNumber(4) })
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    expect(result.current.board[r][c].value).toBe(4)
  })

  it('erase is no-op in lightning mode', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { result.current.toggleLightning() })
    act(() => { result.current.inputNumber(4) })
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    const valueBefore = result.current.board[r][c].value
    act(() => { result.current.erase() })
    expect(result.current.board[r][c].value).toBe(valueBefore)
  })
})
```

- [ ] **Step 8: Run — expect PASS**

#### 7d: Undo

- [ ] **Step 9: Write failing tests for undo**

```typescript
describe('useGame — undo', () => {
  it('reverts last placement', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(7) })
    expect(result.current.board[r][c].value).toBe(7)
    act(() => { result.current.undo() })
    expect(result.current.board[r][c].value).toBeNull()
  })

  it('does nothing when history is empty', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const before = result.current.board.map(row => row.map(c => c.value))
    act(() => { result.current.undo() })
    expect(result.current.board.map(row => row.map(c => c.value))).toEqual(before)
  })

  it('supports multiple undos in sequence', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    // Find two different empty cells
    let first: [number, number] | null = null
    let second: [number, number] | null = null
    for (let r = 0; r < 9 && !second; r++) {
      for (let c = 0; c < 9 && !second; c++) {
        if (!result.current.board[r][c].given) {
          if (!first) first = [r, c]
          else second = [r, c]
        }
      }
    }
    const [r1, c1] = first!
    const [r2, c2] = second!
    act(() => { result.current.selectCell(r1, c1) })
    act(() => { result.current.inputNumber(1) })
    act(() => { result.current.selectCell(r2, c2) })
    act(() => { result.current.inputNumber(2) })
    act(() => { result.current.undo() })
    expect(result.current.board[r2][c2].value).toBeNull()
    act(() => { result.current.undo() })
    expect(result.current.board[r1][c1].value).toBeNull()
  })
})
```

- [ ] **Step 10: Run — expect PASS**

#### 7e: Timer + completion

- [ ] **Step 11: Write failing tests for timer and isComplete**

```typescript
describe('useGame — timer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('timer does not start until first inputNumber', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.timer).toBe(0)
  })

  it('timer starts after first inputNumber', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(result.current.solution[r][c]) })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.timer).toBe(3)
  })
})

describe('useGame — isComplete', () => {
  it('isComplete is false with empty cells', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    expect(result.current.isComplete).toBe(false)
  })

  it('isComplete is false when any cell has an error', () => {
    const { result } = renderHook(() => useGame(SEED, DIFFICULTY))
    const [r, c] = firstEmpty(result.current.board)
    const correctVal = result.current.solution[r][c]
    const wrongVal = correctVal === 1 ? 2 : 1
    act(() => { result.current.selectCell(r, c) })
    act(() => { result.current.inputNumber(wrongVal) })
    expect(result.current.isComplete).toBe(false)
  })
})
```

- [ ] **Step 12: Run — expect PASS**

- [ ] **Step 13: Run full test suite**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 14: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 15: Commit**

```bash
git add frontend/src/viewmodels/useGame.ts frontend/src/viewmodels/useGame.test.ts
git commit -m "feat: useGame hook — full game logic with TDD coverage"
```

---

### Task 8: useTheme hook (TDD)

**Files:**
- Create: `frontend/src/viewmodels/useTheme.ts`
- Create: `frontend/src/viewmodels/useTheme.test.ts`

- [ ] **Step 1: Write failing tests for useTheme**

```typescript
// frontend/src/viewmodels/useTheme.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark', 'light')
})

describe('useTheme', () => {
  it('defaults to dark theme when no localStorage value', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('applies dark class to <html> on dark theme', () => {
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggle switches to light theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggle switches back to dark theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    act(() => { result.current.toggle() })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(localStorage.getItem('sudoku_theme')).toBe('light')
  })

  it('reads theme from localStorage on init', () => {
    localStorage.setItem('sudoku_theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/viewmodels/useTheme.test.ts
```

- [ ] **Step 3: Create `frontend/src/viewmodels/useTheme.ts`**

```typescript
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'sudoku_theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npx vitest run src/viewmodels/useTheme.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/viewmodels/useTheme.ts frontend/src/viewmodels/useTheme.test.ts
git commit -m "feat: useTheme hook — dark/light with localStorage persistence"
```

---

## Chunk 4: Phase 1 — Views + Routing

### Task 9: Timer view

**Files:**
- Create: `frontend/src/views/Timer.tsx`

- [ ] **Step 1: Create `frontend/src/views/Timer.tsx`**

```typescript
interface Props {
  seconds: number
}

export function Timer({ seconds }: Props) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return (
    <div className="font-mono text-2xl text-white dark:text-white">
      {m}:{s}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/Timer.tsx
git commit -m "feat: Timer view"
```

---

### Task 10: Board view

**Files:**
- Create: `frontend/src/views/Board.tsx`

- [ ] **Step 1: Create `frontend/src/views/Board.tsx`**

```typescript
import type { Board } from '../models'

interface Props {
  board: Board
  solution: number[][]
  selectedCell: [number, number] | null
  selectedNum: number | null
  onCellPress: (r: number, c: number) => void
}

function cellClasses(
  board: Board,
  r: number,
  c: number,
  selectedCell: [number, number] | null,
  selectedNum: number | null,
): string {
  const cell = board[r][c]
  const [selR, selC] = selectedCell ?? [-1, -1]
  const isSelected = r === selR && c === selC
  const isMatching = selectedNum !== null && cell.value === selectedNum && cell.value !== null
  const isHighlighted =
    !isSelected &&
    !isMatching &&
    selectedCell !== null &&
    (r === selR ||
      c === selC ||
      (Math.floor(r / 3) === Math.floor(selR / 3) &&
        Math.floor(c / 3) === Math.floor(selC / 3)))

  let bg = ''
  if (cell.isError) bg = 'bg-red-950'
  else if (isSelected || isMatching) bg = 'bg-blue-500'
  else if (isHighlighted) bg = 'bg-gray-800'

  const text = cell.isError
    ? 'text-red-400'
    : isSelected || isMatching
    ? 'text-white'
    : cell.given
    ? 'font-bold text-gray-400'
    : 'text-white'

  // Thick borders on 3×3 box boundaries
  const bt = r % 3 === 0 ? 'border-t-2 border-t-gray-400' : 'border-t border-t-gray-700'
  const bl = c % 3 === 0 ? 'border-l-2 border-l-gray-400' : 'border-l border-l-gray-700'
  const bb = r === 8 ? 'border-b-2 border-b-gray-400' : ''
  const br = c === 8 ? 'border-r-2 border-r-gray-400' : ''

  return `flex items-center justify-center w-10 h-10 cursor-pointer text-lg select-none ${bg} ${text} ${bt} ${bl} ${bb} ${br}`
}

export function Board({ board, solution, selectedCell, selectedNum, onCellPress }: Props) {
  return (
    <div className="inline-grid grid-cols-9">
      {board.map((row, r) =>
        row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            className={cellClasses(board, r, c, selectedCell, selectedNum)}
            onClick={() => onCellPress(r, c)}
          >
            {cell.value ?? ''}
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/Board.tsx
git commit -m "feat: Board view — 9x9 grid with cell state styling"
```

---

### Task 11: NumPad view

**Files:**
- Create: `frontend/src/views/NumPad.tsx`

- [ ] **Step 1: Create `frontend/src/views/NumPad.tsx`**

```typescript
interface Props {
  numRemaining: Record<number, number>
  selectedNum: number | null
  lightningMode: boolean
  lightningNum: number | null
  onNumPress: (n: number) => void
}

export function NumPad({ numRemaining, selectedNum, lightningMode, lightningNum, onNumPress }: Props) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 9 }, (_, i) => i + 1).map(n => {
        const remaining = numRemaining[n] ?? 0
        const isActive = lightningMode ? lightningNum === n : selectedNum === n
        const isComplete = remaining === 0
        return (
          <button
            key={n}
            onClick={() => onNumPress(n)}
            disabled={isComplete}
            className={`relative w-10 h-12 rounded text-lg font-semibold transition-colors
              ${isComplete ? 'text-gray-600 cursor-not-allowed' : 'text-white'}
              ${isActive ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}
            `}
          >
            {n}
            {!isComplete && (
              <span className="absolute bottom-0.5 right-1 text-[10px] text-gray-300">
                {remaining}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/NumPad.tsx
git commit -m "feat: NumPad view — digit buttons with remaining count badge"
```

---

### Task 12: ActionBar view

**Files:**
- Create: `frontend/src/views/ActionBar.tsx`

- [ ] **Step 1: Create `frontend/src/views/ActionBar.tsx`**

```typescript
interface Props {
  onUndo: () => void
  onErase: () => void
  lightningMode: boolean
  onToggleLightning: () => void
}

export function ActionBar({ onUndo, onErase, lightningMode, onToggleLightning }: Props) {
  return (
    <div className="flex gap-4 items-center">
      <button
        onClick={onUndo}
        className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-white"
      >
        <span className="text-xl">↩</span>
        <span className="text-xs">Undo</span>
      </button>

      {!lightningMode && (
        <button
          onClick={onErase}
          className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-white"
        >
          <span className="text-xl">⌫</span>
          <span className="text-xs">Erase</span>
        </button>
      )}

      <button
        onClick={onToggleLightning}
        className={`flex flex-col items-center gap-0.5 transition-colors ${
          lightningMode ? 'text-yellow-400' : 'text-gray-300 hover:text-white'
        }`}
      >
        <span className="text-xl">⚡</span>
        <span className="text-xs">Lightning</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/ActionBar.tsx
git commit -m "feat: ActionBar view — undo, erase, lightning toggle"
```

---

### Task 13: GameScreen + Lobby + ResultsScreen

**Files:**
- Create: `frontend/src/views/GameScreen.tsx`
- Create: `frontend/src/views/Lobby.tsx`
- Create: `frontend/src/views/ResultsScreen.tsx`

- [ ] **Step 1: Create `frontend/src/views/GameScreen.tsx`**

```typescript
import { useEffect } from 'react'
import { useGame } from '../viewmodels/useGame'
import type { Difficulty } from '../models'
import { Board } from './Board'
import { NumPad } from './NumPad'
import { ActionBar } from './ActionBar'
import { Timer } from './Timer'

interface Props {
  seed: number
  difficulty: Difficulty
  onFinish: (time: number) => void
}

export function GameScreen({ seed, difficulty, onFinish }: Props) {
  const game = useGame(seed, difficulty)

  useEffect(() => {
    if (game.isFinished) {
      onFinish(game.timer)
    }
  }, [game.isFinished, game.timer, onFinish])

  return (
    <div className="flex flex-col items-center gap-6 p-4 min-h-screen bg-gray-950">
      <div className="flex justify-between w-full max-w-sm">
        <span className="text-gray-400 capitalize">{difficulty}</span>
        <Timer seconds={game.timer} />
      </div>

      <Board
        board={game.board}
        solution={game.solution}
        selectedCell={game.selectedCell}
        selectedNum={game.selectedNum}
        onCellPress={game.selectCell}
      />

      <NumPad
        numRemaining={game.numRemaining}
        selectedNum={game.selectedNum}
        lightningMode={game.lightningMode}
        lightningNum={game.lightningNum}
        onNumPress={game.inputNumber}
      />

      <ActionBar
        onUndo={game.undo}
        onErase={game.erase}
        lightningMode={game.lightningMode}
        onToggleLightning={game.toggleLightning}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/views/Lobby.tsx`**

```typescript
import type { Difficulty } from '../models'

interface Props {
  onStartSolo: (difficulty: Difficulty, seed: number) => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

export function Lobby({ onStartSolo }: Props) {
  return (
    <div className="flex flex-col items-center gap-8 p-8 min-h-screen bg-gray-950 justify-center">
      <h1 className="text-4xl font-bold text-white">Sudoku Battle</h1>
      <p className="text-gray-400">Choose a difficulty to play solo:</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {DIFFICULTIES.map(d => (
          <button
            key={d}
            onClick={() => onStartSolo(d, Date.now())}
            className="py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold capitalize transition-colors"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/views/ResultsScreen.tsx`**

```typescript
import { useEffect, useState } from 'react'
import type { Difficulty } from '../models'
import { getBestTime, saveBestTime } from '../utils/bestTimes'

interface Props {
  time: number
  difficulty: Difficulty
  onPlayAgain: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function ResultsScreen({ time, difficulty, onPlayAgain }: Props) {
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)

  useEffect(() => {
    const prev = getBestTime(difficulty)
    saveBestTime(difficulty, time)
    setPersonalBest(getBestTime(difficulty))
    setIsNewBest(prev === null || time < prev)
  }, [difficulty, time])

  return (
    <div className="flex flex-col items-center gap-8 p-8 min-h-screen bg-gray-950 justify-center">
      <h2 className="text-3xl font-bold text-white">Puzzle Complete!</h2>
      <div className="text-center">
        <p className="text-gray-400 text-sm uppercase tracking-wide">Your time</p>
        <p className="text-5xl font-mono font-bold text-white mt-1">{formatTime(time)}</p>
      </div>
      {isNewBest && (
        <p className="text-yellow-400 font-semibold">New personal best!</p>
      )}
      {personalBest !== null && !isNewBest && (
        <p className="text-gray-400 text-sm">Personal best: {formatTime(personalBest)}</p>
      )}
      <button
        onClick={onPlayAgain}
        className="py-3 px-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
      >
        Play Again
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/
git commit -m "feat: GameScreen, Lobby, ResultsScreen views"
```

---

### Task 14: App routing + final wiring

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update `frontend/src/App.tsx`**

```typescript
import { useState } from 'react'
import { useTheme } from './viewmodels/useTheme'
import { Lobby } from './views/Lobby'
import { GameScreen } from './views/GameScreen'
import { ResultsScreen } from './views/ResultsScreen'
import type { Difficulty } from './models'

type Screen = 'lobby' | 'game' | 'results'

export default function App() {
  useTheme()

  const [screen, setScreen] = useState<Screen>('lobby')
  const [seed, setSeed] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [time, setTime] = useState(0)

  function startSolo(d: Difficulty, s: number) {
    setDifficulty(d)
    setSeed(s)
    setScreen('game')
  }

  function handleFinish(t: number) {
    setTime(t)
    setScreen('results')
  }

  if (screen === 'game') {
    return <GameScreen seed={seed} difficulty={difficulty} onFinish={handleFinish} />
  }
  if (screen === 'results') {
    return (
      <ResultsScreen
        time={time}
        difficulty={difficulty}
        onPlayAgain={() => setScreen('lobby')}
      />
    )
  }
  return <Lobby onStartSolo={startSolo} />
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and manually verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Verify:
- Lobby shows four difficulty buttons
- Selecting a difficulty starts a game with a rendered puzzle
- Cells are selectable (blue highlight)
- Placing numbers fills cells
- Wrong values show in red
- Undo reverts the last placement
- Lightning mode: tap number → arm; tap cell → place
- Timer counts up after first input
- Completing the puzzle transitions to results screen
- Results show time + personal best

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: App routing — lobby → game → results state machine"
```

---

## File Map Summary

| File | Responsibility |
|------|---------------|
| `backend/pyproject.toml` | Python deps + tool config |
| `backend/app/main.py` | FastAPI skeleton |
| `backend/app/core/config.py` | Pydantic settings (env vars) |
| `backend/conftest.py` | TestClient pytest fixture |
| `frontend/src/models/index.ts` | Cell, Board, RawBoard, Difficulty types |
| `frontend/src/utils/puzzle.ts` | mulberry32, isValidPlacement, hasUniqueSolution, generatePuzzle |
| `frontend/src/utils/bestTimes.ts` | getBestTime, saveBestTime (localStorage) |
| `frontend/src/viewmodels/useGame.ts` | All game logic — state, derived values, actions |
| `frontend/src/viewmodels/useTheme.ts` | Dark/light theme toggle + persistence |
| `frontend/src/views/Board.tsx` | 9×9 grid rendering with all cell states |
| `frontend/src/views/NumPad.tsx` | Digit buttons with remaining count badges |
| `frontend/src/views/ActionBar.tsx` | Undo, Erase, Lightning toggle |
| `frontend/src/views/Timer.tsx` | MM:SS display |
| `frontend/src/views/GameScreen.tsx` | Composes Board + NumPad + ActionBar + Timer |
| `frontend/src/views/Lobby.tsx` | Difficulty picker → starts solo game |
| `frontend/src/views/ResultsScreen.tsx` | Completion time + personal best display |
| `frontend/src/App.tsx` | Screen state machine (lobby → game → results) |
