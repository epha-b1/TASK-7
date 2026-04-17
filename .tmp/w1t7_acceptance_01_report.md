# Delivery Acceptance / Project Architecture Review (w1t7)

Date: 2026-04-06  
Inspector Role: Delivery Acceptance / Project Architecture Review

## Verification Execution Notes

- Runtime/test verification actually executed (non-Docker):
  - `npm -w backend test` -> 27 files / 153 tests passed.
  - `npm -w frontend test` -> 17 files / 69 tests passed.
  - `npm run -w backend build` and `npm run -w frontend build` both succeeded.
- Environment restriction / boundary:
  - Project README documents Docker-only start/test flow (`repo/README.md:3`, `repo/README.md:33`).
  - Per current acceptance instruction, Docker was not started; therefore full end-to-end runtime with MySQL + containers is **not executed in this audit**.
  - This is treated as verification boundary, **not** a defect.

---

## 1) Mandatory Thresholds

### 1.1 Can run and be verified

- Conclusion: **Partially Pass**
- Reason (basis):
  - Startup/test instructions are clear but Docker-only (`repo/README.md:3`, `repo/README.md:33`).
  - Core code quality and executability are strongly supported by successful local tests/builds.
  - Full deployed behavior under documented Docker topology is unconfirmed in this run due explicit no-Docker boundary.
- Evidence:
  - Startup scripts and service description: `repo/README.md:11`, `repo/README.md:17`, `repo/README.md:38`.
  - Backend build script: `repo/backend/package.json:9`.
  - Frontend build script: `repo/frontend/package.json:8`.
- Reproducible verification method:
  - Local (already executed):
    - `npm -w backend test`
    - `npm -w frontend test`
    - `npm run -w backend build`
    - `npm run -w frontend build`
    - Expected: all pass.
  - Full documented runtime (not executed here):
    - `./start_app.sh`
    - Expected: frontend `:8081`, backend `:4000`, db up.

### 1.3 Prompt theme deviation check

- Conclusion: **Pass**
- Reason (basis):
  - The implementation centers on neighborhood group-buying portal domains: roles, buying cycles/listings, checkout capacity, discussions/notifications, appeals, finance, audit, behavior tracking.
- Evidence:
  - Domain route registration: `repo/backend/src/app.ts:74`, `repo/backend/src/app.ts:83`.
  - Frontend role pages and workflows: `repo/frontend/src/router/index.ts:42`, `repo/frontend/src/router/index.ts:167`.
  - Design scope aligns prompt: `docs/design.md:13`, `docs/design.md:18`.
- Reproducible verification method:
  - Review domain modules under `repo/backend/src/features/*` and routed pages under `repo/frontend/src/pages/*`.
  - Expected: strong one-to-one match with prompt business modules.

---

## 2) Delivery Completeness

### 2.1 Core prompt requirement coverage

- Conclusion: **Partially Pass**
- Reason (basis):
  - Most core features are implemented; several prompt/clarification constraints are missing or weakened.

#### Key requirement-by-requirement judgment

1. Role model (5 roles, route guards, least privilege)
   - Conclusion: **Partially Pass**
   - Evidence: RBAC middleware exists (`repo/backend/src/middleware/rbac.ts:13`), roles schema exists (`repo/backend/src/db/migrations/0002_baseline_auth_schema.sql:1`), frontend `meta.roles` exists (`repo/frontend/src/router/index.ts:44`).
   - Gap: discussions routes are auth-only (no role restriction) (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:115`, `repo/backend/src/features/discussions/routes/discussionRoutes.ts:227`).

2. Buying cycle lifecycle states (draft/active/closed/fulfilled/archived)
   - Conclusion: **Fail**
   - Evidence: DB enum only `DRAFT/ACTIVE/CLOSED` (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:45`), active query only checks ACTIVE (`repo/backend/src/features/commerce/repositories/cycleRepository.ts:23`).

3. Pickup windows and capacity conflict alternatives
   - Conclusion: **Partially Pass**
   - Evidence: capacity transaction and conflict alternatives (`repo/backend/src/features/orders/data/orderRepository.ts:252`, `repo/backend/src/features/orders/data/orderRepository.ts:265`, `repo/backend/src/features/orders/data/orderRepository.ts:166`), UI handles alternatives (`repo/frontend/src/pages/CheckoutPage.vue:102`).
   - Gap: clarification-required fixed 1-hour local-time windows not enforced; schema stores date/time without timezone and seed uses 2-hour windows (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:20`, `repo/backend/src/db/seed.ts:126`).

4. Threaded discussions with quotes/@mentions/sort/pagination/collapse flagged
   - Conclusion: **Pass**
   - Evidence: sort mapping and 20-page query (`repo/backend/src/features/discussions/repositories/discussionRepository.ts:9`, `repo/backend/src/features/discussions/repositories/discussionRepository.ts:190`), mentions (`repo/backend/src/features/discussions/services/discussionService.ts:28`, `repo/backend/src/features/discussions/services/discussionService.ts:152`), UI quote/collapse (`repo/frontend/src/components/discussion/ThreadCommentCard.vue:24`, `repo/frontend/src/components/discussion/ThreadCommentCard.vue:15`).

5. Moderation threshold and unhide authority
   - Conclusion: **Fail**
   - Evidence: auto-hide threshold=3 exists (`repo/backend/src/features/discussions/repositories/discussionRepository.ts:15`, `repo/backend/src/features/discussions/repositories/discussionRepository.ts:367`), self-flagging blocked (`repo/backend/src/features/discussions/services/discussionService.ts:281`).
   - Gap: no unhide endpoint/service/permission flow found (route list has no unhide operation: `repo/backend/src/features/discussions/routes/discussionRoutes.ts:198`).

6. Appeals workflow intake->investigation->ruling with reviewer/admin transitions
   - Conclusion: **Pass**
   - Evidence: transition map (`repo/backend/src/features/appeals/services/appealService.ts:37`), role gate for transition (`repo/backend/src/features/appeals/services/appealService.ts:440`), timeline persisted (`repo/backend/src/db/migrations/0007_appeals_workflow.sql:25`).

7. Pricing precedence and traceability
   - Conclusion: **Pass**
   - Evidence: deterministic pipeline order in engine (`repo/backend/src/features/orders/services/pricingEngine.ts:47`, `repo/backend/src/features/orders/services/pricingEngine.ts:62`, `repo/backend/src/features/orders/services/pricingEngine.ts:77`, `repo/backend/src/features/orders/services/pricingEngine.ts:92`, `repo/backend/src/features/orders/services/pricingEngine.ts:108`), trace persisted on order (`repo/backend/src/features/orders/data/orderRepository.ts:290`).

8. Behavior queue (in-memory buffer + durable fallback, dedupe, retention)
   - Conclusion: **Partially Pass**
   - Evidence: dedupe table and queue table (`repo/backend/src/db/migrations/0010_behavior_tracking.sql:1`, `repo/backend/src/db/migrations/0010_behavior_tracking.sql:11`), async processing and retention (`repo/backend/src/features/behavior/services/behaviorService.ts:58`, `repo/backend/src/features/behavior/repositories/behaviorRepository.ts:182`, `repo/backend/src/features/behavior/repositories/behaviorRepository.ts:219`).
   - Gap: no actual in-memory queue buffer with durable fallback; ingestion writes directly to DB queue (`repo/backend/src/features/behavior/services/behaviorService.ts:108`).

9. Audit hash-chain/search/export and retention policy
   - Conclusion: **Pass**
   - Evidence: hash-chain table (`repo/backend/src/db/migrations/0009_audit_hash_chain.sql:1`), chain verification (`repo/backend/src/features/audit/services/auditService.ts:83`), filtered search/export endpoints (`repo/backend/src/features/audit/routes/auditRoutes.ts:43`, `repo/backend/src/features/audit/routes/auditRoutes.ts:66`).

10. Password policy and lockout
    - Conclusion: **Pass**
    - Evidence: complexity regex (`repo/backend/src/auth/passwordPolicy.ts:1`), Argon2id (`repo/backend/src/auth/passwordHash.ts:4`), 5-attempt lockout with 15 minutes (`repo/backend/src/config/env.ts:76`, `repo/backend/src/config/env.ts:77`, `repo/backend/src/auth/authService.ts:203`).

- Reproducible verification method:
  - Run backend/frontend tests listed above and inspect route/service/migration evidence lines.
  - Expected: implemented items pass; gaps reproduce as missing routes/states in code.

### 2.2 Has complete deliverable form (not fragment/demo)

- Conclusion: **Pass**
- Reason (basis):
  - Complete monorepo with backend/frontend, migrations, seeds, docs, scripts, and extensive tests.
- Evidence:
  - Workspace scripts and structure (`repo/package.json:5`, `repo/backend/package.json:7`, `repo/frontend/package.json:6`).
  - Documentation exists (`repo/README.md:1`, `docs/design.md:1`, `docs/api-spec.md:1`).
- Reproducible verification method:
  - Inspect repository root and package scripts; run tests/build.

---

## 3) Engineering and Architecture Quality

### 3.1 Structure/modularization reasonableness

- Conclusion: **Pass**
- Reason (basis):
  - Clear feature-sliced backend (`routes/services/repositories`) and corresponding frontend page/api/store split.
- Evidence:
  - Stated architecture (`docs/design.md:22`, `docs/design.md:26`).
  - Example vertical slice (`repo/backend/src/features/appeals/routes/appealRoutes.ts:120`, `repo/backend/src/features/appeals/services/appealService.ts:198`, `repo/backend/src/features/appeals/repositories/appealRepository.ts:30`).
- Reproducible verification method:
  - Explore `repo/backend/src/features/*` and trace route->service->repo call chain.

### 3.2 Maintainability/extensibility awareness

- Conclusion: **Partially Pass**
- Reason (basis):
  - Strong typed schemas, service layering, and repository boundaries.
  - But some policy constraints are implicit or incomplete (e.g., lifecycle states, unhide moderation, route-role drift), increasing future coupling/risk.
- Evidence:
  - Strong: zod validation in routes (`repo/backend/src/features/finance/routes/financeRoutes.ts:16`), typed role constants (`repo/backend/src/auth/roles.ts:1`).
  - Weak points: lifecycle enum limited (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:45`), missing unhide path (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:198`).
- Reproducible verification method:
  - Compare prompt constraints to explicit code contracts/migrations; identify absent extension points.

---

## 4) Engineering Details and Professionalism

### 4.1 Error handling / logging / validation / interface design

- Conclusion: **Partially Pass**
- Reason (basis):
  - Good request validation and many explicit business errors.
  - Structured logging exists.
  - But response envelope consistency is mixed (some routes bypass standard `sendSuccess/sendError`).
- Evidence:
  - Validation and mapped API errors: `repo/backend/src/features/appeals/routes/appealRoutes.ts:51`, `repo/backend/src/features/orders/routes/orderRoutes.ts:22`.
  - Structured logs: `repo/backend/src/utils/logger.ts:9`.
  - Inconsistent envelope usage: `repo/backend/src/features/audit/routes/auditRoutes.ts:51`, `repo/backend/src/features/behavior/routes/behaviorRoutes.ts:57`.
- Reproducible verification method:
  - Send invalid payloads to routes and compare response body shape across endpoints.
  - Expected: inconsistency visible between `sendSuccess` endpoints and raw `response.json` endpoints.

### 4.2 Real product form vs demo form

- Conclusion: **Pass**
- Reason (basis):
  - Multi-role workflows, persistence, CSV export, file storage/integrity, and broad automated tests indicate product-like form.
- Evidence:
  - File upload and checksum flow (`repo/backend/src/features/appeals/services/appealService.ts:309`, `repo/backend/src/features/appeals/services/appealService.ts:384`).
  - Finance reconciliation export (`repo/backend/src/features/finance/services/financeService.ts:181`).
- Reproducible verification method:
  - Use API routes to create appeals/upload files/export CSV and inspect DB/storage effects.

---

## 5) Prompt Requirement Understanding and Fitness

- Conclusion: **Partially Pass**
- Reason (basis):
  - Overall business goal is captured and largely implemented.
  - Several clarified constraints are not fully honored (cycle states, unhide moderation, in-memory queue requirement, strict role boundary expression).
- Evidence:
  - Clarifications source: `docs/questions.md:8`, `docs/questions.md:23`, `docs/questions.md:38`.
  - Mismatches in implementation cited earlier.
- Reproducible verification method:
  - Perform side-by-side checklist review: `docs/questions.md` vs migrations/services/routes.

---

## 6) Aesthetics and Interaction (Frontend)

- Conclusion: **Pass**
- Reason (basis):
  - Consistent visual system (variables, typography, gradients, cards, hover/focus feedback), responsive breakpoint, and role-aware UI composition.
- Evidence:
  - Design tokens and typography: `repo/frontend/src/styles.css:3`, `repo/frontend/src/styles.css:72`.
  - Interaction states and transitions: `repo/frontend/src/styles.css:181`, `repo/frontend/src/styles.css:253`.
  - Responsive layout: `repo/frontend/src/styles.css:648`.
- Reproducible verification method:
  - Run frontend and verify desktop/mobile rendering, hover/focus/button feedback.

---

## 7) Security-Focused Audit (Priority)

### Authentication entry points

- Conclusion: **Pass**
- Basis: local username/password, Argon2id hash, lockout, httpOnly cookie, CSRF origin check.
- Evidence: `repo/backend/src/routes/authRoutes.ts:21`, `repo/backend/src/auth/passwordHash.ts:4`, `repo/backend/src/auth/authService.ts:33`, `repo/backend/src/middleware/sessionAuth.ts:27`, `repo/backend/src/middleware/csrfOriginGuard.ts:24`.
- Repro steps:
  - Repeat bad logins 5x -> expect lock (`423`) (`repo/backend/src/routes/authRoutes.ts:37`).

### Route-level authorization

- Conclusion: **Partially Pass**
- Basis: many protected routes use `requireRoles`, but discussion routes are only `requireAuth`.
- Evidence: good examples `repo/backend/src/features/finance/routes/financeRoutes.ts:93`; weak examples `repo/backend/src/features/discussions/routes/discussionRoutes.ts:115`, `repo/backend/src/features/discussions/routes/discussionRoutes.ts:198`.
- Repro idea:
  - Authenticate as finance clerk and call listing-discussion endpoints; backend does not reject by role at route layer.

### Object-level authorization (ownership checks)

- Conclusion: **Pass (with boundary)**
- Basis: order details and order-thread/appeal access include ownership/elevated-role checks.
- Evidence: order detail SQL owner gate (`repo/backend/src/features/orders/data/orderRepository.ts:463`), discussion order ownership (`repo/backend/src/features/discussions/services/discussionService.ts:86`), appeal ownership/elevated access (`repo/backend/src/features/appeals/services/appealService.ts:130`, `repo/backend/src/features/appeals/services/appealService.ts:154`).
- Repro idea:
  - Non-owner member requests another order/appeal -> expect 404/403.

### Data isolation / tenant-user separation

- Conclusion: **Basic Coverage**
- Basis: user-scoped notifications and appeals list filtering exist; no multi-tenant model in prompt.
- Evidence: notification update with `user_id` filter (`repo/backend/src/features/discussions/repositories/discussionRepository.ts:446`), appeal list owner filter for non-privileged (`repo/backend/src/features/appeals/repositories/appealRepository.ts:194`).
- Repro idea:
  - Attempt patching other user's notification id -> no rows updated -> 404 route response.

### Admin/debug interface protection

- Conclusion: **Pass**
- Basis: admin endpoints are role-gated.
- Evidence: audit admin-only (`repo/backend/src/features/audit/routes/auditRoutes.ts:46`), blacklist admin-only (`repo/backend/src/features/finance/routes/financeRoutes.ts:218`), retention jobs admin-only (`repo/backend/src/features/behavior/routes/behaviorRoutes.ts:88`).
- Repro idea:
  - Access with MEMBER role -> expect 403.

---

## Unit Tests / API Functional Tests / Logging Categorization

### Unit tests

- Conclusion: **Pass**
- Basis: broad unit coverage for auth, pricing, discussion, appeals, finance, behavior, audit, encryption.
- Evidence: representative test suites in `repo/backend/test/*` and `repo/frontend/test/*`; executed successfully.

### API interface functional tests

- Conclusion: **Basic Coverage**
- Basis: Supertest route tests cover auth, authorization matrices, finance routes, appeal download route.
- Evidence: `repo/backend/test/routes/authorizationMatrix.test.ts:72`, `repo/backend/test/finance/financeRoutes.test.ts:47`, `repo/backend/test/appeals/appealDownloadRoute.test.ts:42`.

### Logging categorization and sensitive leakage

- Conclusion: **Partially Pass**
- Basis: structured level/event logging is present; no obvious password/token logging in core paths; however no dedicated leakage-focused tests.
- Evidence: logger schema `repo/backend/src/utils/logger.ts:1`; auth logs include metadata but not password (`repo/backend/src/auth/authService.ts:35`, `repo/backend/src/auth/authService.ts:97`).
- Boundary: leakage safety is assessed statically; dynamic log scrubbing tests are absent.

---

## Issues (Prioritized)

1. **[High] Route-level least-privilege gap on discussion endpoints**
   - Impact: roles beyond intended policy can call discussion APIs directly if authenticated.
   - Evidence: `repo/backend/src/features/discussions/routes/discussionRoutes.ts:115`, `repo/backend/src/features/discussions/routes/discussionRoutes.ts:227`.
   - Minimal fix: apply `requireRoles(...)` matrix per endpoint and align with frontend `meta.roles`.

2. **[High] Moderation unhide workflow missing**
   - Impact: requirement says reviewer/admin can unhide, but no API/service path exists.
   - Evidence: flag->hide implemented (`repo/backend/src/features/discussions/repositories/discussionRepository.ts:369`), no counterpart route in `repo/backend/src/features/discussions/routes/discussionRoutes.ts:198`.
   - Minimal fix: add `PATCH /comments/:id/visibility` with reviewer/admin role checks and audit log.

3. **[Medium] Buying cycle lifecycle incomplete vs clarified requirement**
   - Impact: cannot represent fulfilled/archived states or `closed_at` lifecycle events.
   - Evidence: enum only 3 states in schema (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:45`).
   - Minimal fix: extend cycle schema and transition service; add migration + tests.

4. **[Medium] Behavior queue implementation does not include documented in-memory buffer fallback**
   - Impact: deviates from clarified architecture; operational behavior differs from expected design.
   - Evidence: ingestion writes directly to DB queue (`repo/backend/src/features/behavior/services/behaviorService.ts:108`).
   - Minimal fix: introduce bounded in-memory buffer with spillover/fallback semantics and explicit configuration.

5. **[Low] API envelope consistency drift across modules**
   - Impact: client contract inconsistency and maintenance overhead.
   - Evidence: raw `response.json` in audit/behavior routes (`repo/backend/src/features/audit/routes/auditRoutes.ts:51`, `repo/backend/src/features/behavior/routes/behaviorRoutes.ts:75`) vs envelope utilities elsewhere (`repo/backend/src/utils/apiResponse.ts:21`).
   - Minimal fix: unify on `sendSuccess/sendError` contract for all routes.

---

## 《Test Coverage Assessment (Static Audit)》

### Test Overview

- Unit tests: present (Vitest) for backend and frontend.
  - Evidence: `repo/backend/package.json:12`, `repo/frontend/package.json:12`.
- API/integration tests: present via Supertest and frontend integration/component tests.
  - Evidence: `repo/backend/test/routes/authorizationMatrix.test.ts:1`, `repo/frontend/test/checkout-page.integration.test.ts:1`.
- README executable commands provided: yes (Docker-centric).
  - Evidence: `repo/README.md:11`, `repo/README.md:38`.

### Coverage Mapping Table

| Requirement / Risk Point | Test Case (file:line) | Key Assertion / Fixture / Mock (file:line) | Coverage Judgment | Gap | Minimal Addition Suggestion |
|---|---|---|---|---|---|
| Auth login + session cookie | `repo/backend/test/auth/authRoutes.test.ts:37` | Cookie set + HttpOnly check `repo/backend/test/auth/authRoutes.test.ts:62` | Sufficient | None major | Add secure-flag assertion under production env mock |
| Password complexity | `repo/backend/test/auth/passwordPolicy.test.ts:4` | missing-uppercase/lowercase/number/symbol checks `repo/backend/test/auth/passwordPolicy.test.ts:13` | Sufficient | No frontend password-set flow coverage | If registration/reset is added, add shared contract tests FE/BE |
| Lockout after 5 failures / 15 min | `repo/backend/test/auth/authService.test.ts:56` | lock response `repo/backend/test/auth/authService.test.ts:83` | Sufficient | No route-level brute-force timing test | Add route test for repeated `/auth/login` attempts |
| Route authorization matrix | `repo/backend/test/routes/authorizationMatrix.test.ts:72` | 401/403 checks for appeals/audit/discussion `repo/backend/test/routes/authorizationMatrix.test.ts:95` | Basic Coverage | Not all modules (e.g., behavior admin routes) | Add behavior route auth tests for `/admin/jobs/*` |
| Object-level auth (order owner) | `repo/backend/test/routes/orderLeaderAuthorization.test.ts:65` | service called with `userId+roles` `repo/backend/test/routes/orderLeaderAuthorization.test.ts:97` | Basic Coverage | No DB-backed integration test for SQL owner predicate | Add integration test with seeded DB: owner vs non-owner order fetch |
| Discussion ORDER access isolation | `repo/backend/test/discussions/discussionService.test.ts:95` | non-owner forbidden assertion `repo/backend/test/discussions/discussionService.test.ts:112` | Sufficient | Listing-thread role matrix not asserted | Add tests for finance/member/reviewer access on LISTING context policy |
| Thread pagination/sort boundary | `repo/backend/test/discussions/discussionRepository.test.ts:21` | LIMIT/OFFSET=20 asserted `repo/backend/test/discussions/discussionRepository.test.ts:35` | Basic Coverage | Sort-mode SQL mapping not separately asserted | Add direct repo tests for newest/oldest/most_replies ordering |
| Capacity conflict and alternative windows | `repo/backend/test/orders/checkoutService.test.ts:13` | conflict payload with alternatives `repo/backend/test/orders/checkoutService.test.ts:64` | Sufficient | No concurrent checkout race integration test | Add transactional race test with same window |
| Pricing precedence and trace | `repo/backend/test/orders/pricingEngine.test.ts:4` | applied rules/tax assertions `repo/backend/test/orders/pricingEngine.test.ts:72` | Sufficient | No golden snapshot for monetary rounding edge cases | Add edge-case tests for caps/rounding and taxable base floor |
| Appeals workflow + file validation | `repo/backend/test/appeals/appealService.test.ts:253` | invalid transition blocked `repo/backend/test/appeals/appealService.test.ts:300` | Sufficient | No unhide moderation tests (feature missing) | Implement unhide feature then add reviewer/admin authorization tests |
| Appeal download auth + headers | `repo/backend/test/appeals/appealDownloadRoute.test.ts:51` | 403 + content headers assertions `repo/backend/test/appeals/appealDownloadRoute.test.ts:107` | Sufficient | Missing checksum-mismatch download behavior test | Add test for integrity warning/block policy if required |
| Finance risk controls (limits/blacklist) | `repo/backend/test/finance/financeService.test.ts:136` | daily/weekly constraint assertions `repo/backend/test/finance/financeService.test.ts:155` | Sufficient | No end-to-end weekly rollover test | Add date-window boundary test around week transitions |
| Audit hash-chain verification | `repo/backend/test/audit/auditService.test.ts:13` | tamper detection assertions `repo/backend/test/audit/auditService.test.ts:100` | Sufficient | No export filtering test at service level | Add service test with actor/time/resource filters |
| Behavior dedupe/retention windows | `repo/backend/test/behavior/behaviorService.test.ts:24` | accepted/duplicates assertion `repo/backend/test/behavior/behaviorService.test.ts:50` | Sufficient | No sustained queue retry/backoff stress test | Add retry/backoff progression tests over multiple failures |
| Frontend role-navigation guards | `repo/frontend/test/router-guards.test.ts:55` | login/forbidden redirection assertions `repo/frontend/test/router-guards.test.ts:71` | Sufficient | Backend-route-role mismatch not enforced cross-layer | Add contract test comparing FE routes to backend RBAC map |
| Frontend checkout conflict UX | `repo/frontend/test/checkout-page.integration.test.ts:77` | alternative window re-quote assertion `repo/frontend/test/checkout-page.integration.test.ts:211` | Sufficient | No empty-window-list fallback UX test | Add test for no alternatives available scenario |

### Security Coverage Audit (mandatory focus)

- Authentication: **Covered well** (login/session/lockout tests present).
- Route authorization: **Basic coverage** (many routes covered, some modules missing full matrix).
- Object-level authorization: **Covered for key paths** (order/thread/appeal ownership checks), but mostly service/mocked tests.
- Data isolation: **Basic coverage** (appeals and notifications scoping), limited DB-backed integration proofs.

### Mock/Stub usage assessment

- Conclusion: **Acceptable / compliant**
- Basis: mocks are used in tests for isolation; production code path does not enable mock payment gateways by default.
- Evidence: finance/appeals/discussion tests mock service/repo layers (e.g., `repo/backend/test/finance/financeRoutes.test.ts:7`, `repo/backend/test/appeals/appealService.test.ts:25`).
- Risk of accidental production mock enablement: not observed in runtime code paths.

### Overall Static Coverage Conclusion

- Verdict: **Partially Pass**
- Boundary:
  - Strong coverage exists for most high-risk flows (auth, RBAC, checkout capacity, appeals transitions, finance limits, audit chain).
  - But tests are not yet sufficient to guarantee catching the majority of cross-layer authorization drift and lifecycle-policy mismatches (e.g., discussion route least-privilege policy, missing moderation unhide workflow, cycle-state completeness).
  - Therefore “tests green” can still coexist with important policy defects.

---

## Final Acceptance Decision

- Overall decision: **Partially Pass**
- Core value is implemented and verifiable through tests/build, with production-like architecture.
- Acceptance blockers to close for full pass:
  1. Enforce strict discussion route role boundaries (backend).
  2. Implement reviewer/admin unhide moderation flow.
  3. Align buying-cycle lifecycle schema/service with clarified full states.
  4. Decide and implement/document actual behavior queue architecture (in-memory + durable fallback vs DB-only) consistently.
