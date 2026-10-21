# Branch notes: NIMBUS-177

## 01 Cart access decision
- `apps/backend/src/workflows/cart/utils/cart-access.ts`: `canAccessCart(operation, facts)`, `hasVerifiedCartAssociation({ customer_id, company_id }, ownerCompanyId)`, types `CartOperation`, `CartAccessFacts`, `CartAccessCart`. `ownerCompanyId` is the owner's current `employee.company_id`, `null` when the owner has no employee record. Tasks 06 and 07 reuse `hasVerifiedCartAssociation`; do not re-derive it.
- `workflows/cart/workflows/authorize-cart-access.ts`: `authorizeCartAccessWorkflow`, input `CartAccessInput` (from `steps/validate-cart-access.ts`), result is the resolved cart id. Run as `authorizeCartAccessWorkflow(req.scope).run({ input })`, `result` is the id.
- Every refusal (including both or neither id given, collection with no cart link) throws `MedusaError` NOT_FOUND `Cart not found`; a failed workflow rejects with a serialised object, so the guard should map on `.type`/`.message`, not `instanceof`.
- Cart read fields: `customer_id`, `company.id`, `approvals.type`, `approvals.status`, `customer.employee.company_id`; caller from `customer` entity `employee.company_id`, `employee.is_admin`. These typecheck against the generated types; runtime shape still unverified until task 03's HTTP matrix.
- Collection → cart: `query.graph({ entity: "cart_payment_collection", fields: ["cart_id"], filters: { payment_collection_id } })` (same call as core `compensate-payment-if-needed.js`).
- Running jest/lint here: `pnpm` is not on PATH in this shell; `corepack pnpm --filter @b2b-starter/backend ...` works from Git Bash.
- `pnpm ai:check` fails on `AGENTS.md` size (pre-existing, over 32768 bytes); `--fix` still regenerates the tier0 blocks.

## 02 Trusted cart company link
- `POST /store/carts` now has route-level `authenticate("customer", ["bearer","session"])` (first entry of `storeCartsMiddlewares`, method-scoped exact matcher). Any test or storefront code creating carts must send a customer token.
- `hooks/cart-created.ts` throws `MedusaError` UNAUTHORIZED when the created cart has no `customer_id`, else links the cart to `customer.employee.company_id` (no link for non-employees). `metadata.company_id` is still stored on the cart (order-created reads it) but no longer drives the cart link.
- Store calls without a publishable key answer 400 before any authentication; anonymous-case tests must send `publicHeaders` to reach the 401.
- `createStoreUser({ api, storeHeaders, email })` in `integration-tests/utils/admin.ts` now accepts an email, so specs can create a second customer.
- Security spec `describe('POST /store/carts')` creates its own region; carts are created with `region_id` only (currency comes from the region).
- Running HTTP specs locally: the dev Postgres container has no host port. A disposable `docker run --rm -d --name nimbus177-testdb -p 127.0.0.1:55499:5432 -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=S3cret postgres:17` plus env `DB_HOST=localhost DB_PORT=55499 DB_USERNAME=admin DB_PASSWORD=S3cret`, the TestDK `BUSINESS_CENTRAL_DISCOVERY_URL`, `BUSINESS_CENTRAL_TEST_ENVIRONMENTS=TestDK`, CORS vars, then `TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand --forceExit <spec> -t "<name>"` from `apps/backend` works (about 45 s per run). Stop the container afterwards.
- Query `cart` → `company.id` and `customer` → `employee.company_id` resolve at runtime (verified by the passing HTTP cases).

## 03 Cart route guard
- `apps/backend/src/api/middlewares/ensure-cart-access.ts`: `ensureCartAccess(operation, source = "path")` returns `[authenticate("customer", ["bearer","session"]), guard]`; spread it into a `middlewares` array. `source`: `path` (`req.params.id`), `body` (`req.validatedBody.cart_id`), `query` (`req.filterableFields.cart_id`), `payment_collection` (`req.params.id`). The guard sets `Cache-Control: private, no-store` before the check, so 404s carry it too. Task 06's order variant can follow the same shape.
- Registered in `store/carts/middlewares.ts` (`GUARDED_CART_ROUTES` table, before the `ensureCartEditable` entries), `store/quotes` (POST, after validators), `store/free-shipping` (after validators), and new `store/payment-collections/middlewares.ts` and `store/shipping-options/middlewares.ts` (spread in `store/middlewares.ts`).
- Middleware order (verified in `framework/dist/http/router.js`, `routes-sorter.js`): middlewares and routes are sorted into one tree; entries with the same matcher keep insertion order, core files before project files; methodless entries go to the "global" bucket and register before all method-scoped ones (`app.use`, prefix match). So core validators always run before a project guard on the same matcher.
- A failed workflow in a middleware propagates to Medusa's error handler, which maps `MedusaError` NOT_FOUND to 404 `{ type: "not_found", message: "Cart not found" }`; nothing extra was needed.
- Core's own missing-cart messages differ per route ("Cart id not found: x", "Cart with id 'x' not found"); the guard now answers every guarded route first, so all give the same body.
- Every store cart call in a test now needs a token and an owner with a verified association: an employee's cart must be linked to their company; a non-employee's cart must have no link.
- Security spec helpers in `describe('cart access guard')`: `seedCart(ownerId, companyId | null)` (cart with region, sales channel, one custom line item and a linked payment collection), `cartState`, `expectRefused`, `expectReachesRoute`, and top-level `attachAdminApproval(cartId, status, createdBy)`. Members are added with `POST /store/companies/:id/employees` and log in with `/auth/customer/emailpass`; removal through `DELETE /store/companies/:id/employees/:employeeId` (soft delete) makes the owner "former" for Query.
- Run script used: scratchpad `run-http.sh <spec> [-t name]` with the 02 container settings; the full security spec takes about 75 s.
- `integration-tests/http/quotes` and `http/admin/quotes` fail on baseline before any request (`createAdminUser` with unset `JWT_SECRET`).

## 07 Approval routes association
- `workflows/approval/workflows/list-company-approval-carts.ts`: `listCompanyApprovalCartsWorkflow`, input `{ customer_id, status?, pagination? }` (step file `steps/list-company-approval-carts.ts`), result `{ carts_with_approvals, metadata }`; the route spreads `metadata` (count/skip/take) beside the carts.
- The owner's current company is read with a second `customer` query (`employee.company_id`) for the carts' `customer_id`s, not by adding `carts.customer.*` to the company graph, which would put owner data in the response.
- `validate-company-approval.ts` reads `approval.cart.customer.employee.company_id` (depth 4 from `approval`); resolves at runtime (verified by the passing HTTP cases).
- The Approval service type has no `listApprovalStatuses`; read `approval_status` through Query in tests.
- `AuthenticatedMedusaRequest<unknown, Q>` types `req.validatedQuery` (second generic); the first is the body.
- Query filters on an enum column (`approval_status.status`) reject a plain `string`; the step narrows once in `approvalStatusFilter`.
- Security spec `describe('approval list and decisions')` (inside `cart access guard`) seeds a verified, a former-owner and a mismatched cart; `seedCart` takes an optional email. Full security spec: 66 tests, about 75 s.

## 06 Order access guard
- `workflows/order/utils/order-access.ts`: `canAccessOrder(facts)`, types `OrderOperation`, `OrderAccessFacts`; `utils/order-transfer.ts`: `canRequestOrderTransfer(owner | null)`. Both have registry rows.
- `workflows/order/workflows/authorize-order-access.ts`: `authorizeOrderAccessWorkflow`, input `OrderAccessInput` (`steps/validate-order-access.ts`); refusal and absence throw NOT_FOUND `Order not found`. `api/middlewares/ensure-order-access.ts`: `ensureOrderAccess(operation, "path" | "body")`, same shape as the cart guard.
- Registered in new `api/store/orders/middlewares.ts` (GET `/store/orders/:id`) and `api/store/returns/middlewares.ts` (POST `/store/returns`), spread in `store/middlewares.ts`. Project route files `api/store/orders/[id]/transfer/{request,cancel}/route.ts` replace core's handlers and answer `{ success: true }`; core's authentication and validators still run (verified by the 401 and 200 cases).
- Query paths verified at runtime: `order_cart` by `order_id` → `cart_id`; `customer.has_account`; `return` by `order_id` (the order module's `listReturns` filter type has no `order_id`, use Query).
- Core's store order read does not return `customer_id` by default; request `?fields=+customer_id` to assert it.
- Real checkout fixture (`seedCheckout` in `describe('order access guard')`): region ↔ `pp_system_default` link, stock location in the guard channel with `manual_manual` and a fulfillment set (service zone DK), default shipping profile, flat shipping option (dkk), published product via `createProductsWorkflow` in the channel; carts created with `region_id` and `sales_channel_id` (no publishable-key channel link needed). Returns need fulfilled items: `createOrderFulfillmentWorkflow` first, then `return_shipping.option_id` = the shipping option.
- Storefront `lib/data/orders.ts` reads `/store/orders/:id`; it now needs the caller's token (401 signed out, 404 for others), for task 04.
- Full security spec: 81 tests, about 90 s.

## 04 Storefront cart lifecycle
- `apps/storefront/src/lib/data/cart.ts`: `lookupCart(id?)` returns `CartLookup` (`none | unavailable | error | found`; 404 → unavailable, 401 or no token → none, other → error). `retrieveCart` wraps it (cart or null). Use `lookupCart` wherever "refused" must look different from "no cart".
- `lib/util/customer-error.ts`: new codes `SIGN_IN_REQUIRED_ERROR`, `CART_UNAVAILABLE_ERROR` → `Common.errors.signInRequired` / `cartUnavailable`. `addToCart(Bulk)` return `{ error: SIGN_IN_REQUIRED }` (never thrown: Next strips thrown server-action messages in production).
- `modules/cart/components/cart-unavailable-notice` (keys `Cart.unavailableNotice.*`) renders on the cart page and in checkout for `unavailable`.
- Login drops the cart cookie only on `unavailable`; transfer and the login metadata update are gone (`transferCart` deleted), and the mismatch banner is removed. Cart creation still sends `metadata.company_id` (order-created reads it).
- Cart, approval-list, shipping-option, free-shipping and order fetches use `cache: "no-store"` (no `next` tags).
- New translation keys must be imported in every environment before release (for 05's rollout note).
- Running storefront jest needs `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` set (any value) in the env, else the required-env check aborts the run before any test.
- Fix 04 (not-owned cookie cart): `lib/util/active-cart.ts` `activeCartLookup(lookup, customerId)` is the one place that decides whether a found cookie cart is the customer's (`cart.customer_id === customer.id`; not owned → `unavailable`, no customer → `error`). Login and `getOrSetCart` use it; `lookupCart` stays ownership-blind so explicit-id reads (approval card, checkout `?cart_id`) still work.
- `cart.test.ts` resets `sdk.client.fetch`, `cart.create` and `createLineItem` in `beforeEach`: `jest.clearAllMocks` keeps queued `mock*Once` values, which leaked between tests.
- Storefront full suite on this branch: 3 failing suites, all on baseline: `app/main-layout.test.tsx` (asserts a promo banner the layout never renders), `lib/util/money.test.ts`, `modules/products/components/product-tabs/index.test.tsx`.

## 05 Documentation
- `docs/security-remediation.md` now has "Cart access (NIMBUS-177)" and "Order access (NIMBUS-177)" under "API behavior", a "Cart and order access rollout (NIMBUS-177)" section (before "CMS deployment") with an after-deploy check list, and a NIMBUS-177 paragraph in "Regression coverage"; the intro and closing line mark finding 8 fixed for carts, open for orders.
- Storefront orders get the client company only in order metadata (core `completeCartWorkflow` copies cart metadata and never runs `createOrderWorkflow`, so `hooks/order-created.ts` writes no order–company link for them; plan section 5 is wrong there). Business Central submission reads metadata `company_id` only after finding `canonical_order` (ingestion-only); the doc states this.
- No test counts were written into the doc's "Validation results" table: that table is dated 2026-09-20 and no NIMBUS-177 finalization run exists yet.
