# Implementation Task 03: Storefront BC Orders UI

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — no storefront test runner wired; verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md` (kebab-case directories, `index.tsx` for module components, camelCase vars/functions, PascalCase types/interfaces)

## Solution Design

Add the `/account/bcorders` route under the existing Next.js 15 parallel-slot pattern:

```
apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/
  bcorders/
    page.tsx        ← server component; reads searchParams; calls listBCOrders
    loading.tsx     ← same spinner as existing orders/loading.tsx
```

And three new account module components:

| Component | Type | Purpose |
|---|---|---|
| `bc-order-card` | Server | Renders one BC order row (number, date, status, amount). No "Details" link — deferred to NIMBUS-137. |
| `bc-order-filters` | Client (`"use client"`) | Status select, date-from/to inputs, search text input. On submit/change, pushes new URL search params via `useRouter`; reads current values from `useSearchParams`. |
| `bc-order-overview` | Server | Accepts `BCOrderListResponse | null | Error` and renders populated / empty / error state plus the `ResourcePagination` component. |

The page:
1. Is a server component that reads `searchParams` (`page`, `status`, `date_from`, `date_to`, `search`).
2. Computes `limit = 20`, `offset = (page - 1) * 20`.
3. Calls `listBCOrders(params)` wrapped in a `try/catch` so the error state is always rendered rather than crashing.
4. Passes the result (or null/error indicator) to `BcOrderOverview`.
5. Passes current filter values as props to `BcOrderFilters` for controlled display.

**Approvals must never appear on this page.** Do not import or render any approvals-related component.

## Code Skeletons

### New File: `apps/storefront/src/modules/account/components/bc-order-card/index.tsx`

```typescript
import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import type { BCOrder } from "@/types/bc-order"
import { Container } from "@medusajs/ui"

type BcOrderCardProps = {
  order: BCOrder
}

const BcOrderCard = ({ order }: BcOrderCardProps) => {
  // IMPLEMENT:
  // Render a Container (same styling as order-card/index.tsx):
  //   Left side:
  //     - CalendarIcon + formatted order.orderDate (toLocaleDateString "en-GB")
  //     - DocumentIcon + order.number (prefixed with #)
  //   Right side:
  //     - Status badge (text label from order.status)
  //     - Amount: order.totalAmountIncludingTax formatted with Intl.NumberFormat
  //       using order.currencyCode (no convertToLocale needed — BC amounts are already
  //       in the major unit, not minor unit)
  //   No "Details" link — deferred to NIMBUS-137.
}

export default BcOrderCard
```

### New File: `apps/storefront/src/modules/account/components/bc-order-filters/index.tsx`

```typescript
"use client"

import Button from "@/modules/common/components/button"
import type { BCOrderStatus } from "@/types/bc-order"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

const BC_ORDER_STATUSES: BCOrderStatus[] = [
  "Open",
  "Released",
  "Pending Approval",
  "Pending Prepayment",
  "Shipped",
  "Invoiced",
]

type BcOrderFiltersProps = {
  currentStatus?: string
  currentDateFrom?: string
  currentDateTo?: string
  currentSearch?: string
}

const BcOrderFilters = ({
  currentStatus,
  currentDateFrom,
  currentDateTo,
  currentSearch,
}: BcOrderFiltersProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // IMPLEMENT:
  // Render a form row / flex container with:
  //   1. Status <select> — options are ["", ...BC_ORDER_STATUSES]; value = currentStatus ?? "".
  //      onChange: push updated searchParams (reset page to 1, set/delete status key).
  //   2. Date-from <input type="date"> — value = currentDateFrom ?? "".
  //      onChange: push updated searchParams (reset page, set/delete date_from key).
  //   3. Date-to <input type="date"> — value = currentDateTo ?? "".
  //      onChange: push updated searchParams (reset page, set/delete date_to key).
  //   4. Search <input type="text"> — value from local state seeded by currentSearch.
  //      onSubmit (form submit or Enter key): push updated searchParams (reset page, set/delete search key).
  //   5. "Clear" Button that removes status/date_from/date_to/search/page from search params.
  // Each change should use startTransition + router.push(`${pathname}?${newParams}`, { scroll: false }).
  // While isPending, show a subtle visual loading indicator (e.g. opacity-50).
}

export default BcOrderFilters
```

### New File: `apps/storefront/src/modules/account/components/bc-order-overview/index.tsx`

```typescript
import BcOrderCard from "@/modules/account/components/bc-order-card"
import ResourcePagination from "@/modules/account/components/resource-pagination"
import type { BCOrderListResponse } from "@/types/bc-order"

type BcOrderOverviewProps = {
  result: BCOrderListResponse | null
  error: boolean
  currentPage: number
  limit: number
}

const BcOrderOverview = ({
  result,
  error,
  currentPage,
  limit,
}: BcOrderOverviewProps) => {
  // IMPLEMENT:
  //
  // Error state (error === true):
  //   Show a customer-safe error message with a "Try again" link that reloads the page.
  //   Never expose internal exception details.
  //
  // Empty state (result !== null && result.orders.length === 0):
  //   Show "No company orders found" message.
  //   Keep filter area visible so users can broaden search (this component does not render
  //   filters — the page does — so just show the message).
  //
  // Populated state (result !== null && result.orders.length > 0):
  //   Map result.orders -> <BcOrderCard key={order.id} order={order} />
  //   Render <ResourcePagination
  //     totalPages={Math.ceil(result.count / limit)}
  //     currentPage={currentPage}
  //     pageParam="page"
  //   /> below the list.
}

export default BcOrderOverview
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/loading.tsx`

```typescript
import Spinner from "@/modules/common/icons/spinner"

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full text-ui-fg-base">
      <Spinner size={36} />
    </div>
  )
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/page.tsx`

```typescript
import { listBCOrders } from "@/lib/data/business-central"
import BcOrderFilters from "@/modules/account/components/bc-order-filters"
import BcOrderOverview from "@/modules/account/components/bc-order-overview"
import type { BCOrderListResponse } from "@/types/bc-order"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "BC Orders",
  description: "Company-wide Business Central order history.",
}

const LIMIT = 20

export default async function BCOrders({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
    date_from?: string
    date_to?: string
    search?: string
  }>
}) {
  // IMPLEMENT:
  // 1. Await searchParams (Next.js 15 async searchParams).
  // 2. Parse currentPage = Math.max(1, parseInt(params.page ?? "1") || 1).
  // 3. Compute offset = (currentPage - 1) * LIMIT.
  // 4. Extract status, date_from, date_to, search from params.
  // 5. Call listBCOrders({ limit: LIMIT, offset, status, date_from, date_to, search })
  //    inside a try/catch:
  //      - On success: result = the resolved BCOrderListResponse, hasError = false.
  //      - On error: result = null, hasError = true.
  // 6. Render:
  //   <div className="w-full flex flex-col gap-y-4" data-testid="bc-orders-page-wrapper">
  //     <div className="mb-4"><Heading>BC Orders</Heading></div>
  //     <BcOrderFilters
  //       currentStatus={status}
  //       currentDateFrom={date_from}
  //       currentDateTo={date_to}
  //       currentSearch={search}
  //     />
  //     <BcOrderOverview
  //       result={result}
  //       error={hasError}
  //       currentPage={currentPage}
  //       limit={LIMIT}
  //     />
  //   </div>
}
```

## Impacted Files

- `apps/storefront/src/modules/account/components/bc-order-card/index.tsx` — **new file**
- `apps/storefront/src/modules/account/components/bc-order-filters/index.tsx` — **new file**
- `apps/storefront/src/modules/account/components/bc-order-overview/index.tsx` — **new file**
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/page.tsx` — **new file**
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/loading.tsx` — **new file**

## Test Cases

### TC-1: Page renders populated list
- **Given:** `listBCOrders` returns `{ orders: [order1, order2], count: 2, offset: 0, limit: 20 }`.
- **When:** The page renders.
- **Then:** Two `BcOrderCard` rows are visible; no pagination shown (total ≤ 1 page).

### TC-2: Page renders empty state
- **Given:** `listBCOrders` returns `{ orders: [], count: 0, offset: 0, limit: 20 }`.
- **When:** The page renders.
- **Then:** Empty copy "No company orders found" is shown; filter controls remain visible.

### TC-3: Page renders error state
- **Given:** `listBCOrders` throws.
- **When:** The page renders.
- **Then:** Customer-safe error message is shown; no internal error details are exposed.

### TC-4: Pagination renders when count exceeds one page
- **Given:** `listBCOrders` returns `count: 45, limit: 20`.
- **When:** The page renders.
- **Then:** `ResourcePagination` renders with `totalPages = 3`.

### TC-5: Approvals are never rendered
- **Given:** Any scenario on `/account/bcorders`.
- **Then:** No approvals-related content, import, or component appears on this page.

### TC-6: Filter controls are visible in all states
- **Given:** Any of loading / empty / error / populated states.
- **Then:** `BcOrderFilters` is always rendered (it sits above the overview section).

### TC-7: BcOrderCard shows correct fields
- **Given:** A `BCOrder` with `number: "SO-001"`, `status: "Released"`, `orderDate: "2024-06-01"`.
- **When:** Rendered.
- **Then:** Order number, formatted date, and "Released" status label are visible.

### TC-8: Status filter change updates URL, resets page to 1
- **Given:** User is on page 3 of results.
- **When:** User changes the status filter in `BcOrderFilters`.
- **Then:** The URL search params include the new status and `page` is reset to `1`.

## Implementation Steps

1. Create `apps/storefront/src/modules/account/components/bc-order-card/index.tsx`.
2. Create `apps/storefront/src/modules/account/components/bc-order-filters/index.tsx`.
3. Create `apps/storefront/src/modules/account/components/bc-order-overview/index.tsx`.
4. Create `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/loading.tsx`.
5. Create `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/page.tsx`.
6. Run `cd apps/storefront && pnpm build` — fix any TypeScript errors.
7. Run `pnpm lint` — fix any lint issues.
