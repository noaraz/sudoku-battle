from datetime import UTC, datetime, timedelta

import pytest
from google.cloud import firestore
from httpx import AsyncClient

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
    # Manually backdate created_at to simulate expiry
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
