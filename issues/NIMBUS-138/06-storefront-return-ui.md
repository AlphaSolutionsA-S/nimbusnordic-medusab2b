# Implementation Task 06: Storefront Return-Entry UI

> **Depends on task 05 and the NIMBUS-137 order-detail page.** Extends the read-only
> `bc-order-detail-template.tsx` with a return-entry action: select lines, set quantity, pick a
> per-line return reason, submit against the stubbed backend.

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **UI kit:** `@medusajs/ui`. Client interactivity requires `"use client"`.
- **Naming conventions:** kebab-case files, PascalCase components.

## Solution Design

Add a client return-entry component on the existing BC order-detail page. It:

1. Renders only eligible item lines (`order.lines` where `lineType === "Item"` and `quantity > 0`),
   each with a quantity input bounded by the line's returnable quantity **and** a return-reason
   `Select` populated from `listBCReturnReasons()`.
2. Lets the user select ≥1 line, a positive quantity ≤ the displayed amount, and a reason per
   selected line.
3. Submits via `createBCReturn`, mapping each selected line to
   `{ source_line_no: line.sequence, quantity, return_reason_code }`. Disables the button while
   pending to prevent duplicate submission.
4. Shows success (BC return-order number + status; must NOT imply a refund/credit was posted) and
   customer-safe errors (400/404 → friendly text).

Reasons are fetched server-side and passed in as a prop (keep the client component free of data
fetching): the server template calls `listBCReturnReasons()` and passes `reasons` to the client
component. `BcOrderDetailTemplate` is a server component; add the interactive piece as a separate
`"use client"` component.

## Code Skeletons

### Modified File: `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx`

```typescript
import BcOrderReturn from "@/modules/account/components/bc-order-return"
import { listBCReturnReasons } from "@/lib/data/business-central"
// ... inside the async server component, after loading `order`:
  const returnReasons = await listBCReturnReasons()
// ... render after the existing Items container:
      </Container>

      <BcOrderReturn order={order} reasons={returnReasons} />
    </div>
  )
}
```

### New File: `apps/storefront/src/modules/account/components/bc-order-return/index.tsx`

```typescript
"use client"

import { useState } from "react"
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui"
import { createBCReturn } from "@/lib/data/business-central"
import type {
  BCOrderDetail,
  BCReturnOrder,
  BCReturnReason,
} from "@/types/bc-order"

type BcOrderReturnProps = {
  order: BCOrderDetail
  reasons: BCReturnReason[]
}

// keyed by line.sequence (the BC source_line_no)
type LineDraft = { quantity: number; reasonCode: string }
type ReturnDraft = Record<number, LineDraft>

const BcOrderReturn = ({ order, reasons }: BcOrderReturnProps) => {
  const eligibleLines = order.lines.filter(
    (l) => l.lineType === "Item" && l.quantity > 0
  )

  const [draft, setDraft] = useState<ReturnDraft>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BCReturnOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  // IMPLEMENT:
  // - onQuantityChange(sequence, value, max): clamp to [0, max]; 0 clears the line's draft entry.
  // - onReasonChange(sequence, reasonCode): set draft[sequence].reasonCode.
  // - selectedLines(): draft entries with quantity > 0 -> { source_line_no: sequence, quantity,
  //   return_reason_code: reasonCode }. A selected line with no reason is invalid.
  // - canSubmit: !submitting && selectedLines().length > 0 && every selected line has a reasonCode.
  // - onSubmit():
  //     if (!canSubmit) return
  //     setSubmitting(true); setError(null)
  //     try { const r = await createBCReturn(order.id, { lines: selectedLines() }); setResult(r) }
  //     catch (e) { setError(mapReturnError(e)) }   // 400/404 -> friendly text, no BC internals
  //     finally { setSubmitting(false) }
  // - Render nothing / a disabled note when eligibleLines.length === 0.
  // - On result: "Return {result.number} created — status {result.status}." Do NOT imply a
  //   refund/credit memo was posted.

  if (result) {
    // IMPLEMENT: success panel
  }

  return (
    <Container className="flex flex-col gap-y-4" data-testid="bc-order-return">
      <Heading level="h2">Request a return</Heading>
      {/* IMPLEMENT: per eligible line -> quantity Input bounded by line.quantity + reason Select
          (options from `reasons`, showing reason.description, value reason.id). Submit Button
          disabled unless canSubmit. Customer-safe error Text. */}
    </Container>
  )
}

export default BcOrderReturn
```

## Test Cases (manual / via backend integration tests)

- **TC-1 Eligible lines only:** only `Item` lines with `quantity > 0` are selectable.
- **TC-2 Quantity bound:** a line's input cannot exceed its returnable quantity.
- **TC-3 Reason required:** a line with a quantity but no selected reason blocks submit.
- **TC-4 Duplicate-submit prevention:** the submit button is disabled while a request is in flight.
- **TC-5 Success state:** shows the BC return-order number/status; does not imply a refund/credit
  memo was posted.
- **TC-6 Customer-safe error:** a 400/404 renders friendly text with no BC internals.

## Implementation Steps

1. Fetch `listBCReturnReasons()` in the server template and pass to the client component.
2. Add the `bc-order-return` client component (per-line quantity + reason).
3. Implement clamping, per-line reason capture, `canSubmit`, pending/success/error states, and
   error mapping.
4. Run `pnpm build` for the storefront.
