from fastapi import APIRouter, HTTPException, Request

from app.repositories import player_repo
from app.schemas.player import PlayerCreate, PlayerOut

router = APIRouter(tags=["players"])


@router.post("/players", status_code=201, response_model=PlayerOut)
async def create_player(body: PlayerCreate, request: Request) -> PlayerOut:
    try:
        player = await player_repo.create(request.app.state.db, body.name)
    except ValueError:
        raise HTTPException(status_code=409, detail="name taken")
    return PlayerOut(
        name=player.name,
        wins=player.wins,
        played=player.played,
        created_at=player.created_at,
    )


@router.get("/players", response_model=list[PlayerOut])
async def list_players(request: Request) -> list[PlayerOut]:
    players = await player_repo.get_all(request.app.state.db)
    return [
        PlayerOut(name=p.name, wins=p.wins, played=p.played, created_at=p.created_at)
        for p in players
    ]


@router.get("/leaderboard", response_model=list[PlayerOut])
async def leaderboard(request: Request) -> list[PlayerOut]:
    players = await player_repo.get_all(request.app.state.db)
    players.sort(key=lambda p: p.wins, reverse=True)
    return [
        PlayerOut(name=p.name, wins=p.wins, played=p.played, created_at=p.created_at)
        for p in players
    ]
