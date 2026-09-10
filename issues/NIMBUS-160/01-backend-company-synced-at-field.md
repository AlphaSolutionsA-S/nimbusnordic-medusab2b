# Task 01 — Company `business_central_synced_at` field + generated migration

**App:** backend
**Depends on:** None
**Base branch:** `develop`

## Goal
Add a nullable, durable `business_central_synced_at` timestamp to the company model and the
`ModuleCompany` DTO, then generate a company-module migration. This column records the time of the
last **successful** Business Central sync and is integration-owned — do **not** add it to any
store/admin create or edit validator.

## Files

### Modify: `apps/backend/src/modules/company/models/company.ts`
Add one nullable datetime field to the `Company` model (keep everything else unchanged).

```typescript
export const Company = model.define("company", {
  // ...existing fields...
  business_central_customer_number: model.text().nullable(),
  // NEW integration-owned field:
  business_central_synced_at: model.dateTime().nullable(),
  blocked: model
    .enum(["not_blocked", "Ship", "Invoice", "All"])
    .default("not_blocked"),
  // ...existing fields...
});
```

Notes:
- Nullable so a never-synced company is distinguishable from a synced one and is always treated as
  stale by the freshness check.
- Placement within the model definition is not significant; keep it adjacent to the other
  Business-Central-owned field for readability.

### Modify: `apps/backend/src/types/company/module.ts`
Add the field to `ModuleCompany` only. `ModuleUpdateCompany` (`extends Partial<ModuleCompany>`)
inherits it automatically, which is required by Task 02. Do **not** touch `ModuleCreateCompany`,
`http.ts`, or any validator.

```typescript
export type ModuleCompany = {
  // ...existing fields...
  business_central_customer_number: string | null;
  // NEW:
  business_central_synced_at: Date | null;
  blocked: ModuleCompanyBlockedState;
  // ...existing fields...
};
```

### Generate: `apps/backend/src/modules/company/migrations/Migration<timestamp>.ts`
Generate from the changed model — do **not** hand-author:

```
cd apps/backend
npx medusa db:generate company
```

Review the generated migration. It must:
- add `business_central_synced_at` (timestamptz, **nullable**),
- preserve all existing rows (they get `NULL`, i.e. treated as stale on next read),
- be reversible (`down` drops the column).

If generation cannot represent the change, document the reason in `PROGRESS.md` before
hand-authoring.

## Test cases

### TC-1: existing rows migrate safely
- **Given** an existing `company` row created before this change
- **When** the migration is applied
- **Then** `business_central_synced_at IS NULL`

### TC-2: reversibility
- **When** the migration `down` runs
- **Then** the column is dropped without error

## Validation
- `pnpm --filter @b2b-starter/backend build` (type-checks the DTO change).
- Apply the migration on a disposable/test DB.
- Confirm no store/admin validator or `ModuleCreateCompany` was changed.
