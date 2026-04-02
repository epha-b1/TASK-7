#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting application services detached (will exit, leaving containers running)..."
docker compose -f docker-compose.yml -p neighborhoodpickup up --build -d --remove-orphans db backend frontend

if [ $? -ne 0 ]; then
  echo "Failed to start application services"
  exit 1
fi

echo "Services started. To view logs: docker compose -p neighborhoodpickup logs -f"
echo "To stop and remove services: docker compose -f docker-compose.yml -p neighborhoodpickup down --volumes --remove-orphans"
