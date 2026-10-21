# 05: Document cart access rules and rollout
**App:** docs · **Layer:** none (documentation) · **Depends on:** 02, 03, 04, 06, 07

**Goal:** Current security documentation states who may read, change and pay a cart, how existing
carts are treated at rollout, and what to check after deploy.
**Files / areas:** `docs/security-remediation.md`
**Seam contracts:** none
**Test intent:** documentation only; no tests. The reviewer checks each statement against plan
sections 6 and 7 and the merged code.
**Done when:** the API behaviour section lists the cart rules (sign-in, owner, admin exception, 404
on refusal, transfer owner-only, indirect routes) and the order rules (owner, approving
administrator for both reading and creating returns, transfer request and cancel open to signed-in customers with no
order in the response, account-owned orders not transferable, and the residual transfer exposure
from plan section 10; returns carry no record of which administrator created them), the approvals list and decisions limited to
carts with a verified association; a rollout subsection covers no migration,
preserved verified carts, refused ambiguous carts with "start a new cart", the translation import
before storefront release, and the stated token-expiry limit; finding 8 reads fixed for carts, not
used by store order access, and still open for the order–company link that Business Central order
sync reads; regression coverage names the new cart and order matrices.
**Also update:** none found beyond this file (the `documentation-writer` updates
`docs/architecture/` after ship).

## Deviations

- Plan correction (finding 8 for orders): plan.md section 5 (order–company link row, "written from
  metadata for storefront orders") and the task's "order–company link that Business Central order
  sync reads" are wrong. Storefront checkout runs core `completeCartWorkflow`, which creates the order
  with `createOrdersStep` and copies `metadata: cart.metadata` (core-flows
  `dist/cart/workflows/complete-cart.js` lines 454, 459) and never runs `createOrderWorkflow`; only
  `hooks/order-created.ts` (a `createOrderWorkflow` hook, reached here from Admin draft orders,
  `medusa/dist/api/admin/draft-orders/route.js:81`) writes the link, and order ingestion avoids that
  workflow (`create-order-from-canonical-payload.ts:42`). Business Central submission reads the company
  from order metadata (`prepare-bc-order.ts`, `readCompanyIdFromMetadata`) only after
  `parseBcOrderPayload` finds `canonical_order`, written only by order ingestion
  (`create-ingested-order.ts`), and automatic submission starts only from the ingestion event
  (`enrich-order.ts` `READY_FOR_BUSINESS_CENTRAL_EVENT`). The doc states the storefront risk as an Admin
  submission request on an order whose cart metadata a client filled with `canonical_order` and
  `company_id`. Branch note 04's "order-created reads it" has the same error (left as written).
- Added to the rollout subsection: deploy backend and storefront together (the earlier storefront
  creates carts without a token and calls cart transfer at login), the per-locale Admin import route,
  the retired `Layout.cartMismatchBanner` key, and a five-step after-deploy check list (the goal names
  after-deploy checks; the done-when list does not).
- Stale reference updated: the closing line of "Checks still needed before release" said finding 8
  remains outside scope; it now says fixed for carts, open for orders.
- The approval bullet task 07 added is left as written; the cart section does not repeat it.
- Cart regression description follows the spec as merged: the cart matrix has no rejected-approval or
  separate replayed-ID case (refused strangers cover replay), so neither is claimed.

## Done-when evidence

- API behaviour lists the cart rules (sign-in, owner, admin exception, 404 on refusal, transfer
  owner-only, indirect routes): `docs/security-remediation.md` "Cart access (NIMBUS-177)", checked
  against `api/store/carts/middlewares.ts`, `api/middlewares/ensure-cart-access.ts`,
  `workflows/cart/utils/cart-access.ts`, `hooks/cart-created.ts` and the quotes, free-shipping,
  payment-collections and shipping-options middlewares.
- Order rules (owner; approving administrator for read and returns; transfer request and cancel open
  with no order in the response; account-owned orders not transferable; residual transfer exposure;
  returns record no administrator): "Order access (NIMBUS-177)", checked against
  `workflows/order/utils/order-access.ts`, `order-transfer.ts`, `steps/validate-order-transferable.ts`,
  `api/store/orders/middlewares.ts`, `api/store/returns/middlewares.ts` and both transfer route files.
- Approvals list and decisions limited to verified carts: approval bullet in "API behavior" (task 07).
- Rollout (no migration, preserved verified carts, refused ambiguous carts with "start a new cart",
  translation import before storefront release, token-expiry limit): "Cart and order access rollout
  (NIMBUS-177)", checked against `apps/storefront/src/lib/data/cart.ts` (`getOrSetCart` replaces a
  refused cookie cart) and `messages/en.json`.
- Finding 8 fixed for carts, not used by store order access, open for orders (metadata only for
  storefront orders; Business Central submission conditions stated): introduction and closing line of
  "Checks still needed before release", checked against `complete-cart.js`, `hooks/order-created.ts`,
  `prepare-bc-order.ts` and `subscribers/business-central-order-ready.ts`.
- Rework (review): order with no customer now reads "everyone" (`canAccessOrder` returns false when
  `order.customer_id` is null); cart regression text separates signed-out 401 from the 404 group
  (spec "answers an anonymous caller with 401 on every guarded route").
- Regression coverage names the new matrices: "Regression coverage" paragraph naming the
  `POST /store/carts`, `cart access guard`, `approval list and decisions` and `order access guard`
  describe blocks and the unit and storefront specs (names checked in the files).
- Also update: none needed beyond `docs/security-remediation.md`.
