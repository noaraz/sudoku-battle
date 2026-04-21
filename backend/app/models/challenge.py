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
