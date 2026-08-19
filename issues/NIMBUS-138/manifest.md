# Implementation Manifest: Create BC Connection for Return (NIMBUS-138)

**Project ID:** NIMBUS-138
**Date:** 2026-08-17
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-138` (from `develop`)

## Approach: stub-first, real BC last

There is **no dispatch gate**. The plan builds the whole vertical slice against **stubs**
(tasks 01–06), reaches a **demoable milestone** (task 07), then verifies the real BC contract
(task 08) and swaps the stub for the real BC HTTP call (task 09). The real BC action is not
yet contract-verified, but it is isolated behind the service seam (`BCCreateReturnParams` /
`BCReturnOrder` / `BCReturnReason`), so absorbing the real contract in task 09 touches only
`src/modules/business-central/service.ts`.

The public BC v2.0 API has no writable sales-return-order resource; a tenant custom API/action
that creates the return from a verified source order is a hard prerequisite — verified in
task 08, bound in task 09. No public `salesReturnOrders` writer is assumed.

## Assumed BC contract (working assumption; verified in task 08)

```json
{ "requestId": "RET-000123", "sourceOrderNo": "SO123456",
  "lines": [ { "sourceLineNo": 10000, "quantityToReturn": 2, "returnReasonCode": "DAMAGED" } ] }
```

`requestId` = server-generated deterministic idempotency key · `sourceOrderNo` =
`BCOrderDetail.number` · `sourceLineNo` = `BCOrderLine.sequence` (task 08 confirms) ·
`returnReasonCode` = an `id` from `listReturnReasons()`.

## Reused from NIMBUS-137 (already implemented)

- `bcService.getOrder({ customerNumber, orderId })` → `BCOrderDetail` with per-line
  `sequence`/`quantity`; source-order + line/quantity verification seam.
- `GET /store/bc-orders/[id]` → company-scoping + 404-on-cross-company pattern; the
  `query.graph` customer→company→`business_central_customer_number` resolution.
- `bc-order-detail-template.tsx`, `retrieveBCOrder` → storefront detail surface the return UI
  extends.
- `src/modules/business-central/__tests__/` → mocked-`fetch` module test pattern.

## Tasks

| # | Title | File | App | Depends On | Uses stub? | Status |
|---|-------|------|-----|------------|------------|--------|
| 01 | BC return service stub + reasons + types | `01-backend-bc-return-service-stub.md` | backend | None | ships stub | DONE |
| 02 | BC return request persistence module | `02-backend-return-persistence-module.md` | backend | None | — | REMOVED |
| 03 | Direct create-BC-return workflow | `03-backend-create-return-workflow.md` | backend | 01 | stub | DONE (stub) |
| 04 | Store return routes + validators + middlewares | `04-backend-store-return-routes.md` | backend | 01, 03 | stub | DONE (stub) |
| 05 | Storefront return data layer + types | `05-storefront-return-data-layer.md` | storefront | 04 | stub | DONE (stub) |
| 06 | Storefront return-entry UI | `06-storefront-return-ui.md` | storefront | 05 | stub | DONE (stub) |
| 07 | Verification — stubbed end-to-end flow (demoable) | `07-verification-stubbed-flow.md` | both | 01–06 | stub | TODO (blocked) |
| 08 | BC return contract verification (spike) | `08-bc-return-contract-verification.md` | backend (spike) | 07 | — | TODO |
| 09 | Replace stubs with real BC implementation | `09-backend-bc-real-implementation.md` | backend | 08 | swaps stub | TODO |

Notes:
- Task 02 was removed: Business Central owns idempotency through the deterministic `requestId`.
- Task 08 (contract spike) has no code dependency on 01–07 and may run in parallel with them;
  it only blocks task 09.
- **Every stub carries a `// STUB (NIMBUS-138 task 09):` comment** so the swap points are
  greppable.
- **Status as of 2026-08-19:** Tasks 03–06 are implemented against the offline stub (verified
  in the working tree on `develop`; `return-stub.spec.ts` passes 6/6). They are marked
  `DONE (stub)` because the real BC call is still stubbed — task 09 must swap the stub before
  they are fully complete. Task 07 is `TODO (blocked)`: the stubbed e2e walkthrough and HTTP
  integration tests are pending a valid local test PostgreSQL configuration
  (`SASL: client password must be a string`) and a running local backend for storefront
  page-data collection. Tasks 08–09 are not started. Work is currently uncommitted on
  `develop` rather than on the planned `feature/NIMBUS-138` branch.

## Test Strategy

- **BC boundary + workflow idempotency:** module tests (`test:integration:modules`) mocking
  `global.fetch` (the stub is offline, so 01's tests need no mock; 03/09 use the pattern).
- **Route auth/scope/validation:** HTTP integration tests (`test:integration:http`), create
  seam is the offline stub through task 07.
- **Storefront:** verified via the UI flow + backend integration tests (no speculative
  storefront jest harness).
- **Sandbox contract:** exercised in task 08 (`CONTRACT.md`) and re-confirmed against real BC
  in task 09.

## Route-collision watch

`/store/bc-orders/return-reasons` (static) vs `/store/bc-orders/[id]` (dynamic) share a path
depth. Medusa resolves the static segment first, but the implementor must confirm the reasons
GET is not captured by `[id]/route.ts`; if it is, nest reasons under
`/store/bc-orders/returns/reasons` and update task 05's fetch URL.
