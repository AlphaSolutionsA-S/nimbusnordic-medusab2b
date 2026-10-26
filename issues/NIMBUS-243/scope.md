# Company admins can add another person's existing account to their company

**Date:** 2026-10-26
**Status:** Scoped
**Type:** Bug
**Priority:** Medium (Jira); severity Major in `bug.md`
**Issue:** NIMBUS-243 (parent epic NIMBUS-206)
**Key:** NIMBUS-243
**Case folder:** issues/NIMBUS-243/
**Base Branch:** develop

## Background

In the customer portal a company administrator adds colleagues through "Invite employee": the
portal creates a new account from an email and password and makes it an employee of the company.
The backend call behind that screen also accepts a second form: "link this existing customer
account" by its internal id. Nothing checks that the account belongs to the caller or agreed to
join, so a company administrator who knows another person's account id can make that person an
employee of their company, and even a company administrator, as long as the person belongs to no
company yet. The portal's own screen never uses this form; only Nimbus staff in Medusa Admin need
it, and the Admin version stays.

The only existing safeguard is that an account already in a company cannot be added to a second
one, so the exposure is limited to accounts without a company (for example, registered but never
linked).

Found by code reading on 2026-10-24 (triage of NIMBUS-242); not yet reproduced against a running
backend. The integration-test change below is that reproduction.

## Decision (human, 2026-10-26)

Klaus Petersen: "drop customer_id if that does not break anything". The store route stops accepting
an existing account id; employees are added from the portal only by creating a new account. The
condition was checked (see "Does anything depend on it?" below): nothing does.

## Requirements

### Functional

1. `POST /store/companies/:id/employees` accepts only the new-account form: email and password
   (plus the optional name, phone, spending limit, admin flag and page country it takes today).
2. A request that carries `customer_id` is refused with **400** and changes nothing: no employee row,
   no company link, no customer-group membership, no admin role on any identity, no invitation
   event.
3. The access guard is unchanged and still runs first: a caller who is not an administrator of
   company `:id` gets 403 whatever the body holds (the existing foreign-company case keeps its 403).
4. `POST /admin/companies/:id/employees` keeps accepting `customer_id` (Nimbus staff; out of scope).
5. Company registration (`POST /store/companies`, which makes the caller the first administrator of
   their own new company) is unchanged.

### Non-functional

- No data-model change, no migration, no new dependency.
- Error responses carry no personal data (the validation message names fields, not values).
- The storefront keeps working unchanged at runtime (it never sends `customer_id`).

## Business rules

- Company admin of company X adds an employee from the portal by creating a new account (email +
  password) → allowed; the new customer becomes an employee of X and gets the invitation email.
- Company admin of company X asks the portal to link an existing customer account (any id, own or
  someone else's, with or without the admin flag) → refused, 400, nothing changes.
- Non-admin employee, or admin of another company, calls the same route → refused, 403 (unchanged),
  before the body is read.
- Nimbus staff link an existing customer to a company in Medusa Admin → allowed (unchanged).
- A customer already in a company is never added to a second one (unchanged, all routes).
- Actor recorded: none today for employee creation; this change adds none.

## Data model (draft)

No change. Affected entities, for reference only:

| Entity / field | Meaning | Owner | Written by | Stored / derived | Sensitive | Retention |
|---|---|---|---|---|---|---|
| `employee` (company, customer, is_admin, spending_limit) | membership of a customer in a company | `company` module | store route (new account only, after this change), Admin route, company registration | stored | yes (personal data link) | ? (unchanged) |
| emailpass provider identity `user_metadata.role` | legacy role marker set when `is_admin` | Medusa Auth | `setAdminRoleStep` | stored | no | unchanged; grants no authority (`docs/security-remediation.md`) |
| `employee.invited` event (`customer_id`, `company_id`, `country_code`) | triggers the invitation email | — | `createEmployeeAccountWorkflow` | transient | ids only | n/a |

## Security properties (draft)

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| A company admin cannot attach someone else's existing account to their company | Store body schema has no `customer_id`; the schema is strict, so the field is an unknown key | Request validation (`validateAndTransformBody`, strict zod) | 400, no write |
| A company admin cannot make someone else's account a company admin | Same; the store route only reaches `setAdminRoleStep` for the account it just created | Same | 400, no role change |
| Only an admin of company `:id` reaches the route | `ensureCompanyAccess(true)`, registered before body validation | Server-side employee record of the authenticated customer | 403, body not evaluated |
| No personal data on failure | Validation message names fields only | — | — |

Response chosen for a body that still carries `customer_id`: **400 from strict validation**, not
silently ignored. Reasons: (a) the store schema is already `.strict()` and the contract already
answers 400 to unknown fields (`to`, `company_country` in `employee-invitation.spec.ts`), so
removing the field gives 400 with no special code; (b) silently stripping it would turn a body with
`customer_id` plus email and password into a different action (create a new account) than the
caller asked for; (c) no consumer sends it, so the explicit refusal breaks nobody and makes a
probing attempt visible as a client error. Because the access guard runs first, an outsider still
sees 403, and only an admin of the company sees the 400.

## Does anything depend on it? (the decision's condition)

Checked on `develop` (HEAD 80380a4), 2026-10-26. Result: **no runtime consumer**.

| Where | Finding |
|---|---|
| Storefront | Only caller is `createEmployee` in `apps/storefront/src/lib/data/companies.ts`, called only from `modules/account/components/invite-employee-card/index.tsx`, which always sends email + password, never `customer_id`. The storefront type `StoreCreateEmployee` (`apps/storefront/src/types/company/http.ts`) still declares an optional `customer_id` nobody sets (stale type, no runtime effect). No storefront unit or e2e test uses it. |
| Backend routes and workflows | `createEmployeesWorkflow` is also used by the Admin route (stays) and `register-company.ts` (runs it for the caller's own new company, not via this route); neither calls the store route. No other route, subscriber or job calls `/store/companies/:id/employees`. The backend type `StoreCreateEmployee` in `apps/backend/src/types/company/http.ts` declares `customer_id` and is not imported anywhere (stale). |
| Admin UI | `apps/backend/src/admin/hooks/api/employees.tsx` calls only `/admin/companies/:id/employees`. |
| Order API / Azure Logic App | `apps/backend/src/api/orderapi/**` has no employee code; the Logic App calls `/orderapi/orders` only. |
| Other repo files | No `.http`, Postman, JSON or YAML file references the route (search for `/employees` outside TypeScript finds only `docs/architecture/store-access.md`). |
| Integration tests | `employee-invitation.spec.ts` lines 183-193 assert the current 200 for a store link (must change, see below). `security-boundaries.spec.ts` line 201 sends `customer_id` to a *foreign* company and expects 403; the guard runs before validation (`apps/backend/src/api/store/companies/middlewares.ts`, POST `/store/companies/:id/employees`: `ensureCompanyAccess(true)` then `validateAndTransformBody`), so it stays 403 unchanged. Line 712 (`addColleague`) and `companies.spec.ts` send email + password only. |
| Unit tests | `apps/backend/src/api/store/companies/__tests__/validators.unit.spec.ts` uses email + password only; unaffected, and the natural place for a schema case. |
| Docs | `docs/architecture/store-access.md` line 100: "Linking an existing `customer_id` sends nothing." (reads as if the store route links; needs rewording). `docs/security-remediation.md` says employee management requires the company's admin flag and does not mention store `customer_id` linking (no change needed; optional one-line note). `docs/security-review-handover.md` is context only (do not read/edit). |
| `ai/` files | No Tier 0 row, `decisions.md` row or skill `project.md` mentions store `customer_id` linking. The `medusa-backend` skill already states the general rule (actor id from `req.auth_context`, never the body). |
| Tracker | No other NIMBUS issue (component Customer Portal) depends on it. NIMBUS-162 kept the branch unchanged on purpose, waiting for this issue (its frozen deviation report). |

Unverifiable from the repo: a client outside this repository (script, integration partner) calling
the store route with a customer token and `customer_id`. None is documented; a production log check
for 4xx on this route after deploy would show one (see Dependencies).

## Affected apps

- Backend (`apps/backend`): store validator, store route, tests, docs.
- Storefront (`apps/storefront`): type file only, if the planner removes the stale optional field
  (no runtime change).

## Proposed structure

Bug, one small task (the planner may split tests from code):

1. Store validator: remove `customer_id`; email and password become the only accepted form (the
   refine message stops mentioning `customer_id`; whether to make both fields required in the
   schema is the planner's call).
2. Store route: remove the existing-customer branch and the `createEmployeesWorkflow` import from
   `apps/backend/src/api/store/companies/[id]/employees/route.ts`.
3. Tests:
   - `apps/backend/integration-tests/http/companies/employee-invitation.spec.ts`, "stages no
     invitation when the store links an existing customer" (lines 183-193): retarget, do not delete.
     New intent: the store refuses linking an existing customer with 400, the customer gets no
     employee record, and no invitation is staged (keep `receivedBeforeControl()`); rename the
     test to say so.
   - `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`: add a negative case
     next to line 200: an admin of their own company posts `{ customer_id: <companyless customer>,
     is_admin: true }` → 400, that customer has no employee record and their emailpass identity has
     no `company_admin` role. The foreign-company case at line 201 stays as is.
   - Optionally a unit case in `validators.unit.spec.ts`: a body with `customer_id` fails to parse.
4. Also update: `docs/architecture/store-access.md` (Employee invitation email: linking an existing
   customer is Admin-only); stale `customer_id` in `StoreCreateEmployee` types in
   `apps/backend/src/types/company/http.ts` and `apps/storefront/src/types/company/http.ts`
   (planner decides). Optional note in `docs/security-remediation.md` "API behavior".

## Open questions

None blocking. For the human, informational:

1. Is there any client outside this repository (scripts, partners) that calls the store employee
   route with `customer_id`? Nothing in the repo or tracker shows one; if unknown, the after-deploy
   log check covers it.

## Dependencies

- Local `test:integration:http` fails today with 401 on login in both affected specs (NIMBUS-236;
  `security/security-boundaries` is in the Tier 0 baseline list, `companies/employee-invitation` is
  newer than that list and fails the same way). The planner must state how the new and retargeted cases get verified (fixed login,
  or "code complete, unverified" until NIMBUS-236 lands).
- After deploy: a store `POST /store/companies/<own id>/employees` with `customer_id` answers 400,
  and the invite screen still creates an employee (the real-system result); check Medusa Cloud logs
  for unexpected 400s on this route in the following days.
