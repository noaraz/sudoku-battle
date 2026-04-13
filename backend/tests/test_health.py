import pytest
from httpx import AsyncClient


@pytest.mark.xfail(reason="/health endpoint not yet implemented", strict=True)
async def test_health_returns_ok(ac: AsyncClient) -> None:
    response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
