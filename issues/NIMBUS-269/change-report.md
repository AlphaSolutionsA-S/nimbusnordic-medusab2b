# NIMBUS-269: Seven local backend HTTP integration tests still fail after NIMBUS-236

**Mode:** bug · **App:** backend (`apps/backend`), tests only · **Branch:** `feature/NIMBUS-269`

## Summary

Once NIMBUS-236 made the backend HTTP suites runnable locally, 7 of 484 tests still failed. On
2026-11-23 the four spec files gave 7 failed and 117 passed. All four causes were in the tests, with
no production fault:

1. The employee-creation refusal cases looked employees up by `customer_id`, which the employee
   model doesn't have (employee and customer are joined by a module link).
2. The store quote privacy and detail cases expected related records without the `id` that Medusa
   Query adds.
3. A store quote create case expected `summary.difference_sum`, which no longer exists in Medusa 2.21.2.
4. The Admin quote message spec never published its product, so the setup's `POST /store/carts`
   answered 400 before the message route was reached.

The tests now assert the agreed behaviour, and every one of the 489 tests in the suite passes
(the count went from 484 to 489 because of NIMBUS-261 contract cases merged meanwhile). No
production code changed.

Root cause detail:
- Employee lookup: `companyService.listEmployees({ customer_id })` threw "Trying to query by not
  existing property Employee.customer_id" after the 400 had already been asserted. NIMBUS-248
  fixed the same lookup in another case (`16472ca`).
- Related-record ids: `@medusajs/query` 2.21.2 `injectJoinKeys` adds the join keys of a
  cross-module relation to the fields it fetches.
- Why the failures weren't caught earlier: groups 1 and 2 shipped (NIMBUS-243, NIMBUS-207) while
  no local HTTP environment ran, and their verification was recorded as a gap. Groups 3 and 4
  drifted with the Medusa upgrade and the starter code. No CI runs these suites.

## Business rules

- Store quote response, any employee role, then company: carries `name` and the company's `id`.
  This changes the "name only" rule of NIMBUS-207; Klaus Petersen decided on 2026-11-23 (scope Q1 A).
  Administrator-only company fields, colleagues and author contact fields are never returned,
  whatever `fields` the caller sends (unchanged).
- Store quote response, message author: carries `first_name`, `last_name` and the author's `id`
  (changed as above). The message keeps `admin_id` and `customer_id` (unchanged).
- Unchanged: when a store request tries to create an employee with an existing customer's id, the
  answer is 400 and no employee is linked. When an Admin posts a quote message, it is stored with
  that Admin as author, the given item and no customer.

## Security

|Property|Control|Negative test|
|---|---|---|
|No administrator-only company field, colleague data or author contact data via a store quote|Server-side field allowlist `api/store/quotes/query-config.ts` (unchanged)|`security/security-boundaries.spec.ts` "store quote response privacy" covers both roles, all seven routes, and default, additive-malicious and explicit-malicious `fields`. Related records are compared exactly, so any extra field fails the test.|
|Related-record ids are only the caller's own company and the message's own authors|Same allowlist|Same cases pin `id` to the own company id, the staff user id and the quote customer id. A different id fails the test.|
|Existing account can't be linked as an employee from the store|Store route validation (unchanged)|`employee-invitation` and `security-boundaries` refusal cases: 400, then the customer is read through Query and has no linked employee|

## Decisions

- The employee-link check reads the customer by `id` through Query (`customer.employee`). The
  NIMBUS-248 precedent filtered by email; filtering by id makes the same check with fewer moving
  parts. The relation path is proven to resolve by the precedent case in the same spec, which
  reads a populated `employee` through it, so the absence assertion can't pass on a wrong path.
- The Admin quote message case does more than the task asked:
  - Its setup now checks that the product publish (200, `published`) and the quote creation (200)
    succeeded, since an unchecked setup is what hid this failure.
  - The case pins `admin_id` to the real Admin user id; before, it accepted any string.
  - It reads the stored message back through the quote module (`listMessages`).
- The product is published with its sales channel in one `POST /admin/products/:id` call, as
  `quotes/quotes.spec.ts` does, because `productSeeder` ignores its `data` argument.
- Group 3a: with the ids pinned, nothing else in the quote responses differed. The Admin message
  route passed once its setup worked. Neither stop condition triggered.

## Tests

- Reproduction: the seven named cases failed on `e3d18bc` (four files, 7 failed and 117 passed) and
  pass now (124 of 124).
- `companies/employee-invitation.spec.ts` "refuses with 400 when the store tries to link an
  existing customer" and `security/security-boundaries.spec.ts` "refuses an own-company admin
  attaching an existing companyless customer as admin": each asserts the 400, finds the customer,
  and finds no linked employee.
- `security/security-boundaries.spec.ts` "store quote response privacy" (`is_admin` false and
  true): every route and `fields` variant. Company is exactly `{ id, name }`, authors are exactly
  `{ id, first_name, last_name }`, and every forbidden-field check is kept.
- `quotes/quotes.spec.ts` "retains contact, spending, message references and numeric quote detail
  and preview data": the related-record ids are pinned exactly. "POST /store/quotes successfully
  initiates a quote with a draft order": only `difference_sum` was dropped, and the other summary
  fields are still asserted.
- `admin/quotes/quotes.spec.ts` "POST /admin/quotes/:id/messages successfully creates an admin quote
  message": 200, and both the response and the stored message have `admin_id` equal to the Admin
  user, the given item, and `customer_id: null`.
- Full runs, 2026-11-23, against a throwaway `postgres:18-alpine` with the `.env` discovery URL on
  `TestDK`:

  |Suite|Passed|Failed|Notes|
  |---|---|---|---|
  |`test:integration:http` (22 suites)|489|0|before: 477 passed, 7 failed of 484|
  |`test:unit`|1202|0||
  |`test:admin`|96|0||
  |`test:integration:modules`|624|2|both failures are the known baseline BC `listOrders` guardrail test, which runs twice (`src` and the compiled `.medusa/server` copy)|

- Other checks:
  - Typecheck: 22 errors, at the baseline; all are in other spec files and `integration-tests/utils/admin.ts`.
  - Backend lint: 0 errors. It does not cover `integration-tests/`.
  - `pnpm ai:check`: passed.
- Review: `code-reviewer` approved.

## Also updated

- `ai/architecture/decisions.md`, row "Company credit/blocked/reset fields…": quotes now carry the
  company name and its `id`, and message authors' `id` is accepted (NIMBUS-269).
  `AGENTS.md` and `.github/copilot-instructions.md` were regenerated by `ai:check --fix`.
- `docs/architecture/store-access.md`, "Store quote response projection": the related record's
  `id` is returned and accepted, and why.
- `ai/architecture/verification.md`, Baseline: the local `test:integration:http` result is
  re-measured as all 489 passing. This drops the old group 4 wording ("a 400 on the Admin quote
  message").

## Verify after deploy

Nothing user-visible or stored changes: tests and records only.

## Open questions and follow-ups

- Jira status: NIMBUS-269 is still in Estimation. The workflow offers only "Estimate approved"
  (to To Do) from there, and that is a human decision, so the issue was not moved to in progress
  or review.
- `ai/architecture/verification.md` still describes a baseline from `docs/security-remediation.md`
  (2026-09-20). The BC `listOrders` module test failure there is still present, unrelated to this bug.
