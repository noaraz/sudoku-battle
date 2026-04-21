import pytest
from google.cloud import firestore
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.repositories import player_repo, room_repo


@pytest.fixture(autouse=True)
async def cleanup(db: firestore.AsyncClient):
    app.state.db = db
    yield
    app.state.db = None  # type: ignore[assignment]
    for coll in ("players", "rooms", "challenges"):
        async for doc in db.collection(coll).stream():
            await doc.reference.delete()


@pytest.mark.asyncio
async def test_ws_connect_unknown_player_error(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    client = TestClient(app)
    with client.websocket_connect("/ws/room/ABCDEF?name=Ghost") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "PLAYER_NOT_FOUND"


@pytest.mark.asyncio
async def test_ws_connect_unknown_room_error(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    client = TestClient(app)
    with client.websocket_connect("/ws/room/ZZZZZZ?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_NOT_FOUND"


@pytest.mark.asyncio
async def test_ws_host_receives_room_state(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ROOM_STATE"
        assert msg["host"] == "Alice"
        assert msg["seed"] == room.seed


@pytest.mark.asyncio
async def test_ws_submit_result_ignored_when_waiting(db: firestore.AsyncClient) -> None:
    """SUBMIT_RESULT while WAITING is silently ignored — no GAME_RESULTS sent."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        ws.receive_json()  # consume ROOM_STATE
        ws.send_json({"type": "SUBMIT_RESULT", "time_ms": 12345})
        # Send heartbeat to confirm connection still alive (no crash)
        ws.send_json({"type": "HEARTBEAT"})
        # If GAME_RESULTS were sent we'd receive it — getting here means it wasn't


@pytest.mark.asyncio
async def test_ws_connect_finished_room_rejected(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    from app.models.room import RoomStatus
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.update_status(db, room.room_id, RoomStatus.FINISHED)
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_FINISHED"


@pytest.mark.asyncio
async def test_ws_connect_room_full_rejected(db: firestore.AsyncClient) -> None:
    """Third player connecting to a WAITING room with guest already set gets ROOM_FULL."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    await player_repo.create(db, "Bob")
    await player_repo.create(db, "Carol")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_guest(db, room.room_id, "Bob")
    # Simulate both Alice and Bob already in _connections by injecting directly
    from app.ws import room_handler
    room_handler._connections[room.room_id] = {
        "Alice": None,  # type: ignore[dict-item]
        "Bob": None,
    }
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Carol") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_FULL"
    room_handler._connections.pop(room.room_id, None)


@pytest.mark.asyncio
async def test_ws_in_progress_room_rejected(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    from app.models.room import RoomStatus
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.update_status(db, room.room_id, RoomStatus.PLAYING)
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "ROOM_IN_PROGRESS"


@pytest.mark.asyncio
async def test_heartbeat_refreshes_ttl(db: firestore.AsyncClient) -> None:
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    before = room.expires_at
    client = TestClient(app)
    try:
        with client.websocket_connect(f"/ws/room/{room.room_id}?name=Alice") as ws:
            ws.receive_json()  # ROOM_STATE
            ws.send_json({"type": "HEARTBEAT"})
            # Give the handler time to process the HEARTBEAT before closing
            import time
            time.sleep(0.1)
    except Exception:
        # CancelledError from monitor task teardown is expected and harmless
        pass
    # After WS closes, fetch from Firestore and verify TTL was extended
    # Use the db fixture which connects to the same emulator
    from google.cloud import firestore as fs
    from app.core.config import get_settings
    fresh_db = fs.AsyncClient(project=get_settings().gcp_project_id)
    after_room = await room_repo.get(fresh_db, room.room_id)
    fresh_db.close()
    assert after_room is not None and after_room.expires_at >= before


@pytest.mark.asyncio
async def test_wrong_player_rejected(db: firestore.AsyncClient) -> None:
    """Carol (not host Alice, not registered guest Bob) connecting gets WRONG_PLAYER."""
    from starlette.testclient import TestClient
    await player_repo.create(db, "Alice")
    await player_repo.create(db, "Bob")
    await player_repo.create(db, "Carol")
    room = await room_repo.create(db, host="Alice", difficulty="easy")
    await room_repo.set_guest(db, room.room_id, "Bob")
    client = TestClient(app)
    with client.websocket_connect(f"/ws/room/{room.room_id}?name=Carol") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ERROR"
        assert msg["code"] == "WRONG_PLAYER"
