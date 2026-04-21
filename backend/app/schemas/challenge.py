from pydantic import BaseModel


class CreateChallengeRequest(BaseModel):
    from_player: str
    to_player: str
    difficulty: str


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
