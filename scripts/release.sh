#!/usr/bin/env bash
# scripts/release.sh — create and push a release tag to trigger GitHub Actions deploy
#
# Usage:
#   ./scripts/release.sh           # bump patch (default): v0.0.0 → v0.0.1
#   ./scripts/release.sh patch     # same as above
#   ./scripts/release.sh minor     # v0.1.0 → v0.2.0
#   ./scripts/release.sh major     # v1.0.0 → v2.0.0
#   ./scripts/release.sh v1.2.3    # explicit version

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────

die() { echo "error: $*" >&2; exit 1; }
info() { echo "→ $*"; }

# ── guards ───────────────────────────────────────────────────────────────────

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" == "main" ]] || die "must be on main (currently on '$BRANCH')"

git diff --quiet && git diff --cached --quiet || die "working tree is not clean — commit or stash first"

git fetch --tags --quiet
info "fetched latest tags"

# ── version calculation ───────────────────────────────────────────────────────

LATEST=$(git tag -l 'v*.*.*' --sort=-v:refname | head -1)

if [[ -z "$LATEST" ]]; then
  LATEST="v0.0.0"
  info "no existing tags — starting from $LATEST"
fi

BUMP="${1:-patch}"

if [[ "$BUMP" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # explicit version provided
  NEXT="$BUMP"
else
  # parse major.minor.patch from latest tag
  IFS='.' read -r MAJOR MINOR PATCH <<< "${LATEST#v}"
  case "$BUMP" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    *) die "unknown bump type '$BUMP' — use patch, minor, major, or an explicit version like v1.2.3" ;;
  esac
  NEXT="v${MAJOR}.${MINOR}.${PATCH}"
fi

# ── confirm ───────────────────────────────────────────────────────────────────

echo ""
echo "  current tag : ${LATEST}"
echo "  next tag    : ${NEXT}"
echo "  branch      : ${BRANCH}"
echo "  commit      : $(git rev-parse --short HEAD)"
echo ""
read -r -p "Tag and push $NEXT? [y/N] " REPLY
[[ "$REPLY" =~ ^[Yy]$ ]] || { echo "aborted"; exit 0; }

# ── tag and push ──────────────────────────────────────────────────────────────

git tag "$NEXT"
info "created tag $NEXT"

git push origin "$NEXT"
info "pushed tag $NEXT — GitHub Actions deploy workflow is now running"
echo ""
echo "  watch progress: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
