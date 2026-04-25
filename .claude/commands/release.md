# /release — Release Workflow

Run this workflow when you're ready to cut a production release. Follow the steps in order.

---

## 1. Pre-flight Checks

Verify the repo is in a clean, releasable state:

```bash
# Must be on main and up to date
git checkout main && git pull

# Must be clean (no uncommitted changes)
git status

# Show recent commits since last tag (what's in this release)
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline
```

Present the commit list to the user. If there are uncommitted changes, stop and ask the user to commit or stash them first. If the commit list is empty, warn the user — there may be nothing new to release.

---

## 2. Run Full Test Suite

```bash
docker compose run --rm backend pytest -q
```

```bash
docker compose run --rm frontend npx vitest run --reporter=dot
```

Present results. If any tests fail, stop and ask the user what to do.

---

## 3. Determine Version

Get the current latest tag:
```bash
git describe --tags --abbrev=0 2>/dev/null || echo "none"
```

Use the `AskUserQuestion` tool with a single question and three options. Compute the next PATCH/MINOR/MAJOR versions from the current tag (or `v0.0.0` if none) and include them in the option labels:

```
Question: "What version should this release be? (current: vX.Y.Z)"
Header: "Version"
Options:
  - label: "vX.Y.Z+1 — PATCH"  description: "Bug fixes, small improvements"
  - label: "vX.Y+1.0 — MINOR"  description: "New features, backward compatible"
  - label: "vX+1.0.0 — MAJOR"  description: "Breaking changes"
```

Wait for their selection.

---

## 4. Update STATUS.md and Open a PR

**main is protected — never push directly. Always use a PR.**

Create a release branch, update STATUS.md, and open a PR:

```bash
git checkout main && git pull
git checkout -b release/<VERSION>
```

Update `STATUS.md`:
- Update the Phase 5 Deploy entry to ✅ Done if this is the first production release
- Add a release entry at the top of the Done list: `- [x] Released <VERSION> to Cloud Run`

Commit, push, and open a PR:

```bash
git add STATUS.md
git commit -m "chore: release <VERSION>"
git push -u origin release/<VERSION>
gh pr create --title "chore: release <VERSION>" --base main --head release/<VERSION> --body "Release <VERSION> — see commit history for changes."
```

---

## 5. Monitor PR CI and Notify

After opening the release PR, poll CI until it completes:

```bash
gh run list --branch release/<VERSION> --limit 3
gh run watch <run-id>
```

When CI completes:
- **Pass**: notify the user: "CI passed on PR #<N>. Ready to merge." Wait for the user to merge.
- **Fail**: show the failure summary (`gh run view <run-id> --log-failed`) and stop. Do not proceed until the user decides how to fix it.

After the user confirms they've merged:
```bash
git checkout main && git pull
```

---

## 6. Release Notes

Ask the user:

> Write a short summary (1 line) and bullet-point release notes for this release.
> These will appear as the git tag annotation.
>
> Example:
> ```
> Summary: First production release
>
> - Production Dockerfile with multi-stage build
> - GitHub Actions tag-triggered deploy to Cloud Run
> - Firestore deny-all security rules
> ```

Wait for their notes.

---

## 7. Tag and Push

```bash
# Ensure on main and up to date (PR must be merged first)
git checkout main && git pull

# Create annotated tag — summary on first -m, notes on second -m
git tag -a <VERSION> -m "<one-line summary>" -m "<bullet notes>"

# Push the tag
git push origin <VERSION>
```

After pushing, print:

> Tag `<VERSION>` pushed. GitHub Actions will now:
> 1. Run backend tests (pytest)
> 2. Run frontend tests (vitest)
> 3. Build the production Docker image and push to Artifact Registry
> 4. Deploy to Cloud Run (me-west1)
>
> Monitor progress: `gh run list --limit 3`
> Or: GitHub → Actions tab → Deploy workflow

---

## 8. Monitor the Deploy Workflow

```bash
gh run list --workflow=deploy.yml --limit 3
gh run watch <run-id>
```

When complete:
- **Pass**: print the Cloud Run URL and proceed to post-deploy verification.
- **Fail**: show `gh run view <run-id> --log-failed`. Stop and help the user debug.

---

## 9. Post-Deploy Verification

After the deploy completes:

```
- [ ] Visit https://<cloud-run-url> — app loads
- [ ] Register a new player — works without error
- [ ] Leaderboard loads
- [ ] Challenge another tab — multiplayer room connects, countdown fires, puzzle appears
- [ ] Firestore direct access denied:
      curl "https://firestore.googleapis.com/v1/projects/sudoku-battle-494011/databases/(default)/documents/rooms" \
           -H "Authorization: Bearer $(gcloud auth print-access-token)"
      → should return 403 PERMISSION_DENIED
```

Present as a checklist. Ask the user to confirm each item.
