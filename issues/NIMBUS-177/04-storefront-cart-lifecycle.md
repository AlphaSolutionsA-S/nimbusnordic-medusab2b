# 04: Storefront sign-in, cart lifecycle and messages
**App:** storefront · **Layer:** S2 data fn, S3 route, S4 feature component · **Depends on:** 02, 03

**Goal:** The storefront only creates and uses carts for a signed-in customer, drops cart pointers it
can no longer use, never reuses cart responses across accounts, and explains both cases in
translated text.
**Files / areas:** `apps/storefront/src/lib/data/{cart,customer,approvals,fulfillment,orders}.ts`,
`lib/util/customer-error.ts`, add-to-cart components under `modules/products/`,
`lib/context/cart-context.tsx`, `app/[countryCode]/(main)/cart/page.tsx`,
`app/[countryCode]/(checkout)/checkout/page.tsx`, `app/[countryCode]/(main)/layout.tsx`,
`modules/layout/components/cart-mismatch-banner/` (removed), `messages/*.json`
**Seam contracts:** backend answers 401 (no token) or 404 (refused or missing) on every cart route;
storefront stable codes: existing `CART_NOT_FOUND`, new sign-in-required and cart-unavailable codes
mapped to `Common.errors` keys.
**Test intent:**
- Jest (`src/__tests__/lib/data/`): add-to-cart without a token creates no cart and returns the
  sign-in code; login with an inaccessible cookie cart clears the cookie and never calls transfer or
  cart update; signup calls no transfer; cart, approval, shipping and order fetches (order
  confirmation, order detail, order history) send `no-store`.
- A refused order read keeps today's not-found behaviour on the confirmation and detail pages.
- Retrieving a cookie cart that the backend refuses yields "unavailable", not an exception.
- Component tests: add-to-cart shows the translated sign-in prompt; cart page and checkout render the
  unavailable notice; no literal UI text (`react/jsx-no-literals`).
**Done when:** tests pass; lint and storefront typecheck at or below baseline.
**Verify after deploy:** product page while signed out (sign-in prompt, no `_medusa_cart_id`
cookie); admin approval card and checkout for one approved colleague cart.
**Also update:** `src/__tests__/modules/layout/components/cart-mismatch-banner/index.test.tsx`
(removed with the component); `src/__tests__/lib/data/customer.test.ts` and `cart.test.ts` cases that
assert transfer or metadata updates; `messages/*.json` (new keys; `Layout.cartMismatchBanner` left
for the admin to retire).
