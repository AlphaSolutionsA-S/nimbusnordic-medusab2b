# Implementation Manifest: Send the Medusa order to Business Central

**Project ID:** NIMBUS-148
**Date:** 2026-09-02
**Ready for Dispatch:** false — awaiting user approval (see PLAN.md; Task 05 is additionally
blocked on NIMBUS-129 being implemented)

## Branch

`feature/NIMBUS-148-bc-order-submission` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | BC integration-state metadata contract + defensive payload reader | `01-bc-integration-state-contract-implementation.md` | backend | None | TODO |
| 02 | Business Central item lookup (`business-central` module) | `02-bc-item-lookup-implementation.md` | backend | None | TODO |
| 03 | Business Central sales-order creation (`business-central` module) | `03-bc-sales-order-creation-implementation.md` | backend | 02 (same two files — sequence to avoid conflicts) | TODO |
| 04 | Reusable BC order-submission workflow (`prepare`/`submit`/`record`) | `04-bc-order-submission-workflow-implementation.md` | backend | 01, 02, 03 | TODO |
| 05 | Trigger — subscriber wiring from the ingestion pipeline | `05-bc-submission-trigger-implementation.md` | backend | 04 **+ NIMBUS-129 task 04 implemented** | BLOCKED |

Execution order: **01 → 02 → 03 → 04 → 05**.

Tasks 02 and 03 are logically independent but both modify
`apps/backend/src/modules/business-central/types.ts` and `service.ts`, so they must be done in
sequence, not in parallel.

## Affected apps

- **backend** only. The storefront and the Medusa Admin are untouched — status/retry display and
  the manual-retry trigger are NIMBUS-158's scope.

## Files created

| Path | Task |
|---|---|
| `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` | 01 |
| `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` | 01 |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts` | 01 |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-order-payload.unit.spec.ts` | 01 |
| `apps/backend/src/modules/business-central/__tests__/item-lookup.spec.ts` | 02 |
| `apps/backend/src/modules/business-central/__tests__/sales-order-create.spec.ts` | 03 |
| `apps/backend/src/workflows/business-central-order/steps/prepare-bc-order.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/submit-bc-order.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/record-bc-order-outcome.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/index.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/workflows/send-order-to-business-central.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/workflows/index.ts` | 04 |
| `apps/backend/integration-tests/http/business-central-order/send-order-to-bc.spec.ts` | 04 |
| `apps/backend/src/subscribers/business-central-order-ready.ts` | 05 |
| `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts` | 05 |

## Files modified

| Path | Task | Change |
|---|---|---|
| `apps/backend/src/modules/business-central/types.ts` | 02, 03 | 10 new exported types appended; 2 new members on `IBusinessCentralModuleService` |
| `apps/backend/src/modules/business-central/service.ts` | 02, 03 | extended `import type` block; 7 new module-level helpers/types; 4 new class methods |

**Not modified, deliberately:** `createReturnFromSalesOrder` / `listReturnReasons` (NIMBUS-138
stubs), `apps/backend/src/workflows/business-central-return/**`,
`apps/backend/src/workflows/hooks/order-created.ts`, `apps/backend/medusa-config.ts`, and anything
under `apps/storefront/`.

## Env / config changes

**None.** This story reuses the existing `BUSINESS_CENTRAL_DISCOVERY_URL`,
`BUSINESS_CENTRAL_CLIENT_ID`, and `BUSINESS_CENTRAL_CLIENT_SECRET` variables the
`business-central` module already reads. No migration is needed either — the integration state
lives in the existing `Order.metadata` jsonb column, not a new data model.

## Verification commands

| Command | Covers |
|---|---|
| `cd apps/backend && pnpm test:unit` | Task 01 (9 cases) |
| `cd apps/backend && pnpm test:integration:modules` | Tasks 02 (10 cases), 03 (10 cases), plus Task 01's specs incidentally |
| `cd apps/backend && pnpm test:integration:http` | Tasks 04 (10 cases), 05 (4 cases) |
| `pnpm build` (repo root) | all tasks |
| `pnpm lint` (repo root) | all tasks |

## Cross-story contract this plan defines (must be adopted elsewhere)

`apps/backend/src/modules/order-ingestion/bc-integration-state.ts` is the authoritative shape of
the BC integration-state metadata object. **NIMBUS-149 must import
`createInitialBcIntegrationState` and `BC_INTEGRATION_STATE_METADATA_KEY` from it rather than
inventing its own field names**, and **NIMBUS-158 must read the state via
`parseBcIntegrationState`**. See PLAN.md's risk section.
