# Fix brief: integration review findings M1–M3

**Issue:** NIMBUS-202 (storefront cart lifecycle; follow-up to the not-owned cookie cart fix)
**App:** storefront (`@b2b-starter/storefront`) and `docs/security-remediation.md`
**Source:** `issues/NIMBUS-177/deviation-report.md`, mechanical findings M1–M3.

## M2 (do first, test-first): make the ownership field explicit

`apps/storefront/src/lib/util/active-cart.ts` compares `lookup.cart.customer_id`, but `lookupCart`
(`apps/storefront/src/lib/data/cart.ts`) does not request `customer_id`; it only arrives as the join
key of the `*customer` expansion. If it went missing, every owner's cart would count as not owned
(dropped at login, replaced on every add to cart).

- Add `+customer_id` to the `lookupCart` `fields` list (preferred: keeps the comparison on the column),
  or compare `lookup.cart.customer?.id`. Pick one, keep the check in `active-cart.ts` as its one home.
- Test: in `src/__tests__/lib/data/cart.test.ts`, assert that `lookupCart` requests a field list that
  contains `customer_id` (or, if you choose `customer?.id`, that the helper decides ownership from
  `customer.id`). Write it so it fails before the change.

## M3 (test-first where it fails; otherwise a pinning test): unreadable customer in `getOrSetCart`

Add one case to `src/__tests__/lib/data/cart.test.ts`: a cookie cart is found but the signed-in customer
cannot be read (`retrieveCustomer` returns null). `getOrSetCart` (via add to cart) rejects / returns the
`CART_NOT_FOUND` code, creates no cart, adds no line item and keeps the cookie. This pins existing
behaviour, so it may pass immediately; say so in the summary.

## M1 (docs): exact wording

`docs/security-remediation.md` around lines 139–144 says the cookie cart "only ever points at a cart the
signed-in customer owns" and that checkout opens a colleague's cart "by its ID". Change to what the code
does: ownership is checked at login and before add to cart; approval pages and the post-approval
redirect open a colleague's cart through the explicit `cartId` query. Do not describe the approval-card
`cart_id` link (finding D1, open question for Klaus); do not fix D1.

## Also update

- `issues/NIMBUS-177/04-storefront-cart-lifecycle.md`: one short `## Deviations` line for this follow-up.
- No `ai/` changes (do not touch `ai/AGENTS.md` or the root `AGENTS.md`).

## Done when

- New tests pass (M2 failed first); scoped storefront tests green.
- Storefront lint passes; storefront typecheck at or below baseline (8).
- `### Files touched` listed.
