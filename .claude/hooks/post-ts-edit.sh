#!/bin/bash
# Auto-eslint after TypeScript file edit
INPUT=$(cat 2>/dev/null || echo "{}")
FILE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ "$FILE" == *.ts || "$FILE" == *.tsx ]] || exit 0
[[ -f "$FILE" ]] || exit 0
[[ "$FILE" == */frontend/* ]] || exit 0

REPO_ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT/frontend"

[[ -d "node_modules" ]] || exit 0
npx eslint --fix "$FILE" 2>/dev/null || true
