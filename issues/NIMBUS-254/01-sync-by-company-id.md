# 01: BC company sync starts from a company id as well as a customer
**App:** backend · **Layer:** L4 workflow, L3 step · **Depends on:** None

**Goal:** `syncCompanyFromBusinessCentralWorkflow` also accepts a company id. The new path shares
the existing BC read, error handling and field mapping, and the customer path stays exactly as it is.
**Files / areas:** `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`,
`apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`,
`apps/backend/integration-tests/http/customers/company-sync.spec.ts`.
**Seam contracts:** workflow input is `{ customerId: string; expectedCompanyId?: string }` or
`{ companyId: string }`. Result `{ status: "updated" | "skipped" | "failed" }` is unchanged. For the
company path, an unknown `companyId` makes the workflow reject with `MedusaError` type `NOT_FOUND`.
**Test intent:** (integration, in a new `describe` in `company-sync.spec.ts` that runs the workflow
with `{ companyId }`, spies on `getCustomer` and restores mocks):
- A company with **no employees** and a BC number gets `updated`. All 12 mapped fields and a newer
  `business_central_synced_at` are written. The Medusa-only fields `order_api_enabled`, `logo_url`,
  `spending_limit_reset_frequency` and the BC number are unchanged.
- No BC number gives `skipped`, `getCustomer` is not called and nothing changes.
- BC returns `null`: `skipped`, last-synced unchanged.
- BC throws `MedusaError`: `failed`, nothing changed. BC throws a plain `Error`: the run rejects.
- Unknown id: rejects with `toMatchObject({ type: "not_found" })` (`medusa-boundary.md`, "Workflow
  failures"), and `getCustomer` is not called.
- The existing cases in the file, store login and the expected-company guard, pass unchanged.
**Done when:** the store routes compile unchanged against the new input type. Lint passes, and
typecheck adds no new errors. There is still exactly one field mapping. Logs carry the company id
only.
**Verify after deploy:** see task 02.
**Also update:** `apps/backend/src/modules/business-central/service.ts` line ~598 comment points at
`resolveCurrencyCode` in the step file: keep it valid if the function moves (it should not need to).
No other test or doc describes the workflow input (searched `syncCompanyFromBusinessCentralWorkflow`,
`prepareCompanyBcSyncStep`).
