# Make company information read-only in the storefront

- **Date:** 2026-08-21
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-157
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-157/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Scope the feature in
  `issues/NIMBUS-157`. Interview the requester
  interactively before writing `SCOPE.md`. Determine which storefront company pages and fields
  are affected, how existing edit actions should change, the placement and wording of the
  backend company-view notice, and whether Business Central-managed fields need individual
  visual identification. Preserve the requirement that all storefront company information is
  read-only and that the backend notice explains Business Central-managed values are
  overwritten on customer login while Medusa-only values are preserved. Align with NIMBUS-156
  without expanding that story's synchronization field mapping.

## 2026-08-21 - Scoping completed

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Please plan NIMBUS-157 from the approved scope in
  `issues/NIMBUS-157/SCOPE.md`. Read `FEATURE.md` and this progress record for context.
  Produce the implementation plan and task manifest without implementing production code.
  Preserve the read-only storefront profile, server-enforced company-admin-only financial
  fields, complete company-information display, persistent Admin warning, per-field Business
  Central indicators, Admin editability, and dependency on NIMBUS-156.

## 2026-09-16 - Implementation planning completed

- **Date:** 2026-09-16
- **Updated by:** implementation planner
- **Outcome:** Created \`PLAN.md\`, a dispatch-ready \`manifest.md\`, and four dependency-ordered
  implementation task files. The plan uses NIMBUS-156's implemented company-sync contract and
  treats its Internal review status as an acceptable dependency state.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-157 from \`issues/NIMBUS-157/manifest.md\` in dispatch
  order. Begin with Task 01's server-side ownership and financial-field projection; do not rely
  on UI hiding. Task 03 may run independently. Complete Task 04's tests and record verification
  outcomes here before requesting review.

## 2026-09-29 - Implementation completed

- **Date:** 2026-09-29
- **Updated by:** implementor agent
- **Outcome:** Tasks 01-04 complete on `feature/NIMBUS-157` (uncommitted). The store company
  profile and employee read routes now derive ownership and the admin flag server-side and
  return an allowlisted projection; `credit_limit`, `blocked`,
  `spending_limit_reset_frequency`, and employee `spending_limit` are absent for non-admins.
  `POST /store/companies/:id` is removed. The storefront company card is read-only and shows
  all permitted fields including VAT number and BC customer number. Admin shows a persistent
  Business Central warning and a `Business Central-managed` badge on all twelve managed
  fields, and can edit blocked, credit limit, and VAT number.
- **Deviations:** The admin flag uses `employee.is_admin` (the current source used by
  `ensureCompanyAccess`), not the `company_admin` identity metadata the plan referenced.
  Admin UI coverage is a unit test of the field list/copy plus an Admin HTTP test, because the
  backend has no DOM test tooling. `employees-card/employee.tsx` got a small guard so a
  redacted `spending_limit` does not crash the page for non-admins.
- **Validation:**
  - Backend integration (postgres:16 container), `jest --runInBand` with
    `TEST_TYPE=integration:http`: companies + security suites 43/43 passed. Full suite 97/105
    passed. The 8 failures are in `quotes/quotes.spec.ts` and `admin/quotes/quotes.spec.ts`
    (HTTP 400). The same 8 fail on the unmodified baseline, so they are pre-existing and
    unrelated.
  - Backend unit (`TEST_TYPE=unit`): 17 suites / 94 tests passed, including the new
    `bc-managed-fields.unit.spec.ts`.
  - Backend `npx tsc --noEmit`: no errors under `src/` (test-file errors are pre-existing).
    `eslint` clean on changed backend paths. `medusa build`: backend and admin built
    successfully.
  - Storefront Jest: 268/271 passed. The 3 failures (`product-tabs`, `main-layout`) also fail
    on the baseline. Focused company/employee/i18n/orders suites 33/33 passed, including
    catalog key parity for all 8 locales. `tsc --noEmit` shows no new errors (the remaining 8 are
    pre-existing in `account-nav.test.tsx`, `profile-card`, `cart-drawer`). `next lint` is clean
    on changed files. `next build` was not run because it needs a running backend (known
    limitation).
- **OWASP A01 review:** The actor comes from `auth_context.actor_id`. Company ownership is
  checked by `ensureCompanyAccess` and again by `resolveCompanyActor`. The route id is never
  used as authority. Query fields are fixed on the server, so `?fields=` cannot bring back
  redacted keys (TC-4). Nested employee and company objects go through the same allowlist.
  Customers from other companies get a 403 with a generic `Forbidden` body (TC-3). No store
  write path for the company profile remains.
- **Residual risks for review:** Other customer-accessible Medusa routes that expose linked
  company data were outside this plan and were not changed. Examples are
  `/store/customers/me?fields=*employee.company` and cart or order `company` relations.
  Reviewers should check whether they can return `credit_limit`/`blocked` to a non-admin.
  Also, a customer's own `employee.spending_limit` is still returned by `/store/customers/me`,
  because checkout spending-limit checks use it.
- **Manual checks outstanding:** Look at the storefront card in desktop and narrow layouts,
  and edit, save, and refresh an Admin managed field in a running environment.
- **Handover to:** code review
- **Handover prompt:** Review NIMBUS-157 on `feature/NIMBUS-157` against
  `issues/NIMBUS-157/PLAN.md` and the task files. Focus on the store projection in
  `apps/backend/src/api/store/companies/company-projection.ts`, the removal of the store
  company update route, the read-only `CompanyCard`, and the Admin warning and indicators.
  Check the residual-risk note above about other customer routes that expose linked company
  data. Then run the manual layout and Admin edit checks before Internal Review.

## 2026-09-29 - Code review and follow-up fixes

- **Date:** 2026-09-29
- **Updated by:** code review (Claude)
- **Outcome:** Review found 1 must-fix and 3 should-fix issues. The requester chose to fix
  the must-fix, drop employee-list paging, and add a non-negative credit limit rule. All three
  are done.
  - **Must-fix (cart leak):** `/store/carts/:id` allowed the whole `company` relation, so any
    employee could request `*company` and get `credit_limit`, `blocked` and
    `spending_limit_reset_frequency`. The storefront's own cart request did this too. The
    allow-list in `apps/backend/src/api/middlewares.ts` now names only `company.id`,
    `company.name` and `company.approval_settings`. The bulk line-item cart config returns only
    `company.id`/`company.name`. The storefront cart request asks for
    `+company.id,+company.name,*company.approval_settings`.
  - **Tests:** TC-5 checks that caller-chosen cart fields cannot return the financial values,
    and that the storefront's field list still returns what checkout needs. TC-6 checks the
    same for `/store/customers/me?fields=*employee.company`. TC-5 was confirmed to fail on
    the old allow-list with the credit limit in the response. Medusa drops fields that are not
    allowed rather than returning a 400.
  - **Employee list:** `GET /store/companies/:id/employees` now returns only `{ employees }`,
    without `count`/`offset`/`limit`.
  - **Admin validation:** `credit_limit` must be zero or more (`nonnegative()`) on Admin
    create and update.
- **Verification:**
  - **Backend integration:** companies and security specs 45/45 passed. The
    `customers/company-sync` spec passed. `admin/quotes` fails with an HTTP 400, the same as
    on baseline.
  - **Backend typecheck:** `tsc` reports no errors under `src/`.
  - **Storefront Jest:** 39/39 cart, checkout, company and employee tests passed.
- **Still open:**
  - The storefront shows the spending-limit reset frequency in English only (should-fix #4).
  - The duplicate customer lookup in `resolveCompanyActor` was accepted as is.
  - Manual layout and Admin edit checks are still outstanding.
- **Handover to:** requester, to commit and merge to develop and then move the issue to
  Internal review.
