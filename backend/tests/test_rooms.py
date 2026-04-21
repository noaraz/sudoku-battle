import string

import pytest
from google.cloud import firestore
from httpx import AsyncClient

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
    resp = await ac_with_rooms_db.request(
        "DELETE", f"/api/v1/rooms/{room_id}", json={"player_name": "Alice"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_room_non_host_403(ac_with_rooms_db: AsyncClient) -> None:
    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    create = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "easy"}
    )
    room_id = create.json()["room_id"]
    resp = await ac_with_rooms_db.request(
        "DELETE", f"/api/v1/rooms/{room_id}", json={"player_name": "Bob"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_room_not_waiting_409(ac_with_rooms_db: AsyncClient) -> None:
    from app.main import app

    await ac_with_rooms_db.post("/api/v1/players", json={"name": "Alice"})
    create = await ac_with_rooms_db.post(
        "/api/v1/rooms", json={"player_name": "Alice", "difficulty": "easy"}
    )
    room_id = create.json()["room_id"]
    await room_repo.update_status(app.state.db, room_id, RoomStatus.PLAYING)
    resp = await ac_with_rooms_db.request(
        "DELETE", f"/api/v1/rooms/{room_id}", json={"player_name": "Alice"}
    )
    assert resp.status_code == 409
