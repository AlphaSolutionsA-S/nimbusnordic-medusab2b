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