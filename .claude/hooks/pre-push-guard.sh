#!/bin/bash
# Pre-push guard: run all pre-commit checks PLUS tsc + mypy
set -e

ROOT="$(git rev-parse --show-toplevel)"

# Re-run pre-commit suite first
bash "$ROOT/.claude/hooks/pre-commit-guard.sh"

SKIPPED=0

echo "=== pre-push: frontend tsc ==="
cd "$ROOT/frontend"
if [[ ! -d "src" ]]; then
  echo "SKIP: frontend/src not found — no TypeScript code yet"
elif [[ -d "node_modules" ]]; then
  npx tsc --noEmit
else
  echo "WARNING: tsc SKIPPED — frontend/node_modules not found"
  SKIPPED=1
fi

echo "=== pre-push: backend mypy ==="
cd "$ROOT/backend"
if [[ ! -d "app" ]]; then
  echo "SKIP: backend/app not found — no Python code yet"
elif [[ -x ".venv/bin/mypy" ]]; then
  .venv/bin/mypy app/
else
  echo "WARNING: mypy SKIPPED — not found in backend/.venv"
  SKIPPED=1
fi

if [[ $SKIPPED -eq 0 ]]; then
  echo "=== pre-push: ALL PASSED ==="
else
  echo "=== pre-push: BLOCKED — install missing deps then retry (see SKIP warnings above) ==="
  exit 1
fi
