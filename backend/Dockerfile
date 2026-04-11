FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .

ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then \
      pip install --no-cache-dir -e ".[dev]"; \
    else \
      pip install --no-cache-dir -e "."; \
    fi

COPY . .
