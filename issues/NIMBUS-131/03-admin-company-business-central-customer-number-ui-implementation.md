# Implementation Task 03: Admin company UI controls for Business Central customer number

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** Backend integration tests remain in `cd apps/backend && pnpm test:integration:http`; admin UI verification for this task is build + manual dashboard checks
- **Test framework:** Jest (repo standard) for backend APIs; admin route behavior validated via manual dashboard flow
- **Test location:** Admin route files under `apps/backend/src/admin/routes/companies/**`
- **Naming conventions:** Follow `apps/backend/copilot-instructions.md` and existing admin route/component patterns

## Solution Design

Extend the existing admin companies route and shared company form to include `business_central_customer_number` as a normal company field in create/update flows and details display. Keep UI behavior aligned with existing drawers/forms and rely on backend validation for numeric-only enforcement while preserving current error handling.

## Code Skeletons

No new files are expected in this task.

## Impacted Files

- `apps/backend/src/admin/routes/companies/components/company-form.tsx`
  - **Change:** add input binding for `business_central_customer_number`.
  - **New behavior:** include field in create/edit form state and submit payload.
- `apps/backend/src/admin/routes/companies/[companyId]/page.tsx`
  - **Change:** add Business Central customer number row in details table.
  - **New behavior:** display stored number (or fallback when absent).
- `apps/backend/src/admin/types/company/http.ts` and/or `apps/backend/src/admin/types/index.ts` (exact existing type location to confirm during implementation)
  - **Change:** include optional nullable `business_central_customer_number` in admin company request/response typing used by hooks/forms.
- `apps/backend/src/admin/routes/companies/page.tsx` (if desired in table view)
  - **Optional change:** add a column for quick visibility in list view if consistent with current table density.

## Test Cases

### TC-1: Admin create company with numeric BC number
- **Given:** Admin opens Create Company drawer.
- **When:** Admin enters `business_central_customer_number: "123456"` and saves.
- **Then:** Company is created and details page shows the number.

### TC-2: Admin update company with numeric BC number
- **Given:** Existing company with no BC number.
- **When:** Admin opens Edit Company drawer, enters `"98765"`, and saves.
- **Then:** Details view and subsequent retrieval include `"98765"`.

### TC-3: Admin rejects non-numeric BC number
- **Given:** Admin enters `"12A34"` in create or edit drawer.
- **When:** Save is attempted.
- **Then:** Backend validation rejects request and admin UI keeps existing error feedback behavior.

### TC-4: Admin no-regression when value is absent
- **Given:** Company has no BC number.
- **When:** Admin views or edits other company fields.
- **Then:** Existing company flows continue to work and details render with empty/fallback value.

## Implementation Steps

1. Confirm admin company type definitions consumed by `CompanyForm` and hooks include `business_central_customer_number`.
2. Add Business Central customer number input to `company-form.tsx` and wire to `formData` change handlers.
3. Ensure create/update drawers submit the field without changing existing submit/error flow.
4. Add field display on company details page table (`[companyId]/page.tsx`), with safe fallback for missing value.
5. Run verification: `pnpm lint`, `cd apps/backend && pnpm build`, and manual admin dashboard checks for create/update/invalid/absent scenarios.

