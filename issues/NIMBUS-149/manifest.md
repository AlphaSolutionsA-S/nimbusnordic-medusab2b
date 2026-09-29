# Implementation Manifest: NIMBUS-149 — Create and Persist the Medusa Order

**Project ID:** NIMBUS-149
**Date:** 2026-09-29 (re-plan; supersedes the 2026-09-02 manifest)
**Ready for Dispatch:** true — re-plan and both open decisions in PLAN.md approved by the user
on 2026-09-29. No upstream blocker remains.

## Dependency Status

- **NIMBUS-129 Task 03 is DONE and on `develop`** (merged from
  `feature/NIMBUS-129-order-ingestion`). The earlier "depends on NIMBUS-129 Task 03" blocker is
  removed. This plan modifies the code that exists on `develop`.
- **NIMBUS-148** (plan pending approval) does not block this story. This story creates the
  integration-state contract file that NIMBUS-148 Task 01 would otherwise create; see
  "Cross-story reconciliation".

## Branch

`feature/NIMBUS-149` (from `develop`)

## Scope Note — what is already built vs. what this plan adds

Already satisfied on `develop` (no work planned): synchronous company match; per-company duplicate
check (sequential case); header-only order via `Modules.ORDER` with no `OrderLineItem` records;
verbatim canonical payload under `metadata.canonical_order`; company association via
`metadata.company_id` + Order↔Company link; `currency_code` and `email` mapped; route returns
real order id / 404 / 422.

Remaining, planned here: rollback-safe step split + DB-level duplicate guard (Task 01); the
Business Central integration-state object (Task 02); address/phone header mapping (Task 03); and
the tests the scope asks for that do not exist yet (no line items, verbatim payload, integration
state, failure path). Details in PLAN.md.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Atomic order-creation steps + DB-level duplicate guard | `01-atomic-order-creation-steps-implementation.md` | backend | None | DONE |
| 02 | Business Central integration-state contract + initialization | `02-bc-integration-state-init-implementation.md` | backend | 01 | DONE |
| 03 | Canonical header field mapping onto native Order columns | `03-header-field-mapping-implementation.md` | backend | 02 | DONE |

Execution order: **01 → 02 → 03**, strictly sequential — all three edit
`create-ingested-order.ts` and `create-order-workflow.spec.ts`.

**Task files replaced from the 2026-09-02 revision:**
`01-header-mapping-bc-integration-state-implementation.md`,
`02-idempotency-failure-handling-implementation.md` and
`03-integration-tests-implementation.md` were deleted. They targeted
`createOrderAndReferenceStep`, which Task 01 now removes, used a superseded integration-state
shape (`bc_integration_state` / `retry_count` / `timestamp`), and concluded that no failure or
idempotency work was needed, which the reconciliation showed to be wrong.

## Cross-Task Wiring Summary

- **Task 01** creates `createIngestedOrderStep` (`steps/create-ingested-order.ts`) and
  `createOrderExternalReferenceStep` (`steps/create-order-external-reference.ts`), recomposes
  `createOrderFromCanonicalPayloadWorkflow` as check → order → `createRemoteLinkStep` → reference,
  deletes `steps/create-order-and-reference.ts`, and adds a unique index + generated migration on
  `order_external_reference(company_id, external_order_number)`. The workflow's exported name,
  input (`{ customer_number, canonicalOrder }`) and output (`OrderDTO`) do not change, so the
  route is untouched.
- **Task 02** creates `src/modules/order-ingestion/bc-integration-state.ts` (exports
  `BC_INTEGRATION_STATE_METADATA_KEY`, `BcIntegrationStatus`, `BcOrderLineFailureReason`,
  `BcOrderLineFailure`, `BcIntegrationState`, `createInitialBcIntegrationState`) and calls it from
  `createIngestedOrderStep`'s metadata.
- **Task 03** creates `src/workflows/order-ingestion/utils/map-canonical-order-header.ts`
  (exports `mapCanonicalOrderHeader`, `CanonicalOrderHeaderColumns`) and spreads it into the same
  `createOrders` call; replaces a stale comment in `enrich-order.ts`.

## Deliverables

| Path | Task | Change |
|---|---|---|
| `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts` | 01, 02, 03 | New, then extended |
| `apps/backend/src/workflows/order-ingestion/steps/create-order-external-reference.ts` | 01 | New |
| `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts` | 01 | Deleted |
| `apps/backend/src/workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts` | 01 | Recomposed |
| `apps/backend/src/modules/order-ingestion/models/order-external-reference.ts` | 01 | Unique index |
| `apps/backend/src/modules/order-ingestion/migrations/Migration<timestamp>.ts` + snapshot | 01 | Generated |
| `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` | 02 | New |
| `apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts` | 03 | New |
| `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts` | 03 | Comment only |
| `apps/backend/src/modules/order-ingestion/__tests__/order-ingestion.spec.ts` | 01 | +1 case |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts` | 02 | New |
| `apps/backend/src/workflows/order-ingestion/__tests__/map-canonical-order-header.unit.spec.ts` | 03 | New |
| `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts` | 01, 02, 03 | +5 cases |
| `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts` | 02 | +1 case |

Not modified: `src/api/orderapi/**`, `src/subscribers/**`, `match-company-and-check-duplicate.ts`,
`update-order-ingestion-state.ts`, `src/workflows/hooks/order-created.ts`,
`canonical-order-schema.ts`, `medusa-config.ts`, anything under `apps/storefront/`.

## Environment / Config Changes

- **One DB migration** (Task 01): unique index on `order_external_reference`. Generate with the
  `db-generate` skill (`npx medusa db:generate orderIngestion`), apply with `db-migrate`. Before
  deploying to any shared environment, check for existing duplicate pairs (query in Task 01).
- No `medusa-config.ts` changes, no env vars, no package installs.

## Test Infrastructure

Exists; no scaffolding. `pnpm test:unit` (Tasks 02, 03), `pnpm test:integration:modules`
(Task 01), `pnpm test:integration:http` (Tasks 01–03). Known flake: the order-ingestion HTTP
suites can hit a 60 s `beforeAll` hook timeout when run together — rerun individually.

## Cross-story reconciliation (must be carried into sibling plans; not edited here)

- **NIMBUS-148 Task 01** plans to *create* `src/modules/order-ingestion/bc-integration-state.ts`.
  After this story lands, that file already exists with NIMBUS-148's exact key, types and
  `createInitialBcIntegrationState`. NIMBUS-148 Task 01 must **append** `BC_INTEGRATION_STATUSES`,
  `BC_ORDER_LINE_FAILURE_REASONS`, `optionalString`, `parseLineFailure`,
  `parseBcIntegrationState` and `hasBusinessCentralOrder`, and append its TC-2..TC-5 to the
  existing `bc-integration-state.unit.spec.ts` (its TC-1 is identical to this story's TC-1 apart
  from the timestamp). Its `bc-order-payload.ts` is unaffected. Its Task 05 blocker (NIMBUS-129
  Task 04) is also already resolved on `develop`.
- **NIMBUS-158** placeholders (`bc_integration_state`, `retry_count`, `timestamp`,
  `partial_submission`) must be reconciled to `business_central_integration`, `attempt_count`,
  `initialized_at`/`last_attempt_at`/`sent_at`, `partial`, `line_failures`, read via NIMBUS-148's
  `parseBcIntegrationState`. Its manifest's reconciliation checklist already requires this.
