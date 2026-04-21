from fastapi import APIRouter, HTTPException, Request

from app.repositories import player_repo, room_repo
from app.schemas.room import CreateRoomRequest, DeleteRoomRequest, RoomOut

router = APIRouter(tags=["rooms"])


@router.post("/rooms", status_code=201, response_model=RoomOut)
async def create_room(body: CreateRoomRequest, request: Request) -> RoomOut:
    player = await player_repo.get(request.app.state.db, body.player_name)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    room = await room_repo.create(request.app.state.db, host=body.player_name, difficulty=body.difficulty)
    return RoomOut(
        room_id=room.room_id, seed=room.seed, difficulty=room.difficulty,
        host=room.host, guest=room.guest, status=room.status.value,
    )


@router.get("/rooms/{room_id}", response_model=RoomOut)
async def get_room(room_id: str, request: Request) -> RoomOut:
    room = await room_repo.get(request.app.state.db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomOut(
        room_id=room.room_id, seed=room.seed, difficulty=room.difficulty,
        host=room.host, guest=room.guest, status=room.status.value,
    )


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(room_id: str, body: DeleteRoomRequest, request: Request) -> None:
    from app.models.room import RoomStatus
    room = await room_repo.get(request.app.state.db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host != body.player_name:
        raise HTTPException(status_code=403, detail="Only the host can delete this room")
    if room.status != RoomStatus.WAITING:
        raise HTTPException(status_code=409, detail="Room is not in WAITING status")
    await room_repo.delete(request.app.state.db, room_id)
