from httpx import AsyncClient


async def test_health_returns_ok(ac: AsyncClient) -> None:
    response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
