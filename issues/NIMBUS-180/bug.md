# Order API may not match size-variant EANs to the right Business Central item and variant

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-180
- Severity: Major (suspected; not reproduced)
- Area: Backend, order API submission to Business Central (`apps/backend`, module
  `business-central`, workflow `business-central-order`)
- Reported by: found during NIMBUS-130 scoping (agent, on behalf of Klaus Petersen)
- Reported at: 2026-10-19T00:00:00Z
- Related: NIMBUS-129 (order API), NIMBUS-130 (shipment notices), NIMBUS-148 (send the Medusa order
  to Business Central, where this code was built)

## Summary

When a customer sends an order through the order API, each order line is matched to a Business
Central item by its barcode (EAN). Today the match only looks at the single barcode stored on the item
itself, and the order line sent to Business Central carries no size or variant. A shipment notice from
Metz A/S shows one Business Central item (Henderson Women, Midnight Blue) shipped under three different
barcodes, one per size. For items set up like that, an order line using a size barcode will most likely
either fail to match (the line is left out of the order) or, when the order also carries the item
number, match the item without its size, so Business Central gets the right product in no particular
size.

## Steps to reproduce

Not reproduced. A reproduction needs, in a Business Central sandbox:

1. An item with variants (e.g. sizes) whose EANs are held per variant as item references, not in the
   item's `gtin` field (as `HEND-L-MIDNBLUE` appears to be in production; see Evidence).
2. Submit a canonical order to `POST /orderapi/orders` with one line whose `eanNo` is a variant EAN
   (e.g. `5712094132141`):
   a. with no `itemNumber` / `custItemNo`;
   b. with `itemNumber` set to the parent item number (`HEND-L-MIDNBLUE`).
3. Observe the submission outcome and the Business Central sales order lines.

## Expected

An order line with a variant EAN creates a BC sales line for the right item and the right variant
(`variantCode` set), or the line is rejected with a clear per-line error the customer can act on.
Which of the two is wanted is an open question for the product owner (below).

## Actual (from reading the code; not observed)

- `buildItemLookupCandidates` (`apps/backend/src/modules/business-central/service.ts:189`) tries, in
  order: `eanNo` against the item's `gtin`, then `itemNumber` against the item `number`, then
  `custItemNo` against the item `number`.
- `findItemsByFilter` (`service.ts:1169`) queries the standard API v2.0 `items()` with
  `$filter=gtin eq '<ean>'` (or `number eq …`); `BC_ITEM_SELECT` (`service.ts:181`) reads only
  `id,number,displayName,gtin,baseUnitOfMeasureCode`. Item references and item variants are never
  queried.
- `findItemsForOrderLines` (`service.ts:1235`) takes the first candidate with exactly one match.
- `prepare-bc-order.ts:253-278` (`apps/backend/src/workflows/business-central-order/steps/`) builds
  `BCCreateSalesOrderLineInput` from the match: `itemId`, `quantity`, `unitOfMeasureCode`,
  `shipmentDate`. The type (`apps/backend/src/modules/business-central/types.ts:302`) has no variant
  field, and `buildSalesOrderLineBody` (`service.ts:277`) sends no `variantCode` / `itemVariantId`.

So, for a variant EAN that is not an item `gtin`:

- Case 2a: no match, the line becomes a `not_found` line failure; if every line fails, the
  submission aborts with `no_lines_resolved` (`prepare-bc-order.ts:281`).
- Case 2b: the fallback matches the parent item by number, and BC receives a line for the item with
  no variant. Whether BC then rejects the line (variant mandatory) or accepts a variant-less line is
  UNVERIFIED. If it accepts, this is a silent wrong order.
- If the variant EAN does happen to be some item's `gtin`, behaviour is as today and correct.

## Environment

- OS / runtime: backend on Medusa Cloud; Node 22, Medusa 2.21.0
- Build / commit: `develop` at `49e3751`
- Tenant / data context: Business Central production company used by the order API; customer
  Metz A/S (EDI sender `579000283084`)

## Evidence

- `../NIMBUS-130/samples/metz-desadv-NLF230439.xml` (despatch advice, in the working tree, not yet
  committed): lines 10000, 20000 and 30000 carry EANs `5712094132134`, `5712094132141`,
  `5712094132158`, all with `ItemNo` `HEND-L-MIDNBLUE` (Henderson Women - Midnight Blue). Three EANs on
  one item number means per-variant EANs.
- `../NIMBUS-129/example edi files/order1.xml` and `order2.xml` (Metz ORDERS): every line has a
  size-specific item number (`FLS-NIM-VESPERMNA-XL`, `NKT-NIM-TELLURIDENA-S` / `-M` / `-L` / `-XXL`)
  with its own EAN, and `ItemNo` equals `CustItemNo`. These look like one BC item per size, which the
  `gtin` lookup handles. The samples do not show a variant EAN on an order line, so the bug is not
  demonstrated by an actual order; it depends on Metz ordering variant-modelled items such as
  `HEND-L-MIDNBLUE`.
- Business Central was not called during registration (no read-only check was made).
- Prior notes: `../NIMBUS-130/scope.md` lines 72-74, 154-155 and 524-525.

## Open questions

1. Product owner: for a variant EAN, should the line be resolved to item + variant (preferred), or is
   a clear per-line rejection acceptable?
2. How are variant EANs held in Nimbus's BC: item references (`Item Reference`, type Bar Code) per
   variant, or something else? Which API exposes them (standard v2.0 has `itemVariants` but no item
   references endpoint; may need a custom/OData page)? Check with a GET against the sandbox.
3. Does BC accept a sales line for a variant-tracked item without a variant code, or reject it?
   (Decides whether case 2b is a silent wrong order or a failed line.)
4. Which Metz-ordered items are variant-modelled vs one-item-per-size? Do real Metz orders ever carry
   variant EANs?
5. Shipment notices (NIMBUS-130) need the per-line EAN/variant back; a shared EAN-to-item+variant
   lookup may serve both.

## Analysis

*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
