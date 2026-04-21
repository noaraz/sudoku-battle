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
