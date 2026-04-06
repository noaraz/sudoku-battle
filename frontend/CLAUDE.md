# Frontend — CLAUDE.md

React SPA for Sudoku gameplay. All game logic is client-side. Server only handles rooms, auth, leaderboard.

## MVVM Architecture

### Models (`src/models/`)
Pure TypeScript interfaces. No logic, no React.
- Cell, GameState, Player, Room, GameResult, Difficulty, RoomStatus

### ViewModels (`src/viewmodels/`)
Custom hooks. ALL business logic lives here. Testable with `renderHook()`.

**useAuth()** — player identity
- State: player, isLoggedIn, error, knownPlayers
- Actions: register(name, pin), login(name, pin), logout()
- Persists to localStorage for auto-remember

**useGame(seed, difficulty)** — all gameplay
- State: board, solution, selectedCell, selectedNum, lightningMode, lightningNum, timer, isFinished, undoHistory
- Actions: selectCell(r,c), inputNumber(n), erase(), undo(), toggleLightning()
- Derived: numRemaining{}, hasErrors, isComplete
- Puzzle generated client-side from seed — both players get identical puzzle

**useRoom()** — multiplayer
- State: room, opponentFinished, countdown, wsConnected
- Actions: createRoom(difficulty), joinRoom(), submitResult(time)
- Manages WebSocket lifecycle

**useLeaderboard()** — stats
- State: entries[], loading
- Actions: load()

**useTheme()** — light/dark
- State: theme
- Actions: toggle()
- Persists to localStorage

### Views (`src/views/`)
Pure rendering. No business logic. Delegate everything to ViewModel hooks.
- LoginScreen, Lobby, WaitingRoom, Countdown
- GameScreen (composes Board + NumPad + ActionBar + Timer + Toggles)
- ResultsScreen, LeaderboardScreen

### Services (`src/services/`)
- `api.ts` — REST client (auth, leaderboard)
- `ws.ts` — WebSocket client (room events)

### Utils (`src/utils/`)
- `puzzle.ts` — seed-based Sudoku generator + solver + validator
- `timer.ts` — timer helpers

## UI Reference
An artifact prototype exists in the Claude.ai conversation where this project was designed. Key UI decisions:
- Dark theme default, light theme toggle (☀️/🌙 floating top-right)
- 9x9 board with thick borders on 3x3 boxes
- Number pad below board showing remaining count per number
- Tapping a number highlights all matching cells (solid blue bg, white text)
- Lightning mode: tap number first, then tap cells to rapid-fill
- Undo + Erase action bar below numpad
- Error cells highlighted in red immediately
- Mobile-first, max-width 420px

## Testing
- vitest + @testing-library/react
- Test all ViewModel hooks with renderHook()
- Test puzzle generator: valid output, unique solutions, seed determinism, difficulty clue counts
- TDD: write test → make it pass → refactor
