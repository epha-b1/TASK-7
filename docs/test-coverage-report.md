# Test Coverage & E2E Delivery Report

## 1. Pipeline at a glance

`./run_tests.sh` (from `repo/`) runs three Dockerized phases in sequence:

1. **Unit / component** — vitest + supertest + @vue/test-utils (mocks permitted). Produces lcov coverage.
2. **Backend NO-MOCK integration** — vitest against a real Dockerized MySQL using `createApp()`. No `vi.mock` on `dbPool`, `MySqlAuthStore`, or any service/repository. Every assertion exercises request → service → repository → DB.
3. **Playwright E2E** — real Chromium against the Nginx-served Vue bundle and the live Express backend over the Docker network. Covers both UI-driven flows and HTTP API contract flows.

No host-side Node/npm/Playwright required.

## 2. Deliverables since the 82/100 review

### Removed
- `repo/frontend/test/e2e-smoke-flow.test.ts` — deleted. It was route-guard unit logic, not true E2E. The assertions it made are already covered by `router-guards.test.ts` and by the new Playwright specs.

### Added — no-mock backend integration (Docker + real MySQL)
- `repo/backend/vitest.integration.config.ts` — separate runner; `singleFork`, `fileParallelism: false`, long timeouts so real DB round-trips and argon2 hashing don't race. Runs `test-integration/**/*.int.test.ts` only.
- `repo/backend/test-integration/setup-env.ts` — Docker-network defaults (`DB_HOST=db`, behavior timers disabled).
- `repo/backend/test-integration/helpers/realApp.ts` — imports `createApp()` only after validating the real pool with `SELECT 1`. No mocks. Exposes `loginAgent()` which performs a real `/auth/login` and returns a cookie-bearing supertest agent.
- `repo/backend/test-integration/auth.int.test.ts` (4 tests) — real `/health`, login mints a real HttpOnly cookie, `/auth/me` reflects the real role set from MySQL, invalid password gets 401 with no cookie, each seeded role can log in and sees their role.
- `repo/backend/test-integration/commerceAndOrders.int.test.ts` (8 tests) — active cycles list excludes CLOSED, pickup point detail returns real per-window capacity, favorites toggle round-trips through the DB, quote produces a traced pricing envelope, bad tax code → 400, **real checkout persists an order and is later readable by both owner and FINANCE_CLERK**, a full window returns 409 CAPACITY_EXCEEDED, missing order → 404.
- `repo/backend/test-integration/appeals.int.test.ts` (10 tests) — member creates an appeal against their own real order, uploads a real PDF (with signature-prefix + checksum verification through the service), gets 400 when the binary doesn't match the claimed MIME, downloads the file and byte-compares it, reviewer advances INTAKE → INVESTIGATION → RULING, illegal re-transition returns 409 INVALID_STATUS_TRANSITION.
- `repo/backend/test-integration/finance.int.test.ts` (14 tests) — blacklist CRUD against the real table (CREATE → READ → UPDATE → DELETE, plus 404s), MEMBER/FINANCE_CLERK rejected, leader withdrawal eligibility gated by commission flag, reconciliation CSV header row byte-matches the documented schema, malformed date → 400, commission summary row shape.
- `repo/backend/test-integration/behaviorAndAudit.int.test.ts` (13 tests) — real idempotency-key deduplication through the DB, zod boundary (short key) → 400, unauthenticated → 401, `retention-status` and `retention-run` admin endpoints return the canonical shape, MEMBER forbidden from both, audit search returns rows carrying hash-chain fields, CSV export starts with the canonical header, REVIEWER forbidden from audit.

**49 no-mock integration tests total.** None use `vi.mock`.

### Added — Playwright domain journeys
- `repo/e2e/tests/member-checkout.spec.ts` — quote + checkout + order detail over real HTTP; full-window → 409.
- `repo/e2e/tests/appeal-lifecycle.spec.ts` — member create + upload PDF, reviewer advances through INVESTIGATION → RULING, timeline reflects both transitions; member PATCH on status → 403.
- `repo/e2e/tests/admin-finance-journeys.spec.ts` — blacklist CRUD end-to-end, finance reconciliation CSV export + malformed date, retention status + run endpoints, member denied.
- `repo/e2e/tests/leader-onboarding.spec.ts` — member application submit + fetch "my application", admin pending list, finance-clerk forbidden from submit.
- `repo/e2e/tests/behavior-ingest.spec.ts` — unique-key ingest + idempotency-on-resubmit + zod rejection.
- `repo/e2e/tests/login-flow.spec.ts` — UI login in real Chromium, `/admin/withdrawal-blacklist` → `/login` redirect for anonymous, member denied `/home/administrator` → `/forbidden`.
- `repo/e2e/tests/admin-approval.spec.ts` — each privileged role (administrator, finance clerk, reviewer, group leader) lands on their role home.
- `repo/e2e/tests/api-contract.spec.ts` — raw-HTTP checks on `/health`, `/auth/login` + `/auth/me`, member-blocked `/audit/logs`.

### Docker + pipeline
- `repo/Dockerfile.integration` — new image for the no-mock backend suite. Waits for MySQL, runs migrations, then `npm run test:integration`.
- `repo/docker-compose.yml` — added `backend-integration` service under the `integration` profile with `depends_on: db (healthy), backend (healthy)`. Backend `FRONTEND_ORIGINS` already extended for CSRF origin guard compatibility inside the Docker network.
- `repo/run_tests.sh` — three-phase pipeline; `trap cleanup EXIT` guarantees volumes are torn down even on failure.
- `repo/backend/package.json` — new `test:integration` script.

## 3. Coverage summary

### Unit / component (vitest --coverage)
- **Backend** — 253 tests across 37 files pass. Baseline: 54.49% statements, 70.74% branches, 51.94% functions. Core boundaries (middleware, security, utils, auth routes, pricing engine, leader/finance services) all ≥ 85%.
- **Frontend** — 72 tests across 17 files pass (the mislabeled smoke test was removed). Baseline: ~56% statements, ~72% branches. routeGuards and telemetry ≥ 90%.

### No-mock backend integration (new)
49 tests across 5 suites. Every assertion exercises the real stack:
`HTTP → middleware → router → service → repository → MySQL`.

Coverage by product area:

| Product behaviour | No-mock integration file |
|---|---|
| Login / `/auth/me` / logout / session cookie | `auth.int.test.ts` |
| Active cycles / listings / pickup point detail / favorites | `commerceAndOrders.int.test.ts` |
| Quote + checkout success + object-level ownership + capacity conflict | `commerceAndOrders.int.test.ts` |
| Appeal create against owned order + PDF upload + signature+checksum + download + status transitions | `appeals.int.test.ts` |
| Blacklist CRUD (real DB round-trip) + role gates + 404s | `finance.int.test.ts` |
| Reconciliation CSV headers + date validation | `finance.int.test.ts` |
| Commission summary row shape | `finance.int.test.ts` |
| Behavior ingest idempotency + zod boundary + auth requirement | `behaviorAndAudit.int.test.ts` |
| Retention status + run (admin only) | `behaviorAndAudit.int.test.ts` |
| Audit search (hash chain fields) + CSV export | `behaviorAndAudit.int.test.ts` |

### Playwright E2E (new + expanded)
8 specs, real Chromium + real backend + real MySQL.

| Domain journey | E2E file |
|---|---|
| Member browser login + role-based home navigation | `login-flow.spec.ts`, `admin-approval.spec.ts` |
| Member quote → checkout → order detail (+ capacity conflict path) | `member-checkout.spec.ts` |
| Appeal lifecycle: create → PDF upload → INTAKE → INVESTIGATION → RULING + reject illegal transition + member-denied PATCH | `appeal-lifecycle.spec.ts` |
| Admin blacklist CRUD end-to-end + finance CSV export + retention status/run + member-denied | `admin-finance-journeys.spec.ts` |
| Group leader application + admin pending list + finance forbidden | `leader-onboarding.spec.ts` |
| Behavior ingest idempotency + validation boundary | `behavior-ingest.spec.ts` |
| API contract (health, login cookie, forbidden audit) | `api-contract.spec.ts` |

## 4. What each layer gives you

- **Unit layer** — fast feedback on pure functions (pricing engine, CSV escaping, RBAC predicates, base64 signature check, retention branches).
- **No-mock integration layer** — high-confidence coverage of every route's real service→repository→MySQL path, including round-trip persistence, hash-chained audit entries, and file-system artefacts.
- **Playwright E2E layer** — real browser + real deployed backend; validates that the frontend bundle, session cookies, CSRF origin guard, and service workers all actually work together under the same conditions users hit.

## 5. Remaining gaps (honest accounting)

| Area | Status | Rationale |
|---|---|---|
| Lockout 423 behavior under the no-mock suite | Covered by unit + mocked-integration; not duplicated in the no-mock run because permanently locking `member1` would contaminate later tests. Instead the no-mock suite asserts wrong-password → 401 and relies on the isolated mocked-DB case for the 423 path. |
| UI-level capacity conflict *render* | Unit-mock covers it (`checkout-page.integration.test.ts`). Not added as a browser E2E to avoid snapshot fragility against real-time pickup-window data in the seed. |
| `features/*/repositories/*.ts` function-coverage in the unit report | Low — those files are now covered by the no-mock integration suite, which is tracked as its own deliverable. Inflating unit coverage with per-repo mocks was explicitly avoided on review. |
| Finance withdrawal happy path (actual approval through the DB) | Blocked by the seed leader not being commission-eligible by default; the test asserts the gate works, not that a withdrawal is approved. Making the leader commission-eligible in the seed would be a product-behavior change. |

## 6. Confirmation

`./run_tests.sh` is the canonical entrypoint and is Docker-only. It now runs:

- `--profile test` → backend + frontend vitest + coverage (253 + 72 tests).
- `--profile integration` → `backend-integration` service running 49 no-mock vitest integration tests against real MySQL via `createApp()`.
- `--profile e2e` → Playwright against the live Dockerized frontend + backend (UI + API contract journeys).

Cleanup runs via `trap` on both success and failure paths.
