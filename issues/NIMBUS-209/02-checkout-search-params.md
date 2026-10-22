# 02: Checkout reads cartId from awaited search params
**App:** storefront · **Layer:** S3 · **Depends on:** 01

**Goal:** The checkout page awaits `searchParams` before it reads `cartId`. Next.js 16 passes a
plain Promise, so the current synchronous read gets `undefined`, and the approval flow (redirect
to `/checkout?cartId=<colleague cart>&step=payment`) would open the admin's own cookie cart.
**Files / areas:** `src/app/[countryCode]/(checkout)/checkout/page.tsx`,
`src/__tests__/app/checkout-page.test.tsx`.
**Seam contracts:** `lookupCart(id?: string)` is unchanged: given an id it uses that id, otherwise
the cookie cart.
**Test intent (unit, page test):**
- `searchParams` passed as `Promise.resolve({ cartId: "cart_colleague", step: "payment" })` makes
  `lookupCart` get `"cart_colleague"`. This is the negative case that today's plain-object test
  hides.
- `searchParams` resolving without `cartId` makes `lookupCart` get `undefined` (cookie cart).
- The existing unavailable, none and not-found cases still pass with Promise `searchParams`.
**Done when:** every case in the page test passes `searchParams` as a Promise, and the page's prop
type is a `Promise`.
**Verify after deploy:** on the preview site, a company admin approves a colleague's cart. The
payment step shows the colleague's cart id and total, not the admin's own cart.
**Also update:** `src/__tests__/app/checkout-page.test.tsx` (all cases).

## Deviations

- Added no `error`-status case: the test intent's "unavailable, none and not-found" are covered by
  the existing unavailable case and the `none` case, which asserts the not-found outcome.
- The page keeps the existing `cartId as string` read (now on the awaited object); narrowing a
  repeated `cartId` array was not part of this task.
- Lint not run: `next lint` is gone in Next.js 16 until task 04.

## Done-when evidence

- Every page-test case passes `searchParams` as a Promise: `src/__tests__/app/checkout-page.test.tsx`,
  all four cases (`shows the unavailable notice...`, `opens the colleague cart named by cartId...`,
  `falls back to the cookie cart when the search params have no cartId`, `keeps not-found when there
  is no cart`), 4 passed. The two `cartId` cases failed before the change (`lookupCart` got
  `undefined`).
- The page's prop type is a Promise: `searchParams: Promise<{ [key: string]: string | string[] |
  undefined }>` in `src/app/[countryCode]/(checkout)/checkout/page.tsx`; typecheck 58 errors, the
  same set as after task 01 (none in the checkout page or its test).
- Verify after deploy (colleague cart on the payment step): not provable in this task: needs the
  preview site with a company admin and a colleague's cart.
- Also update `src/__tests__/app/checkout-page.test.tsx` (all cases): done, all cases use Promise
  `searchParams`, plus the new no-`cartId` case.
