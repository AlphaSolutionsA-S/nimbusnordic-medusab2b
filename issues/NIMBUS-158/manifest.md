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
| 03 | Integration tests for BC integration admin API | `03-admin-bc-integration-tests-implementation.md` | backend | 01 | TODO |

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
  (`BcIntegrationStatus`) must match the GET route's response.

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

Before implementation, the implementor MUST verify and reconcile the following against the
actual implemented code from NIMBUS-148 and NIMBUS-149:

- [ ] **Metadata key name** — the exact `metadata` key for the BC integration state (plan uses
      `bc_integration_state` as placeholder).
- [ ] **Integration-state field names** — `bc_order_id`, `status`, `timestamp`, `retry_count`
      and their types.
- [ ] **Status values** — `pending`, `sent`, `failed` and any in-progress status (e.g.
      `submitting`).
- [ ] **Partial-failure fields** — whether NIMBUS-148 records `partial_submission` and
      `line_failures`, and their exact shape.
- [ ] **Workflow name** — the exact export name of NIMBUS-148's reusable submission workflow.
- [ ] **Workflow input shape** — whether it accepts `{ order_id, force_resend }` or a different
      shape.
- [ ] **Async-trigger mechanism** — whether NIMBUS-148's workflow is called directly or
      triggered via a subscriber event.
- [ ] **In-progress indicator** — what NIMBUS-148 writes to metadata at the start of its
      workflow, for the concurrency guard.

## 2026-10-01 dispatch reconciliation

NIMBUS-148/149 implementation is present on develop. Actual metadata key: business_central_integration. Fields: status, bc_order_id, bc_order_number, attempt_count, initialized_at, last_attempt_at, sent_at, partial, failure_reason, line_failures. Statuses remain pending/sent/failed; pending is not a concurrency signal. Submission uses sendOrderToBusinessCentralWorkflow with store: true and getSendOrderToBusinessCentralTransactionId, shared with automatic submission. Existing workflow input must gain explicit force_resend while preserving its default duplicate guard. Replace legacy route metadata checks with current workflow-layer design; record deviations in tasks.

## Conventions and commands

Commands run from repo root, separately: pnpm --filter @b2b-starter/backend test:unit -- <path>; pnpm --filter @b2b-starter/backend test:admin -- <path>; pnpm --filter @b2b-starter/backend lint; pnpm --filter @b2b-starter/backend exec tsc --noEmit; pnpm --filter @b2b-starter/backend build; pnpm test:integration:http.
