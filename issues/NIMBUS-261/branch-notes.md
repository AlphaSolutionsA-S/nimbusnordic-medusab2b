# Branch notes: NIMBUS-261

## Task 01

- `BusinessCentralEnvironment = "DK" | "NO"` is exported from `modules/business-central/types.ts`. Every `IBusinessCentralModuleService` method except `getOperations` takes it first, e.g. `getCustomer("NO", number)`, `listReturnReasons("NO")`, `getOrder("NO", { customerNumber, orderNumber })`.
- `modules/business-central/environment-config.ts` exports `getBusinessCentralLocalCurrency(environment)` (DK: `BUSINESS_CENTRAL_LCY_CODE` or `DKK`; NO: `BUSINESS_CENTRAL_NO_LCY_CODE` or `NOK`; trimmed, blank falls back) for task 05, plus `getBusinessCentralEndpoint` and `getBusinessCentralCompanyId` used by the service.
- Callers still on `"DK"` that tasks 03 to 05 switch: the five store BC routes (`api/store/bc-orders/route.ts`, `[id]/route.ts`, `return-reasons/route.ts`, `api/store/bc-returns/route.ts`, `[number]/route.ts`), `business-central-return/steps/{prepare,submit}-bc-return.ts`, `company/steps/prepare-company-bc-sync.ts`. Order submission and shipment-notice steps stay `"DK"` (commented).
- Integration specs asserting `getCustomer` arguments now expect `("DK", number)`: `customers/company-sync.spec.ts:457,566`, `companies/companies.spec.ts:919` (task 05 changes them to the routed environment).
- A missing or invalid NO setting throws `MedusaError` `INVALID_DATA` from the NO call only, message `<VARIABLE> <requirement> (Business Central environment NO)`; the configured value never appears in it.
- Pitfall: BC module specs run with `test:integration:modules`, and a bare path pattern also picks up stale compiled copies under `apps/backend/.medusa/server`. Run jest directly from `apps/backend` with `--testPathIgnorePatterns '[\\/]\.medusa[\\/]'` (a plain `.medusa` regex matches the repo folder name `nimbusnordic-medusab2b` and skips every test). `pnpm` is not on PATH here; use `corepack pnpm`.
- Baseline failure, not ours: `service.spec.ts` "listOrders › stops filling from salesInvoices after the round-trip guardrail even if the page stays short" fails before and after task 01.
- `environments.spec.ts` has a fetch router keyed on tenant and company path that later module-level NO tests can reuse.

## Task 02

- Rule: `getBusinessCentralEnvironmentForCountry(country)` in `utils/business-central-environment.ts` (single `=== 'NO'` in the backend; registry row in `decisions.md`). Use it in `transform()` or a step, never re-compare a country.
- Workflow: `resolveBusinessCentralAccountWorkflow` (`workflows/company/workflows/resolve-business-central-account.ts`), input `{ customerId } | { companyId }`, result type `BusinessCentralAccount` `{ companyId, customerNumber, environment, notFound }` (also exported: `BusinessCentralNotFoundRecord`, `ResolveBusinessCentralAccountInput`). Both are re-exported from the company `workflows/index.ts`.
- Step: `loadBusinessCentralAccountCompanyStep` (`steps/load-business-central-account-company.ts`) returns the raw company row or null; field list `ACCOUNT_COMPANY_FIELDS` and row type `BusinessCentralAccountCompanyRow` live there. Task 05: add the three not-found columns to both, then map them to `notFound` in the workflow's transform (currently hard `null`).
- Unknown company id rejects with `type: "not_found"` (`MedusaError.NOT_FOUND` → 404 in a route). Unknown customer id or customer without company → `{ companyId: null, customerNumber: null, environment: "DK", notFound: null }`.
- Probe: `query.graph` rows here are typed as the full generated `Company`, so a wrong row type fails typecheck (verified by temporarily breaking `country`'s type).
- Pitfall: PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; use the file tools for edits.
- Integration cases are in `integration-tests/http/customers/business-central-account.spec.ts` (not run locally).

## Task 03

- The five store BC read routes call `resolveBusinessCentralAccountWorkflow(req.scope).run({ input: { customerId: customer_id } })` (customer id from `req.auth_context.app_metadata`) and pass `account.environment` / `account.customerNumber` to the BC module. Task 04 can copy this shape for `bc-orders/[id]/returns/route.ts`.
- Unit-testing a route that runs the workflow: `jest.mock` the workflow module and `jest.mocked(resolveBusinessCentralAccountWorkflow).mockReturnValue({ run } as never)`, `run` resolving `{ result: account }` (see `api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`).
- Integration pattern for routed BC calls: `integration-tests/http/business-central/store-bc-reads.spec.ts` (company via `POST /store/companies`, then `updateCompanies` sets `country` and number; spy on the resolved BC module; stub unexpected calls with `mockRejectedValue` so nothing reaches BC).
- Verified: `validateAndTransformQuery` passes the whole normalised query to the zod schema (`@medusajs/framework/dist/http/utils/validate-query.js`), so a `.strict()` query validator answers an unknown `environment` param with 400.
