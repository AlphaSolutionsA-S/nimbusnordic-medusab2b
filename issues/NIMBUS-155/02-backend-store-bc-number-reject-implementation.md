# Implementation Task 02: Store API rejects BC customer number

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest (`@medusajs/test-utils` integration runner)
- **Test location:** `apps/backend/integration-tests/http/companies/companies.spec.ts`
- **Naming conventions:** Follow `apps/backend/copilot-instructions.md` (kebab-case files/directories, camelCase vars/functions, PascalCase types/interfaces).

## Solution Design

Remove `business_central_customer_number` from both Store company write validators. Both `StoreCreateCompany` and `StoreUpdateCompany` are `.strict()` zod objects applied by the Store companies middlewares, so removing the field makes any request that includes it fail validation with HTTP 400. This closes the write boundary for the field on the Store API (create and update) while leaving Admin validators, the data model, migrations, and query-config untouched — Admin retains full read/write, and the field is still returned by GET.

Rewrite the affected integration tests to assert the new behavior.

## Impacted Files

- `apps/backend/src/api/store/companies/validators.ts`
  - **Change:** In `StoreCreateCompany`, delete the `business_central_customer_number` property (the numeric-regex zod chain).
  - **Change:** In `StoreUpdateCompany`, delete the `business_central_customer_number` property.
  - Keep both objects `.strict()` so unknown keys (including the removed field) are rejected. Do not touch the exported `StoreCreateCompanyType` / `StoreUpdateCompanyType` inference lines.
- `apps/backend/integration-tests/http/companies/companies.spec.ts` — in the `describe("Business Central customer number", ...)` block:
  - **TC-1 (create with numeric):** Rewrite from "creates … with numeric" to assert the create request including `business_central_customer_number` is rejected with status 400.
  - **TC-2 (create non-numeric):** Keep — still expects 400 (now due to the unknown/strict key rather than the regex). Optionally update the test title to reflect that any BC value is rejected on create.
  - **TC-3 (update with numeric):** Rewrite to assert the update request including `business_central_customer_number` is rejected with status 400.
  - **TC-3a (leading zeros on update):** Remove — Store-side BC persistence no longer applies (behavior is now Admin-only).
  - **TC-4 (update non-numeric + unchanged):** Keep — still expects 400 and asserts the previously configured value is unchanged. Note: the pre-existing value must be seeded via a path that still accepts it. Since Store create no longer accepts the field, seed the initial value using the **admin** create/update endpoint (see below), or adjust the assertion to a company created without a BC number and confirm it remains `null` after the rejected update.
  - **TC-5 (absent field):** Keep unchanged — normal create/update without the field still succeeds and returns `null`.

### Seeding note for TC-4

The existing TC-4 seeds the initial BC value through `POST /store/companies`, which will now 400. Choose one:
- **Preferred:** Create the company via Store, then set the BC number via the **admin** company update endpoint using `adminHeaders` (Admin still accepts the field), then attempt the Store update and assert 400 + unchanged value on a subsequent GET.
- **Simpler fallback:** Create the company via Store without a BC number (value `null`), attempt a Store update that includes `business_central_customer_number`, assert 400, and assert the GET value is still `null`.

Pick the approach that keeps the test deterministic with the seeders already imported in the spec.

## Test Cases

### TC-1: Reject BC number on Store create
- **Given:** An authenticated store user.
- **When:** `POST /store/companies` includes `business_central_customer_number`.
- **Then:** Response status is 400; no company with that BC number is created.

### TC-3: Reject BC number on Store update
- **Given:** An existing company.
- **When:** `POST /store/companies/:id` includes `business_central_customer_number`.
- **Then:** Response status is 400; the persisted BC value is unchanged.

### TC-4: Rejected update leaves existing value intact
- **Given:** A company whose BC value was set outside the Store write path (Admin) or is `null`.
- **When:** A Store update including `business_central_customer_number` is attempted.
- **Then:** Status is 400 and a subsequent GET shows the BC value unchanged.

### TC-5: No regression without the field
- **Given:** Create/update payloads omit the field.
- **When:** Normal Store create/update run.
- **Then:** Requests succeed and the BC value is `null`/absent.

## Implementation Steps

1. Remove `business_central_customer_number` from `StoreCreateCompany` and `StoreUpdateCompany` in `apps/backend/src/api/store/companies/validators.ts` (keep `.strict()`).
2. Rewrite TC-1 and TC-3 to assert 400; remove TC-3a; adjust TC-4 seeding per the note above; keep TC-2 and TC-5.
3. Run `cd apps/backend && pnpm test:integration:http` (companies spec), then `pnpm lint` and `pnpm build`.

## Constraints

- Do not modify `apps/backend/src/api/admin/companies/validators.ts`, the admin form/route/page, the company model, migrations, or query-config.
- Do not modify the storefront in this task.
- Keep both Store validators `.strict()`; rely on strict-mode rejection rather than adding custom error handling.
