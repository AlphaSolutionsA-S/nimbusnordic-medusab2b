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

## Deviations
- Added: the expected-BC-error and unexpected-error cases on the company path also assert that the
  company is unchanged (intent said "nothing changed" only for the expected error).
- Added: the `updated` case also asserts `getCustomer` was called once with the company's own BC
  number, proving the company path reads the BC key from the company row.
- Shape: `SyncCompanyFromBusinessCentralInput` is now an alias of the step's
  `PrepareCompanyBcSyncInput` union, and the workflow passes its input to the step whole (it can no
  longer pick `input.customerId` off a union). Seam contract unchanged.
- Shape: the original `as { id?; business_central_customer_number? }` cast on the customer path's
  company was replaced by a typed parameter of a small `toCompanyBcKey` helper shared by both paths.
- The integration cases were written but not run (plan section 2: no local runnable BC test
  environment); they are unverified until finalization.

## Done-when evidence
- Store routes compile unchanged against the new input type: typecheck 22 errors, identical lines
  to `tsc-baseline.txt` (no diff); `api/store/companies/[id]/route.ts` and
  `api/store/customers/me/company/sync-business-central/route.ts` not modified.
- Lint passes: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in
  touched files).
- Typecheck adds no new errors: 22 vs baseline 22, same error lines.
- Exactly one field mapping: the single `ModuleUpdateCompany` literal in `prepare-company-bc-sync.ts`
  serves both paths; proven at runtime by `company-sync.spec.ts` "by company id" > "updates a company
  with no employees from Business Central" and the existing store case "updates only the approved
  company fields" (both unrun locally).
- Logs carry the company id only: review item; the new path adds no log line, and its not-found
  error text names only the company id (not testable by behaviour, plan security matrix).
- Company path behaviours: `company-sync.spec.ts`, describe "syncCompanyFromBusinessCentralWorkflow -
  by company id": "updates a company with no employees…", "skips without a Business Central call
  when the company has no BC number", "skips when Business Central has no matching customer",
  "reports failed and changes nothing on an expected Business Central error", "rejects on an
  unexpected Business Central error", "rejects an unknown company id as not found without a Business
  Central call". Written, not run locally (plan section 2).
- Existing store and expected-company-guard cases: unchanged in the file; not run locally.
- Also update: `business-central/service.ts` line 598 comment still points at `resolveCurrencyCode`
  in `prepare-company-bc-sync.ts`, which did not move: no change needed.
