# Phase 2 — Auth + Leaderboard Design

**Date:** 2026-04-19
**Status:** Approved

## Context

Phase 1 delivered a fully playable solo Sudoku game. Phase 2 adds player identity and a persistent win/loss leaderboard as the foundation for Phase 3 multiplayer. The game is played by two known players on separate devices, so player data must be stored in Firestore and accessible from both devices.

Key constraints:
- No passwords — just pick your name to play
- Two players only (for now), but the system should handle any number
- Separate devices → player data lives in Firestore, not localStorage
- Keep it simple: 3 endpoints, a player picker screen, and a scores screen

---

## Data Model

**Firestore collection: `players/{name}`**

The player's name is the document ID (enforces uniqueness for free).

| Field | Type | Notes |
|-------|------|-------|
| `wins` | number | Incremented after winning a battle |
| `played` | number | Incremented after any completed battle |
| `created_at` | timestamp | Set on registration |

No password field. Name uniqueness is enforced by Firestore document ID.

---

## Backend

### New endpoints

All under `/api/v1`, served by a new `app/api/v1/players.py` router registered in `app/main.py`.

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/v1/players` | `{ name: string }` | `201 PlayerOut` \| `409 name taken` |
| `GET` | `/api/v1/players` | — | `PlayerOut[]` (unordered) |
| `GET` | `/api/v1/leaderboard` | — | `PlayerOut[]` (sorted by wins desc) |

### New files

```
backend/app/
├── models/
│   └── player.py           # Player dataclass: name, wins, played, created_at
├── schemas/
│   └── player.py           # PlayerCreate (request), PlayerOut (response)
├── repositories/
│   └── player_repo.py      # Firestore CRUD: create(name), get_all()
└── api/
    └── v1/
        ├── __init__.py
        └── players.py      # Route handlers
```

### Updated files

- `app/main.py` — include players router at `/api/v1`

### Tests

`backend/tests/test_players.py` (TDD — write first):
- `POST /api/v1/players` happy path → 201, player in response
- `POST /api/v1/players` duplicate name → 409
- `GET /api/v1/players` → list of all players
- `GET /api/v1/leaderboard` → sorted by wins descending

---

## Frontend

### New files

```
frontend/src/
├── services/
│   └── api.ts                  # Typed fetch wrapper: createPlayer, getPlayers, getLeaderboard
├── viewmodels/
│   ├── useAuth.ts              # selectedPlayer, selectPlayer(name), addPlayer(name), knownPlayers[]
│   └── useLeaderboard.ts       # entries[], load()
└── views/
    ├── LoginScreen.tsx         # Player list + "Add player" row
    └── LeaderboardScreen.tsx   # Ranked list
```

### Updated files

- `src/models/index.ts` — add `Player` type: `{ name, wins, played }`
- `src/App.tsx` — state machine: `login | lobby | game | results | leaderboard`
  - Opens to `login` if no player in localStorage, else `lobby`
  - `login → lobby` on player select
  - `lobby → leaderboard` via Scores button; `leaderboard → lobby` via back
  - `lobby → game` via Solo (with difficulty picker); `game → results → lobby`
- `src/views/Lobby.tsx` — replace difficulty picker with main menu:
  - **Solo** → inline difficulty picker → start game
  - **Battle** → disabled, "coming soon"
  - **Scores** → navigate to leaderboard screen

### Component designs

**LoginScreen** — list rows (initials avatar · name · wins) + "Add player" row at bottom. Matches the Option C style approved in brainstorming. Empty state: "No players yet — add one below."

**LeaderboardScreen** — ranked list: rank number · initials avatar · name · wins · played. Back button returns to lobby.

**Lobby** — main menu cards: Solo (🧩) · Battle (⚔️, disabled) · Scores (📊).

### useAuth hook

```ts
// State
selectedPlayer: Player | null   // persisted to localStorage
knownPlayers: Player[]          // fetched from GET /api/v1/players on mount, sorted by name

// Actions
selectPlayer(name: string): void   // set selectedPlayer, save to localStorage
addPlayer(name: string): Promise<void>  // POST /api/v1/players → refresh knownPlayers
                                        // throws Error("name taken") on 409
```

### Tests

- `useAuth.test.ts` — selectPlayer, addPlayer (happy path + duplicate), localStorage persistence
- `useLeaderboard.test.ts` — load(), entries sorted by wins
- `views.test.tsx` — LoginScreen renders players, "Add player" row; LeaderboardScreen renders ranked list

---

## App State Machine

```
[login] ──select player──► [lobby]
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
           [game]        [leaderboard]   (battle — future)
                │              │
                ▼              │
           [results]           │
                │              │
                └──────────────┴──► [lobby]
```

---

## Out of Scope (Phase 2)

- PIN / password protection
- Battle mode (Phase 3)
- Leaderboard pagination (only 2 players for now)
- Logout / forget player UI
- Win/played counters updated by game results (those get wired in Phase 3 when multiplayer lands)

---

## Verification

1. **Backend**: `cd backend && pytest tests/test_players.py -v` — all cases pass
2. **Frontend**: `cd frontend && npx vitest run` — all tests pass including new auth/leaderboard tests
3. **Manual**: Open app → login screen shows empty list → add a player → select player → lobby shows Solo/Battle/Scores → tap Scores → leaderboard shows player with 0 wins
4. **Cross-device**: Register player on one device, open app on second device → same player appears in list
