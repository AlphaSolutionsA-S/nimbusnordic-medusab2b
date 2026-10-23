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
