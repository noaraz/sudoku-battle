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

- **Spec:** [`../docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md`](../docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md)
- **Plan:** [`../docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md`](../docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md)

**Milestone:** `POST /api/v1/players`, `GET /api/v1/players`, `GET /api/v1/leaderboard` all pass tests.

> **Note:** Auth is name-only (no PIN). Players are identified by name; uniqueness enforced by Firestore doc ID.

### Tasks (see plan for full TDD steps)
- [ ] `app/models/player.py` — `Player` dataclass: name, wins, played, created_at
- [ ] `app/schemas/player.py` — `PlayerCreate`, `PlayerOut`
- [ ] `app/repositories/player_repo.py` — `create(name)`, `get_all()`
- [ ] `app/api/v1/players.py` — route handlers
- [ ] `backend/conftest.py` — add `ac_with_db` fixture
- [ ] `backend/app/main.py` — include players router at `/api/v1`
- [ ] Tests: create player, duplicate → 409, list players, leaderboard sorted by wins

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
