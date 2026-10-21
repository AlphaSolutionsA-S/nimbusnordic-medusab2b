# 06: Order access decision and guard
**App:** backend · **Layer:** L5 decision fn, L3 step, L4 workflow, L6 middleware and routes · **Depends on:** 01, 03

**Goal:** Reading an order by ID and creating a return answer only the order's owner or an
administrator of the source cart's company while the owner is still a member and the cart's admin
approval is approved; order transfer request and cancel stay open as in core but never return the
order.
**Files / areas:** `apps/backend/src/workflows/cart/` (or a sibling `order` domain folder for the
order decision, step and workflow), `api/middlewares/` (order variant of the 03 guard), a store
middleware entry for core `orders/:id` and `returns`, new route files
`api/store/orders/[id]/transfer/request/route.ts` and `api/store/orders/[id]/transfer/cancel/route.ts`
**Seam contracts:**
- Workflow `authorizeOrderAccessWorkflow`, input `{ customer_id: string; operation: "read" | "return"; order_id: string }` (both classes follow the same rule, decision 7);
  refusal and absence fail with `MedusaError` NOT_FOUND `Order not found`.
- Guarded: `GET /store/orders/:id` read; `POST /store/returns` return with body `order_id`; both set
  `Cache-Control: private, no-store`. The order–company link is never an input.
- Transfer request: a new workflow runs a check step (reads `order.customer_id` and that customer's
  `has_account`; unknown order 404) that refuses account-owned orders with `MedusaError`
  INVALID_DATA `Order cannot be transferred` (400, no IDs in the message), then core's
  `requestOrderTransferWorkflow` via `runAsStep` with the inputs core's handler passes.
- Transfer cancel: core's `cancelOrderTransferRequestWorkflow` with core's inputs.
- Both respond `200 { "success": true }` and nothing else; other core errors pass through.
- Rule: plan section 6 order and transfer tables; owner path has no membership check (decision 4).
**Test intent:**
- Unit (decision fn), for both `read` and `return`: owner allowed; admin allowed only with source
  cart linked to the admin's company, owner still a member and admin approval approved (pending,
  rejected, none refused); admin of another company, colleague and foreign customer refused; order
  without customer refused.
- HTTP matrix in `security-boundaries.spec.ts`: signed-out 401 on order read, returns, transfer
  request and cancel; colleague, foreign-company customer, non-admin, admin without approved
  approval and admin after the owner left get 404 on read and returns with a body equal to a
  nonexistent order's; owner 200 on read; refused return creates no return row.
- Unit (transfer decision): account-owned order refused; order with no customer or a guest
  customer allowed.
- Transfer request on another account's order and on the caller's own order: both 400 with the
  same body, and no order change row created.
- Transfer request on an order with no customer (or a guest customer) by a signed-in customer:
  200 with body exactly `{ success: true }` (no order, email, address or item fields); cancel of
  that request by the same caller: same body.
- Forged order–company link (order linked to the caller's company, owner elsewhere) grants nothing.
- Positive administrator path through a real cart completion (region, sales channel, priced
  published variant, shipping option, system payment provider; the shared product seeder creates
  draft products, so build the fixture accordingly): the colleague requests approval, administrator
  A approves, pays and completes; A and a second administrator B of the same company each read the
  order (200, assert `id`, `customer_id`, `items` types); a non-admin colleague gets 404.
- Returns (decision 7): in the end-to-end test administrator A creates a return for the order
  (200, return row exists for that order); the owner's return also succeeds. Refused with 404 and no
  return row: administrator with no approval, with a pending or rejected approval, after the owner
  left the company, administrator of another company, non-admin colleague.
**Done when:** unit and HTTP tests pass; lint and typecheck at or below baseline.
**Verify after deploy:** `GET /store/orders/<controlled order>` as owner (200), signed out (401) and
as a foreign customer (404); approving admin reaches the confirmation page after paying a colleague's
approved cart; transfer request response body for a test order is `{ "success": true }`.
**Also update:** `ai/architecture/decisions.md` (order access row; order transfer row); `docs/security-remediation.md`
(task 05); none found among existing tests (no storefront caller of the transfer routes).

## Deviations
- `canAccessOrder(facts)` takes no operation: `read` and `return` share one rule, so the verdict
  cannot differ; `authorizeOrderAccessWorkflow` still takes `operation` as the seam states.
- The administrator path also requires the source cart's `customer_id` to equal the order's owner
  (always true for a completed cart), and "owner still a member" is judged on the order owner's
  current employee company through `hasVerifiedCartAssociation`; a mismatched source cart grants
  nothing.
- The guard reads the order with `is_draft_order: false`, like core's read, so a draft order gets
  the guard's 404.
- Transfer request on an unknown order answers 404 `Order not found` from the new check step
  (core's own message named the ID); a test for it was added (it also passes on core).
- The cancel route passes `actor_type: "customer"` instead of `req.auth_context.actor_type`: the
  field is typed `string` but the workflow takes `"customer" | "user"`, and core's customer-only
  authentication on that route makes the value always `"customer"`.
- The new transfer workflow is `requestTransferableOrderTransferWorkflow`
  (`workflows/order/workflows/request-order-transfer.ts`, step `validate-order-transferable`); the
  seam named no workflow.
- HTTP matrix orders are seeded through the order module with a core `order_cart` link to a seeded
  cart; only the end-to-end test completes a real cart. Order reads that assert `customer_id` request
  `?fields=+customer_id`, which is not among core's default store order fields.
- Security spec helper `addColleague` gained an `isAdmin` argument (second administrator B).
- `docs/security-remediation.md` not changed: the "Also update" line assigns it to task 05.
- `pnpm ai:check --fix` regenerated the tier0 blocks in `AGENTS.md` and
  `.github/copilot-instructions.md` after the registry edit (it still fails on the pre-existing
  `AGENTS.md` size).

## Done-when evidence
- Unit tests (order decision, read and return): `src/workflows/order/__tests__/order-access.unit.spec.ts`
  (owner, owner after leaving, admin approved, pending/rejected/none refused, sales-manager approval,
  owner left or moved, no source cart, unlinked cart, cart of another owner, admin of another
  company, colleague, foreign customer, order without customer); 18 tests pass.
- Unit tests (transfer decision): `src/workflows/order/__tests__/order-transfer.unit.spec.ts`
  (account-owned refused, guest and no customer allowed); 3 tests pass.
- HTTP matrix: `security-boundaries.spec.ts` › `cart access guard` › `order access guard`:
  "answers a signed-out caller with 401 on order read, returns and transfer routes"; "refuses %s on
  order read and returns like a missing order" (colleague, admin of another company, customer of no
  company, admin with no / pending / rejected approval, admin after the owner left; body equal to a
  missing order's, `Cache-Control: private, no-store`, no return row); "lets the owner read the
  order, privately".
- Transfer: "refuses a transfer of another account's order and of the caller's own with one body"
  (400, no order change); "lets a signed-in customer request and cancel a transfer of an order with
  %s, returning no order" (no customer, guest; body exactly `{ success: true }`); "answers a transfer
  request for an unknown order with 404".
- Forged link: "grants nothing through an order–company link to the caller's company".
- End-to-end administrator path and returns: "lets the company's administrators read, and return, a
  colleague's order one of them paid" (real completion, admins A and B read with `id`, `customer_id`,
  `items` types; non-admin 404; admin A's and the owner's returns succeed; non-admin return 404 with
  no new return row). Pending, rejected, no-approval, owner-left, other-company and colleague return
  refusals are in the matrix above.
- Red run: with the guard and route files removed 14 of the 15 new HTTP tests fail (the unknown-order
  404 passes on core). Full security spec with the change: 81 passed.
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, no warnings in the new files.
- Typecheck: 22 errors, baseline 22 (same files).
- Also update `ai/architecture/decisions.md`: order access row and order transfer row added after
  the cart access row.
- Also update `docs/security-remediation.md`: left to task 05, as the line says.
- Also update existing tests: none found (no test or storefront caller of the transfer routes or
  `/store/returns`; `S/lib/data/orders.ts` reads `/store/orders/:id` with the caller's token, task 04).
