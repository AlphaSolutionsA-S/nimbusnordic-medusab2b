# Branch notes: NIMBUS-180

## Task 01 (adapter evidence)

- `service.getItemLookupEvidence(lines: BCItemLookupInput[])` returns
  `{ itemsByBarcode, barcodeReferences, itemsByNumber }` (types in `modules/business-central/types.ts`).
  Pure helpers (value collection, chunking, mapping) are in `modules/business-central/item-lookup-evidence.ts`.
- `barcodeReferences` holds every Item Reference type; `referenceType` is `"bar_code"` only for the wire
  value `"Bar Code"`. Filtering by type and unit is the rule's job (task 02).
- `itemsByBarcode` and `itemsByNumber` items both carry `variants` (`[]` for no sizes) and
  `baseUnitOfMeasureCode`. The same item can appear in both lists; dedupe by `id` if needed.
- `itemsByNumber` is not keyed per line: match a line's `itemNumber` / `custItemNo` (trimmed) against
  `item.number`. Values that were blank or over 20 characters were never requested, so they simply find
  no item. Whether BC's `number` filter matches case-insensitively was not probed.
- Any read failure (non-OK incl. 429, next link, network, malformed JSON) throws a `MedusaError` whose
  message has the status only; the step's existing catch → `bc_item_lookup_failed` still applies.
- `BCCreateSalesOrderLineInput.itemVariantId` is sent only when defined (`assignIfDefined`).
- `findItemsForOrderLines` still exists (step uses it) and now returns `variants: []` on its items.
- Typed `BCItem` fixtures in `integration-tests/http/business-central-order/*.spec.ts` gained
  `variants: []`; task 03 moves those specs to the new read.
- Fetch-mocked BC module specs run only with `test:integration:modules -- <path>`; a path pattern
  without `__tests__/<file>` also picks up stale `.medusa/server` copies. `service.spec.ts` listOrders
  guardrail test fails at baseline.

## Task 02 (resolution rule)

- `resolveOrderLineItem(line, evidence)` in `workflows/business-central-order/utils/resolve-order-line-item.ts`;
  exported types `OrderLineItemInput` (`eanNo: string` required; pass `""` when absent) and
  `OrderLineItemResolution` (`{ resolved: true, itemId, itemVariantId, matchedBy }` or
  `{ resolved: false, reason }`). Call it once per line with the whole order's evidence.
- `reason` is assignable to `BcOrderLineFailure.reason` directly; `no_identifiers` is returned only
  when barcode, item number and customer item number are all blank.
- Item numbers, size codes and units are compared trimmed and upper-cased; the rule dedupes items by
  `id`, so passing the same item in both evidence lists is fine.
- `itemVariantId` is `null` for an item without sizes; map it to `undefined` for
  `BCCreateSalesOrderLineInput.itemVariantId` (sent only when defined).
- Widget labels and parsed reasons for `size_unresolved` / `unit_mismatch` are in place.
- `pnpm ai:check` is over the root `AGENTS.md` size limit after the decisions.md row (open, human).
