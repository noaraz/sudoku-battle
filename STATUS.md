# Status

## Current Phase: 2 — Auth + Leaderboard

## Phase Overview

See [First Logic Phases Design](docs/superpowers/specs/2026-04-10-first-logic-phases-design.md) for full detail.

| Phase | Milestone | Status |
|-------|-----------|--------|
| **0: Init** | Dev servers start; test suites run | ✅ Done |
| **1: Solo Play** | Playable Sudoku in browser (no auth/network) | ✅ Done |
| **2: Auth + Leaderboard** | Register, log in, see leaderboard | ⏳ Pending |
| **3: Multiplayer** | Two tabs race on same puzzle | ⏳ Pending |
| **4: Polish** | Production-quality on mobile | ⏳ Pending |
| **5: Deploy** | Live on Cloud Run (me-west1) | ⏳ Pending |

## Done
- [x] Game spec written (`docs/GAME_SPEC.md`)
- [x] Architecture decided (Cloud Run + Firestore + MVVM + TDD)
- [x] Scaffold created
- [x] Phase design doc written (`docs/superpowers/specs/2026-04-10-first-logic-phases-design.md`)
- [x] `backend/PLAN.md` generated
- [x] `frontend/PLAN.md` generated

## Done
- [x] Phase 1: Solo Play — playable Sudoku in the browser (no auth/network)
  - Puzzle generator (seed-based, mulberry32 PRNG, unique-solution enforcement)
  - `useGame` hook (selectCell, inputNumber, erase, undo, lightning mode, timer, numRemaining)
  - `useTheme` hook (dark/light, localStorage)
  - Board (9x9, box borders, selected/highlighted/related/error cell states)
  - NumPad (selectedNum highlight, remaining count badges, disabled when complete)
  - ActionBar (undo, erase, lightning toggle)
  - Lobby, GameScreen, ResultsScreen (personal best via localStorage)
  - 65 tests passing, tsc clean

## Next
- [ ] Phase 2: Auth + Leaderboard — register, log in, see leaderboard
