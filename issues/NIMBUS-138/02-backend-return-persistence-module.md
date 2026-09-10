# Implementation Task 02: BC Return Request Persistence Module

**Status:** Removed 2026-08-17

> **Decision:** The storefront calls the protected backend API synchronously and the backend directly
> invokes BC. BC's deterministic `requestId` is the idempotency key; the portal does not persist
> requests or reconcile ambiguous outcomes locally. The module and its generated migration were
> removed before commit, and its local migration was rolled back.

> **Depends on task 01.** Records one row per logical portal return request plus its (stubbed, then
> real) BC outcome, keyed by a server-generated deterministic idempotency key that doubles as the
> `requestId` sent to BC. CRUD-only; all logic lives in the task 03 workflow.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Migration command:** `cd apps/backend && npx medusa db:generate businessCentralReturn`
  then `npx medusa db:migrate`
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Naming conventions:** kebab-case files, camelCase module name, PascalCase model/types

## Solution Design

Add a persistence module `businessCentralReturn` following the existing `approval` module layout
(`index.ts`, `service.ts`, `models/`, `migrations/`). Module name MUST be camelCase
(`businessCentralReturn`) — dashes cause runtime errors.

The record stores the assumed-contract identifiers (`source_order_no`, per-line `source_line_no` /
`return_reason_code`) so the workflow and reconciliation speak the same vocabulary as the BC body.
`request_id` is the deterministic idempotency key.

## Code Skeletons

### New File: `apps/backend/src/modules/business-central-return/models/bc-return-request.ts`

```typescript
import { model } from "@medusajs/framework/utils";

export const BcReturnStatus = {
  PENDING: "pending",
  SUBMITTED: "submitted",
  RECONCILING: "reconciling",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const BcReturnRequest = model.define("bc_return_request", {
  id: model.id({ prefix: "bcret" }).primaryKey(),
  // Server-generated deterministic idempotency key == requestId sent to BC.
  request_id: model.text().unique(),
  customer_id: model.text(),
  company_id: model.text(),
  bc_customer_number: model.text(),
  // Human BC order number ("SO123456"), from BCOrderDetail.number.
  source_order_no: model.text(),
  // Verified [{ source_line_no, quantity_to_return, return_reason_code }] as submitted to BC.
  lines: model.json(),
  status: model.enum(BcReturnStatus),
  bc_return_order_id: model.text().nullable(),
  bc_return_order_number: model.text().nullable(),
  bc_return_order_status: model.text().nullable(),
  // Customer-safe message only; never raw BC text / tokens / IDs.
  error_message: model.text().nullable(),
});
```

### New File: `apps/backend/src/modules/business-central-return/models/index.ts`

```typescript
export { BcReturnRequest, BcReturnStatus } from "./bc-return-request";
```

### New File: `apps/backend/src/modules/business-central-return/service.ts`

```typescript
import { MedusaService } from "@medusajs/framework/utils";
import { BcReturnRequest } from "./models";

class BusinessCentralReturnModuleService extends MedusaService({
  BcReturnRequest,
}) {}

export default BusinessCentralReturnModuleService;
```

### New File: `apps/backend/src/modules/business-central-return/index.ts`

```typescript
import { Module } from "@medusajs/framework/utils";
import BusinessCentralReturnModuleService from "./service";

export const BUSINESS_CENTRAL_RETURN_MODULE = "businessCentralReturn";

export default Module(BUSINESS_CENTRAL_RETURN_MODULE, {
  service: BusinessCentralReturnModuleService,
});
```

### Modified File: `apps/backend/medusa-config.ts`

Register alongside the existing modules:

```typescript
import { BUSINESS_CENTRAL_RETURN_MODULE } from "./src/modules/business-central-return";
// ...
  modules: {
    // ...existing modules...
    [BUSINESS_CENTRAL_MODULE]: {
      resolve: "./modules/business-central",
    },
    [BUSINESS_CENTRAL_RETURN_MODULE]: {
      resolve: "./modules/business-central-return",
    },
    // ...notification...
  },
```

## Test Cases

### TC-1: Migration + CRUD + unique key
- **Given:** the module is registered and migrations generated/applied.
- **When:** a record is created via `createBcReturnRequests` and read back by `request_id`.
- **Then:** the record persists with the expected fields and the unique constraint on `request_id`
  rejects a duplicate insert.

## Implementation Steps

1. Create the module files under `apps/backend/src/modules/business-central-return/`.
2. Register the module in `medusa-config.ts`.
3. Generate and run the migration:
   `npx medusa db:generate businessCentralReturn && npx medusa db:migrate`.
4. Run `pnpm build`.
