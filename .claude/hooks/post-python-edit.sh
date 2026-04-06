#!/bin/bash
# Auto-ruff after Python file edit
INPUT=$(cat 2>/dev/null || echo "{}")
FILE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ "$FILE" == *.py ]] || exit 0
[[ -f "$FILE" ]] || exit 0

REPO_ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [[ -x "$REPO_ROOT/backend/.venv/bin/ruff" ]]; then
  RUFF="$REPO_ROOT/backend/.venv/bin/ruff"
else
  exit 0
fi

"$RUFF" check --fix "$FILE" 2>/dev/null || true
"$RUFF" format "$FILE" 2>/dev/null || true
