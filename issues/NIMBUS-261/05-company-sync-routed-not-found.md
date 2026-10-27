# 05: Company sync routed, NOK, and the not-found record
**App:** backend · **Layer:** L0 model + migration, L3 step, L4 workflow · **Depends on:** 02

**Goal:** The company sync reads the BC customer in the company's environment, resolves a blank currency to that environment's local currency, records "customer not found" and clears it on success, for every trigger.
**Files / areas:** `modules/company/models/company.ts`, `modules/company/migrations/` (generated), `types/company/{module,query,http}.ts`, `workflows/company/steps/prepare-company-bc-sync.ts`, `workflows/company/workflows/sync-company-from-business-central.ts`, `workflows/business-central-order/utils/resolve-bc-currency-override.ts`.
**Seam contracts:**
- Columns: `business_central_not_found_at` `dateTime` nullable; `business_central_not_found_environment` enum `["DK","NO"]` nullable; `business_central_not_found_customer_number` text nullable.
- `PreparedCompanyBcSync` gains an internal `not_found` outcome carrying an update with exactly `id` and the three columns; the `ready` update also sets the three columns to null.
- `SyncCompanyFromBusinessCentralResult.status` stays `"updated" | "skipped" | "failed"`; `not_found` maps to `skipped`.
- `resolveCurrencyCode` takes the environment; `resolveBcCurrencyOverride` passes `"DK"`.
- The task 02 account step selects the three columns for its `notFound` output.
**Test intent:**
- Unit: blank currency → `NOK` for NO, `DKK` for DK, configured overrides respected; a set currency is kept.
- Integration (`company-sync.spec.ts`): country `NO` → `getCustomer("NO", number)`; DK/blank → `"DK"`; BC returns `null` → outcome `skipped`, the three columns set (environment and number match), BC-managed fields and `business_central_synced_at` unchanged; a later found sync clears all three; no customer number → nothing written; BC error → `failed`, an existing record unchanged. One case per trigger input shape (customer, company id).
- Contract (`companies.spec.ts`): Admin sync route still returns `{ status }` with the three values; `GET /store/companies/:id` returns none of the new fields.
**Done when:** the generated migration adds only the three columns (read it), and typecheck shows no new errors.
**Verify after deploy:** `company.business_central_not_found_at`, `_environment`, `_customer_number` for one test company with a deliberately wrong number after an Admin sync; then cleared after correcting the number and syncing.
**Also update:** `integration-tests/http/customers/company-sync.spec.ts:457,566` and `integration-tests/http/companies/companies.spec.ts:919` (`getCustomer` now gets the environment first); `src/workflows/business-central-order/__tests__/resolve-bc-currency-override.unit.spec.ts`; `ai/architecture/decisions.md` row "BC company sync" (outcomes now include the not-found record, environment-dependent LCY); `docs/architecture/business-central-company-sync.md` left to `documentation-writer`.
