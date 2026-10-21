# Fix brief: approval card "Place order" link (gate answer D1)

**Issue:** NIMBUS-202 (storefront cart lifecycle)
**App:** storefront (`@b2b-starter/storefront`); `docs/security-remediation.md`
**Decided by:** Klaus Petersen, 2026-10-21 (deviation report, open question 1, answer (a)).

## Problem

`apps/storefront/src/modules/account/components/approval-card-actions/index.tsx` (around lines 76 and
130) links "Place order" to `/checkout?cart_id=…&step=payment`. Checkout
(`apps/storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx`, around line 24) reads `cartId`.
Only the redirect after approving (`lib/data/approvals.ts`, around line 95) sends `cartId`. So when an
administrator follows the link from an approved colleague cart, checkout shows the administrator's own
cookie cart instead of the colleague's. With no cookie cart, `middleware.ts` (which treats `cart_id`
without a `step`... read it to confirm) appears to redirect to the same URL in a loop.

## Required behaviour

An administrator who follows "Place order" from an approved colleague cart reaches checkout with that
colleague's cart (read by explicit id through `lookupCart(cartId)`, which the backend allows for pay on an
approved admin approval). There is no redirect loop, with or without a cookie cart. The colleague's
cart never becomes the administrator's cookie cart: the fix-04 rule (the active cookie cart is always
owned by the signed-in customer) still holds.

Use the parameter name checkout already reads (`cartId`), matching `approvals.ts`. Read `middleware.ts`
and confirm how it handles `cart_id` and `cartId` (and `step`). If the middleware copies `cart_id`
into the cookie, make sure the fixed link does not do that, and that nothing else in the storefront
still sends `cart_id` to checkout (search for it). Change as little as possible.

## Test intent (test-first)

1. Approval card: for an approved colleague cart, the "Place order" link targets checkout with
   `cartId=<colleague cart id>` (and the step it needs), not `cart_id`. Fails before the change.
2. Checkout page: given `cartId` of a colleague cart the backend lets the administrator read, the page
   renders that cart (not the cookie cart) and does not redirect. Add to the existing
   `src/__tests__/app/checkout-page.test.tsx` if it doesn't already cover it.
3. No loop: if the middleware is involved in the `cart_id`/`cartId` path, a middleware unit test shows
   the fixed URL passes through without a redirect to itself and without setting the cart cookie.
   If the middleware is not involved for `cartId`, say so in the summary with the evidence.

## Also update

- Gate answer 4: if `docs/security-remediation.md` mentions the retired `Layout.cartMismatchBanner`
  keys, state that they stay in every environment's translation database (decided by Klaus Petersen,
  2026-10-21; harmless). One short sentence; no other doc changes.
- If the security doc or task 04's after-deploy line describes the approval card path, keep it
  accurate.
- `issues/NIMBUS-177/04-storefront-cart-lifecycle.md`: one `## Deviations` line for this follow-up.
- No `ai/` changes at all (AGENTS.md has 69 bytes of headroom).

## Done when

- Tests 1–3 as above (1 fails first). Scoped storefront tests green.
- Storefront lint passes; storefront typecheck at or below baseline (8).
- `### Files touched` listed.
