# Test Coverage Audit

## Scope and Method
- Static inspection of route declarations, app wiring, tests, and README.
- Also attempted execution retest via `repo/run_tests.sh`.
- Runtime retest status: **not completed** due external network timeout during Docker build (`npm install` ETIMEDOUT in frontend image), not due test assertion failures.

## Backend Endpoint Inventory

Resolved from `repo/backend/src/app.ts` + mounted routers.

Total endpoints: **54**

1. `GET /health`
2. `POST /auth/login`
3. `POST /auth/logout`
4. `GET /auth/me`
5. `GET /rbac/member`
6. `GET /rbac/group-leader`
7. `GET /rbac/reviewer`
8. `GET /rbac/finance-clerk`
9. `GET /rbac/administrator`
10. `GET /buying-cycles/active`
11. `GET /listings`
12. `GET /pickup-points/:id`
13. `POST /favorites/toggle`
14. `POST /admin/pickup-windows`
15. `POST /orders/quote`
16. `POST /orders/checkout`
17. `GET /orders/:id`
18. `GET /finance/ledger`
19. `POST /comments`
20. `GET /threads/:id/comments`
21. `GET /threads/resolve`
22. `POST /comments/:id/flag`
23. `GET /notifications`
24. `PATCH /notifications/:id/read-state`
25. `PATCH /comments/:id/visibility`
26. `GET /appeals`
27. `POST /appeals`
28. `POST /appeals/:id/files`
29. `GET /appeals/:id`
30. `GET /appeals/:id/timeline`
31. `GET /appeals/:id/files/:fileId/download`
32. `PATCH /appeals/:id/status`
33. `GET /finance/commissions`
34. `GET /finance/withdrawals/eligibility`
35. `POST /finance/withdrawals`
36. `GET /finance/reconciliation/export`
37. `GET /admin/withdrawal-blacklist`
38. `POST /admin/withdrawal-blacklist`
39. `PATCH /admin/withdrawal-blacklist/:id`
40. `DELETE /admin/withdrawal-blacklist/:id`
41. `POST /leaders/applications`
42. `GET /leaders/applications/me`
43. `GET /admin/leaders/applications/pending`
44. `POST /admin/leaders/applications/:id/decision`
45. `GET /leaders/dashboard/metrics`
46. `GET /audit/logs`
47. `GET /audit/logs/export`
48. `GET /audit/logs/verify-chain`
49. `POST /behavior/events`
50. `GET /behavior/summary`
51. `GET /admin/jobs/retention-status`
52. `POST /admin/jobs/retention-run`
53. `GET /openapi.json`
54. `GET /docs`

## API Test Mapping Table (Updated)

Legend: `TNM` = true no-mock HTTP, `HWM` = HTTP with mocking.

| Endpoint | Covered | Best evidence type | Evidence file(s) |
|---|---|---|---|
| `/health`, `/auth/*` | yes | TNM | `repo/backend/test-integration/auth.int.test.ts` |
| `/rbac/*` (all 5) | yes | TNM | `repo/backend/test-integration/rbac.int.test.ts` |
| `/buying-cycles/active` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/listings` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/pickup-points/:id` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/favorites/toggle` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/admin/pickup-windows` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/orders/quote` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/orders/checkout` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/orders/:id` | yes | TNM | `repo/backend/test-integration/commerceAndOrders.int.test.ts` |
| `/finance/ledger` | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/comments` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/threads/:id/comments` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/threads/resolve` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/comments/:id/flag` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/notifications` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/notifications/:id/read-state` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/comments/:id/visibility` | yes | TNM | `repo/backend/test-integration/discussions.int.test.ts` |
| `/appeals` (GET) | yes | HWM | `repo/backend/test/routes/authorizationMatrix.test.ts` |
| `/appeals` (POST) | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/appeals/:id/files` | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/appeals/:id` | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/appeals/:id/timeline` | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/appeals/:id/files/:fileId/download` | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/appeals/:id/status` | yes | TNM | `repo/backend/test-integration/appeals.int.test.ts` |
| `/finance/commissions` | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/finance/withdrawals/eligibility` | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/finance/withdrawals` | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/finance/reconciliation/export` | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/admin/withdrawal-blacklist` GET/POST/PATCH/DELETE | yes | TNM | `repo/backend/test-integration/finance.int.test.ts` |
| `/leaders/applications` | yes | TNM | `repo/backend/test-integration/leaders.int.test.ts` |
| `/leaders/applications/me` | yes | TNM | `repo/backend/test-integration/leaders.int.test.ts` |
| `/admin/leaders/applications/pending` | yes | TNM | `repo/backend/test-integration/leaders.int.test.ts` |
| `/admin/leaders/applications/:id/decision` | yes | TNM | `repo/backend/test-integration/leaders.int.test.ts` |
| `/leaders/dashboard/metrics` | yes | TNM | `repo/backend/test-integration/leaders.int.test.ts` |
| `/audit/logs` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/audit/logs/export` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/audit/logs/verify-chain` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/behavior/events` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/behavior/summary` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/admin/jobs/retention-status` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/admin/jobs/retention-run` | yes | TNM | `repo/backend/test-integration/behaviorAndAudit.int.test.ts` |
| `/openapi.json`, `/docs` | yes | TNM | `repo/backend/test/contracts/openapiContract.test.ts` |

## API Test Classification

1. **True No-Mock HTTP**
   - `repo/backend/test-integration/auth.int.test.ts`
   - `repo/backend/test-integration/commerceAndOrders.int.test.ts`
   - `repo/backend/test-integration/appeals.int.test.ts`
   - `repo/backend/test-integration/finance.int.test.ts`
   - `repo/backend/test-integration/behaviorAndAudit.int.test.ts`
   - `repo/backend/test-integration/discussions.int.test.ts`
   - `repo/backend/test-integration/leaders.int.test.ts`
   - `repo/backend/test-integration/rbac.int.test.ts`
   - `repo/backend/test/contracts/openapiContract.test.ts`

2. **HTTP with Mocking**
   - existing route/unit HTTP suites under `repo/backend/test/**` (e.g. `authorizationMatrix`, `orderLeaderAuthorization`, `financeRoutes`, `authRoutes`, etc.) still mock service layers.

3. **Non-HTTP**
   - service/repository/middleware unit suites under `repo/backend/test/**` that do not send HTTP requests.

## Mock Detection

- Mocking remains in many `repo/backend/test/**` files (e.g. `vi.mock(...)` in `repo/backend/test/routes/authorizationMatrix.test.ts`, `repo/backend/test/routes/orderLeaderAuthorization.test.ts`).
- In `repo/backend/test-integration/**`, no actual `vi.mock`/`jest.mock`/`sinon.stub` usage was found (grep hit only a comment in `helpers/realApp.ts`).

## Coverage Summary (Updated)

- Total endpoints: **54**
- Endpoints with any HTTP tests: **54**
- Endpoints with true no-mock HTTP tests: **53**
- HTTP coverage: **100.0%**
- True API coverage: **98.1%**

Remaining true-no-mock gap:
- `GET /appeals` has explicit HWM evidence; no direct TNM call found.

## Unit Test Summary

### Backend Unit Tests
- Strong unit coverage remains across services/repositories/middleware/security under `repo/backend/test/**`.
- Still not clearly unit-tested directly: `repo/backend/src/middleware/sessionAuth.ts`, `repo/backend/src/config/env.ts`, `repo/backend/src/utils/logger.ts`, `repo/backend/src/db/migrate.ts`, `repo/backend/src/db/seed.ts`.

### Frontend Unit Tests (STRICT REQUIREMENT)

- Frontend test files are present and expanded.
- Framework/tool evidence:
  - Vitest imports in frontend tests (e.g., `repo/frontend/test/login-page.test.ts`, `repo/frontend/test/apiWrappers.test.ts`).
  - Vue Test Utils `mount` usage across component/page tests.
- Newly added direct test coverage includes previously missing items:
  - `LoginPage.vue` (`repo/frontend/test/login-page.test.ts`)
  - `MemberHomePage.vue` (`repo/frontend/test/member-home.test.ts`)
  - `ReviewerHomePage.vue` (`repo/frontend/test/reviewer-home.test.ts`)
  - `FinanceClerkHomePage.vue` (`repo/frontend/test/finance-clerk-home.test.ts`)
  - `FinanceDashboardPage.vue` (`repo/frontend/test/finance-dashboard.test.ts`)
  - `AuditLogPage.vue` (`repo/frontend/test/audit-log-page.test.ts`)
  - `AdminWithdrawalBlacklistPage.vue` (`repo/frontend/test/admin-withdrawal-blacklist.test.ts`)
  - `AppShell.vue` (`repo/frontend/test/app-shell.test.ts`)
  - API wrappers `authApi/orderApi/leaderApi/appealApi/auditApi/commerceApi/discussionApi` (`repo/frontend/test/apiWrappers.test.ts`)

**Mandatory Verdict: Frontend unit tests: PRESENT**

Cross-layer observation:
- Balance is now strong on both layers. Backend TNM depth improved substantially; frontend unit coverage breadth is now materially improved.

## API Observability Check

- Good: new integration suites include explicit method/path/payload/status/body assertions (e.g., `discussions.int.test.ts`, `leaders.int.test.ts`, `finance.int.test.ts`, `behaviorAndAudit.int.test.ts`).
- Some legacy mocked HTTP tests remain shallow, but no longer dominate the risk profile.

## Tests Check

- `run_tests.sh` remains Docker-based and compliant (`repo/run_tests.sh`).
- Retest execution attempt performed; blocked by transient network timeout during container `npm install` step:
  - frontend Docker build failed with `ETIMEDOUT` fetching npm registry package.
  - This is an infrastructure/network failure, not direct evidence of failing test assertions.

## End-to-End Expectations (Fullstack)

- Fullstack E2E tests still present under `repo/e2e/tests/*.spec.ts`.

## Test Coverage Score (0-100)

**Score: 96 / 100**

## Score Rationale

- + Endpoint HTTP coverage remains complete.
- + True no-mock API coverage increased from partial to near-complete (53/54).
- + New no-mock integration suites close major prior CRITICAL gaps (leaders/discussions/rbac/ledger/verify-chain/behavior-summary/admin-pickup-window).
- + Frontend unit-test coverage now explicitly includes previously missing key pages/layout/api wrappers.
- - One endpoint (`GET /appeals`) still lacks direct TNM evidence.
- - Full runtime proof is temporarily incomplete due external registry timeout during Docker build.

## Key Gaps

- Add one direct TNM test that calls `GET /appeals` in `repo/backend/test-integration/appeals.int.test.ts` (or dedicated file) to close 53/54 -> 54/54 TNM.
- Re-run `./run_tests.sh` after network stabilizes to convert execution status from blocked to verified.

## Confidence and Assumptions

- Confidence: **high** on static classification; **medium-high** on runtime readiness due failed build pull.
- Assumption: no hidden runtime route registration outside inspected files.

---

# README Audit

## README Location
- `repo/README.md` exists.

## Hard Gates

- Formatting/readability: **PASS**.
- Startup instructions (fullstack): includes `docker-compose up` (`repo/README.md:16`).
- Access method: URL + ports documented (`repo/README.md:21-27`).
- Verification method: curl + UI flow documented (`repo/README.md:49-90`).
- Environment rules: Docker-only and no local runtime/manual DB setup explicitly stated (`repo/README.md:7-9`).
- Demo credentials for all roles present (`repo/README.md:91-99`).

## Engineering Quality
- Tech stack clarity: strong.
- Operational/testing workflow: clear and containerized.
- Security/role guidance: explicit.

## High Priority Issues
- None.

## Medium Priority Issues
- None.

## Low Priority Issues
- Mixed `docker-compose` and `docker compose` syntax in examples; non-blocking consistency issue.

## Hard Gate Failures
- None.

## README Verdict
**PASS**
