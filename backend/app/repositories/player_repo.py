from datetime import UTC, datetime

from google.api_core.exceptions import AlreadyExists
from google.cloud.firestore_v1 import AsyncClient

from app.models.player import Player

COLLECTION = "players"


async def create(db: AsyncClient, name: str) -> Player:
    """Create a player. Raises ValueError('name taken') if name already exists."""
    ref = db.collection(COLLECTION).document(name)
    player = Player(name=name)
    try:
        await ref.create(
            {
                "wins": player.wins,
                "played": player.played,
                "created_at": player.created_at,
            }
        )
    except AlreadyExists:
        raise ValueError("name taken")
    return player


async def get_all(db: AsyncClient) -> list[Player]:
    """Return all players (unordered)."""
    players: list[Player] = []
    async for doc in db.collection(COLLECTION).stream():
        data = doc.to_dict()
        if data is None:
            continue
        players.append(
            Player(
                name=doc.id,
                wins=data["wins"],
                played=data["played"],
                created_at=data.get("created_at", datetime.now(UTC)),
            )
        )
    return players
