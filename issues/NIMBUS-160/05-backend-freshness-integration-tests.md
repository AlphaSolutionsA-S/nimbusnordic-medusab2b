# Task 05 — Backend freshness integration tests

**App:** backend
**Depends on:** 01, 02, 03
**Base branch:** `develop`

## Goal
Prove the `GET /store/companies/:id` freshness contract end-to-end using
`medusaIntegrationTestRunner`, mocking `BusinessCentralService.getCustomer`. Mirror the harness in
`apps/backend/integration-tests/http/customers/company-sync.spec.ts` (admin user, publishable key,
store user, authenticated headers, `createLinkedCompany` helper).

## Files

### Modify: `apps/backend/integration-tests/http/companies/companies.spec.ts`
Add a new `describe("GET /store/companies/:id — Business Central freshness")` block. Reuse the
existing suite's store-user/header setup. Seed a company linked to the authenticated customer with a
`business_central_customer_number`, then drive freshness by directly setting/clearing
`business_central_synced_at` via the company module service.

Helpers to (re)use or add locally:
- Create a company + link the customer as admin employee (same shape as `company-sync.spec.ts`'s
  `createLinkedCompany`), returning the company id.
- `setSyncedAt(companyId, date | null)` via
  `getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE).updateCompanies(...)`.
- Read back with `companyService.listCompanies({ id })` to assert the persisted timestamp/fields.

### Test cases

#### TC-1: fresh company does not call Business Central
- **Given** a linked company whose `business_central_synced_at` is set to `new Date()` (now)
- **And** a `jest.spyOn(bcService, "getCustomer")`
- **When** `GET /store/companies/:id` is called with authenticated headers
- **Then** the response is 200 and `getCustomer` was **not** called
- **And** the returned company matches the stored (pre-existing) fields

#### TC-2: missing timestamp triggers a sync
- **Given** a linked company with `business_central_synced_at = null`
- **And** `getCustomer` resolves with updated customer data
- **When** `GET /store/companies/:id` is called
- **Then** `getCustomer` was called once
- **And** the response reflects the updated mapped fields
- **And** the persisted `business_central_synced_at` is now set

#### TC-3: stale timestamp triggers a sync and advances the timestamp
- **Given** a linked company whose `business_central_synced_at` is 11 minutes in the past
- **And** `getCustomer` resolves with updated data
- **When** `GET /store/companies/:id` is called
- **Then** `getCustomer` was called once
- **And** the persisted `business_central_synced_at` is strictly newer than the seeded value
- **And** the response reflects the updated fields

#### TC-4: stale sync failure returns last-known data, timestamp unchanged
- **Given** a linked company with a stale `business_central_synced_at` (e.g. 11 minutes old) and
  known stored field values
- **And** `getCustomer` rejects with a `MedusaError`
- **When** `GET /store/companies/:id` is called
- **Then** the response is **200** with the previous stored fields
- **And** the persisted `business_central_synced_at` is unchanged (equal to the seeded stale value)

Notes:
- Use `mockResolvedValueOnce` / `mockRejectedValueOnce` and restore spies between cases (the suite
  already relies on per-`beforeEach` fresh containers).
- For the "not called" assertion in TC-1, assert `getCustomer` spy `not.toHaveBeenCalled()`.
- Keep the BC customer payload shape identical to the one used in `company-sync.spec.ts`
  (`number`, `displayName`, `email`, `phoneNumber`, `addressLine1/2`, `city`, `state`, `postalCode`,
  `country`, `blocked`, `creditLimit`, `taxRegistrationNumber`, `currencyCode`).

## Validation
- `pnpm --filter @b2b-starter/backend test:integration:http` (or the repo's configured integration
  test command) runs the new block green.
- `pnpm --filter @b2b-starter/backend build`.
