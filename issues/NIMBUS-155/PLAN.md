# NIMBUS-155: Make BC customer number read-only in storefront

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-155

## Objective
Prevent storefront users from setting *or* editing a company's Business Central customer number — it is set and adjusted only in Admin — while keeping any existing value visible in the storefront and preserving Admin edit access.

## Analysis
- The storefront company edit form in `apps/storefront/src/modules/account/components/company-card/index.tsx` renders `business_central_customer_number` as a writable `Input` (edit grid) and also as read-only `Text` in the collapsed display grid. The form seeds `companyData` from the company response (minus `updated_at`, `created_at`, `employees`, `approval_settings`) and `updateCompany` forwards it to `POST /store/companies/:id`, so the BC number is currently part of the submitted payload.
- The storefront type `StoreUpdateCompany` (`apps/storefront/src/types/company/http.ts`) is `Partial<StoreCreateCompany> & { id }`, so it inherits the BC field.
- The backend Store update validator `StoreUpdateCompany` (`apps/backend/src/api/store/companies/validators.ts`) is `.strict()` and still accepts `business_central_customer_number`. The update middleware (`middlewares.ts`) applies this validator to `POST /store/companies/:id`, so removing the field from the schema makes `.strict()` reject any request that includes it with a 400 — closing the API write boundary, not just the UI.
- The storefront create flow (`companyForm` in `apps/storefront/src/lib/data/customer.ts`) never sends `business_central_customer_number`, so no storefront create-UI change is needed; locking create is a backend-contract change plus removing the field from the storefront write type.
- Integration tests currently assert Store *create* and *update* with the BC field succeed (`TC-1`, `TC-3`, `TC-3a`). These contradict the new read-only contract and must be rewritten to assert rejection plus (for update) an unchanged persisted value. `TC-4`/`TC-5` remain valid. `TC-3a` (leading-zero persistence via Store update) no longer applies at the Store boundary and is removed.
- Admin surfaces (validator, form, route, query-config, details page) are independent and remain unchanged; Admin retains create/update authority over the BC number.

## Execution Plan
1. **Storefront (Task 01):** Remove the editable BC `Input` from the edit grid; present the BC number read-only inside the edit view (matching the account UI) while keeping the existing collapsed-view read-only display. Exclude `business_central_customer_number` from the `companyData` update state so it is never submitted. Remove the BC field from the `StoreCreateCompany` write type (which cascades so `StoreUpdateCompany` no longer carries it). Add a component test.
2. **Backend (Task 02):** Remove `business_central_customer_number` from both the `StoreCreateCompany` and `StoreUpdateCompany` zod validators so `.strict()` rejects it at `POST /store/companies` and `POST /store/companies/:id`. Rewrite `TC-1` (create) and `TC-3` (update) to assert 400; drop obsolete `TC-3a`; keep `TC-2`/`TC-4`/`TC-5`.
3. **Verification (Task 03):** Run storefront and backend lint/build/type-check and the focused test suites.

## Decisions & Trade-offs
- **Read-only is enforced at the Store API boundary, not just the UI.** UI-only removal leaves the identifier writable by any authenticated storefront caller; removing it from the `.strict()` update schema closes that hole.
- **Omit rather than send `null`.** Excluding the field from the update payload avoids clearing a configured value on unrelated saves.
- **Both create and update are locked.** The BC number can only be set/adjusted in Admin, so the Store create *and* update boundaries reject it (requester adjustment).
- **Admin untouched.** All Admin company files remain unchanged; the Store and Admin API contracts stay distinct.

## Verification
- [ ] Storefront edit view shows the BC number as read-only (no editable input) when configured, and remains hidden when not configured.
- [ ] Saving other storefront company fields does not include or change the BC number.
- [ ] `POST /store/companies` and `POST /store/companies/:id` return 400 when the body contains `business_central_customer_number`; the persisted value on update is unchanged.
- [ ] A normal Store company create and update (without the BC field) still succeed.
- [ ] Admin create/update still accept and persist the BC number (contract unchanged; no Admin files modified).
- [ ] `pnpm lint` and `pnpm build` pass; storefront component test and backend companies integration test pass.
