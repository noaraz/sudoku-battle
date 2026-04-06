# Sudoku Battle — Game Specification

## Overview
Two players compete to solve the same Sudoku puzzle fastest. A shared room synchronizes the start. Each player solves independently. Times are compared at the end.

## Players
- Identified by unique name + 4-digit PIN
- PIN is bcrypt-hashed, stored in Firestore
- No sessions — auth is stateless (name+pin per request)
- Known players shown on login screen for quick re-login (names from Firestore, PIN entry only)

## Game Flow

### 1. Login
- First visit: register with name + 4-digit PIN
- Returning: select name from known players list, enter PIN
- Auto-remember on device via localStorage

### 2. Lobby
- Choose difficulty: Easy / Medium / Hard / Expert
- Actions: Create Room (battle), Join Room (battle), Solo Practice
- View Leaderboard
- Theme toggle (light/dark)

### 3. Battle Flow
```
Host creates room (picks difficulty)
  → Room gets unique ID + seed (Date.now())
  → Host enters Waiting Room
  → Host shares room URL or partner opens app and taps Join
Guest joins room
  → Both players see Waiting Room → "Opponent joined!"
  → 3... 2... 1... GO! (synchronized via WebSocket)
  → Both receive same seed + difficulty
  → Each generates identical puzzle client-side
  → Timer starts simultaneously
  → Play independently
  → On completion: result sent to server via WebSocket
  → Server notifies opponent: "X finished in M:SS!"
  → When both done: Results screen with winner
  → Leaderboard updated
  → Room deleted from Firestore
```

### 4. Solo Flow
```
Player picks difficulty → puzzle generated locally → play → see time + personal best
```
Solo results stored in localStorage only (no Firestore writes).

## Puzzle Generation
- Client-side only — no server involvement
- Seed-based: `Math.random` overridden with seeded PRNG so same seed = same puzzle
- Algorithm: generate full valid board via backtracking, then remove cells while ensuring unique solution
- Clue counts by difficulty:
  - Easy: ~38 clues
  - Medium: ~30 clues  
  - Hard: ~25 clues
  - Expert: ~20 clues

## Game Controls

### Default Mode
1. Tap cell on board → cell is selected (highlighted)
2. Tap number on pad → number placed in selected cell
3. Tapping a filled cell or number on pad highlights all matching numbers on board

### Lightning Mode (toggle)
1. Tap number on pad → number is "armed" (pad button stays highlighted)
2. Tap any empty cell → armed number placed immediately
3. Tap different number on pad → switch armed number, clear cell selection
4. Much faster for filling multiple cells with same number

### Other Controls
- **Undo**: reverts last placement (unlimited undo stack, resets per game)
- **Erase**: clears selected cell (not available in lightning mode — just tap a different number)
- **Number remaining**: each pad button shows count of how many of that number still need to be placed (e.g., "7" under the 1 button means 7 more 1s needed)
- Numbers that are fully placed (9/9) are dimmed on the pad

## Error Handling
- Errors shown in real-time: if a placed number conflicts with the solution, cell turns red
- Errors do NOT prevent continued play — player can overwrite or undo
- Game completes only when ALL cells are filled AND all match the solution

## Board Display
- 9x9 grid, thick borders on 3x3 box boundaries
- Given (pre-filled) numbers: lighter color, bolder weight
- User-placed numbers: standard weight
- Selected cell: blue background
- Matching numbers (same as selected): solid blue background, white text
- Row/column/box highlight: subtle background (not in lightning mode)
- Error cells: red text, light red background

## Opponent Notifications
- When opponent finishes: non-blocking toast "⚡ [Name] finished in M:SS!" visible for 4 seconds
- Does not interrupt gameplay

## Results Screen
### Battle
- Shows winner with 👑 crown
- Both players' times
- "Play Again" → back to lobby
- "Leaderboard" → view stats

### Solo
- Shows completion time
- Personal best per difficulty (localStorage)
- "Play Again" → new puzzle same difficulty
- "Lobby" → back to lobby

## Leaderboard
- Simple win counter per player
- Shows: rank, name, wins, games played
- Sorted by wins descending
- Persistent in Firestore

## Themes
- Dark mode (default): near-black background, blue accents, white/gray text
- Light mode: white/light gray background, deeper blue accents, dark text
- Toggle via ☀️/🌙 button, top-right corner, all screens
- Preference saved in localStorage

## Non-Features (explicitly excluded)
- No pencil marks / notes mode (may add later)
- No hints
- No mistake counter / max mistakes
- No score system (just time)
- No game history / replay
- No spectator mode
- No smart finish / auto-complete
