# Deviation report: Company admins can add another person's existing account to their company

> Record of NIMBUS-243, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-243`, merge-base `6187799`, commits `4123659` (NIMBUS-252, task 01) and
`222905a` (NIMBUS-253, task 02). Working tree clean.

## Deviations from scope and plan

- Task 01: the unit cases "requires email / password for the new account" passed before the change
  (the old refinement already refused those bodies); kept as regression guards for removing the
  refinement. The red tests were the two `customer_id` cases. Acceptable.
- Task 01: the security-boundaries case first asserts exactly one emailpass identity for the
  companyless customer, then that its `user_metadata.role` is not `company_admin`, so the absence
  check cannot pass vacuously on a wrong filter. Stronger than the plan asked. Acceptable.
- Task 02: none. Storefront lint, test and build need `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`; a
  placeholder was used for those processes (environment, not code).
- Plan section 10 anticipated the integration specs failing with 401 (NIMBUS-236). They did not
  start at all: Jest `globalSetup` refused because `BUSINESS_CENTRAL_DISCOVERY_URL` is missing
  (this checkout has no `apps/backend/.env`, so no database URL either). The dispatcher did not fake
  the BC safety guard. The touched contract cases are **code complete, unverified because the local
  integration environment is not configured** (not because of NIMBUS-236). Not a code failure, but
  it leaves the plan's rule ("record pass or 401") unmet; see open question 1.
- No blocking deviation (no migration, no data-model change).

## Consolidation changes

None. No duplicated helpers or types, no dead exports or redundant tests introduced by the branch.
Validator unit cases (schema layer) and the two contract cases (no write: no employee row, no
invitation, no role marker) test different layers; all kept.

Pre-existing, not touched: the backend `StoreCreateEmployee` type in
`apps/backend/src/types/company/http.ts` has no importers (dead before this branch; task 01 only
removed `customer_id`).

## Findings

Design review against the plan:

- Flows A–C, state table: hold. `POST /store/companies/:id/employees` always runs
  `createEmployeeAccountWorkflow` (`apps/backend/src/api/store/companies/[id]/employees/route.ts`);
  the existing-customer branch and the `createEmployeesWorkflow` import are gone. The Admin route
  (`apps/backend/src/api/admin/companies/[id]/employees/route.ts:53`) and company registration
  still use `createEmployeesWorkflow`, unchanged.
- Security matrix:
  - Property 1 and 2 (no attaching an existing account, no admin marker on it): control is the
    strict `StoreCreateEmployee` schema without `customer_id`
    (`apps/backend/src/api/store/companies/validators.ts:34-48`), trust root Medusa body
    validation as verified in plan section 9. With the existing-customer branch removed, the route
    can reach `setAdminRoleStep` only for the account it just created. Negative tests exist at
    unit and contract level.
  - Property 3 (guard before validation): `ensureCompanyAccess(true)` is registered before
    `validateAndTransformBody(StoreCreateEmployee)` (`apps/backend/src/api/store/companies/middlewares.ts:83-84`),
    so the foreign-company case (which still sends `customer_id`) stays 403. Unchanged test at
    `security-boundaries.spec.ts:201`.
  - Property 4 (no personal data in the error): framework formatting, not tested, as the plan says.
- Framework assumptions: no new reliance beyond plan section 9.
- Business rules: the rule "linking an existing customer is Admin-only" lives in one place (the
  store schema); no second implementation. No `decisions.md` row is needed (it is a route contract,
  not a decision function); the plan recorded that no `ai/` file describes it.
- No design findings.

Mechanical wiring:

- Types: `StoreCreateEmployeeType` now types `email` and `password` as `string`, so the route
  dropped its non-null assertions; no casts added. Imports resolve; no circular dependency.
- Cross-app: the storefront `StoreCreateEmployee` (`apps/storefront/src/types/company/http.ts`)
  matches the store contract; its only user, `createEmployee` in
  `apps/storefront/src/lib/data/companies.ts`, never set `customer_id`. No hard-coded URLs.
- No other caller posts `customer_id` to the store route: the remaining store POSTs in
  `integration-tests/http/companies/companies.spec.ts:570` and
  `security-boundaries.spec.ts:727` send email and password.
- "Also update" search (`customer_id` with employee, "existing customer" in `docs/`, `ai/`,
  integration tests, storefront): only the updated `docs/architecture/store-access.md` paragraph
  and the two updated specs. Nothing stale.
- Whole-branch checks (`verification.md`): no new module; the store route keeps
  `ensure-role.ts`; no new UI text; no new environment variables.
- Comments: no comments added in source; no plan ids.
- Nit (low, optional): `docs/architecture/store-access.md:102` runs past the paragraph's wrap
  width (about 100 characters). Formatting only.

## Tests

- Security-critical path coverage: unit `apps/backend/src/api/store/companies/__tests__/validators.unit.spec.ts`
  ("refuses linking an existing customer alone" / "... with a new account", "requires email /
  password for the new account"); contract `integration-tests/http/companies/employee-invitation.spec.ts`
  ("refuses with 400 when the store tries to link an existing customer": 400, no employee row, no
  invitation); contract `integration-tests/http/security/security-boundaries.spec.ts`
  ("refuses an own-company admin attaching an existing companyless customer as admin": 400, no
  employee row, one emailpass identity, no `company_admin` marker); foreign-company 403 case
  unchanged.
- Lines in `apps/`: tests +36/-2, source +21/-53. No duplicated or redundant tests.
- Finalization results (runs saved in
  `C:\Users\KLAUSP~1\AppData\Local\Temp\claude\c--Users-KlausPetersen-Documents-projects-nimbusnordic-medusab2b\eda8e5a8-2ab6-45bc-bb27-d6b3a5495e4e\scratchpad\NIMBUS-243-20261026-1200`):
  - Backend: `test:unit` 83 suites / 1110 tests passed; lint 0 errors (13 warnings, none in
    touched files); typecheck 22 errors = baseline 22; `build` succeeded.
  - Storefront: `test` 3 failed / 593 passed (`money.test.ts` "convertToLocale falls back to
    en-GB for an unknown locale"; `product-tabs` `index.test.tsx`, two cases), matching the
    documented baseline of 3 failing storefront tests in files this branch does not touch. Lint
    exit 0; typecheck 8 = baseline 8. `build` compiled but failed at "Collecting page data" for
    `/[countryCode]/categories/[...category]` with "fetch failed" (`generateStaticParams` needs a
    reachable Medusa backend; none ran locally): environment.
  - Integration specs `employee-invitation.spec.ts` and `security-boundaries.spec.ts`: did not
    start (`BUSINESS_CENTRAL_DISCOVERY_URL` missing or not an allowed test URL; no
    `apps/backend/.env`). Touched contract cases: code complete, unverified.
  - Architecture check: none listed in `ai/AGENTS.md`.
- Tracker: NIMBUS-243 at Estimation (its only path to In Progress is "Estimate approved", a human
  decision); a comment records implementation start. Sub-tasks NIMBUS-252 and NIMBUS-253 Done with
  closing comments.

What tests verified: the store schema refuses `customer_id` and requires email and password
(unit). Not yet verified: the 400 and the no-write guarantees at HTTP level against a real
database (contract cases did not run), and the deployed behaviour (below).

## Open questions

1. The two touched contract cases have never run. How do they get run before merge?
   Options: (a) configure a local `apps/backend/.env` (database URL, an allowed
   `BUSINESS_CENTRAL_DISCOVERY_URL` test value) and run both specs before push, accepting the
   expected 401 on login (NIMBUS-236) as the plan's rule allows; (b) push with them recorded as
   "code complete, unverified" and rely on the unit test plus the after-deploy check; (c) hold the
   branch until NIMBUS-236 is fixed and the specs can pass.
2. NIMBUS-243 is at Estimation. Transition it ("Estimate approved" → In Progress) before the push,
   or leave the status as is?
3. Fix the wrap-width nit in `docs/architecture/store-access.md:102` in the committer's fix commit,
   or leave it?

Answers (Klaus Petersen, 2026-10-26, relayed by the coordinator):

1. **Answer:** option (b). The two contract cases are recorded as "code complete, unverified
   because the local integration environment is not set up"; the unit tests and the after-deploy
   check carry the verification.
2. **Answer:** transition NIMBUS-243 through "Estimate approved" to In Progress; the estimate is
   accepted.
3. **Answer:** fix the nit.

## Verify after deploy

- 01 Store employee creation accepts only a new account: store `POST /store/companies/<own company id>/employees` with `customer_id` answers 400, and the portal invite card on one test company still creates an employee (new row in `employee`).
- 02 Storefront request type drops `customer_id`: no `Verify after deploy:` line (type-only change; nothing user-visible or stored).
- Plan section 10 (owner Klaus Petersen): check Medusa Cloud logs for unexpected 400s on `POST /store/companies/:id/employees` (a client outside this repository still sending `customer_id`).
