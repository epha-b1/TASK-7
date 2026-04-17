# Delivery Acceptance / Project Architecture Review (w1t7) - v2 Re-check

Date: 2026-04-06  
Inspector Role: Delivery Acceptance / Project Architecture Review

## Verification Execution Notes

- Runtime/test verification executed (non-Docker):
  - `npm -w backend test` -> 31 files / 182 tests passed.
  - `npm -w frontend test` -> 18 files / 72 tests passed.
  - `npm -w backend run build` -> passed.
  - `npm -w frontend run build` -> passed.
- Environment boundary (not treated as defect):
  - README prescribes Docker-only app/test operation (`repo/README.md:3`, `repo/README.md:33`).
  - Per acceptance constraints, Docker runtime was not executed in this audit.

---

## 1) Mandatory Thresholds

### 1.1 Can run and be verified

- Conclusion: **Pass (with runtime boundary)**
- Basis:
  - All four local verification commands pass in this re-check.
  - Docker topology runtime remains unexecuted by explicit boundary.
- Evidence:
  - Backend/frontend test success and build success (command execution logs in this re-check).
  - Docker-only run/test documentation (`repo/README.md:11`, `repo/README.md:38`).

### 1.3 Prompt theme deviation check

- Conclusion: **Pass**
- Basis: implementation remains centered on neighborhood group-buying workflows (cycles, listings, checkout, discussions, appeals, finance, audit, behavior telemetry).
- Evidence:
  - Domain route registration (`repo/backend/src/app.ts:74`, `repo/backend/src/app.ts:83`).
  - Role workflow routing (`repo/frontend/src/router/index.ts:77`, `repo/frontend/src/router/index.ts:167`).

---

## 2) Delivery Completeness

### 2.1 Core prompt requirement coverage

- Conclusion: **Partially Pass**
- Basis: previously identified major blockers are largely fixed; one clarified policy requirement remains not fully aligned.

#### Requirement-by-requirement judgment (v2)

1. Role model and least privilege
   - Conclusion: **Pass**
   - Evidence: discussions routes now require explicit roles and exclude finance clerk (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:139`, `repo/backend/src/features/discussions/routes/discussionRoutes.ts:333`), FE route role matrix aligns (`repo/frontend/src/router/index.ts:81`).

2. Buying cycle lifecycle states and transition control
   - Conclusion: **Pass**
   - Evidence: cycle status extended to `DRAFT/ACTIVE/CLOSED/FULFILLED/ARCHIVED` with `closed_at` migration (`repo/backend/src/db/migrations/0014_buying_cycle_lifecycle.sql:2`, `repo/backend/src/db/migrations/0014_buying_cycle_lifecycle.sql:3`); transition map enforced (`repo/backend/src/features/commerce/repositories/cycleRepository.ts:4`, `repo/backend/src/features/commerce/repositories/cycleRepository.ts:29`).

3. Pickup window rule: fixed 1-hour local-time slots
   - Conclusion: **Fail**
   - Evidence:
     - Schema stores split `window_date/start_time/end_time` without explicit timezone (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:20`, `repo/backend/src/db/migrations/0003_commerce_baseline.sql:21`).
     - Seed still inserts 2-hour windows (`09:00-11:00`, `11:00-13:00`, etc.) (`repo/backend/src/db/seed.ts:126`, `repo/backend/src/db/seed.ts:129`).
   - Impact: clarified rule in `docs/questions.md` states fixed 1-hour local-time windows (`docs/questions.md:15`).

4. Discussions feature set + moderation unhide
   - Conclusion: **Pass**
   - Evidence: unhide endpoint + role gate + service + audit trail implemented (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:331`, `repo/backend/src/features/discussions/services/discussionService.ts:334`, `repo/backend/src/features/discussions/services/discussionService.ts:356`, `repo/backend/src/features/discussions/repositories/discussionRepository.ts:436`).

5. Appeals workflow
   - Conclusion: **Pass**
   - Evidence: transition controls remain enforced (`repo/backend/src/features/appeals/services/appealService.ts:37`, `repo/backend/src/features/appeals/services/appealService.ts:440`).

6. Pricing precedence and traceability
   - Conclusion: **Pass**
   - Evidence: deterministic pricing pipeline remains intact (`repo/backend/src/features/orders/services/pricingEngine.ts:47`, `repo/backend/src/features/orders/services/pricingEngine.ts:108`), trace persisted (`repo/backend/src/features/orders/data/orderRepository.ts:290`).

7. Behavior queue architecture
   - Conclusion: **Pass (with risk note)**
   - Evidence: in-memory buffer + timed/capacity flush + DB queue/dedupe implemented (`repo/backend/src/features/behavior/services/behaviorService.ts:26`, `repo/backend/src/features/behavior/services/behaviorService.ts:47`, `repo/backend/src/features/behavior/services/behaviorService.ts:79`, `repo/backend/src/features/behavior/services/behaviorService.ts:183`).
   - Risk note: accepted events can stay in memory until timer/capacity flush; not immediately durable per request (`repo/backend/src/features/behavior/services/behaviorService.ts:176`, `repo/backend/src/features/behavior/services/behaviorService.ts:260`).

8. Audit/search/export and retention policy
   - Conclusion: **Pass**
   - Evidence: admin-gated search/export/verify-chain endpoints remain present (`repo/backend/src/features/audit/routes/auditRoutes.ts:43`, `repo/backend/src/features/audit/routes/auditRoutes.ts:66`, `repo/backend/src/features/audit/routes/auditRoutes.ts:88`).

9. Password policy and lockout
   - Conclusion: **Pass**
   - Evidence: complexity + lockout still enforced (`repo/backend/src/auth/passwordPolicy.ts:1`, `repo/backend/src/auth/authService.ts:203`, `repo/backend/src/config/env.ts:76`).

### 2.2 Complete deliverable form

- Conclusion: **Pass**
- Evidence: monorepo structure, scripts, docs, migrations, and expanded tests remain complete (`repo/package.json:5`, `repo/README.md:1`).

---

## 3) Engineering and Architecture Quality

### 3.1 Structure/modularization

- Conclusion: **Pass**
- Evidence: coherent route->service->repository pattern across modules (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:136`, `repo/backend/src/features/discussions/services/discussionService.ts:97`, `repo/backend/src/features/discussions/repositories/discussionRepository.ts:348`).

### 3.2 Maintainability/extensibility

- Conclusion: **Pass (with one policy gap)**
- Basis: prior major drift points were closed (RBAC in discussions, cycle lifecycle, unhide workflow, envelope consistency tests).
- Remaining policy gap: pickup-window duration/timezone clarification mismatch.

---

## 4) Engineering Details and Professionalism

### 4.1 Error handling / logging / validation / API contract

- Conclusion: **Pass**
- Evidence:
  - zod validation and structured error mapping across modules (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:41`, `repo/backend/src/features/behavior/routes/behaviorRoutes.ts:36`).
  - Standard response envelope is now covered by targeted tests (`repo/backend/test/routes/envelopeConsistency.test.ts:45`).

### 4.2 Product form vs demo form

- Conclusion: **Pass**
- Evidence: multi-role workflows, audit/behavior background processing, finance controls, and route/service policy tests indicate production-oriented implementation.

---

## 5) Prompt Understanding and Fitness

- Conclusion: **Partially Pass**
- Basis: business intent is implemented; one explicit clarification item is still unmet (1-hour local-time pickup windows).
- Evidence: clarification source (`docs/questions.md:15`), current implementation mismatch (`repo/backend/src/db/seed.ts:126`).

---

## 6) Aesthetics and Interaction (Frontend)

- Conclusion: **Pass**
- Evidence: consistent UI styling and discussion moderation UX including reviewer/admin unhide controls (`repo/frontend/src/components/discussion/ThreadCommentCard.vue:20`, `repo/frontend/src/pages/discussion/DiscussionThreadPage.vue:109`, `repo/frontend/src/api/discussionApi.ts:69`).

---

## 7) Security-Focused Audit (Priority)

### Authentication

- Conclusion: **Pass**
- Evidence: session auth + CSRF origin guard + lockout/policy remain active (`repo/backend/src/middleware/sessionAuth.ts:27`, `repo/backend/src/middleware/csrfOriginGuard.ts:24`, `repo/backend/src/auth/authService.ts:203`).

### Route-level authorization

- Conclusion: **Pass**
- Evidence: previously weak discussion routes now explicitly role-gated (`repo/backend/src/features/discussions/routes/discussionRoutes.ts:164`, `repo/backend/src/features/discussions/routes/discussionRoutes.ts:333`).

### Object-level authorization

- Conclusion: **Pass**
- Evidence: order-thread ownership checks and elevated-role bypass retained (`repo/backend/src/features/discussions/services/discussionService.ts:83`, `repo/backend/src/features/discussions/services/discussionService.ts:87`).

### Data isolation

- Conclusion: **Basic Coverage**
- Evidence: user-scoped notification updates and owner-scoped retrieval constraints remain in repositories (`repo/backend/src/features/discussions/repositories/discussionRepository.ts:462`, `repo/backend/src/features/appeals/repositories/appealRepository.ts:194`).

### Admin/debug protection

- Conclusion: **Pass**
- Evidence: audit and retention job endpoints are admin-only (`repo/backend/src/features/audit/routes/auditRoutes.ts:45`, `repo/backend/src/features/behavior/routes/behaviorRoutes.ts:87`).

---

## Unit / API / Logging Check

- Unit and service tests: **Pass** (182 backend tests, 72 frontend tests).
- API route tests: **Pass** (authorization matrix, envelope consistency, unhide workflow, finance routes, etc.).
- Logging: **Pass (static)** structured logs present and no obvious sensitive credential emission in reviewed paths.

---

## 《Test Coverage Assessment (Static Audit)》

### Coverage Mapping Table (v2)

| Requirement / Risk Point | Test Case (file:line) | Key Assertion | Coverage Judgment | Gap | Minimal Addition Suggestion |
|---|---|---|---|---|---|
| Discussion RBAC + unhide authority | `repo/backend/test/discussions/unhideWorkflow.test.ts:43` | reviewer/admin allowed; member/finance denied 403 | Sufficient | No DB-backed unhide persistence test | Add integration test asserting `comments.is_hidden` flips and audit row exists |
| Cycle lifecycle transitions | `repo/backend/test/commerce/cycleLifecycle.test.ts:18` | valid/invalid transitions + not-found handling | Sufficient | No API-level lifecycle transition route tests | Add route/integration tests if lifecycle endpoint is introduced |
| Checkout blocked for inactive cycle | `repo/backend/test/orders/checkoutService.test.ts:118` | returns `CYCLE_NOT_ACTIVE` | Sufficient | No end-to-end DB seed + expired cycle checkout test | Add integration case against real DB transaction |
| Behavior in-memory buffer semantics | `repo/backend/test/behavior/behaviorBuffer.test.ts:24` | buffered before DB write; flush persists | Basic Coverage | No crash-before-flush durability simulation | Add fault-injection test documenting expected loss boundary |
| API envelope consistency | `repo/backend/test/routes/envelopeConsistency.test.ts:50` | success envelope for audit/behavior endpoints | Sufficient | CSV export intentionally non-envelope | Keep explicit contract test for CSV headers/content-type |
| Frontend unhide visibility UX | `repo/frontend/test/discussion-unhide.test.ts:35` | button visible only for hidden + canUnhide | Sufficient | No full page flow test for successful unhide refresh | Add integration test in `DiscussionThreadPage` with mocked API |
| Pickup window clarification (1-hour local-time) | No explicit test found | N/A | Insufficient | Current seed uses 2-hour windows | Add schema/service validation tests enforcing 1-hour slot constraint |

### Security coverage focus

- Authentication: covered.
- Route authorization: improved and now covered for discussions/unhide.
- Object-level authorization: covered for key order/discussion/appeal paths.
- Data isolation: basic, mostly service/repository assertions; deeper DB integration can be expanded.

### Overall static coverage conclusion

- Verdict: **Partially Pass**
- Basis: major prior coverage gaps were closed; remaining uncovered clarified policy is pickup-window duration/timezone invariants.

---

## Remaining Issues (v2)

1. **[Medium] Pickup window duration/timezone clarification mismatch**
   - Evidence: model/seed do not enforce fixed 1-hour local-time windows (`repo/backend/src/db/migrations/0003_commerce_baseline.sql:20`, `repo/backend/src/db/seed.ts:126`).
   - Minimal fix: add explicit 1-hour constraint at service/repository validation and align seed/test fixtures.

2. **[Low] Behavior buffering durability boundary should be documented explicitly**
   - Evidence: accepted events are buffered then flushed asynchronously (`repo/backend/src/features/behavior/services/behaviorService.ts:176`, `repo/backend/src/features/behavior/services/behaviorService.ts:79`).
   - Minimal fix: document RPO boundary in design/ops notes and optionally trigger immediate micro-flush on successful ingest when latency budget allows.

---

## Final Acceptance Decision (v2)

- Overall decision: **Partially Pass**
- What improved since v1:
  - Discussion RBAC is now strict at route layer.
  - Reviewer/admin unhide workflow is implemented end-to-end with tests.
  - Buying-cycle lifecycle states and transitions are extended and tested.
  - Envelope consistency checks were added and pass.
  - Backend/frontend test suites increased and pass.
- Remaining blocker to full pass:
  - Enforce clarified pickup window invariant (fixed 1-hour local-time slots) in implementation and tests.
