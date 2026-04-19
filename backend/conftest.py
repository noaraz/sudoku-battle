import os
from collections.abc import AsyncGenerator

import pytest
from google.cloud import firestore
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def ac() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client for the FastAPI app.

    Note: ASGITransport does not trigger the FastAPI lifespan by default,
    so app.state.db is NOT initialised here. This is intentional for Phase 0
    and Phase 1 — the /health endpoint does not touch Firestore. When Phase 2
    adds endpoints that use app.state.db, update this fixture to either:
      - Use `asgi-lifespan` (LifespanManager) to run the full lifespan, or
      - Set app.state.db = <emulator client> directly before yielding.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def ac_with_db(db: firestore.AsyncClient) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with Firestore db attached to app.state — for endpoint tests.
    Cleans up the players collection after each test."""
    app.state.db = db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    async for doc in db.collection("players").stream():
        await db.collection("players").document(doc.id).delete()
    app.state.db = None  # type: ignore[assignment]


@pytest.fixture
async def db() -> AsyncGenerator[firestore.AsyncClient, None]:
    """Firestore emulator client. Skipped if emulator is not running.

    Start the emulator with: docker-compose up firestore
    """
    host = os.getenv("FIRESTORE_EMULATOR_HOST")
    if not host:
        pytest.skip(
            "Firestore emulator not running. "
            "Start with: docker-compose up firestore"
        )
    client: firestore.AsyncClient = firestore.AsyncClient(
        project="sudoku-battle-local"
    )
    yield client
    client.close()  # synchronous in google-cloud-firestore 2.x
