# 01: Adapter reads item lookup evidence per order and sends `itemVariantId`
**App:** backend · **Layer:** L2 (Business Central adapter) · **Depends on:** None

**Goal:** Replace the per-line `findItemsForOrderLines` decision with one evidence read per order
(items by item-card barcode, Item Reference rows by barcode, items by number with sizes), and send
`itemVariantId` on the BC sales line when set. No matching rule in the adapter.
**Files / areas:** `apps/backend/src/modules/business-central/` (`types.ts`, `service.ts`, a new
focused file beside it for the item-lookup reads and mapping); `__tests__/item-lookup.spec.ts`,
`__tests__/sales-order-create.spec.ts`.
**Seam contracts:**
- `IBusinessCentralModuleService.getItemLookupEvidence(lines: BCItemLookupInput[]): Promise<BCItemLookupEvidence>`;
  Empty input returns empty lists without any request. `findItemsForOrderLines` and its types stay
  until task 03 removes them (the step still calls it), so the branch typechecks after each task.
- `BCItemLookupEvidence = { itemsByBarcode: BCItem[]; barcodeReferences: BCItemBarcodeReference[]; itemsByNumber: BCItem[] }`.
- `BCItem` gains `variants: { id: string; code: string }[]` (empty for an item without sizes).
- `BCItemBarcodeReference = { barcode: string; itemNumber: string; variantCode: string; unitOfMeasureCode: string; referenceType: "bar_code" | "other" }`
  (empty codes are `""`; `"Bar Code"` → `bar_code`, every other wire value → `other`).
- `BCItemMatchSource` gains `"itemReference"`.
- `BCCreateSalesOrderLineInput.itemVariantId?: string`, sent as `itemVariantId` only when defined.
**Test intent:**
- Barcode and Item Reference reads: chunks of at most 20 values per `or` filter; Item Reference URL
  carries the `company` parameter from the existing ODataV4 helper; rows map per the seam (fixture:
  the three TestDK rows for `5712094132141`, blank type `" "` → `other`).
- Number read: union of reference item numbers, line `itemNumber` and `custItemNo`, deduplicated;
  blank and over-20-character values are not requested; each item carries its variants.
- Negative: an item number containing `'` and ` or ` is sent as one escaped literal; a 21-character
  number causes no request.
- Negative: any non-OK read (incl. 429) or a response with `@odata.nextLink` throws; the error
  message carries no response body.
- One token for the whole read; empty input makes no request.
- Line body: `itemVariantId` present when set, absent otherwise (extend TC-3/TC-4 of
  `sales-order-create.spec.ts`).
**Done when:** the new method and types exist as in the seam; module tests, lint and typecheck (at
or below baseline) pass.
**Also update:** none in this task: `item-lookup.spec.ts` (old decision) is removed with the old
method in task 03; new tests go in a new spec file.

## Deviations

- The required `BCItem.variants` broke typed `BCItem` fixtures, so `variants: []` was added to the
  fixture item in `item-lookup.spec.ts`, `integration-tests/http/business-central-order/send-order-to-bc.spec.ts`
  (`ITEM_ONE`, `ITEM_TWO`) and `bc-order-ready-subscriber.spec.ts` (`LOOKUP_RESULTS`). Why: keeps the
  branch typechecking at baseline; no assertion changed. The old `findItemsForOrderLines` now maps
  items through the shared `mapLookupItem` (variants `[]`, as it does not expand them).
- New tests are in `__tests__/item-lookup-evidence.spec.ts` (fetch-mocked, no `.unit` suffix, run with
  `test:integration:modules` like the module's other fetch-mocked specs). Why: the task named only
  "a new spec file".
- Input with no usable barcode and no usable item number (not just an empty array) also returns empty
  lists without any request, including the token. Why: the 21-character negative case ("causes no
  request") holds for the whole read.
- Added cases beyond the intent: reference types `Customer`, `Vendor`, `Bar_x0020_Code` and missing all
  map to `other`; a `null` unit maps to `""`; a read that does not complete throws without the
  underlying error text; the item-card barcode read also expands `itemVariants` (the rule needs sizes
  for items found by item-card barcode, plan rule rows 7/8).
- Reads run one request at a time (item-card barcodes, then the company-name request and Item
  Reference rows, then numbers), not in parallel. Why: same load profile as the lookup it replaces
  (NF throttling); the Item Reference read costs one extra company-name request per order, as every
  ODataV4 call through `getODataV4Url` does.
- A non-OK read, including 429, throws a `MedusaError` with the status only (not
  `BusinessCentralThrottledError`). Why: the step maps any thrown error to `bc_item_lookup_failed`.

## Done-when evidence

- New method and types exist as in the seam: `IBusinessCentralModuleService.getItemLookupEvidence`,
  `BCItemLookupEvidence`, `BCItemBarcodeReference`, `BCItem.variants`, `BCItemMatchSource` +
  `"itemReference"`, `BCCreateSalesOrderLineInput.itemVariantId` in
  `apps/backend/src/modules/business-central/types.ts`; implemented in `service.ts` +
  `item-lookup-evidence.ts`; typecheck at 22 = baseline proves the interface is implemented.
  - Rows map per the seam (TestDK `5712094132141`, blank `" "` → `other`): `item-lookup-evidence.spec.ts`
    "reads Item Reference rows for a size barcode and the named item with its sizes", "maps every
    reference type other than Bar Code to other", "keeps empty size and unit codes as empty strings".
  - Company parameter on the Item Reference URL: same first test (`company` = `'Nimbus Nordic A/S'`).
  - Chunks of at most 20 per `or` filter: "reads barcodes in chunks of at most 20 values per or filter,
    deduplicated and without blanks" (20, 20, 5 for both barcode reads).
  - Number read union, dedup, blank and over-20 skipped, variants per item: "reads items by the union
    of reference item numbers, line item numbers and customer item numbers", "does not request an item
    number longer than 20 characters", "makes no number request when no usable item number is named",
    "returns items found by item-card barcode with their sizes, empty when they have none".
  - Escaping negative: "sends an item number containing a quote and ' or ' as one escaped literal".
  - 21-character negative: "makes no request at all when the only identifier is a 21-character item
    number".
  - Non-OK (500, 429, 400) without body: "throws without the response body when %s fails" (3 cases);
    next link: "throws when the %s response carries a next link" (3 cases); "throws when a read does
    not complete".
  - One token / empty input: "uses one token for the whole read", "returns empty lists without any
    request for empty input".
  - Line body `itemVariantId` present / absent: `sales-order-create.spec.ts` TC-3 (present on line 1,
    absent on line 2) and TC-4 (exact keys without it).
- Module tests pass: `test:integration:modules -- src/modules/business-central`: all new and changed
  specs pass; the one failure (`service.spec.ts` listOrders "stops filling from salesInvoices after the
  round-trip guardrail…") fails identically on the unchanged service (baseline, `verification.md`).
- Lint: 0 errors (13 warnings, none in touched files). Typecheck: 22 errors = baseline 22.
- Also update: none required; the three typed fixtures above were updated (see Deviations).
