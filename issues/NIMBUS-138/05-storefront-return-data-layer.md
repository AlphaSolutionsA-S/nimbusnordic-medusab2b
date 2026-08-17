# Implementation Task 05: Storefront Return Data Layer + Types

> **Depends on task 04.** Reuses the NIMBUS-137 BC data-layer conventions in
> `apps/storefront/src/lib/data/business-central.ts` (auth headers, `sdk.client.fetch`,
> `credentials: "include"`, `FetchError`).

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint`
- **SDK rule:** ALL backend calls go through `sdk.client.fetch` with `getAuthHeaders()` — never raw
  `fetch`.
- **Naming conventions:** kebab-case files, PascalCase types, camelCase functions.

## Solution Design

Add storefront return + reason types, a `listBCReturnReasons` server action (GET) to populate the
per-line dropdown, and a `createBCReturn` server action (POST) mirroring `retrieveBCOrder`.

## Code Skeletons

### Modified File: `apps/storefront/src/types/bc-order.ts`

Append (keep existing `BCOrder*` types unchanged):

```typescript
export type BCReturnReason = {
  id: string
  description: string
}

export type BCReturnLineInput = {
  source_line_no: number
  quantity: number
  return_reason_code: string
}

export type BCReturnRequestBody = {
  lines: BCReturnLineInput[]
}

export type BCReturnLine = {
  source_line_no: number
  quantity_to_return: number
  return_reason_code: string
}

export type BCReturnOrder = {
  id: string
  number: string
  status: string
  request_id: string
  source_order_no: string
  lines: BCReturnLine[]
}
```

### Modified File: `apps/storefront/src/lib/data/business-central.ts`

Add after `retrieveBCOrder` (keep `"use server"` at the top):

```typescript
type StoreBCReturnReasonsResponse = {
  return_reasons: BCReturnReason[]
}

type StoreBCReturnResponse = {
  return: BCReturnOrder
}

export const listBCReturnReasons = async (): Promise<BCReturnReason[]> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // IMPLEMENT:
  // const response = await sdk.client.fetch<StoreBCReturnReasonsResponse>(
  //   `/store/bc-orders/return-reasons`,
  //   { method: "GET", headers, credentials: "include", cache: "no-store" })
  // return response.return_reasons
}

export const createBCReturn = async (
  orderId: string,
  body: BCReturnRequestBody
): Promise<BCReturnOrder> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // IMPLEMENT:
  // const response = await sdk.client.fetch<StoreBCReturnResponse>(
  //   `/store/bc-orders/${orderId}/returns`,
  //   { method: "POST", headers, body, credentials: "include" })
  // return response.return
  // Let FetchError propagate; the caller maps 400/404 to customer-safe messages.
}
```

Update the type import at the top of the file to include the new types (`BCReturnOrder`,
`BCReturnReason`, `BCReturnRequestBody`).

> If the task-04 route-collision note forced the reasons route to a non-`/return-reasons` path,
> update the `listBCReturnReasons` URL here to match.

## Test Cases

### TC-1: Reasons fetch
- **When:** `listBCReturnReasons()` is called.
- **Then:** it GETs `/store/bc-orders/return-reasons` with auth headers and returns the reasons.

### TC-2: Successful create
- **When:** `createBCReturn(orderId, body)` is called.
- **Then:** it POSTs to `/store/bc-orders/{orderId}/returns` with auth headers and returns the
  `BCReturnOrder`.

### TC-3: Failure propagates
- **Given:** the backend returns 400/404.
- **Then:** a `FetchError` with the status propagates for the UI to map.

> Storefront has no jest harness by default; verify via the task 06 UI flow and the backend
> integration tests (task 04). Do not add a storefront unit harness speculatively.

## Implementation Steps

1. Add the return + reason types to `types/bc-order.ts`.
2. Add `listBCReturnReasons` and `createBCReturn` to `lib/data/business-central.ts`.
3. Run `pnpm build` for the storefront.
