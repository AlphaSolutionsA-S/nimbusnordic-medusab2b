# 03: Guard on every direct and indirect cart route
**App:** backend · **Layer:** L6 middleware · **Depends on:** 01, 02

**Goal:** Every route in plan section 4 (task 03 list) authenticates the customer and runs the
cart-access workflow with its operation class before any existing middleware or the route itself.
**Files / areas:** `apps/backend/src/api/middlewares/` (new guard factory, next to
`ensure-role.ts`), `api/store/carts/middlewares.ts`, `api/store/quotes/middlewares.ts`,
`api/store/free-shipping/middlewares.ts`, a new store middleware entry for core
`payment-collections` and `shipping-options` routes, `api/store/middlewares.ts`
**Seam contracts:** operation classes per route as in plan section 6; cart id taken from path
`:id`, body `cart_id`, query `cart_id`, or (payment sessions) `payment_collection_id`; guarded
responses set `Cache-Control: private, no-store`; registered before `ensureCartEditable`.
**Test intent:**
- HTTP matrix in `security-boundaries.spec.ts` for every guarded route: anonymous 401; foreign
  company, same-company colleague, former member, ambiguous cart all 404 with a body equal to that
  of a nonexistent cart id, and persisted cart, items, customer and approvals unchanged.
- Owner succeeds on read and on an editable cart's mutations; owner on pending/approved cart still
  gets 403 from the frozen check.
- Admin with pending admin approval: read 200, payment collection 404; with approved approval:
  read, payment collection, payment session and complete reach the route; any `owner` route 404.
- Non-owner `POST /store/carts/:id/customer` leaves `customer_id` unchanged.
- Payment session on another customer's collection, quote from a foreign cart, free-shipping and
  shipping options with a foreign `cart_id` are refused.
**Done when:** matrix passes against real installed middleware; lint and typecheck at or below
baseline; route bodies unchanged.
**Verify after deploy:** `GET /store/carts/<controlled cart>` as owner (200), as anonymous (401) and
as a foreign customer (404); cart row unchanged after a refused `POST`.
**Also update:** `security-boundaries.spec.ts` case "allows cart edits and item deletion with
rejected approval" (its unlinked cart is now ambiguous: link it to the company);
`docs/security-remediation.md` API behaviour (task 05).
