# NeighborhoodPickup Commerce Portal

## Docker-Only Run and Test

Run all commands from the repository root.

## Start the App (detached)

Start the application services in detached mode (the script will exit, leaving containers running):

```bash
./start_app.sh
```

This starts:

- `db` (MySQL)
- `backend` (Express API on `http://localhost:4000`)
- `frontend` (Nginx on `http://localhost:8081`)

To view logs:

```bash
docker compose -p neighborhoodpickup logs -f
```

To stop and remove the services and volumes:

```bash
docker compose -f docker-compose.yml -p neighborhoodpickup down --volumes --remove-orphans
```

## Run Tests (Docker-only, will stop services when done)

Use the test script to run the test suite inside Docker. It will stop and clean up containers after the tests finish:

```bash
./run_tests.sh
```

If port `8081` is already in use on your machine, override it for the run:

```bash
FRONTEND_HOST_PORT=18081 ./run_tests.sh
```

## Default Login Credentials

- member1 / Member#Pass123
- leader1 / Leader#Pass123
- reviewer1 / Reviewer#Pass123
- finance1 / Finance#Pass123
- admin1 / Admin#Pass12345

## Stop and Cleanup

```bash
docker compose down -v --remove-orphans
```
