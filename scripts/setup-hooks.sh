#!/bin/bash
# Install tracked git hooks from git-hooks/ into .git/hooks/
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"

for hook in pre-commit pre-push; do
  cp "$REPO_ROOT/git-hooks/$hook" "$REPO_ROOT/.git/hooks/$hook"
  chmod +x "$REPO_ROOT/.git/hooks/$hook"
  echo "Installed: .git/hooks/$hook"
done

echo "Done. Run this script after each fresh clone."
