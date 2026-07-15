# Implementation Task 02: Storefront company/customer information surfacing

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** No dedicated storefront Jest script currently configured; verify with `cd apps/storefront && pnpm build` and manual account/company flow QA
- **Test framework:** Jest (repository standard), but storefront automation is not currently wired in package scripts
- **Test location:** Manual storefront verification in account/company pages; if test harness is introduced later, place under `apps/storefront/src/**/__tests__`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md` (kebab-case dirs, PascalCase component files, camelCase vars/functions, PascalCase types)

## Solution Design

Surface the backend field in storefront company/customer information models and account company UI where company details are displayed/edited. Keep the field optional/nullable to preserve behavior for companies without a number. Do not change unrelated customer profile or registration behavior beyond typed propagation required for company payloads.

## Code Skeletons

No new files are expected in this task.

## Impacted Files

- `apps/storefront/src/types/company/module.ts`
  - **Change:** `ModuleCompany` type.
  - **New signature addition:** `business_central_customer_number: string | null`
- `apps/storefront/src/types/company/http.ts`
  - **Change:** `StoreCreateCompany`, `StoreUpdateCompany`.
  - **New signature addition:** optional nullable `business_central_customer_number`
- `apps/storefront/src/modules/account/components/company-card/index.tsx`
  - **Change:** Company form/display model.
  - **New behavior:** show/edit Business Central customer number in company details UI (when present), while allowing empty/null.
- `apps/storefront/src/lib/data/companies.ts`
  - **Change (if needed after backend query defaults):** ensure `retrieveCompany` request still returns the new field in the company payload used by account pages.

## Test Cases

### TC-1: Display existing Business Central number
- **Given:** Company has `business_central_customer_number = "123456"`.
- **When:** User opens account company details page.
- **Then:** Number is visible in company information.

### TC-2: Update Business Central number from company details
- **Given:** Company details edit mode is open.
- **When:** User enters numeric value and saves.
- **Then:** Update request carries value and refreshed view shows persisted number.

### TC-3: No-regression when number is absent
- **Given:** Company has no Business Central number (`null`).
- **When:** User views/edits other company fields.
- **Then:** Page renders and saves normally without requiring the number.

### TC-4: Invalid value rejection is surfaced cleanly
- **Given:** User enters non-numeric value.
- **When:** Save is attempted from storefront company form.
- **Then:** Backend rejects input; storefront keeps existing error-handling behavior (error toast, no data corruption).

## Implementation Steps

1. Extend storefront company types (`module.ts`, `http.ts`) with optional nullable Business Central number.
2. Update account company UI (`company-card`) to include field in view/edit sections.
3. Confirm `retrieveCompany` payload includes the new field from backend query defaults; adjust explicit fields only if required.
4. Run storefront lint/build (`pnpm lint`, `cd apps/storefront && pnpm build`).
5. Perform manual account company QA for present/absent/invalid cases.

