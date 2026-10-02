# Implementation Manifest: NIMBUS-158 — Show Business Central Status and Retry in Medusa Admin

**Project ID:** NIMBUS-158
**Date:** 2026-09-02
**Ready for Dispatch:** true

## Dependency Status

NIMBUS-148 and NIMBUS-149 are implemented. Task 01 reconciled their actual metadata contract and
reusable delivery workflow; the dispatch reconciliation section and branch-notes.md record the
current seams. Placeholder skeletons remain historical design context and are superseded by each
task's recorded deviations and the implemented code.

## Branch

`feature/NIMBUS-158` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Admin API routes for BC integration status and submission | `01-admin-bc-integration-api-routes-implementation.md` | backend | NIMBUS-148, NIMBUS-149 | DONE |
| 02 | Admin order-detail widget for BC status and retry | `02-admin-bc-order-status-widget-implementation.md` | backend | 01 | DONE |
| 03 | Integration tests for BC integration admin API | `03-admin-bc-integration-tests-implementation.md` | backend | 01 | DONE |

## Cross-Task Wiring Summary

- Task 01 exports the GET and POST route handlers under
  `/admin/orders/:id/bc-integration` and `/admin/orders/:id/bc-integration/submit`, plus the Zod
  validator `AdminSubmitOrderToBc` and the middleware array
  `adminBcIntegrationMiddlewares`. The middleware aggregator
  (`apps/backend/src/api/admin/middlewares.ts`) is updated to spread the new middlewares.
- Task 02 exports the widget component `BcOrderStatusWidget` (default export, auto-discovered by
  Medusa's admin widget loader) and the hooks `useBcIntegrationStatus` and
  `useSubmitOrderToBc` (imported by the widget). The widget is injected into the
  `order.details.side` zone.
- Task 03 tests Task 01's routes via the HTTP test runner. It does not test the widget's UI.
- Task 02's hooks call Task 01's routes via `sdk.client.fetch()`. The response shape
  (`AdminBcIntegration`) must match the GET route's response.

## Environment / Config Changes

- `apps/backend/src/api/admin/middlewares.ts` — add `...adminBcIntegrationMiddlewares` to the
  aggregated array (Task 01).
- No `medusa-config.ts` changes — admin session auth is applied by default to `/admin/*` routes.
- No new modules, no DB migrations, no env vars.
- No `pnpm` package installs — `@tanstack/react-query`, `react-router-dom`, `@medusajs/ui`,
  `@medusajs/icons`, and `@medusajs/admin-sdk` are already available (used by existing admin
  pages/hooks). The implementor should verify `@tanstack/react-query` is installed before
  writing the hooks file (admin skill's `data-pnpm-install-first` rule).

## Test Infrastructure

Backend test infrastructure already exists (`apps/backend/jest.config.js`,
`pnpm test:integration:http`). Tests follow the existing `medusaIntegrationTestRunner` pattern
from `apps/backend/integration-tests/http/`.

## Reconciliation Checklist

Verified against the implemented contracts, installed Medusa source and local HTTP runtime:

- [x] Metadata key: `business_central_integration`.
- [x] State fields: `status`, `bc_order_id`, `bc_order_number`, `attempt_count`, `initialized_at`, `last_attempt_at`, `sent_at`, `partial`, `failure_reason`, `line_failures`.
- [x] Statuses: `pending`, `sent`, `failed`; untracked Admin status is null. Pending never identifies an active submission.
- [x] Partial failures: `partial` and `line_failures`; Admin projection exposes only `line_number` and known `reason` codes.
- [x] Delivery export: `sendOrderToBusinessCentralWorkflow`, with `store: true` and shared `getSendOrderToBusinessCentralTransactionId`.
- [x] Delivery input: `{ order_id, force_resend?: boolean }`; normal requests preserve the duplicate guard; only explicit true bypasses it.
- [x] Async acceptance: `requestBcSubmissionWorkflow` reserves and emits `order_ingestion.admin_bc_submission_requested`; the existing subscriber handles Admin and automatic events.
- [x] Overlap protection: shared owner reservation, renewed every TTL/3 during processing; finally stops renewal, drains pending renewal and releases by owner. Local HTTP tests exercise deferred delivery and lease expiry.

## 2026-10-01 dispatch reconciliation

NIMBUS-148/149 implementation is present on develop. Actual metadata key: business_central_integration. Fields: status, bc_order_id, bc_order_number, attempt_count, initialized_at, last_attempt_at, sent_at, partial, failure_reason, line_failures. Statuses remain pending/sent/failed; pending is not a concurrency signal. Submission uses sendOrderToBusinessCentralWorkflow with store: true and getSendOrderToBusinessCentralTransactionId, shared with automatic submission. Existing workflow input must gain explicit force_resend while preserving its default duplicate guard. Replace legacy route metadata checks with current workflow-layer design; record deviations in tasks.

## Conventions and commands

Commands run from repo root, separately: pnpm --filter @b2b-starter/backend test:unit -- <path>; pnpm --filter @b2b-starter/backend test:admin -- <path>; pnpm --filter @b2b-starter/backend lint; pnpm --filter @b2b-starter/backend exec tsc --noEmit; pnpm --filter @b2b-starter/backend build; pnpm test:integration:http.
