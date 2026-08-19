# Implementation Task 01: Storefront read-only BC customer number

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test` (Jest)
- **Test framework:** Jest + `@testing-library/react` (jsdom)
- **Test location:** `apps/storefront/src/__tests__/modules/account/components/`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md` and the repo TypeScript style (2-space indent, single quotes in TS, PascalCase components, kebab-case non-component files).

## Solution Design

Make the Business Central customer number non-editable in the storefront company profile:

1. In `company-card/index.tsx`, remove the editable `Input` for `business_central_customer_number` from the edit-mode grid and replace it with a read-only presentation (a `Text` label + value, matching the existing collapsed-view style), rendered only when the value is configured.
2. Exclude `business_central_customer_number` from the `companyData` update state by adding it to the destructured-and-discarded fields, so it is never part of the submitted update payload.
3. Remove `business_central_customer_number` from the `StoreCreateCompany` write type in `types/company/http.ts`. Because `StoreUpdateCompany = Partial<StoreCreateCompany> & { id }`, the field is automatically dropped from the update write type too. The read type (`ModuleCompany`/`QueryCompany`) keeps the field so the value can still be displayed.

The collapsed (non-editing) display block already shows the BC number read-only and stays as-is.

## Impacted Files

- `apps/storefront/src/modules/account/components/company-card/index.tsx`
  - **Change:** Extend the discarded destructure so BC is excluded from update state:
    ```tsx
    const {
      updated_at,
      created_at,
      employees,
      approval_settings,
      business_central_customer_number,
      ...companyUpdateData
    } = company
    ```
  - **Change:** Delete the editable BC `Input` block (the `<div>` containing `<Input name="business_central_customer_number" ...>`).
  - **Change:** Inside the edit `<form>` grid, add a read-only presentation gated on the configured value, e.g.:
    ```tsx
    {company.business_central_customer_number && (
      <div className="flex flex-col gap-y-2">
        <Text className="font-medium text-neutral-950">
          BC Customer Number
        </Text>
        <Text className="text-neutral-500">
          {company.business_central_customer_number}
        </Text>
      </div>
    )}
    ```
  - **Note:** `business_central_customer_number` is now an unused destructured binding; prefix or reference is not needed — remove the editable input's dependence on `companyData.business_central_customer_number`. Keep the read-only display reading from `company`.
- `apps/storefront/src/types/company/http.ts`
  - **Change:** Remove `business_central_customer_number?: string | null` from `StoreCreateCompany`. Leave `StoreUpdateCompany` definition as `Partial<StoreCreateCompany> & { id: string }` (it inherits the removal).

## New File: `apps/storefront/src/__tests__/modules/account/components/company-card-bc-readonly.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompanyCard from '@/modules/account/components/company-card'
import type { HttpTypes } from '@medusajs/types'

// IMPLEMENT: mock '@/lib/data/companies' so updateCompany is a jest.fn(); the test
// must be able to assert what payload (if any) it is called with.
jest.mock('@/lib/data/companies', () => ({
  updateCompany: jest.fn().mockResolvedValue({}),
}))

// IMPLEMENT: build a minimal company object satisfying StoreCompanyResponse["company"]
// (QueryCompany) with business_central_customer_number set to a configured value,
// plus the fields the component reads (name, email, currency_code, etc.).
const company = {
  // IMPLEMENT
} as unknown as HttpTypes.StoreCompany // adjust to the actual QueryCompany type import

const regions = [] as unknown as HttpTypes.StoreRegion[]

describe('CompanyCard — BC customer number read-only', () => {
  it('TC-1: shows the configured BC number but renders no editable BC input in edit mode', async () => {
    // IMPLEMENT: render <CompanyCard company={company} regions={regions} />
    // IMPLEMENT: click the "Edit" button to enter edit mode
    // IMPLEMENT: assert the BC value text is visible
    // IMPLEMENT: assert there is NO form field named "business_central_customer_number"
    //            e.g. expect(screen.queryByRole('textbox', { name: /BC Customer Number/i })).toBeNull()
  })

  it('TC-2: saving does not include business_central_customer_number in the payload', async () => {
    // IMPLEMENT: enter edit mode, change an editable field (e.g. name), click Save
    // IMPLEMENT: assert updateCompany was called and the argument has no
    //            business_central_customer_number key
  })
})
```

## Test Cases

### TC-1: BC number is read-only in edit mode
- **Given:** A company with `business_central_customer_number = "123456"`.
- **When:** The user opens the company card and clicks Edit.
- **Then:** The BC number value is displayed, and there is no editable input bound to `business_central_customer_number`.

### TC-2: Saving excludes the BC number
- **Given:** The company card in edit mode with an unrelated field changed.
- **When:** The user clicks Save.
- **Then:** `updateCompany` is called with a payload that has no `business_central_customer_number` key.

### TC-3: Value hidden when not configured (retained behavior)
- **Given:** A company with `business_central_customer_number = null`.
- **When:** The card renders (edit or view mode).
- **Then:** No BC number label/value is shown.

## Implementation Steps

1. Add `business_central_customer_number` to the discarded destructure in `company-card/index.tsx` so it is excluded from `companyData`.
2. Remove the editable BC `Input` block from the edit form grid.
3. Add a read-only BC presentation inside the edit form grid, gated on `company.business_central_customer_number`.
4. Remove `business_central_customer_number` from `StoreCreateCompany` in `types/company/http.ts`.
5. Add the component test file covering the read-only and payload-exclusion cases.
6. Run `cd apps/storefront && pnpm test` for the new test, then `pnpm lint` and `pnpm build`.

## Constraints

- Do not modify any Admin files or backend files in this task.
- Do not change the storefront create flow (`customer.ts`) — it already omits the BC field.
- Do not remove the field from the read types (`module.ts`/`query.ts`); the value must remain displayable.
