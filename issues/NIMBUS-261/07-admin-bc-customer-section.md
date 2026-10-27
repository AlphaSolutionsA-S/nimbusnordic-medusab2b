# 07: Admin "Business Central customer" section
**App:** backend (Admin UI) · **Layer:** Admin UI over HTTP (`admin/lib/client.ts`) · **Depends on:** 06

**Goal:** The Admin company page shows a "Business Central customer" section with the routed environment, the not-found record, the two-environment check and "Use this customer".
**Files / areas:** `admin/routes/companies/[companyId]/page.tsx`, a new component under `admin/routes/companies/components/`, `admin/hooks/api/companies.tsx` (or a sibling hook file), `admin/routes/companies/__tests__/`.
**Seam contracts:** the three task 06 routes and their response types from `types/company/http.ts`. New `LayoutComposer.Entry` with a fixed, hand-written id (for example `business-central-customer`), placed after `company-information`; `<Toaster />` stays outside `sections` (`medusa-admin` `project.md`).
**Test intent:**
- Admin UI (`test:admin`, client mocked): shows the routed environment and the not-found time, environment and number; no record → none shown.
- Check button disabled without a customer number; the lookup runs only on click.
- Results: found in one → one "Use this customer"; found in both (the normal case for a Norwegian customer: same number, same customer) → both actions and no warning; found in neither → message, no action; `could_not_check` shown per environment beside the other's result.
- `routes_elsewhere` → a warning and a confirmation before the POST; cancel → no POST; confirm → POST with only `{ environment }`.
- After the POST: outcome toast per status, and the company and section queries are invalidated.
**Done when:** layout tests still find every existing entry plus the new one, and typecheck shows no new errors.
**Verify after deploy:** the section on one Norwegian test company's page shows "NO" as routed environment after "Use this customer".
**Also update:** `admin/routes/companies/__tests__/company-details-layout.test.tsx` (entry list); `company-bc-sync.test.tsx` if it asserts the page's entries; `docs/architecture/admin-page-layout.md` line 32 (company details entry ids gain the new id).
