# NeighborhoodPickup Commerce Portal

**Project type: `fullstack`** — Vue 3 frontend + Express/TypeScript backend + MySQL, orchestrated with Docker Compose.

## Docker-only rules

- **No local runtime installs required.** You do NOT need Node, npm, Python, or any other language toolchain on the host. Everything runs inside containers.
- **No manual DB setup required.** The `db` service boots MySQL 8, the backend container runs migrations and seeds automatically on startup.
- All commands in this README are run from the repository root (`repo/`).

## Quick start

From the repository root:

```bash
docker-compose up --build -d
```

That single command brings up:

| Service  | URL                          | Purpose                                  |
|----------|------------------------------|------------------------------------------|
| frontend | http://localhost:8081        | Vue 3 app served by Nginx                |
| backend  | http://localhost:4000        | Express REST API                         |
| backend  | http://localhost:4000/health | Liveness probe (no auth)                 |
| backend  | http://localhost:4000/docs   | Swagger UI for the OpenAPI spec          |
| db       | (internal only)              | MySQL 8, migrations + seeds run on start |

If port `8081` is already in use on the host, override it:

```bash
FRONTEND_HOST_PORT=18081 docker-compose up --build -d
```

An equivalent convenience script is provided:

```bash
./start_app.sh
```

Follow container logs:

```bash
docker compose -p neighborhoodpickup logs -f
```

## Verification

### API verification (curl)

Health endpoint — must return `{"success":true,"data":{"ok":true}}`:

```bash
curl -sS http://localhost:4000/health
```

Unauthenticated `/auth/me` — must return HTTP 401 with a `NOT_AUTHENTICATED` code:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4000/auth/me
# expected: 401
```

Login as the seeded member and then hit `/auth/me` with the session cookie:

```bash
curl -sS -c /tmp/np.cookies -H 'Content-Type: application/json' \
  -d '{"username":"member1","password":"Member#Pass123"}' \
  http://localhost:4000/auth/login | head -c 200

curl -sS -b /tmp/np.cookies http://localhost:4000/auth/me
# expected envelope: { "success": true, "data": { "user": { "username": "member1", "roles": ["MEMBER"] }, ... } }
```

Member denied admin audit endpoint (role enforcement check):

```bash
curl -sS -b /tmp/np.cookies -o /dev/null -w "%{http_code}\n" \
  http://localhost:4000/audit/logs
# expected: 403
```

### UI verification

1. Open the frontend at **http://localhost:8081** — the login page is shown.
2. Sign in with the member credentials: `member1` / `Member#Pass123`. The router should redirect you to `/home/member`.
3. Navigate to "Listings" (or `/member/listings`) — the real backend returns active listings from the seeded "March Fresh Produce Wave" cycle.
4. Open a listing, add it to your order, select any pickup window with remaining capacity, and submit at `/member/checkout`. The order appears at `/member/orders/:id` with a `CONFIRMED` status.
5. (Optional, privileged) Sign out and sign back in as `admin1` / `Admin#Pass12345`. You are routed to `/home/administrator` and can view pending leader applications and `/admin/withdrawal-blacklist`.

## Demo credentials (all roles)

| Role           | Username   | Password           |
|----------------|------------|--------------------|
| Member         | `member1`  | `Member#Pass123`   |
| Group leader   | `leader1`  | `Leader#Pass123`   |
| Reviewer       | `reviewer1`| `Reviewer#Pass123` |
| Finance clerk  | `finance1` | `Finance#Pass123`  |
| Administrator  | `admin1`   | `Admin#Pass12345`  |

## Run tests (Docker only)

```bash
./run_tests.sh
```

This runs three phases in sequence inside Docker and cleans up all containers and volumes on exit:

1. **Unit / component** — backend (vitest + supertest) and frontend (vitest + @vue/test-utils).
2. **Backend no-mock integration** — real MySQL, real `createApp()`, real migrations + seeds.
3. **Playwright E2E** — Chromium against the live frontend + backend in the Docker network.

If port `8081` is already in use on your machine, override it for the run:

```bash
FRONTEND_HOST_PORT=18081 ./run_tests.sh
```

## Stop and cleanup

```bash
docker compose -f docker-compose.yml -p neighborhoodpickup down --volumes --remove-orphans
```
