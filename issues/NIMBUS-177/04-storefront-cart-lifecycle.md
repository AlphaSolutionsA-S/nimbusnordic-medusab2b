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

## Deviations
- Sign-in prompt is a translated toast (`Common.errors.signInRequired`) raised by `CartProvider`, which runs the add-to-cart action for both product controls through the event bus; `modules/products/` components are unchanged. Why: neither control knows the customer, and the provider is where the action's result arrives.
- `addToCart` and `addToCartBulk` return `{ error: "SIGN_IN_REQUIRED" }` instead of throwing. Why: Next.js strips thrown server-action messages in production, so a thrown code would not reach the client.
- New S2 function `lookupCart(id?)` returns `none | unavailable | error | found`; `retrieveCart` stays as a wrapper (cart or null) for its existing callers. The `error` state is an addition to the plan's none/unavailable pair, so a transient backend fault never clears the cart cookie. A 401 and a missing token map to `none`; with no token the backend is not called.
- `CART_UNAVAILABLE` is produced when a cookie-cart mutation (`updateCart`, add line item, update and delete line item) gets a 404. The cart page and checkout notice use their own `Cart.unavailableNotice` keys (heading, message, link) alongside `Common.errors.cartUnavailable`. Why: a full-page notice needs a heading and a link, not one error line.
- `getOrSetCart` throws `SIGN_IN_REQUIRED` without a token, and `CART_NOT_FOUND` when the lookup fails for a reason other than refusal, instead of creating a new cart on any failure as before. Why: a new cart must not replace a valid one after a transient error.
- The main layout no longer fetches the customer: only the removed mismatch banner used it.
- The `transferCart` server action is deleted; nothing calls it any more.
- The touched fetches swap their `next` cache-tag options for `cache: "no-store"`; `revalidateTag` calls stay as they were.
- `customer.test.ts`: the login ordering test now expects `token-stored`, `company-synced`, `cart-looked-up` (login no longer reads the customer); the signup test sets a cookie cart id so its no-transfer assertion would have failed on the old code.
- `src/__tests__/app/order-pages.test.tsx` passed before the change: it guards behaviour the task keeps (not-found for a refused order), so it can't go red first.
- Follow-up fix (review finding, decided by Klaus Petersen 2026-10-21): the cookie cart must be owned by the signed-in customer. New pure helper `activeCartLookup(lookup, customerId)` in `lib/util/active-cart.ts` turns a found cart whose `customer_id` differs from the signed-in customer into `unavailable`, and a found cart with no known customer into `error`. Login (reads the customer only when the lookup found a cart) drops the cookie on `unavailable`; `getOrSetCart` (reads the customer before the lookup) creates a new cart for it. Why: an administrator can read a colleague's cart under admin approval but every mutation is owner-only, so keeping it as the cookie cart made every add to cart fail with `CART_UNAVAILABLE` and never started a new cart (plan D4). `lookupCart` itself is unchanged, so approval pages and checkout still open colleague carts by explicit id. The login ordering test is unchanged because the customer is read only for a found cart; `cart.test.ts` now resets its SDK mocks in `beforeEach` so queued once-values do not leak between tests, and its "refused mutation" fixture cart is owned by the signed-in customer.
- Integration-review follow-up (M1–M3): `lookupCart` now requests `+customer_id` explicitly so the ownership check no longer depends on the `*customer` join key (pinned in `cart.test.ts`); a pinning test covers `getOrSetCart` refusing with `CART_NOT_FOUND` when the customer cannot be read; `docs/security-remediation.md` now says ownership is checked at login and before add to cart, and colleague carts open through the explicit `cartId` query.
- Pre-existing, not fixed: `checkout/page.tsx` reads `searchParams` synchronously (it is a Promise in Next 15); `addToCartBulk` uses raw `fetch` and ignores non-2xx responses; the `useCallback` in `cart-context.tsx` has an incomplete dependency list (lint warning, which now also lists `tErrors`).

## Done-when evidence
- Add-to-cart without a token creates no cart and returns the sign-in code: `src/__tests__/lib/data/cart.test.ts`, "add to cart › returns the sign-in code and creates no cart without a token".
- Login with an inaccessible cookie cart clears the cookie and never calls transfer or cart update: `src/__tests__/lib/data/customer.test.ts`, "login cart lifecycle › clears an inaccessible cookie cart and never transfers or updates it" (plus "keeps an accessible cookie cart…" and "keeps the cookie when the cart lookup fails for another reason").
- Signup calls no transfer: `customer.test.ts`, "registers the company after persisting authentication without a second employee request" (asserts `transferCart` not called with a cookie cart present).
- Cart, approval, shipping and order fetches send `no-store`: `cart.test.ts` "lookupCart › fetches the cart with no-store and the caller's token"; `approvals.test.ts` "listApprovals › lists approvals with no-store…"; `fulfillment.test.ts` both cases; `orders.test.ts` "reads one order (confirmation and detail)…" and "reads the order history with no-store".
- A refused order read keeps not-found on the confirmation and detail pages: `src/__tests__/app/order-pages.test.tsx`, "order pages for a refused order › order confirmation / order detail renders not-found".
- A refused cookie cart yields "unavailable", not an exception: `cart.test.ts`, "lookupCart › reports unavailable, not an exception, when the backend refuses the cookie cart" (and "reports an error, not unavailable, for other failures").
- Add-to-cart shows the translated sign-in prompt: `src/__tests__/lib/context/cart-context.test.tsx`, "shows the translated sign-in prompt when adding to cart while signed out".
- Cart page and checkout render the unavailable notice: `src/__tests__/app/cart-page.test.tsx` "shows the unavailable notice when the cookie cart is refused"; `src/__tests__/app/checkout-page.test.tsx` "shows the unavailable notice when the cart is refused"; component copy in `src/__tests__/modules/cart/components/cart-unavailable-notice/index.test.tsx`.
- Stable codes map to `Common.errors` keys: `src/__tests__/lib/util/customer-error.test.ts`, "maps %p to %s".
- No literal UI text: storefront lint reports no `react/jsx-no-literals` finding in the touched files.
- Lint and typecheck at or below baseline: lint exit 0 (2 warnings, both pre-existing); `tsc --noEmit` 8 errors, the same set as `tsc-storefront-baseline.txt`.
- Also update, `cart-mismatch-banner/index.test.tsx`: removed with the component.
- Also update, `customer.test.ts` and `cart.test.ts`: cases that relied on transfer or the metadata update now assert their absence (see Deviations); `cart.test.ts` mocks a richer SDK.
- Also update, `messages/*.json`: all eight catalogs gain `Common.errors.signInRequired`, `Common.errors.cartUnavailable` and `Cart.unavailableNotice.{heading,message,exploreProductsLabel}`; `Layout.cartMismatchBanner` is left for the admin to retire.
- Follow-up fix, not-owned cookie cart: `customer.test.ts` "login cart lifecycle › clears a colleague's cart the administrator can read but does not own, without transferring or updating it" (red before the fix), "keeps a cookie cart the signed-in customer owns without transferring or updating it", "keeps the cookie when the signed-in customer cannot be read", "keeps the cookie when the cart lookup fails for another reason"; `cart.test.ts` "add to cart › starts a new cart when the cookie cart is readable but owned by a colleague" (red before the fix) and "reuses a cookie cart the signed-in customer owns". `docs/security-remediation.md` rollout section gains a bullet on not-owned cookie carts.
- Verify after deploy: not provable in this task. It needs the deployed storefront and backend (signed-out product page sets no cart cookie; admin approval card and checkout for an approved colleague cart).
