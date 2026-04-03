# API Specification

## Scope

Base URL (local): `http://localhost:4000`

Interactive API documentation:

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

Authentication uses a signed session cookie:

- Cookie name: `neighborhoodpickup_session`
- Flags: `httpOnly`, `sameSite=lax`, `secure` in production

All JSON responses use UTF-8. Protected endpoints require a valid session.

## Auth

### POST /auth/login

Request body:

```json
{
  "username": "member1",
  "password": "Member#Pass123"
}
```

Response `200` includes user payload and sets session cookie.

Errors:

- `401` invalid credentials
- `423` account lockout window active

### POST /auth/logout

Requires session. Clears cookie and returns `204`.

### GET /auth/me

Returns current user profile and roles when session exists.

## Authorization Model

Role constants:

- `MEMBER`
- `GROUP_LEADER`
- `REVIEWER`
- `FINANCE_CLERK`
- `ADMINISTRATOR`

Route protection is enforced with `requireAuth` + `requireRoles` middleware.

## Commerce

### GET /buying-cycles/active

Returns active buying cycles with paging and sorting.

### GET /listings

Returns listing catalog within an active cycle.

### GET /pickup-points/:id

Returns pickup point details, business hours, and window capacities.

### POST /favorites/toggle

Toggles member favorites for pickup points and leaders.

## Orders

### POST /orders/quote

Computes pricing breakdown and trace details.

### POST /orders/checkout

Validates stock/window capacity and creates order.

Errors include `409 CAPACITY_EXCEEDED` with alternative windows.

### GET /orders/:id

Returns order details with object-level authorization.

### GET /finance/ledger

Role: `FINANCE_CLERK`, `ADMINISTRATOR`

Returns ledger entries for internal settlement tracking.

## Discussions and Notifications

### POST /comments

Creates comment/reply/quote and extracts mentions.

### GET /threads/:id/comments

Query params:

- `page` (default `1`)
- `sort` (`newest` | `oldest` | `most_replies`)

Pagination size is fixed at 20.

### GET /threads/resolve

Resolves or creates a discussion thread for a given context.

Query params:

- `contextType` (`LISTING` | `ORDER`)
- `contextId` (positive integer)

Returns `{ discussionId, contextType, contextId }`.

### POST /comments/:id/flag

Flags content for moderation and hidden-state behavior. Users cannot flag their own comments.

### GET /notifications

Returns local notification center records for the current user.

### PATCH /notifications/:id/read-state

Marks notification read/unread.

## Appeals

### GET /appeals

Paginated list of appeals with role-sensitive visibility.

### POST /appeals

Creates appeal from `HIDDEN_CONTENT_BANNER` or `ORDER_DETAIL` source.

### POST /appeals/:id/files

Uploads local evidence files (PDF/JPG/PNG, max 10MB each, max 5 files).

### GET /appeals/:id

Returns appeal detail and file integrity status.

### GET /appeals/:id/timeline

Returns appeal timeline through intake/investigation/ruling.

### GET /appeals/:id/files/:fileId/download

Downloads an appeal evidence file. Requires access to the parent appeal (submitter or elevated role). Records an audit DOWNLOAD event.

Response: binary file content with appropriate `Content-Type` and `Content-Disposition` headers.

### PATCH /appeals/:id/status

Reviewer/admin status transition endpoint.

## Leaders

### POST /leaders/applications

Submit leader onboarding application with credential fields (government ID last 4 digits, certification, experience).

### GET /leaders/applications/me

Get current user leader application status.

### GET /admin/leaders/applications/pending

Admin view for pending applications including credential details for review.

### POST /admin/leaders/applications/:id/decision

Admin approval/rejection with commission eligibility.

### GET /leaders/dashboard/metrics

Leader performance metrics endpoint showing order volume, fulfillment rate, and member feedback trends.

## Finance

### GET /finance/commissions

Role: `FINANCE_CLERK`, `ADMINISTRATOR`

### GET /finance/withdrawals/eligibility

Role: `GROUP_LEADER`, `FINANCE_CLERK`, `ADMINISTRATOR`

### POST /finance/withdrawals

Role: `GROUP_LEADER`, `FINANCE_CLERK`, `ADMINISTRATOR`

### GET /finance/reconciliation/export

Role: `FINANCE_CLERK`, `ADMINISTRATOR`

Returns CSV stream and writes export audit entry.

### Admin blacklist endpoints

- `GET /admin/withdrawal-blacklist`
- `POST /admin/withdrawal-blacklist`
- `PATCH /admin/withdrawal-blacklist/:id`
- `DELETE /admin/withdrawal-blacklist/:id`

Role: `ADMINISTRATOR`

## Audit and Behavior

### GET /audit/logs

Privileged search endpoint over audit records.

Query params: `actorUserId`, `resourceType`, `resourceId`, `action`, `from`, `to`, `page`, `pageSize`.

### GET /audit/logs/export

Exports filtered audit logs as CSV with the same filter params.

### GET /audit/logs/verify-chain

Verifies tamper-evident hash chain integrity.

### POST /behavior/events

Ingests idempotent behavior events into queue.

### GET /behavior/summary

Role: `ADMINISTRATOR`, `FINANCE_CLERK`

### GET /admin/jobs/retention-status

Role: `ADMINISTRATOR`

### POST /admin/jobs/retention-run

Role: `ADMINISTRATOR`

Automatic background retention can be enabled with `BEHAVIOR_RETENTION_RUN_INTERVAL_MINUTES`.

## Error Contract

All API responses use a consistent envelope:

Success:

```json
{
  "success": true,
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description.",
    "details": []
  }
}
```

- Validation errors return `400` with `details` array.
- Auth errors return `401`/`403`.
- Conflict scenarios return `409`.
- Account lockout returns `423`.
