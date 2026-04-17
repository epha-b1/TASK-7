#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="neighborhoodpickup"
COMPOSE=(docker compose -f docker-compose.yml -p "$PROJECT")

cleanup() {
  "${COMPOSE[@]}" down --volumes --remove-orphans || true
}
trap cleanup EXIT

echo "==> [1/3] Backend + frontend unit / component tests with coverage (Docker)..."
"${COMPOSE[@]}" --profile test up \
  --build --abort-on-container-exit --exit-code-from tests --remove-orphans tests

echo ""
echo "==> [2/3] Backend NO-MOCK integration suite against real MySQL + createApp() (Docker)..."
"${COMPOSE[@]}" --profile integration up \
  --build --abort-on-container-exit --exit-code-from backend-integration --remove-orphans backend-integration

echo ""
echo "==> [3/3] Playwright E2E against live backend + frontend in the Docker network..."
"${COMPOSE[@]}" --profile e2e up \
  --build --abort-on-container-exit --exit-code-from e2e --remove-orphans e2e

echo ""
echo "All test suites completed successfully."
