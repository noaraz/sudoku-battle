# Phase 0: Backend Init — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phase 0 backend scaffold so `pytest` passes, `uvicorn` starts, `mypy` passes, and the Firestore emulator is runnable via `docker-compose`.

**Architecture:** Thin FastAPI skeleton with a `/health` endpoint, pydantic-settings config covering three environments (local dev / CI / Cloud Run), and an async `AsyncClient` test fixture. The Firestore emulator runs as a Docker Compose service. No business logic yet — this is infrastructure only.

**Tech Stack:** FastAPI 0.115, pydantic-settings 2.x, pytest-asyncio, httpx AsyncClient + ASGITransport, Docker Compose, `gcr.io/google.com/cloudsdktool/cloud-sdk:emulators`

**Spec:** `docs/superpowers/specs/2026-04-13-phase0-backend-init-design.md`

---

## Chunk 1: Config, Env Files, and CLAUDE.md Rule

### Task 1: Expand `config.py` with full env var set

**Files:**
- Modify: `backend/app/core/config.py`

Context: The existing `config.py` has `firestore_project_id` (wrong name) and `cors_origins` defaulting to port 5173 (taken by another project). We need to add `app_env`, `firestore_emulator_host`, rename to `gcp_project_id`, set the default port to 5174, and add `port`.

- [ ] **Step 1: Open `backend/app/core/config.py`** and replace its contents:

```python
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: Literal["local", "production"] = "local"
    gcp_project_id: str = "sudoku-battle-local"
    firestore_emulator_host: str | None = None
    cors_origins: list[str] = ["http://localhost:5174"]
    port: int = 8001


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Run mypy on config only**

```bash
docker-compose run --rm backend mypy app/core/config.py
```

Expected: `Success: no issues found in 1 source file`

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
docker-compose run --rm backend pytest -v
```

Expected: all existing tests pass (test_smoke.py::test_app_starts should still pass)

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py
git commit -m "feat: expand config.py — add app_env, firestore_emulator_host, port; rename to gcp_project_id"
```

---

### Task 2: Create `.env.example` and `.env.local`

**Files:**
- Create: `backend/.env.example`
- Create: `backend/.env.local`

Note: `backend/.env.local` is already covered by `.gitignore` (root `.gitignore` has `.env.local`).

- [ ] **Step 1: Create `backend/.env.example`**

```dotenv
# ─────────────────────────────────────────────────────────────────────────────
# Sudoku Battle — Backend Environment Variables
#
# Copy this file to .env.local for local development.
# Cloud Run: set vars via `gcloud run deploy --set-env-vars`.
#
# RULE: Every new setting added to app/core/config.py MUST be added here
#       (with an explanatory comment) in the same commit.
# ─────────────────────────────────────────────────────────────────────────────

# Environment discriminator: "local" or "production"
# - local: used for local dev and CI
# - production: Cloud Run (disables emulator, connects to real Firestore)
APP_ENV=local

# GCP project ID passed to the Firestore AsyncClient
# - local dev / CI: a dummy project name (emulator ignores it but needs one)
# - production: your real GCP project ID
GCP_PROJECT_ID=sudoku-battle-local

# Firestore emulator address. LEAVE UNSET IN PRODUCTION.
# When set, the GCP Firestore SDK routes all traffic here automatically —
# no code change needed. Unset → SDK connects to real Firestore via service account.
# - docker-compose (inside container): firestore:8080  (Docker network hostname)
# - local host (uvicorn on host → Docker emulator): localhost:8080
FIRESTORE_EMULATOR_HOST=localhost:8080

# JSON array of allowed CORS origins — required by pydantic-settings v2 for list[str] fields.
# Add multiple origins as: ["https://origin1.com","https://origin2.com"]
# No trailing slashes.
# - local: the Vite dev server port
# - production: https://<your-cloud-run-service-url>
CORS_ORIGINS=["http://localhost:5174"]

# Port for uvicorn when running locally (outside docker-compose)
# Cloud Run ignores this — it always injects PORT=8080 automatically
PORT=8001
```

- [ ] **Step 2: Create `backend/.env.local`**

```dotenv
APP_ENV=local
GCP_PROJECT_ID=sudoku-battle-local
FIRESTORE_EMULATOR_HOST=localhost:8080
CORS_ORIGINS=["http://localhost:5174"]
PORT=8001
```

- [ ] **Step 3: Verify `.env.local` is gitignored**

```bash
git check-ignore -v backend/.env.local
```

Expected output contains `backend/.env.local` (line number may differ — confirms it is ignored)

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "chore: add backend .env.example with all config vars documented"
```

(`.env.local` is gitignored — not committed.)

---

### Task 3: Add `.env.example` sync rule to `backend/CLAUDE.md`

**Files:**
- Modify: `backend/CLAUDE.md`

- [ ] **Step 1: Add the sync rule** as a new `##`-level section at the end of `backend/CLAUDE.md`, after the existing `## Testing` section:

```markdown
## Env Var Sync Rule

Every new setting added to `app/core/config.py` **must** be added to `backend/.env.example`
(with an explanatory comment) in the same commit. This keeps the documented config and the
implementation in lock-step.
```

- [ ] **Step 2: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs: add env var sync rule to backend/CLAUDE.md"
```

---

## Chunk 2: Async Test Fixtures + `/health` Endpoint (TDD)

### Task 4: Upgrade `conftest.py` to async and write failing `/health` test

**Files:**
- Modify: `backend/conftest.py`
- Modify: `backend/tests/test_smoke.py` (update to async fixture)
- Create: `backend/tests/test_health.py`

Context: The existing `conftest.py` uses `TestClient` (sync). We replace it with an async `AsyncClient` fixture. The existing `test_smoke.py` tests `GET /docs` and uses the `client` fixture — we rename the fixture to `ac` and update the test. Then we write `test_health.py` with a failing test before implementing the endpoint.

- [ ] **Step 1: Replace `backend/conftest.py`**

```python
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
        project="sudoku-battle-test"
    )
    yield client
    await client.close()
```

- [ ] **Step 2: Update `backend/tests/test_smoke.py`** to use the new `ac` fixture:

```python
from httpx import AsyncClient


async def test_app_starts(ac: AsyncClient) -> None:
    response = await ac.get("/docs")
    assert response.status_code == 200
```

- [ ] **Step 3: Run the existing test to confirm it still passes**

```bash
docker-compose run --rm backend pytest tests/test_smoke.py -v
```

Expected: `test_app_starts PASSED`

- [ ] **Step 4: Create `backend/tests/test_health.py`** with the failing test:

```python
from httpx import AsyncClient


async def test_health_returns_ok(ac: AsyncClient) -> None:
    response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 5: Run to verify it fails**

```bash
docker-compose run --rm backend pytest tests/test_health.py -v
```

Expected: `FAILED tests/test_health.py::test_health_returns_ok` with 404 (endpoint doesn't exist yet)

- [ ] **Step 6: Commit the tests**

```bash
git add backend/conftest.py backend/tests/test_smoke.py backend/tests/test_health.py
git commit -m "test: upgrade conftest to async AsyncClient; add failing /health test"
```

---

### Task 5: Implement `/health` endpoint and Firestore lifespan in `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Replace `backend/app/main.py`** with the full implementation:

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
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
```

- [ ] **Step 2: Run `/health` test**

```bash
docker-compose run --rm backend pytest tests/test_health.py -v
```

Expected: `test_health_returns_ok PASSED`

- [ ] **Step 3: Run the full test suite**

```bash
docker-compose run --rm backend pytest -v
```

Expected: `2 passed` (test_app_starts + test_health_returns_ok)

- [ ] **Step 4: Run mypy**

```bash
docker-compose run --rm backend mypy app/
```

Expected: `Success: no issues found in N source files`

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add /health endpoint and Firestore lifespan init to main.py"
```

---

## Chunk 3: Docker Compose Ports + Milestone Verification

### Task 6: Update `docker-compose.yml` port mappings

**Files:**
- Modify: `docker-compose.yml` (repo root)

Context: Ports 8000 (backend) and 5173 (frontend) conflict with another local project. We remap the host-side ports only — the containers continue to run on their original internal ports, so no changes to Dockerfiles or run commands are needed.

Changes:
- Backend: `8000:8000` → `8001:8000` (host 8001 → container 8000)
- Frontend: `5173:5173` → `5174:5173` (host 5174 → container 5173)

- [ ] **Step 1: Edit the `backend` service ports in `docker-compose.yml`**

Change:
```yaml
    ports:
      - "8000:8000"
```
To:
```yaml
    ports:
      - "8001:8000"
```

- [ ] **Step 2: Edit the `frontend` service ports in `docker-compose.yml`**

Change:
```yaml
    ports:
      - "5173:5173"
```
To:
```yaml
    ports:
      - "5174:5173"
```

- [ ] **Step 3: Verify docker-compose config parses correctly**

```bash
docker-compose config --quiet
```

Expected: exits 0 (no output = no parse errors)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: remap host ports — backend 8001:8000, frontend 5174:5173 (avoid local conflicts)"
```

---

### Task 7: Milestone Verification

All four Phase 0 checks must pass.

- [ ] **Check 1: Firestore emulator starts**

```bash
docker-compose up firestore --detach
docker-compose ps firestore
```

Expected: `Status: healthy` (or `running`, depending on Docker Compose version). Give it up to 30 seconds for the healthcheck to pass.

- [ ] **Check 2: Backend dev server starts**

```bash
docker-compose up backend --detach
sleep 5
docker-compose logs backend
```

Expected in logs: `Application startup complete.`
Then stop it: `docker-compose stop backend`

- [ ] **Check 3: Full test suite passes**

```bash
docker-compose run --rm backend pytest -v
```

Expected:
```
tests/test_health.py::test_health_returns_ok PASSED
tests/test_smoke.py::test_app_starts        PASSED

2 passed
```

- [ ] **Check 4: mypy passes**

```bash
docker-compose run --rm backend mypy app/
```

Expected: `Success: no issues found in N source files`

- [ ] **Update STATUS.md** — mark Phase 0 done:

In `STATUS.md`, change:
```
| **0: Init** | Dev servers start; test suites run | 🔄 In progress |
```
To:
```
| **0: Init** | Dev servers start; test suites run | ✅ Done |
```

- [ ] **Final commit**

```bash
git add STATUS.md
git commit -m "chore: mark Phase 0 complete — all milestone checks pass"
```

- [ ] **Stop the emulator**

```bash
docker-compose stop firestore
```
