from httpx import AsyncClient


async def test_app_starts(ac: AsyncClient) -> None:
    response = await ac.get("/docs")
    assert response.status_code == 200
