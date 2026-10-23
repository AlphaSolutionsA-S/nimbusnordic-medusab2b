# 03: Company details in three sections
**App:** backend (Admin UI) · **Layer:** Admin UI (`admin/**`) · **Depends on:** 01

**Goal:** Company details renders `core:single-column` under `company.details` with three named, movable and hideable sections in default order: Business Central warning, company information, employees; the company is passed as the layout's `data`.
**Files / areas:** `src/admin/routes/companies/[companyId]/page.tsx`; a new or extended test in `routes/companies/__tests__/`.
**Seam contracts:** page key from task 01's module.
**Test intent:**
- With a loaded company, the entries are the warning, company information and employees, in that order, under `company.details` (stand-in attributes).
- The warning title and description from `bc-managed-fields.ts` still render; the Order API row and the employees table or empty state render as today.
- Existing `company-order-api-setting.test.tsx` cases pass unchanged.
**Done when:** content, actions and drawers behave as today; "Company not found" while loading unchanged; `<Toaster />` outside sections; lint passes; typecheck at or below baseline.
**Verify after deploy:** Admin → Companies → any company: hide the Business Central warning, save, reload → hidden; Default, save → shown first.
**Also update:** `routes/companies/__tests__/company-order-api-setting.test.tsx` (if it needs the stand-in); `docs/architecture/order-api/overview.md` company-page row still accurate (no change expected).

## Deviations
- Added a test case: "Company not found" and no layout while the company is loading (done-when clause; passes before and after, as a guard that the loading path stays outside the layout).
- Added a test case: the employees empty state ("No records") renders inside the employees entry, alongside the populated-table case (test intent names both).
- New test file `company-details-layout.test.tsx` rather than extending `company-order-api-setting.test.tsx`, which stays unchanged as the intent requires.
- Entry ids chosen: `business-central-warning`, `company-information`, `employees` (stored by Medusa as `core:<id>`; renaming drops saved positions).
- Observed once: in the first combined run of both company test files, the create-drawer case in `company-order-api-setting.test.tsx` failed at `user.click(Save)`; it passed alone and in three later combined runs (9/9 each). Not reproduced; reported as a possible timing flake, no code change.

## Done-when evidence
- Three sections in default order under `company.details`, single column: `company-details-layout.test.tsx` "renders the warning, company information and employees as entries, in that order, under company.details".
- Company passed as the layout's `data`: `data={company}` in `[companyId]/page.tsx`; the stand-in ignores `data`, so not provable in a Jest test: browser run (final gate) with a widget on `company.details`.
- Movable and hideable sections, saved arrangement: not provable in this task: Medusa's edit mode and settings module; Verify after deploy step.
- Content, actions and drawers behave as today: whitespace-insensitive diff of `page.tsx` adds only the imports, `LayoutComposer`, three `LayoutComposer.Entry` wrappers and the fragment; `company-details-layout.test.tsx` "keeps the Business Central warning text, the Order API row and the employees table in their sections" and "shows the employees empty state ..."; `company-order-api-setting.test.tsx` 5/5 unchanged.
- "Company not found" while loading unchanged: `company-details-layout.test.tsx` "shows Company not found and no layout while the company is loading".
- `<Toaster />` outside sections: rendered after `LayoutComposer` in the page fragment (`page.tsx`), not in `sections`.
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in changed files).
- Typecheck: 22 errors, same set as tasks 01 and 02 (`tsc-03.txt` in the run scratchpad).
- Also update `company-order-api-setting.test.tsx`: no change needed; the stand-in is mapped globally and its 5 cases pass unchanged.
- Also update `docs/architecture/order-api/overview.md`: row "`admin/routes/companies/**` ... the company page shows "Order API: Enabled/Disabled"" still accurate; no change.
