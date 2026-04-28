import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from app.api.v1 import challenges as challenges_router
from app.api.v1 import players as players_router
from app.api.v1 import rooms as rooms_router
from app.core.config import get_settings
from app.ws.room_handler import room_ws


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # pragma: no cover
    settings = get_settings()
    # Propagate FIRESTORE_EMULATOR_HOST to os.environ so the GCP SDK picks it up.
    # The SDK reads this directly from os.environ, not from pydantic-settings.
    # Save and restore around the lifespan so the mutation does not leak into
    # sibling test cases when the lifespan is run under asgi-lifespan in Phase 2.
    _prev = os.environ.get("FIRESTORE_EMULATOR_HOST")
    try:
        # Only propagate the emulator host in local mode. In production, the env
        # var should never be set — but guard explicitly so a misconfigured deploy
        # cannot accidentally route production Firestore traffic to a dead emulator.
        if settings.app_env == "local" and settings.firestore_emulator_host:
            os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
        app.state.db = firestore.AsyncClient(
            project=settings.gcp_project_id,
            database=settings.firestore_database,
        )
        yield
    finally:
        await app.state.db.close()
        if _prev is None:
            os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
        else:
            os.environ["FIRESTORE_EMULATOR_HOST"] = _prev


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)

    # allow_credentials=True requires explicit origins (not ["*"]) — keep cors_origins
    # as a list of explicit origins to avoid violating the CORS spec.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(challenges_router.router, prefix="/api/v1")
    app.include_router(players_router.router, prefix="/api/v1")
    app.include_router(rooms_router.router, prefix="/api/v1")

    app.add_api_websocket_route("/ws/room/{room_id}", room_ws)

    # Static files (production Docker build only — frontend/dist must exist).
    # In local dev the directory is absent and the backend runs API-only.
    # Architecture:
    #   /assets/* → StaticFiles (Vite-hashed JS/CSS bundles, long cache TTL OK)
    #   /* catch-all → index.html (SPA fallback so React Router handles client routes)
    #
    # Note: Path is relative to uvicorn's CWD, which in Docker is WORKDIR /app.
    _dist = Path("frontend/dist")
    if _dist.exists():
        from fastapi.responses import FileResponse
        from fastapi.staticfiles import StaticFiles

        app.mount(
            "/assets",
            StaticFiles(directory=str(_dist / "assets")),
            name="assets",
        )

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str) -> FileResponse:  # noqa: ARG001
            return FileResponse(str(_dist / "index.html"))

    return app


app = create_app()
