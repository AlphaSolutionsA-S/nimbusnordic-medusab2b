# Implementation Task 01: Backend BC Orders Endpoint

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest (`@medusajs/test-utils` integration runner)
- **Test location:** `apps/backend/integration-tests/http/` (create `bc-orders/bc-orders.spec.ts`)
- **Naming conventions:** Follow `apps/backend/copilot-instructions.md` (kebab-case files/directories, camelCase vars/functions, PascalCase types/interfaces)

## Solution Design

Extend the Business Central module service with a `listOrders` method that calls the BC OData `salesOrders` endpoint filtered by customer number, supporting status/date/search filters and offset/limit pagination. Add a new protected store route `/store/bc-orders` that:
1. Requires customer authentication.
2. Resolves the authenticated customer's company `business_central_customer_number` via `query.graph` (pattern taken from `apps/backend/src/api/store/approvals/route.ts`).
3. Returns 400 if the company has no BC customer number configured.
4. Calls the BC module service and proxies the paginated result to the storefront.

**Never** accept company/customer identifiers from the client request body — derive all scope server-side from `req.auth_context.app_metadata.customer_id`.

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

export type BCListOrdersParams = {
  customerNumber: string;
  limit: number;
  offset: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCListOrdersResult = {
  orders: BCOrder[];
  count: number;
  offset: number;
  limit: number;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
}
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

Add the `listOrders` method to `BusinessCentralModuleService`. Keep `getOperations()` unchanged.

```typescript
// Add after getOperations():

async listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult> {
  // IMPLEMENT:
  // 1. Call getDiscoveryUrl(), getTenantId(), getClientCredentials(), requestToken()
  //    (reuse private helpers already in the service).
  // 2. Build the OData URL: `{discoveryUrl}/salesOrders`
  //    - Always add $filter=customerNumber eq '{params.customerNumber}'
  //    - If params.status is set, AND status eq '{params.status}'
  //    - If params.date_from is set, AND orderDate ge {params.date_from}
  //    - If params.date_to is set, AND orderDate le {params.date_to}
  //    - If params.search is set, AND (contains(number,'{params.search}') or
  //      contains(customerName,'{params.search}'))
  //    - Always add $top={params.limit}&$skip={params.offset}&$count=true
  //    - Always add $orderby=orderDate desc
  // 3. Fetch with Authorization: Bearer {accessToken} and Accept: application/json.
  // 4. If response is not ok, throw MedusaError UNEXPECTED_STATE with status code.
  // 5. Parse the JSON: body has { "@odata.count": number, "value": BCOrderRaw[] }
  // 6. Map each raw BC order to BCOrder shape:
  //      id: item.id, number: item.number, orderDate: item.orderDate,
  //      customerNumber: item.customerNumber, customerName: item.customerName,
  //      status: item.status, currencyCode: item.currencyCode,
  //      totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
  //      totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0
  // 7. Return { orders, count: body["@odata.count"] ?? 0, offset: params.offset, limit: params.limit }
}
```

### New File: `apps/backend/src/api/store/bc-orders/validators.ts`

```typescript
import { z } from "@medusajs/framework/zod";

export type StoreBCOrdersQueryType = z.infer<typeof StoreBCOrdersQuery>;

export const StoreBCOrdersQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.string().optional(),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_from must be YYYY-MM-DD")
      .optional(),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_to must be YYYY-MM-DD")
      .optional(),
    search: z.string().max(200).optional(),
  })
  .strict();
```

### New File: `apps/backend/src/api/store/bc-orders/middlewares.ts`

```typescript
import { authenticate, validateAndTransformQuery } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { StoreBCOrdersQuery } from "./validators";

export const storeBCOrdersMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/bc-orders*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/bc-orders",
    middlewares: [
      validateAndTransformQuery(StoreBCOrdersQuery, {
        defaults: ["limit", "offset", "status", "date_from", "date_to", "search"],
        isList: true,
      }),
    ],
  },
];
```

### New File: `apps/backend/src/api/store/bc-orders/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  IBusinessCentralModuleService,
  BCListOrdersParams,
} from "../../../modules/business-central/types";
import type { StoreBCOrdersQueryType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<never, StoreBCOrdersQueryType>,
  res: MedusaResponse
): Promise<void> => {
  // IMPLEMENT:
  // 1. Extract customer_id:
  //      const { customer_id } = req.auth_context.app_metadata as { customer_id: string };
  //
  // 2. Resolve company via query.graph (same pattern as approvals/route.ts):
  //      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  //      const { data: [customer] } = await query.graph({
  //        entity: "customer",
  //        fields: [
  //          "employee.company.id",
  //          "employee.company.business_central_customer_number",
  //        ],
  //        filters: { id: customer_id },
  //      });
  //      const bcCustomerNumber =
  //        customer?.employee?.company?.business_central_customer_number;
  //
  // 3. Guard: if (!bcCustomerNumber) return res.status(400).json({
  //        message: "No Business Central customer number configured for this company.",
  //    });
  //
  // 4. Extract and cast validated query params:
  //      const { limit, offset, status, date_from, date_to, search } =
  //        req.validatedQuery as StoreBCOrdersQueryType;
  //
  // 5. Resolve BC service:
  //      const bcService = req.scope.resolve<IBusinessCentralModuleService>(
  //        BUSINESS_CENTRAL_MODULE
  //      );
  //
  // 6. Build params and call service:
  //      const bcParams: BCListOrdersParams = {
  //        customerNumber: bcCustomerNumber,
  //        limit: limit ?? 20,
  //        offset: offset ?? 0,
  //        status,
  //        date_from,
  //        date_to,
  //        search,
  //      };
  //      const result = await bcService.listOrders(bcParams);
  //
  // 7. Return result:
  //      res.json(result);
};
```

## Impacted Files

- `apps/backend/src/modules/business-central/types.ts`
  - **Change:** Add `BCOrderStatus`, `BCOrder`, `BCListOrdersParams`, `BCListOrdersResult` types; add `listOrders` to `IBusinessCentralModuleService`.
- `apps/backend/src/modules/business-central/service.ts`
  - **Change:** Implement `listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>` method.
- `apps/backend/src/api/store/bc-orders/validators.ts` — **new file**
- `apps/backend/src/api/store/bc-orders/middlewares.ts` — **new file**
- `apps/backend/src/api/store/bc-orders/route.ts` — **new file**
- `apps/backend/src/api/store/middlewares.ts`
  - **Change:** Import `storeBCOrdersMiddlewares` and spread it into the exported array.

## Test Cases

### TC-1: Unauthenticated request is rejected
- **Given:** No authentication token.
- **When:** `GET /store/bc-orders` is called.
- **Then:** Response is 401 Unauthorized.

### TC-2: Authenticated customer with no BC customer number returns 400
- **Given:** Authenticated customer whose company has `business_central_customer_number = null`.
- **When:** `GET /store/bc-orders` is called.
- **Then:** Response is 400 with a message about missing BC customer number.

### TC-3: Default pagination returns limit 20
- **Given:** Authenticated customer with a valid BC customer number.
- **When:** `GET /store/bc-orders` is called without any query params.
- **Then:** The response shape includes `{ orders, count, offset: 0, limit: 20 }`.

### TC-4: Status filter is passed to BC service
- **Given:** `GET /store/bc-orders?status=Open` by authenticated customer.
- **Then:** Only orders with BC status `Open` are returned.

### TC-5: Invalid date format is rejected
- **Given:** `GET /store/bc-orders?date_from=01-01-2024`.
- **Then:** Response is 400 validation error (date must be YYYY-MM-DD).

### TC-6: Company scope is never derived from client input
- **Given:** A request that includes a `customer_id` query param or body field.
- **Then:** The route ignores client-supplied scope and uses only `req.auth_context.app_metadata.customer_id`.

## Implementation Steps

1. Update `apps/backend/src/modules/business-central/types.ts` — add all new types and extend `IBusinessCentralModuleService`.
2. Implement `listOrders` in `apps/backend/src/modules/business-central/service.ts`:
   - Reuse `getDiscoveryUrl`, `getTenantId`, `getClientCredentials`, `requestToken` private helpers.
   - Build the OData `$filter`, `$top`, `$skip`, `$count=true`, `$orderby=orderDate desc` query string.
   - Map the raw BC OData response (`value[]` + `@odata.count`) to `BCListOrdersResult`.
3. Create `apps/backend/src/api/store/bc-orders/validators.ts`.
4. Create `apps/backend/src/api/store/bc-orders/middlewares.ts`.
5. Create `apps/backend/src/api/store/bc-orders/route.ts` following the skeleton above.
6. Add `storeBCOrdersMiddlewares` to `apps/backend/src/api/store/middlewares.ts`.
7. Run `cd apps/backend && pnpm build` — fix any TypeScript errors.
8. Run `pnpm lint` — fix any lint issues.
