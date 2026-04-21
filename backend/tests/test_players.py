import pytest
from google.cloud import firestore
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_player_returns_201(ac_with_db: AsyncClient) -> None:
    resp = await ac_with_db.post("/api/v1/players", json={"name": "Alice"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["wins"] == 0
    assert body["played"] == 0


@pytest.mark.asyncio
async def test_create_player_duplicate_returns_409(ac_with_db: AsyncClient) -> None:
    await ac_with_db.post("/api/v1/players", json={"name": "Bob"})
    resp = await ac_with_db.post("/api/v1/players", json={"name": "Bob"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_players(ac_with_db: AsyncClient) -> None:
    await ac_with_db.post("/api/v1/players", json={"name": "Carol"})
    await ac_with_db.post("/api/v1/players", json={"name": "Dave"})
    resp = await ac_with_db.get("/api/v1/players")
    assert resp.status_code == 200
    names = {p["name"] for p in resp.json()}
    assert {"Carol", "Dave"}.issubset(names)


@pytest.mark.asyncio
async def test_leaderboard_sorted_by_wins_desc(
    ac_with_db: AsyncClient, db: firestore.AsyncClient
) -> None:
    from app.repositories import player_repo

    await player_repo.create(db, "Eve")
    await player_repo.create(db, "Frank")

    await db.collection("players").document("Frank").update({"wins": 5})
    await db.collection("players").document("Eve").update({"wins": 2})

    resp = await ac_with_db.get("/api/v1/leaderboard")
    assert resp.status_code == 200
    entries = resp.json()
    names = [e["name"] for e in entries]
    assert names.index("Frank") < names.index("Eve")


@pytest.mark.asyncio
async def test_get_existing_player(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    await player_repo.create(db, "Greta")
    player = await player_repo.get(db, "Greta")
    assert player is not None
    assert player.name == "Greta"


@pytest.mark.asyncio
async def test_get_missing_player_returns_none(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    player = await player_repo.get(db, "NoSuchPlayer")
    assert player is None


@pytest.mark.asyncio
async def test_increment_stats(db: firestore.AsyncClient) -> None:
    from app.repositories import player_repo
    await player_repo.create(db, "Hana")
    await player_repo.create(db, "Ivan")
    await player_repo.increment_stats(db, winner="Hana", loser="Ivan")
    hana = await player_repo.get(db, "Hana")
    ivan = await player_repo.get(db, "Ivan")
    assert hana is not None and hana.wins == 1 and hana.played == 1
    assert ivan is not None and ivan.wins == 0 and ivan.played == 1
