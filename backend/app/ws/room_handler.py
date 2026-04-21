import asyncio
import logging
from typing import Any

from fastapi import Query, WebSocket, WebSocketDisconnect
from google.cloud import firestore

from app.core.config import get_settings
from app.models.room import RoomStatus
from app.repositories import player_repo, room_repo

logger = logging.getLogger(__name__)

HEARTBEAT_TIMEOUT = 90.0
HEARTBEAT_CHECK = 30.0

_connections: dict[str, dict[str, WebSocket]] = {}
_last_hb: dict[tuple[str, str], float] = {}
_game_start: dict[str, float] = {}


def _get_db() -> firestore.AsyncClient:
    """Create a Firestore AsyncClient bound to the current event loop.

    WebSocket handlers run in a fresh event loop context (starlette TestClient
    uses anyio in a background thread). Re-using app.state.db — which was
    created in the pytest event loop — causes gRPC cross-loop errors. Creating
    a fresh client here is safe because FIRESTORE_EMULATOR_HOST is already set
    in the environment for both test and production containers.
    """
    settings = get_settings()
    return firestore.AsyncClient(project=settings.gcp_project_id)


async def room_ws(
    websocket: WebSocket,
    room_id: str,
    name: str = Query(...),
) -> None:
    db = _get_db()

    async def _reject(code: str, message: str) -> None:
        await websocket.accept()
        await websocket.send_json({"type": "ERROR", "code": code, "message": message})
        await websocket.close()

    if await player_repo.get(db, name) is None:
        return await _reject("PLAYER_NOT_FOUND", "Player not found")

    room = await room_repo.get(db, room_id)
    if room is None:
        return await _reject("ROOM_NOT_FOUND", "Room not found")
    if room.status == RoomStatus.FINISHED:
        return await _reject("ROOM_FINISHED", "Room already finished")
    if room.status == RoomStatus.PLAYING:
        return await _reject("ROOM_IN_PROGRESS", "Room game already in progress")

    existing = _connections.get(room_id, {})
    if len(existing) >= 2 and name not in existing:
        return await _reject("ROOM_FULL", "Room is full")
    if name != room.host and room.guest is not None and room.guest != name:
        return await _reject("WRONG_PLAYER", "Not authorized for this room")

    await websocket.accept()

    _connections.setdefault(room_id, {})[name] = websocket
    _last_hb[(room_id, name)] = asyncio.get_running_loop().time()

    is_guest = name != room.host

    if is_guest:
        await room_repo.set_guest(db, room_id, name)
        room = await room_repo.get(db, room_id)

    room_state = {
        "type": "ROOM_STATE",
        "room_id": room_id,
        "host": room.host if room else "",
        "guest": room.guest if room else None,
        "difficulty": room.difficulty if room else "",
        "seed": room.seed if room else 0,
        "status": room.status.value if room else "",
    }
    await websocket.send_json(room_state)

    if is_guest and room and room.host in _connections.get(room_id, {}):
        host_ws = _connections[room_id][room.host]
        await host_ws.send_json(room_state)
        asyncio.create_task(_countdown(room_id, db))

    monitor = asyncio.create_task(_monitor(room_id, name, db))

    try:
        while True:
            data: dict[str, Any] = await websocket.receive_json()
            await _handle(room_id, name, data, db)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
        monitor.cancel()
        _connections.get(room_id, {}).pop(name, None)
        _last_hb.pop((room_id, name), None)
        if not _connections.get(room_id):
            _connections.pop(room_id, None)
            _game_start.pop(room_id, None)


async def _handle(room_id: str, name: str, data: dict, db: Any) -> None:
    msg_type = data.get("type")

    if msg_type == "HEARTBEAT":
        _last_hb[(room_id, name)] = asyncio.get_running_loop().time()
        await room_repo.refresh_ttl(db, room_id)

    elif msg_type == "PROGRESS":
        opponent_ws = _opponent_ws(room_id, name)
        if opponent_ws:
            await opponent_ws.send_json({
                "type": "OPPONENT_PROGRESS",
                "cells_filled": data.get("cells_filled", 0),
            })

    elif msg_type == "SUBMIT_RESULT":
        current = await room_repo.get(db, room_id)
        if not current or current.status != RoomStatus.PLAYING:
            return
        time_ms: int = data.get("time_ms", 0)
        won = await room_repo.set_winner(db, room_id, name)
        if won:
            await _finish(room_id, winner=name, winner_time_ms=time_ms, db=db)


async def _countdown(room_id: str, db: Any) -> None:
    for n in [3, 2, 1, 0]:
        await asyncio.sleep(1)
        for ws in list(_connections.get(room_id, {}).values()):
            try:
                await ws.send_json({"type": "COUNTDOWN", "n": n})
            except Exception:
                pass
    await room_repo.update_status(db, room_id, RoomStatus.PLAYING)
    _game_start[room_id] = asyncio.get_running_loop().time()


async def _monitor(room_id: str, name: str, db: Any) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_CHECK)
        key = (room_id, name)
        last = _last_hb.get(key)
        if last is None:
            return
        if asyncio.get_running_loop().time() - last > HEARTBEAT_TIMEOUT:
            logger.info("Heartbeat timeout: %s in room %s", name, room_id)
            room = await room_repo.get(db, room_id)
            if room and room.status == RoomStatus.PLAYING:
                opponent = _opponent_name(room_id, name)
                opp_ws = _opponent_ws(room_id, name)
                if opponent and opp_ws:
                    try:
                        await opp_ws.send_json({"type": "OPPONENT_DISCONNECTED"})
                    except Exception:
                        pass
                    start = _game_start.get(room_id, asyncio.get_running_loop().time())
                    elapsed_ms = int((asyncio.get_running_loop().time() - start) * 1000)
                    won = await room_repo.set_winner(db, room_id, opponent)
                    if won:
                        await _finish(room_id, winner=opponent, winner_time_ms=elapsed_ms, db=db)
            ws = _connections.get(room_id, {}).get(name)
            if ws:
                try:
                    await ws.close()
                except Exception:
                    pass
            return


async def _finish(room_id: str, winner: str, winner_time_ms: int, db: Any) -> None:
    for ws in list(_connections.get(room_id, {}).values()):
        try:
            await ws.send_json({
                "type": "GAME_RESULTS",
                "winner": winner,
                "winner_time_ms": winner_time_ms,
                "loser_time_ms": None,
            })
        except Exception:
            pass
    loser = _opponent_name(room_id, winner)
    if loser:
        asyncio.create_task(_update_leaderboard(winner, loser, db))
    await room_repo.delete(db, room_id)


async def _update_leaderboard(winner: str, loser: str, db: Any) -> None:
    try:
        await player_repo.increment_stats(db, winner=winner, loser=loser)
    except Exception:
        logger.error("Leaderboard update failed for %s vs %s", winner, loser, exc_info=True)


def _opponent_ws(room_id: str, name: str) -> WebSocket | None:
    for n, ws in _connections.get(room_id, {}).items():
        if n != name:
            return ws
    return None


def _opponent_name(room_id: str, name: str) -> str | None:
    for n in _connections.get(room_id, {}):
        if n != name:
            return n
    return None
