# 03: Submission uses the rule and sends the size
**App:** backend · **Layer:** L3 (prepare step) · **Depends on:** 01, 02

**Goal:** The prepare step reads the evidence once, resolves each line with the rule, records
refusals as line failures and passes `itemVariantId` to the BC line; the old adapter lookup is removed.
**Files / areas:** `apps/backend/src/workflows/business-central-order/steps/prepare-bc-order.ts`;
`apps/backend/src/modules/business-central/{types.ts,service.ts}` (remove `findItemsForOrderLines`,
`BCItemLookupResult`, `BCItemLookupFailureReason`, `buildItemLookupCandidates`, and
`__tests__/item-lookup.spec.ts`); `apps/backend/integration-tests/http/business-central-order/`.
**Seam contracts:** uses 01's `getItemLookupEvidence` and 02's `resolveOrderLineItem`; the line's
`unitOfMeasureCode` passed to the rule is the canonical line's; the BC line keeps the customer's unit.
Line failures keep `ean_no`, `item_number`, `cust_item_no` from the canonical line; `bc_lines` and
everything after preparation unchanged.
**Test intent:** (HTTP integration, synthetic BC, run at finalization)
- Size barcode line → `createSalesOrder` receives the line with `itemVariantId`; `bc_lines` entry
  carries the customer's barcode.
- Mixed order: one size line resolved, one item with sizes reached by item number refused →
  `partial`, `line_failures[].reason = size_unresolved`; Admin GET returns that reason.
- All lines refused → `no_lines_resolved`, no BC order created.
- Evidence read throws → `bc_item_lookup_failed`; the log line carries the order id and the error
  message only.
**Done when:** step wired; old lookup and its spec removed; HTTP specs moved to the new read; lint and
typecheck pass.
**Verify after deploy:** submit an order with line barcode `5712094132141` through `POST /orderapi/orders`
into BC TestDK; the BC sales order line (`salesOrderLines?$expand=itemVariant`) shows item
`HEND-L-MIDNBLUE` and `itemVariant.code = L`; the Medusa order's
`metadata.business_central_integration.bc_lines` has `ean_no = 5712094132141`.
**Also update:** `integration-tests/http/business-central-order/send-order-to-bc.spec.ts` and
`bc-order-ready-subscriber.spec.ts` (spy on `findItemsForOrderLines` → `getItemLookupEvidence`,
fixtures `matchedLine`/`unmatchedLine` become evidence); `integration-tests/http/admin/bc-integration.spec.ts`
if it asserts reason codes; `src/modules/business-central/__tests__/item-lookup.spec.ts` (deleted with
the method it tests; its behaviours are covered by tasks 01 and 02).
