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
