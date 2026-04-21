from fastapi import APIRouter, HTTPException, Request

from app.models.challenge import ChallengeStatus
from app.repositories import challenge_repo, player_repo, room_repo
from app.schemas.challenge import (
    AcceptChallengeOut,
    ChallengeCreatedOut,
    CreateChallengeRequest,
    PendingChallengeOut,
)

router = APIRouter(tags=["challenges"])


@router.post("/challenges", status_code=201, response_model=ChallengeCreatedOut)
async def create_challenge(
    body: CreateChallengeRequest, request: Request
) -> ChallengeCreatedOut:
    db = request.app.state.db
    if await player_repo.get(db, body.from_player) is None:
        raise HTTPException(404, f"Player '{body.from_player}' not found")
    if await player_repo.get(db, body.to_player) is None:
        raise HTTPException(404, f"Player '{body.to_player}' not found")
    room = await room_repo.create(db, host=body.from_player, difficulty=body.difficulty)
    ch = await challenge_repo.create(
        db, from_player=body.from_player, to_player=body.to_player, room_id=room.room_id
    )
    return ChallengeCreatedOut(challenge_id=ch.challenge_id, room_id=room.room_id)


@router.get("/players/{name}/challenges", response_model=list[PendingChallengeOut])
async def get_pending_challenges(
    name: str, request: Request
) -> list[PendingChallengeOut]:
    challenges = await challenge_repo.get_pending_for(request.app.state.db, name)
    return [
        PendingChallengeOut(
            challenge_id=c.challenge_id, from_player=c.from_player, room_id=c.room_id
        )
        for c in challenges
    ]


@router.post("/challenges/{challenge_id}/accept", response_model=AcceptChallengeOut)
async def accept_challenge(challenge_id: str, request: Request) -> AcceptChallengeOut:
    db = request.app.state.db
    ch = await challenge_repo.get(db, challenge_id)
    if ch is None:
        raise HTTPException(404, "Challenge not found")
    if ch.status != ChallengeStatus.PENDING:
        raise HTTPException(409, "Challenge is no longer pending")
    await challenge_repo.update_status(db, challenge_id, ChallengeStatus.ACCEPTED)
    room = await room_repo.get(db, ch.room_id)
    if room is None:
        raise HTTPException(404, "Room not found")
    return AcceptChallengeOut(
        room_id=room.room_id, seed=room.seed, difficulty=room.difficulty
    )


@router.post("/challenges/{challenge_id}/decline", status_code=204)
async def decline_challenge(challenge_id: str, request: Request) -> None:
    ch = await challenge_repo.get(request.app.state.db, challenge_id)
    if ch is None:
        raise HTTPException(404, "Challenge not found")
    await challenge_repo.update_status(
        request.app.state.db, challenge_id, ChallengeStatus.DECLINED
    )
