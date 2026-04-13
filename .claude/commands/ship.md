# /ship — Feature Ship Workflow

Run this workflow when a feature branch is ready to ship. Follow the steps in order.

---

## 1. Run Tests

Run the full test suite inside Docker:

```bash
# Frontend: vitest
PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  docker compose run --rm frontend npx vitest run

# Backend: pytest (--no-deps skips Firestore if tests don't need it)
PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  docker compose run --rm --no-deps backend pytest -q
```

Present results: total passed/failed, any failures.

---

## 2. Type Check + Lint

```bash
# Frontend: TypeScript
PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  docker compose run --rm frontend npx tsc --noEmit

# Backend: mypy
PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  docker compose run --rm --no-deps backend mypy app/
```

Fix any errors before continuing.

---

## 3. Ask What to Fix (Pre-PR)

Show the results and ask:

> "All checks pass. Anything to fix before I open the PR?"

Wait for the user's response. Fix requested items, re-run affected checks, then continue.

---

## 4. Update Docs

### STATUS.md
- Mark completed tasks as ✅
- Update `## Current Focus` to reflect next work

### backend/PLAN.md + frontend/PLAN.md
- Check off completed tasks
- Note any deviations from the plan

---

## 5. Commit and Open PR

Stage and review:
```bash
git add -A
git status
git diff --staged --stat
```

Commit any uncommitted changes:
```bash
git commit -m "docs: update STATUS and PLAN after <feature>"
```

Push branch and open PR:
```bash
git push -u origin HEAD

gh pr create \
  --title "feat: <title>" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>

## Test plan
- [ ] Frontend tests pass: `docker compose run --rm frontend npx vitest run`
- [ ] Backend tests pass: `docker compose run --rm --no-deps backend pytest -q`
- [ ] TypeScript clean: `docker compose run --rm frontend npx tsc --noEmit`
- [ ] mypy clean: `docker compose run --rm --no-deps backend mypy app/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user.

---

## 6. Code Review

Invoke the code review skill on the PR:

```
Skill tool: superpowers:code-reviewer, args: <PR URL>
```

Present any issues found and offer to fix them.
