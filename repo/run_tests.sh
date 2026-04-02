#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Running tests in Docker (will stop all services when tests finish)..."
# Start the test service and its dependencies, aborting other containers when the test service exits
docker compose -f docker-compose.yml -p neighborhoodpickup up --build --abort-on-container-exit --exit-code-from tests --remove-orphans tests
EXIT_CODE=$?

# Ensure all containers/volumes are cleaned up after the run
docker compose -f docker-compose.yml -p neighborhoodpickup down --volumes --remove-orphans || true

if [ "$EXIT_CODE" -ne 0 ]; then
	echo "Tests failed with exit code $EXIT_CODE"
	exit $EXIT_CODE
fi

echo "All tests completed successfully."
