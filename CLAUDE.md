# Sudoku Battle

Competitive 2-player Sudoku. Players join a room, get the same puzzle, race to finish.

## Stack
- Backend: FastAPI + Python 3.12, WebSockets, google-cloud-firestore
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Database: Google Firestore (free tier)
- Hosting: Google Cloud Run (free tier), single service serves both API and frontend build
- Region: me-west1 (Tel Aviv)

## Architecture
- Frontend: MVVM — Models (interfaces), ViewModels (hooks with all logic), Views (dumb components)
- TDD throughout — write tests first for all business logic
- Puzzle generation is client-side (seed-based RNG, no DB needed)
- WebSockets for all real-time sync (NOT Firestore polling)
- Stateless auth: name + bcrypt-hashed PIN, no sessions/JWT

## Project Structure
```
sudoku-battle/
├── CLAUDE.md           # This file
├── STATUS.md           # Progress tracker
├── backend/
│   ├── CLAUDE.md       # Backend context + plan
│   └── app/            # FastAPI app
├── frontend/
│   ├── CLAUDE.md       # Frontend context + plan
│   └── src/            # React app
└── docs/
    └── GAME_SPEC.md    # Full game specification (START HERE)
```

## Claude Code Setup

### Hooks
- pre-commit: `cd backend && pytest -q` + `cd frontend && npx vitest run --reporter=dot`
- pre-push: above + `cd frontend && npx tsc --noEmit` + `cd backend && mypy app/`

### Agents
- **backend**: scope `backend/`, context `backend/CLAUDE.md` + `docs/GAME_SPEC.md`
- **frontend**: scope `frontend/`, context `frontend/CLAUDE.md` + `docs/GAME_SPEC.md`
- **infra**: scope root, Dockerfile + docker-compose + Cloud Run deploy

### Skills & Plugins
- superpowers plugin for multi-file refactors
- security review for WebSocket auth and input validation

## Key Commands
```bash
# Local dev with Firestore emulator
gcloud emulators firestore start --host-port=localhost:8080
FIRESTORE_EMULATOR_HOST=localhost:8080 uvicorn app.main:app --reload
cd frontend && npm run dev

# Deploy
gcloud run deploy sudoku-battle --source . --region=me-west1
```

## Getting Started
1. Read `docs/GAME_SPEC.md` — it has everything
2. Use `/brainstorming` to generate PLAN.md files for backend and frontend
3. Start with Phase 1 (solo play, no network) — it's the foundation

## Claude Code Notes
- `.claude/settings.local.json` — auto-generated session permissions, gitignored (personal)
- Run `bash scripts/setup-hooks.sh` after fresh clone to install git hooks
- All work goes on feature branches — `main` is protected (PR + 1 approval required)
