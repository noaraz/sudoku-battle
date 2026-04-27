# Backend — CLAUDE.md

FastAPI backend: REST API + WebSocket + serves frontend static build.

## Responsibilities
- Player identity (name-only, no PIN — Phase 2)
- Room lifecycle via WebSocket (create, join, countdown, results — Phase 3)
- Leaderboard (Firestore reads/writes)
- Serve built React frontend as static files

## Firestore Collections
```
players/{name}       → { wins, played, created_at }
rooms/{room_id}      → { host, guest, difficulty, seed, status, winner, created_at, expires_at }
challenges/{id}      → { from_player, to_player, room_id, status, created_at, expires_at }
```
Rooms are ephemeral — deleted after game ends. TTL on `expires_at` for safety net cleanup.

## API (Phase 2 — implemented)
```
POST /api/v1/players        → { name }         create player (409 if taken)
GET  /api/v1/players        →                  list all players
GET  /api/v1/leaderboard    →                  players sorted by wins desc
```

## API (Phase 3 — in progress)
```
POST /api/v1/rooms                         → create room (host only)
GET  /api/v1/rooms/{room_id}               → get room state
DELETE /api/v1/rooms/{room_id}             → cancel room (host only, WAITING state)
POST /api/v1/challenges                    → send challenge (creates room + challenge)
GET  /api/v1/players/{name}/challenges     → poll pending challenges
POST /api/v1/challenges/{id}/accept        → accept → returns room_id, seed, difficulty
POST /api/v1/challenges/{id}/decline       → decline challenge
WS   /ws/room/{room_id}?name=X            → real-time game room
```

## WebSocket Protocol (Phase 3)
Client sends: `HEARTBEAT` | `PROGRESS { cells_filled }` | `SUBMIT_RESULT { time_ms }`
Server sends: `ROOM_STATE` | `COUNTDOWN { n }` | `OPPONENT_PROGRESS` | `GAME_RESULTS` | `OPPONENT_DISCONNECTED` | `ERROR { code }`

Room ID: 6-char alphanumeric uppercase. Heartbeat every 30s refreshes Firestore TTL; 90s timeout triggers disconnect handling.

## Room State Machine
WAITING → (guest joins → countdown) → PLAYING → FINISHED → (deleted)

## Cost Optimization
- ~7 Firestore writes per game (create room, join, 2 submits, 2 leaderboard updates, delete room)
- Budget: ~2,800 games/day within free tier (20K writes)
- All real-time via WebSocket, zero Firestore polling
- Leaderboard: one collection scan (not per-player reads)
- Batch writes: update both players' leaderboard + delete room atomically

## App Structure
```
app/
├── api/v1/
│   ├── players.py      # POST /players, GET /players, GET /leaderboard
│   ├── rooms.py        # Phase 3: POST/GET/DELETE /rooms
│   └── challenges.py   # Phase 3: challenge CRUD
├── core/config.py      # pydantic_settings.BaseSettings + lru_cache
├── models/             # player.py, room.py, challenge.py
├── schemas/            # player.py, room.py, challenge.py
├── repositories/       # player_repo.py, room_repo.py, challenge_repo.py
├── ws/                 # Phase 3: room_handler.py
└── main.py             # create_app() factory; lifespan inits app.state.db
```

## Testing
- pytest + pytest-asyncio
- Use Firestore emulator (`FIRESTORE_EMULATOR_HOST=localhost:8080`)
- Test auth, room state machine, WebSocket flows, leaderboard updates
- TDD: write test → make it pass → refactor

## Integration Test Pattern
```python
from httpx import AsyncClient, ASGITransport
async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
    ...  # use c.post(), c.get() etc.
```
Use this instead of TestClient — works with async routes.

## Env Var Sync Rule

Every new setting added to `app/core/config.py` **must** be added to `backend/.env.example`
(with an explanatory comment) in the same commit. This keeps the documented config and the
implementation in lock-step.

## Phase 3 References
- **Plan:** `docs/superpowers/plans/2026-04-19-phase3-multiplayer.md`
- **Spec:** `docs/superpowers/specs/2026-04-19-phase3-multiplayer-design.md`

## Phase 5 References
- **Plan:** `docs/superpowers/plans/2026-04-22-phase5-deploy.md`
- **Spec:** `/Users/noa.raz/.claude/plans/let-s-plan-phase-validated-horizon.md`
