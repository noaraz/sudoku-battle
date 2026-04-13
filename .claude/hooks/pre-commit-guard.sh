#!/bin/bash
# Pre-commit guard: run backend + frontend tests before allowing git commit
set -e

ROOT="$(git rev-parse --show-toplevel)"
DOCKER="$(command -v docker 2>/dev/null || echo /Applications/Docker.app/Contents/Resources/bin/docker)"

echo "=== pre-commit: backend pytest ==="
cd "$ROOT"
if [[ ! -d "backend/app" ]]; then
  echo "SKIP: backend/app not found — no Python code yet"
elif "$DOCKER" compose run --rm --no-deps backend pytest -q; then
  echo "pytest: PASSED"
else
  echo "pytest: FAILED"
  exit 1
fi

echo "=== pre-commit: frontend vitest ==="
cd "$ROOT"
if [[ ! -d "frontend/src" ]]; then
  echo "SKIP: frontend/src not found — no TypeScript code yet"
elif "$DOCKER" compose run --rm frontend npx vitest run --reporter=dot; then
  echo "vitest: PASSED"
else
  echo "vitest: FAILED"
  exit 1
fi

echo "=== pre-commit: PASSED ==="
