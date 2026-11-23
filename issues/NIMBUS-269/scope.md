# Seven local backend HTTP integration tests still fail after NIMBUS-236

**Date:** 2026-11-23
**Status:** Scoped (awaiting approval)
**Type:** Bug
**Priority:** Medium (Jira; `bug.md` recorded Major at registration, the tracker is authoritative)
**Issue:** NIMBUS-269
**Key:** NIMBUS-269
**Case folder:** issues/NIMBUS-269/
**Base Branch:** develop

## Background

After NIMBUS-236 the backend HTTP integration suites run locally again: 477 of 484 pass and 7 fail.
Reproduced on 2026-11-23 on develop `bd34b15` (throwaway `postgres:18-alpine`, the four spec files
only): 4 suites, 7 failed, 117 passed. The scoping run found a cause for every group. None of them
is a fault in a running feature; one is a gap between what the agreed privacy rule says and what
Medusa returns.

|#|Test|Cause found|Kind|
|---|---|---|---|
|1a, 1b|`companies/employee-invitation` "refuses with 400 when the store tries to link an existing customer"; `security/security-boundaries` "refuses an own-company admin attaching an existing companyless customer as admin"|The request is refused with 400 as required. The follow-up check then asks the company module for employees by `customer_id`, a column the employee table does not have ("Trying to query by not existing property Employee.customer_id"). Employee and customer are joined by a module link. NIMBUS-248 fixed the same mistake in another case of the same spec (`16472ca`) by reading the customer's linked employee through Query.|Test drift|
|2a, 2b|`security/security-boundaries` "store quote response privacy", `is_admin` false and true|The first response checked (create quote, default fields) returns `customer.employee.company` as `{ id, name }`; the test requires exactly `{ name }`. The test also requires message authors to be exactly `{ first_name, last_name }`, and the same responses carry `id` there too (seen in group 3a), so those assertions would fail next.|Rule vs Medusa behaviour (decision, Q1)|
|3a|`quotes/quotes` "retains contact, spending, message references and numeric quote detail and preview data"|Same root as group 2: exact `company: { name }`, `admin: { first_name, last_name }` and `customer: { first_name, last_name }` assertions, while each comes back with its `id`. Jest prints the whole object for nested `objectContaining`, so further mismatches cannot be ruled out until the `id` question is settled and the test re-runs.|Same as group 2|
|3b|`quotes/quotes` "POST /store/quotes successfully initiates a quote with a draft order"|The only real mismatch is `summary.difference_sum: 0`. The installed Medusa order module (2.21.2) has no `difference_sum` field anywhere; the expectation came from the upstream starter. Nothing else in the repo uses it.|Test drift (Medusa upgrade)|
|4|`admin/quotes/quotes` "POST /admin/quotes/:id/messages successfully creates an admin quote message"|The 400 is not from the message route. It comes from the test setup creating the cart (`POST /store/carts`): Medusa logs "Variants … do not exist or belong to a product that is not published". The setup creates a draft product and never publishes it; `quotes/quotes` publishes its product explicitly, `admin/quotes/quotes` does not. The message route itself is therefore not yet exercised. `bug.md` and `ai/architecture/verification.md` describe this as "a 400 on the Admin quote message", which is inaccurate.|Test drift (setup)|

### What Medusa does with relation fields (group 2 and 3a)

`api/store/quotes/query-config.ts` selects `customer.employee.company.name`,
`messages.admin.first_name/last_name` and `messages.customer.first_name/last_name`. At runtime each
of those related records also comes back with its `id`, and the employee comes back with
`company_id`:

- Evidence (runtime, the probe for this scope): the failing responses on 2026-11-23 show
  `company.id`, `messages[].admin.id` (equal to the message's own `admin_id`),
  `messages[].customer.id` (equal to the message's own `customer_id`) and
  `customer.employee.company_id` (equal to `company.id`).
- Evidence (installed source): `@medusajs/query` 2.21.2, `dist/joiner/compile.js`,
  `injectJoinKeys` adds the relationship's key fields to the fields fetched for a cross-module
  join (messages to user and customer are links). The mechanism for the in-module relation
  (employee to company) is UNVERIFIED; presumed the ORM always loads a populated relation's
  primary key. The planner verifies it if Q1 is answered B.
- None of these ids is new information to the caller: the message ids repeat `admin_id` and
  `customer_id`, which the agreed projection keeps on purpose, and the company id is the caller's
  own company's, already returned as `customer.employee.company_id` in the same quote response and
  by the caller's own profile (`/store/customers/me`, `*employee`), and used in the storefront's
  company routes.

The rule agreed in NIMBUS-207 (Klaus Petersen, 2026-10-21, open question 1: "name only") and its
records (`ai/architecture/decisions.md` "quotes: name only", `docs/architecture/store-access.md`
"Store quote response projection") say the company carries only `name` and message authors only
`first_name` and `last_name`. NIMBUS-207 shipped with its HTTP verification recorded as a gap, so
this gap between rule and runtime is surfacing now for the first time. No administrator-only
company field, colleague data or author email was seen in any failing response.

## Requirements

### Functional

1. All 484 tests in `test:integration:http` pass locally, with no test deleted, skipped or
   weakened beyond what an answered decision in this scope allows.
2. The two employee-creation refusal cases keep proving that no employee is linked to the existing
   customer after the 400, now by reading the customer's linked employee.
3. The store quote privacy cases keep proving, for both roles and all seven store quote response
   routes, with default, additive-malicious and explicit-malicious `fields`: no administrator-only
   company field, no colleague data, no author email or other author field. What they assert about
   the related records' `id` follows Q1.
4. The store quote create case asserts only order summary fields Medusa 2.21 provides.
5. The Admin quote message case reaches the message route (its product published in setup) and
   proves the message is stored with the Admin as author, the given item and no customer.
6. If Q1 is answered B, every store quote response route returns the related records without
   `id` (and without whatever Q2 adds), while store quote reads, actions and the storefront quote
   pages keep working.

### Non-functional

- Run against a real Postgres as the suites do today; no guard in `integration-tests/global-setup.ts`
  relaxed.
- The records stay true: `ai/architecture/verification.md` baseline, and with answer A the
  `decisions.md` row and `docs/architecture/store-access.md` wording.

## Business rules

- Store employee creation with an existing customer's id → refused (400); no employee is created or
  linked, the account's role is not changed (NIMBUS-243, NIMBUS-252; unchanged).
- Store quote response, any employee role → company: `name` only per the agreed rule; whether
  Medusa's `id` may stay is Q1. Administrator-only company fields, colleagues and author contact
  fields → never, whatever `fields` the caller sends (NIMBUS-207; unchanged).
- Store quote response, message author → `first_name`, `last_name` per the agreed rule; author `id`
  follows Q1. The message keeps `admin_id` and `customer_id` (unchanged).
- Store quote read or action on another customer's quote → not found (unchanged).
- Admin posts a quote message → stored with the signed-in Admin as author (`admin_id` = the Admin
  user), the optional item, no customer (unchanged).
- A failing test is fixed by correcting a stale assertion or setup, never by deleting it
  (`ai/architecture/verification.md`).

## Data model (draft)

No table, column, link or migration changes.

|Field in the store quote response|Owner|Written by|Stored or derived|Sensitive?|In the response today|Intended|
|---|---|---|---|---|---|---|
|`customer.employee.company.name`|company module (BC-managed)|BC sync|stored|low|yes|yes|
|`customer.employee.company.id`|company module|system|stored|low; the caller's own company|yes (added by Medusa)|Q1|
|`customer.employee.company_id`|company module|system|stored|same value as above|yes (added by Medusa)|Q2 (only matters with answer B)|
|`customer.employee.id`|company module|system|stored|low; own record|yes (selected on purpose)|yes (unchanged)|
|`messages[].admin.id`|user module (link)|system|stored|low; equals `admin_id`|yes (added by Medusa)|Q1|
|`messages[].customer.id`|customer module (link)|system|stored|low; equals `customer_id`|yes (added by Medusa)|Q1|
|company credit limit, blocked, reset frequency, BC sync time, Order API flag, colleagues, author emails|company, user, customer modules|—|—|admin-only or personal|no|no (unchanged)|

## Security properties (draft)

|Property|Intended control|Trust root|Failure behaviour|
|---|---|---|---|
|No administrator-only company field via a store quote|Server-side quote field allowlist (`query-config.ts`); privacy matrix in `security-boundaries`|Route configuration, not the client|Field absent; test fails if present|
|No colleague data or author contact data via a store quote|Same|Same|Absent|
|Related-record ids in a store quote|A: allowed, asserted equal to the caller's own company id, the staff user id and the caller's customer id. B: stripped before the response is sent, in one shared place for all seven routes|Route configuration (A); a response-shaping step (B)|A: test fails on any other field. B: test fails if an id appears|
|Quote owner only|Customer-scoped queries and workflow ownership checks (unchanged)|Customer session or bearer token|Not found|
|No company link from store employee creation with an existing account|Store route validation (unchanged); spec reads the customer's linked employee|Server|400, no link|
|Personal data on failure|Errors log the message only (unchanged)|—|No company or customer data in logs|

## Affected apps

- Backend (`apps/backend`): the four HTTP spec files and `integration-tests/utils/seeder.ts` or the
  admin spec's setup; with answer B also the store quote routes or a shared response helper.
- Storefront: none with answer A. With answer B, check that the quote pages read no related `id`
  (believed none; `NIMBUS-207` found the storefront reads only the company name).
- AI base and docs: `ai/architecture/verification.md` (baseline); with answer A also
  `ai/architecture/decisions.md` (the "quotes: name only" note) and
  `docs/architecture/store-access.md` (Store quote response projection).

## Proposed structure

1. Employee-creation refusal specs: check the absence of an employee link through the customer's
   linked employee (as NIMBUS-248 did), in both spec files.
2. Store quote create spec: drop the `difference_sum` expectation Medusa 2.21 no longer provides.
3. Admin quote spec setup: publish the product (as `quotes/quotes` does) so the cart can be
   created, then confirm the message case passes; a failure in the message route itself is a new
   finding for the human.
4. Store quote related-record ids, per Q1:
   - A: the privacy matrix and the quote detail case assert the related records exactly as
     `{ id: <known id>, name }` and `{ id: <known id>, first_name, last_name }`, keeping every
     forbidden-field negative case; update the `decisions.md` note and the `store-access.md`
     paragraph to say Medusa returns the relation's `id` and that it is accepted.
   - B: strip the related-record ids (and Q2's fields) from the response of all seven store quote
     routes in one shared place, verify the Medusa mechanism first (`medusa-boundary.md`), tests
     unchanged.
5. Re-measure: the full `test:integration:http` run and the unit suite; update the baseline in
   `ai/architecture/verification.md`.

With answer A every task is a test, record or documentation change in one app with the rule
already clear, so the work meets none of the full-pipeline signals and fits `quick-fix` (Q3). With
answer B task 4 changes a store response in the company-data area, which stays in the full
pipeline.

## Open questions

1. **Related-record `id` in store quote responses.** Medusa returns each related record's `id`
   alongside the fields we select: the company (`{ id, name }`) and the message authors
   (`{ id, first_name, last_name }`). The agreed rule (NIMBUS-207, your answer of 2026-10-21) says
   name only. Options:
   - A (proposed): accept the ids and change the rule's wording. They reveal nothing new: the
     author ids repeat `admin_id` and `customer_id`, which the response keeps on purpose, and the
     company id is the caller's own company's, already in the same response as the employee's
     `company_id` and in the caller's own profile. The tests pin the exact ids and keep every
     forbidden-field check.
   - B: strip them from all seven store quote routes, a production change in the company-data
     area that stays in the full pipeline. It only hides the company id if Q2 also strips the
     employee's `company_id`.
2. **Only with answer B: the employee's `company_id`.** Strip it from the store quote response too?
   (`customer.employee.id` is selected on purpose and would stay.) Proposed: yes, otherwise
   stripping `company.id` hides nothing.
3. **Flow.** With answer A, hand the whole bug down to `quick-fix` (bug mode) with this case folder,
   as one flow and one folder? Proposed: yes. With answer B, continue with `implementation-planner`
   for all five tasks.

## Dependencies

- NIMBUS-236 (shipped): makes the local HTTP suites runnable; reproduction method in
  `bug.md` and `issues/NIMBUS-236/change-report.md`.
- NIMBUS-207 (shipped): the store quote projection and its privacy cases; Q1 amends its agreed rule
  if answered A.
- NIMBUS-243, NIMBUS-252 (shipped): the store employee-creation refusal and its contract cases.
- NIMBUS-248 (shipped): the precedent fix for the `Employee.customer_id` spec lookup.
- Reproduction needs a Postgres reachable on a free port (Docker did not publish 5432 for
  `nimbus_postgres_container`) and `BUSINESS_CENTRAL_DISCOVERY_URL` on an allowed test environment.
