# Task 03: Storefront return detail types and data-fetching layer — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-141 (from develop)
**Depends on:** Task 02; NIMBUS-140 Task 03 (merged to develop)

> After NIMBUS-140, `src/types/bc-order.ts` ends with `BCReturnListResponse`, and
> `src/lib/data/business-central.ts` contains `listBCReturns`. This task only **appends** to the
> end of both files, so it does not depend on their exact contents. It depends on NIMBUS-140 only
> for ordering: NIMBUS-140 adds its return list types to the same file first.

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (`jest-environment-jsdom`, `next/jest`)
- **Test location:** `apps/storefront/src/__tests__/lib/data/retrieve-bc-return.test.ts` (new file)
- **Naming conventions:** double-quoted strings, **no semicolons**, 2-space indentation, matching
  `src/types/` and `src/lib/data/`. Both edited files use **CRLF** line endings; keep them CRLF.

## Solution Design

- Add storefront mirrors of the backend `BCReturnDetail` shape (Task 01) to `src/types/bc-order.ts`,
  next to the other BC return types. The names do not clash with NIMBUS-138's `BCReturnLine` and
  `BCReturnOrder`, or with NIMBUS-140's `BCReturnList*`.
- Add `retrieveBCReturn(returnNumber)` to `src/lib/data/business-central.ts`, mirroring
  `retrieveBCOrder`: `sdk.client.fetch` with auth headers, where a 404 `FetchError` returns
  `null` and any other error is rethrown. Two differences from `retrieveBCOrder`:
  - The number is URL-encoded with `encodeURIComponent`, as in `createBCReturn`.
  - `cache: "no-store"` is set, as in `listBCReturnReasons`, so the BC status and received
    quantities are always current.
- The file is already `"use server"`, so the function runs server-side and no React Query is
  needed. This is the existing pattern for BC pages.

**Cross-task wiring:** `BCReturnDetail`, `BCReturnDetailLine` and `BCReturnExpectedCredit` are
used by Task 04 (components). `retrieveBCReturn` is used by Task 05 (page).

## Impacted Files

### `apps/storefront/src/types/bc-order.ts` (edit)

Append at the **end of the file**, after the last existing type (NIMBUS-140's
`BCReturnListResponse`), with one blank line before it:

```typescript
export type BCReturnDetailLine = {
  id: string
  sequence: number
  lineType: string
  itemNumber: string
  variantCode: string
  description: string
  unitOfMeasureCode: string
  quantity: number
  quantityReceived: number
  returnReasonCode: string
}

export type BCReturnExpectedCredit = {
  currencyCode: string
  amountIncludingTax: number
  amountExcludingTax: number | null
}

export type BCReturnDetail = {
  id: string
  number: string
  documentDate: string
  status: string
  lines: BCReturnDetailLine[]
  expectedCredit: BCReturnExpectedCredit
}
```

### `apps/storefront/src/lib/data/business-central.ts` (edit)

**Edit 1: type import.** In the existing `import type { ... } from "@/types/bc-order"` block,
add `  BCReturnDetail,` on a new line directly before `  BCReturnOrder,`.

**Edit 2: append at the end of the file**, after `createBCReturn`, with one blank line before it:

```typescript
type StoreBCReturnDetailResponse = {
  return: BCReturnDetail
}

export const retrieveBCReturn = async (
  returnNumber: string
): Promise<BCReturnDetail | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const response = await sdk.client.fetch<StoreBCReturnDetailResponse>(
      `/store/bc-returns/${encodeURIComponent(returnNumber)}`,
      {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      }
    )

    return response.return
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      return null
    }

    throw error
  }
}
```

## Code Skeletons

### New File: `apps/storefront/src/__tests__/lib/data/retrieve-bc-return.test.ts`

Complete file:

```typescript
jest.mock("@/lib/config", () => ({
  sdk: {
    client: {
      fetch: jest.fn(),
    },
  },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(() => Promise.resolve({ authorization: "Bearer token" })),
}))

jest.mock("@medusajs/js-sdk", () => ({
  FetchError: class FetchError extends Error {
    status: number | undefined
    statusText: string | undefined

    constructor(message: string, statusText?: string, status?: number) {
      super(message)
      this.statusText = statusText
      this.status = status
    }
  },
}))

import { FetchError } from "@medusajs/js-sdk"
import { sdk } from "@/lib/config"
import { retrieveBCReturn } from "@/lib/data/business-central"

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
}

describe("retrieveBCReturn", () => {
  // TC-1: happy path — calls the detail route with auth headers and unwraps `return`.
  it("requests /store/bc-returns/:number and returns the return", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({ return: bcReturn })

    await expect(retrieveBCReturn("31502910")).resolves.toEqual(bcReturn)
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/bc-returns/31502910", {
      method: "GET",
      headers: { authorization: "Bearer token" },
      credentials: "include",
      cache: "no-store",
    })
  })

  // TC-2: edge case — the return number is URL-encoded into a single path segment.
  it("URL-encodes the return number", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({ return: bcReturn })

    await retrieveBCReturn("RO/1 2")

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns/RO%2F1%202",
      expect.any(Object)
    )
  })

  // TC-3: edge case — a 404 (foreign/unknown/processed) becomes null.
  it("returns null when the backend responds 404", async () => {
    ;(sdk.client.fetch as jest.Mock).mockRejectedValueOnce(
      new FetchError("Return not found.", "Not Found", 404)
    )

    await expect(retrieveBCReturn("31502999")).resolves.toBeNull()
  })

  // TC-4: error condition — any other failure is rethrown for the page's error state.
  it("rethrows non-404 errors", async () => {
    const error = new FetchError("Internal Server Error", "Internal Server Error", 500)
    ;(sdk.client.fetch as jest.Mock).mockRejectedValueOnce(error)

    await expect(retrieveBCReturn("31502910")).rejects.toBe(error)
  })
})
```

## Test Cases

### TC-1: Happy path
- **Given:** the backend returns `{ return: … }`.
- **When:** `retrieveBCReturn("31502910")` is called.
- **Then:** `sdk.client.fetch` is called with `/store/bc-returns/31502910`, `GET`, the auth headers, `credentials: "include"` and `cache: "no-store"`, and the unwrapped return is resolved.

### TC-2: Edge case, encoding
- **Given:** the number `RO/1 2`.
- **When:** `retrieveBCReturn` is called.
- **Then:** the path is `/store/bc-returns/RO%2F1%202`.

### TC-3: Edge case, 404
- **Given:** the SDK rejects with a `FetchError` whose status is 404.
- **When:** `retrieveBCReturn` is called.
- **Then:** it resolves to `null`.

### TC-4: Error condition
- **Given:** the SDK rejects with a 500 `FetchError`.
- **When:** `retrieveBCReturn` is called.
- **Then:** the same error is rethrown.

## Implementation Steps

1. Append the three types to `src/types/bc-order.ts`.
2. Apply Edits 1 and 2 to `src/lib/data/business-central.ts`.
3. Create `src/__tests__/lib/data/retrieve-bc-return.test.ts` exactly as specified.
4. Run `cd apps/storefront && pnpm test`. The 4 new tests must pass, and so must the whole suite.
5. Run `pnpm build` (repo root) and `pnpm lint`. Neither may report new errors.
