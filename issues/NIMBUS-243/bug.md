# Company admins can add another person's existing account to their company

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-243 (parent epic NIMBUS-206)
- Severity: Major
- Area: Backend, store API `POST /store/companies/:id/employees` (company module, employee workflows)
- Reported by: Klaus Petersen
- Reported at: 2026-10-24

## Summary
A company administrator in the customer portal can add an existing customer account to their own
company without that person's consent, as long as the account does not already belong to a company.
They can even make that person a company administrator. The portal's own "Invite employee" screen
never does this. The administrator has to call the portal's backend directly with the account's
internal ID, so it requires knowing that ID. Once added, the person appears as an employee of a
company they never joined.

## Steps to reproduce
1. Have customer B with an account that belongs to no company (for example, registered but never
   linked to a company). Note B's customer id (`cus_…`).
2. Log in as company admin A of company X.
3. `POST /store/companies/<X id>/employees` with body `{ "customer_id": "<B's id>", "is_admin": true }`.

## Expected
The store route refuses a `customer_id` that is not the caller's own, or does not accept
`customer_id` at all. The storefront never sends it: `createEmployee` in
`apps/storefront/src/lib/data/companies.ts` always sends email and password.

## Actual
B becomes an employee of company X. With `is_admin: true`, `setAdminRoleStep` also sets
`role: company_admin` on B's emailpass identity.

## Environment
- Build / commit: `develop` at c43aabf
- Found by code reading on 2026-10-24 during triage of NIMBUS-242; not yet reproduced against a
  running backend.

## Evidence
Code path (read on 2026-10-24):
- `apps/backend/src/api/store/companies/validators.ts`: `StoreCreateEmployee` accepts an optional
  `customer_id` (any string) and requires either `customer_id` or email + password.
- `apps/backend/src/api/store/companies/[id]/employees/route.ts`: with `customer_id`, runs
  `createEmployeesWorkflow` with `company_id: id` and the caller-supplied `customer_id`. The route
  is admin-only for company `:id` (`ensureCompanyAccess(true)` in
  `apps/backend/src/api/store/companies/middlewares.ts`), but nothing ties `customer_id` to the caller.
- `apps/backend/src/workflows/employee/steps/create-employees.ts`: the only check is that the
  customer has no employee yet ("Customer already belongs to a company"). Customers already in a
  company are therefore protected; customers without one are not.
- `apps/backend/src/workflows/employee/steps/set-admin-role.ts`: grants `company_admin` on the
  target's auth identity when `is_admin` is true.

The Admin route `POST /admin/companies/:id/employees` accepts the same `customer_id`. That is
expected there (Nimbus staff), and it is not part of this bug.

## Analysis
*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
