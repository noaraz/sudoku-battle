from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class Player:
    name: str
    wins: int = 0
    played: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
