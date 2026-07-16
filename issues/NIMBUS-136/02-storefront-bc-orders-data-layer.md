# Implementation Task 02: Storefront BC Orders Data Layer

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — no storefront test runner wired; verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md` (kebab-case files, PascalCase types/interfaces, camelCase vars/functions)

## Solution Design

Define shared TypeScript types for BC orders and add a `listBCOrders` server action to the existing `business-central.ts` data module. The type shapes must exactly match the JSON response contract produced by Task 01 (`{ orders, count, offset, limit }`). Storefront components in Task 03 import from these two files.

## Code Skeletons

### New File: `apps/storefront/src/types/bc-order.ts`

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

export type BCOrderListParams = {
  limit?: number;
  offset?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCOrderListResponse = {
  orders: BCOrder[];
  count: number;
  offset: number;
  limit: number;
};
```

### Modified File: `apps/storefront/src/lib/data/business-central.ts`

Add `listBCOrders` as a new exported server action. Keep the existing `listBusinessCentralOperations` function unchanged.

```typescript
"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import type { BCOrderListParams, BCOrderListResponse } from "@/types/bc-order"

// ... existing StoreBusinessCentralOperationsResponse type and listBusinessCentralOperations ...

export const listBCOrders = async (
  params: BCOrderListParams = {}
): Promise<BCOrderListResponse> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // IMPLEMENT:
  // Use sdk.client.fetch<BCOrderListResponse>("/store/bc-orders", {
  //   method: "GET",
  //   headers,
  //   query: {
  //     limit: params.limit ?? 20,
  //     offset: params.offset ?? 0,
  //     ...(params.status ? { status: params.status } : {}),
  //     ...(params.date_from ? { date_from: params.date_from } : {}),
  //     ...(params.date_to ? { date_to: params.date_to } : {}),
  //     ...(params.search ? { search: params.search } : {}),
  //   },
  //   credentials: "include",
  // })
  // Return the resolved response directly (it already matches BCOrderListResponse).
}
```

## Impacted Files

- `apps/storefront/src/types/bc-order.ts` — **new file**
- `apps/storefront/src/lib/data/business-central.ts`
  - **Change:** Add `BCOrderListParams`, `BCOrderListResponse` imports and `listBCOrders` export. Preserve existing `listBusinessCentralOperations` unchanged.

## Test Cases

### TC-1: `listBCOrders` passes default limit 20 and offset 0
- **Given:** Called with empty params `{}`.
- **When:** The underlying `sdk.client.fetch` call is inspected.
- **Then:** `query.limit` is 20 and `query.offset` is 0.

### TC-2: Optional filters are omitted when not provided
- **Given:** Called without `status`, `date_from`, `date_to`, `search`.
- **Then:** Those keys are absent from the query string sent to the API.

### TC-3: Provided filters are forwarded
- **Given:** `{ status: "Open", search: "SO-100" }` params.
- **Then:** The query includes `status=Open&search=SO-100`.

## Implementation Steps

1. Create `apps/storefront/src/types/bc-order.ts` from the skeleton above.
2. Extend `apps/storefront/src/lib/data/business-central.ts`:
   - Add `import type { BCOrderListParams, BCOrderListResponse } from "@/types/bc-order"`.
   - Add the `listBCOrders` server action following the skeleton.
3. Run `cd apps/storefront && pnpm build` — fix any TypeScript errors before proceeding to Task 03.
