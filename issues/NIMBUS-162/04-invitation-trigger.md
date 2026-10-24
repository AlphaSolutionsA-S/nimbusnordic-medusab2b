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

## Deviations

- Added a runnable unit spec for the request schema (`src/api/store/companies/__tests__/validators.unit.spec.ts`): the HTTP spec cannot run locally (no Postgres), so the 400 cases also have evidence that ran. Extra cases: three-letter, empty and `null` country.
- Added two HTTP cases the intent did not name: store create without `country_code` gives `country_code: null`, and a three-letter country gives 400.
- "No event" cases use a control invitation (an Admin create) and assert nothing arrived before it, instead of a timed wait: released events reach listeners in emission order.
- The duplicate-email failure happens in `registerCustomerIdentityStep`, before the event is staged; the staged-then-cleared path (failure after staging) is not exercised, because `emitEventStep` is the last step (verified framework behaviour, plan section 9).
- `limit-route-body`: the store `POST` body was already over 40 lines before this task (two `customer_id`/account branches, NIMBUS-243 forbids touching them); this task adds one line (`country_code: body.country_code`) and no branching. Pre-existing finding, not fixed here.
- Also added `country_code?: string` to the backend mirror type `StoreCreateEmployee` in `src/types/company/http.ts` (unused by code; keeps the declared request shape accurate).
- Exported a type `EmployeeInvitedEventData` beside `EMPLOYEE_INVITED_EVENT` for task 05's subscriber; the data shape is exactly the seam contract.

## Done-when evidence

- Store create with `country_code: "se"` → 200, one event with exactly `{customer_id, company_id, country_code: "se"}`: `integration-tests/http/companies/employee-invitation.spec.ts` "stages one invitation with the page country after a store create" (written and typechecked, NOT run: no local Postgres).
- Admin create → `country_code: null`: same spec, "stages an Admin invitation with a null country" (not run).
- `customer_id` branch store and Admin → no event: same spec, "stages no invitation when the store links an existing customer" / "... when Admin links an existing customer" (not run). Route branches unchanged (diff adds one line inside the account branch only).
- `"SE"`, `"../x"`, number, `to`, `company_country` → 400: same spec, "rejects a %s with 400 and creates nothing" (not run); schema also proven by `src/api/store/companies/__tests__/validators.unit.spec.ts` (9 passed; the accept case fails without the schema change).
- Duplicate email → no event: same spec, "stages no invitation when the account creation fails on a duplicate email" (not run).
- Route bodies under the limit with no domain branching added: no `if` added (store route +1 line); the store POST body was already over 40 lines, see Deviations. Admin route unchanged.
- Also update `companies.spec.ts`: no employee-creation case asserts the strict body; no change.
- Also update `security-boundaries.spec.ts`: employee-create cases assert the company-admin guard only, not the body; no change.
- Also update `docs/architecture/store-access.md`: does not list the employee request fields; no change.
