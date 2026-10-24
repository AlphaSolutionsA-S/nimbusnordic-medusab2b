# 04: Invitation trigger and store request country
**App:** backend · **Layer:** L4, L6 · **Depends on:** None · **Parent:** NIMBUS-242

**Goal:** Every account created by `createEmployeeAccountWorkflow` stages an `employee.invited` event after success; the store request accepts an optional page country.
**Files / areas:** `workflows/employee/workflows/create-employee-account.ts`; `api/store/companies/validators.ts` (`StoreCreateEmployee`); `api/store/companies/[id]/employees/route.ts` (email+password branch only). Admin route and both `customer_id` branches unchanged (NIMBUS-243 is separate; do not build on that branch).
**Seam contracts:** event name constant `EMPLOYEE_INVITED_EVENT = "employee.invited"` exported from the workflow file; data `{ customer_id: string; company_id: string; country_code: string | null }`, nothing else. Workflow input gains `country_code?: string`. Request field `country_code` optional, `^[a-z]{2}$`, schema stays strict.
**Test intent:** contract (`integration-tests/http/companies/` new `employee-invitation.spec.ts` or extend `companies.spec.ts`):
- store create with `country_code: "se"` → 200, employee created; event data has exactly the three keys with the right values (`TestEventUtils` / event bus spy).
- Admin create → event with `country_code: null`.
- `customer_id` branch (store and Admin) → no `employee.invited`.
- `country_code` `"SE"`, `"../x"`, number → 400; unknown field (`to`, `company_country`) → 400.
- workflow failure (duplicate email) → no event.
**Done when:** tests pass; route bodies stay under the limit with no domain branching added.
**Also update:** `companies.spec.ts` employee-creation cases if they assert the strict body; `security-boundaries.spec.ts` (company-admin guard unchanged; add none unless a case asserts the body); `docs/architecture/store-access.md` if it lists the request fields.
