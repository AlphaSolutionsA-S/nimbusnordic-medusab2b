# Task 02 — Stamp `business_central_synced_at` on successful sync

**App:** backend
**Depends on:** 01 (`business_central_synced_at` on model + `ModuleUpdateCompany`)
**Base branch:** `develop`

## Goal
Write the successful-sync timestamp **only** when Business Central data is successfully applied. The
existing workflow already runs `updateCompaniesStep` solely on the `ready` branch, so adding the
timestamp to the `ready` update object is sufficient — no new step, no new branch, and failed/skipped
attempts leave the timestamp untouched.

## Files

### Modify: `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`
In the `ready` path, add `business_central_synced_at: new Date()` to the mapped `update` object.
Leave the `skipped` and `failed` returns unchanged (they carry `update: null` and never reach
`updateCompaniesStep`).

```typescript
    const update: ModuleUpdateCompany = {
      id: companyId,
      name: bcCustomer.displayName,
      email: bcCustomer.email,
      phone: bcCustomer.phoneNumber,
      address: joinAddressLines(
        bcCustomer.addressLine1,
        bcCustomer.addressLine2
      ),
      city: bcCustomer.city,
      state: bcCustomer.state,
      zip: bcCustomer.postalCode,
      country: bcCustomer.country,
      blocked: bcCustomer.blocked,
      credit_limit: bcCustomer.creditLimit,
      vat_number: bcCustomer.taxRegistrationNumber,
      currency_code: bcCustomer.currencyCode,
      // NEW: only set on success, written atomically with the mapped fields.
      business_central_synced_at: new Date(),
    };

    return new StepResponse({ status: "ready", update });
```

Notes:
- The timestamp is written through `updateCompaniesStep`, so it is persisted in the same update as
  the mapped fields and is covered by that step's compensation (rollback restores the prior value).
- Do not touch the `skipped` / `failed` returns and do not add the timestamp anywhere else.

## Test cases

### TC-1: success stamps the timestamp
- **Given** a company with a valid `business_central_customer_number`
- **And** `BusinessCentralService.getCustomer` resolves with customer data
- **When** the sync workflow runs
- **Then** `business_central_synced_at` is set to (approximately) now on the persisted company

### TC-2: failure leaves the timestamp unchanged
- **Given** a company with a prior `business_central_synced_at`
- **And** `getCustomer` rejects with a `MedusaError`
- **When** the sync workflow runs
- **Then** the persisted `business_central_synced_at` is unchanged

### TC-3: skip leaves the timestamp unchanged
- **Given** a company with no `business_central_customer_number`
- **When** the sync workflow runs
- **Then** the persisted `business_central_synced_at` is unchanged

(TC-1..TC-3 are exercised end-to-end via the route in Task 05; unit-level coverage here is optional.)

## Validation
- `pnpm --filter @b2b-starter/backend build`.
- Re-run the existing `integration-tests/http/customers/company-sync.spec.ts` to confirm the login
  sync path still passes with the added field.
