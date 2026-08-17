# Implementation Task 03: Storefront BC Order Detail UI

**Status:** Complete

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md`

## Solution Design

Create the read-only BC order detail experience under the existing account dashboard slot:

1. `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx`
2. `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/loading.tsx`
3. `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/not-found.tsx`
4. `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx`

The page should:

1. Fetch the detail data with `retrieveBCOrder(id)`.
2. Render a customer-safe not-found state when the helper returns `null`.
3. Render a customer-safe error state when the fetch fails unexpectedly.
4. Render the read-only detail template when data is available.
5. Show header information and line items only; no write/actions.

## Code Skeletons

### New File: `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx`

```typescript
import { Container } from "@medusajs/ui";
import LocalizedClientLink from "@/modules/common/components/localized-client-link";
import type { BCOrderDetail } from "@/types/bc-order";

type BcOrderDetailTemplateProps = {
  order: BCOrderDetail;
};

const BcOrderDetailTemplate = ({
  order,
}: BcOrderDetailTemplateProps) => {
  // IMPLEMENT:
  // 1. Render a read-only header with order number, date, status, currency, totals.
  // 2. Render a back link to /account/bcorders.
  // 3. Render the line items in a table or stacked list.
  // 4. Keep the page informational only — no reorder/cancel/return/tracking/invoice controls.
};

export default BcOrderDetailTemplate;
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx`

```typescript
import { retrieveBCOrder } from "@/lib/data/business-central";
import BcOrderDetailTemplate from "@/modules/account/templates/bc-order-detail-template";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function BCOrderDetailPage(props: Props) {
  // IMPLEMENT:
  // 1. Read params.id.
  // 2. Call retrieveBCOrder(id) in a try/catch.
  // 3. If the helper returns null, call notFound().
  // 4. If the helper throws, render a customer-safe error state.
  // 5. Otherwise render <BcOrderDetailTemplate order={order} />.
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/loading.tsx`

```typescript
import Spinner from "@/modules/common/icons/spinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full text-ui-fg-base">
      <Spinner size={36} />
    </div>
  );
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/not-found.tsx`

```typescript
export default function NotFound() {
  // IMPLEMENT:
  // Render a customer-safe "Order not found" message and a link back to /account/bcorders.
}
```

## Impacted Files

- `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx` — new file
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx` — new file
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/loading.tsx` — new file
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/not-found.tsx` — new file

## Test Cases

### TC-1: Loading state renders while the route is resolving
- **Given:** The detail fetch is still pending.
- **When:** I open `/account/bcorders/:id`.
- **Then:** I see the spinner loading state.

### TC-2: Missing order shows customer-safe not found
- **Given:** The backend returns no order for the requested id.
- **When:** I open `/account/bcorders/:id`.
- **Then:** I see the route-local not-found state.

### TC-3: Unexpected failure shows a customer-safe error
- **Given:** The detail request fails unexpectedly.
- **When:** I open `/account/bcorders/:id`.
- **Then:** I see a generic error message with no BC internals.

### TC-4: Populated detail view is read-only
- **Given:** The order exists and belongs to my company.
- **When:** I open `/account/bcorders/:id`.
- **Then:** I see header fields and line items only.
- **And:** No reorder/cancel/return/tracking/invoice controls are shown.

## Implementation Steps

1. Add the read-only detail template for BC order header data and line items.
2. Add the route page and wire it to `retrieveBCOrder()`.
3. Add loading and not-found states for the detail route.
4. Keep all copy customer-safe and informational only.
