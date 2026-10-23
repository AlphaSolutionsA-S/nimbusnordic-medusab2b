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

## Deviations

- Also removed the private `findItemsByFilter` in `service.ts`: its only caller was
  `findItemsForOrderLines`. The comment on `fetchItemLookupRows` that compared it to "the per-line
  lookup it replaces" was reworded, since that lookup no longer exists.
- `send-order-to-bc.spec.ts` gained a `beforeEach` that makes `globalThis.fetch` reject. A BC method
  left unstubbed now fails the test instead of reaching a tenant. It also made the red run against
  the old step safe.
- The "Admin GET returns that reason" check is a new test in `integration-tests/http/admin/bc-integration.spec.ts`
  that seeds `size_unresolved` and `unit_mismatch` line failures and reads them through
  `GET /admin/orders/:id/bc-integration`. `send-order-to-bc.spec.ts` has no HTTP client, so the
  check could not go there.
- `bc-integration.spec.ts` needed more than reason codes. Its fake vendor runs the real adapter, so
  it now also answers the company-name read (`/companies(<id>)`) and the ODataV4
  `ItemReferenceEntries` read (empty), which the new evidence read calls.
- Added test: an order whose every line is refused by the new reasons (`size_unresolved` and
  `unit_mismatch`) creates no BC order. TC-3 still covers all lines `not_found`.
- Not verified locally: `bc-integration.spec.ts`. 10 of its 12 tests already fail at HEAD with 401
  on admin auth in this environment (checked by stashing this task's changes), and the new test
  fails the same way. The fake-vendor additions and the new GET test are unproven until the spec
  runs where admin auth works.
- `item-lookup.spec.ts` was deleted with `git rm`, so the deletion is already staged.

## Done-when evidence

- Step wired (evidence read once, rule per line, refusals become line failures, `itemVariantId` passed):
  `send-order-to-bc.spec.ts`, tests "sends a size barcode line with its item and size, in the
  customer's unit" (one `getItemLookupEvidence` call; BC line has `itemVariantId`, unit `pcs` as
  sent; `bc_lines[0].ean_no = 5712094132141`), "refuses a sized item reached by item number and
  submits the size barcode line" (`partial`, `reason: size_unresolved`, identifiers from the
  canonical line), "sends no line without its size: an order whose every line is refused creates no
  BC order", and TC-1 (an item without sizes is sent without `itemVariantId`). All pass.
- Evidence read throws gives `bc_item_lookup_failed`, and the log has the order id and the error
  message only: `send-order-to-bc.spec.ts` TC-11 (exact log string asserted). Passes.
- Admin GET returns the new reason: `bc-integration.spec.ts`, "returns the size and unit refusal
  reasons of a partial submission". Not provable locally because admin auth returns 401 at HEAD (see
  Deviations); it runs at finalization.
- Old lookup and its spec removed: `findItemsForOrderLines`, `findItemsByFilter`,
  `buildItemLookupCandidates`, `BCItemLookupResult` and `BCItemLookupFailureReason` are gone, and
  `item-lookup.spec.ts` is deleted. A grep over `apps/backend` (excluding `node_modules` and
  `.medusa`) finds no references. Typecheck is at baseline.
- HTTP specs use the new read: both business-central-order specs spy on `getItemLookupEvidence`
  with evidence fixtures. `send-order-to-bc.spec.ts` passes 26/26 and
  `bc-order-ready-subscriber.spec.ts` passes 5/5.
- Lint: `pnpm --filter @b2b-starter/backend lint` reports 0 errors (13 existing warnings, none in
  touched files). Typecheck: 22 errors, the same set as the baseline.
- Also update, `send-order-to-bc.spec.ts`: moved to `getItemLookupEvidence`;
  `matchedLine`/`unmatchedLine` replaced by `NO_EVIDENCE`, `byCardBarcode(...)` and
  `BOTH_LINES_FOUND`.
- Also update, `bc-order-ready-subscriber.spec.ts`: moved to `getItemLookupEvidence` with
  `LOOKUP_EVIDENCE`.
- Also update, `bc-integration.spec.ts`: it asserts reason codes, so it got the new reason test and
  the fake-vendor additions (see Deviations).
- Also update, `item-lookup.spec.ts`: deleted.
- Verify after deploy: not provable in this task. It needs a real order into BC TestDK (see the
  task's "Verify after deploy").
