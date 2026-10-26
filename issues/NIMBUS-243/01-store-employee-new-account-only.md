# 01: Store employee creation accepts only a new account
**App:** backend · **Layer:** L6 (validator and route) · **Depends on:** None

**Goal:** `POST /store/companies/:id/employees` accepts only email + password (plus the optional fields it takes today); a body with `customer_id` gets 400 and changes nothing. The access guard (403) still runs first; the Admin route is untouched.
**Files / areas:** `apps/backend/src/api/store/companies/validators.ts` (`StoreCreateEmployee`: drop `customer_id`, email and password required, drop the refine), `apps/backend/src/api/store/companies/[id]/employees/route.ts` (drop the existing-customer branch and the `createEmployeesWorkflow` import), `apps/backend/src/types/company/http.ts` (`StoreCreateEmployee`: drop `customer_id`).
**Seam contracts:** store request body fields: `email`, `password` required; `first_name`, `last_name`, `phone`, `spending_limit`, `is_admin`, `country_code` optional; anything else 400.
**Test intent:**
- Unit (`api/store/companies/__tests__/validators.unit.spec.ts`): a body with `customer_id` does not parse, alone and together with email + password; a body missing email or password does not parse; existing cases stay green.
- Contract, retarget (never delete) `employee-invitation.spec.ts` "stages no invitation when the store links an existing customer": rename to say the store refuses it; assert 400, no employee row for that customer, and `receivedBeforeControl()` is empty.
- Contract, new case in `security/security-boundaries.spec.ts` beside the foreign-company case: own-company admin posts `{ customer_id: <companyless customer>, is_admin: true }` → 400; that customer has no employee row; their emailpass identity's `user_metadata.role` is not `company_admin`.
- The foreign-company case ("denies joining an empty foreign company as its administrator") stays unchanged at 403.
- Integration cases run at finalization; if they fail only with 401 on login, record "code complete, unverified because NIMBUS-236" (plan section 10).
**Done when:** unit test green; lint clean; backend typecheck at or below baseline; no non-null assertion left on email/password in the route; contract cases written.
**Verify after deploy:** store `POST /store/companies/<own company id>/employees` with `customer_id` answers 400, and the portal invite card on one test company still creates an employee (new row in `employee`).
**Also update:** `docs/architecture/store-access.md` "Employee invitation email" (line ~100: linking an existing customer is Admin-only, the store route refuses `customer_id` with 400); `employee-invitation.spec.ts` and `security-boundaries.spec.ts` as above. No `ai/` file or `decisions.md` row describes it (searched).

## Deviations

- The unit cases "a body missing email or password does not parse" already passed before the change (the old refinement refused them); kept as regression guards for the removal of the refinement, not as red tests. The red tests were the two `customer_id` cases.
- The security-boundaries case asserts the companyless customer's emailpass identity exists (one row) before asserting its `user_metadata.role` is not `company_admin`, so the absence check cannot pass vacuously on a wrong filter.

## Done-when evidence

- Unit test green: `apps/backend/src/api/store/companies/__tests__/validators.unit.spec.ts`, "refuses linking an existing customer alone", "... with a new account", "requires email for the new account", "requires password for the new account" (13/13 pass).
- Lint clean: `corepack pnpm --filter @b2b-starter/backend lint` 0 errors, 13 pre-existing warnings, none in touched files.
- Backend typecheck at or below baseline: 22 errors, identical lines to `tsc-backend-baseline.txt` (no diff).
- No non-null assertion on email/password in the route: `apps/backend/src/api/store/companies/[id]/employees/route.ts` passes `body.email` / `body.password` directly (typed `string` by the required schema fields).
- Contract cases written: `integration-tests/http/companies/employee-invitation.spec.ts` "refuses with 400 when the store tries to link an existing customer"; `integration-tests/http/security/security-boundaries.spec.ts` "refuses an own-company admin attaching an existing companyless customer as admin"; "denies joining an empty foreign company as its administrator" unchanged at 403. Not run in this task: finalization (plan section 10, NIMBUS-236).
- Also update `docs/architecture/store-access.md`: "Employee invitation email" paragraph now says linking an existing `customer_id` is Admin-only and the store route refuses it with 400 and requires email and password.
- Also update `apps/backend/src/types/company/http.ts`: `StoreCreateEmployee` lost `customer_id`.
- Also update the two specs: as above.
