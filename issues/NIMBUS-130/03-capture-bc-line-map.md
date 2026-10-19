# 03: Keep the BC line numbers at submission
**App:** backend · **Layer:** L2 (BC adapter), L3 (existing outcome step), L5 (state parser) · **Depends on:** None

**Goal:** When an API order is sent to Business Central, record per accepted line the customer line
number, the EAN sent and BC's line number (`sequence`). Record them in
`metadata.business_central_integration.bc_lines`, in the same update that already records the BC
order number. Add no step to the workflow (review F3).
**Files / areas:**
- `apps/backend/src/modules/business-central/service.ts` (`postSalesOrderLine`, `createSalesOrder`)
  and `types.ts`;
- `src/modules/order-ingestion/bc-integration-state.ts` (type, parser);
- `src/workflows/business-central-order/steps/{submit-bc-order,record-bc-order-outcome}.ts`.
**Seam contracts:**
- `createSalesOrder` also returns accepted lines as `{ lineNumber, sequence: number | null }`.
- `BcIntegrationState.bc_lines`: `{ line_number, ean_no, bc_sequence: number | null }[] | null`. The
  parser returns null for older states (task 07 reads it).
- A sent or partial outcome writes `bc_order_number` and `bc_lines` together; a failed or skipped
  attempt keeps the previous values.
**Test intent:**
- Unit (adapter, mocked fetch): a 201 body with `sequence` → returned per line.
- Unit (adapter): a 201 with no or unparseable body → line still accepted, `sequence` null, never a
  failure.
- Unit (adapter): a rejected line is absent from the accepted lines.
- Unit (parser): a state without `bc_lines` → null; a malformed entry is rejected the way the parser
  treats other fields.
- HTTP integration (`send-order-to-bc.spec.ts`, BC mocked as today):
  - a sent order's metadata holds the BC number and the line map, with the EAN from the canonical
    line;
  - a force resend replaces both;
  - a failed submission leaves both unchanged;
  - no step follows the outcome step, so an ordinary retry after a sent outcome is still stopped by
    the duplicate guard (no second BC order).
**Done when:** `sales-order-create.spec.ts` and the BC integration-state tests pass with the new
field; lint and typecheck at or below the baseline.
**Verify after deploy:** `metadata.business_central_integration.bc_lines` on the next API order sent
to BC (a Metz test order), with one entry per accepted line and non-null `bc_sequence`.
**Also update:**
- `docs/architecture/business-central-order.md` ("State and HTTP contract");
- `modules/business-central/__tests__/sales-order-create.spec.ts`;
- `modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`;
- `integration-tests/http/business-central-order/send-order-to-bc.spec.ts`;
- the admin BC integration view (`workflows/business-central-order/utils/admin-bc-integration.ts`),
  if it asserts the state's exact keys.
