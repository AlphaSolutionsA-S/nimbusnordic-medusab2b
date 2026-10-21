# Fix brief: cookie cart the signed-in account can read but does not own

**Issue:** NIMBUS-202 (task 04 follow-up, decided by Klaus Petersen 2026-10-21: fix on this branch)
**App:** storefront (`@b2b-starter/storefront`)

## Problem

Found in task 04 review. At login (`apps/storefront/src/lib/data/customer.ts`, around line 190) and in
`getOrSetCart` (`apps/storefront/src/lib/data/cart.ts`), a cookie cart is kept when `lookupCart`
returns `found`. The backend lets a company administrator *read* a colleague's cart while it has an
admin approval, but every mutation is owner-only. So when an administrator signs in on a browser that
holds a colleague's cart under admin approval:

- the cart stays the active cookie cart;
- every add-to-cart answers `CART_UNAVAILABLE` (404 on the owner-only mutation);
- `getOrSetCart` never starts a new cart, because the lookup returns `found`.

This breaks plan D4 ("the next add-to-cart creates a new cart").

## Required behaviour

The active (cookie) cart is always one the signed-in customer owns (`cart.customer_id` equals the
signed-in customer's id).

- Login: when the cookie cart is found but `cart.customer_id` is not the signed-in customer, drop the
  cookie (same as `unavailable`). Never transfer or update it.
- `getOrSetCart`: when the cookie cart is found but not owned by the signed-in customer, create a new
  cart for the customer and set the cookie to it, exactly as for an unavailable cart.
- A transient `error` still keeps the cookie (unchanged).
- The administrator's approval card / approval pages read colleague carts by explicit id, not through
  the cookie; do not change those paths.

Resolve the signed-in customer id in the cheapest correct way already available in `lib/data` (e.g. the
customer retrieved with the same auth headers, or a field on the cart compared to the customer);
do not add a new backend route and do not decode the JWT by hand unless the codebase already does so
in `lib/data`. Keep the ownership check in one place (one helper used by both login and
`getOrSetCart`), not re-derived twice. This is a storefront lifecycle check only; authorization stays
in the backend.

## Test intent (test-first; write the failing test before the code)

In `apps/storefront/src/__tests__/lib/data/`:

1. Login, administrator on a browser holding a colleague's cart under admin approval: `lookupCart`
   finds the cart (readable) but its `customer_id` is the colleague's. After login the cart cookie is
   removed; no transfer and no cart update is called.
2. `getOrSetCart` / add-to-cart with that cookie still present (e.g. set after login): a new cart is
   created for the signed-in customer, the cookie points at the new cart, and the line item is added
   to the new cart (not the colleague's).
3. Owned cookie cart: kept at login and reused by `getOrSetCart` (regression).
4. Transient lookup error: cookie kept (regression, already covered; keep green).

## Also update

- `issues/NIMBUS-177/04-storefront-cart-lifecycle.md`: add a short `## Deviations` entry for this
  follow-up fix (what changed and why).
- `docs/security-remediation.md` rollout text, if it describes which cookie carts are dropped at
  login; search for it and adjust the wording so it matches.
- Existing tests in `customer.test.ts` / `cart.test.ts` that assert "accessible cart is kept": make
  their fixture cart owned by the signed-in customer if needed; never delete a test to make it pass.

## Done when

- The four tests above pass; they failed (1, 2) before the change.
- Storefront lint passes; storefront typecheck at or below baseline (8 errors).
- `### Files touched` listed in the summary.
