# Backend — CLAUDE.md

FastAPI backend: REST API + WebSocket + serves frontend static build.

## Responsibilities
- Player identity (name-only, no PIN — Phase 2)
- Room lifecycle via WebSocket (create, join, countdown, results — Phase 3)
- Leaderboard (Firestore reads/writes)
- Serve built React frontend as static files

## Firestore Collections
```
players/{name}        → { wins, played, created_at }
rooms/{room_id}       → { host, guest, difficulty, seed, status, results[], created_at }
```
Rooms are ephemeral — deleted after game ends.

## API (Phase 2 — implemented)
```
POST /api/v1/players        → { name }         create player (409 if taken)
GET  /api/v1/players        →                  list all players
GET  /api/v1/leaderboard    →                  players sorted by wins desc
```

## API (Phase 3 — planned)
```
WS   /ws/room/{room_id}?name=X
```

## WebSocket Protocol
Client sends: `{ type: "CREATE_ROOM", difficulty, seed }` | `{ type: "JOIN_ROOM" }` | `{ type: "SUBMIT_RESULT", time }`
Server sends: `{ type: "ROOM_STATE", room }` | `{ type: "COUNTDOWN", n }` | `{ type: "OPPONENT_FINISHED", name, time }` | `{ type: "GAME_RESULTS", results[] }`

## Room State Machine
WAITING → READY → COUNTDOWN → PLAYING → FINISHED → (deleted)

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
│   └── (rooms.py)      # Phase 3: WS room endpoints
├── core/config.py      # pydantic_settings.BaseSettings + lru_cache
├── models/             # dataclass Firestore shapes (player.py)
├── schemas/            # Pydantic request/response models (player.py)
├── repositories/       # player_repo.py, (room_repo.py Phase 3)
├── (websocket/)        # Phase 3: room_handler.py
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
