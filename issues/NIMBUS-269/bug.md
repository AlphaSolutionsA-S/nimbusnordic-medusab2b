# Seven local backend HTTP integration tests still fail after NIMBUS-236

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-269 (parent epic
  NIMBUS-206 "bugs"; relates to NIMBUS-236, NIMBUS-207, NIMBUS-243)
- Severity: Major (the security contract suite stays red, so it cannot catch regressions; one group
  may be a company-data exposure in a store response)
- Area: backend (`apps/backend`): store quote routes and their field projection
  (`src/api/store/quotes/query-config.ts`), Admin quote messages, store employee creation; HTTP
  contract specs under `integration-tests/http/`
- Reported by: Klaus Petersen
- Reported at: 2026-11-23T11:41:42Z

## Summary

After the login fix in NIMBUS-236, the backend's automated end-to-end checks can run locally again.
477 of 484 pass. Seven still fail, in four groups: two checks on adding an existing account as an
employee (most likely an outdated assumption in the checks), two checks that a storefront quote
carries only the company's name (the company's internal id comes back as well, which needs a
decision: narrow the response or change the agreed rule), two checks on the shape of a quote
created and read in the storefront, and one check on the Admin replying on a quote, which is
refused. Until these pass, the checks cannot be trusted to catch new faults in quotes, employee
management and company data privacy.

## Steps to reproduce

1. Check out `develop` at `bd34b15` (contains the NIMBUS-236 fixes, merge `1ac2beb`).
2. Start a throwaway Postgres, because Docker did not publish port 5432 for
   `nimbus_postgres_container` on Klaus's machine:
   `docker run -d --name nimbus-269-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 55499:5432 postgres:18-alpine`
   (any free port).
3. In the same shell set `DB_HOST=localhost`, `DB_PORT=55499`, `DB_USERNAME=postgres`,
   `DB_PASSWORD=` (trust auth). `BUSINESS_CENTRAL_DISCOVERY_URL` (and
   `BUSINESS_CENTRAL_NO_DISCOVERY_URL` if set) must target an allowed test environment
   (`integration-tests/global-setup.ts`).
4. From `apps/backend`, run Jest directly with the `test:integration:http` script's arguments and
   `NODE_OPTIONS=--experimental-vm-modules --max-old-space-size=8192` (the default heap ran out of
   memory after 21 of 22 suites on Node 24). pnpm is available as `corepack pnpm`. A scoped run of
   the four spec files below is enough to reproduce.
5. Remove the container afterwards: `docker rm -f nimbus-269-pg`.

## Expected

All 484 tests in `test:integration:http` pass.

## Actual

7 fail, 477 pass (measured 2026-11-23 on develop `8ed38da` + NIMBUS-236, recorded in
`ai/architecture/verification.md`, Baseline). Details in `issues/NIMBUS-236/change-report.md`.

|#|Spec and test|Observed|First reading (unverified)|
|---|---|---|---|
|1a|`companies/employee-invitation.spec.ts` "refuses with 400 when the store tries to link an existing customer"|the test queries `Employee.customer_id`, a property the employee model does not have|test drift: the spec calls `companyService.listEmployees({ customer_id })`; employee and customer are joined by a module link (cf. NIMBUS-248 commit "Check the kept employee through the customer link in spec")|
|1b|`security/security-boundaries.spec.ts` "refuses an own-company admin attaching an existing companyless customer as admin"|same as 1a (spec line ~267)|same as 1a|
|2a, 2b|`security/security-boundaries.spec.ts` "store quote response privacy", `is_admin` true and false|`quote.customer.employee.company` contains `id` as well as `name`|`query-config.ts` selects only `customer.employee.company.name`; Medusa Query may add the relation's `id` itself. Whether `id` is acceptable is a privacy decision: `ai/architecture/decisions.md` row "Company credit/blocked/reset fields...: quotes: name only" and the NIMBUS-207 scope say name only|
|3a|`quotes/quotes.spec.ts` "retains contact, spending, message references…"|deep `objectContaining` response-shape assertion does not match|not investigated; the spec may predate the NIMBUS-237 projection restriction (commit `59accdc`)|
|3b|`quotes/quotes.spec.ts` "POST /store/quotes successfully initiates a quote with a draft order"|same|not investigated|
|4|`admin/quotes/quotes.spec.ts` "POST /admin/quotes/:id/messages successfully creates an admin quote message"|answers 400|not investigated: request body vs route validator|

Groups 1 and 2 are contract cases added by NIMBUS-243 and NIMBUS-207. Both shipped with their
HTTP verification recorded as a gap (no local integration environment then), so this is their
first run.

## Environment

- OS: Windows 11 (Klaus's machine)
- Browser / runtime: Node 24.14, Jest via `@medusajs/test-utils` 2.21.2, Postgres 18 (throwaway
  container)
- Build / commit: develop `bd34b15`
- Tenant / data context: synthetic test data created by the specs in a throwaway database

## Evidence

- `issues/NIMBUS-236/change-report.md` (Tests; Follow-up 2) for the failure list and run method.
- `ai/architecture/verification.md`, Baseline, "Local `test:integration:http`".

## Analysis

Causes found during scoping: [scope.md](./scope.md), Background. Group 4's 400 comes from the
test setup's cart creation (unpublished product), not from the Admin message route.
