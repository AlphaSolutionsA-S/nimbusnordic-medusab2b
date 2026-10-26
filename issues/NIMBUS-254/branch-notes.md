# Branch notes: NIMBUS-254

## Task 01
- `syncCompanyFromBusinessCentralWorkflow` (`apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`)
  now takes `{ companyId }` as well as `{ customerId, expectedCompanyId? }`;
  `SyncCompanyFromBusinessCentralInput` is an alias of `PrepareCompanyBcSyncInput` (step file).
- Company path: `query.graph({ entity: "company", fields: ["id", "business_central_customer_number"] })`;
  no row throws `MedusaError` `NOT_FOUND` ("Company with id <id> was not found") before any BC call.
  The route in task 02 can let it propagate; plan section 9 verified it maps to 404.
- Result is still `{ status: "updated" | "skipped" | "failed" }`; a non-`MedusaError` from BC rejects.
- Integration cases for the company path live in `integration-tests/http/customers/company-sync.spec.ts`
  (describe "... - by company id"); its `createCompanyWithoutEmployees` helper is local to that describe.
- Pitfall: a `getCustomer` mock value must be typed `BCCustomer` (`blocked` is a literal union), or
  tsc rejects it.
- Pitfall: `pnpm` is not on PATH in PowerShell here; `corepack pnpm --filter @b2b-starter/backend lint` works from Git Bash.
