#!/bin/bash
# Pre-push guard: run all pre-commit checks PLUS tsc + mypy
set -e

ROOT="$(git rev-parse --show-toplevel)"

# Re-run pre-commit suite first
bash "$ROOT/.claude/hooks/pre-commit-guard.sh"

SKIPPED=0

DOCKER="$(command -v docker 2>/dev/null || echo /Applications/Docker.app/Contents/Resources/bin/docker)"

echo "=== pre-push: frontend tsc ==="
cd "$ROOT"
if [[ ! -d "frontend/src" ]]; then
  echo "SKIP: frontend/src not found — no TypeScript code yet"
elif "$DOCKER" compose run --rm --no-deps frontend npx tsc --noEmit; then
  echo "tsc: PASSED"
else
  echo "tsc: FAILED"
  exit 1
fi

echo "=== pre-push: backend mypy ==="
cd "$ROOT"
if [[ ! -d "backend/app" ]]; then
  echo "SKIP: backend/app not found — no Python code yet"
elif "$DOCKER" compose run --rm --no-deps backend mypy app/; then
  echo "mypy: PASSED"
else
  echo "mypy: FAILED"
  exit 1
fi

if [[ $SKIPPED -eq 0 ]]; then
  echo "=== pre-push: ALL PASSED ==="
else
  echo "=== pre-push: BLOCKED — install missing deps then retry (see SKIP warnings above) ==="
  exit 1
fi
