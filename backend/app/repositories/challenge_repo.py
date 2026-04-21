import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

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


def _to_dict(ch: Challenge) -> dict[str, Any]:
    return {
        "from_player": ch.from_player,
        "to_player": ch.to_player,
        "room_id": ch.room_id,
        "status": ch.status.value,
        "created_at": ch.created_at,
        "expires_at": ch.expires_at,
    }


def _from_dict(challenge_id: str, data: dict[str, Any]) -> Challenge:
    return Challenge(
        challenge_id=challenge_id,
        from_player=data["from_player"],
        to_player=data["to_player"],
        room_id=data["room_id"],
        status=ChallengeStatus(data["status"]),
        created_at=data["created_at"],
        expires_at=data["expires_at"],
    )
