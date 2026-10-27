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
