# Task 03 — Sync workflow + steps

**App:** backend
**Depends on:** 01 (BC `getCustomer`/`BCCustomer`), 02 (company fields / `ModuleUpdateCompany`)
**Base branch:** `develop`

## Goal
Add a `syncCompanyFromBusinessCentralWorkflow` whose only input is the authenticated Medusa
customer id. It resolves the customer's company + BC number, fetches and maps the approved BC
fields, and updates the company via the existing `updateCompaniesStep` — guarded so a skip or a
failed/invalid fetch never invokes the update step. It contains expected failures from the BC
service call while leaving query, workflow, and database failures observable. It returns a small
`{ status }` result and never the BC payload.

## Files

### New: `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`
Resolves the company, fetches the BC customer, and maps the approved fields. Skip conditions
return a `skipped` marker (no throw); transport/HTTP/invalid-payload/unknown-enum conditions
throw (they propagate from `getCustomer`).

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";
import type { ModuleUpdateCompany } from "../../../types";

export type PrepareCompanyBcSyncInput = {
  customerId: string;
};

export type PreparedCompanyBcSync =
  | { status: "skipped"; update: null }
  | { status: "failed"; update: null }
  | { status: "ready"; update: ModuleUpdateCompany };

function joinAddressLines(line1: string, line2: string): string {
  // IMPLEMENT:
  // - both non-empty -> `${line1}, ${line2}`
  // - only one non-empty -> that line (no comma)
  // - both empty -> "" (no comma artifact)
}

export const prepareCompanyBcSyncStep = createStep(
  "prepare-company-bc-sync",
  async (
    input: PrepareCompanyBcSyncInput,
    { container }
  ): Promise<StepResponse<PreparedCompanyBcSync>> => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: [
        "employee.company.id",
        "employee.company.business_central_customer_number",
      ],
      filters: { id: input.customerId },
    });

    const company = customer?.employee?.company as
      | { id?: string; business_central_customer_number?: string | null }
      | undefined;
    const companyId = company?.id ?? null;
    const bcCustomerNumber = company?.business_central_customer_number ?? null;

    // Skip: no linked company OR no configured BC number (silent).
    if (!companyId || !bcCustomerNumber) {
      return new StepResponse({ status: "skipped", update: null });
    }

    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    let bcCustomer;

    try {
      bcCustomer = await bcService.getCustomer(bcCustomerNumber);
    } catch {
      // Log a fixed message with safe Medusa context only. Do not include the thrown error,
      // BC customer number, response body, credentials, or contact data.
      logger.error(
        `Business Central company sync failed for company ${companyId}`
      );
      return new StepResponse({ status: "failed", update: null });
    }

    // Skip: no BC match (warning log, no company id of BC number in routine logs beyond safe context).
    if (!bcCustomer) {
      logger.warn(
        `Business Central sync skipped: no matching customer for company ${companyId}`
      );
      return new StepResponse({ status: "skipped", update: null });
    }

    // IMPLEMENT: map ONLY the approved fields into ModuleUpdateCompany.
    // Do NOT spread bcCustomer. Preserve id/logo_url/business_central_customer_number/
    // spending_limit_reset_frequency/employees/customer_group/approval settings/timestamps.
    const update: ModuleUpdateCompany = {
      id: companyId,
      name: bcCustomer.displayName,
      email: bcCustomer.email,
      phone: bcCustomer.phoneNumber,
      address: joinAddressLines(bcCustomer.addressLine1, bcCustomer.addressLine2),
      city: bcCustomer.city,
      state: bcCustomer.state,
      zip: bcCustomer.postalCode,
      country: bcCustomer.country,
      blocked: bcCustomer.blocked,
      credit_limit: bcCustomer.creditLimit,
      vat_number: bcCustomer.taxRegistrationNumber,
      currency_code: bcCustomer.currencyCode,
    };

    return new StepResponse({ status: "ready", update });
  }
);
```

> Note: this step has no compensation. It only reads BC + resolves the company; the mutation and
> its rollback live entirely in `updateCompaniesStep`.

### Modify: `apps/backend/src/workflows/company/steps/index.ts`
```typescript
export * from "./prepare-company-bc-sync";
```

### New: `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`
Compose the prepare step with the existing `updateCompaniesStep`, guarded by `when` so the update
only runs on `status === "ready"`. Return a `{ status }` result.

```typescript
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareCompanyBcSyncStep } from "../steps/prepare-company-bc-sync";
import { updateCompaniesStep } from "../steps/update-companies";

export type SyncCompanyFromBusinessCentralInput = {
  customerId: string;
};

export type SyncCompanyFromBusinessCentralResult = {
  status: "updated" | "skipped" | "failed";
};

export const syncCompanyFromBusinessCentralWorkflow = createWorkflow(
  "sync-company-from-business-central",
  function (input: SyncCompanyFromBusinessCentralInput) {
    const prepared = prepareCompanyBcSyncStep({ customerId: input.customerId });

    when({ prepared }, ({ prepared }) => prepared.status === "ready").then(() => {
      const update = transform({ prepared }, ({ prepared }) => {
        if (prepared.status !== "ready") {
          throw new Error("Company synchronization update was not prepared");
        }

        return prepared.update;
      });
      updateCompaniesStep(update);
    });

    const result = transform({ prepared }, ({ prepared }) => ({
      status: prepared.status === "ready" ? "updated" : prepared.status,
    }));

    return new WorkflowResponse(result);
  }
);
```

### Modify: `apps/backend/src/workflows/company/workflows/index.ts`
```typescript
export * from "./sync-company-from-business-central";
```

## Test cases (module-style, mock the BC service + query)

### TC-1: no linked company → skipped
- **Given** the customer has no `employee.company`
- **Then** result is `{ status: "skipped" }` and `updateCompaniesStep` is not invoked

### TC-2: no BC number → skipped
- **Given** the company has no `business_central_customer_number`
- **Then** `skipped`; `getCustomer` is not called

### TC-3: no BC match → skipped
- **Given** `getCustomer` resolves `null`
- **Then** `skipped`; a warning is logged; no company update

### TC-4: valid customer → updated with exact mapping
- **Given** `getCustomer` returns a full `BCCustomer` with two address lines
- **Then** result is `{ status: "updated" }` and the company update payload maps every approved
  field with `address === "<line1>, <line2>"`; unrelated fields are absent from the payload

### TC-5: single address line adds no separator
- **Given** `addressLine2` is empty
- **Then** the update `address` equals `addressLine1` with no comma

### TC-6: BC error is contained and does not update
- **Given** `getCustomer` throws
- **Then** the workflow returns `{ status: "failed" }`, logs safe context, and
  `updateCompaniesStep` is never called (no partial write)

### TC-7: unexpected query/update failure remains observable
- **Given** company resolution or `updateCompaniesStep` throws
- **Then** the workflow run rejects rather than returning a success-shaped result

### TC-8: idempotence
- **Given** two runs with the same BC customer
- **Then** the final company values are identical

## Validation
- `pnpm --filter @b2b-starter/backend test:integration:modules`
- Place tests where the module test runner picks them up
  (`src/modules/*/__tests__/**`), or add a dedicated integration test in Task 04/06 if a
  workflow needs a booted container. Keep BC and query mocked for unit-level coverage.
