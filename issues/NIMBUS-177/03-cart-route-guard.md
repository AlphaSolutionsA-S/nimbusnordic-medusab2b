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

## Deviations
- The guard runs after each route's request validators, not before every existing middleware: core
  validators always register ahead of project middlewares on the same matcher, and in project
  entries (quotes, free shipping) the guard is placed after the validators so it checks the same
  validated `cart_id` the route uses. Validation reads no cart, so nothing leaks; an anonymous call
  with an invalid body gets 400 before 401. The guard still runs before `ensureCartEditable` and the
  route (proven by the "stranger on a cart under approval" case).
- `POST /store/carts/:id/line-items/bulk` is also matched by `/store/carts/:id/line-items/:line_id`,
  so the check runs twice on bulk requests (same class, same answer); the explicit bulk entry is
  kept so the route stays guarded if the `:line_id` entry changes.
- Owner success on mutations: 200 is asserted for read, update and customer transfer; for the other
  routes the test asserts the request reached the route (neither 401 nor the refusal body), because
  the seeded cart has no variants, shipping options or enabled payment provider.
- Added scenarios beyond the intent: owner of a cart linked to another company, and an administrator
  when the cart has no admin approval. "Former member" is the owner removed through the store
  employee-delete route (soft delete), reading their own cart.
- Admin with pending approval is checked on every `owner` and `pay` route (the intent named the
  payment collection only).
- Also updated, not listed: `integration-tests/http/companies/companies.spec.ts` TC-5 read an unowned
  company cart, which is now ambiguous; the cart gets the employee as owner. In the security spec the
  approval setup moved into an `attachAdminApproval` helper reused by `createApproval`.
- The quote HTTP specs (`integration-tests/http/quotes`, `http/admin/quotes`) still fail as on the
  baseline (`createAdminUser` signs with an unset `JWT_SECRET`), so they never reach the guard; the
  quote route's guard is covered by the security spec only.

## Done-when evidence
- Matrix passes against real installed middleware: `security-boundaries.spec.ts` › `cart access guard`,
  12 tests pass against the in-app server on real Postgres (full spec 63/63):
  - anonymous 401 on all 19 guarded requests, state unchanged: "answers an anonymous caller with 401
    on every guarded route and changes nothing";
  - foreign company, colleague, former member, ambiguous (no link; link to another company), admin
    without approval: 404 with a body equal to the nonexistent-cart body (`{ type: "not_found",
    message: "Cart not found" }`), `Cache-Control: private, no-store`, and cart, items, customer,
    shipping methods, approvals, payment sessions and quotes unchanged: "refuses %s on every guarded
    route like a missing cart and changes nothing" (6 cases);
  - registered before `ensureCartEditable`: "refuses a stranger before the frozen-cart check on a cart
    under approval" (404, not 403);
  - owner read and edit: "lets the owner read and edit an editable cart"; owner on pending/approved
    cart still 403: existing "blocks cart mutations while approval is pending/approved" (now runs
    through the guard first, passes);
  - admin pending: "lets an administrator read but not pay or edit a cart under pending approval";
    admin approved: "lets an administrator pay but never edit an approved cart";
  - non-owner customer transfer: "never lets a non-owner take a cart over through the customer route";
  - payment session on another customer's collection, quote, free-shipping and shipping options with
    a foreign `cart_id`: rows in the refusal matrix (`ROUTES`).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, 13 warnings, none in touched files.
- Typecheck: 22 errors, baseline 22 (same files).
- Route bodies unchanged: `git diff` touches only `middlewares.ts` files and the new
  `api/middlewares/ensure-cart-access.ts`; no `route.ts` changed.
- Also update: security spec case "allows cart edits and item deletion with rejected approval": the
  unlinked cart is now linked to the owner's company (passes). `docs/security-remediation.md` API
  behaviour: not changed here, left for task 05 as the line says.
