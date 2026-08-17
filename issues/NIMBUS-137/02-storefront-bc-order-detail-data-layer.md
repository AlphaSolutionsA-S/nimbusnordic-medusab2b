# Implementation Task 02: Storefront BC Order Detail Data Layer

**Status:** Complete

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md`

## Solution Design

Add storefront types for the BC order detail response and a `retrieveBCOrder()` server action that:

1. Uses the Medusa SDK, not raw `fetch()`.
2. Sends the authenticated customer headers from `getAuthHeaders()`.
3. Calls `GET /store/bc-orders/:id`.
4. Returns the typed BC order detail payload.
5. Treats backend 404 as a `null` result so the page can show a customer-safe not-found state.

## Code Skeletons

### Modified File: `apps/storefront/src/types/bc-order.ts`

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

```typescript
"use server";

import { sdk } from "@/lib/config";
import { getAuthHeaders } from "@/lib/data/cookies";
import type {
  BCOrderDetail,
  BCOrderListParams,
  BCOrderListResponse,
} from "@/types/bc-order";
import medusaError from "@/lib/util/medusa-error";

type StoreBCOrderDetailResponse = {
  order: BCOrderDetail;
};

export const retrieveBCOrder = async (
  id: string
): Promise<BCOrderDetail | null> => {
  // IMPLEMENT:
  // 1. Build auth headers from getAuthHeaders().
  // 2. Call sdk.client.fetch<StoreBCOrderDetailResponse>(`/store/bc-orders/${id}`, ...).
  // 3. Use method GET, headers, credentials: "include".
  // 4. Return response.order on success.
  // 5. If the request fails with a 404, return null.
  // 6. For other errors, throw medusaError(err).
};
```

## Impacted Files

- `apps/storefront/src/types/bc-order.ts`
- `apps/storefront/src/lib/data/business-central.ts`

## Test Cases

### TC-1: Detail helper calls the protected store route
- **Given:** A signed-in customer session.
- **When:** `retrieveBCOrder(id)` is called.
- **Then:** The helper uses the Medusa SDK and authenticated headers.

### TC-2: Backend 404 maps to null
- **Given:** The backend returns 404 for a cross-company order id.
- **When:** `retrieveBCOrder(id)` is called.
- **Then:** The helper returns `null`.

### TC-3: Successful response returns typed detail data
- **Given:** The backend returns a BC order detail payload.
- **When:** `retrieveBCOrder(id)` is called.
- **Then:** The helper returns the order detail object with lines.

## Implementation Steps

1. Extend the BC storefront types with line and detail shapes.
2. Add the `retrieveBCOrder()` SDK helper alongside the existing BC list helper.
3. Keep the helper customer-safe: return `null` for 404 and surface other failures.
