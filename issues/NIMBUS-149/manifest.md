# Implementation Manifest: NIMBUS-149 — Create and Persist the Medusa Order

**Project ID:** NIMBUS-149
**Date:** 2026-09-02
**Ready for Dispatch:** true (conditional — see Dependency Status below)

## Dependency Status

NIMBUS-129 Task 03 (order-creation workflow) is planned but not yet implemented (all NIMBUS-129
tasks are TODO). This story modifies the files that Task 03 plans to create. If NIMBUS-129 is
implemented first, this story modifies the existing files. If not, the two should be implemented
together — this story's requirements are additive to Task 03's.

## Branch

`feature/NIMBUS-149` (from `develop`)

## Scope Note

NIMBUS-129 Task 03 already pulled a minimal slice of NIMBUS-149 into its synchronous workflow
(bare `createOrders` with `currency_code`, `email`, and `metadata` containing `company_id`,
`canonical_order`, `order_ingestion_state`). This story completes the remaining NIMBUS-149
requirements: header field mapping (addresses, phone), BC integration-state metadata,
idempotency verification, and failure-handling verification. See PLAN.md's "What NIMBUS-129
Task 03 already built" and "What NIMBUS-149 adds" for the full reconciliation.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Header field mapping + BC integration-state metadata | `01-header-mapping-bc-integration-state-implementation.md` | backend | NIMBUS-129 Task 03 | TODO |
| 02 | Idempotency verification + failure handling | `02-idempotency-failure-handling-implementation.md` | backend | NIMBUS-129 Task 03 | TODO |
| 03 | Integration tests for header mapping and BC integration-state | `03-integration-tests-implementation.md` | backend | 01 | TODO |

## Cross-Task Wiring Summary

- Task 01 modifies the existing `createOrderAndReferenceStep` from NIMBUS-129 Task 03 to enrich
  the `createOrders` call with address mapping (`shipTo`/`billTo` → inline
  `CreateOrderAddressDTO`), phone mapping (`phoneNumber` → `shipping_address.phone`), and the
  `bc_integration_state` metadata key. The workflow's input/output contract does not change.
- Task 02 is a verification/documentation task — confirms that the existing idempotency check
  (`OrderExternalReference` dedupe row) and compensation function (rollback on failure) from
  NIMBUS-129 Task 03 satisfy NIMBUS-149's requirements. No code changes expected.
- Task 03 extends NIMBUS-129 Task 03's test file with assertions for address mapping, phone
  mapping, BC integration-state metadata, verbatim canonical payload retention, and no
  `OrderLineItem` records.

## Deliverables

- Modified `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`
  (Task 01 — enriched `createOrders` call).
- Modified or new `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`
  (Task 03 — additional test cases).
- No new modules, no DB migrations, no env vars, no `pnpm` installs.

## Environment / Config Changes

- No `medusa-config.ts` changes.
- No new modules, no DB migrations, no env vars.
- No `pnpm` package installs.

## Test Infrastructure

Backend test infrastructure already exists (`apps/backend/jest.config.js`,
`pnpm test:integration:http`). Tests follow the existing `medusaIntegrationTestRunner` pattern
from `apps/backend/integration-tests/http/`.

## BC Integration-State Contract

This story defines the `bc_integration_state` metadata object that NIMBUS-148 and NIMBUS-158
depend on:

```typescript
interface BcIntegrationState {
  bc_order_id: string | null;     // null until NIMBUS-148 sets it
  status: 'pending';              // initial — NIMBUS-148 changes to 'sent' | 'failed'
  timestamp: string;              // ISO timestamp of initialization
  retry_count: 0;                 // initial — NIMBUS-148 increments
}
```

Metadata key: `bc_integration_state` (separate from `canonical_order`, `order_ingestion_state`,
and `company_id`).

## Reconciliation Checklist

Before implementation, the implementor MUST verify:

- [ ] **NIMBUS-129 Task 03 implementation status** — if already implemented, modify existing
      files. If not, implement together with Task 03.
- [ ] **`country` field format** — confirm real submissions use ISO 3166-1 alpha-2 codes
      (e.g. "DK"). The mapping lowercases the value.
- [ ] **`last_name` handling** — confirm the admin UI displays `first_name` alone correctly
      (full name in `first_name`, `last_name` empty/null).
- [ ] **`phoneNumber` placement** — confirm `shipping_address.phone` is the right location for
      the canonical `phoneNumber` field.
- [ ] **`CreateOrderAddressDTO` null handling** — verify whether `last_name` accepts
      `undefined` or requires `null`.
- [ ] **`retrieveOrder` relation names** — verify `shipping_address`, `billing_address`, and
      `items` are the correct relation names for the installed Medusa version.
- [ ] **BC integration-state key name** — this story uses `bc_integration_state`. Verify
      NIMBUS-148 and NIMBUS-158 use the same key name (NIMBUS-158's plan already uses this as its
      placeholder).
