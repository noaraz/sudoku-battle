from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    # Propagate FIRESTORE_EMULATOR_HOST to os.environ so the GCP SDK picks it up.
    # The SDK reads this directly from os.environ, not from pydantic-settings.
    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
    app.state.db = firestore.AsyncClient(project=settings.gcp_project_id)
    yield
    await app.state.db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)

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
