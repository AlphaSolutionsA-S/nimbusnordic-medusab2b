# Task 02: Integration tests for the expected-company guard — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-30
**Branch:** `develop` (work directly on develop, no feature branch)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm --filter @b2b-starter/backend build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test framework:** Jest with `medusaIntegrationTestRunner` (`@medusajs/test-utils`), `inApp: true`
- **Test location:** `apps/backend/integration-tests/http/customers/company-sync.spec.ts`. Extend
  the existing file; do not create a new one.
- **Test command:** run it from `apps/backend`, with **shell-only env vars**. Never write a
  `.env` file.

  ```bash
  # throwaway database
  docker run -d --rm --name nimbus161-pg -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=S3cret -p 5432:5432 postgres:16

  cd apps/backend
  DB_HOST=localhost DB_PORT=5432 DB_USERNAME=admin DB_PASSWORD=S3cret \
  DATABASE_URL=postgres://admin:S3cret@localhost:5432/postgres \
  BUSINESS_CENTRAL_DISCOVERY_URL=https://api.businesscentral.dynamics.com/v2.0/00000000-0000-0000-0000-000000000000/TestDK/api/v2.0 \
  TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules \
  node ./node_modules/jest/bin/jest.js --runInBand --forceExit \
    integration-tests/http/customers/company-sync.spec.ts \
    integration-tests/http/companies/companies.spec.ts

  docker stop nimbus161-pg
  ```

  In PowerShell, set each variable with `$env:NAME = 'value'` in the same session instead of
  using the inline prefix.

## Solution Design

Access control (`ensureCompanyAccess`) means a customer cannot reach `GET /store/companies/:id`
for another company. So the mismatch can't be triggered over HTTP, and relaxing access control
is out of scope. The test therefore **runs the workflow directly** with the test container. This
is the same pattern as
`integration-tests/http/business-central-order/send-order-to-bc.spec.ts`
(`sendOrderToBusinessCentralWorkflow(getContainer()).run({ input })`).

Business Central is mocked the same way as in the existing tests:
`jest.spyOn(bcService, "getCustomer")` on the container-resolved `BUSINESS_CENTRAL_MODULE`
service.

The setup, using helpers that already exist in `company-sync.spec.ts`:
- `customer` (from `createStoreUser` in `beforeEach`) is the authenticated customer.
- `createLinkedCompany("00011551")` is Company A. It is created through `POST /store/companies`,
  which makes the customer its employee, and it sets the BC customer number.
- Company B is created directly with `companyService.createCompanies(...)`. It has no employees,
  so the customer is not linked to it. A follow-up `updateCompanies` gives it a BC number and a
  stale timestamp, because `ModuleCreateCompany` does not include
  `business_central_synced_at`.

## Code Skeletons

### Modify: `apps/backend/integration-tests/http/customers/company-sync.spec.ts`

Add one import below the existing `../../../src/types` import:

```typescript
import { syncCompanyFromBusinessCentralWorkflow } from "../../../src/workflows/company/workflows/sync-company-from-business-central";
```

Add a new `describe` block **inside** `testSuite`, after the existing
`describe("POST /store/customers/me/company/sync-business-central", ...)` block. Keep that
existing block unchanged.

```typescript
    describe("syncCompanyFromBusinessCentralWorkflow - expected company guard", () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      const staleAt = new Date(Date.now() - 11 * 60 * 1000);

      async function createUnlinkedCompany(): Promise<string> {
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        const created = await companyService.createCompanies({
          name: "Other Company",
          email: "other@example.com",
          phone: "99999999",
          address: null,
          city: null,
          state: null,
          zip: null,
          country: "DK",
          logo_url: null,
          currency_code: "DKK",
          business_central_customer_number: "00022222",
          spending_limit_reset_frequency: "monthly",
        });
        await companyService.updateCompanies({
          id: created.id,
          business_central_synced_at: staleAt,
        });

        return created.id;
      }

      it("TC-1: skips without a Business Central call when the expected company differs", async () => {
        const companyAId = await createLinkedCompany("00011551");
        const companyBId = await createUnlinkedCompany();
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        await companyService.updateCompanies({
          id: companyAId,
          business_central_synced_at: staleAt,
        });
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest.spyOn(bcService, "getCustomer");

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({
          input: { customerId: customer.id, expectedCompanyId: companyBId },
        });

        const [companyA] = await companyService.listCompanies({ id: companyAId });
        const [companyB] = await companyService.listCompanies({ id: companyBId });

        expect(result).toEqual({ status: "skipped" });
        expect(getCustomerSpy).not.toHaveBeenCalled();
        expect(companyA.business_central_synced_at).toEqual(staleAt);
        expect(companyA.name).toBe("Test Company");
        expect(companyB.business_central_synced_at).toEqual(staleAt);
        expect(companyB.name).toBe("Other Company");
      });

      it("TC-2: synchronizes when the expected company matches the customer's company", async () => {
        const companyAId = await createLinkedCompany("00011551");
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        await companyService.updateCompanies({
          id: companyAId,
          business_central_synced_at: staleAt,
        });
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest
          .spyOn(bcService, "getCustomer")
          .mockResolvedValueOnce({
            number: "00011551",
            displayName: "Matched Company",
            email: "matched@example.com",
            phoneNumber: "87654321",
            addressLine1: "Updated Street 1",
            addressLine2: "",
            city: "Updated city",
            state: "",
            postalCode: "2000",
            country: "DK",
            blocked: "not_blocked",
            creditLimit: 0,
            taxRegistrationNumber: "DK12345678",
            currencyCode: "DKK",
          });

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({
          input: { customerId: customer.id, expectedCompanyId: companyAId },
        });

        const [companyA] = await companyService.listCompanies({ id: companyAId });

        expect(result).toEqual({ status: "updated" });
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(getCustomerSpy).toHaveBeenCalledWith("00011551");
        expect(companyA.name).toBe("Matched Company");
        expect(companyA.business_central_synced_at?.getTime()).toBeGreaterThan(
          staleAt.getTime()
        );
      });
    });
```

Notes for the worker:
- `customer` is already declared in the file as `let customer: { id: string };` and assigned in
  the outer `beforeEach`.
- The mock object shape must match `getCustomer`'s return type. The existing tests in the same
  file use the same keys. If TypeScript complains about `blocked`, add `as const` to the literal,
  as `companies.spec.ts` does (`blocked: "Invoice" as const`).
- `staleAt` is computed once per `describe`. That is fine, because each test resets the database
  (`medusaIntegrationTestRunner` default), and the assertions compare against this same
  instance.
- If `companyService.createCompanies` rejects `null` for any nullable field in
  `ModuleCreateCompany`, use an empty string instead. Do not change the type.

## Impacted Files

| File | Change |
| --- | --- |
| `apps/backend/integration-tests/http/customers/company-sync.spec.ts` | New import and a new `describe` block with 2 tests |

`integration-tests/http/companies/companies.spec.ts` does not change. It is only run as a
regression check.

## Test Cases

### TC-1: A mismatched expected company is skipped without a BC call
- **Given:** a customer linked to Company A (BC number `00011551`, stale), and an unlinked
  Company B (BC number `00022222`, stale).
- **When:** the workflow runs with `expectedCompanyId = companyB.id`.
- **Then:** `result` is `{ status: "skipped" }`, `getCustomer` is not called, both timestamps
  still equal `staleAt`, and neither name changed.

### TC-2: A matching expected company syncs
- **Given:** a customer linked to Company A (stale).
- **When:** the workflow runs with `expectedCompanyId = companyA.id`, and `getCustomer` resolves.
- **Then:** `result` is `{ status: "updated" }`, `getCustomer` was called once with `"00011551"`,
  the name was updated, and the timestamp advanced.

### TC-3: Login sync regression (existing tests)
- **Given:** the existing 7 tests in the
  `POST /store/customers/me/company/sync-business-central` block.
- **When:** the spec runs.
- **Then:** all of them pass unchanged.

### TC-4: GET freshness regression (existing NIMBUS-160 tests)
- **Given:** the 4 tests in `GET /store/companies/:id - Business Central freshness` in
  `companies.spec.ts`.
- **When:** the spec runs.
- **Then:** all 4 pass. This proves that the route's `expectedCompanyId: id` for the caller's own
  company still syncs.

## Implementation Steps

1. Add the import and the `describe` block shown above to `company-sync.spec.ts`.
2. Start the throwaway postgres container, then run both spec files with the command above.
3. All tests in both files must pass. If the database cannot be reached, as happened in
   NIMBUS-160 T05, mark the task BLOCKED with the exact error. Do not mark it DONE.
4. Stop the container.
5. Run `pnpm --filter @b2b-starter/backend build` again, then lint the changed spec file.
