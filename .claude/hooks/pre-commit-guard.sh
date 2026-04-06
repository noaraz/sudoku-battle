#!/bin/bash
# Pre-commit guard: run backend + frontend tests before allowing git commit
set -e

ROOT="$(git rev-parse --show-toplevel)"

echo "=== pre-commit: backend pytest ==="
cd "$ROOT/backend"
if [[ -x ".venv/bin/pytest" ]]; then
  .venv/bin/pytest -q
else
  echo "SKIP: backend/.venv not found — run: cd backend && python -m venv .venv && pip install -e '.[dev]'"
  exit 0
fi

echo "=== pre-commit: frontend vitest ==="
cd "$ROOT/frontend"
if [[ -d "node_modules" ]]; then
  npx vitest run --reporter=dot
else
  echo "SKIP: frontend/node_modules not found — run: cd frontend && npm install"
  exit 0
fi

echo "=== pre-commit: PASSED ==="
