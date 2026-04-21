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
