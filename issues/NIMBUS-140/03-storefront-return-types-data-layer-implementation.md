# Task 03: Storefront return types and data-fetching layer — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-09-15
**Branch:** feature/NIMBUS-140 (from develop)
**Depends on:** Task 02

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (`jest-environment-jsdom`)
- **Test location:** `apps/storefront/src/__tests__/` (mirrors component/module folder structure)
- **Naming conventions:** kebab-case directories, PascalCase component files, kebab-case non-component files, camelCase functions/variables. Double-quoted strings, **no trailing semicolons** (match the existing files in `src/types/` and `src/lib/data/` exactly).

## Solution Design

Add the storefront-side TypeScript types and the `sdk.client.fetch` wrapper function for `GET /store/bc-returns` (from Task 02), mirroring the existing `BCOrder`/`BCOrderListParams`/`BCOrderListResponse` types and `listBCOrders` function exactly. Per existing convention in this codebase, BC-return-related types live in `src/types/bc-order.ts` alongside the BC-order types (that file already holds `BCReturnReason`, `BCReturnOrder`, etc. for the create-return flow) — add the new list types there rather than creating a new file.

**Cross-task wiring:** The types `BCReturnListItem`, `BCReturnListParams`, `BCReturnListResponse` and the function `listBCReturns` defined here are consumed by Task 04 (components) and Task 05 (page).

## Impacted Files

### `apps/storefront/src/types/bc-order.ts` (edit)

Append three new types at the **end of the file** (after the existing `BCReturnOrder` type).

Old (end of file):
```typescript
export type BCReturnOrder = {
  id: string
  number: string
  status: string
  requestId: string
  sourceOrderNo: string
  lines: BCReturnLine[]
}
```

New (end of file):
```typescript
export type BCReturnOrder = {
  id: string
  number: string
  status: string
  requestId: string
  sourceOrderNo: string
  lines: BCReturnLine[]
}

export type BCReturnListItem = {
  id: string
  number: string
  relatedOrderNumber: string
  documentDate: string
  status: string
  itemCount: number
}

export type BCReturnListParams = {
  limit?: number
  offset?: number
  status?: string
  date_from?: string
  date_to?: string
  search?: string
}

export type BCReturnListResponse = {
  returns: BCReturnListItem[]
  count: number
  offset: number
  limit: number
}
```

### `apps/storefront/src/lib/data/business-central.ts` (edit)

**Edit 1 — add new type imports.**

Old:
```typescript
import type {
  BCOrderDetail,
  BCOrderListParams,
  BCOrderListResponse,
  BCReturnOrder,
  BCReturnReason,
  BCReturnRequestBody,
} from "@/types/bc-order"
```

New:
```typescript
import type {
  BCOrderDetail,
  BCOrderListParams,
  BCOrderListResponse,
  BCReturnListParams,
  BCReturnListResponse,
  BCReturnOrder,
  BCReturnReason,
  BCReturnRequestBody,
} from "@/types/bc-order"
```

**Edit 2 — add the `listBCReturns` function, right after `listBCOrders` (before the `StoreBCOrderDetailResponse` type).**

Old:
```typescript
export const listBCOrders = async (
  params: BCOrderListParams = {}
): Promise<BCOrderListResponse> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<BCOrderListResponse>("/store/bc-orders", {
    method: "GET",
    headers,
    query: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      ...(params.status ? { status: params.status } : {}),
      ...(params.date_from ? { date_from: params.date_from } : {}),
      ...(params.date_to ? { date_to: params.date_to } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    credentials: "include",
  })
}

type StoreBCOrderDetailResponse = {
  order: BCOrderDetail
}
```

New:
```typescript
export const listBCOrders = async (
  params: BCOrderListParams = {}
): Promise<BCOrderListResponse> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<BCOrderListResponse>("/store/bc-orders", {
    method: "GET",
    headers,
    query: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      ...(params.status ? { status: params.status } : {}),
      ...(params.date_from ? { date_from: params.date_from } : {}),
      ...(params.date_to ? { date_to: params.date_to } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    credentials: "include",
  })
}

export const listBCReturns = async (
  params: BCReturnListParams = {}
): Promise<BCReturnListResponse> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<BCReturnListResponse>("/store/bc-returns", {
    method: "GET",
    headers,
    query: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      ...(params.status ? { status: params.status } : {}),
      ...(params.date_from ? { date_from: params.date_from } : {}),
      ...(params.date_to ? { date_to: params.date_to } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    credentials: "include",
  })
}

type StoreBCOrderDetailResponse = {
  order: BCOrderDetail
}
```

## Code Skeletons

### New File: `apps/storefront/src/__tests__/lib/data/business-central.test.ts`

```typescript
jest.mock("@/lib/config", () => ({
  sdk: {
    client: {
      fetch: jest.fn(),
    },
  },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(() => Promise.resolve({})),
}))

import { listBCReturns } from "@/lib/data/business-central"
import { sdk } from "@/lib/config"

describe("listBCReturns", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // TC-1: happy path — defaults are sent when no params are given.
  it("requests /store/bc-returns with default limit and offset", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    const result = await listBCReturns()

    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/bc-returns", {
      method: "GET",
      headers: {},
      query: { limit: 20, offset: 0 },
      credentials: "include",
    })
    expect(result).toEqual({ returns: [], count: 0, offset: 0, limit: 20 })
  })

  // TC-2: edge case — optional filters are only included when provided.
  it("omits status, date_from, date_to and search from the query when not provided", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    await listBCReturns({ limit: 10, offset: 5 })

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns",
      expect.objectContaining({
        query: { limit: 10, offset: 5 },
      })
    )
  })

  // TC-3: integration/wiring — all optional filters are forwarded when provided.
  it("forwards status, date range and search filters when provided", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    await listBCReturns({
      status: "Open",
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      search: "RET-1",
    })

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns",
      expect.objectContaining({
        query: {
          limit: 20,
          offset: 0,
          status: "Open",
          date_from: "2026-01-01",
          date_to: "2026-12-31",
          search: "RET-1",
        },
      })
    )
  })
})
```

## Test Cases

### TC-1: Happy path — default query params
- **Given:** No params passed to `listBCReturns`.
- **When:** It is called.
- **Then:** `sdk.client.fetch` is called with `/store/bc-returns`, method `GET`, `query: { limit: 20, offset: 0 }`, `credentials: "include"`.

### TC-2: Edge case — optional filters omitted when absent
- **Given:** Only `limit` and `offset` are passed.
- **When:** `listBCReturns({ limit: 10, offset: 5 })` is called.
- **Then:** The `query` object contains only `limit` and `offset` — no `status`/`date_from`/`date_to`/`search` keys.

### TC-3: Integration/wiring — all filters forwarded
- **Given:** `status`, `date_from`, `date_to`, and `search` are all passed.
- **When:** `listBCReturns(...)` is called.
- **Then:** All four appear in the `query` object sent to `sdk.client.fetch`.

## Implementation Steps

1. Edit `apps/storefront/src/types/bc-order.ts` to append the three new types exactly as specified, at the end of the file.
2. Edit `apps/storefront/src/lib/data/business-central.ts`: apply Edit 1 (imports) and Edit 2 (new `listBCReturns` function) exactly as specified.
3. Create `apps/storefront/src/__tests__/lib/data/business-central.test.ts` exactly as specified.
4. Run `cd apps/storefront && pnpm test` and confirm the 3 new tests pass.
5. Run `pnpm build` from the repo root and confirm no TypeScript errors.
6. Run `pnpm lint` from the repo root and confirm no new lint errors.
