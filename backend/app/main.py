import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    # Propagate FIRESTORE_EMULATOR_HOST to os.environ so the GCP SDK picks it up.
    # The SDK reads this directly from os.environ, not from pydantic-settings.
    # Save and restore the original value so this mutation does not leak into
    # sibling test cases when the lifespan is run under asgi-lifespan in Phase 2.
    _prev_emulator_host = os.environ.get("FIRESTORE_EMULATOR_HOST")
    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
    app.state.db = firestore.AsyncClient(project=settings.gcp_project_id)
    yield
    await app.state.db.close()
    if _prev_emulator_host is None:
        os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
    else:
        os.environ["FIRESTORE_EMULATOR_HOST"] = _prev_emulator_host


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)

    # allow_credentials=True requires explicit origins (not ["*"]) — keep cors_origins
    # as a list of explicit origins to avoid violating the CORS spec.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    # Static files mount — enabled in Phase 5 when Dockerfile builds frontend
    # from fastapi.staticfiles import StaticFiles
    # app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

    return app


app = create_app()
