# Security review remediation

This change addresses review findings 1–6 and 9. Findings 7 (cumulative spending
limits), 8 (the cart/company metadata link), and 10 (claims live preview) remain
outside this change.

NIMBUS-177 later fixed finding 8 for carts: a cart's company link is written by the
server from the owner's employee record, and `metadata.company_id` no longer
grants or decides cart access. Store order access does not use the order's
company at all. Finding 8 stays open for orders: checkout copies the cart's
metadata, client `metadata.company_id` included, into the order's metadata, and
no order–company link is written for it (only orders created through Medusa's
create-order workflow, such as Admin draft orders, get that link, from their own
`metadata.company_id`). Business Central order
submission reads the company from the order's metadata, but only after it finds
a `canonical_order` payload there; only order ingestion writes that payload and
starts automatic submission. For a storefront order the remaining risk is
therefore an Admin submission request on an order whose cart metadata a client
filled with both a `canonical_order` payload and a `company_id`.

## API behavior

- Company reads require membership in the requested company. Company updates,
  deletion, employee management, and approval settings require that company's
  `employee.is_admin` flag. Provider `user_metadata.role` grants no authority.
- `POST /store/companies` creates the authenticated customer's first company and
  its administrator together. Clients must stop making a second request to create
  that employee. Customers already linked to a company cannot register another.
  Existing companies without an administrator must have an owner assigned through
  the merchant administration tools after ownership is verified.
- Customer quote acceptance, rejection, messages, and preview require ownership.
  Creating a quote also requires ownership of its source cart.
- Store approval decisions require an administrator of the cart's company and an
  `admin` approval. The server assigns `handled_by`; only pending requests can be
  approved or rejected. Sales-manager approvals remain merchant operations.
  The approvals list and decisions cover only carts whose company link equals
  the owner's current company (NIMBUS-177): a cart whose owner left the company,
  or that is linked to a company the owner is not in, is not listed, and
  deciding its approval answers 403 and changes nothing.
- Checkout requires an approved request for every approval type configured for
  the cart's company or the customer's company. Missing, pending, or rejected
  requests block checkout.
- Pending and approved carts cannot be edited, including quantities, deleted
  items, promotions, shipping, customer assignment, and bulk additions. Start a
  new cart to change such a purchase. Rejected carts can be edited and submitted
  again; a new submission replaces the rejected requests. Old decisions cannot
  authorize a changed purchase.
- Business Central store operations require customer authentication. The empty
  duplicate middleware entry has been removed.

### Cart access (NIMBUS-177)

- Carts are personal. Every cart route requires a signed-in customer, including
  creating a cart (`POST /store/carts`); a signed-out call answers 401 before any
  cart lookup. Creation records the signed-in customer as the owner and links the
  cart to that customer's company, read from their employee record; a customer
  with no employee record gets no link. Client `metadata.company_id` is still
  stored (orders read it, see finding 8) but never decides the link or access.
- A cart is usable only with a verified association: it has an owner, and its
  company link equals the owner's current company, or it has no link and the
  owner has no employee record. Any other cart (no owner, an employee owner
  without a link, or a link to a company the owner is no longer or never was in)
  is refused for everyone.
- The owner may read, change and pay their own cart. Colleagues, other companies'
  customers and anyone else may not.
- Administrator exception: an administrator of the cart's company may read a
  colleague's cart while it has an `admin` approval (any status) and the owner is
  still a member, and may pay it (payment collection, payment session, complete)
  only once an `admin` approval is approved. An administrator never changes a
  colleague's cart; approved and pending carts stay frozen for everyone.
- A signed-in caller who is refused gets the same 404 `Cart not found` as for a
  cart that does not exist, with no cart, customer or company data. The check
  runs before the frozen-cart check, so a refused caller does not learn a cart's
  approval state either. Guarded responses, refusals included, carry
  `Cache-Control: private, no-store`.
- The check runs on `GET`/`POST /store/carts/:id` and every cart sub-route (line
  items, bulk line items, promotions, shipping methods, taxes, approvals,
  complete) and on routes that reach a cart indirectly: `POST /store/quotes`
  (body `cart_id`), `POST /store/payment-collections` (body `cart_id`),
  `POST /store/payment-collections/:id/payment-sessions` (the collection's cart;
  a collection with no cart is refused), `GET /store/shipping-options` and
  `POST /store/shipping-options/:id/calculate` (`cart_id`), and
  `GET /store/free-shipping/prices` (`cart_id`). Reads and shipping lookups use
  the read rule, changes, approval and quote requests the owner rule, payment and
  completion the pay rule.
- Cart customer transfer (`POST /store/carts/:id/customer`) is owner-only, so a
  cart can no longer be claimed by knowing its ID. The storefront no longer calls
  it on login or signup.
- Every request is judged afresh against the database (current token, cart,
  link, approvals and employee records); no access state is held in memory, so
  the rule holds across instances, and a cart ID is never a credential.

### Order access (NIMBUS-177)

- Reading an order by ID (`GET /store/orders/:id`) and creating a return
  (`POST /store/returns`, body `order_id`) require a signed-in customer (401
  otherwise) who is either the order's owner, also after leaving the company, or
  an administrator of the company of the order's source cart (Medusa's
  order–cart link), provided that cart belongs to the order's owner, the owner is
  still a member of that company, and the cart's `admin` approval is approved. Any
  such administrator qualifies, not only the one who approved. Everyone else, and
  everyone for an order with no customer, gets the same 404
  `Order not found` as for a missing order; nothing is created on refusal. The
  order–company link is not consulted.
- Returns record no actor: Medusa's return route passes none, so a return does
  not show which administrator created it.
- Order transfer request (`POST /store/orders/:id/transfer/request`) stays open
  to every signed-in customer, as in Medusa, and cancel
  (`/transfer/cancel`) stays limited to the customer who made the request. Both
  answer `200 { "success": true }` and never return the order.
- Orders owned by a customer with an account cannot be transferred: the request
  answers 400 `Order cannot be transferred` and changes nothing, for the
  caller's own order and another account's order alike. An unknown order
  answers 404.
- Residual transfer exposure (accepted): a signed-in customer who knows an order
  ID can still learn from the answer whether the order exists and whether it
  belongs to an account. Orders with no customer (created through the order API)
  or with a guest customer can still get a transfer request from any signed-in
  customer; while it is pending, Medusa refuses every other change to that order
  until the requester cancels it or a merchant cancels or declines it in Admin.
  The transfer token appears in no store response and nothing sends it; if it
  were accepted, the requester would become the order's owner.

## Cart and order access rollout (NIMBUS-177)

No data migration runs; the rules are evaluated on each request.

- Existing carts with a verified association are preserved, including their
  approval state, and work as before for their owner and, under the
  administrator exception, for the company's administrators.
- Existing ambiguous carts (no owner, an employee owner without a company link,
  or a link that differs from the owner's current company) are refused for
  everyone with the 404 above. They are not changed or deleted; pending or
  approved ones stay frozen, and their approvals are neither listed nor
  decidable. There is no recovery tool: the customer starts a new cart. The
  storefront shows "This cart is no longer available" on the cart page and in
  checkout, and drops such a cart from its cookie at the next login; the next
  add to cart creates a new cart.
- The storefront checks that the signed-in customer owns the cookie cart at
  login and before add to cart. A cookie cart the customer can read but does
  not own (an administrator's view of a colleague's cart under admin approval)
  is dropped at login, and add to cart starts a new cart instead of using it.
  Approval pages and the redirect after approving open a colleague's cart
  through the explicit `cartId` query, not through the cookie.
- Existing orders need no migration either.
- Signed-out visitors can no longer create carts; the storefront asks them to
  sign in instead. Deploy the backend and storefront together: the earlier
  storefront creates carts without a token and calls cart transfer at login,
  which the backend now refuses.
- Before the storefront release, import the new UI translation keys in every
  environment, for every locale, through the Admin translation import
  (`POST /admin/ui-translations/:locale/import`), from
  `apps/storefront/messages/*.json`: `Common.errors.signInRequired`,
  `Common.errors.cartUnavailable` and `Cart.unavailableNotice.heading`,
  `.message` and `.exploreProductsLabel`. Without them customers see raw keys.
  `Layout.cartMismatchBanner` is no longer used and can be retired.
- Known limit, unchanged: a bearer token stays valid until it expires (one day
  by default) after logout; logout only removes it from the browser.

After deploy, check in each environment:

1. Signed out, adding a product shows the sign-in prompt and creates no cart.
2. Signed in, a customer can add to cart, submit for approval and check out
   their own cart.
3. An administrator sees the colleague's cart in Approvals, approves it, opens
   and pays it, and lands on the order confirmation; editing that cart is
   refused.
4. A cart ID or order ID opened under another account answers 404 (storefront:
   unavailable notice or not-found page), and the cart and order responses carry
   `Cache-Control: private, no-store`.
5. The new texts appear translated in every locale.

## CMS deployment

Payload packages and the storefront live-preview client are pinned to 3.90.0.
The CMS uses Next.js 16.3.3, which is supported by this Payload release. The
storefront's Next.js version is unchanged. CMS lint now uses ESLint directly
because Next.js 16 removed `next lint`.

1. Back up the CMS database and test the upgrade with a staging copy.
2. Install the committed lockfile: `corepack pnpm install --frozen-lockfile`.
3. With the target CMS configuration, run `corepack pnpm --filter @dtc/cms migrate`
   before routing requests to the upgraded CMS.
4. Deploy the backend, CMS, and storefront together; the signup API and client
   now create the first employee in a single server operation.
5. Smoke-test CMS login, password recovery, existing media, a published page,
   company signup, and the approval/checkout flow.

Migration `20260919_131145_security_upgrade` adds the password-reset request
timestamp, user-session storage, Payload key/value storage, and Azure object keys.
Its SQL was tested on a disposable PostgreSQL database through initial schema,
upgrade, downgrade, and reapplication while preserving an existing user.
Downgrading removes session and new-column data, so retain the backup. Prefer a
forward fix over returning to the vulnerable CMS release.

The dependency audit no longer reports Payload advisories. Other dependency
advisories remain and need separate triage; this is not a clean bill of health
for the full dependency tree.

## Regression coverage

`apps/backend/integration-tests/http/security/security-boundaries.spec.ts` covers
company isolation, first-administrator registration, stale global roles, quote
ownership, approval authority, immutable carts, and Business Central authentication.
`apps/backend/src/utils/__tests__/validate-cart-approvals.unit.spec.ts` covers
missing, rejected, incomplete, and fully approved checkout requests.

NIMBUS-177 adds, in the same security spec: `POST /store/carts` (signed-out
creation refused, company link from the employee record, forged
`metadata.company_id` ignored); the `cart access guard` matrix (every guarded
direct and indirect cart route: signed-out callers answered 401; a colleague,
another company's administrator, a former member, ambiguous carts and an
administrator without an approval, all refused with the missing-cart 404 body
and the no-store header; the owner; an administrator with a pending and with an approved
approval; refusal before the frozen-cart check; and no takeover through
customer transfer); `approval list and decisions` (former-owner and mismatched
carts neither listed nor decidable); and the `order access guard` matrix (order
read and return creation for the owner and for administrators after a real
checkout, refusal for colleagues, other companies, administrators without an
approved approval or after the owner left, no access through the order–company
link, transfer request and cancel returning no order, and account-owned orders
refused). The pure rules are covered by
`apps/backend/src/workflows/cart/__tests__/cart-access.unit.spec.ts`,
`apps/backend/src/workflows/order/__tests__/order-access.unit.spec.ts` and
`order-transfer.unit.spec.ts`; the storefront cart lifecycle by
`apps/storefront/src/__tests__/lib/data/cart.test.ts`, `customer.test.ts` and the
cart and checkout page tests.

Run HTTP tests only against disposable databases. The Medusa test runner creates
and drops its own databases using `DB_HOST`, `DB_PORT`, `DB_USERNAME`, and
`DB_PASSWORD`; do not supply production database credentials.

## Validation results (2026-09-20)

These results cover the local working tree, not a deployed release. The earlier
execution-credit blocker has cleared. Local PostgreSQL and disposable databases
were used for the backend HTTP/module tests and the isolated storefront build.

| Check | Result |
| --- | --- |
| Backend production build | Passed, including admin bundle; 0 lint errors and 11 warnings. |
| Security HTTP regressions | All 22 passed, including cross-company/quote isolation, approval decisions, frozen carts, editable carts, item deletion, and Business Central authentication. |
| Company HTTP tests | All 16 cases verified: 15 passed in the combined run; the remaining nonexistent-company deletion case passed separately after updating its expected status to 404. |
| Company-sync HTTP tests | All 7 passed in the recovered 2026-09-19 final log. |
| Remaining backend HTTP suites | Order API, order creation, order-event chain, and region migration passed (16 tests). Store/admin quote suites failed all 8 cases during cart setup: fixture products are unpublished. |
| Backend unit tests | All 21 source tests passed across 2 suites; compiled `.medusa/server` duplicates were excluded. |
| Backend module tests | 35 passed, 1 failed: Business Central invoice pagination mock expects 10 batches while the service permits 50. |
| CMS production build and lint | Passed during the preceding remediation work; unchanged since those checks. |
| CMS standalone typecheck | Passed on 2026-09-20. |
| CMS migration SQL | Initial schema, upgrade, downgrade, and reapplication passed on a disposable database, preserving a synthetic user. |
| Storefront production build | Passed on 2026-09-20 using a temporary local backend, synthetic region/channel/key, and empty catalog. CMS fetching was disabled for that isolated build. Two existing hook-dependency lint warnings remain. |
| Storefront signup regression | All 5 tests passed during the preceding remediation work. |
| Full storefront unit suite | Previous run: 245 passed, 3 failed; removed-banner expectation and two product-tabs React-version failures. |
| CMS unit suite | Previous run: 19 passed, 1 failed; claims-preview test expects `/us` while configuration returns `/dk`. |
| Standalone backend/storefront typechecks | Failed; details below. |

The company fixture no longer creates an unused cart with invalid product setup
before every company test. Token/header debug logging was removed from that
fixture. The nonexistent-company deletion expectation now reflects authorization
returning 404. Two positive security regression cases additionally prove that
carts with no approval or a rejected approval remain editable and allow item
deletion. No application behavior was changed during this validation follow-up.

Backend standalone TypeScript validation reports 10 diagnostics in existing
order-ingestion/order-API test fixtures and the shared admin test helper (incomplete
company data, untyped container calls, and optional JWT secret). It reports no
errors in the security regression or production source. Storefront validation
reports 10 diagnostics in account fixtures, quote-message Zod resolver types,
nullable profile fields, and timer types. Its existing `ignoreBuildErrors: true`
setting means a successful production build does not establish type safety.

The eight legacy quote HTTP failures happen before their assertions. The shared
product seeder creates draft products and ignores its supplied `data`, so these
results do not validate successful quote creation or admin messaging. Separately,
the default quote field expansion exceeds Medusa's relation-depth limit; the
focused authorization tests use explicit shallow fields to reach the ownership
checks. Both limitations need follow-up. Jest also failed to serialize the legacy
Axios errors into its JSON report because they contain circular request/response
objects; the completed text log provides the six-suite result above.

The production dependency audit from the remediation run reported no Payload
advisories, but still reported 3 critical, 55 high, 52 moderate, and 8 low findings
elsewhere. This is the saved audit result, not a new advisory lookup on 2026-09-20.

### Checks still needed before release

- Resolve the outstanding test/typecheck failures and obtain a green CI run and
  peer review. The repository as a whole is not fully green.
- Exercise a populated catalog and the signup, quote, approval, and checkout flows
  in a browser against staging, including real payment/integration configuration.
  The isolated build is a build check, not an end-to-end commerce test.
- Run the Payload migration through the deployment workflow on a staging copy;
  smoke-test login, password recovery, existing media, and published pages. The SQL
  migration test does not validate the entire Payload runtime upgrade.
- Verify production multi-instance locking/event infrastructure and concurrent
  approval/cart requests; local tests use in-memory locking and a local event bus.
- Apply the documented migration/deployment steps and perform post-deploy smoke
  tests. No live database migration or deployment was performed in this session.

Original findings 7, 8, and 10 remain outside the requested remediation scope;
finding 8 has since been fixed for carts by NIMBUS-177 and stays open for orders
(see the introduction).
