# Implementation Task 01: Backend BC Order Detail Endpoint

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest (`@medusajs/test-utils` integration runner)
- **Test location:** `apps/backend/integration-tests/http/` (add `bc-orders/bc-order-detail.spec.ts`)
- **Naming conventions:** Follow `apps/backend/copilot-instructions.md`

## Solution Design

Extend the Business Central module service with a single-order lookup that:

1. Filters `salesOrders()` by `customerNumber` and the requested order id.
2. Returns `null` when the order does not exist for that company.
3. Fetches order lines from `SalesOrders({salesOrderId})/salesOrderLines()` with `$expand=item` and `$orderby=sequence`.
4. Maps the result into a read-only `BCOrderDetail` shape.

Add a protected store route at `GET /store/bc-orders/[id]` that:

1. Uses the existing customer auth middleware coverage for `/store/bc-orders*`.
2. Resolves the authenticated customer's company `business_central_customer_number` server-side with the same `query.graph` pattern used by the list route.
3. Returns `400` if the company has no BC customer number configured.
4. Returns `404` if the order is missing or belongs to a different company.
5. Returns the detail payload when the order is in scope.

## Code Skeletons

### Modified File: `apps/backend/src/modules/business-central/types.ts`

```typescript
export type BCOrderStatus =
  | "Open"
  | "Released"
  | "Pending Approval"
  | "Pending Prepayment"
  | "Shipped"
  | "Invoiced";

export type BCOrder = {
  id: string;
  number: string;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  status: BCOrderStatus;
  currencyCode: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
};

export type BCOrderLine = {
  id: string;
  sequence: number;
  itemId?: string;
  itemNumber?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[];
};

export type BCGetOrderParams = {
  customerNumber: string;
  orderId: string;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
}
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

```typescript
async getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null> {
  // IMPLEMENT:
  // 1. Reuse getDiscoveryUrl(), getTenantId(), getClientCredentials(), requestToken().
  // 2. Fetch salesOrders() with a $filter that includes:
  //      - customerNumber eq '{params.customerNumber}'
  //      - id eq '{params.orderId}'
  //    Keep the filter escaped with escapeODataString().
  // 3. If no matching order is returned, return null.
  // 4. Extract the matching order id from the BC payload.
  // 5. Fetch the line collection from:
  //      SalesOrders({salesOrderId})/salesOrderLines()?$expand=item&$orderby=sequence
  // 6. Map the order header fields into BCOrder.
  // 7. Map the line payload into BCOrderLine[].
  // 8. Return { ...order, lines }.
}
```

### New File: `apps/backend/src/api/store/bc-orders/[id]/route.ts`

```typescript
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { MedusaError } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest<never>,
  res: MedusaResponse
): Promise<void> => {
  // IMPLEMENT:
  // 1. Read req.params.id.
  // 2. Resolve the authenticated customer's company with query.graph using:
  //      customer -> employee.company.id + employee.company.business_central_customer_number
  // 3. Return 400 if the company has no BC customer number configured.
  // 4. Resolve the BC service from BUSINESS_CENTRAL_MODULE.
  // 5. Call bcService.getOrder({ customerNumber: bcCustomerNumber, orderId: req.params.id }).
  // 6. If the service returns null, respond with 404 and a customer-safe message.
  // 7. Otherwise return the detail payload as JSON.
  // 8. Do not expose whether a missing order belongs to another company.
};
```

## Impacted Files

- `apps/backend/src/modules/business-central/types.ts`
- `apps/backend/src/modules/business-central/service.ts`
- `apps/backend/src/api/store/bc-orders/[id]/route.ts` — new file
- `apps/backend/integration-tests/http/bc-orders/bc-order-detail.spec.ts` — new file

## Test Cases

### TC-1: Unauthenticated request is rejected
- **Given:** No customer session.
- **When:** `GET /store/bc-orders/:id` is called.
- **Then:** Response is 401.

### TC-2: Missing BC customer number returns 400
- **Given:** Authenticated customer whose company has no `business_central_customer_number`.
- **When:** `GET /store/bc-orders/:id` is called.
- **Then:** Response is 400 with a customer-safe message.

### TC-3: Cross-company order id returns 404
- **Given:** A valid BC order id owned by a different company.
- **When:** `GET /store/bc-orders/:id` is called.
- **Then:** Response is 404 and no other-company data is exposed.

### TC-4: Matching company order returns detail payload
- **Given:** A BC order that belongs to the caller's company.
- **When:** `GET /store/bc-orders/:id` is called.
- **Then:** The response contains the order header and line items.

## Implementation Steps

1. Extend the BC module types with the detail line and detail payload types.
2. Implement `getOrder()` in the BC service using the existing discovery/token helpers.
3. Add the `GET /store/bc-orders/[id]` route and wire server-side company resolution.
4. Add integration tests for auth, 400/404 handling, and a successful happy path.
