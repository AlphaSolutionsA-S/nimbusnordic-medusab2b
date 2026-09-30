# Task 02: Wire the promotion-code component to the returning action — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-174 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build` (plus `npx tsc --noEmit`, because `ignoreBuildErrors: true`)
- **Lint command:** `cd apps/storefront && pnpm lint` (includes `react/jsx-no-literals` at warn for `src/modules`; do not add literal text in JSX children)
- **Test command:** `cd apps/storefront && pnpm test` (single file: `npx jest src/__tests__/modules/checkout/components/promotion-code/index.test.tsx`)
- **Test framework:** Jest + React Testing Library + `@testing-library/user-event`. `next-intl` is mocked globally by `apps/storefront/__mocks__/next-intl.tsx`, which resolves keys against the real `messages/en.json`, so tests assert real English copy.
- **Test location:** `apps/storefront/src/__tests__/modules/checkout/components/promotion-code/index.test.tsx` (exists)
- **Naming conventions:** Prettier: no semicolons, double quotes, trailing commas `es5`.
- **Baselines:** see Task 01 (Jest 3 failures, tsc 9 errors, lint 2 warnings). None may grow.

## Solution Design

Today the component's `useActionState(submitPromotionForm, null)` result is never wired, the form submits
to a local `addPromotionCode` that calls the throwing `applyPromotions` with no error handling, and both
handlers use the inverted filter `p.code === undefined`. This task:

1. **One action state for add and remove.** `useActionState` wraps `submitPromotionForm` (Task 01) in a
   small client function. The add form and every remove button's form submit to the same `formAction`,
   so the error shown always belongs to the latest action.
2. **Full code list.** `manualCodes` = codes of the cart's promotions that are not automatic and have a code.
   Each form carries them as hidden `applied_code` inputs. The add form's text field is `code`. Each remove
   form adds a hidden `remove_code` with that promotion's code. The server works out the list (Task 01).
3. **Error display.** `state?.success === false` shows `t("applyErrorMessage")` in
   `data-testid="discount-error-message"`. It is rendered in exactly one place: under the input when the add
   form is open (unchanged position), otherwise just above the applied-promotions list. That covers a failed
   remove while the form is closed, or while the cart is pending approval (the add form is not rendered then
   but the remove buttons are).
4. **Keep or clear the typed code.** The input becomes controlled (`useState`). React 19 resets uncontrolled
   fields after every form action, whether it succeeded or not, so a controlled input is needed to keep the
   typed code on failure. React syncs a controlled input's `value` attribute, so the reset restores the typed
   value. The wrapper clears it only when an **add** succeeds.
5. **Remove** becomes `<form action={formAction}>` with a `type="submit"` button. It has the same
   `data-testid="remove-discount-button"`, class and sr-only label, so it is awaited and handled by
   `useActionState`, not fired and forgotten from `onClick`.

Unchanged: props (`{ cart: B2BCart }`), the two callers (`src/modules/cart/templates/summary.tsx` and
`src/modules/checkout/templates/checkout-summary/index.tsx`), visibility rules (`isCheckout`,
`isPendingApproval`, `is_automatic`), and all translation keys. No new keys.

Small visible difference: the remove button is now rendered only when the promotion has a `code`. Before,
it was rendered but its `onClick` returned early when `code` was missing, so it did nothing.

## Code Skeletons

### Modified File: `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx`

Full new file. Everything from `promotions.length > 0 && (` down, except the remove control, is the current
markup, unchanged.

```tsx
"use client"

import { PromotionFormState, submitPromotionForm } from "@/lib/data/cart"
import { getCartApprovalStatus } from "@/lib/util/get-cart-approval-status"
import { convertToLocale } from "@/lib/util/money"
import Trash from "@/modules/common/icons/trash"
import { B2BCart } from "@/types"
import { ChevronDownMini, ChevronUpMini } from "@medusajs/icons"
import { Badge, Heading, Input, Text } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import React, { useActionState } from "react"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

type PromotionCodeProps = {
  cart: B2BCart
}

const PromotionCode: React.FC<PromotionCodeProps> = ({ cart }) => {
  const t = useTranslations("Checkout.promotionCode")
  const locale = useLocale()
  const [isOpen, setIsOpen] = React.useState(false)
  const [code, setCode] = React.useState("")
  const pathname = usePathname()

  const isCheckout = pathname.includes("/checkout")

  const { promotions = [] } = cart

  const { isPendingAdminApproval, isPendingSalesManagerApproval } =
    getCartApprovalStatus(cart)

  const isPendingApproval =
    isPendingAdminApproval || isPendingSalesManagerApproval

  const manualCodes = promotions.flatMap((promotion) =>
    !promotion.is_automatic && promotion.code ? [promotion.code] : []
  )

  const [state, formAction] = useActionState(
    async (currentState: PromotionFormState, formData: FormData) => {
      const result = await submitPromotionForm(currentState, formData)
      if (result?.success && !formData.has("remove_code")) {
        setCode("")
      }
      return result
    },
    null
  )

  const errorMessage = state?.success === false ? t("applyErrorMessage") : null
  const isFormOpen = !isCheckout && !isPendingApproval && isOpen

  const appliedCodeInputs = manualCodes.map((appliedCode) => (
    <input
      key={appliedCode}
      type="hidden"
      name="applied_code"
      value={appliedCode}
    />
  ))

  return (
    <div className="w-full bg-white flex flex-col">
      <div className="txt-medium">
        {!isCheckout && !isPendingApproval && (
          <form action={formAction} className="w-full mb-5">
            {appliedCodeInputs}
            {/* existing toggle <button type="button" ... data-testid="add-discount-button"> unchanged */}

            {isOpen && (
              <>
                <div className="grid grid-cols-[1fr_auto] w-full gap-x-2">
                  <Input
                    className="w-full"
                    id="promotion-input"
                    name="code"
                    type="text"
                    autoFocus={false}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    data-testid="discount-input"
                  />
                  {/* existing SubmitButton data-testid="discount-apply-button" unchanged */}
                </div>

                <ErrorMessage
                  error={errorMessage}
                  data-testid="discount-error-message"
                />
              </>
            )}
          </form>
        )}

        {!isFormOpen && (
          <ErrorMessage
            error={errorMessage}
            data-testid="discount-error-message"
          />
        )}

        {promotions.length > 0 && (
          // IMPLEMENT: existing heading + promotions.map markup unchanged,
          // except the remove control, which becomes:
          //
          // {!promotion.is_automatic && !isCheckout && promotion.code && (
          //   <form action={formAction}>
          //     {appliedCodeInputs}
          //     <input type="hidden" name="remove_code" value={promotion.code} />
          //     <button
          //       type="submit"
          //       className="flex items-center"
          //       data-testid="remove-discount-button"
          //     >
          //       <Trash size={14} />
          //       <span className="sr-only">{t("removeDiscountSrLabel")}</span>
          //     </button>
          //   </form>
          // )}
        )}
      </div>
    </div>
  )
}

export default PromotionCode
```

Removed from the file: the `applyPromotions` import, `removePromotionCode`, `addPromotionCode` (including the
`document.getElementById("promotion-input")` reset), and the old `const [message, formAction] = ...` line.
`PromotionFormState` is a type exported from a `"use server"` module. That is fine because it is erased at
compile time. If the linter or `isolatedModules` asks for it, write `import { submitPromotionForm, type PromotionFormState } from "@/lib/data/cart"`.

Fallback, only if TC-2 (keep typed code) fails because React's form reset clears the controlled input: keep
`<form action={formAction}>` for the remove forms. For the add form, use
`onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); React.startTransition(() => formAction(formData)) }}`
instead of `action`, so no automatic reset runs. `SubmitButton`'s pending spinner (`useFormStatus`) then
no longer shows for the add form. Pass `disabled={isPending}`, using the third `useActionState` value, if a
pending state is wanted. Record the deviation in PROGRESS.md.

### Modified File: `apps/storefront/src/__tests__/modules/checkout/components/promotion-code/index.test.tsx`

- **Delete** the `jest.mock("react", ...)` block, the `useActionState` import and the old TC-6 test (the stub).
- The `@/lib/data/cart` mock becomes `jest.mock("@/lib/data/cart", () => ({ submitPromotionForm: jest.fn() }))`.
- Keep the three existing rendering tests unchanged.

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { usePathname } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/cart"),
}))

jest.mock("@/lib/data/cart", () => ({
  submitPromotionForm: jest.fn(),
}))

import { submitPromotionForm } from "@/lib/data/cart"
import PromotionCode from "@/modules/checkout/components/promotion-code"

const ERROR_TEXT =
  "This code could not be applied. Check the code and try again."

const submitMock = submitPromotionForm as jest.Mock

function lastFormData(): FormData {
  const calls = submitMock.mock.calls
  return calls[calls.length - 1][1] as FormData
}

async function applyCode(value: string) {
  await userEvent.click(
    screen.getByRole("button", { name: /Enter Promotion Code/ })
  )
  await userEvent.type(screen.getByTestId("discount-input"), value)
  await userEvent.click(screen.getByRole("button", { name: "Apply" }))
}

describe("PromotionCode", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/cart")
  })

  // ... three existing rendering tests unchanged ...

  // IMPLEMENT: TC-1 .. TC-8 below
})
```

Carts for the tests (cast with `as unknown as B2BCart`, as the existing tests do):

```tsx
const emptyCart = { promotions: [] }
const oneManual = {
  promotions: [
    { id: "p1", code: "SAVE10", is_automatic: false },
    { id: "p2", code: "AUTO5", is_automatic: true },
  ],
}
const twoManual = {
  promotions: [
    { id: "p1", code: "SAVE10", is_automatic: false },
    { id: "p2", code: "SAVE20", is_automatic: false },
  ],
}
```

`getCartApprovalStatus(cart)` returns "not pending" for these carts, because it checks
`cart?.approvals?.length` first (verified in `src/lib/util/get-cart-approval-status.ts`). For TC-8 use a
cart that is pending admin approval:

```tsx
const pendingApproval = {
  ...twoManual,
  approvals: [{ id: "a1", status: "pending", type: "admin" }],
}
```

(`ApprovalStatusType.PENDING === "pending"`, `ApprovalType.ADMIN === "admin"`, from `src/types/approval/module.ts`.)

## Impacted Files

| File | Change |
|------|--------|
| `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx` | As in the skeleton: one `useActionState` over `submitPromotionForm`, a controlled input, hidden `applied_code` / `remove_code` inputs, remove as a submit form, one error area. Props unchanged. |
| `apps/storefront/src/__tests__/modules/checkout/components/promotion-code/index.test.tsx` | Remove the `react` mock and the TC-6 stub. Add the real form-submit tests. |

No other file imports this component's internals. Its callers `src/modules/cart/templates/summary.tsx` and
`src/modules/checkout/templates/checkout-summary/index.tsx` pass `cart` only and need no change.

## Test Cases

### TC-1: An invalid code submitted through the real form shows the translated message (replaces the old TC-6)
- **Given:** `submitMock.mockResolvedValue({ success: false })`, `emptyCart`
- **When:** `applyCode("DOESNOTEXIST")`
- **Then:** `await screen.findByTestId("discount-error-message")` has text `ERROR_TEXT`;
  `screen.queryByText(/is invalid/)` is null; `submitMock` was called once and `lastFormData().get("code")` is `"DOESNOTEXIST"`

### TC-2: A failed apply keeps the typed code
- **Given/When:** as TC-1
- **Then:** after the error is shown, `screen.getByTestId("discount-input")` has value `"DOESNOTEXIST"` (`toHaveValue`)

### TC-3: A successful apply clears the field and shows no error
- **Given:** `submitMock.mockResolvedValue({ success: true })`, `emptyCart`
- **When:** `applyCode("SAVE10")`
- **Then:** `await waitFor(() => expect(screen.getByTestId("discount-input")).toHaveValue(""))`;
  `screen.queryByTestId("discount-error-message")` is null

### TC-4: Adding a second code sends the existing manual code and the new one
- **Given:** `submitMock.mockResolvedValue({ success: true })`, `oneManual` (manual `SAVE10`, automatic `AUTO5`)
- **When:** `applyCode("NEW20")`
- **Then:** `lastFormData().getAll("applied_code")` equals `["SAVE10"]` (no `AUTO5`); `get("code")` is `"NEW20"`;
  `has("remove_code")` is false

### TC-5: Removing one of several codes sends the codes and the one to remove
- **Given:** `submitMock.mockResolvedValue({ success: true })`, `twoManual`
- **When:** `await userEvent.click(screen.getAllByTestId("remove-discount-button")[0])`
- **Then:** `await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))`; `lastFormData().getAll("applied_code")`
  equals `["SAVE10", "SAVE20"]`; `get("remove_code")` is `"SAVE10"`. (Task 01 TC-4 proves this sends `["SAVE20"]`.)

### TC-6: Removing the only manual code
- **Given:** `oneManual`
- **When:** click the only `remove-discount-button` (the automatic promotion has none)
- **Then:** `getAll("applied_code")` equals `["SAVE10"]` and `get("remove_code")` is `"SAVE10"`.
  (Task 01 TC-5 proves this sends `[]`.)

### TC-7: A failed remove shows the translated message in discount-error-message
- **Given:** `submitMock.mockResolvedValue({ success: false })`, `twoManual`, add form closed
- **When:** click the first `remove-discount-button`
- **Then:** `await screen.findByTestId("discount-error-message")` has text `ERROR_TEXT`, and there is exactly
  one `discount-error-message` element (`getAllByTestId(...).length === 1`)

### TC-8: A failed remove on a cart pending approval still shows the message
- **Given:** `submitMock.mockResolvedValue({ success: false })`, `pendingApproval`. The add form is not rendered
  (`screen.queryByTestId("add-discount-button")` is null), but the remove buttons are.
- **When:** click the first `remove-discount-button`
- **Then:** `await screen.findByTestId("discount-error-message")` has text `ERROR_TEXT`

Cart-not-found: the component cannot tell failure causes apart. It shows the same message for every
`{ success: false }`, which TC-1 and TC-7 cover. Task 01 TC-7 proves cart-not-found returns `{ success: false }`.

## Implementation Steps

1. Replace `promotion-code/index.tsx` following the skeleton. Copy the unchanged markup (toggle button,
   `SubmitButton`, heading, promotion rows) from the current file verbatim.
2. Update the test file: drop the `react` mock, the `useActionState` import and the old TC-6, change the cart
   mock, then add TC-1..TC-8.
3. `npx jest src/__tests__/modules/checkout/components/promotion-code/index.test.tsx`: all pass. If TC-2 fails
   because the input is cleared, apply the fallback described under the skeleton and note it in PROGRESS.md.
4. `npx tsc --noEmit` (still 9, none in touched files), `pnpm lint` (still 2 warnings, no new
   `jsx-no-literals`), full `pnpm test` (only the 3 baseline failures).
