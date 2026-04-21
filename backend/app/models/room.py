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
