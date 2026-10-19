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

## Deviations

- `bc_lines` follows the BC order identity, not the outcome status: it is replaced whenever the
  attempt created a BC order (`bcLines` is set exactly when `bcOrderId` is), else kept. Why: the
  existing step already records `bc_order_id`/`bc_order_number` from an all-lines-rejected attempt
  (status `failed`), so keeping the map there would pair a new BC number with the old order's map;
  that case records an empty map with the new number.
- `createSalesOrder` keeps `acceptedLineNumbers` and adds `acceptedLines` (the seam says "also
  returns"); `acceptedLineNumbers` is now derived from `acceptedLines`.
- A `sequence` that is not an integer (string, fraction) is treated as absent (null). Why: BC line
  numbers are integers; an added adapter test covers it.
- Added test: the Admin view does not expose `bc_lines` (it carries EANs and the Admin integration
  spec asserts exact keys and no `ean_no`); `AdminBcIntegration` omits the field. This test passes
  before the change by design (a regression guard).
- `bc-order-ready-subscriber.spec.ts` fixture updated with `acceptedLines` (type change; not in
  "Also update").
- The HTTP integration specs were run once after the implementation (about 10 minutes, local
  Postgres), not first in red; the adapter and parser tests were confirmed red first.

## Done-when evidence

- `sales-order-create.spec.ts` passes with the new field: `src/modules/business-central/__tests__/sales-order-create.spec.ts`
  15/15 (`TC-1` sequence per line; "keeps a line accepted with a null BC line number when its 201
  body has no usable sequence"; "ignores a sequence that is not an integer"; `TC-5`/`TC-6` rejected
  lines absent from `acceptedLines`).
- BC integration-state tests pass: `bc-integration-state.unit.spec.ts` ("reads a state written
  before the line map existed as having no line map", "keeps usable line-map entries and drops
  malformed ones", `TC-1`, `TC-2`) and `admin-bc-integration.unit.spec.ts`, 13/13.
- HTTP integration (`send-order-to-bc.spec.ts`, 23/23 with `bc-order-ready-subscriber.spec.ts` 5/5):
  "records the BC line map with the canonical EAN in the same update as the BC order number",
  "replaces the BC order number and the line map together on a force resend", "leaves the BC order
  number and the line map unchanged when a resend fails", "keeps an ordinary retry after a sent
  outcome stopped by the duplicate guard".
- No step added: `workflows/send-order-to-business-central.ts` unchanged (prepare → submit → record).
- Lint: 0 errors (13 pre-existing warnings, none in touched files). Typecheck: 22 errors, baseline 22.
- Verify after deploy: not provable in this task: needs a real Metz test order sent to BC.
- Also update: `docs/architecture/business-central-order.md` ("State and HTTP contract": `bc_lines`
  paragraph; DTO exclusion list names it); `sales-order-create.spec.ts`,
  `bc-integration-state.unit.spec.ts`, `send-order-to-bc.spec.ts` updated as above; admin view:
  asserts exact keys, so `bc_lines` is omitted from `AdminBcIntegration` and the HTTP admin spec
  needed no change.
