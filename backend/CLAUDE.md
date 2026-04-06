# Backend — CLAUDE.md

FastAPI backend: REST API + WebSocket + serves frontend static build.

## Responsibilities
- Player auth (register/login with name + bcrypt PIN)
- Room lifecycle via WebSocket (create, join, countdown, results)
- Leaderboard (Firestore reads/writes)
- Serve built React frontend as static files

## Firestore Collections
```
players/{name}        → { pin_hash, wins, played, created_at }
rooms/{room_id}       → { host, guest, difficulty, seed, status, results[], created_at }
```
Rooms are ephemeral — deleted after game ends.

## API
```
POST /api/auth/register   → { name, pin }
POST /api/auth/login      → { name, pin }
GET  /api/leaderboard     → [{ name, wins, played }]
WS   /ws/room/{room_id}?name=X&pin=Y
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
├── api/v1/endpoints/   # auth.py, rooms.py, leaderboard.py
├── api/dependencies.py # get_firestore(), verify_player()
├── core/config.py      # pydantic_settings.BaseSettings + lru_cache
├── core/security.py    # bcrypt helpers
├── models/             # TypedDict / dataclass Firestore shapes
├── schemas/            # Pydantic request/response models
├── services/           # auth_service.py, room_service.py
├── repositories/       # player_repo.py, room_repo.py (Firestore access)
├── websocket/room_handler.py
└── main.py             # lifespan(app) inits app.state.db = firestore.AsyncClient()
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
