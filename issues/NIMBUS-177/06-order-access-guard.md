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
