# Backend Plan

## Spec
See [First Logic Phases Design](../docs/superpowers/specs/2026-04-10-first-logic-phases-design.md)

## Implementation Plans
- Phase 0 backend init: [spec](../docs/superpowers/specs/2026-04-13-phase0-backend-init-design.md) | [plan](../docs/superpowers/plans/2026-04-13-phase0-backend-init.md)
- Phase 0–1 overview: [plan](../docs/superpowers/plans/2026-04-10-phase-0-1-solo-play.md)

---

## Phase 0: Project Init

**Milestone:** `uvicorn app.main:app --reload` starts; `pytest` runs with nothing failing.

- [ ] `pyproject.toml` — FastAPI, uvicorn, google-cloud-firestore, bcrypt, pytest, pytest-asyncio, mypy, httpx
- [ ] `app/main.py` — FastAPI app with lifespan, CORS, static file mount placeholder
- [ ] `app/core/config.py` — pydantic-settings `BaseSettings` (`lru_cache` getter)
- [ ] `conftest.py` — Firestore emulator fixture (requires `FIRESTORE_EMULATOR_HOST=localhost:8080`)
- [ ] `mypy` configured in `pyproject.toml`

---

## Phase 2: Auth + Leaderboard

**Milestone:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/leaderboard` all pass tests.

### Structure
```
app/
├── core/
│   ├── config.py
│   └── security.py          # bcrypt hash + verify
├── models/
│   └── player.py            # TypedDict / dataclass for Firestore shape
├── schemas/
│   ├── auth.py              # RegisterRequest, LoginRequest, PlayerResponse
│   └── leaderboard.py       # LeaderboardEntry
├── repositories/
│   └── player_repo.py       # players/{name} CRUD
├── services/
│   └── auth_service.py      # register, login
├── api/
│   └── v1/
│       ├── router.py
│       └── endpoints/
│           ├── auth.py
│           └── leaderboard.py
└── api/
    └── dependencies.py      # get_db(), verify_player()
```

### Tasks
- [ ] `app/core/security.py` — `hash_pin(pin)`, `verify_pin(pin, hashed)`
- [ ] `app/models/player.py`
- [ ] `app/repositories/player_repo.py` — `get`, `create`, `update_stats`
- [ ] `app/services/auth_service.py` — `register`, `login` (raises on duplicate name / bad PIN)
- [ ] `app/schemas/auth.py`, `app/schemas/leaderboard.py`
- [ ] `app/api/v1/endpoints/auth.py` — `POST /api/auth/register`, `POST /api/auth/login`
- [ ] `app/api/v1/endpoints/leaderboard.py` — `GET /api/leaderboard`
- [ ] `app/api/dependencies.py` — `get_db()`, `verify_player()`
- [ ] Tests (Firestore emulator): register, login, duplicate name → 409, wrong PIN → 401, leaderboard sorted by wins

---

## Phase 3: Multiplayer

**Milestone:** Two WebSocket clients complete a full room lifecycle in tests.

### Room state machine
```
WAITING → READY → COUNTDOWN → PLAYING → FINISHED → (deleted)
```

### Structure
```
app/
├── models/
│   └── room.py              # Room dataclass + RoomStatus enum
├── repositories/
│   └── room_repo.py         # rooms/{room_id} CRUD
├── services/
│   └── room_service.py      # create_room, join_room, submit_result, batch_finalize
└── websocket/
    └── room_handler.py      # WebSocket message dispatch + broadcast
```

### WebSocket protocol
**Client → server:**
- `{ type: "CREATE_ROOM", difficulty, seed }`
- `{ type: "JOIN_ROOM" }`
- `{ type: "SUBMIT_RESULT", time }`

**Server → client:**
- `{ type: "ROOM_STATE", room }`
- `{ type: "COUNTDOWN", n }` (3, 2, 1)
- `{ type: "OPPONENT_FINISHED", name, time }`
- `{ type: "GAME_RESULTS", results[] }`

### Tasks
- [ ] `app/models/room.py` — `Room` dataclass, `RoomStatus` enum
- [ ] `app/repositories/room_repo.py` — create, get, update, delete
- [ ] `app/services/room_service.py` — `create_room`, `join_room`, `submit_result`, `batch_finalize` (atomic: update both players' stats + delete room)
- [ ] `app/websocket/room_handler.py` — connection manager, message routing, countdown loop, broadcast
- [ ] `WS /ws/room/{room_id}?name=X&pin=Y` endpoint in `app/main.py`
- [ ] Tests: create room, join room, full game lifecycle, disconnect handling, batch write

---

## Phase 4: Polish + Integration

- [ ] Verify atomic batch Firestore writes (leaderboard update + room delete) under concurrent load
- [ ] Error handling: invalid messages, auth failures on WS connect, room not found
- [ ] Validate `FIRESTORE_EMULATOR_HOST` env var wiring across all environments
- [ ] Rate limiting / basic abuse prevention on auth endpoints

---

## Phase 5: Deploy

- [ ] Multi-stage Dockerfile (Python deps → frontend build → final image)
- [ ] `gcloud run deploy sudoku-battle --source . --region=me-west1`
- [ ] Firestore production indexes: leaderboard query sorted by wins
- [ ] Firestore security rules: app-only writes, no direct client access
- [ ] GitHub Actions CI: `pytest -q` + `mypy app/` on all PRs
