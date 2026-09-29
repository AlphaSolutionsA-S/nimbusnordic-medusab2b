# Implementation Manifest: Send the Medusa order to Business Central

**Project ID:** NIMBUS-148
**Date:** 2026-09-29 (re-plan; supersedes 2026-09-02)
**Ready for Dispatch:** true — re-plan approved by the user on 2026-09-29, with all open questions
resolved (see PLAN.md "Resolved Decisions"). Per user instruction, the implementor has **not** been
started; dispatch waits for the user.

## Branch

`feature/NIMBUS-148` (from `develop`). Renamed from the 2026-09-02 `feature/NIMBUS-148-bc-order-submission`
to match the `feature/<project-id>` convention NIMBUS-149 used; no branch has been created yet.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Extend BC integration-state contract + defensive payload reader | `01-bc-integration-state-contract-implementation.md` | backend | None | DONE |
| 02 | Business Central item lookup (`business-central` module) | `02-bc-item-lookup-implementation.md` | backend | None | DONE |
| 03 | Business Central sales-order creation (`business-central` module) | `03-bc-sales-order-creation-implementation.md` | backend | 02 (same two files — sequence) | DONE |
| 04 | Reusable BC order-submission workflow (`prepare`/`submit`/`record`, currency override) | `04-bc-order-submission-workflow-implementation.md` | backend | 01, 02, 03 | DONE |
| 05 | Trigger subscriber + fail-closed BC test-environment guard | `05-bc-submission-trigger-implementation.md` | backend | 04 | DONE |

Execution order: **01 → 02 → 03 → 04 → 05**. Tasks 02 and 03 both modify
`apps/backend/src/modules/business-central/types.ts` and `service.ts` — never run them in parallel.

## User decisions applied (2026-09-29)

- Do not send `unitPrice` or other BC-owned fields: line discounts, tax code and description, plus
  header `pricesIncludeTax`, discount fields and `salesperson`. Do send `unitOfMeasureCode` and
  `shipmentDate`.
- Send `currencyCode` only as an override, when it differs from the BC customer's currency. The
  customer's currency comes from `getCustomer`, and a blank one means LCY via `resolveCurrencyCode`
  (`d90c26a`).
- Defer `unitPrice` discrepancy flagging to NIMBUS-158.
- Record ambiguous outcomes as `bc_submission_outcome_unknown`. NIMBUS-158 checks BC before any
  retry.
- Keep the `itemNumber`/`custItemNo` fallback.
- A guard-stopped call changes nothing.
- Tests may reach the TEST BC tenant. The fake-credentials guard is dropped and replaced by a
  fail-closed environment allowlist in Jest `globalSetup`. A Sandbox-type check via the Admin Center
  API was verified not possible with the current app registration (`401`, `API.ReadWrite.All`
  only), so it is out of scope.

## Affected apps

- **backend** only.

## Files created

| Path | Task |
|---|---|
| `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` | 01 |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-order-payload.unit.spec.ts` | 01 |
| `apps/backend/src/modules/business-central/__tests__/item-lookup.spec.ts` | 02 |
| `apps/backend/src/modules/business-central/__tests__/sales-order-create.spec.ts` | 03 |
| `apps/backend/src/workflows/business-central-order/utils/resolve-bc-currency-override.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/__tests__/resolve-bc-currency-override.unit.spec.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/prepare-bc-order.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/submit-bc-order.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/record-bc-order-outcome.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/steps/index.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/workflows/send-order-to-business-central.ts` | 04 |
| `apps/backend/src/workflows/business-central-order/workflows/index.ts` | 04 |
| `apps/backend/integration-tests/http/business-central-order/send-order-to-bc.spec.ts` | 04 |
| `apps/backend/src/subscribers/business-central-order-ready.ts` | 05 |
| `apps/backend/src/utils/business-central-test-environment.ts` | 05 |
| `apps/backend/src/utils/__tests__/business-central-test-environment.unit.spec.ts` | 05 |
| `apps/backend/integration-tests/global-setup.ts` | 05 |
| `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts` | 05 |

## Files modified

| Path | Task | Change |
|---|---|---|
| `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` | 01 | Append `BcSubmissionFailureReason`, `parseBcIntegrationState`, `hasBusinessCentralOrder` (+ private helpers). Existing content untouched. |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts` | 01 | Extend import; append TC-2..TC-5 |
| `apps/backend/src/modules/business-central/types.ts` | 02, 03 | 10 exported types appended; 2 interface members |
| `apps/backend/src/modules/business-central/service.ts` | 02, 03 | Extended `import type`; module-level helpers/constants; 4 class methods |
| `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` | 04 | `export` added to `resolveCurrencyCode` (one word) |
| `apps/backend/jest.config.js` | 05 | Add `globalSetup: "./integration-tests/global-setup.ts"` |
| `apps/backend/.env.template` | 05 | Document `BUSINESS_CENTRAL_TEST_ENVIRONMENTS=TestDK` |
| `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts` | 05 | Narrow one racy TC-4 assertion |

**Not modified, deliberately:** `apps/backend/integration-tests/setup.js`,
`createReturnFromSalesOrder` / `listReturnReasons`, `src/workflows/business-central-return/**`,
`src/workflows/order-ingestion/**`, `src/subscribers/order-ingestion-created.ts`,
`src/links/order-company.ts`, `src/workflows/hooks/order-created.ts`, `src/api/orderapi/**`,
`medusa-config.ts`, `apps/storefront/`.

## Env / config changes

- **New, optional, test-only:** `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` (comma-separated, default
  `TestDK`). Integration runs abort unless `BUSINESS_CENTRAL_DISCOVERY_URL` targets one of these
  environments. **CI running `integration:http` / `integration:modules` must set
  `BUSINESS_CENTRAL_DISCOVERY_URL` to an allowed test environment**, because a missing URL is
  refused.
- `.env` must never point at production BC when tests run.
- Runtime reuses `BUSINESS_CENTRAL_DISCOVERY_URL`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_LCY_CODE`. No
  migration.

## Verification commands

| Command | Covers |
|---|---|
| `cd apps/backend && pnpm test:unit` | Task 01 (10), Task 04 CUR-1..5, Task 05 ENV-1..5 |
| `cd apps/backend && pnpm test:integration:modules` | Tasks 02 (10), 03 (13) |
| `cd apps/backend && pnpm test:integration:http` | Tasks 04 (17), 05 (4); existing suites regression |
| `pnpm build` (repo root) | all tasks |
| `pnpm lint` (repo root) | all tasks |

Known pre-existing failures (from NIMBUS-149 PROGRESS.md; report, do not fix): BC
`service.spec.ts` guardrail test; quotes `cartSeeder` 400; security-boundaries hook timeout.

## Cross-story contract

`bc-integration-state.ts` is the single source of truth for the BC integration state. NIMBUS-158
must read it via `parseBcIntegrationState`, switch on `BcSubmissionFailureReason`, and owns the
deferred `unitPrice` discrepancy flag and the check-BC-before-retry step.
