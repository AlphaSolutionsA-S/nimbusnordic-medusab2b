# Deviation report: Only companies enabled for the order API can place orders and receive shipment notices

> Record of NIMBUS-217, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-217`, merge-base `69155cf`, HEAD `2a43250` (tasks 01–05 as NIMBUS-218 to
NIMBUS-222, plus one consolidation commit). Reviewed 2026-10-23 by the integration reviewer.

## Deviations from scope and plan

- **BLOCKING: `company` migration not generated** (task 01). `medusa db:generate company` needs a
  database; none was available, and none was hand-written (correct per `data-ownership.md`). The model
  has `order_api_enabled: model.boolean().default(false)`
  (`apps/backend/src/modules/company/models/company.ts:29`), but there is no migration and no updated
  `.snapshot-company.json`. Expected SQL: `alter table if exists "company" add column if not exists
  "order_api_enabled" boolean not null default false;`. Until this is generated, every query that
  selects the column fails at runtime, including both order API endpoints, Admin company reads and the
  shipment job. The integration tests also cannot run, because the runner migrates from the files.
- **BLOCKING: `orderIngestion` migration not generated** (task 04). The new close reason
  `company_not_enabled` is in `SHIPMENT_TRACKING_CLOSE_REASONS`, but the database check constraint
  still lists four values (`Migration20261019100406.ts`). Expected generated SQL: drop and re-add
  `shipment_tracking_close_reason_check` with the five values. Until then, closing a row with the new
  reason violates the constraint, so the check run fails for any switched-off company.
- **BLOCKING (process): `pnpm ai:check` fails.** `AGENTS.md` is 32885 bytes, over the 32768 limit,
  after the new `decisions.md` row (R15 requires that row). The budget had about 70 bytes left before
  this branch. This needs a human decision (Open question 1).
- No integration or contract spec was run (no PostgreSQL). Every HTTP, integration and security spec
  this branch adds or changes is written and typechecks, but has not been run. Acceptable only together
  with the two migrations being generated and these specs run before push (Open question 2).
- Task 01: the store negative cases are in `companies.spec.ts`, not `security-boundaries.spec.ts` (that
  spec has no company profile section). The BC sync case runs through
  `POST /store/customers/me/company/sync-business-central`. Acceptable.
- Task 01: `AdminUpdateCompany` (HTTP type) is `Partial<AdminCreateCompany> & { order_api_enabled? }`,
  so the create type stays without the field. Acceptable; it matches the strict create schema.
- Task 02: two cases beyond the test intent (switching from on to off; no BC-managed indicator on the
  row). The create-drawer case passed before the change (regression guard). Acceptable.
- Task 03: added a workflow-level test that the warn line carries the company id only (N2), and the
  `setOrderApiEnabled` test helper. `createApiCustomerCompany` now seeds companies switched on, which
  changes every caller's seed. All callers are order API or shipment specs. Acceptable.
- Task 03: the stale, gitignored `.medusa/types` lack the field, so rows are typed with the structural
  subset `OrderApiCompanyRow` instead of the generated type. A fresh clone compiles either way.
  Acceptable; see Finding 4.
- Task 04: **R7 edge.** Discovery's trail scan re-reads headers up to 30 minutes behind the lead
  scan. A company switched on between the lead scan passing a header and the trail scan re-reading it
  gets that header tracked. "Never back-filled" is only guaranteed once both cursors are past the
  header (about 45 minutes after its last change). Not closed; this needs a decision (Open question 3).
- Task 04: a `company_not_enabled` close counts in the run's `checked` and sets `last_checked_at`,
  like `superseded`, although no BC read happened. Acceptable (matches the "like superseded" intent).
- Task 04: added a case for a due row whose company no longer exists (plan flow D2). The check spec
  previously tracked rows under a non-existent company id (`comp_shipment_checks`); it now seeds an
  enabled company. The admin overview contract test seeds a `company_not_enabled` row (count 5 → 6).
  Acceptable.
- Task 05: **retry message precedence.** The company check runs before the existing "only gave_up"
  check. A row that did not give up, belonging to a switched-off company, now gets "The company is not
  enabled for the order API" instead of "Only a shipment that gave up can be retried". Both are 400
  `not_allowed`. Enabled companies are unchanged. This follows plan flow E, but the scope did not state
  it (Open question 4).
- Scope item 6 (`docs/architecture/` section, release-notes go-live step): not built, as the plan
  says. The docs go to `documentation-writer` after ship. The go-live step does not apply now: the
  system is not live (plan decision 1).

## Consolidation changes

One commit, `2a43250`, with no behaviour change. The four local company row types in the steps that
read `order_api_enabled` were replaced by one exported `OrderApiCompanyRow` and
`ORDER_API_COMPANY_FIELDS` in `apps/backend/src/utils/order-api-access.ts`. The four steps are the
resolve step, `prepare-shipment-checks`, `scan-shipment-windows` and
`validate-shipment-tracking-company`. `OrderApiAccessCompany` is now private. Admin tests were run
before consolidation, which touched no admin file.

## Findings

Design against the plan: every plan row holds in the code.

- **Data model.** `order_api_enabled` is written by `POST /admin/companies/:id` only. It is in
  `validators.ts:53` (update schema). It is absent from the strict create schemas (Admin and store) and
  from the store projections. The BC sync update lists only BC fields, which a test covers. The new
  close-reason value is written only by the check run.
- **State tables.**
  - Intake: the resolve step refuses with 403 after 404 and before `checkDuplicateExternalOrderStep`
    (`create-order-from-canonical-payload.ts:23–32`).
  - Notices: refused before `listCompanyShipmentNoticesStep` (`list-shipment-notices.ts:25–36`).
  - Check run: closes before both the superseded check and any BC read (`check-shipments.ts:179`).
  - Retry: refused first, row untouched (`reopen-shipment-tracking.ts:8`).
  - R9 holds: the reopen SQL only reopens `gave_up`.
- **Security matrix.** Every property has its control and a negative test, all written but not run.
  The 403 body is fixed, and the log line carries the company id only
  (`resolve-company-by-customer-number.ts:57`). There is no cache (N3), and N4 holds: one extra
  `companies` query per batch, no BC request.
- **One home for the rule.** `isCompanyEnabledForOrderApi` is the only implementation. All five
  consumers call it, and its `decisions.md` row is in place.

Findings:

1. **High (blocking, process):** the two migrations are missing (see Deviations). The branch does not
   run against a real database until they are generated and committed.
2. **Medium:** the R7 trail-scan window (`scan-shipment-windows.ts:78`) can track a header of a
   company switched on within about 45 minutes of the header's last change. Business decision: Open
   question 3.
3. **Low:** retry message precedence for non-gave-up rows of a switched-off company
   (`validate-shipment-tracking-company.ts`, `reopen-shipment-tracking.ts:8`). Open question 4.
4. **Low (silent-failure risk):** `prepare-shipment-checks.ts:117` and `scan-shipment-windows.ts:78`
   annotate the callback parameter as `OrderApiCompanyRow`. In `OrderApiCompanyRow`,
   `order_api_enabled` is optional, and `apps/backend` does not set `strictFunctionTypes`, so the
   compiler accepts a row without the field. If the column were not returned (for example a missing
   migration, or a wrong field path), every company would silently count as switched off. Every open
   row would then close `company_not_enabled`, permanently (R9). The contract tests guard this once
   they run, and the after-deploy check covers it. Not a cast, and no code change requested.
5. **Low (dead export):** `CUSTOMER_NOT_REGISTERED_FOR_ORDER_API_MESSAGE`
   (`resolve-company-by-customer-number.ts:14`) has no importer; the tests use the literal. The task's
   seam contract asked for it, and it mirrors the existing `CUSTOMER_NOT_FOUND_MESSAGE`, which also has
   no importer. Leave as is.

Mechanical wiring: no issues found.

- Imports resolve. No circular imports and no `as unknown as`. The new types and constants are used.
- No duplicate file bodies, routes or pages, and no unplanned uniformity (no mocking seams).
- `git status` is clean.
- No new module (nothing to register), no new store route, and no storefront text or secrets.
- Comments cite only issue keys.
- The "Also update" search found no `docs/` or `ai/` text describing the close reasons or the order
  API errors beyond the new `decisions.md` row. `AGENTS.md` and `.github/copilot-instructions.md`
  were regenerated with that row.

## Tests

- **Security paths covered (written, not run).** Each endpoint has a 403 for a switched-off company:
  - `orders.spec.ts`: no order, reference or link; duplicate gives 403, not 422; 400 still first;
    switching back on works.
  - `shipment-notices.spec.ts`: notices are not served while off and are served again once on.
  - `security-boundaries.spec.ts`: one case per endpoint.
  - Store create with the field gives 400; the store read never returns it, even with `fields=`.
  - Admin create with the field gives 400.
  - A BC sync leaves the setting unchanged.
  - The log line carries no customer number.
  - Retry is refused with 400 and the row is unchanged.
- **Run and passing:** backend unit 742/742, including the rule's unit tests and the check-schedule
  case. Admin 59/59, including the company detail page, the switch, and the shipment-tracking label.
  Typecheck is 22 (baseline 22), lint has 0 errors, and the build is OK.
- **Not run:** every integration and contract spec (`test:integration:http`,
  `test:integration:modules`), because there is no PostgreSQL and the migrations are missing.
- **Volume:** apps/backend has 766 test lines and 163 source lines added before consolidation. Most
  test lines are `order_api_enabled: true` seed changes in existing specs, plus contract cases. The
  security-spec cases overlap the `orders.spec.ts` and `shipment-notices.spec.ts` 403 cases; the plan
  asked for both, and the overlap is not redundant enough to remove.

## Open questions

1. **`ai:check` byte budget.** `AGENTS.md` is 117 bytes over 32768 because of the new `decisions.md`
   row. Options:
   - (a) trim other Tier 0 text in `ai/architecture/` by at least 117 bytes, then run
     `pnpm ai:check --fix`;
   - (b) raise `limits.agents_md_bytes` in the AI base config (Codex then stops reading before the
     end);
   - (c) shorten the new row further. It must keep owner, verdict and consumers, so it probably cannot
     save 117 bytes alone.
2. **Migrations and the unrun specs.** Someone with a local Postgres runs
   `pnpm --filter @b2b-starter/backend exec medusa db:generate company` and
   `... medusa db:generate orderIngestion`. Check that the SQL matches the expected statements above,
   commit both migrations with their snapshots, then run `pnpm test:integration:http` and
   `pnpm test:integration:modules`. Options:
   - (a) do it before push (recommended);
   - (b) push and let it be done on the branch before merge.

   Until it is done, the branch breaks the order API and the shipment job on any database it is
   deployed to.
3. **R7 trail-scan edge (task 04).** A company switched on within about 45 minutes of a shipment
   header's last change can still get that shipment tracked. Options:
   - (a) accept: "never back-filled" means once both scan cursors have passed the header (recommended
     while not live);
   - (b) close the gap with stored state per skipped header, as a follow-up issue.
4. **Retry message for a non-gave-up row of a switched-off company (task 05).** It now says "The
   company is not enabled for the order API" instead of "Only a shipment that gave up can be retried"
   (both 400). Options:
   - (a) accept: company first, as plan flow E reads;
   - (b) check the row state first, so only gave-up rows get the company message. This is a small
     reorder in the validation step.

### Answers (Klaus, 2026-10-23)

1. Shorten the new `decisions.md` row until `pnpm ai:check` passes; do not raise the limit or trim
   other text.
2. Before push: a throwaway local Postgres container for this branch is allowed (not another
   project's database). Generate both migrations with `medusa db:generate`, inspect the SQL, commit
   them, then run the integration and contract suites.
3. R7 trail-scan edge accepted as is: "never back-filled" holds once both scan cursors have passed
   the header (up to about 45 minutes). No follow-up issue.
4. Keep the company check first (plan flow E).
5. Also (accepted recommendation, finding 4): make `order_api_enabled` required on the shared
   `OrderApiCompanyRow` type, so a query that omits the column fails to compile.

## Verify after deploy

- **01 Company setting:** `company.order_api_enabled` exists and is `false` for every company right
  after the migration; one test company in Admin shows it.
- **02 Admin UI for the order API setting:** Admin company page of one API company shows the row, and
  switching it changes `company.order_api_enabled` for that row.
- **03 Rule home and 403 for switched-off companies on both order API endpoints:** a Logic App call
  for one test company still switched off returns 403 with the fixed message; after switching it on in
  Admin, the next call returns 201/200.
- **04 Shipment job skips and closes switched-off companies:** `shipment_tracking` rows of a test
  company left switched off show `close_reason = 'company_not_enabled'` after the next due run; rows of
  a switched-on API company stay open.
- **05 Admin retry refuses a shipment of a switched-off company:** none (no stored data or screen
  changes beyond the error toast).
