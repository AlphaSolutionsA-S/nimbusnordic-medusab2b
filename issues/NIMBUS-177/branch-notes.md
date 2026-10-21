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
