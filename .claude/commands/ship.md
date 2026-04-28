# /ship — Open a PR for the current branch

Run this when a feature branch is ready to merge. Opens a PR with the right
title and optionally adds `[gcloud preview]` to trigger a live preview deployment.

---

## 1. Pre-flight Checks

```bash
git status                      # must be clean (all changes committed)
git log main..HEAD --oneline    # show commits that will be in the PR
```

If there are uncommitted changes, stop and ask the user to commit first.
If there are no commits ahead of main, warn — there may be nothing to ship.

---

## 2. Ask About Preview

Use `AskUserQuestion` with a single question:

```
Question: "Do you want a Cloud Run preview deployment for this PR?"
Header: "Preview"
Options:
  - label: "Yes — add [gcloud preview]"
    description: "A live Cloud Run revision will be deployed from this PR, seeded from prod Firestore. URL posted as a PR comment (~3-5 min)."
  - label: "No — skip preview"
    description: "Open the PR without a preview. You can always add [gcloud preview] to the title later to trigger one."
```

---

## 3. Push Branch and Open PR

```bash
git push -u origin HEAD
```

Then open the PR. If preview was selected, append ` [gcloud preview]` to the title:

```bash
# With preview:
gh pr create \
  --title "<descriptive title> [gcloud preview]" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
<describe what this PR does>

## Test plan
- [ ] Tests pass
- [ ] Manual smoke test

EOF
)"

# Without preview:
gh pr create \
  --title "<descriptive title>" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
<describe what this PR does>

## Test plan
- [ ] Tests pass
- [ ] Manual smoke test

EOF
)"
```

Fill in a descriptive title based on the commits. Do not use "chore: release" — that is for `/release` only.

---

## 4. Post-Open

After the PR is open:
- If preview was selected: tell the user "Preview deployment is starting. Watch for a comment on the PR with the URL (takes ~3-5 minutes)."
- Print the PR URL.
- Done — do not monitor CI unless the user asks.
