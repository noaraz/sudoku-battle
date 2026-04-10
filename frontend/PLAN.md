# Frontend Plan

## Spec
See [First Logic Phases Design](../docs/superpowers/specs/2026-04-10-first-logic-phases-design.md)

---

## Phase 0: Project Init

**Milestone:** `npm run dev` starts; `npx vitest run` passes with nothing failing.

- [ ] Vite + React 18 + TypeScript scaffold (`npm create vite@latest`)
- [ ] Tailwind CSS configured (`tailwind.config.ts`, `postcss.config.js`)
- [ ] vitest + @testing-library/react + @testing-library/user-event installed and configured
- [ ] `src/` directory structure scaffolded:
  ```
  src/
  ├── models/
  ├── viewmodels/
  ├── views/
  ├── services/
  └── utils/
  ```
- [ ] `vite.config.ts` — test environment: jsdom, globals: true
- [ ] One smoke test to confirm the setup works

---

## Phase 1: Solo Play

**Milestone:** Playable Sudoku in the browser. Fill cells, undo, lightning mode, see completion time.

### TDD order: write tests first, then implementation.

### puzzle.ts (`src/utils/puzzle.ts`)

- [ ] Test: same seed + difficulty → identical `puzzle` and `solution` every call
- [ ] Test: each difficulty produces clue count in expected range (Easy ≈38, Medium ≈30, Hard ≈25, Expert ≈20)
- [ ] Test: no generated puzzle contains row/column/box conflicts
- [ ] Test: every generated puzzle has exactly one solution
- [ ] `mulberry32(seed)` — seeded PRNG factory
- [ ] `generatePuzzle(seed, difficulty)` — backtracking generator + cell removal
- [ ] `isValidPlacement(board, r, c, val)` — conflict check
- [ ] `hasUniqueSolution(board)` — backtrack solver returning count of solutions (stops at 2)

### Models (`src/models/`)

- [ ] `Cell` interface — `{ value: number | null; given: boolean; isError: boolean }`
- [ ] `Board` type — `Cell[][]`
- [ ] `Difficulty` type — `'easy' | 'medium' | 'hard' | 'expert'`
- [ ] `GameState` interface

### useGame hook (`src/viewmodels/useGame.ts`)

- [ ] Test: `inputNumber` in default mode places number in `selectedCell`
- [ ] Test: `inputNumber` in lightning mode arms `lightningNum`
- [ ] Test: `selectCell` in lightning mode (armed) places `lightningNum` in cell
- [ ] Test: `undo` reverts last placement
- [ ] Test: given cells are immutable (ignore `inputNumber` and `erase`)
- [ ] Test: `isComplete` only true when all non-given cells filled and match solution
- [ ] Test: `numRemaining[n]` decreases as `n` is placed
- [ ] Test: `cell.isError` set immediately when value ≠ solution
- [ ] Test: timer starts on first `inputNumber`, not on mount
- [ ] Implement `useGame(seed, difficulty)` with all state and actions

### useTheme hook (`src/viewmodels/useTheme.ts`)

- [ ] `useTheme()` — toggles `dark` class on `<html>`, persists to localStorage, default: dark

### Views (`src/views/`)

- [ ] `Board.tsx` — 9×9 grid, thick 3×3 box borders; cell states: given, user, selected, matching, highlight, error
- [ ] `NumPad.tsx` — digit buttons 1–9, badge showing `numRemaining[n]`, disabled when count = 0
- [ ] `ActionBar.tsx` — Undo, Erase (hidden in lightning mode), Lightning toggle
- [ ] `Timer.tsx` — `MM:SS` display from seconds
- [ ] `GameScreen.tsx` — composes Board + NumPad + ActionBar + Timer; receives `useGame()` output
- [ ] `Lobby.tsx` — difficulty picker, generates `seed = Date.now()`, navigates to game
- [ ] `ResultsScreen.tsx` (solo) — shows time + personal best from localStorage per difficulty

### Routing (Phase 1)

- [ ] `App.tsx` — state machine: `'lobby' | 'game' | 'results'`; no router library needed

---

## Phase 2: Auth + Leaderboard

**Milestone:** Register, log in, see a leaderboard.

### services/api.ts

- [ ] `src/services/api.ts` — typed fetch wrapper for REST endpoints (register, login, leaderboard)

### Hooks

- [ ] `useAuth()` — state: player, isLoggedIn, error, knownPlayers (localStorage); actions: register, login, logout
- [ ] `useLeaderboard()` — state: entries, loading; actions: load()

### Views

- [ ] `LoginScreen.tsx` — register vs. login toggle; known players list for quick re-login
- [ ] `LeaderboardScreen.tsx` — rank table (rank, name, wins, games played)
- [ ] Lobby updated — requires login, shows leaderboard link + difficulty picker

---

## Phase 3: Multiplayer

**Milestone:** Two browser tabs race each other.

### services/ws.ts

- [ ] `src/services/ws.ts` — WebSocket client, typed message send/receive, reconnect logic

### useRoom hook (`src/viewmodels/useRoom.ts`)

- [ ] Test: `createRoom` sends `CREATE_ROOM` message and updates state
- [ ] Test: incoming `COUNTDOWN` updates countdown state
- [ ] Test: incoming `OPPONENT_FINISHED` sets opponentFinished
- [ ] Test: incoming `GAME_RESULTS` sets results
- [ ] Implement `useRoom()` — state: room, opponentFinished, countdown, wsConnected; actions: createRoom, joinRoom, submitResult

### Views

- [ ] `WaitingRoom.tsx` — shows room ID to share, waiting for opponent message
- [ ] `Countdown.tsx` — full-screen 3… 2… 1… GO! animation
- [ ] `ResultsScreen.tsx` updated — battle mode: winner crown, both players' times, Play Again + Leaderboard buttons

---

## Phase 4: Polish + Integration

- [ ] Mobile-first layout validation (max-width 420px, test on 375px viewport)
- [ ] Full dark/light theme: exact colors, smooth transitions
- [ ] Exact board styling: thick 3×3 box borders, precise cell highlight colors per spec
- [ ] Error handling: network timeouts, WS disconnect + reconnect UX, invalid server responses
- [ ] `tsc --noEmit` passes with zero errors

---

## Phase 5: Deploy

- [ ] Production build: `npm run build` output goes into Docker image
- [ ] FastAPI configured to serve `dist/` as static files
- [ ] GitHub Actions CI: `npx tsc --noEmit` + `npx vitest run` on all PRs
- [ ] Uncomment Playwright E2E job in `.github/workflows/ci.yml` once UI is stable
