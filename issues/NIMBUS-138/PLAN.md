# NIMBUS-138: Create BC connection for return

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-138

## Objective

Let an authenticated Customer Portal user create one Business Central sales return order
from selected lines of a company-owned BC sales order — driven from the order-detail page
(pick lines, quantities, and a per-line return reason) — idempotently and without posting
any financial document.

## Strategy: stub-first vertical slice, real BC last

The plan builds the **entire** flow (service seam → workflow → routes →
storefront data layer → return-entry UI) against **stubs**, reaches a **demoable milestone**
(task 07), and only then verifies the real BC contract (task 08) and swaps the stub for the
real BC HTTP call (task 09).

This is deliberate: the real BC return-creation action is not yet contract-verified, and we
do not want that unknown to block the whole UI/workflow/route slice. Everything sits behind a
service seam (`BCCreateReturnParams` / `BCReturnOrder` / `BCReturnReason`), so absorbing the
real contract in task 09 touches only `service.ts`.

### Assumed BC contract (working assumption; verified in task 08)

```json
{
  "requestId": "RET-000123",
  "sourceOrderNo": "SO123456",
  "lines": [
    { "sourceLineNo": 10000, "quantityToReturn": 2, "returnReasonCode": "DAMAGED" },
    { "sourceLineNo": 30000, "quantityToReturn": 1, "returnReasonCode": "WRONGITEM" }
  ]
}
```

Field mapping from NIMBUS-137 read data (`bcService.getOrder`):

| BC body field              | Source in portal                                  | Notes |
|----------------------------|---------------------------------------------------|-------|
| `requestId`                | server-generated deterministic idempotency key    | one field doubles as the BC idempotency identifier |
| `sourceOrderNo`            | `BCOrderDetail.number`                             | human order no., not the OData GUID |
| `lines[].sourceLineNo`     | `BCOrderLine.sequence`                             | **task 08 confirms** `sequence === "Line No."` |
| `lines[].quantityToReturn` | UI qty, validated `> 0` and `<= line.quantity`    | |
| `lines[].returnReasonCode` | UI per-line dropdown value (`id` from `listReturnReasons()`) | |

## Analysis

- NIMBUS-137 (implemented in the working tree) is the reuse foundation: `bcService.getOrder`
  → `BCOrderDetail` with per-line `sequence`/`quantity`; the company-scoped
  `GET /store/bc-orders/[id]` route (404 on cross-company); `retrieveBCOrder` +
  `bc-order-detail-template.tsx`; the mocked-`fetch` module test pattern.
- The public BC v2.0 API has **no** writable sales-return-order resource. A tenant custom
  API/action that creates the return inside BC from a verified source order is a hard
  prerequisite (task 08 verifies it; task 09 binds it). A sales order or credit memo is not a
  substitute, and no public `salesReturnOrders` writer is assumed.
- This is a financial/inventory mutation across an external system, so — even with a stub —
  the plan bakes in strict server-derived authorization, strict input validation, a deterministic
  request ID that BC uses for idempotency, immediate timeout propagation, and redaction of BC
  internals from the start.

## Execution Plan (9 tasks, stub-first)

1. **Task 01 — BC return service stub + reasons + types.** Stub `createReturnFromSalesOrder`
   (offline deterministic fake) and dummy `listReturnReasons()`; add the seam types and the
   `BusinessCentralAmbiguousOutcomeError` sentinel. Every stub carries a
   `// STUB (NIMBUS-138 task 09):` comment.
2. **Task 02 — removed.** BC owns idempotency through the deterministic `requestId`; no local
   return-request persistence module is used.
3. **Task 03 — direct create-return workflow.** `createBcReturnWorkflow`: `getOrder` ownership +
   quantity/reason validation, deterministic `requestId`, and synchronous invocation of the
   (stubbed) service.
4. **Task 04 — store routes.** `GET /store/bc-orders/return-reasons` and
   `POST /store/bc-orders/:id/returns` with strict Zod validation, server-derived company
   scope, and customer-safe error mapping.
5. **Task 05 — storefront data layer.** `listBCReturnReasons` + `createBCReturn` server
   actions and return/reason types.
6. **Task 06 — storefront return-entry UI.** Extend the order-detail page: eligible lines,
   bounded quantity inputs, per-line reason dropdowns, pending/success/error, duplicate-submit
   prevention.
7. **Task 07 — verification (stubbed flow).** Demoable milestone: the whole slice works
   against the stubs. Build/lint, module + HTTP tests, stub-level idempotency, security/authz,
   manual storefront walkthrough. BC-side assertions explicitly deferred.
8. **Task 08 — BC return contract verification.** Sandbox spike → `CONTRACT.md` (endpoint,
   scope, request/response schema + delta vs assumed, line identity, idempotency lookup,
   reason source, error catalogue, non-goals, permissions). No portal code depends on it.
9. **Task 09 — real BC implementation.** Replace the stub `createReturnFromSalesOrder` with the
   verified BC HTTP call and the dummy reasons provider with the real source; make the
   ambiguous-outcome path reachable; re-verify against real BC. Touches only `service.ts`.

## Decisions & Trade-offs

- **Stub-first, real BC last.** Unblocks the full UI/workflow/route slice and yields an early
  demoable milestone; isolates the one true unknown (the BC contract) behind a service seam so
  it lands last with minimal blast radius.
- **BC-side return creator, not a generic writer.** Keeps copy-document, item-tracking,
  dimensions, tax, and application logic authoritative in BC; avoids a client-controllable
  `salesReturnOrders` writer.
- **Server-generated deterministic idempotency key** (hash of customer + source order + sorted
  lines) that **doubles as** the BC `requestId`, so BC collapses retries to one document.
- **Immediate, customer-safe timeout propagation.** The backend maps ambiguous BC outcomes to an
  error response for the storefront; it does not persist or reconcile return requests locally.
- **Reuse NIMBUS-137's `getOrder`** for source verification and the `[id]` 404 pattern.
- **Per-line reason in the UI** (`returnReasonCode` per line), matching the assumed BC body.

## Verification

- [ ] `pnpm build` (backend + storefront) and `pnpm lint` pass.
- [ ] Module tests: stub determinism + reasons shape (01); workflow partial success,
  cross-company 404, quantity-exceeds 400, unknown reason 400, idempotent retry short-circuit
  (03).
- [ ] HTTP tests: 401 unauth, reasons 200, 400 no-BC-number, 400 strict-payload, 404
  cross-company, 200 happy path (04).
- [ ] Stub-level idempotency: two identical requests use the same deterministic `requestId`.
- [ ] Manual storefront walkthrough of the return-entry UI against the stub (07).
- [ ] `CONTRACT.md` answers every checklist item (08).
- [ ] Real BC: exactly one return on ambiguous-then-retry; no credit memo/receipt/refund; no
  BC internals leaked; sandbox scenarios pass on a dedicated non-production customer/order (09).
