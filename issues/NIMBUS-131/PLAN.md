# NIMBUS-131: Make Business Central Customer Number Available

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-131

## Objective
Add a manually maintained, numeric-only Business Central customer number on backend companies and surface it through backend APIs, admin company controls, and storefront company information without breaking existing flows when absent.

## Analysis
The company domain is implemented in `apps/backend/src/modules/company` with Medusa model-driven CRUD and company store/admin APIs under `src/api/.../companies`. Exposed fields are controlled by company query-config arrays and API validators. The store update company route currently lacks body validation middleware, so numeric-only enforcement must be added there to satisfy update-path validation. Admin company management is implemented in `apps/backend/src/admin/routes/companies` with form/edit controls in `components/company-form.tsx`, `components/company-create-drawer.tsx`, `components/company-update-drawer.tsx`, and company details display in `[companyId]/page.tsx`. Storefront company data is rendered/edited in `apps/storefront/src/modules/account/components/company-card/index.tsx`, with payload typing from `src/types/company/*` and fetching through `src/lib/data/companies.ts`.

Base branch assumption is `develop`, based on repository default branch documented in `AGENTS.md`.

## Execution Plan
1. Extend backend company model/types/DTOs and add a migration for nullable `business_central_customer_number`.
2. Enforce numeric-only validation at admin/store API boundaries and add missing store update body validation middleware.
3. Add the new field to store/admin company query defaults and extend backend integration tests for valid/invalid/absent scenarios.
4. Update admin company UI controls and details view to display/edit `business_central_customer_number` through existing company create/update drawers and detail table.
5. Propagate field through storefront company types and account company card view/edit experience.
6. Verify backend with integration tests and backend admin/storefront with lint/build plus manual company flow checks.

## Decisions & Trade-offs
- Keep the field nullable and manually managed (no Business Central sync logic) to match approved scope and avoid integration coupling.
- Validate numeric-only at API validators (trust boundary) instead of adding extra workflow-level logic to keep changes surgical.
- Reuse existing admin company form and drawers rather than adding a new admin route/widget to keep controls consistent with current company editing UX.
- Prefer manual storefront verification for this issue because storefront test scripts are not currently wired in `apps/storefront/package.json`; avoid introducing unrelated test infrastructure.

## Verification
- [ ] Backend: `cd apps/backend && pnpm test:integration:http` passes with updated companies integration tests.
- [ ] Backend: numeric-only create/update accepts `"12345"` and rejects non-numeric values.
- [ ] Backend: company create/update/retrieve continues to work when business central number is omitted.
- [ ] Admin UI: `cd apps/backend && pnpm build` succeeds with updated admin company types/components.
- [ ] Admin UI: company create/update drawers allow setting numeric number and display it on company details page.
- [ ] Admin UI: invalid non-numeric input is rejected and surfaced through existing error handling.
- [ ] Storefront: `cd apps/storefront && pnpm build` succeeds with updated types/components.
- [ ] Storefront: account company details display/edit the number when present.
- [ ] Storefront: account company details remain functional and non-breaking when the number is absent.
