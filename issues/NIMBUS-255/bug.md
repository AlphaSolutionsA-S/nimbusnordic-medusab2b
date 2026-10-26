# Order detail: size is missing on invoiced order lines

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-255
- Severity: Medium
- Area: Storefront BC order detail page (`apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx`); backend Business Central order detail read (`apps/backend/src/modules/business-central/service.ts`)
- Reported by: Klaus Petersen
- Reported at: 2026-10-26T15:10:00Z

## Summary
On the order detail page in the customer portal (Business Central orders), the lines of an invoiced
order do not show the size the customer bought. For example, a line on order SO330301 reads
"Franklin Unisex - Grey Melange Franklin Unisex - Grey Melange": the product name is shown twice and
no size. On orders that are not yet invoiced the size appears today only because it happens to be
part of the line text from Business Central (e.g. "Camden Men - Midnight Blue M" on SO347954), not
as its own field.

## Steps to reproduce
1. Log in to the storefront as a user of a company that has invoiced BC orders.
2. Account → Orders → open an invoiced order (e.g. SO330301).
3. Look at the item lines.

## Expected
Every order line, open or invoiced, shows its size as its own field; the product name is not
repeated.

## Actual
- Invoiced order SO330301: "Franklin Unisex - Grey Melange Franklin Unisex - Grey Melange" (no size,
  name duplicated).
- Open order SO347954: "Camden Men - Midnight Blue M" (size only because BC put it in the line
  description).

## Environment
- OS / browser: not stated
- Build / commit: `develop` at `0e0231c`
- Environment (local / staging / production): not stated
- Data context: orders SO330301 (invoiced) and SO347954 (open)

## Evidence
None attached yet. Live BC data not yet read.

## Analysis
Triage reading of the code (not yet checked against live BC responses):

- `apps/backend/src/modules/business-central/service.ts` order detail (~2422–2560): the sales order is
  read with `$expand=salesOrderLines($expand=item,itemVariant)`, invoices with
  `$expand=salesInvoiceLines($expand=item)` — no `itemVariant` on invoice lines.
- `BCSalesInvoiceLineRaw` (~487) has no variant field; `mapSalesInvoiceLine` (~523) and
  `mapSalesOrderLine` (~499) both drop the variant. On sales order lines `itemVariant.code` is used
  only for reservation allocation (~458).
- `BCOrderLine` (`apps/backend/src/modules/business-central/types.ts:18`,
  `apps/storefront/src/types/bc-order.ts:27`) has no size/variant field.
- `bc-order-detail-template.tsx:128-131` renders `[itemDisplayName, description].join(" ")`; on
  invoice lines `description` equals the item display name, hence the duplicate.
- BC API v2 metadata (`issues/NIMBUS-129/bc metadata/std odata metadata.xml` ~2105–2159):
  `salesInvoiceLine` has `itemVariantId` and an `itemVariant` navigation, like `salesOrderLine`.

Proposed direction (for the scoper to confirm): expand `itemVariant` on invoice lines, add a variant
code to `BCOrderLine` in both apps, map it in both mappers, render the size as its own labelled field
(translation key), and show `description` only when it differs from `itemDisplayName`.

Assumption to verify against live BC: the invoice line's `itemVariant.code` is the size (as
`Variant_Code` is for return and shipment lines).

Related: NIMBUS-170 (merge BC sales orders and invoices in order history), NIMBUS-137 (order
detail).
