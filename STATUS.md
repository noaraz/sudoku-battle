# Status

## Current Phase: 2 — Auth + Leaderboard

## Phase Overview

See [First Logic Phases Design](docs/superpowers/specs/2026-04-10-first-logic-phases-design.md) for full detail.

| Phase | Milestone | Status |
|-------|-----------|--------|
| **0: Init** | Dev servers start; test suites run | ✅ Done |
| **1: Solo Play** | Playable Sudoku in browser (no auth/network) | ✅ Done |
| **2: Auth + Leaderboard** | Register, log in, see leaderboard | ✅ Done |
| **3: Multiplayer** | Two tabs race on same puzzle | ⏳ Pending |
| **4: Polish** | Production-quality on mobile | 🔄 In Progress |
| **5: Deploy** | Live on Cloud Run (me-west1) | ⏳ Pending |

## Done
- [x] Game spec written (`docs/GAME_SPEC.md`)
- [x] Architecture decided (Cloud Run + Firestore + MVVM + TDD)
- [x] Scaffold created
- [x] Phase design doc written (`docs/superpowers/specs/2026-04-10-first-logic-phases-design.md`)
- [x] `backend/PLAN.md` generated
- [x] `frontend/PLAN.md` generated
- [x] Phase 1: Solo Play — puzzle generation, useGame hook, Board, NumPad, ActionBar, Timer, Lobby
- [x] UI Polish — lightning mode feedback, row/col/box highlighting, dark mode colors, cell font sizing, border visibility fix, lightning-mode dual-highlight bug fix
- [x] Phase 2: Auth + Leaderboard — name-only login, player list, leaderboard, Lobby main menu
  - Spec: [`docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md`](docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md)
  - Plan: [`docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md`](docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md)
- [x] Lightning mode fixes — clear selection on toggle, related cells in lightning mode, tap filled cell to switch digit, numpad change clears stale related cells

## Next
- [ ] Phase 3: Multiplayer
