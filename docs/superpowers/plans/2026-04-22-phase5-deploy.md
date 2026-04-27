# Phase 5: Deploy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Sudoku Battle to Google Cloud Run as a single service serving both the FastAPI backend and the React frontend static build.

**Architecture:** Multi-stage Dockerfile builds the React frontend (Node 20) then packages it into a slim Python 3.12 production image; FastAPI conditionally mounts `frontend/dist/` as static files. GitHub Actions deploys on git tag push (`v*.*.*`) via Workload Identity Federation — no stored credentials anywhere.

**Tech Stack:** Docker (multi-stage), Google Cloud Run (`me-west1`), Artifact Registry, Workload Identity Federation, GitHub Actions, Firebase CLI (Firestore rules)

**Spec:** `/Users/noa.raz/.claude/plans/let-s-plan-phase-validated-horizon.md`

---

## Chunk 1: Application Code Changes

Files touched in this chunk:
- **Create:** `Dockerfile` — production multi-stage build
- **Modify:** `backend/app/main.py:64-66` — enable static file mount
- **Modify:** `backend/.env.example` — add production guidance

> **Note:** `.github/workflows/ci.yml` is NOT modified. The commented-out Docker build job at line ~131 stays commented — it is out of scope. The Docker build lives exclusively in `deploy.yml` (Chunk 3).

---

### Task 1: Production Dockerfile

**Files:**
- Create: `Dockerfile` (repo root)

- [ ] **Step 1: Create `Dockerfile` at repo root**

```dockerfile
# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
# Install deps before copying source for better layer caching
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# npm run build runs: tsc -b && vite build → outputs to /frontend/dist/
RUN npm run build

# ── Stage 2: Production Python image ───────────────────────────────────────
FROM python:3.12-slim AS production

WORKDIR /app

# Install production deps only — no [dev] extras (no pytest, mypy, ruff)
COPY backend/pyproject.toml ./
COPY backend/app/ ./app/
RUN pip install --no-cache-dir .

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist/ ./frontend/dist/

EXPOSE 8080

# Cloud Run always injects PORT=8080; bind to 0.0.0.0 so it's reachable
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: Verify the image builds**

```bash
docker build -t sudoku-battle-test .
```

Expected: Build completes with no errors. Final image is `sudoku-battle-test`.

- [ ] **Step 3: Verify the server starts and health check passes**

```bash
docker run --rm -p 8080:8080 \
  -e APP_ENV=production \
  -e GCP_PROJECT_ID=sudoku-battle-494011 \
  -e CORS_ORIGINS='["http://localhost:8080"]' \
  sudoku-battle-test &

sleep 3
curl -sf http://localhost:8080/health
```

Expected output: `{"status":"ok"}`

- [ ] **Step 4: Verify frontend is served at root**

```bash
curl -sf http://localhost:8080/ | head -5
```

Expected: HTML starting with `<!doctype html>` (React `index.html`).

Stop the container:
```bash
docker stop $(docker ps -q --filter ancestor=sudoku-battle-test)
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile
git commit -m "feat(deploy): add production multi-stage Dockerfile"
```

---

### Task 2: Enable Static File Mount in FastAPI

**Files:**
- Modify: `backend/app/main.py:64-66`

The static mount is already stubbed out (lines 64-66). Replace the commented block with a conditional mount: only mounts if `frontend/dist/` exists so local dev (no frontend build) continues to work unaffected.

- [ ] **Step 1: Update `backend/app/main.py`**

Replace lines 64-66:
```python
    # Static files mount — enabled in Phase 5 when Dockerfile builds frontend
    # from fastapi.staticfiles import StaticFiles
    # app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

With:
```python
    # Static files — mounted only when frontend/dist exists (production Docker build).
    # In local dev the directory is absent so the backend runs API-only.
    # Mount MUST come after all API routes (it is a catch-all).
    from pathlib import Path

    _dist = Path("frontend/dist")
    if _dist.exists():
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
```

- [ ] **Step 2: Rebuild image and re-verify static serving**

```bash
docker build -t sudoku-battle-test . && \
docker run --rm -p 8080:8080 \
  -e APP_ENV=production \
  -e GCP_PROJECT_ID=sudoku-battle-494011 \
  -e CORS_ORIGINS='["http://localhost:8080"]' \
  sudoku-battle-test &

sleep 3
curl -sf http://localhost:8080/ | grep -i doctype
curl -sf http://localhost:8080/health

docker stop $(docker ps -q --filter ancestor=sudoku-battle-test)
```

Expected: `/` returns html, `/health` returns `{"status":"ok"}`.

- [ ] **Step 3: Verify local backend still starts without frontend dist**

```bash
cd backend
# Run tests — the static mount path is absent here so it is skipped silently
docker run --rm \
  -e FIRESTORE_EMULATOR_HOST=localhost:8080 \
  -e GCP_PROJECT_ID=sudoku-battle-local \
  -e CORS_ORIGINS='["http://localhost:5174"]' \
  -e APP_ENV=local \
  sudoku-battle-test \
  python -c "from app.main import app; print('app loaded ok')"
```

Expected: `app loaded ok` (no error about missing directory).

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(deploy): conditionally mount frontend/dist as static files"
```

---

### Task 3: Update `.env.example` with Production Guidance

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Update `backend/.env.example`**

Replace the `CORS_ORIGINS` line and add a production block at the bottom:

```bash
# JSON array of allowed CORS origins — required by pydantic-settings v2 for list[str] fields.
# Add multiple origins as: ["https://origin1.com","https://origin2.com"]
# No trailing slashes.
# - local: the Vite dev server port
# - production: your Cloud Run URL (e.g. https://sudoku-battle-abc123-zf.a.run.app)
# NOTE: wildcards are rejected — allow_credentials=True requires explicit origins.
CORS_ORIGINS=["http://localhost:5174"]

# ── Production Cloud Run values (set via gcloud, not this file) ────────────
# APP_ENV=production
# GCP_PROJECT_ID=sudoku-battle-494011
# FIRESTORE_EMULATOR_HOST=   ← leave UNSET in production
# CORS_ORIGINS=["https://sudoku-battle-<hash>-zf.a.run.app"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs(deploy): add production Cloud Run env var guidance to .env.example"
```

---

## Chunk 2: GCP Bootstrap (One-Time Manual Setup)

> **Who runs this:** The developer once, locally, before the first deploy.
> **Prerequisites:** `gcloud` CLI installed and up to date. `docker` running locally.
> Replace `YOUR_GITHUB_USERNAME` and `YOUR_GITHUB_REPO` with your GitHub details (e.g. `noaraz` / `sudoku-battle`).

---

### Task 4: GCP Infrastructure Setup

**No code files — this is a checklist of `gcloud` commands run once.**

- [ ] **Step 1: Authenticate and set project**

```bash
gcloud auth login
gcloud config set project sudoku-battle-494011
```

- [ ] **Step 2: Enable required APIs**

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com
```

Expected: Each API shows `Operation finished successfully`.

- [ ] **Step 3: Create deployer service account**

```bash
gcloud iam service-accounts create sudoku-battle-deployer \
  --display-name="Sudoku Battle GitHub Actions Deployer"
```

Grant it the two roles it needs (deploy + push images — nothing else):

```bash
gcloud projects add-iam-policy-binding sudoku-battle-494011 \
  --member="serviceAccount:sudoku-battle-deployer@sudoku-battle-494011.iam.gserviceaccount.com" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding sudoku-battle-494011 \
  --member="serviceAccount:sudoku-battle-deployer@sudoku-battle-494011.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

- [ ] **Step 4: Create runtime service account**

```bash
gcloud iam service-accounts create sudoku-battle-runtime \
  --display-name="Sudoku Battle Cloud Run Runtime"
```

Grant it Firestore access only (no editor role):

```bash
gcloud projects add-iam-policy-binding sudoku-battle-494011 \
  --member="serviceAccount:sudoku-battle-runtime@sudoku-battle-494011.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

- [ ] **Step 5: Create Artifact Registry Docker repository**

```bash
gcloud artifacts repositories create sudoku-battle \
  --repository-format=docker \
  --location=me-west1 \
  --description="Sudoku Battle production Docker images"
```

Verify:
```bash
gcloud artifacts repositories list --location=me-west1
```

Expected: `sudoku-battle` listed with format `DOCKER`.

- [ ] **Step 6: Configure local Docker to authenticate to Artifact Registry**

```bash
gcloud auth configure-docker me-west1-docker.pkg.dev
```

- [ ] **Step 7: Create Workload Identity Federation pool**

```bash
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"
```

- [ ] **Step 8: Create WIF OIDC provider (tags only)**

```bash
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Actions OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository=='YOUR_GITHUB_USERNAME/sudoku-battle' && attribute.ref.startsWith('refs/tags/')"
```

**Important:** replace `YOUR_GITHUB_USERNAME` with your actual GitHub username (e.g. `noaraz`).
The `attribute.ref.startsWith('refs/tags/')` condition means only tag pushes can authenticate — branch pushes cannot.

- [ ] **Step 9: Bind deployer SA to the WIF pool**

```bash
POOL_NAME=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
  sudoku-battle-deployer@sudoku-battle-494011.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/YOUR_GITHUB_USERNAME/sudoku-battle"
```

- [ ] **Step 10: Capture values for GitHub Actions variables**

```bash
PROVIDER_NAME=$(gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)")

echo "WIF_PROVIDER:         $PROVIDER_NAME"
echo "WIF_SERVICE_ACCOUNT:  sudoku-battle-deployer@sudoku-battle-494011.iam.gserviceaccount.com"
```

Copy these two values — you'll set them as GitHub repository variables in the next step.

- [ ] **Step 11: Set GitHub Actions repository variables**

Go to: `https://github.com/YOUR_GITHUB_USERNAME/sudoku-battle/settings/variables/actions`

Add two **Variables** (not secrets — these are identifiers, not credentials):

| Name | Value |
|---|---|
| `WIF_PROVIDER` | output from step 10 |
| `WIF_SERVICE_ACCOUNT` | `sudoku-battle-deployer@sudoku-battle-494011.iam.gserviceaccount.com` |

`CLOUD_RUN_URL` will be added after the first deploy (step 13 below).

- [ ] **Step 12: First manual deploy (to get the Cloud Run URL)**

Build and push the image manually:

```bash
IMAGE=me-west1-docker.pkg.dev/sudoku-battle-494011/sudoku-battle/app

docker build -t ${IMAGE}:v0.1.0 .
docker push ${IMAGE}:v0.1.0
```

Deploy with a placeholder CORS origin (will be updated immediately after):

```bash
gcloud run deploy sudoku-battle \
  --image=${IMAGE}:v0.1.0 \
  --region=me-west1 \
  --service-account=sudoku-battle-runtime@sudoku-battle-494011.iam.gserviceaccount.com \
  --set-env-vars="^|^APP_ENV=production|GCP_PROJECT_ID=sudoku-battle-494011|CORS_ORIGINS=[\"http://localhost:5174\"]" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --allow-unauthenticated \
  --port=8080 \
  --quiet
```

> **Note:** `^|^` sets `|` as the env var delimiter so the JSON brackets in `CORS_ORIGINS` don't confuse gcloud's comma parser.

- [ ] **Step 13: Capture the Cloud Run URL and update CORS**

```bash
URL=$(gcloud run services describe sudoku-battle \
  --region=me-west1 \
  --format='value(status.url)')

echo "Cloud Run URL: $URL"

# Update CORS to the real URL
gcloud run services update sudoku-battle \
  --region=me-west1 \
  --set-env-vars="^|^APP_ENV=production|GCP_PROJECT_ID=sudoku-battle-494011|CORS_ORIGINS=[\"${URL}\"]"
```

- [ ] **Step 14: Set `CLOUD_RUN_URL` GitHub Actions variable**

Go to: `https://github.com/YOUR_GITHUB_USERNAME/sudoku-battle/settings/variables/actions`

Add:

| Name | Value |
|---|---|
| `CLOUD_RUN_URL` | the URL from step 13 (e.g. `https://sudoku-battle-abc123-zf.a.run.app`) |

- [ ] **Step 15: Smoke-test the deployed service**

```bash
curl -sf ${URL}/health
curl -sf ${URL}/ | grep -i doctype
```

Expected: `/health` → `{"status":"ok"}`, `/` → HTML.

---

## Chunk 3: Deploy Workflow & Firestore Rules

Files touched in this chunk:
- **Create:** `.github/workflows/deploy.yml`
- **Create:** `firestore.rules`
- **Create:** `.firebaserc`

---

### Task 5: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
# Deploy to Cloud Run on git tag push (v*.*.*)
# Requires GitHub Actions repository variables:
#   WIF_PROVIDER, WIF_SERVICE_ACCOUNT, CLOUD_RUN_URL
#
# Spec: /Users/noa.raz/.claude/plans/let-s-plan-phase-validated-horizon.md

name: Deploy

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

# One deploy at a time — don't cancel an in-progress deploy if a new tag arrives
concurrency:
  group: deploy
  cancel-in-progress: false

env:
  IMAGE: me-west1-docker.pkg.dev/sudoku-battle-494011/sudoku-battle/app
  REGION: me-west1
  SERVICE: sudoku-battle
  PROJECT: sudoku-battle-494011

jobs:
  # ── Re-run CI on the tag before deploying ──────────────────────────────────
  backend-tests:
    name: Backend tests
    runs-on: ubuntu-latest
    # Guard: skip if somehow triggered on a non-tag ref (e.g. workflow_dispatch on a branch)
    if: startsWith(github.ref, 'refs/tags/')
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2b  # v5.3.0
        with:
          python-version: "3.12"
          cache: pip
      - name: Install dependencies
        run: pip install -e ".[dev]"
      - uses: actions/setup-java@3a4f6e1af504cf6a31855fa899c6aa5355bfc87d  # v4.7.0
        with:
          distribution: temurin
          java-version: "21"
      - name: Start Firestore emulator
        run: |
          npm install -g firebase-tools
          echo '{"emulators":{"firestore":{"port":8080,"host":"0.0.0.0"}}}' > firebase.json
          npx firebase emulators:start --only firestore --project sudoku-battle-local &
          timeout 30 bash -c 'until curl -sf http://localhost:8080; do sleep 1; done'
      - name: pytest
        run: pytest -q
        env:
          FIRESTORE_EMULATOR_HOST: localhost:8080

  frontend-tests:
    name: Frontend tests
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: vitest
        run: npx vitest run --reporter=dot

  # ── Build, push, deploy ────────────────────────────────────────────────────
  deploy:
    name: Build & Deploy to Cloud Run
    needs: [backend-tests, frontend-tests]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')

    permissions:
      contents: read
      id-token: write  # required for Workload Identity Federation

    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

      - name: Authenticate to Google Cloud (WIF — no keys)
        uses: google-github-actions/auth@6fc4af4b145ae7821d527454aa9bd537d1f2dc5f  # v2.1.7
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}

      - name: Set up gcloud CLI
        uses: google-github-actions/setup-gcloud@6189d56e4096ee891640bb02ac264be376592d6a  # v2.1.4

      - name: Authenticate Docker to Artifact Registry
        run: gcloud auth configure-docker me-west1-docker.pkg.dev --quiet

      - name: Build Docker image
        run: |
          docker build \
            -t ${{ env.IMAGE }}:${{ github.ref_name }} \
            .

      - name: Push image to Artifact Registry
        run: docker push ${{ env.IMAGE }}:${{ github.ref_name }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE }} \
            --image=${{ env.IMAGE }}:${{ github.ref_name }} \
            --region=${{ env.REGION }} \
            --service-account=sudoku-battle-runtime@${{ env.PROJECT }}.iam.gserviceaccount.com \
            --set-env-vars="^|^APP_ENV=production|GCP_PROJECT_ID=${{ env.PROJECT }}|CORS_ORIGINS=[\"${{ vars.CLOUD_RUN_URL }}\"]" \
            --memory=512Mi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=3 \
            --allow-unauthenticated \
            --port=8080 \
            --quiet

      - name: Show deployed URL
        run: |
          URL=$(gcloud run services describe ${{ env.SERVICE }} \
            --region=${{ env.REGION }} \
            --format='value(status.url)')
          echo "### ✅ Deployed ${{ github.ref_name }} to: $URL" >> $GITHUB_STEP_SUMMARY
```

> **SHA pinning note:** The SHAs above are pinned to known-good releases as of the spec date. Verify they are current before merging:
> ```bash
> # Check latest SHA for an action — example for actions/checkout
> gh api repos/actions/checkout/git/ref/tags/v4 --jq '.object.sha'
> ```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(deploy): add tag-triggered GitHub Actions deploy workflow"
```

---

### Task 6: Firestore Security Rules

**Files:**
- Create: `firestore.rules`
- Create: `.firebaserc`

All Firestore access is server-side via FastAPI. Deny all direct client access.

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All Firestore access goes through the FastAPI backend.
    // Direct client access is denied unconditionally.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Create `.firebaserc`**

```json
{
  "projects": {
    "default": "sudoku-battle-494011"
  }
}
```

- [ ] **Step 3: Install Firebase CLI (if not already installed)**

```bash
npm install -g firebase-tools
firebase login
```

- [ ] **Step 4: Deploy Firestore rules**

```bash
firebase deploy --only firestore:rules
```

Expected output:
```
✔  Deploy complete!
```

- [ ] **Step 5: Verify rules deny direct access**

```bash
curl -sf \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://firestore.googleapis.com/v1/projects/sudoku-battle-494011/databases/(default)/documents/rooms"
```

Expected: HTTP 403 with body containing `"PERMISSION_DENIED"`.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules .firebaserc
git commit -m "feat(deploy): add Firestore security rules — deny all direct access"
```

---

## End-to-End Verification

After all tasks are complete:

- [ ] Push a tag to trigger the full automated pipeline:

```bash
git tag v0.1.0
git push origin v0.1.0
```

- [ ] In GitHub Actions, verify:
  1. `backend-tests` job passes
  2. `frontend-tests` job passes
  3. `deploy` job passes — image pushed to Artifact Registry, Cloud Run updated
  4. Step summary shows the Cloud Run URL

- [ ] Open the Cloud Run URL in a browser — the Sudoku Battle game loads.

- [ ] `curl https://<cloud-run-url>/health` → `{"status":"ok"}`

- [ ] Firestore direct access returns 403 (step 7.5 above).
