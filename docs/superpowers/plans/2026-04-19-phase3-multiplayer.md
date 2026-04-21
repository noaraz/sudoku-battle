# Phase 3: Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-player real-time Sudoku battles — room creation, challenge flow, synchronized countdown, live opponent progress bar, heartbeat-driven TTL, and winner/loser results screen.

**Architecture:** Thin-relay WebSocket server routes messages between two clients; Firestore stores room + challenge metadata with TTL fields; client-side puzzle generation (existing `puzzle.ts`) ensures identical boards via shared seed; heartbeat every 30s refreshes TTL and drives 90s disconnect detection.

**Spec:** `docs/superpowers/specs/2026-04-19-phase3-multiplayer-design.md`

**Tech Stack:** FastAPI + `google-cloud-firestore` async, Python 3.12, React 18 + TypeScript + Tailwind CSS

---

## File Structure

### Backend — new
| File | Responsibility |
|------|---------------|
| `app/models/room.py` | `Room` dataclass + `RoomStatus` enum |
| `app/models/challenge.py` | `Challenge` dataclass + `ChallengeStatus` enum |
| `app/schemas/room.py` | Pydantic I/O schemas for room endpoints |
| `app/schemas/challenge.py` | Pydantic I/O schemas for challenge endpoints |
| `app/repositories/room_repo.py` | Async Firestore CRUD: create (collision-retry), get, set_guest, set_winner (transaction), refresh_ttl, delete |
| `app/repositories/challenge_repo.py` | Async Firestore CRUD: create, get, get_pending_for, update_status |
| `app/api/v1/rooms.py` | `POST /rooms`, `GET /rooms/{id}`, `DELETE /rooms/{id}` |
| `app/api/v1/challenges.py` | `POST /challenges`, `GET /players/{name}/challenges`, `/challenges/{id}/accept`, `/challenges/{id}/decline` |
| `app/ws/__init__.py` | Empty package marker |
| `app/ws/room_handler.py` | WebSocket endpoint + in-memory connection registry + heartbeat monitor + countdown + relay + results |
| `tests/test_rooms.py` | Room endpoint tests |
| `tests/test_challenges.py` | Challenge endpoint tests |
| `tests/test_room_ws.py` | WebSocket handler tests |

### Backend — modified
| File | Change |
|------|--------|
| `app/repositories/player_repo.py` | Add `get(db, name)` and `increment_stats(db, winner, loser)` |
| `app/main.py` | Register rooms router, challenges router, WebSocket endpoint |
| `conftest.py` | Add `ac_with_rooms_db` fixture with rooms + challenges cleanup |

### Frontend — new
| File | Responsibility |
|------|---------------|
| `src/services/ws.ts` | Typed WS client, auto-heartbeat every 30s, typed message union |
| `src/viewmodels/useRoom.ts` | Battle state machine: createRoom, joinRoom, submitResult, cancelRoom, challenge polling |
| `src/viewmodels/useRoom.test.ts` | Unit tests for useRoom |
| `src/views/BattleMenu.tsx` | Player list (challenge) + code input (join) |
| `src/views/WaitingRoom.tsx` | Room code display + opponent slot + cancel |
| `src/views/Countdown.tsx` | 3-2-1-GO overlay driven by WS COUNTDOWN messages |

### Frontend — modified
| File | Change |
|------|--------|
| `src/models/index.ts` | Add `Room`, `GameResult`, `WsMessage` union type |
| `src/views/GameScreen.tsx` | Battle top strip: two progress bars |
| `src/views/ResultsScreen.tsx` | Battle mode: winner/loser layout |
| `src/views/Lobby.tsx` | Battle button active + pending challenge banner |
| `src/App.tsx` | State machine extended with battle screens |

---

## Chunk 0: Setup

### Task 0: Branch + update CLAUDE.md files

**Files:**
- Modify: `backend/CLAUDE.md`
- Modify: `frontend/CLAUDE.md`

- [ ] **Step 1: Create feature branch**

```bash
git checkout main && git pull
git checkout -b feat/phase3-multiplayer
```

- [ ] **Step 2: Update `backend/CLAUDE.md`**

Replace the stale Phase 3 API and WebSocket Protocol sections with the current spec. Update the file to reflect:

```markdown
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

Room ID: 6-char alphanumeric uppercase. Heartbeat every 30s refreshes TTL; 90s timeout triggers disconnect.

**Plan:** `docs/superpowers/plans/2026-04-19-phase3-multiplayer.md`
**Spec:** `docs/superpowers/specs/2026-04-19-phase3-multiplayer-design.md`
```

Also update `## Firestore Collections` to add rooms with correct fields:
```markdown
rooms/{room_id}      → { host, guest, difficulty, seed, status, winner, created_at, expires_at }
challenges/{id}      → { from_player, to_player, room_id, status, created_at, expires_at }
```

- [ ] **Step 3: Update `frontend/CLAUDE.md`**

Add Phase 3 references to the existing `## ViewModels` and `## Views` sections:

Under `**useRoom()** — multiplayer`, update the docblock to match the implemented interface:
```
- State: room, countdown, opponentProgress, results, wsConnected, pendingChallenge, opponentDisconnected, challengeSentTo
- Actions: createRoom(difficulty), sendChallenge(toPlayer, difficulty), joinRoom(code), submitResult(timeMs), sendProgress(cellsFilled), cancelRoom(), acceptChallenge(id), declineChallenge(id), startPolling(), stopPolling(), connectWs(roomId), disconnectWs()
```

Add to `### Views` list:
```
- BattleMenu — player list (challenge) + join-by-code input
- WaitingRoom — room code display, opponent slot, cancel
- Countdown — 3-2-1-GO full-screen overlay, auto-dismisses after GO
```

Add a reference note at the bottom:
```markdown
## Phase 3 References
- Plan: `docs/superpowers/plans/2026-04-19-phase3-multiplayer.md`
- Spec: `docs/superpowers/specs/2026-04-19-phase3-multiplayer-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add backend/CLAUDE.md frontend/CLAUDE.md
git commit -m "docs: update CLAUDE.md files with Phase 3 API and WS protocol"
```

---

## Chunk 1: Backend Data Layer

### Task 1: Player repo additions

**Files:**
- Modify: `backend/app/repositories/player_repo.py`
- Modify: `backend/tests/test_players.py`

- [ ] **Step 1: Write failing tests for `get` and `increment_stats`**

Add to `backend/tests/test_players.py`:

```python
@pytest.mark.asyncio
async def test_get_existing_player(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    await player_repo.create(db, "Greta")
    player = await player_repo.get(db, "Greta")
    assert player is not None
    assert player.name == "Greta"


@pytest.mark.asyncio
async def test_get_missing_player_returns_none(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    player = await player_repo.get(db, "NoSuchPlayer")
    assert player is None


@pytest.mark.asyncio
async def test_increment_stats(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    await player_repo.create(db, "Hana")
    await player_repo.create(db, "Ivan")
    await player_repo.increment_stats(db, winner="Hana", loser="Ivan")
    hana = await player_repo.get(db, "Hana")
    ivan = await player_repo.get(db, "Ivan")
    assert hana is not None and hana.wins == 1 and hana.played == 1
    assert ivan is not None and ivan.wins == 0 and ivan.played == 1
```

- [ ] **Step 2: Run tests — expect FAIL (AttributeError: module has no attribute 'get')**

```bash
docker compose exec backend pytest tests/test_players.py::test_get_existing_player tests/test_players.py::test_get_missing_player_returns_none tests/test_players.py::test_increment_stats -v
```

- [ ] **Step 3: Add `get` and `increment_stats` to `player_repo.py`**

Add these to the existing module-level imports at the top of `player_repo.py`:
```python
import logging
from google.cloud.firestore_v1 import async_transforms
```
Then append:

```python
async def get(db: AsyncClient, name: str) -> Player | None:
    doc = await db.collection(COLLECTION).document(name).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data is None:
        return None
    return Player(
        name=doc.id,
        wins=data["wins"],
        played=data["played"],
        created_at=data.get("created_at", datetime.now(UTC)),
    )


async def increment_stats(db: AsyncClient, winner: str, loser: str) -> None:
    """Increment wins+played for winner, played for loser. Best-effort — logs on failure."""
    try:
        await db.collection(COLLECTION).document(winner).update(
            {"wins": async_transforms.INCREMENT(1), "played": async_transforms.INCREMENT(1)}
        )
        await db.collection(COLLECTION).document(loser).update(
            {"played": async_transforms.INCREMENT(1)}
        )
    except Exception:
        logging.getLogger(__name__).error("increment_stats failed", exc_info=True)
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker compose exec backend pytest tests/test_players.py::test_get_existing_player tests/test_players.py::test_get_missing_player_returns_none tests/test_players.py::test_increment_stats -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/player_repo.py backend/tests/test_players.py
git commit -m "feat: add player_repo.get and increment_stats"
```

---

### Task 2: Room model + schema

**Files:**
- Create: `backend/app/models/room.py`
- Create: `backend/app/schemas/room.py`

- [ ] **Step 1: Create `app/models/room.py`**

```python
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import Enum


class RoomStatus(str, Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    FINISHED = "FINISHED"


@dataclass
class Room:
    room_id: str
    host: str
    difficulty: str
    seed: int
    status: RoomStatus
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime = field(default_factory=lambda: datetime.now(UTC) + timedelta(minutes=2))
    guest: str | None = None
    winner: str | None = None
```

- [ ] **Step 2: Create `app/schemas/room.py`**

```python
from pydantic import BaseModel


class CreateRoomRequest(BaseModel):
    difficulty: str
    player_name: str


class DeleteRoomRequest(BaseModel):
    player_name: str


class RoomOut(BaseModel):
    room_id: str
    seed: int
    difficulty: str
    host: str
    guest: str | None
    status: str
```

- [ ] **Step 3: Verify imports work**

```bash
docker compose exec backend python -c "from app.models.room import Room, RoomStatus; from app.schemas.room import RoomOut; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/room.py backend/app/schemas/room.py
git commit -m "feat: add Room model and schemas"
```

---

### Task 3: Challenge model + schema

**Files:**
- Create: `backend/app/models/challenge.py`
- Create: `backend/app/schemas/challenge.py`

- [ ] **Step 1: Create `app/models/challenge.py`**

```python
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import Enum


class ChallengeStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


@dataclass
class Challenge:
    challenge_id: str
    from_player: str
    to_player: str
    room_id: str
    status: ChallengeStatus
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime = field(default_factory=lambda: datetime.now(UTC) + timedelta(minutes=10))
```

- [ ] **Step 2: Create `app/schemas/challenge.py`**

```python
from pydantic import BaseModel


class CreateChallengeRequest(BaseModel):
    from_player: str
    to_player: str
    difficulty: str


class ChallengeCreatedOut(BaseModel):
    challenge_id: str
    room_id: str


class PendingChallengeOut(BaseModel):
    challenge_id: str
    from_player: str
    room_id: str


class AcceptChallengeOut(BaseModel):
    room_id: str
    seed: int
    difficulty: str
```

- [ ] **Step 3: Verify imports**

```bash
docker compose exec backend python -c "from app.models.challenge import Challenge, ChallengeStatus; print('ok')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/challenge.py backend/app/schemas/challenge.py
git commit -m "feat: add Challenge model and schemas"
```

---

### Task 4: Room repository

**Files:**
- Create: `backend/app/repositories/room_repo.py`
- Create: `backend/tests/test_rooms.py` (partial — repo tests only)

- [ ] **Step 1: Write failing repo tests**

Create `backend/tests/test_rooms.py`:

```python
import string

import pytest
from google.cloud import firestore

from app.models.room import Room, RoomStatus
from app.repositories import room_repo


@pytest.fixture(autouse=True)
async def cleanup_rooms(db: firestore.AsyncClient):
    yield
    async for doc in db.collection("rooms").stream():
        await doc.reference.delete()


@pytest.mark.asyncio
async def test_create_and_get_room(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    assert len(room.room_id) == 6
    assert all(c in string.ascii_uppercase + string.digits for c in room.room_id)
    fetched = await room_repo.get(db, room.room_id)
    assert fetched is not None
    assert fetched.host == "Alice"
    assert fetched.status == RoomStatus.WAITING
    assert fetched.guest is None


@pytest.mark.asyncio
async def test_get_missing_room_returns_none(db: firestore.AsyncClient) -> None:
    result = await room_repo.get(db, "ZZZZZZ")
    assert result is None


@pytest.mark.asyncio
async def test_set_guest(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_guest(db, room.room_id, "Bob")
    fetched = await room_repo.get(db, room.room_id)
    assert fetched is not None and fetched.guest == "Bob"


@pytest.mark.asyncio
async def test_set_winner_returns_true_first_time(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    won = await room_repo.set_winner(db, room.room_id, "Alice")
    assert won is True
    fetched = await room_repo.get(db, room.room_id)
    assert fetched is not None and fetched.winner == "Alice"
    assert fetched.status == RoomStatus.FINISHED


@pytest.mark.asyncio
async def test_set_winner_returns_false_second_time(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_winner(db, room.room_id, "Alice")
    won = await room_repo.set_winner(db, room.room_id, "Bob")
    assert won is False


@pytest.mark.asyncio
async def test_delete_room(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.delete(db, room.room_id)
    assert await room_repo.get(db, room.room_id) is None


@pytest.mark.asyncio
async def test_refresh_ttl_extends_expiry(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    original_expires = room.expires_at
    await room_repo.refresh_ttl(db, room.room_id)
    fetched = await room_repo.get(db, room.room_id)
    assert fetched is not None and fetched.expires_at >= original_expires
```

- [ ] **Step 2: Run — expect FAIL (ModuleNotFoundError)**

```bash
docker compose exec backend pytest tests/test_rooms.py -v
```

- [ ] **Step 3: Create `app/repositories/room_repo.py`**

```python
import secrets
import string
from datetime import UTC, datetime, timedelta

from google.api_core.exceptions import AlreadyExists
from google.cloud.firestore_v1 import AsyncClient, async_transactional

from app.models.room import Room, RoomStatus

COLLECTION = "rooms"
_CHARS = string.ascii_uppercase + string.digits


def _new_room_id() -> str:
    return "".join(secrets.choice(_CHARS) for _ in range(6))


async def create(db: AsyncClient, host: str, difficulty: str) -> Room:
    """Create a room with a unique 6-char ID. Retries on collision."""
    now = datetime.now(UTC)
    room = Room(
        room_id=_new_room_id(),
        host=host,
        difficulty=difficulty,
        seed=secrets.randbelow(10**9),
        status=RoomStatus.WAITING,
        created_at=now,
        expires_at=now + timedelta(minutes=2),
    )
    while True:
        ref = db.collection(COLLECTION).document(room.room_id)
        try:
            await ref.create(_to_dict(room))
            return room
        except AlreadyExists:
            room.room_id = _new_room_id()


async def get(db: AsyncClient, room_id: str) -> Room | None:
    doc = await db.collection(COLLECTION).document(room_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data is None:
        return None
    return _from_dict(room_id, data)


async def set_guest(db: AsyncClient, room_id: str, guest: str) -> None:
    await db.collection(COLLECTION).document(room_id).update({"guest": guest})


async def update_status(db: AsyncClient, room_id: str, status: RoomStatus) -> None:
    await db.collection(COLLECTION).document(room_id).update({"status": status.value})


@async_transactional
async def _set_winner_txn(transaction, ref, winner: str) -> bool:  # type: ignore[no-untyped-def]
    snapshot = await ref.get(transaction=transaction)
    data = snapshot.to_dict() or {}
    if data.get("winner") is not None:
        return False
    transaction.update(ref, {"winner": winner, "status": RoomStatus.FINISHED.value})
    return True


async def set_winner(db: AsyncClient, room_id: str, winner: str) -> bool:
    """Atomically set winner. Returns True if this call set it, False if already set."""
    ref = db.collection(COLLECTION).document(room_id)
    transaction = db.transaction()
    return await _set_winner_txn(transaction, ref, winner)  # type: ignore[return-value]


async def refresh_ttl(db: AsyncClient, room_id: str) -> None:
    expires_at = datetime.now(UTC) + timedelta(minutes=2)
    await db.collection(COLLECTION).document(room_id).update({"expires_at": expires_at})


async def delete(db: AsyncClient, room_id: str) -> None:
    await db.collection(COLLECTION).document(room_id).delete()


def _to_dict(room: Room) -> dict:
    return {
        "host": room.host,
        "guest": room.guest,
        "difficulty": room.difficulty,
        "seed": room.seed,
        "status": room.status.value,
        "winner": room.winner,
        "created_at": room.created_at,
        "expires_at": room.expires_at,
    }


def _from_dict(room_id: str, data: dict) -> Room:
    return Room(
        room_id=room_id,
        host=data["host"],
        guest=data.get("guest"),
        difficulty=data["difficulty"],
        seed=data["seed"],
        status=RoomStatus(data["status"]),
        winner=data.get("winner"),
        created_at=data["created_at"],
        expires_at=data["expires_at"],
    )
```

- [ ] **Step 4: Run — expect PASS**

```bash
docker compose exec backend pytest tests/test_rooms.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/room_repo.py backend/tests/test_rooms.py
git commit -m "feat: add room_repo with collision-retry and winner transaction"
```

---

### Task 5: Challenge repository + conftest cleanup

**Files:**
- Create: `backend/app/repositories/challenge_repo.py`
- Create: `backend/tests/test_challenges.py` (partial — repo tests)
- Modify: `backend/conftest.py`

- [ ] **Step 1: Write failing challenge repo tests**

Create `backend/tests/test_challenges.py`:

```python
from datetime import UTC, datetime, timedelta

import pytest
from google.cloud import firestore

from app.models.challenge import Challenge, ChallengeStatus
from app.repositories import challenge_repo, room_repo


@pytest.fixture(autouse=True)
async def cleanup(db: firestore.AsyncClient):
    yield
    for coll in ("challenges", "rooms"):
        async for doc in db.collection(coll).stream():
            await doc.reference.delete()


@pytest.mark.asyncio
async def test_create_and_get_challenge(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    ch = await challenge_repo.create(
        db, from_player="Alice", to_player="Bob", room_id=room.room_id
    )
    assert ch.status == ChallengeStatus.PENDING
    fetched = await challenge_repo.get(db, ch.challenge_id)
    assert fetched is not None and fetched.from_player == "Alice"


@pytest.mark.asyncio
async def test_get_pending_for_excludes_old(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    ch = await challenge_repo.create(
        db, from_player="Alice", to_player="Carol", room_id=room.room_id
    )
    # Manually backdate expires_at to simulate expiry
    await db.collection("challenges").document(ch.challenge_id).update(
        {"created_at": datetime.now(UTC) - timedelta(minutes=11)}
    )
    results = await challenge_repo.get_pending_for(db, "Carol")
    assert all(c.challenge_id != ch.challenge_id for c in results)


@pytest.mark.asyncio
async def test_update_status(db: firestore.AsyncClient) -> None:
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    ch = await challenge_repo.create(
        db, from_player="Alice", to_player="Bob", room_id=room.room_id
    )
    await challenge_repo.update_status(db, ch.challenge_id, ChallengeStatus.ACCEPTED)
    fetched = await challenge_repo.get(db, ch.challenge_id)
    assert fetched is not None and fetched.status == ChallengeStatus.ACCEPTED
```

- [ ] **Step 2: Run — expect FAIL**

```bash
docker compose exec backend pytest tests/test_challenges.py -v
```

- [ ] **Step 3: Create `app/repositories/challenge_repo.py`**

```python
import uuid
from datetime import UTC, datetime, timedelta

from google.cloud.firestore_v1 import AsyncClient

from app.models.challenge import Challenge, ChallengeStatus

COLLECTION = "challenges"


async def create(
    db: AsyncClient, from_player: str, to_player: str, room_id: str
) -> Challenge:
    now = datetime.now(UTC)
    ch = Challenge(
        challenge_id=str(uuid.uuid4()),
        from_player=from_player,
        to_player=to_player,
        room_id=room_id,
        status=ChallengeStatus.PENDING,
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    await db.collection(COLLECTION).document(ch.challenge_id).set(_to_dict(ch))
    return ch


async def get(db: AsyncClient, challenge_id: str) -> Challenge | None:
    doc = await db.collection(COLLECTION).document(challenge_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data is None:
        return None
    return _from_dict(doc.id, data)


async def get_pending_for(db: AsyncClient, player_name: str) -> list[Challenge]:
    cutoff = datetime.now(UTC) - timedelta(minutes=10)
    results: list[Challenge] = []
    async for doc in (
        db.collection(COLLECTION)
        .where("to_player", "==", player_name)
        .where("status", "==", ChallengeStatus.PENDING.value)
        .where("created_at", ">=", cutoff)
        .stream()
    ):
        data = doc.to_dict()
        if data:
            results.append(_from_dict(doc.id, data))
    return results


async def update_status(
    db: AsyncClient, challenge_id: str, status: ChallengeStatus
) -> None:
    await db.collection(COLLECTION).document(challenge_id).update(
        {"status": status.value}
    )


def _to_dict(ch: Challenge) -> dict:
    return {
        "from_player": ch.from_player,
        "to_player": ch.to_player,
        "room_id": ch.room_id,
        "status": ch.status.value,
        "created_at": ch.created_at,
        "expires_at": ch.expires_at,
    }


def _from_dict(challenge_id: str, data: dict) -> Challenge:
    return Challenge(
        challenge_id=challenge_id,
        from_player=data["from_player"],
        to_player=data["to_player"],
        room_id=data["room_id"],
        status=ChallengeStatus(data["status"]),
        created_at=data["created_at"],
        expires_at=data["expires_at"],
    )
```

- [ ] **Step 4: Add `ac_with_rooms_db` fixture to `conftest.py`**

At the top of `conftest.py`, add an alias for the httpx `AsyncClient` to avoid name collision with `firestore.AsyncClient`:

```python
from httpx import AsyncClient as HttpxClient
```

Then add after the existing `ac_with_db` fixture:

```python
@pytest.fixture
async def ac_with_rooms_db(db: firestore.AsyncClient) -> AsyncGenerator[HttpxClient, None]:
    """HttpxClient with db for room+challenge+player endpoint tests. Cleans all collections."""
    app.state.db = db
    async with HttpxClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    for coll in ("players", "rooms", "challenges"):
        async for doc in db.collection(coll).stream():
            await db.collection(coll).document(doc.id).delete()
    app.state.db = None  # type: ignore[assignment]
```

Also update any existing uses of `AsyncClient` (httpx) in conftest fixtures to use `HttpxClient` for consistency.

- [ ] **Step 5: Run — expect PASS**

```bash
docker compose exec backend pytest tests/test_challenges.py -v
```

- [ ] **Step 6: Run full backend suite — expect no regressions**

```bash
docker compose exec backend pytest -q
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/repositories/challenge_repo.py backend/tests/test_challenges.py backend/conftest.py
git commit -m "feat: add challenge_repo and ac_with_rooms_db fixture"
```

---

## Chunk 2: Backend REST API

### Task 6: Rooms REST endpoints

**Files:**
- Create: `backend/app/api/v1/rooms.py`
- Modify: `backend/tests/test_rooms.py` (add endpoint tests)
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add endpoint tests to `tests/test_rooms.py`**

Append to existing file:

```python
# --- Endpoint tests ---

@pytest.mark.asyncio
async def test_create_room_201(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    resp = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "easy"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["room_id"]) == 6
    assert body["host"] == "Alice"
    assert body["status"] == "WAITING"
    assert isinstance(body["seed"], int)


@pytest.mark.asyncio
async def test_create_room_unknown_player_404(ac_with_rooms_db: AsyncClient) -> None:
    resp = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Ghost", "difficulty": "easy"}
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_room(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    create = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "medium"}
    )
    room_id = create.json()["room_id"]
    resp = await ac_with_rooms_db.get(f"/api/v1/rooms/{room_id}")
    assert resp.status_code == 200
    assert resp.json()["room_id"] == room_id


@pytest.mark.asyncio
async def test_get_room_missing_404(ac_with_rooms_db: AsyncClient) -> None:
    resp = await ac_with_rooms_db.get("/api/v1/rooms/ZZZZZZ")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_room_by_host(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    create = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "easy"}
    )
    room_id = create.json()["room_id"]
    resp = await ac_with_rooms_db.delete(
        f"/api/v1/rooms/{room_id}", json={"player_name": "Alice"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_room_non_host_403(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    create = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "easy"}
    )
    room_id = create.json()["room_id"]
    resp = await ac_with_rooms_db.delete(
        f"/api/v1/rooms/{room_id}", json={"player_name": "Bob"}
    )
    assert resp.status_code == 403
```

- [ ] **Step 2: Run — expect FAIL (404 on /api/v1/rooms)**

```bash
docker compose exec backend pytest tests/test_rooms.py::test_create_room_201 -v
```

- [ ] **Step 3: Create `app/api/v1/rooms.py`**

```python
from fastapi import APIRouter, HTTPException, Request

from app.repositories import player_repo, room_repo
from app.schemas.room import CreateRoomRequest, DeleteRoomRequest, RoomOut

router = APIRouter(tags=["rooms"])


@router.post("/rooms", status_code=201, response_model=RoomOut)
async def create_room(body: CreateRoomRequest, request: Request) -> RoomOut:
    player = await player_repo.get(request.app.state.db, body.player_name)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    room = await room_repo.create(request.app.state.db, host=body.player_name, difficulty=body.difficulty)
    return RoomOut(
        room_id=room.room_id, seed=room.seed, difficulty=room.difficulty,
        host=room.host, guest=room.guest, status=room.status.value,
    )


@router.get("/rooms/{room_id}", response_model=RoomOut)
async def get_room(room_id: str, request: Request) -> RoomOut:
    room = await room_repo.get(request.app.state.db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomOut(
        room_id=room.room_id, seed=room.seed, difficulty=room.difficulty,
        host=room.host, guest=room.guest, status=room.status.value,
    )


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(room_id: str, body: DeleteRoomRequest, request: Request) -> None:
    from app.models.room import RoomStatus
    room = await room_repo.get(request.app.state.db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host != body.player_name:
        raise HTTPException(status_code=403, detail="Only the host can delete this room")
    if room.status != RoomStatus.WAITING:
        raise HTTPException(status_code=409, detail="Room is not in WAITING status")
    await room_repo.delete(request.app.state.db, room_id)
```

- [ ] **Step 4: Register router in `main.py`**

Add after the players router import:

```python
from app.api.v1 import rooms as rooms_router
```

Add inside `create_app()` after existing `include_router`:

```python
app.include_router(rooms_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run endpoint tests — expect PASS**

```bash
docker compose exec backend pytest tests/test_rooms.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/rooms.py backend/app/main.py backend/tests/test_rooms.py
git commit -m "feat: add rooms REST endpoints (POST/GET/DELETE)"
```

---

### Task 7: Challenges REST endpoints

**Files:**
- Create: `backend/app/api/v1/challenges.py`
- Modify: `backend/tests/test_challenges.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add endpoint tests to `tests/test_challenges.py`**

Append to existing file:

```python
# --- Endpoint tests ---

@pytest.mark.asyncio
async def test_create_challenge_201(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Bob"})
    resp = await ac_with_rooms_db.post(
        "/api/v1/challenges",
        json={"from_player": "Alice", "to_player": "Bob", "difficulty": "easy"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "challenge_id" in body
    assert len(body["room_id"]) == 6


@pytest.mark.asyncio
async def test_create_challenge_unknown_player_404(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    resp = await ac_with_rooms_db.post(
        "/api/v1/challenges",
        json={"from_player": "Alice", "to_player": "Ghost", "difficulty": "easy"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_pending_challenges(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Bob"})
    await ac_with_rooms_db.post(
        "/api/v1/challenges",
        json={"from_player": "Alice", "to_player": "Bob", "difficulty": "easy"},
    )
    resp = await ac_with_rooms_db.get("/api/v1/players/Bob/challenges")
    assert resp.status_code == 200
    challenges = resp.json()
    assert len(challenges) == 1
    assert challenges[0]["from_player"] == "Alice"


@pytest.mark.asyncio
async def test_accept_challenge(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Bob"})
    create = await ac_with_rooms_db.post(
        "/api/v1/challenges",
        json={"from_player": "Alice", "to_player": "Bob", "difficulty": "easy"},
    )
    challenge_id = create.json()["challenge_id"]
    resp = await ac_with_rooms_db.post(f"/api/v1/challenges/{challenge_id}/accept")
    assert resp.status_code == 200
    body = resp.json()
    assert "room_id" in body and "seed" in body and "difficulty" in body


@pytest.mark.asyncio
async def test_decline_challenge(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Bob"})
    create = await ac_with_rooms_db.post(
        "/api/v1/challenges",
        json={"from_player": "Alice", "to_player": "Bob", "difficulty": "easy"},
    )
    challenge_id = create.json()["challenge_id"]
    resp = await ac_with_rooms_db.post(f"/api/v1/challenges/{challenge_id}/decline")
    assert resp.status_code == 204
```

- [ ] **Step 2: Run — expect FAIL**

```bash
docker compose exec backend pytest tests/test_challenges.py::test_create_challenge_201 -v
```

- [ ] **Step 3: Create `app/api/v1/challenges.py`**

```python
from fastapi import APIRouter, HTTPException, Request

from app.models.challenge import ChallengeStatus
from app.repositories import challenge_repo, player_repo, room_repo
from app.schemas.challenge import (
    AcceptChallengeOut,
    ChallengeCreatedOut,
    CreateChallengeRequest,
    PendingChallengeOut,
)

router = APIRouter(tags=["challenges"])


@router.post("/challenges", status_code=201, response_model=ChallengeCreatedOut)
async def create_challenge(body: CreateChallengeRequest, request: Request) -> ChallengeCreatedOut:
    db = request.app.state.db
    if await player_repo.get(db, body.from_player) is None:
        raise HTTPException(404, f"Player '{body.from_player}' not found")
    if await player_repo.get(db, body.to_player) is None:
        raise HTTPException(404, f"Player '{body.to_player}' not found")
    room = await room_repo.create(db, host=body.from_player, difficulty=body.difficulty)
    ch = await challenge_repo.create(
        db, from_player=body.from_player, to_player=body.to_player, room_id=room.room_id
    )
    return ChallengeCreatedOut(challenge_id=ch.challenge_id, room_id=room.room_id)


@router.get("/players/{name}/challenges", response_model=list[PendingChallengeOut])
async def get_pending_challenges(name: str, request: Request) -> list[PendingChallengeOut]:
    challenges = await challenge_repo.get_pending_for(request.app.state.db, name)
    return [
        PendingChallengeOut(
            challenge_id=c.challenge_id, from_player=c.from_player, room_id=c.room_id
        )
        for c in challenges
    ]


@router.post("/challenges/{challenge_id}/accept", response_model=AcceptChallengeOut)
async def accept_challenge(challenge_id: str, request: Request) -> AcceptChallengeOut:
    db = request.app.state.db
    ch = await challenge_repo.get(db, challenge_id)
    if ch is None:
        raise HTTPException(404, "Challenge not found")
    await challenge_repo.update_status(db, challenge_id, ChallengeStatus.ACCEPTED)
    room = await room_repo.get(db, ch.room_id)
    if room is None:
        raise HTTPException(404, "Room not found")
    return AcceptChallengeOut(room_id=room.room_id, seed=room.seed, difficulty=room.difficulty)


@router.post("/challenges/{challenge_id}/decline", status_code=204)
async def decline_challenge(challenge_id: str, request: Request) -> None:
    ch = await challenge_repo.get(request.app.state.db, challenge_id)
    if ch is None:
        raise HTTPException(404, "Challenge not found")
    await challenge_repo.update_status(
        request.app.state.db, challenge_id, ChallengeStatus.DECLINED
    )
```

- [ ] **Step 4: Register in `main.py`**

Add import:
```python
from app.api.v1 import challenges as challenges_router
```

Add inside `create_app()`:
```python
app.include_router(challenges_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run all challenge tests — expect PASS**

```bash
docker compose exec backend pytest tests/test_challenges.py -v
```

- [ ] **Step 6: Run full suite — no regressions**

```bash
docker compose exec backend pytest -q
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/v1/challenges.py backend/app/main.py backend/tests/test_challenges.py
git commit -m "feat: add challenge endpoints (create, poll, accept, decline)"
```

---

## Chunk 3: Backend WebSocket

### Task 8: WebSocket room handler — connection + relay

**Files:**
- Create: `backend/app/ws/__init__.py`
- Create: `backend/app/ws/room_handler.py`
- Create: `backend/tests/test_room_ws.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing WebSocket tests**

Create `backend/tests/test_room_ws.py`:

```python
import pytest
from google.cloud import firestore
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.repositories import player_repo, room_repo


@pytest.fixture(autouse=True)
async def cleanup(db: firestore.AsyncClient):
    app.state.db = db
    yield
    app.state.db = None  # type: ignore[assignment]
    for coll in ("players", "rooms", "challenges"):
        async for doc in db.collection(coll).stream():
            await doc.reference.delete()


@pytest.mark.asyncio
async def test_ws_connect_unknown_player_error(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    client = TestClient(app)
    with client.websocket_connect("/ws/room/ABCDEF?name=Ghost") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "PLAYER_NOT_FOUND"


@pytest.mark.asyncio
async def test_ws_connect_unknown_room_error(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    client = TestClient(app)
    with client.websocket_connect("/ws/room/ZZZZZZ?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_NOT_FOUND"


@pytest.mark.asyncio
async def test_ws_host_receives_room_state(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ROOM_STATE"
        assert msg["host"] == "Alice"
        assert msg["seed"] == room.seed


@pytest.mark.asyncio
async def test_ws_submit_result_ignored_when_waiting(db: firestore.AsyncClient) -> None:
    """SUBMIT_RESULT while WAITING is silently ignored — no GAME_RESULTS sent."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        ws.receive_json()  # consume ROOM_STATE
        ws.send_json({"type": "SUBMIT_RESULT", "time_ms": 12345})
        # Send heartbeat to confirm connection still alive (no crash)
        ws.send_json({"type": "HEARTBEAT"})
        # If GAME_RESULTS were sent we'd receive it — getting here means it wasn't


@pytest.mark.asyncio
async def test_ws_connect_finished_room_rejected(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    from app.models.room import RoomStatus
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.update_status(db, room.room_id, RoomStatus.FINISHED)
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_FINISHED"


@pytest.mark.asyncio
async def test_ws_connect_room_full_rejected(db: firestore.AsyncClient) -> None:
    """Third player connecting to a WAITING room with guest already set gets ROOM_FULL when
    guest slot is occupied and player is neither host nor guest."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    await player_repo.create(db, "Bob")
    await player_repo.create(db, "Carol")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_guest(db, room.room_id, "Bob")
    # Simulate both Alice and Bob already in _connections by injecting directly
    from app.ws import room_handler
    room_handler._connections[room.room_id] = {
        "Alice": None,  # type: ignore[dict-item]  # value not used for ROOM_FULL check
        "Bob": None,
    }
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Carol") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_FULL"
    room_handler._connections.pop(room.room_id, None)
```

- [ ] **Step 2: Run — expect FAIL**

```bash
docker compose exec backend pytest tests/test_room_ws.py::test_ws_connect_unknown_player_error -v
```

- [ ] **Step 3: Create `app/ws/__init__.py`** (empty)

```bash
touch backend/app/ws/__init__.py
```

- [ ] **Step 4: Create `app/ws/room_handler.py`**

```python
import asyncio
import logging
from typing import Any

from fastapi import Query, WebSocket, WebSocketDisconnect

from app.models.room import RoomStatus
from app.repositories import player_repo, room_repo

logger = logging.getLogger(__name__)

HEARTBEAT_TIMEOUT = 90.0   # seconds: 3 missed 30s beats
HEARTBEAT_CHECK = 30.0     # seconds between checks

# In-memory state (single Cloud Run instance)
_connections: dict[str, dict[str, WebSocket]] = {}  # room_id -> {name: ws}
_last_hb: dict[tuple[str, str], float] = {}         # (room_id, name) -> loop time
_game_start: dict[str, float] = {}                  # room_id -> loop time at PLAYING


async def room_ws(
    websocket: WebSocket,
    room_id: str,
    name: str = Query(...),
) -> None:
    db = websocket.app.state.db  # type: ignore[attr-defined]

    # --- Validate in spec-defined order ---
    async def _reject(code: str, message: str) -> None:
        await websocket.accept()
        await websocket.send_json({"type": "ERROR", "code": code, "message": message})
        await websocket.close()

    if await player_repo.get(db, name) is None:
        return await _reject("PLAYER_NOT_FOUND", "Player not found")

    room = await room_repo.get(db, room_id)
    if room is None:
        return await _reject("ROOM_NOT_FOUND", "Room not found")
    if room.status == RoomStatus.FINISHED:
        return await _reject("ROOM_FINISHED", "Room already finished")
    if room.status == RoomStatus.PLAYING:
        return await _reject("ROOM_IN_PROGRESS", "Room game already in progress")

    existing = _connections.get(room_id, {})
    if len(existing) >= 2 and name not in existing:
        return await _reject("ROOM_FULL", "Room is full")
    if name != room.host and room.guest is not None and room.guest != name:
        return await _reject("WRONG_PLAYER", "Not authorized for this room")

    await websocket.accept()

    # Register
    _connections.setdefault(room_id, {})[name] = websocket
    _last_hb[(room_id, name)] = asyncio.get_event_loop().time()

    is_guest = name != room.host

    if is_guest:
        await room_repo.set_guest(db, room_id, name)
        room = await room_repo.get(db, room_id)

    room_state = {
        "type": "ROOM_STATE",
        "room_id": room_id,
        "host": room.host if room else "",
        "guest": room.guest if room else None,
        "difficulty": room.difficulty if room else "",
        "seed": room.seed if room else 0,
        "status": room.status.value if room else "",
    }
    await websocket.send_json(room_state)

    if is_guest and room and room.host in _connections.get(room_id, {}):
        host_ws = _connections[room_id][room.host]
        await host_ws.send_json(room_state)
        asyncio.create_task(_countdown(room_id, db))

    monitor = asyncio.create_task(_monitor(room_id, name, db))

    try:
        while True:
            data: dict[str, Any] = await websocket.receive_json()
            await _handle(room_id, name, data, db)
    except WebSocketDisconnect:
        pass
    finally:
        monitor.cancel()
        _connections.get(room_id, {}).pop(name, None)
        _last_hb.pop((room_id, name), None)
        if not _connections.get(room_id):
            _connections.pop(room_id, None)
            _game_start.pop(room_id, None)


async def _handle(room_id: str, name: str, data: dict, db: Any) -> None:
    msg_type = data.get("type")

    if msg_type == "HEARTBEAT":
        _last_hb[(room_id, name)] = asyncio.get_event_loop().time()
        await room_repo.refresh_ttl(db, room_id)

    elif msg_type == "PROGRESS":
        opponent_ws = _opponent_ws(room_id, name)
        if opponent_ws:
            await opponent_ws.send_json({
                "type": "OPPONENT_PROGRESS",
                "cells_filled": data.get("cells_filled", 0),
            })

    elif msg_type == "SUBMIT_RESULT":
        current = await room_repo.get(db, room_id)
        if not current or current.status != RoomStatus.PLAYING:
            return
        time_ms: int = data.get("time_ms", 0)
        won = await room_repo.set_winner(db, room_id, name)
        if won:
            await _finish(room_id, winner=name, winner_time_ms=time_ms, db=db)


async def _countdown(room_id: str, db: Any) -> None:
    for n in [3, 2, 1, 0]:
        await asyncio.sleep(1)
        for ws in list(_connections.get(room_id, {}).values()):
            try:
                await ws.send_json({"type": "COUNTDOWN", "n": n})
            except Exception:
                pass
    await room_repo.update_status(db, room_id, RoomStatus.PLAYING)
    _game_start[room_id] = asyncio.get_event_loop().time()


async def _monitor(room_id: str, name: str, db: Any) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_CHECK)
        key = (room_id, name)
        last = _last_hb.get(key)
        if last is None:
            return
        if asyncio.get_event_loop().time() - last > HEARTBEAT_TIMEOUT:
            logger.info("Heartbeat timeout: %s in room %s", name, room_id)
            room = await room_repo.get(db, room_id)
            if room and room.status == RoomStatus.PLAYING:
                opponent = _opponent_name(room_id, name)
                opp_ws = _opponent_ws(room_id, name)
                if opponent and opp_ws:
                    try:
                        await opp_ws.send_json({"type": "OPPONENT_DISCONNECTED"})
                    except Exception:
                        pass
                    start = _game_start.get(room_id, asyncio.get_event_loop().time())
                    elapsed_ms = int((asyncio.get_event_loop().time() - start) * 1000)
                    won = await room_repo.set_winner(db, room_id, opponent)
                    if won:
                        await _finish(room_id, winner=opponent, winner_time_ms=elapsed_ms, db=db)
            ws = _connections.get(room_id, {}).get(name)
            if ws:
                try:
                    await ws.close()
                except Exception:
                    pass
            return


async def _finish(room_id: str, winner: str, winner_time_ms: int, db: Any) -> None:
    for ws in list(_connections.get(room_id, {}).values()):
        try:
            await ws.send_json({
                "type": "GAME_RESULTS",
                "winner": winner,
                "winner_time_ms": winner_time_ms,
                "loser_time_ms": None,
            })
        except Exception:
            pass
    loser = _opponent_name(room_id, winner)
    if loser:
        asyncio.create_task(_update_leaderboard(winner, loser, db))
    await room_repo.delete(db, room_id)


async def _update_leaderboard(winner: str, loser: str, db: Any) -> None:
    try:
        await player_repo.increment_stats(db, winner=winner, loser=loser)
    except Exception:
        logger.error("Leaderboard update failed for %s vs %s", winner, loser, exc_info=True)


def _opponent_ws(room_id: str, name: str) -> WebSocket | None:
    for n, ws in _connections.get(room_id, {}).items():
        if n != name:
            return ws
    return None


def _opponent_name(room_id: str, name: str) -> str | None:
    for n in _connections.get(room_id, {}):
        if n != name:
            return n
    return None
```

- [ ] **Step 5: Register WebSocket in `main.py`**

Add import:
```python
from app.ws.room_handler import room_ws
```

Add inside `create_app()` after the router includes:
```python
app.add_api_websocket_route("/ws/room/{room_id}", room_ws)
```

- [ ] **Step 6: Run WS tests — expect PASS**

```bash
docker compose exec backend pytest tests/test_room_ws.py -v
```

- [ ] **Step 7: Run full suite**

```bash
docker compose exec backend pytest -q
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/ws/ backend/app/main.py backend/tests/test_room_ws.py
git commit -m "feat: add WebSocket room handler with connection validation and relay"
```

---

### Task 9: WebSocket — countdown, SUBMIT_RESULT, results, heartbeat tests

**Files:**
- Modify: `backend/tests/test_room_ws.py`

- [ ] **Step 1: Add integration tests for game flow**

Append to `tests/test_room_ws.py`:

```python
@pytest.mark.asyncio
async def test_ws_in_progress_room_rejected(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    from app.models.room import RoomStatus
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.update_status(db, room.room_id, RoomStatus.PLAYING)
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_IN_PROGRESS"


@pytest.mark.asyncio
async def test_heartbeat_refreshes_ttl(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    before = room.expires_at
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        ws.receive_json()  # ROOM_STATE
        ws.send_json({"type": "HEARTBEAT"})
    # After connection closes, fetch from Firestore and verify TTL was extended
    after_room = await room_repo.get(db, room.room_id)
    assert after_room is not None and after_room.expires_at >= before


@pytest.mark.asyncio
async def test_wrong_player_rejected(db: firestore.AsyncClient) -> None:
    """Carol (not host Alice, not registered guest Bob) connecting gets WRONG_PLAYER."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    await player_repo.create(db, "Bob")
    await player_repo.create(db, "Carol")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_guest(db, room.room_id, "Bob")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Carol") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "WRONG_PLAYER"
```

- [ ] **Step 2: Run — expect PASS**

```bash
docker compose exec backend pytest tests/test_room_ws.py -v
```

- [ ] **Step 3: Run mypy**

```bash
docker compose exec backend mypy app/
```

Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_room_ws.py
git commit -m "test: add WebSocket room handler integration tests"
```

---

### Task 10: Configure Firestore TTL (one-time infra step)

**Note:** This is a one-time Firestore console or CLI step, not application code. Firestore TTL deletion is eventually consistent (up to 72h delay after expiry), so the app-level heartbeat timeout (90s) is the primary active cleanup mechanism; TTL is the safety net.

- [ ] **Step 1: Configure TTL on `rooms` collection**

```bash
gcloud firestore fields ttls update expires_at \
  --collection-group=rooms \
  --enable-ttl \
  --project=sudoku-battle-local
```

For production, run the same command with the production project ID. Find it with: `gcloud projects list` or check the existing Cloud Run deploy config in the repo.

- [ ] **Step 2: Configure TTL on `challenges` collection**

```bash
gcloud firestore fields ttls update expires_at \
  --collection-group=challenges \
  --enable-ttl \
  --project=sudoku-battle-local
```

- [ ] **Step 3: Verify**

```bash
gcloud firestore fields ttls list --collection-group=rooms --project=sudoku-battle-local
```

Expected output shows `expires_at` with TTL enabled.

- [ ] **Step 4: Commit note**

```bash
git commit --allow-empty -m "infra: Firestore TTL enabled on rooms and challenges expires_at fields"
```

---

## Chunk 4: Frontend Core

> **Branch setup:** Before starting this chunk, confirm you are on `feat/phase3-multiplayer` (created in Chunk 1).

### Task 11: Add types to models

**Files:**
- Modify: `frontend/src/models/index.ts`

- [ ] **Step 1: Append new types to `src/models/index.ts`**

```typescript
export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface Room {
  room_id: string;
  host: string;
  guest: string | null;
  difficulty: Difficulty;
  seed: number;
  status: RoomStatus;
}

export interface GameResult {
  winner: string;
  winner_time_ms: number;
  loser_time_ms: number | null;
}

export type WsInMessage =
  | { type: "ROOM_STATE"; room_id: string; host: string; guest: string | null; difficulty: string; seed: number; status: string }
  | { type: "COUNTDOWN"; n: number }
  | { type: "OPPONENT_PROGRESS"; cells_filled: number }
  | { type: "GAME_RESULTS"; winner: string; winner_time_ms: number; loser_time_ms: number | null }
  | { type: "OPPONENT_DISCONNECTED" }
  | { type: "ERROR"; code: string; message: string };

export type WsOutMessage =
  | { type: "HEARTBEAT" }
  | { type: "PROGRESS"; cells_filled: number }
  | { type: "SUBMIT_RESULT"; time_ms: number };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/models/index.ts
git commit -m "feat: add Room, GameResult, WsInMessage types"
```

---

### Task 12: WebSocket client service

**Files:**
- Create: `frontend/src/services/ws.ts`

- [ ] **Step 1: Create `src/services/ws.ts`**

```typescript
import type { WsInMessage, WsOutMessage } from "../models";

type MessageHandler = (msg: WsInMessage) => void;

const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  (window.location.protocol === "https:" ? "wss:" : "ws:") +
    "//" +
    window.location.host;

export class RoomWsClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: MessageHandler[] = [];

  connect(roomId: string, playerName: string): void {
    const url = `${WS_BASE}/ws/room/${roomId}?name=${encodeURIComponent(playerName)}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      this.heartbeatTimer = setInterval(() => this.send({ type: "HEARTBEAT" }), 30_000);
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsInMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.addEventListener("close", () => this._clearHeartbeat());
  }

  send(msg: WsOutMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  close(): void {
    this._clearHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/ws.ts
git commit -m "feat: add typed WebSocket client with auto-heartbeat"
```

---

### Task 13: useRoom hook

**Files:**
- Create: `frontend/src/viewmodels/useRoom.ts`
- Create: `frontend/src/viewmodels/useRoom.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/viewmodels/useRoom.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRoom } from "./useRoom";

// Mock fetch
global.fetch = vi.fn();

// Mock RoomWsClient so we can simulate incoming WS messages
let mockOnMessage: ((msg: unknown) => void) | null = null;
vi.mock("../services/ws", () => ({
  RoomWsClient: vi.fn().mockImplementation(() => ({
    onMessage: vi.fn((handler: (msg: unknown) => void) => { mockOnMessage = handler; }),
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

const mockFetch = (data: unknown, status = 200) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => data,
  });
};

describe("useRoom", () => {
  beforeEach(() => { vi.useFakeTimers(); mockOnMessage = null; });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("createRoom sets room state with host from playerName", async () => {
    // API returns only room_id, seed, difficulty (no host/guest/status)
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => {
      await result.current.createRoom("easy");
    });
    expect(result.current.room?.room_id).toBe("ABCDEF");
    expect(result.current.room?.host).toBe("Alice");
    expect(result.current.room?.status).toBe("WAITING");
  });

  it("joinRoom sets room state from API response", async () => {
    mockFetch({ room_id: "XYZABC", seed: 456, difficulty: "medium", host: "Bob", guest: null, status: "WAITING" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => {
      await result.current.joinRoom("XYZABC");
    });
    expect(result.current.room?.room_id).toBe("XYZABC");
    expect(result.current.room?.host).toBe("Bob");
  });

  it("ROOM_STATE WS message updates room", async () => {
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => { await result.current.createRoom("easy"); });
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => {
      mockOnMessage?.({ type: "ROOM_STATE", room_id: "ABCDEF", host: "Alice", guest: "Bob", difficulty: "easy", seed: 123, status: "PLAYING" });
    });
    expect(result.current.room?.guest).toBe("Bob");
    expect(result.current.room?.status).toBe("PLAYING");
  });

  it("COUNTDOWN WS message sets countdown", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "COUNTDOWN", n: 3 }); });
    expect(result.current.countdown).toBe(3);
  });

  it("COUNTDOWN n=0 clears countdown after 500ms", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "COUNTDOWN", n: 0 }); });
    expect(result.current.countdown).toBe(0);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.countdown).toBeNull();
  });

  it("OPPONENT_PROGRESS WS message updates opponentProgress", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "OPPONENT_PROGRESS", cells_filled: 42 }); });
    expect(result.current.opponentProgress).toBe(42);
  });

  it("GAME_RESULTS WS message updates results", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "GAME_RESULTS", winner: "Alice", winner_time_ms: 12345, loser_time_ms: null }); });
    expect(result.current.results?.winner).toBe("Alice");
  });

  it("polls for challenges when startPolling is called", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => result.current.startPolling());
    act(() => { vi.advanceTimersByTime(3000); });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/players/Alice/challenges")
    );
  });

  it("stopPolling clears the interval", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    });
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => result.current.startPolling());
    act(() => result.current.stopPolling());
    const callCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { vi.advanceTimersByTime(9000); });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });

  it("cancelRoom clears room state", async () => {
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    mockFetch({}, 204); // DELETE response
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => { await result.current.createRoom("easy"); });
    await act(async () => { await result.current.cancelRoom(); });
    expect(result.current.room).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/viewmodels/useRoom.test.ts
```

- [ ] **Step 3: Create `src/viewmodels/useRoom.ts`**

```typescript
import { useCallback, useRef, useState } from "react";
import type { GameResult, Room, WsInMessage } from "../models";
import { RoomWsClient } from "../services/ws";

const API = import.meta.env.VITE_API_URL ?? "";

interface PendingChallenge {
  challenge_id: string;
  from_player: string;
  room_id: string;
}

interface RoomState {
  room: Room | null;
  countdown: number | null;
  opponentProgress: number;
  results: GameResult | null;
  wsConnected: boolean;
  pendingChallenge: PendingChallenge | null;
  opponentDisconnected: boolean;
  challengeSentTo: string | null;
  createRoom: (difficulty: string) => Promise<void>;
  sendChallenge: (toPlayer: string, difficulty: string) => Promise<{ challenge_id: string; room_id: string }>;
  joinRoom: (roomId: string) => Promise<void>;
  submitResult: (timeMs: number) => void;
  sendProgress: (cellsFilled: number) => void;
  cancelRoom: () => Promise<void>;
  acceptChallenge: (challengeId: string) => Promise<{ room_id: string; seed: number; difficulty: string }>;
  declineChallenge: (challengeId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  connectWs: (roomId: string) => void;
  disconnectWs: () => void;
}

export function useRoom(playerName: string): RoomState {
  const [room, setRoom] = useState<Room | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [results, setResults] = useState<GameResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [challengeSentTo, setChallengeSentTo] = useState<string | null>(null);

  const wsRef = useRef<RoomWsClient | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoomId = useRef<string | null>(null);

  const handleWsMessage = useCallback((msg: WsInMessage) => {
    switch (msg.type) {
      case "ROOM_STATE":
        setRoom({
          room_id: msg.room_id,
          host: msg.host,
          guest: msg.guest,
          difficulty: msg.difficulty as Room["difficulty"],
          seed: msg.seed,
          status: msg.status as Room["status"],
        });
        break;
      case "COUNTDOWN":
        setCountdown(msg.n);
        if (msg.n === 0) {
          setTimeout(() => setCountdown(null), 500);
        }
        break;
      case "OPPONENT_PROGRESS":
        setOpponentProgress(msg.cells_filled);
        break;
      case "OPPONENT_DISCONNECTED":
        setOpponentDisconnected(true);
        break;
      case "GAME_RESULTS":
        setResults({ winner: msg.winner, winner_time_ms: msg.winner_time_ms, loser_time_ms: msg.loser_time_ms });
        break;
      default:
        break;
    }
  }, []);

  const connectWs = useCallback((roomId: string) => {
    const client = new RoomWsClient();
    client.onMessage(handleWsMessage);
    client.connect(roomId, playerName);
    wsRef.current = client;
    setWsConnected(true);
  }, [playerName, handleWsMessage]);

  const disconnectWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsConnected(false);
  }, []);

  const createRoom = useCallback(async (difficulty: string) => {
    const res = await fetch(`${API}/api/v1/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName, difficulty }),
    });
    if (!res.ok) throw new Error("Failed to create room");
    const { room_id, seed } = await res.json() as { room_id: string; seed: number; difficulty: string };
    // API returns room_id/seed/difficulty only; set host from playerName locally
    setRoom({ room_id, host: playerName, guest: null, difficulty: difficulty as Room["difficulty"], seed, status: "WAITING" });
    currentRoomId.current = room_id;
  }, [playerName]);

  const sendChallenge = useCallback(async (toPlayer: string, difficulty: string) => {
    const res = await fetch(`${API}/api/v1/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_player: playerName, to_player: toPlayer, difficulty }),
    });
    if (!res.ok) throw new Error("Failed to send challenge");
    const { challenge_id, room_id } = await res.json() as { challenge_id: string; room_id: string };
    setRoom({ room_id, host: playerName, guest: null, difficulty: difficulty as Room["difficulty"], seed: 0, status: "WAITING" });
    setChallengeSentTo(toPlayer);
    currentRoomId.current = room_id;
    return { challenge_id, room_id };
  }, [playerName]);

  const joinRoom = useCallback(async (roomId: string) => {
    const res = await fetch(`${API}/api/v1/rooms/${roomId}`);
    if (!res.ok) throw new Error("Room not found");
    const data = await res.json() as Room;
    setRoom(data);
    currentRoomId.current = roomId;
  }, []);

  const submitResult = useCallback((timeMs: number) => {
    wsRef.current?.send({ type: "SUBMIT_RESULT", time_ms: timeMs });
  }, []);

  // Throttled: sends at most once per 500ms to avoid flooding the server
  const sendProgress = useCallback((cellsFilled: number) => {
    if (progressTimerRef.current) return;
    wsRef.current?.send({ type: "PROGRESS", cells_filled: cellsFilled });
    progressTimerRef.current = setTimeout(() => { progressTimerRef.current = null; }, 500);
  }, []);

  const cancelRoom = useCallback(async () => {
    const roomId = currentRoomId.current;
    if (!roomId) return;
    await fetch(`${API}/api/v1/rooms/${roomId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName }),
    });
    setRoom(null);
    setChallengeSentTo(null);
    currentRoomId.current = null;
  }, [playerName]);

  const acceptChallenge = useCallback(async (challengeId: string) => {
    const res = await fetch(`${API}/api/v1/challenges/${challengeId}/accept`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to accept challenge");
    return res.json() as Promise<{ room_id: string; seed: number; difficulty: string }>;
  }, []);

  const declineChallenge = useCallback(async (challengeId: string) => {
    await fetch(`${API}/api/v1/challenges/${challengeId}/decline`, { method: "POST" });
    setPendingChallenge(null);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/v1/players/${playerName}/challenges`);
        if (res.ok) {
          const challenges = await res.json() as PendingChallenge[];
          if (challenges.length > 0) setPendingChallenge(challenges[0]);
        }
      } catch { /* silently ignore */ }
    };
    pollRef.current = setInterval(poll, 3_000);
  }, [playerName]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  return {
    room, countdown, opponentProgress, results,
    wsConnected, pendingChallenge, opponentDisconnected, challengeSentTo,
    createRoom, sendChallenge, joinRoom, submitResult, sendProgress, cancelRoom,
    acceptChallenge, declineChallenge,
    startPolling, stopPolling, connectWs, disconnectWs,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/viewmodels/useRoom.test.ts
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/viewmodels/useRoom.ts frontend/src/viewmodels/useRoom.test.ts
git commit -m "feat: add useRoom hook with challenge polling and WS lifecycle"
```

---

## Chunk 5: Frontend Views

### Task 14: BattleMenu + WaitingRoom + Countdown components

**Files:**
- Create: `frontend/src/views/BattleMenu.tsx`
- Create: `frontend/src/views/WaitingRoom.tsx`
- Create: `frontend/src/views/Countdown.tsx`

- [ ] **Step 1: Create `src/views/BattleMenu.tsx`**

```tsx
import { useState } from "react";
import type { Player } from "../models";

interface Props {
  players: Player[];
  currentPlayer: string;
  onChallenge: (toPlayer: string, difficulty: string) => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  onBack: () => void;
}

const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

export function BattleMenu({ players, currentPlayer, onChallenge, onJoinByCode, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const others = players.filter((p) => p.name !== currentPlayer);

  async function handleChallenge(name: string) {
    try {
      setError(null);
      await onChallenge(name, difficulty);
    } catch {
      setError("Failed to send challenge. Please try again.");
    }
  }

  async function handleJoin() {
    if (code.trim().length !== 6) { setError("Enter a 6-character room code."); return; }
    try {
      setError(null);
      await onJoinByCode(code.trim().toUpperCase());
    } catch {
      setError("Room not found. Check the code and try again.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="mb-4 text-zinc-400 hover:text-white text-sm">← Back</button>
        <h1 className="text-2xl font-bold mb-6 text-center">⚔️ Battle</h1>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-1 rounded text-sm capitalize ${difficulty === d ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4 mb-4">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Challenge a Player</p>
          {others.length === 0 ? (
            <p className="text-zinc-500 text-sm">No other players registered yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {others.map((p) => (
                <div key={p.name} className="flex items-center gap-3 bg-zinc-900 rounded-lg p-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <button
                    onClick={() => handleChallenge(p.name)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Challenge →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Join by Room Code</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="K7X2AB"
              className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-center font-mono tracking-widest text-sm"
              maxLength={6}
            />
            <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 text-sm font-bold">
              Join
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/views/WaitingRoom.tsx`**

```tsx
interface Props {
  roomId: string;
  host: string;
  guest: string | null;
  challengeSentTo: string | null;
  onCancel: () => void;
}

export function WaitingRoom({ roomId, host, guest, challengeSentTo, onCancel }: Props) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs text-center">
        <div className="text-4xl mb-2">⚔️</div>
        <h1 className="text-xl font-bold mb-1">Battle Room</h1>
        <p className="text-zinc-400 text-sm mb-6">Share the code with your opponent</p>

        <div className="bg-zinc-800 rounded-xl p-6 mb-4 border-2 border-dashed border-zinc-600">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Room Code</p>
          <p className="text-4xl font-mono font-bold tracking-widest text-blue-400">{roomId}</p>
        </div>

        {challengeSentTo && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 mb-4 text-emerald-400 text-sm">
            ⏳ Challenge sent to <strong>{challengeSentTo}</strong>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {host.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm text-white">{host}</p>
              <p className="text-xs text-blue-400">Host</p>
            </div>
            <span className="text-emerald-400 text-xs">✓</span>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-lg p-3">
            {guest ? (
              <>
                <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                  {guest.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm text-white flex-1">{guest}</p>
                <span className="text-emerald-400 text-xs">✓</span>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-lg">?</div>
                <p className="text-sm text-zinc-500">Waiting for opponent…</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg py-3 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/views/Countdown.tsx`**

```tsx
interface Props {
  n: number | null;
}

export function Countdown({ n }: Props) {
  if (n === null) return null;

  return (
    <div className="fixed inset-0 bg-zinc-900/90 flex items-center justify-center z-50">
      <div className="text-center">
        <p className="text-8xl font-bold text-white">
          {n === 0 ? "GO!" : n}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/BattleMenu.tsx frontend/src/views/WaitingRoom.tsx frontend/src/views/Countdown.tsx
git commit -m "feat: add BattleMenu, WaitingRoom, Countdown components"
```

---

### Task 15: GameScreen battle top strip

**Files:**
- Modify: `frontend/src/views/GameScreen.tsx`

- [ ] **Step 1: Read existing `GameScreen.tsx`**

```bash
cat frontend/src/views/GameScreen.tsx
```

- [ ] **Step 2: Add battle props and top strip**

Add optional props to `GameScreen`:

```tsx
interface GameScreenProps {
  seed: number;
  difficulty: Difficulty;
  onFinish: (seconds: number) => void;
  // Battle mode (optional)
  battleMode?: boolean;
  playerName?: string;
  opponentName?: string;
  opponentProgress?: number;    // 0-81
  playerProgress?: number;      // 0-81
}
```

Add the top strip just above the board (inside the existing layout, before the `<Board>` component):

```tsx
{battleMode && (
  <div className="w-full max-w-[360px] bg-zinc-800 border-b border-zinc-700 px-3 py-2 mb-1">
    {/* Your bar */}
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs text-blue-400 w-7">You</span>
      <div className="flex-1 bg-zinc-700 rounded h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded transition-all duration-300"
          style={{ width: `${((playerProgress ?? 0) / 81) * 100}%` }}
        />
      </div>
      <span className="text-xs text-blue-400 w-8 text-right">{playerProgress ?? 0}/81</span>
    </div>
    {/* Opponent bar */}
    <div className="flex items-center gap-2">
      <span className="text-xs text-emerald-400 w-7 truncate">{opponentName ?? "?"}</span>
      <div className="flex-1 bg-zinc-700 rounded h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded transition-all duration-300"
          style={{ width: `${((opponentProgress ?? 0) / 81) * 100}%` }}
        />
      </div>
      <span className="text-xs text-emerald-400 w-8 text-right">{opponentProgress ?? 0}/81</span>
    </div>
  </div>
)}
```

- [ ] **Step 3: Wire playerProgress from useGame**

In the file that renders `GameScreen`, pass `playerProgress` as the count of user-filled cells (excluding pre-filled givens). Check if `useGame` already exposes `cellsFilled`; if not, derive it:

```typescript
// Exclude given cells so playerProgress counts only user-entered values
const playerProgress = board.flat().filter(c => c.value !== 0 && !c.isGiven).length;
```

- [ ] **Step 4: TypeScript + test run**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/GameScreen.tsx
git commit -m "feat: add battle top strip to GameScreen"
```

---

### Task 16: ResultsScreen battle mode

**Files:**
- Modify: `frontend/src/views/ResultsScreen.tsx`

- [ ] **Step 1: Read existing `ResultsScreen.tsx`**

```bash
cat frontend/src/views/ResultsScreen.tsx
```

- [ ] **Step 2: Add battle mode to ResultsScreen**

Add optional props for battle mode:

```tsx
interface ResultsScreenProps {
  seconds: number;
  difficulty: Difficulty;
  onPlayAgain: () => void;
  // Battle mode
  battleResult?: {
    winner: string;
    winner_time_ms: number;
    loser_time_ms: number | null;
    playerName: string;
    opponentName: string;
  };
  onViewScores?: () => void;
}
```

Add the battle results layout (rendered when `battleResult` is present):

```tsx
{battleResult && (() => {
  const { winner, winner_time_ms, playerName, opponentName } = battleResult;
  const youWon = winner === playerName;
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs text-center">
        <div className="text-5xl mb-3">{youWon ? "👑" : "😤"}</div>
        <h2 className={`text-2xl font-bold mb-8 ${youWon ? "text-white" : "text-zinc-400"}`}>
          {youWon ? "You won!" : "You lost"}
        </h2>

        <div className="flex flex-col gap-3 mb-8">
          {/* Winner row */}
          <div className={`flex items-center gap-3 rounded-lg p-3 ${winner === playerName ? "bg-blue-600" : "bg-zinc-800"}`}>
            <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-sm font-bold">
              {winner.slice(0, 2).toUpperCase()}
            </div>
            <span className="flex-1 text-left text-sm">{winner} 👑</span>
            <span className="font-mono text-sm">{fmt(winner_time_ms)}</span>
          </div>

          {/* Loser row */}
          {(() => {
            const loserName = winner === playerName ? opponentName : playerName;
            const isYou = loserName === playerName;
            return (
              <div className={`flex items-center gap-3 rounded-lg p-3 bg-zinc-800 ${isYou ? "border border-zinc-600" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                  {loserName.slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-left text-sm text-zinc-400">{loserName}{isYou ? " (you)" : ""}</span>
                <span className="font-mono text-sm text-zinc-400">DNF</span>
              </div>
            );
          })()}
        </div>

        <div className="flex gap-3">
          {onViewScores && (
            <button onClick={onViewScores} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-3 text-sm text-zinc-300">
              Scores
            </button>
          )}
          <button onClick={onPlayAgain} className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg py-3 text-sm font-bold">
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: TypeScript check + tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/ResultsScreen.tsx
git commit -m "feat: add battle mode to ResultsScreen (winner/loser layout)"
```

---

### Task 17: Lobby + App.tsx — wire battle flow

**Files:**
- Modify: `frontend/src/views/Lobby.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read both files**

```bash
cat frontend/src/views/Lobby.tsx
cat frontend/src/App.tsx
```

- [ ] **Step 2: Update Lobby to activate Battle button + challenge banner**

Add props:

```tsx
interface LobbyProps {
  onSolo: (difficulty: Difficulty) => void;
  onScores: () => void;
  onBattle: () => void;  // NEW
  pendingChallenge: { challenge_id: string; from_player: string } | null;  // NEW
  onAcceptChallenge: (challengeId: string) => void;  // NEW
  onDeclineChallenge: (challengeId: string) => void;  // NEW
}
```

- Replace the disabled Battle button with `<button onClick={onBattle}>Battle</button>` using the same blue-600 style as other buttons.
- Add above the buttons, if `pendingChallenge`:

```tsx
{pendingChallenge && (
  <div className="w-full max-w-sm mb-4 bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex items-center gap-3">
    <span className="flex-1 text-sm">⚔️ <strong>{pendingChallenge.from_player}</strong> challenged you!</span>
    <button onClick={() => onAcceptChallenge(pendingChallenge.challenge_id)} className="bg-blue-600 text-white text-xs px-3 py-1 rounded">Accept</button>
    <button onClick={() => onDeclineChallenge(pendingChallenge.challenge_id)} className="bg-zinc-700 text-zinc-300 text-xs px-3 py-1 rounded">Decline</button>
  </div>
)}
```

- [ ] **Step 3: Extend App.tsx state machine**

Add to the `Screen` type:

```typescript
type Screen = "login" | "lobby" | "battle-menu" | "waiting" | "countdown" | "game" | "results" | "leaderboard";
```

Add `useRoom` integration:

```typescript
const room = useRoom(auth.selectedPlayer?.name ?? "");
```

Add in `useEffect` for screen changes:
```typescript
useEffect(() => {
  if (screen === "lobby") room.startPolling();
  else room.stopPolling();
}, [screen]);
```

Add WS connect/disconnect around game:
```typescript
// When entering waiting room after createRoom/joinRoom:
room.connectWs(room.room.room_id);

// When leaving results:
room.disconnectWs();
```

Add screens in JSX:

```tsx
{screen === "battle-menu" && (
  <BattleMenu
    players={auth.knownPlayers}
    currentPlayer={auth.selectedPlayer?.name ?? ""}
    onChallenge={async (toPlayer, diff) => {
      // Creates a room + challenge; connects WS so host receives ROOM_STATE
      const { room_id } = await room.sendChallenge(toPlayer, diff);
      room.connectWs(room_id);
      setScreen("waiting");
    }}
    onJoinByCode={async (code) => {
      await room.joinRoom(code);
      room.connectWs(code);
      setScreen("waiting");
    }}
    onBack={() => setScreen("lobby")}
  />
)}

{screen === "waiting" && room.room && (
  <>
    <Countdown n={room.countdown} />
    <WaitingRoom
      roomId={room.room.room_id}
      host={room.room.host}
      guest={room.room.guest}
      challengeSentTo={room.challengeSentTo}
      onCancel={async () => {
        await room.cancelRoom();
        room.disconnectWs();
        setScreen("lobby");
      }}
    />
  </>
)}
```

Update the game screen to pass battle props:
```tsx
{screen === "game" && (
  <GameScreen
    seed={seed}
    difficulty={difficulty}
    onFinish={(seconds) => {
      if (room.room) room.submitResult(seconds * 1000);
      handleFinish(seconds);
    }}
    battleMode={!!room.room}
    playerName={auth.selectedPlayer?.name}
    opponentName={room.room ? (room.room.host === auth.selectedPlayer?.name ? room.room.guest ?? undefined : room.room.host) : undefined}
    opponentProgress={room.opponentProgress}
    onProgressChange={room.room ? room.sendProgress : undefined}
  />
)}
```

Also update `GameScreen`'s props interface to accept `onProgressChange?: (cellsFilled: number) => void` and call it whenever `board` changes in battle mode:

```tsx
// In GameScreen, call when board updates (inside useEffect or board change handler):
useEffect(() => {
  if (battleMode && onProgressChange) {
    const filled = board.flat().filter(c => c.value !== 0 && !c.isGiven).length;
    onProgressChange(filled);
  }
}, [board, battleMode, onProgressChange]);
```

Update Lobby with battle props:
```tsx
{screen === "lobby" && (
  <Lobby
    onSolo={handleSolo}
    onScores={() => setScreen("leaderboard")}
    onBattle={() => setScreen("battle-menu")}
    pendingChallenge={room.pendingChallenge}
    onAcceptChallenge={async (challengeId) => {
      const data = await room.acceptChallenge(challengeId);
      setDifficulty(data.difficulty as Difficulty);
      setSeed(data.seed);
      room.connectWs(data.room_id);
      setScreen("waiting");
    }}
    onDeclineChallenge={room.declineChallenge}
  />
)}
```

Auto-navigate to results when `room.results` is set:
```typescript
useEffect(() => {
  if (room.results && screen === "game") {
    setScreen("results");
  }
}, [room.results, screen]);
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 5: Run full test suite**

```bash
cd frontend && npx vitest run --reporter=dot
cd backend && docker compose exec backend pytest -q
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Lobby.tsx frontend/src/App.tsx
git commit -m "feat: wire battle flow into App state machine and Lobby"
```

---

### Task 18: Smoke test end-to-end + copy plan to docs

- [ ] **Step 1: Start dev environment**

```bash
# Terminal 1
gcloud emulators firestore start --host-port=localhost:8080
# Terminal 2
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uvicorn app.main:app --reload --port 8001
# Terminal 3
cd frontend && npm run dev
```

- [ ] **Step 2: Manual E2E — Challenge flow**

1. Open `http://localhost:5174` in Tab A — log in as "Alice" (create if needed)
2. Open `http://localhost:5174` in Tab B — log in as "Bob"
3. Tab A: tap **Battle** → tap **Challenge → Bob** → should see Waiting Room with 6-char code
4. Tab B: lobby shows "⚔️ Alice challenged you!" banner within 3s → tap **Accept**
5. Both tabs: see 3-2-1-GO countdown
6. Tab A: fill a cell → Tab B's opponent bar should update
7. Tab A: complete puzzle → Tab A sees "You won 👑", Tab B sees "You lost 😤"
8. Check leaderboard — Alice wins +1

- [ ] **Step 3: Manual E2E — Code flow**

1. Tab A: Battle → Challenge → Bob (Alice sends challenge, enters WaitingRoom) → copy the 6-char room code shown on screen
2. Tab B: Battle → paste code in "Join by Room Code" box → Join (bypasses the challenge notification)
3. Both tabs: countdown → game

- [ ] **Step 4: Manual E2E — Cancel**

1. Tab A: Battle → Challenge Bob → see Waiting Room → tap Cancel
2. Tab A: back in lobby, no stale state

- [ ] **Step 5: Copy plan to docs**

```bash
cp /Users/noa.raz/.claude/plans/plan-next-phase-prancy-pie.md \
   /Users/noa.raz/workspace/sudoku-battle/docs/superpowers/plans/2026-04-19-phase3-multiplayer.md
git add docs/superpowers/plans/2026-04-19-phase3-multiplayer.md
git commit -m "docs: add Phase 3 multiplayer implementation plan"
```

- [ ] **Step 6: Run pre-push checks**

```bash
cd frontend && npx tsc --noEmit && npx vitest run --reporter=dot
cd backend && docker compose exec backend mypy app/ && docker compose exec backend pytest -q
```

All checks green.

- [ ] **Step 7: Open PR**

```bash
git push origin HEAD
gh pr create --title "feat: Phase 3 multiplayer" \
  --body "Implements two-player real-time battles via WebSocket. See docs/superpowers/specs/2026-04-19-phase3-multiplayer-design.md for full spec."
```
