from pydantic import BaseModel


class CreateRoomRequest(BaseModel):
    difficulty: str
    player_name: str


class DeleteRoomRequest(BaseModel):
    player_name: str


class RoomOut(BaseModel):
    room_id: str
    seed: int
    difficulty: str
    host: str
    guest: str | None
    status: str
