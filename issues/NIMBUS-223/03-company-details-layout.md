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
