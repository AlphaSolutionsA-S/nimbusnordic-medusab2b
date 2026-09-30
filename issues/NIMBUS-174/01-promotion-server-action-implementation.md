# Task 01: Result-returning promotion Server Action with the full code list — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-174 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build` (note: `next.config.js` has `typescript.ignoreBuildErrors: true`, so also run `npx tsc --noEmit`)
- **Lint command:** `cd apps/storefront && pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test` (single file: `npx jest src/__tests__/lib/data/cart.test.ts`)
- **Test framework:** Jest (jsdom, `next/jest`), `clearMocks: true`
- **Test location:** `apps/storefront/src/__tests__/` mirroring `src/` (this task: `src/__tests__/lib/data/cart.test.ts`)
- **Naming conventions:** Prettier in this app: no semicolons, double quotes, trailing commas `es5`, 2 spaces. Match it (it overrides the generic TS style rule).

### Baselines on `develop` (re-verified 2026-09-30, `4432cb4`)

- Jest: 350 tests, 3 failures: `src/__tests__/app/main-layout.test.tsx` (1) and `src/__tests__/modules/products/components/product-tabs/index.test.tsx` (2).
- `npx tsc --noEmit`: 9 errors (account-nav test x3, quote-messages x1, profile-card x3, cart-drawer x2).
- `pnpm lint`: 2 `react-hooks/exhaustive-deps` warnings (`cart-context.tsx:182`, `cart-drawer/index.tsx:108`).

After this task none of these numbers may grow.

## Solution Design

`submitPromotionForm` in `src/lib/data/cart.ts` becomes the single Server Action for both adding and
removing a promotion code. It:

1. Reads the codes the cart currently has applied manually from the repeated form field `applied_code`
   (the component writes one hidden input per manual code, see Task 02).
2. If the form has a non-empty `remove_code`, it sends `applied_code` minus `remove_code`.
   Otherwise it reads `code` (the typed code). An empty or missing `code` returns `null` and sends nothing.
   A non-empty code sends `applied_code` plus `code`, de-duplicated.
3. Calls the existing `applyPromotions(codes)` (unchanged, it still throws) inside `try/catch`.
4. Returns `{ success: true }` or `{ success: false }`. It **never throws** and never returns the raw
   message, so nothing from the backend or Next.js can reach the customer.
5. Logs failures with the NIMBUS-173 helper `logCustomerError(context, error)`: context
   `"cart.submit-promotion"` for add and `"cart.remove-promotion"` for remove. It logs the message
   string only, with no form data.

Why the whole list is sent: Medusa 2.21.0 `POST /store/carts/:id` with `promo_codes` **replaces** the
cart's manual codes (evidence in SCOPE.md). Automatic promotions are recalculated by Medusa and are
not sent.

`applyPromotions(codes: string[])` keeps its signature and throwing behaviour. Its only callers are
`promotion-code/index.tsx` (removed from there in Task 02) and `cart.test.ts` (TC-8, unchanged).
`submitPromotionForm` is only used by `promotion-code/index.tsx`.

`cart.ts` has `"use server"` at the top. Only **async functions** may be exported at runtime from such a
file. An `export type` is erased and is allowed. The helper `getFormCodes` must **not** be exported.

## Code Skeletons

### Modified File: `apps/storefront/src/lib/data/cart.ts`

Change the import on line 4:

```typescript
import { CART_NOT_FOUND_ERROR, logCustomerError } from "@/lib/util/customer-error"
```

Replace the whole current `submitPromotionForm` (lines 372-386 on develop) with:

```typescript
export type PromotionFormState = { success: boolean } | null

function getFormCodes(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
}

// Adds (field `code`) or removes (field `remove_code`) one promotion code.
// Medusa replaces the cart's manual codes with `promo_codes`, so the full
// intended list is sent: the applied codes (`applied_code`) plus or minus one.
// Returns a result instead of throwing: Next.js replaces thrown Server Action
// messages in production.
export async function submitPromotionForm(
  currentState: PromotionFormState,
  formData: FormData
): Promise<PromotionFormState> {
  const appliedCodes = getFormCodes(formData, "applied_code")
  const removeCode = formData.get("remove_code")
  const isRemove = typeof removeCode === "string" && removeCode.length > 0

  let codes: string[]
  if (isRemove) {
    codes = appliedCodes.filter((code) => code !== removeCode)
  } else {
    const code = formData.get("code")
    if (typeof code !== "string" || !code) {
      return null
    }
    codes = Array.from(new Set([...appliedCodes, code]))
  }

  try {
    await applyPromotions(codes)
    return { success: true }
  } catch (error) {
    logCustomerError(
      isRemove ? "cart.remove-promotion" : "cart.submit-promotion",
      error
    )
    return { success: false }
  }
}
```

Nothing else in `cart.ts` changes. `currentState` is unused but required by the `useActionState`
action signature; keep the parameter.

### Modified File: `apps/storefront/src/__tests__/lib/data/cart.test.ts`

Change the `@/lib/config` mock so `sdk.store.cart.update` exists, and add the new describe block.
Keep the existing TC-8 test exactly as it is.

```typescript
jest.mock("@/lib/config", () => ({
  sdk: { store: { cart: { update: jest.fn() } } },
}))

// ... the other existing jest.mock calls stay unchanged ...

import { sdk } from "@/lib/config"
import { applyPromotions, emptyCart, submitPromotionForm } from "@/lib/data/cart"
import { getCartId } from "@/lib/data/cookies"

describe("cart data errors", () => {
  // existing TC-8 test, unchanged
})

function promotionForm(fields: Array<[string, string]>): FormData {
  const formData = new FormData()
  fields.forEach(([name, value]) => formData.append(name, value))
  return formData
}

describe("submitPromotionForm", () => {
  const update = sdk.store.cart.update as jest.Mock
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(getCartId as jest.Mock).mockResolvedValue("cart_1")
    update.mockResolvedValue({ cart: { id: "cart_1" } })
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore the factory default so TC-8 (no cart) is not affected.
    ;(getCartId as jest.Mock).mockResolvedValue(undefined)
    consoleError.mockRestore()
  })

  // IMPLEMENT: TC-1 .. TC-8 below. Assert the sent list with
  // expect(update).toHaveBeenCalledWith("cart_1", { promo_codes: [...] }, {}, {})
}
```

For the Medusa-error test, make `update` reject with an object shaped for `medusaError`:

```typescript
update.mockRejectedValue({
  response: {
    data: { message: "The promotion code NOPE is invalid" },
    status: 400,
    headers: {},
  },
  config: { url: "/store/carts/cart_1", baseURL: "http://localhost:9000" },
})
```

## Impacted Files

| File | Change |
|------|--------|
| `apps/storefront/src/lib/data/cart.ts` | Import `logCustomerError`. New exported type `PromotionFormState`. New private helper `getFormCodes`. `submitPromotionForm` signature changes from `(currentState: unknown, formData: FormData) => Promise<string \| undefined>` to `(currentState: PromotionFormState, formData: FormData) => Promise<PromotionFormState>`. `applyPromotions` unchanged. |
| `apps/storefront/src/__tests__/lib/data/cart.test.ts` | `sdk` mock gains `store.cart.update`. New `describe("submitPromotionForm")`. |

Callers of the changed signature: only `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx`
(updated in Task 02). Until Task 02 lands, that component still passes `submitPromotionForm` to
`useActionState(submitPromotionForm, null)`, which still type-checks (`null` is a valid
`PromotionFormState`), so the branch compiles between tasks.

## Test Cases

All in `src/__tests__/lib/data/cart.test.ts`, `describe("submitPromotionForm")`.

### TC-1: Adding a second code sends the existing and the new code
- **Given:** a cart id `cart_1`, `update` resolves
- **When:** `submitPromotionForm(null, promotionForm([["applied_code", "SAVE10"], ["code", "NEW20"]]))`
- **Then:** it resolves to `{ success: true }` and `update` was called with `("cart_1", { promo_codes: ["SAVE10", "NEW20"] }, {}, {})`

### TC-2: Adding the first code sends only that code
- **Given:** no `applied_code` fields
- **When:** `submitPromotionForm(null, promotionForm([["code", "NEW20"]]))`
- **Then:** `update` was called with `{ promo_codes: ["NEW20"] }` and the result is `{ success: true }`

### TC-3: Adding a code that is already applied does not duplicate it
- **Given:** `applied_code` `SAVE10`
- **When:** `code` is `SAVE10`
- **Then:** `update` was called with `{ promo_codes: ["SAVE10"] }`

### TC-4: Removing one of several codes sends the remaining codes
- **When:** `promotionForm([["applied_code", "SAVE10"], ["applied_code", "SAVE20"], ["remove_code", "SAVE10"]])`
- **Then:** `update` was called with `{ promo_codes: ["SAVE20"] }` and the result is `{ success: true }`

### TC-5: Removing the only manual code sends an empty list
- **When:** `promotionForm([["applied_code", "SAVE10"], ["remove_code", "SAVE10"]])`
- **Then:** `update` was called with `{ promo_codes: [] }`

### TC-6: A Medusa error returns a failure and does not throw
- **Given:** `update` rejects with the Medusa-shaped error above
- **When:** `submitPromotionForm(null, promotionForm([["code", "NOPE"]]))`
- **Then:** it resolves (does not reject) to exactly `{ success: false }` (`toEqual`, so no message leaks);
  `console.error` was called with `("[customer-error]", { context: "cart.submit-promotion", message: expect.stringContaining("is invalid") })`

### TC-7: Cart not found returns a failure and does not throw
- **Given:** `getCartId` resolves `undefined` (`mockResolvedValue(undefined)` inside the test)
- **When:** `submitPromotionForm(null, promotionForm([["code", "NEW20"]]))`
- **Then:** it resolves to `{ success: false }`; `update` was not called; `console.error` was called with
  `("[customer-error]", { context: "cart.submit-promotion", message: "CART_NOT_FOUND" })`

### TC-8: A failed remove logs with the remove context
- **Given:** `update` rejects with the Medusa-shaped error
- **When:** `promotionForm([["applied_code", "SAVE10"], ["remove_code", "SAVE10"]])`
- **Then:** result `{ success: false }`; `console.error` was called with
  `("[customer-error]", { context: "cart.remove-promotion", message: expect.any(String) })`

### TC-9: An empty code sends nothing
- **When:** `submitPromotionForm(null, promotionForm([["code", ""]]))`
- **Then:** it resolves to `null` and `update` was not called

The existing TC-8 in `describe("cart data errors")` (`applyPromotions(["X"])` rejects with `CART_NOT_FOUND`)
must still pass: it proves `applyPromotions` itself is unchanged.

## Implementation Steps

1. On `feature/NIMBUS-174`, edit `apps/storefront/src/lib/data/cart.ts`: update the import on line 4 and
   replace `submitPromotionForm` with the skeleton above. Do not touch `applyPromotions` or any other function.
2. Edit `apps/storefront/src/__tests__/lib/data/cart.test.ts` as in the skeleton and write TC-1..TC-9.
3. Run `cd apps/storefront && npx jest src/__tests__/lib/data/cart.test.ts`; all pass.
4. Run `npx tsc --noEmit` (still 9 errors, none in the files you touched) and `pnpm lint` (still 2 warnings).
5. Run the full `pnpm test`: only the 3 baseline failures.
