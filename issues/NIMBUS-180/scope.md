# Order API: match size barcodes to the right Business Central item and size

> Record of NIMBUS-180, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Date:** 2026-10-23
**Status:** Implemented
**Type:** Bug
**Priority:** Medium
**Issue:** NIMBUS-180 (parent NIMBUS-206 "bugs")
**Key:** NIMBUS-180
**Case folder:** issues/NIMBUS-180/
**Base Branch:** develop (work branch `feature/NIMBUS-180`)

## Background

Customers' systems send orders to Medusa through the order API. Each order line names the product
by its barcode (EAN, required, 13 digits) and optionally by an item number and the customer's own
item number. When Medusa passes the order on to Business Central (BC), it finds the BC item for
each line and creates a BC sales order line for it.

Today that search only knows the barcode on the BC item card (`gtin`), and the line sent to BC
never names a size. At Nimbus, sizes are set up as variants of one item, each with its own barcode
held as an Item Reference. Verified by query in BC TestDK on 2026-10-23 (Klaus, read-only;
`samples/bc-variant-barcodes-testdk.md`); production is set up the same way, as stated by Klaus
the same day (not queried). Item `HEND-L-MIDNBLUE` (Henderson Women, Midnight Blue)
has an empty item-card barcode and seven size variants, XS to 3XL, each with its own barcode
(e.g. `5712094132141` → variant `L`).

For such an item, an order line with a size barcode today:

1. finds nothing by barcode; without an item number the line is left out of the BC order (reason
   "Item not found", visible only in the Admin order widget), and if no line resolves nothing is
   sent at all;
2. or, when the line also carries the item number, matches the item without its size, so BC
   receives the right product in no particular size (whether BC accepts such a line was not probed;
   after this fix the question no longer arises, see Business rules).

The two real Metz order samples (`../NIMBUS-129/example edi files/`) use one item per size with
the barcode on the item card, which works today and must keep working.

What is true when done: an order line's barcode resolves to the one BC item and size (variant) it
belongs to and the BC sales line carries that size; a line that cannot be resolved that way is
left out with a clear reason; no line is ever sent to BC for an item with sizes without its size.

## Requirements

### Functional

1. Barcode resolution covers both the item-card barcode (`gtin`) and the Item Reference barcodes
   (ODataV4 page `ItemReferenceEntries`: `Item_No`, `Variant_Code`, `Unit_of_Measure`,
   `Reference_Type`, `Reference_No`), returning the item and, where there is one, the variant.
2. A resolved variant is sent on the BC sales line as `itemVariantId` (a GUID; the standard API
   v2.0 sales order line has no `variantCode` property, verified from
   `../NIMBUS-129/bc metadata/std odata metadata.xml`). The id comes from the item's
   `itemVariants` (item + variant code → id; verified in TestDK, ids in the sample file).
3. Barcodes on the item card keep working exactly as today (one item per size, the Metz samples).
4. A line that cannot be resolved follows the existing per-line failure path: it is left out,
   recorded as a line failure with a reason code, and the order goes ahead with the other lines;
   if no line resolves, the submission fails with "no lines resolved" as today.
5. Two new line-failure reasons, each with a readable label in the Admin order widget: "size could
   not be determined" and "barcode is for a different unit of measure" (codes chosen by the
   planner).
6. The BC line map kept for shipment notices (`bc_lines`: customer line number, barcode, BC line
   number) is written as today, so shipment notices return the customer's own barcode for size
   lines too.

### Non-functional

- BC load: at most one extra BC request per order line whose barcode is not an item-card barcode,
  plus what is needed to find the variant id and whether an item has sizes (the planner settles the
  exact calls and whether they can be batched per order).
- BC throttling and failures behave as the existing item lookup does (the whole lookup fails and
  the submission is recorded as `bc_item_lookup_failed`; retry from Admin).
- ODataV4 calls go through the adapter's existing ODataV4 URL helper, which adds the `company`
  parameter, as the return calls already do. Klaus's manual probe failed with a hand-written
  `company` parameter and worked without it; the error was not captured and is taken as a quoting
  issue in the manual query, not a design change. The planner confirms the call shape against
  TestDK.
- Logs carry order ids, line numbers and reason codes only; no BC response text, no company or
  customer data.

## Business rules

- A barcode always belongs to exactly one item and, for items with sizes, exactly one size (Klaus,
  2026-10-23). So a size barcode resolves to item + size; it is never refused for being a size
  barcode.
- Only Item Reference rows of type "Bar Code" count; rows of any other type, including blank-type
  rows, are ignored (Klaus, 2026-10-23).
- "Bar Code" rows for one barcode that all name the same item and variant are one match. In TestDK
  every barcode has two such rows (unit empty, and unit `PCS`) plus a blank-type row, which is
  ignored; they resolve, not refuse.
- Rows (item card and Item Reference together) that name more than one item, or more than one
  variant of the same item → line refused, reason "Multiple items matched" (as today for several
  items).
- Item-card barcode and Item Reference both match and agree on the item → the reference's variant
  is used; they disagree on the item → refused as above.
- Unit of measure on a "Bar Code" row: a row counts for the line when its unit is empty (any
  unit) or equals the line's unit, or, when the customer sent no unit, the item's base unit (`PCS`
  for Henderson). The line keeps the unit the customer sent, as today.
- A barcode whose "Bar Code" rows are all held for another unit (a pack or carton barcode) →
  line refused, reason "barcode is for a different unit of measure" (Klaus, 2026-10-23).
- Barcode matches nothing, and the item number or customer item number names an item without
  sizes → a line for that item, as today (fallback kept, Klaus, 2026-10-23). The same fallback
  for an item with sizes → refused, reason "size could not be determined".
- A line for an item that has sizes is never sent to BC without its size: any path that resolves
  such an item without a variant refuses the line with that reason. Because of this rule, BC's own
  behaviour for a size-less line does not need to be probed (it was not).
- Refused lines never stop the other lines; an order with no resolvable lines is not sent (as today).
- Who acts: the submission runs as the system on the order-ingestion event, or as the Admin user who
  starts a retry or forced resend (unchanged); no new write permissions.
- The customer is not told about refused lines through the order API (intake already answered 201);
  they show in the Admin order widget only. Accepted by Klaus (2026-10-23); no customer-feedback
  story.
- No order-API orders have reached production BC yet, so there is no history of size-less lines
  to correct.

## Data model (draft)

No new tables or migrations expected.

| Entity / field | Key and meaning | Owner | Written by | Stored or derived | Sensitive | Retention |
|---|---|---|---|---|---|---|
| BC Item Reference (`ItemReferenceEntries`) | barcode (`Reference_No`) → item number + variant code (+ unit, type) | Business Central | Nimbus in BC | read live from BC per submission, not stored | no | BC's |
| BC item variant (`itemVariants`) | item + variant code → id used as `itemVariantId` | Business Central | Nimbus in BC | read live from BC | no | BC's |
| Item lookup result (in memory) | per order line: item, variant (new), matched-by (new value for an Item Reference match) | `businessCentral` adapter | submission workflow | derived per run | no | none |
| `order.metadata.business_central_integration.line_failures[].reason` | known reason codes; gains "size could not be determined" and "barcode is for a different unit of measure" | `orderIngestion` (`bc-integration-state.ts`) | outcome step | stored on the order | no | order lifetime |
| `order.metadata.business_central_integration.bc_lines` | unchanged (`line_number`, `ean_no`, `bc_sequence`) | `orderIngestion` | outcome step | stored | no | order lifetime |

## Security properties (draft)

Not auth, personal or payment data; no new endpoint. Two properties still apply:

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Barcode in a BC query cannot alter the query | schema allows only 13 digits; values escaped as today | canonical order schema | 400 at intake |
| No vendor text or company data in logs or the Admin status | reason codes only, as today | `bc-integration-state.ts` projection | unknown reasons shown as null |

## Affected apps

- Backend only (`apps/backend`): the Business Central adapter (barcode lookup, variant lookup,
  sales line body), the Business Central order submission step, the order-ingestion state contract
  (reason codes), the Admin order widget labels, and the docs
  `docs/architecture/business-central-order.md`.
- Business Central: read-only use of existing pages (`ItemReferenceEntries`, `items`,
  `itemVariants`); nothing changes in BC.
- Storefront and CMS: not affected. Shipment notices: no change in this story (they take the
  barcode from the order line map); the size on notices is a follow-up (Out of scope).

## Proposed structure

1. Pure rule for resolving a line from its candidate matches (item-card barcode, Item Reference
   rows, item number fallback): "Bar Code" rows only, filter by unit, collapse agreeing rows,
   refuse disagreeing ones and other-unit barcodes, never resolve an item with sizes without its
   size; unit tests with the TestDK rows as fixtures.
2. Adapter: read Item Reference rows for a barcode and the item's variants (ids, and whether it has
   any); unit tests against the recorded TestDK response shapes.
3. Submission: send `itemVariantId` on the BC sales line, add the two new line-failure reasons to
   the state contract and the Admin labels; unit and HTTP tests with synthetic BC responses.
4. Docs and registry: `docs/architecture/business-central-order.md` (barcode resolution), an
   `ai/architecture/decisions.md` row for the barcode resolution rule; fix the stale comment in
   `canonical-order-schema.ts` that says nothing resolves from `itemNumber` (the lookup falls back
   to it).
5. After deploy: one order with a size barcode (e.g. `5712094132141`) through the order API into
   the BC test environment; check that the BC sales line has item `HEND-L-MIDNBLUE` and variant `L`.

## Out of scope

- **Size code on shipment notices: follow-up, registered as NIMBUS-231.** Klaus wants the size on
  shipment notices; it is a separate issue because it changes the Logic App contract and should
  not hold up the order-line fix. What the follow-up needs: each shipment notice line gains a
  nullable size (variant code) field next to `item_number`, read from the BC posted shipment line
  (today's shipment line read carries no variant; which BC field exposes it is UNVERIFIED and
  needs a read-only probe). It changes the wire contract
  (`apps/backend/src/modules/order-ingestion/shipment-notice-contract.ts`), the customer-facing JSON
  Schema and the XSD of APIM's XML rendering (originals in `issues/NIMBUS-130/artifacts/`), the
  Logic App mapping, and `docs/architecture/order-api/shipment-notices.md`. Notices already stored
  have no size; whether they stay null or are back-filled is for that issue to decide. Full
  pipeline (order API contract).
- Telling the customer about refused lines through the order API (Klaus: Admin widget is enough).

## Open questions

None open. All answered by Klaus on 2026-10-23.

## Dependencies

- No code dependency: NIMBUS-217 and NIMBUS-130/216 are merged; the line map (NIMBUS-183) is in
  place.
- Related: NIMBUS-129 (order API), NIMBUS-130 (shipment notices), NIMBUS-148 (submission to BC).

## Documentation

- [docs/architecture/business-central-order.md](../../docs/architecture/business-central-order.md) — Business Central order submission, "Item and size resolution" (updated)

AI base files updated: none (the `decisions.md` row was added by task 02)
