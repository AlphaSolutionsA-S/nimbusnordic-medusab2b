# Task 02 — Company model fields + generated migration

**App:** backend
**Depends on:** None
**Base branch:** `develop`

## Goal
Add `blocked`, `credit_limit`, and `vat_number` to the company model and the company module DTOs,
then generate a company-module migration. These fields are integration-owned; do **not** add them
to any store/admin create or edit validator.

## Files

### Modify: `apps/backend/src/modules/company/models/company.ts`
Add three fields to the `Company` model definition (keep everything else unchanged).

```typescript
export const Company = model.define("company", {
  // ...existing fields...
  currency_code: model.text().nullable(),
  business_central_customer_number: model.text().nullable(),
  // NEW integration-owned fields:
  blocked: model.enum(["not_blocked", "Ship", "Invoice", "All"]).default("not_blocked"),
  credit_limit: model.bigNumber().nullable(),
  vat_number: model.text().nullable(),
  spending_limit_reset_frequency: model
    .enum(["never", "daily", "weekly", "monthly", "yearly"])
    .default("monthly"),
  employees: model.hasMany(() => Employee),
});
```

Notes:
- `blocked` normalizes BC's empty/unblocked value to `"not_blocked"`; that default covers existing rows.
- `credit_limit` uses `model.bigNumber().nullable()` (consistent with `employee.spending_limit`)
  to preserve decimal precision. This causes the generated migration to also add a
  `raw_credit_limit` column — expected and correct. Nullable so pre-sync rows distinguish
  "unknown" from a real `0`.
- `vat_number` is nullable text.

### Modify: `apps/backend/src/types/company/module.ts`
Add a blocked-state type and the three fields to `ModuleCompany` only. `ModuleUpdateCompany`
(`extends Partial<ModuleCompany>`) and `QueryCompany` (`extends ModuleCompany`) inherit them
automatically — do not touch `ModuleCreateCompany`, `http.ts`, or any validator.

```typescript
export type ModuleCompanyBlockedState = "not_blocked" | "Ship" | "Invoice" | "All";

export type ModuleCompany = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  logo_url: string | null;
  currency_code: string | null;
  business_central_customer_number: string | null;
  // NEW:
  blocked: ModuleCompanyBlockedState;
  credit_limit: number | null;
  vat_number: string | null;
  spending_limit_reset_frequency: ModuleCompanySpendingLimitResetFrequency;
  created_at: Date;
  updated_at: Date;
  customer_group: CustomerGroupDTO;
  approval_settings: ModuleApprovalSettings;
};
```

### Generate: `apps/backend/src/modules/company/migrations/Migration<timestamp>.ts`
Generate from the changed model — do **not** hand-author:

```
cd apps/backend
npx medusa db:generate company
```

Review the generated migration. It must:
- add `blocked` (text/enum, NOT NULL, default `'not_blocked'`),
- add `credit_limit` (numeric, nullable) and `raw_credit_limit` (jsonb, nullable),
- add `vat_number` (text, nullable),
- preserve all existing rows,
- be reversible (`down` drops the added columns).

If generation cannot represent the change, document the reason in `PROGRESS.md` before
hand-authoring.

## Test cases

### TC-1: existing rows migrate safely
- **Given** an existing `company` row created before this change
- **When** the migration is applied
- **Then** `blocked = 'not_blocked'`, `credit_limit IS NULL`, `vat_number IS NULL`

### TC-2: reversibility
- **When** the migration `down` runs
- **Then** the three columns (and `raw_credit_limit`) are dropped without error

## Validation
- `pnpm --filter @b2b-starter/backend build` (type-checks the DTO changes)
- Apply migration on a disposable/test DB (see Task 06).
- Confirm no store/admin validator or `ModuleCreateCompany` was changed.
