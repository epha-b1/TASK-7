# Delivery Acceptance / Project Architecture Review (w1t7) - v3 Re-check

Date: 2026-04-06
Inspector Role: Delivery Acceptance / Project Architecture Review

## Verification Execution Notes

- Runtime/test verification executed (non-Docker):
  - `npm -w backend test` -> 32 files / 196 tests passed.
  - `npm -w frontend test` -> 18 files / 72 tests passed.
  - `npm run -w backend build` -> passed (tsc clean).
  - `npm run -w frontend build` -> passed (vue-tsc + vite).
- Environment boundary (not treated as defect):
  - README prescribes Docker-only app/test operation (`repo/README.md:3`, `repo/README.md:33`).
  - Per acceptance constraints, Docker runtime was not executed in this audit.

---

## 1) Mandatory Thresholds

### 1.1 Can run and be verified

- Conclusion: **Pass (with runtime boundary)**
- Basis: all four local verification commands pass. Docker topology runtime remains unexecuted by explicit boundary.
- Evidence: command execution logs in this re-check.

### 1.3 Prompt theme deviation check

- Conclusion: **Pass**
- Basis: implementation centers on neighborhood group-buying workflows.
- Evidence: domain route registration (`repo/backend/src/app.ts:74`), role workflow routing (`repo/frontend/src/router/index.ts:77`).

---

## 2) Delivery Completeness

### 2.1 Core prompt requirement coverage

- Conclusion: **Pass**
- Basis: all previously identified blockers and partial-pass items are now closed.

#### Requirement-by-requirement judgment (v3)

1. Role model and least privilege
   - Conclusion: **Pass**
   - Evidence: discussion routes require explicit roles excluding FINANCE_CLERK (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:139`); unhide restricted to REVIEWER/ADMINISTRATOR (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:333`).

2. Buying cycle lifecycle states
   - Conclusion: **Pass**
   - Evidence: 5-state enum with closed_at (`repo/backend/src/db/migrations/0014_buying_cycle_lifecycle.sql:2`); transition map enforced (`repo/backend/src/features/commerce/repositories/cycleRepository.ts:4`).

3. Pickup window rule: fixed 1-hour local-time slots
   - Conclusion: **Pass**
   - Evidence — enforcement at three layers:
     - **DB constraint**: `CHECK (TIMEDIFF(end_time, start_time) = '01:00:00')` (`repo/backend/src/db/migrations/0015_pickup_window_duration_check.sql:4`).
     - **Runtime validation**: `createPickupWindow` repository function calls `assertValidPickupWindowDuration` before INSERT (`repo/backend/src/features/commerce/repositories/pickupPointRepository.ts:244`).
     - **Admin route**: `POST /admin/pickup-windows` restricted to ADMINISTRATOR; service delegates to `createPickupWindow` which validates duration (`repo/backend/src/features/commerce/routes/commerceRoutes.ts:178`).
     - **Seed validation**: `ensurePickupWindows` calls `assertValidPickupWindowDuration` for each window before bulk INSERT (`repo/backend/src/db/seed.ts:131`).
     - Seed data uses 1-hour windows (`repo/backend/src/db/seed.ts:134`: `09:00-10:00`, `10:00-11:00`, `09:00-10:00`, `13:00-14:00`).
     - Contract documented in design doc (`docs/design.md:126`).
     - 10 unit tests: 8 validator tests + 2 `createPickupWindow` repo tests (`repo/backend/test/commerce/pickupWindowDuration.test.ts`).
     - 3 route-level tests: admin creation success, non-admin rejected, invalid duration 400 (`repo/backend/test/routes/authorizationMatrix.test.ts:370`).
   - Timezone semantics: schema stores local DATE + TIME without offset; documented as pickup-point-local convention (`docs/design.md:126`).

4. Discussions feature set + moderation unhide
   - Conclusion: **Pass**
   - Evidence: unhide endpoint + role gate + service + audit trail (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:331`, `repo/backend/src/features/discussions/services/discussionService.ts:334`).

5. Appeals workflow
   - Conclusion: **Pass**
   - Evidence: transition controls enforced (`repo/backend/src/features/appeals/services/appealService.ts:37`).

6. Pricing precedence and traceability
   - Conclusion: **Pass**
   - Evidence: deterministic pipeline (`repo/backend/src/features/orders/services/pricingEngine.ts:47`), trace persisted (`repo/backend/src/features/orders/data/orderRepository.ts:290`).

7. Behavior queue architecture
   - Conclusion: **Pass**
   - Evidence:
     - In-memory buffer with prompt micro-flush after each ingest (`repo/backend/src/features/behavior/services/behaviorService.ts:233`).
     - Timer and capacity flush as safety net (`repo/backend/src/features/behavior/services/behaviorService.ts:75`, `repo/backend/src/features/behavior/services/behaviorService.ts:176`).
     - Durability/RPO boundary explicitly documented (`docs/design.md:111`).
     - Test verifies prompt flush drains buffer within one event-loop tick (`repo/backend/test/behavior/behaviorBuffer.test.ts:44`).

8. Audit/search/export and retention policy
   - Conclusion: **Pass**
   - Evidence: admin-gated endpoints (`repo/backend/src/features/audit/routes/auditRoutes.ts:43`); envelope-consistent responses (`repo/backend/src/features/audit/routes/auditRoutes.ts:52`).

9. Password policy and lockout
   - Conclusion: **Pass**
   - Evidence: complexity + lockout enforced (`repo/backend/src/auth/passwordPolicy.ts:1`, `repo/backend/src/auth/authService.ts:203`).

### 2.2 Complete deliverable form

- Conclusion: **Pass**
- Evidence: monorepo with backend/frontend, migrations, seeds, docs, tests, scripts (`repo/package.json:5`, `repo/README.md:1`).

---

## 3) Engineering and Architecture Quality

### 3.1 Structure/modularization

- Conclusion: **Pass**
- Evidence: coherent route→service→repository pattern (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:136`, `repo/backend/src/features/discussions/services/discussionService.ts:97`).

### 3.2 Maintainability/extensibility

- Conclusion: **Pass**
- Basis: prior policy gaps (RBAC discussions, cycle lifecycle, unhide, pickup windows, envelope consistency) are all closed.

---

## 4) Engineering Details and Professionalism

### 4.1 Error handling / logging / validation / API contract

- Conclusion: **Pass**
- Evidence:
  - Zod validation and structured error mapping across all modules.
  - Standard response envelope used everywhere including audit and behavior routes.
  - Pickup window duration validated with explicit error code `INVALID_PICKUP_WINDOW_DURATION`.

### 4.2 Product form vs demo form

- Conclusion: **Pass**
- Evidence: multi-role workflows, audit/behavior background processing, finance controls, moderation unhide, and comprehensive route/service policy tests.

---

## 5) Prompt Understanding and Fitness

- Conclusion: **Pass**
- Basis: all clarified requirements from `docs/questions.md` are now implemented and tested, including 1-hour local-time pickup windows and full buying-cycle lifecycle.

---

## 6) Aesthetics and Interaction (Frontend)

- Conclusion: **Pass**
- Evidence: consistent UI styling with discussion moderation UX including reviewer/admin unhide controls (`repo/frontend/src/components/discussion/ThreadCommentCard.vue:20`).

---

## 7) Security-Focused Audit (Priority)

### Authentication
- Conclusion: **Pass**
- Evidence: session auth + CSRF origin guard + lockout/policy active.

### Route-level authorization
- Conclusion: **Pass**
- Evidence: all discussion routes role-gated; unhide restricted to REVIEWER/ADMINISTRATOR.

### Object-level authorization
- Conclusion: **Pass**
- Evidence: order-thread ownership checks and elevated-role bypass retained in services.

### Data isolation
- Conclusion: **Basic Coverage**
- Evidence: user-scoped notifications and owner-scoped retrieval constraints in repositories.

### Admin/debug protection
- Conclusion: **Pass**
- Evidence: audit and retention job endpoints are admin-only.

---

## Unit / API / Logging Check

- Unit and service tests: **Pass** (196 backend tests, 72 frontend tests).
- API route tests: **Pass** (authorization matrix, envelope consistency, unhide workflow, finance routes, etc.).
- Logging: **Pass (static)** structured logs present; no sensitive credential emission in reviewed paths.

---

## 《Test Coverage Assessment (Static Audit)》

### Coverage Mapping Table (v3)

| Requirement / Risk Point | Test Case (file:line) | Key Assertion | Coverage Judgment | Gap |
|---|---|---|---|---|
| Discussion RBAC + unhide authority | `repo/backend/test/discussions/unhideWorkflow.test.ts:43` | reviewer/admin allowed; member/finance denied 403 | Sufficient | None |
| Discussion FINANCE_CLERK exclusion | `repo/backend/test/routes/authorizationMatrix.test.ts:268` | FINANCE_CLERK rejected 403 on threads, comments, notifications | Sufficient | None |
| Cycle lifecycle transitions | `repo/backend/test/commerce/cycleLifecycle.test.ts:18` | valid/invalid transitions + not-found handling | Sufficient | None |
| Checkout blocked for inactive cycle | `repo/backend/test/orders/checkoutService.test.ts:118` | returns `CYCLE_NOT_ACTIVE` | Sufficient | None |
| Pickup window 1-hour duration (validator) | `repo/backend/test/commerce/pickupWindowDuration.test.ts:4` | 8 tests: valid 1h accepted, 2h/30m/90m/0/negative rejected | Sufficient | None |
| Pickup window 1-hour duration (repo) | `repo/backend/test/commerce/pickupWindowDuration.test.ts:56` | createPickupWindow calls validator before INSERT; 2h window rejected without DB call | Sufficient | None |
| Pickup window admin route enforcement | `repo/backend/test/routes/authorizationMatrix.test.ts:370` | admin 201 for valid, non-admin 403, invalid duration 400 | Sufficient | None |
| Pickup window DB CHECK constraint | `repo/backend/src/db/migrations/0015_pickup_window_duration_check.sql:4` | Belt-and-suspenders CHECK(TIMEDIFF = 01:00:00) | Sufficient | None |
| Behavior in-memory buffer | `repo/backend/test/behavior/behaviorBuffer.test.ts:24` | buffered before DB write; dedup in buffer; flush persists | Sufficient | None |
| Behavior prompt micro-flush | `repo/backend/test/behavior/behaviorBuffer.test.ts:44` | buffer drains within one event-loop tick after ingest | Sufficient | None |
| Behavior durability documented | `docs/design.md:111` | RPO boundary, flush conditions, config vars documented | Sufficient | None |
| API envelope consistency | `repo/backend/test/routes/envelopeConsistency.test.ts:50` | success envelope for audit/behavior endpoints | Sufficient | None |
| Frontend unhide visibility UX | `repo/frontend/test/discussion-unhide.test.ts:35` | button visible only for hidden + canUnhide | Sufficient | None |
| Seed data 1-hour windows | `repo/backend/src/db/seed.ts:126` | all seed windows are 09-10, 10-11, 09-10, 13-14 | Sufficient | None |
| Test fixture alignment | checkout/capacity tests use 1h windows | `repo/backend/test/orders/checkoutService.test.ts:39`, `repo/backend/test/commerce/capacityService.test.ts:20` | Sufficient | None |

### Security coverage focus

- Authentication: covered.
- Route authorization: improved and now fully covered for discussions/unhide.
- Object-level authorization: covered for key order/discussion/appeal paths.
- Data isolation: basic, mostly service/repository assertions.

### Overall static coverage conclusion

- Verdict: **Pass**
- Basis: all previously identified coverage gaps are closed. Pickup window duration invariant, behavior buffer durability, and all prior items are now test-backed and documented.

---

## Remaining Issues (v3)

None blocking.

---

## Final Acceptance Decision (v3)

- Overall decision: **FULL PASS**
- What improved since v2:
  - Pickup window 1-hour enforcement at three layers: DB CHECK constraint (`0015_pickup_window_duration_check.sql`), runtime `assertValidPickupWindowDuration` called in `createPickupWindow` repository + seed, and admin route `POST /admin/pickup-windows` gated to ADMINISTRATOR.
  - 10 validator tests + 2 repository tests + 3 route-level tests for pickup window enforcement.
  - Seed data fixed to 1-hour windows; all test fixtures aligned.
  - Behavior buffer durability resolved: prompt micro-flush after every successful ingest, RPO boundary documented in `docs/design.md`, test proving drain-on-next-tick.
- No remaining blockers.
