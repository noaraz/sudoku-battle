# Plan

## Phase 2 — Auth + Leaderboard

- **Spec:** [`docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md`](docs/superpowers/specs/2026-04-19-phase2-auth-leaderboard-design.md)
- **Plan:** [`docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md`](docs/superpowers/plans/2026-04-19-phase2-auth-leaderboard.md)

---

## Release

When ready to ship to production, create `.claude/commands/release.md` (modelled on the garmin-coach release command at `/Users/noa.raz/workspace/my-garmin-coach/.claude/commands/release.md`).

Steps it should cover:
1. Pre-flight (clean main, full test suite, build check)
2. Version bump (`frontend/package.json` + `STATUS.md`) via release branch + PR
3. Annotated git tag
4. `gcloud run deploy sudoku-battle --source . --region=me-west1`
5. Post-deploy smoke check (Cloud Run URL, puzzle playable, results screen)

---

## CI — Future Steps

### E2E Tests (Playwright)
**When:** Once the app has a working UI end-to-end.

**Requires:**
1. `frontend/e2e/` tests written with Playwright (login, create room, join room, play game, results screen)
2. `docker-compose.yml` at repo root that boots backend + frontend together
3. Firestore emulator sidecar in the compose file (`gcr.io/google.com/cloudsdktool/cloud-sdk` with `gcloud emulators firestore start`)
4. Uncomment the `e2e` job in `.github/workflows/ci.yml`

**Action:** The job skeleton is already in `.github/workflows/ci.yml` as a commented-out block — just uncomment and wire up the compose file.

---

### Lighthouse CI
**When:** UI is feature-complete and design is stable.

**What:** Perf, accessibility, and best-practices scores on the built frontend. Fail PR if score drops below threshold.

**Tool:** `treosh/lighthouse-ci-action` + `lighthouserc.yml` config.

---

### PR Title Lint (Conventional Commits)
**When:** Team grows or a changelog is needed.

**What:** Enforce `feat:`, `fix:`, `chore:` etc. on PR titles so release notes can be auto-generated.

**Tool:** `amannn/action-semantic-pull-request`.

---

### Coverage Badges
**When:** Repo goes public or you want a quick health signal on the README.

**What:** Generate shields.io badges from coverage reports and commit them to the repo.

**Tool:** `MishaKav/pytest-coverage-comment` supports badge output; vitest has `@vitest/coverage-v8` JSON output for the same.
