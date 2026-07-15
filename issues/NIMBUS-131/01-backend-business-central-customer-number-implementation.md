# Implementation Task 01: Backend company Business Central customer number

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest (`@medusajs/test-utils` integration runner)
- **Test location:** `apps/backend/integration-tests/http/companies/companies.spec.ts`
- **Naming conventions:** Follow `apps/backend/copilot-instructions.md` (kebab-case files/directories, camelCase vars/functions, PascalCase types/interfaces)

## Solution Design

Add a nullable, manually managed `business_central_customer_number` field to the Company model and migration. Propagate it through backend module DTO/types, admin/store API contracts, query defaults, and validators. Enforce numeric-only input at validation boundaries (create/update), including the store update middleware path. Verify through integration tests that valid numeric values persist/return, invalid values are rejected, and behavior is unchanged when field is absent.

## Code Skeletons

Provide verbatim code skeletons for ALL new files.

### New File: `apps/backend/src/modules/company/migrations/Migration<timestamp>.ts`

```typescript
import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration<timestamp> extends Migration {
  async up(): Promise<void> {
    // IMPLEMENT: Add nullable business_central_customer_number column to company table.
  }

  async down(): Promise<void> {
    // IMPLEMENT: Drop business_central_customer_number column from company table.
  }
}
```

## Impacted Files

- `apps/backend/src/modules/company/models/company.ts`
  - **Change:** Extend `Company` model definition with new nullable field.
  - **New field:** `business_central_customer_number: model.text().nullable()`
- `apps/backend/src/modules/company/types/common.ts`
  - **Change:** `CompanyDTO` interface.
  - **New signature addition:** `business_central_customer_number: string | null;`
- `apps/backend/src/types/company/module.ts`
  - **Change:** `ModuleCompany` and `ModuleCreateCompany`.
  - **New signature additions:** `business_central_customer_number: string | null;`
- `apps/backend/src/types/company/http.ts`
  - **Change:** `AdminCreateCompany`, `AdminUpdateCompany`, `StoreCreateCompany`, `StoreUpdateCompany`.
  - **New signature additions:** business central number field (optional for store create/update, nullable where appropriate).
- `apps/backend/src/api/admin/companies/validators.ts`
  - **Change:** `AdminCreateCompany`, `AdminUpdateCompany` schemas.
  - **New validation:** numeric-only string (regex `^\d+$`) with optional/nullable semantics.
- `apps/backend/src/api/store/companies/validators.ts`
  - **Change:** `StoreCreateCompany`, `StoreUpdateCompany` schemas.
  - **New validation:** numeric-only string (regex `^\d+$`) with optional/nullable semantics.
- `apps/backend/src/api/store/companies/middlewares.ts`
  - **Change:** POST `/store/companies/:id` middleware chain.
  - **New middleware:** `validateAndTransformBody(StoreUpdateCompany)`
- `apps/backend/src/api/admin/companies/query-config.ts`
  - **Change:** `adminCompanyFields` include new field.
- `apps/backend/src/api/store/companies/query-config.ts`
  - **Change:** `storeCompanyFields` include new field.
- `apps/backend/integration-tests/http/companies/companies.spec.ts`
  - **Change:** Extend store company integration coverage for create/get/update invalid+valid numeric cases and no-regression when missing.

## Test Cases

### TC-1: Create company with numeric Business Central number
- **Given:** Authenticated store user submits `business_central_customer_number: "123456"`.
- **When:** `POST /store/companies` is called.
- **Then:** Response includes the same value; value is stored on the company.

### TC-2: Reject non-numeric Business Central number on create
- **Given:** Authenticated store/admin request submits `business_central_customer_number: "ABC123"`.
- **When:** Company create endpoint is called.
- **Then:** Request is rejected with validation error.

### TC-3: Update company with numeric Business Central number
- **Given:** Existing company without number.
- **When:** `POST /store/companies/:id` (and admin update path) sends `business_central_customer_number: "98765"`.
- **Then:** Response returns updated value; persisted value is retrievable.

### TC-4: Reject non-numeric update and keep existing value
- **Given:** Existing company with valid value.
- **When:** Update with `business_central_customer_number: "12A34"`.
- **Then:** Validation fails; previous valid value remains unchanged.

### TC-5: No regression when number is absent
- **Given:** Create/update payloads omit field entirely.
- **When:** Existing company flows run.
- **Then:** Endpoints continue to succeed and return `null`/absent field without breaking existing behavior.

## Implementation Steps

1. Add nullable `business_central_customer_number` to Company model.
2. Generate/add company module migration to add/drop the column.
3. Extend backend module/DTO/http type contracts with `string | null`.
4. Add numeric-only validation to admin/store create/update company validators.
5. Add missing store update body validation middleware for `/store/companies/:id`.
6. Add field to store/admin company query-config defaults so it is returned via `query.graph`.
7. Extend `apps/backend/integration-tests/http/companies/companies.spec.ts` with numeric-valid, numeric-invalid, update, and missing-field regression scenarios.
8. Run backend verification (`pnpm lint`, `pnpm build`, `cd apps/backend && pnpm test:integration:http`).

