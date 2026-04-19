# Phase 2 — Auth + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add player identity (name-only, no password) and a persistent leaderboard backed by Firestore, accessible from both devices.

**Architecture:** Backend adds three REST endpoints (`POST /api/v1/players`, `GET /api/v1/players`, `GET /api/v1/leaderboard`) with a layered model/schema/repo/router structure. Frontend adds `useAuth` and `useLeaderboard` hooks, a `LoginScreen`, a `LeaderboardScreen`, and refactors `Lobby` into a main-menu with Solo / Battle (disabled) / Scores options. App state machine grows from `lobby|game|results` to `login|lobby|game|results|leaderboard`.

**Tech Stack:** FastAPI, google-cloud-firestore (async), Pydantic v2, pytest-asyncio, React 18, TypeScript, Vitest, @testing-library/react, Tailwind CSS.

---

## File Map

### Backend — new files
| File | Responsibility |
|------|---------------|
| `backend/app/models/player.py` | `Player` dataclass (internal domain object) |
| `backend/app/schemas/player.py` | `PlayerCreate` (request body), `PlayerOut` (response) |
| `backend/app/repositories/player_repo.py` | Firestore CRUD: `create`, `get_all` |
| `backend/app/api/__init__.py` | empty package marker |
| `backend/app/api/v1/__init__.py` | empty package marker |
| `backend/app/api/v1/players.py` | Route handlers for players + leaderboard |
| `backend/tests/test_players.py` | All player endpoint tests |

### Backend — modified files
| File | Change |
|------|--------|
| `backend/conftest.py` | Add `ac_with_db` fixture that attaches Firestore db to `app.state` |
| `backend/app/main.py` | Include players router at `/api/v1` |

### Frontend — new files
| File | Responsibility |
|------|---------------|
| `frontend/src/services/api.ts` | Typed fetch wrapper for all backend calls |
| `frontend/src/viewmodels/useAuth.ts` | `selectedPlayer`, `knownPlayers`, `selectPlayer`, `addPlayer` |
| `frontend/src/viewmodels/useAuth.test.ts` | useAuth hook tests |
| `frontend/src/viewmodels/useLeaderboard.ts` | `entries[]`, `loading`, `load()` |
| `frontend/src/viewmodels/useLeaderboard.test.ts` | useLeaderboard hook tests |
| `frontend/src/views/LoginScreen.tsx` | Player picker: list rows + "Add player" |
| `frontend/src/views/LeaderboardScreen.tsx` | Ranked list with back button |

### Frontend — modified files
| File | Change |
|------|--------|
| `frontend/src/models/index.ts` | Add `Player` interface |
| `frontend/src/App.tsx` | New screen state machine + useAuth integration |
| `frontend/src/views/Lobby.tsx` | Replace difficulty picker with main menu |
| `frontend/src/views/views.test.tsx` | Add LoginScreen + LeaderboardScreen tests, update Lobby tests |

---

## Chunk 1: Backend

### Task 1: Player model, schemas, and __init__ files

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/player.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/player.py`
- Create: `backend/app/repositories/__init__.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`

- [ ] **Step 1: Create all empty `__init__.py` files**

Create these five empty files (each contains no content):
```
backend/app/models/__init__.py
backend/app/schemas/__init__.py
backend/app/repositories/__init__.py
backend/app/api/__init__.py
backend/app/api/v1/__init__.py
```

- [ ] **Step 2: Create `backend/app/models/player.py`**

```python
from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class Player:
    name: str
    wins: int = 0
    played: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
```

- [ ] **Step 3: Create `backend/app/schemas/player.py`**

```python
from datetime import datetime
from pydantic import BaseModel, field_validator


class PlayerCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v


class PlayerOut(BaseModel):
    name: str
    wins: int
    played: int
    created_at: datetime
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/ backend/app/schemas/ backend/app/repositories/__init__.py backend/app/api/
git commit -m "feat(backend): player model, schemas, package structure"
```

---

### Task 2: Player repository (Firestore CRUD)

**Files:**
- Create: `backend/app/repositories/player_repo.py`
- Test: `backend/tests/test_players.py` (partial — repo-level not tested directly; tested via API in Task 3)

> The repository is thin Firestore I/O. It is fully exercised through the API tests in Task 3, which use the real Firestore emulator.

- [ ] **Step 1: Create `backend/app/repositories/player_repo.py`**

```python
from datetime import UTC, datetime

from google.cloud.firestore_v1 import AsyncClient

from app.models.player import Player

COLLECTION = "players"


async def create(db: AsyncClient, name: str) -> Player:
    """Create a player. Raises ValueError('name taken') if name already exists."""
    ref = db.collection(COLLECTION).document(name)
    doc = await ref.get()
    if doc.exists:
        raise ValueError("name taken")
    player = Player(name=name)
    await ref.set(
        {
            "wins": player.wins,
            "played": player.played,
            "created_at": player.created_at,
        }
    )
    return player


async def get_all(db: AsyncClient) -> list[Player]:
    """Return all players (unordered)."""
    players: list[Player] = []
    async for doc in db.collection(COLLECTION).stream():
        data = doc.to_dict()
        players.append(
            Player(
                name=doc.id,
                wins=data["wins"],
                played=data["played"],
                created_at=data.get("created_at", datetime.now(UTC)),
            )
        )
    return players
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/repositories/player_repo.py
git commit -m "feat(backend): player repository (Firestore CRUD)"
```

---

### Task 3: Player router + tests (TDD)

**Files:**
- Create: `backend/app/api/v1/players.py`
- Create: `backend/tests/test_players.py`
- Modify: `backend/conftest.py` (add `ac_with_db` fixture)
- Modify: `backend/app/main.py` (include router)

- [ ] **Step 1: Add `ac_with_db` fixture to `backend/conftest.py`**

Open `backend/conftest.py`. Add this fixture after the existing `ac` fixture.
`asyncio_mode = "auto"` means plain `async def` fixtures are auto-detected — no `@pytest_asyncio.fixture` needed.
The fixture deletes the `players` collection after each test so tests don't bleed state into each other.

```python
@pytest.fixture
async def ac_with_db(db: AsyncClient) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with Firestore db attached to app.state — for endpoint tests.
    Cleans up the players collection after each test."""
    app.state.db = db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    # Teardown: delete all player documents so tests don't share state
    async for doc in db.collection("players").stream():
        await doc.reference.delete()
    app.state.db = None  # type: ignore[assignment]
```

Add `from collections.abc import AsyncGenerator` to the imports at the top of `conftest.py` if not already present.

- [ ] **Step 2: Write failing tests in `backend/tests/test_players.py`**

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_player_returns_201(ac_with_db: AsyncClient) -> None:
    resp = await ac_with_db.post("/api/v1/players", json={"name": "Alice"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["wins"] == 0
    assert body["played"] == 0


@pytest.mark.asyncio
async def test_create_player_duplicate_returns_409(ac_with_db: AsyncClient) -> None:
    await ac_with_db.post("/api/v1/players", json={"name": "Bob"})
    resp = await ac_with_db.post("/api/v1/players", json={"name": "Bob"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_players(ac_with_db: AsyncClient) -> None:
    await ac_with_db.post("/api/v1/players", json={"name": "Carol"})
    await ac_with_db.post("/api/v1/players", json={"name": "Dave"})
    resp = await ac_with_db.get("/api/v1/players")
    assert resp.status_code == 200
    names = {p["name"] for p in resp.json()}
    assert {"Carol", "Dave"}.issubset(names)


@pytest.mark.asyncio
async def test_leaderboard_sorted_by_wins_desc(ac_with_db: AsyncClient) -> None:
    # Create two players; manually set wins via repo to avoid needing a full game
    from app.repositories import player_repo

    await player_repo.create(ac_with_db.app.state.db, "Eve")  # type: ignore[attr-defined]
    await player_repo.create(ac_with_db.app.state.db, "Frank")  # type: ignore[attr-defined]

    # Patch wins directly in Firestore
    db = ac_with_db.app.state.db  # type: ignore[attr-defined]
    await db.collection("players").document("Frank").update({"wins": 5})
    await db.collection("players").document("Eve").update({"wins": 2})

    resp = await ac_with_db.get("/api/v1/leaderboard")
    assert resp.status_code == 200
    entries = resp.json()
    names = [e["name"] for e in entries]
    assert names.index("Frank") < names.index("Eve")
```

- [ ] **Step 3: Run tests — expect them to FAIL (router not wired yet)**

```bash
docker compose run --rm backend pytest tests/test_players.py -v
```

Expected: `ImportError` or `404` — router not yet registered.

- [ ] **Step 4: Create `backend/app/api/v1/players.py`**

```python
from fastapi import APIRouter, HTTPException, Request

from app.repositories import player_repo
from app.schemas.player import PlayerCreate, PlayerOut

router = APIRouter(tags=["players"])


@router.post("/players", status_code=201, response_model=PlayerOut)
async def create_player(body: PlayerCreate, request: Request) -> PlayerOut:
    try:
        player = await player_repo.create(request.app.state.db, body.name)
    except ValueError:
        raise HTTPException(status_code=409, detail="name taken")
    return PlayerOut(
        name=player.name,
        wins=player.wins,
        played=player.played,
        created_at=player.created_at,
    )


@router.get("/players", response_model=list[PlayerOut])
async def list_players(request: Request) -> list[PlayerOut]:
    players = await player_repo.get_all(request.app.state.db)
    return [
        PlayerOut(name=p.name, wins=p.wins, played=p.played, created_at=p.created_at)
        for p in players
    ]


@router.get("/leaderboard", response_model=list[PlayerOut])
async def leaderboard(request: Request) -> list[PlayerOut]:
    players = await player_repo.get_all(request.app.state.db)
    players.sort(key=lambda p: p.wins, reverse=True)
    return [
        PlayerOut(name=p.name, wins=p.wins, played=p.played, created_at=p.created_at)
        for p in players
    ]
```

- [ ] **Step 5: Wire the router into `backend/app/main.py`**

`main.py` uses a `create_app()` factory (line 36). Add the import at the top of the file with the other imports:

```python
from app.api.v1 import players as players_router
```

Then inside `create_app()`, after `app.add_middleware(...)` and before `return app`, add:

```python
    app.include_router(players_router.router, prefix="/api/v1")
```

The final shape of `create_app()` will be:
```python
def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sudoku Battle", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, ...)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(players_router.router, prefix="/api/v1")  # ← add this

    return app
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
docker compose run --rm backend pytest tests/test_players.py -v
```

Expected output:
```
tests/test_players.py::test_create_player_returns_201 PASSED
tests/test_players.py::test_create_player_duplicate_returns_409 PASSED
tests/test_players.py::test_list_players PASSED
tests/test_players.py::test_leaderboard_sorted_by_wins_desc PASSED
4 passed
```

- [ ] **Step 7: Run full backend test suite to confirm no regressions**

```bash
docker compose run --rm backend pytest -q
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/conftest.py backend/app/main.py backend/app/api/v1/players.py backend/tests/test_players.py
git commit -m "feat(backend): players + leaderboard endpoints (TDD)"
```

---

## Chunk 2: Frontend

### Task 4: Player type + api.ts service

**Files:**
- Modify: `frontend/src/models/index.ts`
- Create: `frontend/src/services/api.ts`

- [ ] **Step 1: Add `Player` type to `frontend/src/models/index.ts`**

Append to the existing file:

```typescript
export interface Player {
  name: string;
  wins: number;
  played: number;
}
```

- [ ] **Step 2: Create `frontend/src/services/api.ts`**

```typescript
// Base URL: empty string = same origin (production), or override via VITE_API_URL (dev)
const BASE = import.meta.env.VITE_API_URL ?? "";

export interface PlayerOut {
  name: string;
  wins: number;
  played: number;
  created_at: string;
}

export async function createPlayer(name: string): Promise<PlayerOut> {
  const res = await fetch(`${BASE}/api/v1/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.status === 409) throw new Error("name taken");
  if (!res.ok) throw new Error(`createPlayer failed: ${res.status}`);
  return res.json() as Promise<PlayerOut>;
}

export async function getPlayers(): Promise<PlayerOut[]> {
  const res = await fetch(`${BASE}/api/v1/players`);
  if (!res.ok) throw new Error(`getPlayers failed: ${res.status}`);
  return res.json() as Promise<PlayerOut[]>;
}

export async function getLeaderboard(): Promise<PlayerOut[]> {
  const res = await fetch(`${BASE}/api/v1/leaderboard`);
  if (!res.ok) throw new Error(`getLeaderboard failed: ${res.status}`);
  return res.json() as Promise<PlayerOut[]>;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/models/index.ts frontend/src/services/api.ts
git commit -m "feat(frontend): Player type + api.ts service"
```

---

### Task 5: useAuth hook (TDD)

**Files:**
- Create: `frontend/src/viewmodels/useAuth.ts`
- Create: `frontend/src/viewmodels/useAuth.test.ts`

- [ ] **Step 1: Write failing tests in `frontend/src/viewmodels/useAuth.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";

// Mock api.ts so tests don't hit the network
vi.mock("../services/api", () => ({
  getPlayers: vi.fn(),
  createPlayer: vi.fn(),
}));

import { getPlayers, createPlayer } from "../services/api";

const mockGetPlayers = vi.mocked(getPlayers);
const mockCreatePlayer = vi.mocked(createPlayer);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetPlayers.mockResolvedValue([]);
});

describe("useAuth", () => {
  it("starts with no selected player when localStorage is empty", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.selectedPlayer).toBeNull();
  });

  it("restores selected player from localStorage", async () => {
    localStorage.setItem(
      "selectedPlayer",
      JSON.stringify({ name: "Alice", wins: 3, played: 5 })
    );
    const { result } = renderHook(() => useAuth());
    expect(result.current.selectedPlayer?.name).toBe("Alice");
  });

  it("fetches known players on mount sorted by name", async () => {
    mockGetPlayers.mockResolvedValue([
      { name: "Zara", wins: 1, played: 2, created_at: "" },
      { name: "Alice", wins: 5, played: 6, created_at: "" },
    ]);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => result.current.knownPlayers.length > 0);
    expect(result.current.knownPlayers[0].name).toBe("Alice");
    expect(result.current.knownPlayers[1].name).toBe("Zara");
  });

  it("selectPlayer saves to state and localStorage", async () => {
    mockGetPlayers.mockResolvedValue([
      { name: "Bob", wins: 2, played: 4, created_at: "" },
    ]);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => result.current.knownPlayers.length > 0);
    act(() => result.current.selectPlayer("Bob"));
    expect(result.current.selectedPlayer?.name).toBe("Bob");
    const stored = JSON.parse(localStorage.getItem("selectedPlayer")!);
    expect(stored.name).toBe("Bob");
  });

  it("addPlayer calls createPlayer then refreshes knownPlayers", async () => {
    mockCreatePlayer.mockResolvedValue({
      name: "Carol",
      wins: 0,
      played: 0,
      created_at: "",
    });
    mockGetPlayers
      .mockResolvedValueOnce([]) // initial mount
      .mockResolvedValueOnce([
        { name: "Carol", wins: 0, played: 0, created_at: "" },
      ]); // after add
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.addPlayer("Carol");
    });
    expect(mockCreatePlayer).toHaveBeenCalledWith("Carol");
    await waitFor(() =>
      result.current.knownPlayers.some((p) => p.name === "Carol")
    );
  });

  it("addPlayer throws Error('name taken') on duplicate", async () => {
    mockCreatePlayer.mockRejectedValue(new Error("name taken"));
    const { result } = renderHook(() => useAuth());
    await expect(result.current.addPlayer("Alice")).rejects.toThrow(
      "name taken"
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
docker compose run --rm frontend npx vitest run src/viewmodels/useAuth.test.ts --reporter=verbose
```

Expected: `Cannot find module './useAuth'`

- [ ] **Step 3: Create `frontend/src/viewmodels/useAuth.ts`**

```typescript
import { useEffect, useState } from "react";

import { Player } from "../models";
import { createPlayer, getPlayers } from "../services/api";

interface AuthState {
  selectedPlayer: Player | null;
  knownPlayers: Player[];
  selectPlayer: (name: string) => void;
  addPlayer: (name: string) => Promise<void>;
}

const STORAGE_KEY = "selectedPlayer";

export function useAuth(): AuthState {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Player) : null;
  });
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([]);

  useEffect(() => {
    getPlayers()
      .then((players) =>
        [...players].sort((a, b) => a.name.localeCompare(b.name))
      )
      .then(setKnownPlayers)
      .catch(() => {
        // silently ignore network errors (e.g. backend not yet running)
      });
  }, []);

  function selectPlayer(name: string): void {
    const player = knownPlayers.find((p) => p.name === name) ?? {
      name,
      wins: 0,
      played: 0,
    };
    setSelectedPlayer(player);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  }

  async function addPlayer(name: string): Promise<void> {
    await createPlayer(name); // throws Error("name taken") on 409
    const updated = await getPlayers();
    setKnownPlayers([...updated].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return { selectedPlayer, knownPlayers, selectPlayer, addPlayer };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker compose run --rm frontend npx vitest run src/viewmodels/useAuth.test.ts --reporter=verbose
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/viewmodels/useAuth.ts frontend/src/viewmodels/useAuth.test.ts
git commit -m "feat(frontend): useAuth hook (TDD)"
```

---

### Task 6: useLeaderboard hook (TDD)

**Files:**
- Create: `frontend/src/viewmodels/useLeaderboard.ts`
- Create: `frontend/src/viewmodels/useLeaderboard.test.ts`

- [ ] **Step 1: Write failing tests in `frontend/src/viewmodels/useLeaderboard.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLeaderboard } from "./useLeaderboard";

vi.mock("../services/api", () => ({
  getLeaderboard: vi.fn(),
}));

import { getLeaderboard } from "../services/api";

const mockGetLeaderboard = vi.mocked(getLeaderboard);

beforeEach(() => vi.clearAllMocks());

describe("useLeaderboard", () => {
  it("starts with empty entries and loading false", () => {
    mockGetLeaderboard.mockResolvedValue([]);
    const { result } = renderHook(() => useLeaderboard());
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("load() sets loading true then false and populates entries", async () => {
    mockGetLeaderboard.mockResolvedValue([
      { name: "Alice", wins: 5, played: 8, created_at: "" },
      { name: "Bob", wins: 2, played: 4, created_at: "" },
    ]);
    const { result } = renderHook(() => useLeaderboard());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].name).toBe("Alice");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
docker compose run --rm frontend npx vitest run src/viewmodels/useLeaderboard.test.ts --reporter=verbose
```

- [ ] **Step 3: Create `frontend/src/viewmodels/useLeaderboard.ts`**

```typescript
import { useState } from "react";

import { Player } from "../models";
import { getLeaderboard } from "../services/api";

interface LeaderboardState {
  entries: Player[];
  loading: boolean;
  load: () => Promise<void>;
}

export function useLeaderboard(): LeaderboardState {
  const [entries, setEntries] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  return { entries, loading, load };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker compose run --rm frontend npx vitest run src/viewmodels/useLeaderboard.test.ts --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/viewmodels/useLeaderboard.ts frontend/src/viewmodels/useLeaderboard.test.ts
git commit -m "feat(frontend): useLeaderboard hook (TDD)"
```

---

### Task 7: LoginScreen component (TDD)

**Files:**
- Create: `frontend/src/views/LoginScreen.tsx`
- Modify: `frontend/src/views/views.test.tsx`

- [ ] **Step 1: Write failing tests — add to `frontend/src/views/views.test.tsx`**

First, update the `@testing-library/react` import at the top of `views.test.tsx` to include `waitFor`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
```

Then add this block at the end of the file:

```typescript
// ─── LoginScreen ────────────────────────────────────────────────────────────
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen", () => {
  const players = [
    { name: "Alice", wins: 3, played: 5 },
    { name: "Bob", wins: 1, played: 2 },
  ];

  it("renders a button for each known player", () => {
    render(
      <LoginScreen
        knownPlayers={players}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows empty-state message when no players", () => {
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={vi.fn()} />
    );
    expect(
      screen.getByText(/no players yet/i)
    ).toBeInTheDocument();
  });

  it("calls onSelect with player name when player row is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <LoginScreen
        knownPlayers={players}
        onSelect={onSelect}
        onAdd={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText("Alice"));
    expect(onSelect).toHaveBeenCalledWith("Alice");
  });

  it("shows add-player input when 'Add player' is clicked", async () => {
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={vi.fn()} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
  });

  it("calls onAdd then onSelect when new player is submitted", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    render(
      <LoginScreen knownPlayers={[]} onSelect={onSelect} onAdd={onAdd} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    await userEvent.type(screen.getByPlaceholderText(/your name/i), "Carol");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onAdd).toHaveBeenCalledWith("Carol");
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("Carol"));
  });

  it("shows error message when onAdd throws 'name taken'", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("name taken"));
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={onAdd} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    await userEvent.type(screen.getByPlaceholderText(/your name/i), "Alice");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(screen.getByText(/name taken/i)).toBeInTheDocument()
    );
  });
});
```


- [ ] **Step 2: Run tests — expect FAIL**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose
```

Expected: `Cannot find module './LoginScreen'`

- [ ] **Step 3: Create `frontend/src/views/LoginScreen.tsx`**

```typescript
import { useState } from "react";

import { Player } from "../models";

interface Props {
  knownPlayers: Player[];
  onSelect: (name: string) => void;
  onAdd: (name: string) => Promise<void>;
}

export function LoginScreen({ knownPlayers, onSelect, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await onAdd(name);
      onSelect(name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add player");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Who's playing?
      </h1>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {knownPlayers.length === 0 && !adding && (
          <p className="text-gray-400 text-sm text-center py-4">
            No players yet — add one below.
          </p>
        )}
        {knownPlayers.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.name)}
            className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {p.name[0].toUpperCase()}
            </div>
            <span className="flex-1 text-left text-gray-900 dark:text-white text-sm">
              {p.name}
            </span>
            <span className="text-gray-400 text-xs">{p.wins} wins</span>
          </button>
        ))}
        {adding ? (
          <div className="flex flex-col gap-2 mt-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="Your name"
              className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={() => void handleAdd()}
              className="bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-gray-400 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-3 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 text-gray-400 hover:border-zinc-400 transition-colors"
          >
            <div className="w-8 h-8 rounded-full border border-dashed border-zinc-400 flex items-center justify-center text-zinc-400 text-lg">
              +
            </div>
            <span className="text-sm">Add player</span>
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/LoginScreen.tsx frontend/src/views/views.test.tsx
git commit -m "feat(frontend): LoginScreen component (TDD)"
```

---

### Task 8: LeaderboardScreen component (TDD)

**Files:**
- Create: `frontend/src/views/LeaderboardScreen.tsx`
- Modify: `frontend/src/views/views.test.tsx`

- [ ] **Step 1: Add failing tests to `frontend/src/views/views.test.tsx`**

```typescript
// ─── LeaderboardScreen ──────────────────────────────────────────────────────
import { LeaderboardScreen } from "./LeaderboardScreen";

describe("LeaderboardScreen", () => {
  const entries = [
    { name: "Alice", wins: 5, played: 8 },
    { name: "Bob", wins: 2, played: 4 },
  ];

  it("renders a ranked row for each entry", () => {
    render(
      <LeaderboardScreen entries={entries} loading={false} onBack={vi.fn()} />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/5 wins/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <LeaderboardScreen entries={[]} loading={true} onBack={vi.fn()} />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(
      <LeaderboardScreen entries={[]} loading={false} onBack={vi.fn()} />
    );
    expect(screen.getByText(/no scores yet/i)).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    render(
      <LeaderboardScreen entries={entries} loading={false} onBack={onBack} />
    );
    await userEvent.click(screen.getByRole("button", { name: /back|←/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose
```

- [ ] **Step 3: Create `frontend/src/views/LeaderboardScreen.tsx`**

```typescript
import { Player } from "../models";

interface Props {
  entries: Player[];
  loading: boolean;
  onBack: () => void;
}

export function LeaderboardScreen({ entries, loading, onBack }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-900 px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          aria-label="back"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Scores
        </h1>
      </div>
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No scores yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3"
            >
              <span
                className="text-sm font-bold w-4"
                style={{ color: i === 0 ? "#fbbf24" : "#6b7280" }}
              >
                {i + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {entry.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-gray-900 dark:text-white text-sm">
                {entry.name}
              </span>
              <span className="text-gray-400 text-xs">
                {entry.wins} wins · {entry.played} played
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/LeaderboardScreen.tsx frontend/src/views/views.test.tsx
git commit -m "feat(frontend): LeaderboardScreen component (TDD)"
```

---

### Task 9: Refactor Lobby into main menu + update App.tsx state machine

**Files:**
- Modify: `frontend/src/views/Lobby.tsx`
- Modify: `frontend/src/views/views.test.tsx` (update Lobby tests)
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add Lobby tests to `frontend/src/views/views.test.tsx`**

`views.test.tsx` does not currently have a Lobby describe block. Add the following new block at the end of the file:

```typescript
// ─── Lobby ──────────────────────────────────────────────────────────────────
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  it("renders Solo, Battle, and Scores options", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    expect(screen.getByText(/solo/i)).toBeInTheDocument();
    expect(screen.getByText(/battle/i)).toBeInTheDocument();
    expect(screen.getByText(/scores/i)).toBeInTheDocument();
  });

  it("shows difficulty picker when Solo is clicked", async () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    await userEvent.click(screen.getByText(/solo/i));
    expect(screen.getByText(/easy/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it("calls onSolo with difficulty when difficulty is selected", async () => {
    const onSolo = vi.fn();
    render(<Lobby onSolo={onSolo} onScores={vi.fn()} />);
    await userEvent.click(screen.getByText(/solo/i));
    await userEvent.click(screen.getByRole("button", { name: /^easy$/i }));
    expect(onSolo).toHaveBeenCalledWith("easy");
  });

  it("calls onScores when Scores is clicked", async () => {
    const onScores = vi.fn();
    render(<Lobby onSolo={vi.fn()} onScores={onScores} />);
    await userEvent.click(screen.getByText(/scores/i));
    expect(onScores).toHaveBeenCalled();
  });

  it("Battle button is disabled", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    // Battle row exists but is not an interactive button
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Lobby tests — expect FAIL**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx -t "Lobby" --reporter=verbose
```

- [ ] **Step 3: Rewrite `frontend/src/views/Lobby.tsx`**

```typescript
import { useState } from "react";

import { Difficulty } from "../models";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

interface Props {
  onSolo: (difficulty: Difficulty) => void;
  onScores: () => void;
}

export function Lobby({ onSolo, onScores }: Props) {
  const [showDifficulty, setShowDifficulty] = useState(false);

  if (showDifficulty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
        <button
          onClick={() => setShowDifficulty(false)}
          className="mb-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 self-start"
        >
          ← Back
        </button>
        <div className="w-full max-w-sm flex flex-col gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => onSolo(d)}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-4 rounded-xl text-base capitalize transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-900 px-4">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => setShowDifficulty(true)}
          className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl px-5 py-4 transition-colors"
        >
          <span className="text-2xl">🧩</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Solo
            </div>
            <div className="text-gray-400 text-xs">Play at your own pace</div>
          </div>
        </button>

        <div className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-5 py-4 opacity-40 cursor-not-allowed">
          <span className="text-2xl">⚔️</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Battle
            </div>
            <div className="text-gray-400 text-xs">coming soon</div>
          </div>
        </div>

        <button
          onClick={onScores}
          className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl px-5 py-4 transition-colors"
        >
          <span className="text-2xl">📊</span>
          <div className="text-left">
            <div className="text-gray-900 dark:text-white font-semibold">
              Scores
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run Lobby tests — expect PASS**

```bash
docker compose run --rm frontend npx vitest run src/views/views.test.tsx -t "Lobby" --reporter=verbose
```

- [ ] **Step 5: Update `frontend/src/App.tsx`**

Replace the file content:

```typescript
import { useEffect, useState } from "react";

import { Difficulty } from "./models";
import { useAuth } from "./viewmodels/useAuth";
import { useLeaderboard } from "./viewmodels/useLeaderboard";
import { useTheme } from "./viewmodels/useTheme";
import { recordTime } from "./utils/bestTimes";
import { GameScreen } from "./views/GameScreen";
import { LeaderboardScreen } from "./views/LeaderboardScreen";
import { Lobby } from "./views/Lobby";
import { LoginScreen } from "./views/LoginScreen";
import { ResultsScreen } from "./views/ResultsScreen";

type Screen = "login" | "lobby" | "game" | "results" | "leaderboard";

export default function App() {
  const { theme, toggle } = useTheme();
  const auth = useAuth();
  const leaderboard = useLeaderboard();

  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem("selectedPlayer") ? "lobby" : "login"
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [seed, setSeed] = useState(0);
  const [finishTime, setFinishTime] = useState(0);

  // Load leaderboard when navigating to it
  useEffect(() => {
    if (screen === "leaderboard") {
      void leaderboard.load();
    }
  }, [screen]);

  function handleSolo(d: Difficulty) {
    setDifficulty(d);
    setSeed(Date.now());
    setScreen("game");
  }

  function handleFinish(seconds: number) {
    setFinishTime(seconds);
    recordTime(difficulty, seconds);
    setScreen("results");
  }

  return (
    <div className={theme}>
      {/* Theme toggle — shown on lobby and results */}
      {(screen === "lobby" || screen === "results") && (
        <button
          onClick={toggle}
          className="fixed top-3 right-3 z-50 text-xl"
          aria-label="toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      )}

      {screen === "login" && (
        <LoginScreen
          knownPlayers={auth.knownPlayers}
          onSelect={(name) => {
            auth.selectPlayer(name);
            setScreen("lobby");
          }}
          onAdd={auth.addPlayer}
        />
      )}

      {screen === "lobby" && (
        <Lobby
          onSolo={handleSolo}
          onScores={() => setScreen("leaderboard")}
        />
      )}

      {screen === "game" && (
        <GameScreen
          seed={seed}
          difficulty={difficulty}
          onFinish={handleFinish}
        />
      )}

      {screen === "results" && (
        <ResultsScreen
          seconds={finishTime}
          difficulty={difficulty}
          onPlayAgain={() => setScreen("lobby")}
        />
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen
          entries={leaderboard.entries}
          loading={leaderboard.loading}
          onBack={() => setScreen("lobby")}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run full frontend test suite**

```bash
docker compose run --rm frontend npx vitest run --reporter=verbose
```

Expected: all tests pass (Lobby tests updated, no regressions in other tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/Lobby.tsx frontend/src/App.tsx frontend/src/views/views.test.tsx
git commit -m "feat(frontend): lobby main menu + app state machine (login|lobby|game|results|leaderboard)"
```

---

## Final Verification

- [ ] **Backend full suite**

```bash
docker compose run --rm backend pytest -q
```

Expected: all tests pass.

- [ ] **Frontend full suite**

```bash
docker compose run --rm frontend npx vitest run --reporter=dot
```

Expected: all tests pass.

- [ ] **TypeScript check**

```bash
docker compose run --rm frontend npx tsc --noEmit
```

Expected: no errors.

- [ ] **Manual smoke test**

1. Start backend: `FIRESTORE_EMULATOR_HOST=localhost:8080 docker compose up backend`
2. Start frontend: `docker compose up frontend`
3. Open `http://localhost:5174`
4. Verify: login screen shows empty state "No players yet — add one below."
5. Add yourself → you're taken to lobby
6. Lobby shows Solo / Battle (disabled) / Scores
7. Tap Scores → leaderboard shows your name, 0 wins
8. Play a solo game, return to lobby
9. Open app on second device → your name appears in player list
