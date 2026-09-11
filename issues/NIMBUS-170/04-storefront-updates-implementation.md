# Task 04: Storefront — route by order number, widen types — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-09-11
**Branch:** feature/nimbus-170 (from develop)
**Depends on:** Task 02, Task 03

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (`apps/storefront/jest.config.ts` already exists — no scaffolding needed)
- **Test location:** `apps/storefront/src/__tests__/` (mirrors component folder structure)
- **Naming conventions:** kebab-case directories, PascalCase component files, kebab-case props/types files (per `apps/storefront/copilot-instructions.md`)

## Why this task is required, not merely conditional

`issues/NIMBUS-170/SCOPE.md` marks storefront changes as "conditional... if needed." Two changes are genuinely required by the backend shape change already implemented in Tasks 02–03:

1. **The BC order detail route now requires the order *number*, not the order's internal `id`.** `bc-order-card/index.tsx` currently links to `/account/bcorders/${order.id}`, and that `id` GUID is exactly what used to be sent to the backend's `getOrder({ orderId })`. Since `getOrder` now takes `orderNumber` (Task 01/03) and does not accept a GUID at all, the link **must** be changed to use `order.number`, or every "Details" click on the order list would 404. This is not optional.
2. **`BCOrder.status` is no longer a closed union** on the backend (Task 01 widened it to `string`, since the two BC status enums that can now produce a merged row are incompatible with the old closed union — see SCOPE.md Findings). The storefront's own `BCOrder` type must be updated to match the real response shape, or it silently lies about what `status` can contain.
3. **`BCOrderDetail` now carries an `invoices: BCOrderInvoiceSummary[]` field** (Task 01/03, decision D14) — when an order's lines were merged from one or more `salesInvoice` records, the response also lists those source invoices (id/number/date/status/totals). The storefront's `BCOrderDetail` type must be updated to match, for the same "don't silently lie about the response shape" reason as point 2. Per **Decision D13** (below), nothing renders this yet — it is a type-only addition in this task, same as `invoiceStatus`.

**Decision D13 (default call, documented for revisit):** no new visual "partially invoiced" / "fully invoiced" badge is added in this story, and the new `invoices` list (D14) is not rendered anywhere either. The primary, required visibility win is that previously-hidden fully-invoiced orders now appear in the list and detail at all — that happens automatically once Tasks 02–03 ship, with no storefront change needed. `invoiceStatus` and `invoices` are still added to the storefront's types (so they accurately describe the API response and a future story can render a badge or an "invoices for this order" section without another backend change), but nothing renders either one yet. This avoids inventing new translated copy across all 8 locale files (`da`, `de`, `en`, `fr`, `it`, `no`, `pl`, `sv`) for fields that Open Question #3 in SCOPE.md left genuinely open — revisit if product wants an explicit visual treatment.

No other storefront file needs to change:
- `apps/storefront/src/lib/data/business-central.ts` — `retrieveBCOrder(id: string)` and `listBCOrders` already take/return opaque strings and the existing response shape; no signature change needed.
- `apps/storefront/src/app/.../bcorders/[id]/page.tsx` — already forwards whatever string is in the URL to `retrieveBCOrder`; doesn't care whether that string is a GUID or an order number.
- `apps/storefront/src/modules/account/components/bc-order-return/index.tsx` — submits `order.id` (not the URL param) to `createBCReturn`; unaffected by this story (returns are explicitly out of scope — see SCOPE.md).
- `apps/storefront/src/modules/account/components/bc-order-filters/index.tsx` — its `BC_ORDER_STATUSES` array keeps using the existing `BCOrderStatus` union as a list of known filterable values; that usage is independent of `BCOrder.status`'s own type and needs no change.
- `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx` — renders `order.lines`, `order.status`, totals, etc. exactly as before; the merged data now simply contains more/different lines, which the existing rendering already handles generically (it does not switch on `status`'s TS type).

## Impacted Files

### `apps/storefront/src/types/bc-order.ts`

Change the `BCOrder` type from:

```typescript
export type BCOrder = {
  id: string
  number: string
  orderDate: string
  customerNumber: string
  customerName: string
  billToAddress: string[]
  shipToAddress: string[]
  status: BCOrderStatus
  currencyCode: string
  totalAmountExcludingTax: number
  totalAmountIncludingTax: number
}
```

to:

```typescript
export type BCOrderInvoiceStatus = "open" | "partially_invoiced" | "fully_invoiced"

export type BCOrder = {
  id: string
  number: string
  orderDate: string
  customerNumber: string
  customerName: string
  billToAddress: string[]
  shipToAddress: string[]
  status: string
  invoiceStatus: BCOrderInvoiceStatus
  currencyCode: string
  totalAmountExcludingTax: number
  totalAmountIncludingTax: number
}
```

Leave the existing `BCOrderStatus` union declaration (lines 1-8, just above `BCOrder`) exactly as-is — `bc-order-filters/index.tsx` still imports and uses it for its own dropdown's known-values list, independent of `BCOrder.status`'s type. Do not remove it (unlike the backend, where it truly became unused).

Also change `BCOrderDetail` (D14) from:

```typescript
export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[]
}
```

to:

```typescript
export type BCOrderInvoiceSummary = {
  id: string
  number: string
  invoiceDate: string
  status: string
  totalAmountExcludingTax: number
  totalAmountIncludingTax: number
}

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[]
  invoices: BCOrderInvoiceSummary[]
}
```

Place `BCOrderInvoiceSummary` directly above `BCOrderDetail`, after the existing `BCOrderLine` type. Nothing currently constructs a `BCOrderDetail` object literal in the storefront (it only ever arrives from `retrieveBCOrder`'s API response), so adding a new required field is compatible — same reasoning as `invoiceStatus` on `BCOrder`. `bc-order-detail-template.tsx` destructures/reads specific fields off `order` (`lines`, `status`, totals, etc.) rather than spreading or exhaustively checking its shape, so the new `invoices` field being present-but-unused does not break it.

Leave everything else in the file (`BCOrderLine`, `BCOrderListParams`, `BCOrderListResponse`, `BCReturnReason`, `BCReturnLineInput`, `BCReturnRequestBody`, `BCReturnLine`, `BCReturnOrder`) unchanged.

### `apps/storefront/src/modules/account/components/bc-order-card/index.tsx`

Change the details link from:

```tsx
        <LocalizedClientLink
          href={`/account/bcorders/${order.id}`}
          className="flex items-center pl-4 text-small-regular text-ui-fg-base underline"
          data-testid="bc-order-details-link"
        >
          {t("detailsLabel")}
        </LocalizedClientLink>
```

to:

```tsx
        <LocalizedClientLink
          href={`/account/bcorders/${encodeURIComponent(order.number)}`}
          className="flex items-center pl-4 text-small-regular text-ui-fg-base underline"
          data-testid="bc-order-details-link"
        >
          {t("detailsLabel")}
        </LocalizedClientLink>
```

`encodeURIComponent` is added because, unlike the GUID it replaces, a BC order number is an arbitrary short string (`Edm.String`, max length 20) and is not guaranteed to be URL-path-safe by construction (existing order numbers observed in tests, e.g. `SO-1000`, are safe, but nothing in the BC schema guarantees no `/`, `?`, `#`, or space ever appears). Nothing else in this file changes — `order.id` is still used elsewhere in the file? No — check: `order.id` is not used anywhere else in this component (only in the link above and the React `key` in the parent `bc-order-overview/index.tsx`, which is untouched and still valid — `id` remains a real field on `BCOrder`, just no longer the one used for routing).

## Test Cases

### `apps/storefront/src/__tests__/modules/account/components/bc-order-card/index.test.tsx`

The existing test file must be updated: the mock `order` object needs an `invoiceStatus` field for type accuracy (it is cast `as any` today so this is not strictly required to compile, but include it for realism), and a new test must assert the link now uses `order.number`, not `order.id`.

Replace the file's full contents with:

```tsx
import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcOrderCard from "@/modules/account/components/bc-order-card"

const order = {
  id: "order-1",
  number: "BC-1",
  orderDate: "2026-01-01T00:00:00.000Z",
  currencyCode: "usd",
  totalAmountIncludingTax: 100,
  status: "Open",
  invoiceStatus: "open",
} as any

describe("BcOrderCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcOrderCard({ order })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  // TC-1: happy path — the details link routes by order number.
  it("links to the order detail page using the order number, not the internal id", async () => {
    const element = await BcOrderCard({ order })
    render(element)

    const detailsLink = screen.getByTestId("bc-order-details-link")
    expect(detailsLink).toHaveAttribute("href", expect.stringContaining("/account/bcorders/BC-1"))
    expect(detailsLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("/account/bcorders/order-1")
    )
  })

  // TC-2: edge case — an order number containing characters that need URL-encoding still produces a safe link.
  it("URL-encodes an order number that contains characters unsafe for a path segment", async () => {
    const encodedOrder = { ...order, number: "BC/1 2" }
    const element = await BcOrderCard({ order: encodedOrder })
    render(element)

    const detailsLink = screen.getByTestId("bc-order-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("BC/1 2"))
    )
  })
})
```

### TC-3: integration/wiring — types compile against the widened backend contract

- **Given:** `apps/storefront/src/types/bc-order.ts` now declares `status: string` and a new required `invoiceStatus: BCOrderInvoiceStatus` field on `BCOrder`, plus a new required `invoices: BCOrderInvoiceSummary[]` field on `BCOrderDetail`.
- **When:** running `cd apps/storefront && pnpm build` (Next.js type-checks during build).
- **Then:** the build's type-check step succeeds with no new type errors attributable to `BCOrder`/`BCOrderDetail` consumers (`bc-order-card`, `bc-order-overview`, `bc-order-detail-template`, `bc-order-return`, `bc-order-filters`) — none of them narrow or switch on `status`'s exact literal type, so widening it to `string` is a compatible change; none of them currently read `invoiceStatus` or `invoices`, so adding both as new required fields on data returned from the API is compatible (nothing constructs a `BCOrder`/`BCOrderDetail` object literal in the storefront itself that would need the new fields added).

## Implementation Steps

1. Confirm Tasks 02 and 03 have landed on the backend (the response shape this task types against is final).
2. Edit `apps/storefront/src/types/bc-order.ts` per "Impacted Files" above.
3. Edit `apps/storefront/src/modules/account/components/bc-order-card/index.tsx` per "Impacted Files" above.
4. Replace `apps/storefront/src/__tests__/modules/account/components/bc-order-card/index.test.tsx` with the version above.
5. Run `cd apps/storefront && pnpm test` and confirm the `BcOrderCard` tests pass, and that no other existing test (`bcorders-page.test.tsx`, `bcorder-detail-page.test.tsx`, `bc-order-overview` tests) regressed.
6. Run `cd apps/storefront && pnpm build` and confirm no new type errors.
7. Run `pnpm lint` from the repo root and fix any lint issues in the lines you touched only.
