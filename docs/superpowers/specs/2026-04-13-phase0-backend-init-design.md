# Phase 0: Backend Init — Design Spec

**Date:** 2026-04-13
**Project:** Sudoku Battle
**Status:** Approved
**Relates to:** [2026-04-10-first-logic-phases-design.md](./2026-04-10-first-logic-phases-design.md) (Phase 0 overview)

---

## Context

The backend is currently a stub (`app/main.py` + `app/core/config.py` only). Phase 0 milestone is: `pytest` passes, `uvicorn` starts, `mypy` passes. This spec covers the full scaffolding needed to reach that milestone, with special attention to clear environment configuration so local dev, test, and Cloud Run production are unambiguous.

**Implementation note:** Use the `fastapi-templates` skill when implementing — adapt its output to match the app structure in `backend/CLAUDE.md`.

---

## File Structure

```
backend/
├── pyproject.toml           ← deps, pytest config, mypy config
├── conftest.py              ← AsyncClient fixture + Firestore emulator fixture
├── .env.example             ← all vars documented (committed to git)
├── .env.local               ← pre-filled for local dev (gitignored)
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI skeleton: lifespan, CORS, /health, static mount stub
│   └── core/
│       ├── __init__.py
│       └── config.py        ← pydantic-settings BaseSettings
└── tests/
    └── test_health.py       ← GET /health → 200 {"status": "ok"}

docker-compose.yml           ← repo root; Firestore emulator only (Phase 5 adds app container)
```

---

## Ports

| Service | Port |
|---------|------|
| Backend (uvicorn) | **8001** |
| Frontend (Vite dev) | **5174** |
| Firestore emulator | **8080** |

---

## Environment Configuration

Three environments, differentiated entirely by env vars:

| Variable | Local dev | pytest / CI | Cloud Run (prod) |
|----------|-----------|-------------|-----------------|
| `APP_ENV` | `local` | `local` | `production` |
| `GCP_PROJECT_ID` | `sudoku-battle-local` | `sudoku-battle-test` | `sudoku-battle` |
| `FIRESTORE_EMULATOR_HOST` | `localhost:8080` | `localhost:8080` | *(unset)* |
| `CORS_ORIGINS` | `http://localhost:5174` | `http://localhost:5174` | `https://<run-url>` |
| `PORT` | `8001` | `8001` | `8080` |

**How `FIRESTORE_EMULATOR_HOST` works:** The GCP Firestore SDK reads this env var automatically. When set, all Firestore traffic routes to the emulator — no code change needed. When unset (Cloud Run), the SDK connects to the real Firestore project via the attached service account.

**Cloud Run:** Vars are set via `gcloud run deploy --set-env-vars` — no `.env` file needed in production.

### `app/core/config.py`

```python
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: Literal["local", "production"] = "local"
    gcp_project_id: str = "sudoku-battle-local"
    firestore_emulator_host: str | None = None
    cors_origins: list[str] = ["http://localhost:5174"]
    port: int = 8001

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

def get_settings() -> Settings:
    return Settings()
```

### `.env.example` (committed to git)

```dotenv
# Environment: "local" or "production"
APP_ENV=local

# GCP project ID (used by Firestore client)
# local dev: sudoku-battle-local
# CI/test:   sudoku-battle-test
# prod:      sudoku-battle
GCP_PROJECT_ID=sudoku-battle-local

# Firestore emulator address — UNSET in production
# When set, Firestore SDK routes traffic here instead of real GCP
FIRESTORE_EMULATOR_HOST=localhost:8080

# Comma-separated list of allowed CORS origins
# prod: https://<your-cloud-run-url>
CORS_ORIGINS=http://localhost:5174

# Port for uvicorn (Cloud Run uses 8080)
PORT=8001
```

### `.env.local` (gitignored, pre-filled for local dev)

```dotenv
APP_ENV=local
GCP_PROJECT_ID=sudoku-battle-local
FIRESTORE_EMULATOR_HOST=localhost:8080
CORS_ORIGINS=http://localhost:5174
PORT=8001
```

**Rule:** Every new setting added to `config.py` must be added to `.env.example` (with an explanatory comment) in the same commit. This rule is also noted in `backend/CLAUDE.md`.

---

## `app/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from app.core.config import get_settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.db = firestore.AsyncClient(project=settings.gcp_project_id)
    yield
    app.state.db.close()

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    # Static files mount (enabled in production; frontend/dist served here)
    # Uncommented in Phase 5 when Dockerfile builds frontend
    # app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

    return app

app = create_app()
```

---

## `docker-compose.yml` (repo root)

```yaml
services:
  firestore-emulator:
    image: gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators
    command: >
      gcloud emulators firestore start
      --host-port=0.0.0.0:8080
      --project=sudoku-battle-local
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080"]
      interval: 5s
      timeout: 3s
      retries: 10
```

**Usage:**
```bash
# Start emulator
docker-compose up firestore-emulator

# Run backend dev server (separate terminal)
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uvicorn app.main:app --port 8001 --reload

# Run tests
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 pytest
```

---

## `backend/pyproject.toml`

```toml
[project]
name = "sudoku-battle"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "google-cloud-firestore>=2.19",
    "bcrypt>=4.1",
    "pydantic-settings>=2.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "mypy>=1.10",
    "types-bcrypt",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.mypy]
python_version = "3.12"
strict = true
exclude = ["tests/"]
```

---

## `backend/conftest.py`

```python
import os
import pytest
from httpx import AsyncClient, ASGITransport
from google.cloud import firestore

from app.main import app

@pytest.fixture
async def ac() -> AsyncClient:
    """HTTP test client for the FastAPI app.

    Note: ASGITransport does not trigger the FastAPI lifespan by default,
    so app.state.db is NOT initialised. This is intentional for Phase 0 —
    the /health endpoint does not need Firestore. When Phase 2 adds endpoints
    that use app.state.db, update this fixture to either:
      - Use `asgi-lifespan` (LifespanManager) to run the full lifespan, or
      - Set app.state.db = <emulator client> directly in the fixture before yielding.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture
async def db() -> firestore.AsyncClient:
    """Firestore emulator client. Skipped if emulator is not running."""
    host = os.getenv("FIRESTORE_EMULATOR_HOST")
    if not host:
        pytest.skip(
            "Firestore emulator not running. "
            "Start with: docker-compose up firestore-emulator"
        )
    client = firestore.AsyncClient(project="sudoku-battle-test")
    yield client
    client.close()
```

---

## `tests/test_health.py`

```python
async def test_health(ac):
    response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

---

## Milestone Verification

Phase 0 is complete when all four pass:

```bash
# 1. Emulator starts
docker-compose up firestore-emulator

# 2. Backend starts
cd backend && uvicorn app.main:app --port 8001
# → "Application startup complete."

# 3. Tests pass
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 pytest
# → 1 passed

# 4. Types check
cd backend && mypy app/
# → Success: no issues found
```

---

## What Is NOT in Phase 0

- No auth endpoints (Phase 2)
- No WebSocket handler (Phase 3)
- No Dockerfile or multi-stage build (Phase 5)
- No Firestore security rules or indexes (Phase 5)
- No frontend static file serving (Phase 5 — mount is commented out in `main.py`)
