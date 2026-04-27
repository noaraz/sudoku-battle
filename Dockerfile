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

# Run as non-root for defense-in-depth
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist/ ./frontend/dist/

EXPOSE 8080

# Cloud Run always injects PORT=8080; bind to 0.0.0.0 so it's reachable
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
