# NIMBUS-138 Progress

## 2026-08-17 - Scoping complete

**Outcome:** Created the technical scope for `NIMBUS-138` (`Create BC connection for
return`). The scope establishes that the public Business Central v2.0 API documents
writable sales orders/lines and credit memos, but does not document the requested
sales-return-order resources. The story is therefore gated on a target-tenant BC custom
API/action that creates return orders from a verified source order within BC. The scope
defines company-scoped authorization, strict payload ownership, idempotency, sandbox
contract testing, non-goals, acceptance criteria, dependencies, and required BC decisions.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-138` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-138\SCOPE.md` before
planning. Do not write portal return code until the target BC sandbox metadata/operations
have verified the return-document contract. Treat a tenant BC custom API/action that
creates the return order from a verified source sales order as a hard prerequisite; do not
assume a public `salesReturnOrders` endpoint or substitute a sales order/credit memo.
Reuse the authenticated customer-to-company resolution from
`apps\backend\src\api\store\bc-orders\route.ts`, keep all mutations in a Medusa
workflow, and plan persistent idempotency/reconciliation for ambiguous BC write outcomes.
Plan source-order ownership checks, strict line/quantity validation, mocked BC-boundary
tests, and the storefront entry flow that depends on NIMBUS-137 order detail. Keep Jira
business-facing and technical plans only under `issues\NIMBUS-138\`.

## 2026-08-17 - Implementation plan ready

- **Date:** 2026-08-17
- **Updated by:** implementation-planner agent
- **Outcome:** Wrote `PLAN.md`, `manifest.md`, and eight task files (`01`–`08`) under
  `issues\NIMBUS-138\`. Confirmed NIMBUS-137 is implemented in the working tree and is
  reused: `bcService.getOrder(...)` for source-order/line verification, the company-scoped
  `GET /store/bc-orders/[id]` 404 pattern, `bc-order-detail-template.tsx`/`retrieveBCOrder`
  for the return UI, and the mocked-`fetch` module test pattern. Branch `feature/NIMBUS-138`
  from `develop`. The plan keeps all BC mutations in an idempotent Medusa workflow with a
  server-generated deterministic idempotency key, a `businessCentralReturn` persistence
  module, ambiguous-vs-definitive BC error classification for reconciliation, strict
  server-derived authorization, and customer-safe error mapping. **Tasks 02–08 are
  dispatch-gated on task 01** (BC return-contract sandbox verification → `CONTRACT.md`);
  the public v2.0 API has no return-order writer.
- **Handover to:** implementor agent (after task 01 sign-off)
- **Handover prompt:**

  You are the implementor for `NIMBUS-138` in `D:\projects\Nimbus\nimbusnordic-medusab2b`.
  Read `issues\NIMBUS-138\PLAN.md` and `manifest.md` first. **Do not start tasks 02–08
  until task 01 (`01-bc-return-contract-verification.md`) is signed off and
  `issues\NIMBUS-138\CONTRACT.md` exists** — the BC return endpoint, request/response
  schema, idempotency lookup, and error catalogue in the task skeletons are placeholders
  that must be bound from `CONTRACT.md`. Branch `feature/NIMBUS-138` from `develop`.
  Implement the tasks in dependency order (02 → 03 → 04 → 05 → 06 → 07 → 08). Keep all BC
  mutations inside `createBcReturnWorkflow`; never call the BC service directly from the
  route. Reuse NIMBUS-137's `bcService.getOrder(...)` for source-order/line/quantity
  verification and the `GET /store/bc-orders/[id]` company-scoping/404 pattern. Preserve
  the server-generated deterministic idempotency key and the ambiguous-vs-definitive error
  handling exactly as specified. Run `pnpm test:integration:modules`,
  `pnpm test:integration:http`, and `pnpm build` (backend + storefront) before marking
  tasks done, and complete the task 08 checklist. Keep Jira business-facing; keep technical
  detail under `issues\NIMBUS-138\`.

## 2026-08-17 - Re-plan: stub-first, real BC last (dispatch gate removed)

- **Date:** 2026-08-17
- **Updated by:** implementation-planner agent
- **Outcome:** Re-sequenced NIMBUS-138 from a hard-gated plan into a **stub-first vertical
  slice**. Rewrote `PLAN.md` and `manifest.md` and replaced the eight task files with a new
  nine-task set. The whole flow (service seam → persistence → workflow → routes → storefront
  data layer → return-entry UI) is now built against **stubs** (tasks 01–06), reaches a
  **demoable milestone** (task 07), and only then verifies the real BC contract (task 08) and
  swaps in the real BC HTTP call (task 09). **The previous dispatch gate on task 01 is
  removed** — no portal code waits on sandbox contract verification.
  - Proceeds on an **assumed BC contract** (body: `{ requestId, sourceOrderNo, lines:[{ sourceLineNo,
    quantityToReturn, returnReasonCode }] }`). `requestId` is the server-generated deterministic
    idempotency key (one field, doubling as BC's identifier); `sourceOrderNo` = `BCOrderDetail.number`;
    `sourceLineNo` = `BCOrderLine.sequence` (task 08 confirms `sequence === "Line No."`);
    `returnReasonCode` = an `id` from the dummy `listReturnReasons()` provider.
  - Task 01 ships an **offline** stub `createReturnFromSalesOrder` (deterministic fake, no
    network I/O) + a dummy `listReturnReasons()` `{ id, description }[]`, plus the seam types
    and the `BusinessCentralAmbiguousOutcomeError` sentinel (unused by the stub, referenced by
    the workflow) — so task 09 is a pure `service.ts` swap. Every stub carries a
    `// STUB (NIMBUS-138 task 09):` comment.
  - The return flow is driven from the **order-detail page**: select lines, quantity, and a
    **per-line** return reason.
  - Retained standing constraints: all BC mutations inside `createBcReturnWorkflow` (never call
    the service from the route); server-derived authority (`req.auth_context` + employee-company
    link; body never influences authority); source-order ownership → 404 on cross-company;
    strict Zod body with unknown-field rejection + duplicate-line rejection; persistent
    idempotency + ambiguous-vs-definitive classification; no credit memo/receipt/refund; no BC
    internals in responses/logs.
- **New task set:** `01-backend-bc-return-service-stub`, `02-backend-return-persistence-module`,
  `03-backend-create-return-workflow`, `04-backend-store-return-routes`,
  `05-storefront-return-data-layer`, `06-storefront-return-ui`, `07-verification-stubbed-flow`,
  `08-bc-return-contract-verification`, `09-backend-bc-real-implementation`. (The old
  contract-verification-first files were replaced.)
- **Handover to:** implementor agent
- **Handover prompt:**

  You are the implementor for `NIMBUS-138` in `D:\projects\Nimbus\nimbusnordic-medusab2b`.
  Read `issues\NIMBUS-138\PLAN.md` and `manifest.md` first. Branch `feature/NIMBUS-138` from
  `develop`. **Implement tasks 01 → 09 in dependency order** (01 and 02 are independent; the
  task-08 contract spike may run in parallel but blocks only task 09). Build the whole slice
  against the **stubs** from task 01 and confirm the demoable milestone at task 07 before
  touching real BC. The seam types `BCCreateReturnParams` / `BCReturnOrder` / `BCReturnReason`
  insulate tasks 02–06 from the real contract — **do not** call the BC service directly from a
  route; keep every BC mutation inside `createBcReturnWorkflow`. Reuse NIMBUS-137's
  `bcService.getOrder(...)` for source-order/line/quantity verification and the
  `GET /store/bc-orders/[id]` company-scoping/404 + `query.graph` company-resolution pattern.
  Preserve the server-generated deterministic idempotency key (which doubles as `requestId`)
  and the ambiguous-vs-definitive error handling exactly as specified. Confirm the
  static-vs-dynamic route-collision note in task 04 during implementation. Do **not** enable the
  feature for customers until task 09 completes: task 08 produces `CONTRACT.md`, and task 09
  swaps the stub for the real BC HTTP call (only `service.ts` changes) and re-verifies against
  sandbox BC (exactly one return on ambiguous-then-retry; no credit memo/receipt/refund; no BC
  internals leaked). Run `pnpm test:integration:modules`, `pnpm test:integration:http`, and
  `pnpm build` (backend + storefront) before marking tasks done. Keep Jira business-facing; keep
  technical detail under `issues\NIMBUS-138\`.

## 2026-08-17 - Direct synchronous BC flow selected

- **Outcome:** The customer confirmed that the storefront should receive the backend's BC result
  directly. The local `businessCentralReturn` persistence module, generated migration, and test
  were removed; its one applied local migration was rolled back. The deterministic server-generated
  `requestId` remains and is sent to BC as the idempotency key. A BC timeout or ambiguous outcome
  must be returned immediately to the storefront as a customer-safe error, without local
  reconciliation state or disclosure of BC internals.
- **Next owner:** implementor
- **Handover prompt:** Implement task 03 as a direct synchronous workflow. Validate the authenticated
  company-owned source order and line selections server-side, derive the deterministic `requestId`,
  and call the BC service once. Do not create a return-request module, migration, or database record.
  Task 04 must map BC timeout/ambiguous errors to a customer-safe error the storefront displays
  immediately. Task 08 must verify that the target BC action treats `requestId` as its idempotency
  key before the real service is enabled.

## 2026-08-17 - Stubbed direct-flow implementation

- **Outcome:** Implemented the direct synchronous stubbed flow: typed BC return/reason service
  seams; authenticated return-reasons and create-return store routes; strict return-line validation;
  server-side company/order/line/reason validation in `createBcReturnWorkflow`; deterministic
  `requestId`; and the storefront return-entry UI. The route returns BC ambiguous outcomes as an
  immediate customer-safe `503` response. No return persistence module, migration, or database table
  remains.
- **Validation:** Backend build passed. Focused BC stub tests passed (3 tests). Storefront compiled
  and linted successfully, then production page-data collection failed because the local backend was
  unavailable (`ECONNREFUSED`). Storefront `tsc --noEmit` is blocked by pre-existing errors in
  account-navigation tests, profile-card nullability, and cart-drawer timer typings. Backend
  persistence/HTTP integration tests remain blocked by the local test PostgreSQL configuration
  (`SASL: client password must be a string`).
- **Next owner:** implementor
- **Handover prompt:** Restore a valid test PostgreSQL configuration, add and run direct-workflow
  and HTTP route integration coverage, then perform the storefront walkthrough with the backend
  running. Before enabling real BC writes, task 08 must verify the custom BC action, including that
  it deduplicates the deterministic `requestId`; task 09 must replace the offline stub.

## 2026-09-28 - Task 07 stubbed end-to-end verification complete

- **Outcome:** The user confirmed task 07 (stubbed end-to-end verification) is done. The demoable
  stubbed milestone is reached. Tasks 03–06 stay `DONE (stub)` until task 09. The implementation is
  committed on `develop` (`d508e67`), not on a `feature/NIMBUS-138` branch.
- **Next owner:** implementor (task 08 contract spike)
- **Handover prompt:** Run task 08 (`08-bc-return-contract-verification.md`) against the target BC
  sandbox: confirm the custom return-order API/action, its request/response schema, that
  `sequence === "Line No."`, the error catalogue, and that BC deduplicates the deterministic
  `requestId`. Record the result in `issues\NIMBUS-138\CONTRACT.md`. Only then start task 09, which
  replaces the offline stub in `service.ts` with the real BC call. Keep the feature disabled for
  customers until task 09 is verified against sandbox BC.

## 2026-09-28 - Task 08 contract partially verified

- **Outcome:** Created `CONTRACT.md` from the tenant OData metadata (`orderreturncreate metadata.xml`)
  and the customer's description. Confirmed: the unbound custom action
  `CustomerPortalReturns_CreateReturnOrder`, called as a `POST` to
  `.../v2.0/{TenantId}/{Environment}/ODataV4/CustomerPortalReturns_CreateReturnOrder?company='{companyName}'`,
  with the `Edm.String` parameters `requestId`, `sourceOrderNo`, and `lines`. **`lines` is a
  JSON-encoded string**, not an array. The return type is `Edm.String`. The metadata exposes
  `CS_EnabledReasonCodes` as a candidate return-reason source.
- **Still open:** Response string format, error catalogue, `requestId` deduplication, whether
  `sequence` equals "Line No.", reason-code filter, non-goals, permissions, and sandbox test data.
  All of these need a sandbox call.
- **Next owner:** implementor (finish task 08 in the sandbox, then task 09)
- **Handover prompt:** Close the OPEN items in `issues\NIMBUS-138\CONTRACT.md` with a real sandbox
  call. Then implement task 09 from the change list in CONTRACT.md: build the ODataV4 URL with the
  company name, send `lines` as `JSON.stringify(params.lines)`, parse the `{ value: string }`
  response into `BCReturnOrder`, and replace the dummy reason provider (the customer uses codes
  such as `NORMAL`).

## 2026-09-28 - Contract items confirmed by customer

- **Outcome:** The customer confirmed three contract items: order line numbers are the v2.0
  `sequence` (the current mapping stands); the action does not post a credit memo, receipt,
  payment, or refund; and the existing app registration has the required permissions.
  `CONTRACT.md` is updated.
- **Still open:** Response string format, error catalogue, `requestId` deduplication, the
  return-reason filter on `CS_EnabledReasonCodes`, and sandbox test data.
- **Next owner:** implementor (task 08 remainder, then task 09)

## 2026-09-28 - Task 09 real BC implementation

- **Outcome:** Replaced both stubs in `apps/backend/src/modules/business-central/service.ts`.
  `createReturnFromSalesOrder` now POSTs to `ODataV4/CustomerPortalReturns_CreateReturnOrder`,
  with `lines` sent as a JSON string and a 30 s timeout. `listReturnReasons` reads
  `ODataV4/CS_EnabledReasonCodes`. The company is scoped by the new
  `BUSINESS_CENTRAL_COMPANY_ID` config (GUID); its name is read from
  `/companies(id)`. The helper is reusable for later calls, as the customer requested. Error
  classification is documented in `CONTRACT.md`. The seam types, workflow, routes, and
  storefront are unchanged. `return-stub.spec.ts` is replaced by `return.spec.ts` (fetch-mocked).
- **Validation:** `return.spec.ts` passes, and the backend `pnpm build` passes. `service.spec.ts`
  has one failing test that was already failing (`listOrders › stops filling from salesInvoices
  after the round-trip guardrail…`); neither `listOrders` nor that test was changed.
- **Still open:** Set `BUSINESS_CENTRAL_COMPANY_ID` in `.env` and in Cloud environments. Run a
  sandbox return to confirm the response `value` format, BC error bodies, `requestId`
  deduplication, and whether `CS_EnabledReasonCodes` needs a `DocType`/`Type` filter.
- **Next owner:** implementor / customer (sandbox verification)

## 2026-09-28 - TEMP: return reason fixed to NORMAL

- **Outcome:** BC reason codes cannot be fetched yet, so reason selection is temporarily bypassed,
  at the customer's request. Every change is marked `TEMP (NIMBUS-138)`:
  - Storefront `bc-order-return/index.tsx`: the reason select is disabled, and every line sends
    `return_reason_code: "NORMAL"`.
  - Storefront `bc-order-detail-template.tsx`: `listBCReturnReasons()` is no longer called; an empty
    list is passed instead.
  - Backend `prepare-bc-return.ts`: `listReturnReasons()` is no longer called, and only `NORMAL` is
    accepted.
- **Next owner:** implementor. Revert all `TEMP (NIMBUS-138)` markers once `CS_EnabledReasonCodes`
  (and any needed filter) is verified against BC.

## 2026-09-29 - Returns resolve the source order by number (invoiced orders)

- **Outcome:** Returns failed with a 500 because invoiced orders have no BC sales order, and the
  order page hands the invoice id to the return flow; the salesOrders-only id lookup found nothing.
  The customer decided: `sourceOrderNo` is always the **sales order no.**, `sourceLineNo` is the
  line's own sequence (the **invoice line sequence** for invoiced lines), and both open and
  invoiced lines are returnable. The return flow now posts to
  `/store/bc-orders/{orderNumber}/returns` and the workflow uses the merged `getOrder` lookup
  (open order lines and invoice lines). The now-unused `getOrderBySalesOrderId` and
  `BCGetOrderBySalesOrderIdParams` are removed. Temporary debug logging (marked `TEMP (NIMBUS-138)`)
  now covers the BC request URL/body, the BC response, and unexpected route errors.
- **Known risk:** In partially invoiced orders, and in orders with several invoices, the same
  sequence number can appear on more than one line. The storefront draft is keyed by sequence, and
  BC receives only `sourceLineNo`, so those rows cannot be told apart.
- **Next owner:** implementor / customer (sandbox run with an invoiced order)

## 2026-09-29 - Shipped-only returns and order-line reservations

- **Outcome:** Two changes.
  - **Shipped-only returns:** Unshipped goods can no longer be returned. `BCOrderLine` now carries
    `shippedQuantity` and `returnableQuantity`.
    - Order lines: returnable = `shippedQuantity − invoicedQuantity`.
    - Invoice lines: returnable = the full invoiced `quantity`.
    - The return workflow caps each `sourceLineNo` at the sum of its lines' returnable quantity.
    - The return form shows a status column, caps each quantity input, and disables unshipped
      lines. The trigger is hidden when nothing is returnable.
  - **Order-line reservations:** The order detail page shows a per-line status with reservations.
    - Source: `GET /api/abakion/customerPortal/v2.0/companies({BUSINESS_CENTRAL_COMPANY_ID})/salesOrderReservationEntries?$filter=documentNumber eq '…'`
      (metadata: `abakion api metadata.xml`), fetched in parallel with the order.
    - Only `reservationStatus = Reservation` entries are used, matched to lines by
      `lineNumber = sequence`, with `|quantityBase|` as the quantity.
    - The page shows "shipped · reserved · awaiting", and a `<details>` row lists quantity, source,
      location, expected receipt, shipment date, and freight.
    - A failed reservation fetch is logged and does not block the order.
  - **Translations:** Added `Account.bcOrderLineFulfillment` for all 8 locales.
- **Validation:** The backend build passes. The BC module tests pass (3 new `getOrder` tests),
  apart from the pre-existing `listOrders` guardrail failure. The storefront return form and
  order-detail template tests pass (6/6, including 3 new). Storefront tsc and lint are clean for
  the touched files.
- **Open:**
  - Verify against real BC:
    - that `shippedQuantity`/`invoicedQuantity` are populated;
    - the sign and unit of `quantityBase`;
    - the `reservedFrom` values.
  - Earlier returns are not subtracted from returnable quantities (possible via `salesReturnOrders`).
  - Reservation display arguably belongs in its own Jira issue.
- **Next owner:** implementor / customer (sandbox walkthrough)

## 2026-09-29 - Reservations matched by item + variant

- **Outcome:** A real entry showed that `salesOrderReservationEntries` returns the **supply side**:
  `documentNumber`/`lineNumber` point at the purchase-order line (e.g. PO1865 / 30000), and the
  sales order appears only in `reservedFor`. A reservation for Camden L was therefore shown on the
  freight line.
- **Changes:**
  - Reservations are now matched to order lines by `itemNumber` + `variantCode`. The order query
    expands `salesOrderLines($expand=item,itemVariant)`.
  - When several lines match, the reservation fills the line that still has unshipped quantity.
  - The UI caps "reserved" at the unshipped quantity.
  - Observed `quantityBase` is positive; `Math.abs` is kept as a guard.
- **Validation:** Service tests pass (18/19; only the pre-existing `listOrders` guardrail test
  fails). Storefront tests pass (6/6).
- **Open:**
  - Confirm that the v2.0 `itemVariant` expand works on the tenant.
  - Ask the BC team to expose the sales order line no. (the reserved-for source ref. no.) on the
    entry, so matching can be exact.
