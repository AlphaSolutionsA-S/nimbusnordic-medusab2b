# Implementation Task 04: Adding BC Order Card Details Link

**Status:** Complete

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md`

## Solution Design

Update `BcOrderCard` so each BC order row exposes a `Details` link to the new detail route. The link should:

1. Use the BC order `id`.
2. Point at `/account/bcorders/[id]`.
3. Preserve the existing card layout and read-only presentation.

## Code Skeletons

### Modified File: `apps/storefront/src/modules/account/components/bc-order-card/index.tsx`

```typescript
import CalendarIcon from "@/modules/common/icons/calendar";
import DocumentIcon from "@/modules/common/icons/document";
import LocalizedClientLink from "@/modules/common/components/localized-client-link";
import type { BCOrder } from "@/types/bc-order";
import { Container } from "@medusajs/ui";

type BcOrderCardProps = {
  order: BCOrder;
};

const BcOrderCard = ({ order }: BcOrderCardProps) => {
  // IMPLEMENT:
  // Keep the existing date / number / status / amount presentation.
  // Add a "Details" link that points to `/account/bcorders/${order.id}`.
  // Keep the card read-only.
};

export default BcOrderCard;
```

## Impacted Files

- `apps/storefront/src/modules/account/components/bc-order-card/index.tsx`

## Test Cases

### TC-1: Order card shows a Details link
- **Given:** A BC order card is rendered.
- **When:** I view the list.
- **Then:** I see a `Details` link on the card.

### TC-2: Link points to the order id route
- **Given:** A BC order with id `abc123`.
- **When:** I click `Details`.
- **Then:** I navigate to `/account/bcorders/abc123`.

## Implementation Steps

1. Add a localized client link to the BC order card.
2. Keep the rest of the layout and formatting unchanged.
