# Fix brief 01: invitation spec looks up the employee by a non-existent property

**Issue:** NIMBUS-248 (task 05). Found at finalization.

## Failure

`apps/backend/integration-tests/http/companies/employee-invitation.spec.ts`, case
"invitation email › keeps the employee and answers 200 when sending the email fails", fails with:

```
Trying to query by not existing property Employee.customer_id
  at employee-invitation.spec.ts:390  companies().listEmployees({ customer_id: customerId, company_id: companyId })
```

The employee model has no `customer_id` column; employee and customer are joined by a module link.
All other 34 cases in this spec and `password-recovery.spec.ts` pass.

## Goal

Make the assertion prove what the case intends ("the employee account stays after the email fails")
using the real relationship: for example a `query.graph` on `employee` filtered by company with the
linked `customer.id`, or on `customer` with its linked `employee`, following how existing specs
(`companies.spec.ts`) check an employee for a customer. Change only the test; production code is not
at fault. Do not weaken the assertion (it must still fail if the employee were rolled back).

## How to run

The HTTP specs need a database. A throwaway Postgres is running on `localhost:55433`
(user `admin`, password `S3cret`). From `apps/backend`, with the Bash tool:

```
STORE_CORS=https://shop.example.test DB_HOST=localhost DB_PORT=55433 DB_USERNAME=admin DB_PASSWORD=S3cret \
BUSINESS_CENTRAL_DISCOVERY_URL="https://api.businesscentral.dynamics.com/v2.0/test-tenant/TestDK/api/v2.0" \
npx cross-env TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules \
npx jest --silent=false --runInBand --forceExit integration-tests/http/companies/employee-invitation.spec.ts
```

`STORE_CORS` must be set in the shell: the runner's `env:` option does not reach
`projectConfig.http.storeCors` (pre-existing; the reset spec fails the same way on `develop` without it).

## Done when

The spec passes (17/17), lint and backend typecheck (baseline 22) unchanged.

## Deviations

None. The assertion now reads the customer through `query.graph` (`entity: "customer"`, fields
`employee.id`, `employee.company_id`, filtered by the invited email) and expects one customer whose
linked employee belongs to the company; a rolled-back employee leaves `employee` null and fails it.

## Done-when evidence

- Spec passes 17/17: `integration-tests/http/companies/employee-invitation.spec.ts`, including
  "invitation email › keeps the employee and answers 200 when sending the email fails" (run log in
  the run scratchpad, `fix01-spec.log`).
- Lint unchanged: `pnpm --filter @b2b-starter/backend lint` 0 errors, 13 warnings (pre-existing);
  `integration-tests/` is in the ESLint ignore patterns.
- Typecheck: backend `tsc --noEmit` 22 errors (baseline 22), none in the spec.
- Also update: none found (test-only change).
