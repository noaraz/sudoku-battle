# First Logic Phases — Design Spec

**Date:** 2026-04-10
**Project:** Sudoku Battle
**Status:** Approved

---

## Context

The project is at scaffold stage — game spec and architecture are documented, but no implementation code exists. This spec defines the build phases and provides a detailed design for Phase 1 (solo play), which is the foundation everything else builds on.

**Decisions made:**
- Phase structure: milestone-based (each phase ends with something runnable)
- Backend and frontend run as **parallel tracks** within each phase
- Phase 1 scope: full solo experience (puzzle generator + game hook + views)

---

## Phase Overview

| Phase | Milestone | Tracks |
|-------|-----------|--------|
| **0: Init** | Dev servers start; test suites run | Backend + Frontend |
| **1: Solo Play** | Playable Sudoku in browser (no auth, no network) | Frontend only |
| **2: Auth + Leaderboard** | Register, log in, see leaderboard | Backend + Frontend |
| **3: Multiplayer** | Two browser tabs race on the same puzzle | Backend + Frontend |
| **4: Polish** | Production-quality on mobile | Both |
| **5: Deploy** | Live on Cloud Run (me-west1) | Infra |

---

## Phase 0: Project Init

**Milestone:** `npm run dev` and `uvicorn` start; test suites run with nothing failing.

### Backend track

- `pyproject.toml` — FastAPI, uvicorn, google-cloud-firestore, bcrypt, pytest, pytest-asyncio, mypy
- `app/main.py` — skeleton with lifespan, CORS, static file mount
- `app/core/config.py` — pydantic-settings BaseSettings (reads env vars)
- `conftest.py` — Firestore emulator fixture (`FIRESTORE_EMULATOR_HOST=localhost:8080`)
- `mypy.ini` / `[tool.mypy]` in pyproject.toml

### Frontend track

- Vite + React 18 + TypeScript scaffold
- Tailwind CSS configured
- vitest + @testing-library/react + @testing-library/user-event
- `src/` directory structure scaffolded:
  ```
  src/
  ├── models/
  ├── viewmodels/
  ├── views/
  ├── services/
  └── utils/
  ```

---

## Phase 1: Solo Play

**Milestone:** A Sudoku puzzle renders in the browser. You can fill cells, use lightning mode, undo, and see your completion time.

**Frontend only** — no backend involvement.

### puzzle.ts (`src/utils/puzzle.ts`)

The most critical piece. Both players in a battle game need the same puzzle, so determinism is essential.

**Seed-based PRNG:**

Use mulberry32 (fast, single-seed, well-distributed). Replaces `Math.random` locally during generation — same seed always produces the same puzzle.

```typescript
function mulberry32(seed: number): () => number
```

**Core functions (TDD-first — write tests before implementation):**

```typescript
generatePuzzle(seed: number, difficulty: Difficulty): { puzzle: Board; solution: Board }
isValidPlacement(board: Board, row: number, col: number, val: number): boolean
hasUniqueSolution(board: Board): boolean
```

**Generation algorithm:**
1. Create a fully solved 9×9 board via backtracking with PRNG-shuffled candidates
2. Remove cells one at a time, checking after each removal that unique solution is maintained
3. Stop when target clue count reached per difficulty

**Clue counts:**

| Difficulty | Clues |
|-----------|-------|
| Easy | ~38 |
| Medium | ~30 |
| Hard | ~25 |
| Expert | ~20 |

**Test cases written first:**
- Same seed + difficulty → identical `puzzle` and `solution` every call
- Each difficulty produces clue count in expected range
- No generated puzzle contains row/column/box conflicts
- Every generated puzzle has exactly one solution

### Cell model (`src/models/`)

```typescript
interface Cell {
  value: number | null   // current value (null = empty)
  given: boolean         // pre-filled by puzzle (immutable)
  isError: boolean       // value !== solution at same position
}

type Board = Cell[][]

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
```

### useGame hook (`src/viewmodels/useGame.ts`)

All game logic lives here. Views receive state and call actions — no logic in views.

**Signature:**
```typescript
function useGame(seed: number, difficulty: Difficulty): GameViewModel
```

**State:**
```typescript
board: Cell[][]
solution: number[][]       // raw number grid, never mutated
selectedCell: [number, number] | null
selectedNum: number | null
lightningMode: boolean
lightningNum: number | null // armed number in lightning mode
timer: number              // seconds elapsed
isFinished: boolean
undoHistory: Array<{ r: number; c: number; prev: number | null }>
```

**Derived (computed from state, not stored):**
```typescript
numRemaining: Record<number, number>  // 9 minus count of digit already placed
hasErrors: boolean                     // any cell.isError === true
isComplete: boolean                    // all non-given cells filled + no errors
```

**Actions:**
```typescript
selectCell(r: number, c: number): void
inputNumber(n: number): void
erase(): void
undo(): void
toggleLightning(): void
```

**Key behaviors (each covered by a test):**

| Behavior | Condition |
|----------|-----------|
| `inputNumber(n)` places `n` in `selectedCell` | Default mode |
| `inputNumber(n)` arms `lightningNum = n` | Lightning mode, no number armed yet |
| `inputNumber(n)` switches `lightningNum` to `n`, clears `selectedCell` | Lightning mode, different number already armed |
| `selectCell(r, c)` places `lightningNum` in cell | Lightning mode + number armed |
| `undo()` pops `undoHistory` and reverts board | Unlimited stack |
| `erase()` clears `selectedCell` | Default mode, non-given cell |
| `erase()` is a no-op | Lightning mode (button hidden, action guarded) |
| Given cells ignore `inputNumber` and `erase` | `cell.given === true` |
| `isComplete` is true only when all cells filled and all correct | — |
| `numRemaining[n]` decreases as `n` is placed | Computed from board state |
| `cell.isError` set immediately on placement | Compared to `solution` |
| Timer starts on first `inputNumber` call | Not on mount |
| Timer stops when `isComplete` becomes true | Final time is preserved in state |
| `isFinished` set when `isComplete` transitions to true | Triggers result screen |

### Views (`src/views/`)

Thin rendering only. No business logic. All props come from `useGame()` or `useTheme()`.

```
GameScreen
  ├─ Timer              props: timer (seconds)
  ├─ Board              props: board, selectedCell, selectedNum, onCellPress
  ├─ NumPad             props: numRemaining, selectedNum, lightningMode, lightningNum, onNumPress
  └─ ActionBar          props: onUndo, onErase, lightningMode, onToggleLightning

Lobby                   props: onStartSolo(difficulty)
ResultsScreen           props: time, personalBest, onPlayAgain (solo mode only in Phase 1)
```

**Board cell visual states:**

| State | Style (dark theme) |
|-------|-------------------|
| Given | `font-bold text-gray-400` |
| User-placed | `text-white` |
| Selected | `bg-blue-500` |
| Matching number | `bg-blue-500 text-white` |
| Row/col/box highlight | `bg-gray-800` subtle |
| Error | `text-red-400 bg-red-950` |

**NumPad:** Each digit button shows `numRemaining[n]` as a small badge. Disabled (greyed) when `numRemaining[n] === 0`.

**ActionBar:** Undo, Erase, Lightning toggle. Erase hidden in lightning mode.

### Routing (Phase 1)

Simple state machine in `App.tsx` — no router library needed yet.

```typescript
type Screen = 'lobby' | 'game' | 'results'
```

Lobby generates `seed = Date.now()` and transitions to game. Results shows time and personal best from `localStorage`.

**Personal best storage contract:**

```typescript
// Key format: "sudoku_best_<difficulty>"  e.g. "sudoku_best_easy"
// Value: JSON-serialized number (seconds)

// Utilities in src/utils/bestTimes.ts:
function getBestTime(difficulty: Difficulty): number | null
function saveBestTime(difficulty: Difficulty, seconds: number): void
```

`ResultsScreen` calls `getBestTime(difficulty)` on mount and `saveBestTime` if the current time beats the stored best.

### useTheme hook (`src/viewmodels/useTheme.ts`)

```typescript
function useTheme(): { theme: 'dark' | 'light'; toggle: () => void }
```

Persists to `localStorage`. Applies `dark` class to `<html>` for Tailwind dark mode. Default: dark.

---

## Phase 2: Auth + Leaderboard

**Milestone:** Register, log in, see a leaderboard.

### Backend track

- `app/core/security.py` — bcrypt hash + verify helpers
- `app/repositories/player_repo.py` — Firestore `players/{name}` CRUD
- `app/services/auth_service.py` — register (check name not taken, hash PIN, write), login (fetch, verify)
- `app/api/v1/endpoints/auth.py` — `POST /api/auth/register`, `POST /api/auth/login`
- `app/api/v1/endpoints/leaderboard.py` — `GET /api/leaderboard` (sorted by wins desc)
- `app/schemas/` — Pydantic request/response models
- Tests with Firestore emulator (register, login, duplicate name, wrong PIN, leaderboard sort)

### Frontend track

- `src/services/api.ts` — REST client (fetch wrapper, typed responses)
- `src/viewmodels/useAuth.ts` — register, login, logout; `knownPlayers` from localStorage for quick re-login
- `src/viewmodels/useLeaderboard.ts` — fetch + display
- `src/views/LoginScreen.tsx` — register vs. login toggle, known players list
- `src/views/LeaderboardScreen.tsx` — rank table
- Lobby updated: requires login, shows leaderboard link

---

## Phase 3: Multiplayer

**Milestone:** Two browser tabs race each other on the same puzzle.

### Backend track

**Room state machine:**
```
WAITING → READY → COUNTDOWN → PLAYING → FINISHED → (deleted)
```

- `app/models/room.py` — `Room` dataclass, `RoomStatus` enum
- `app/repositories/room_repo.py` — Firestore `rooms/{room_id}` CRUD
- `app/services/room_service.py` — room creation, join logic, result handling
- `app/websocket/room_handler.py` — WebSocket message dispatch:
  - Client → server: `CREATE_ROOM`, `JOIN_ROOM`, `SUBMIT_RESULT`
  - Server → client: `ROOM_STATE`, `COUNTDOWN`, `OPPONENT_FINISHED`, `GAME_RESULTS`, `ERROR`
  - `ERROR` payload: `{ type: "ERROR", code: string, message: string }` — sent on auth failure at connect, room not found, or invalid message; client surfaces as a toast/alert and does not crash
- `WS /ws/room/{room_id}?name=X&pin=Y` endpoint (auth on connect)
- Atomic batch write: update both players' `wins`/`played` + delete room
- Tests: full room lifecycle via WebSocket test client

### Frontend track

- `src/services/ws.ts` — WebSocket client, auto-reconnect, typed message parsing
- `src/viewmodels/useRoom.ts` — createRoom, joinRoom, submitResult; state: room, opponentFinished, countdown, wsConnected
- `src/views/WaitingRoom.tsx` — shows room ID to share, waiting for opponent
- `src/views/Countdown.tsx` — 3… 2… 1… GO!
- `ResultsScreen.tsx` updated — battle mode: winner crown, both players' times, play again

---

## Phase 4: Polish + Integration

**Milestone:** App passes all acceptance criteria below on a real mobile viewport (375px).

**Acceptance criteria:**

| Area | Criteria |
|------|----------|
| Layout | Board + NumPad + ActionBar fit without horizontal scroll at 375px width |
| Theme | Dark and light themes both correct; toggle persists across reload |
| Board styling | 3×3 box borders visually distinct from cell borders; all 6 cell states render correctly |
| Error UX | Network timeout shows user-facing message, does not crash |
| WS reconnect | Disconnecting and reconnecting mid-game resumes correct state |
| Firestore integrity | Batch write (leaderboard update + room delete) verified atomic via emulator test |
| Env config | `FIRESTORE_EMULATOR_HOST` respected in test, local, and Cloud Run environments |

---

## Phase 5: Deploy

**Milestone:** Live at `https://<service>.run.app` in me-west1.

- Multi-stage Dockerfile (backend deps → frontend build → final image serving both)
- `docker-compose.yml` — local dev with Firestore emulator sidecar
- `gcloud run deploy sudoku-battle --source . --region=me-west1`
- GitHub Actions CI: run tests + mypy + tsc + build on all PRs
- Firestore production: indexes for leaderboard query, security rules (app-only write)
- Uncomment Playwright E2E job in `.github/workflows/ci.yml`

---

## Related Files

| File | Purpose |
|------|---------|
| `docs/GAME_SPEC.md` | Full game specification (authoritative) |
| `backend/PLAN.md` | Backend phase task checklist (references this spec; created alongside this doc) |
| `frontend/PLAN.md` | Frontend phase task checklist (references this spec; created alongside this doc) |
| `STATUS.md` | Current phase tracker |
