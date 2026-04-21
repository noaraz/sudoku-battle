from typing import Literal

from pydantic import BaseModel


class CreateChallengeRequest(BaseModel):
    from_player: str
    to_player: str
    difficulty: Literal["easy", "medium", "hard", "expert"]


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
