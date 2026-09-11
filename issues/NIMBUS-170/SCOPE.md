# Merge Business Central Sales Orders and Sales Invoices in Order History

- **Date:** 2026-09-11
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — [NIMBUS-170](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-170) (child of Epic NIMBUS-125)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-170/
- **Size:** M
- **Area:** Business Central integration — `apps/backend/src/modules/business-central/service.ts`
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-11T00:00:00Z

## Background

The Medusa backend's Business Central (BC) integration module (`apps/backend/src/modules/business-central/service.ts`) exposes `listOrders` and `getOrder`, which the storefront's customer-facing "BC Orders" order-history feature (delivered under NIMBUS-136 "Show order list" and NIMBUS-137 "Show order detail", both children of this same epic, NIMBUS-125 "View order history") uses to show a company's BC order history.

Today `listOrders` queries only the BC `SalesOrders` OData entity set. In Business Central, once a sales order is **fully** invoiced it is removed from `salesOrders` entirely and survives only as one or more `salesInvoices` records (linked back to the original order via `orderId`/`orderNumber`). As a result, `listOrders` silently drops fully-invoiced orders from the customer's order history — customers lose visibility into completed orders once they're fully invoiced. Partially invoiced orders have a related-but-separate problem: the order and its invoice(s) coexist, and today's single-source query only shows the order's own line items, missing the fact that some lines have already moved to an invoice.

This is a proactive data-completeness fix, not a response to an active production incident — no live customer complaint is driving it.

## Requirements

### Functional

- `listOrders` must return a merged, paginated (offset/limit) view of `salesOrders` UNION `salesInvoices`, such that:
  - `salesOrders` (the smaller table) is treated as the **primary/first source** when building a page — the requested window is satisfied from `salesOrders` first, and only the remainder of the page is filled from `salesInvoices`.
  - A commercial order that is **partially** invoiced (i.e. still present in `salesOrders` AND has one or more linked `salesInvoices` rows) must appear **exactly once** in the merged list, represented as the order (not duplicated as a separate invoice line item). Dedup/join is by `salesOrder.number == salesInvoice.orderNumber` — **not** by `id`, since the two entity sets use unrelated GUIDs for `id`.
  - A commercial order that is **fully** invoiced (gone from `salesOrders`) must appear in the merged list, sourced from `salesInvoices`.
- `getOrder` (single-order detail) must, when an order has been partially invoiced, merge line items from **both** the still-open `salesOrder` (`salesOrderLines`) and any related `salesInvoice(s)` (`salesInvoiceLines`), so the customer sees all originally-ordered lines rather than only the remaining open ones. This also implies `getOrder`'s lookup can no longer rely solely on `id eq params.orderId` filtering against one entity set, since the correct join key across sets is order number, not id.

### Non-Functional

- Because BC has no single OData call that pages across two different entity sets with one shared `$top`/`$skip`, later pages (higher `offset`) may legitimately require multiple BC round-trips and be slower than early pages. This is an **accepted tradeoff, not a defect** — it is not in scope to design this away (e.g. no requirement to pre-index or cache all orders for uniform pagination performance).

## Findings

*(Research already performed against `issues/NIMBUS-129/bc metadata/std odata metadata.xml` — EntityType `salesOrder` at line ~2503, `salesInvoice` at ~2014, `salesOrderLine` at ~2589, `salesInvoiceLine` at ~2105, enums `salesOrderEntityBufferStatus` at ~329 and `invoiceEntityAggregateStatus` at ~254. Reproduced verbatim, not re-derived.)*

- **Join key**: `salesOrder.id` and `salesInvoice.id` are unrelated GUIDs. The correct join/dedup key across the two sets is `salesOrder.number == salesInvoice.orderNumber`. `getOrder()` currently filters BC by `id eq params.orderId`, which breaks once an order becomes (fully or partially) represented by an invoice with a different id.
- **Overlap semantics**: partially invoiced order → present in BOTH `salesOrders` and `salesInvoices` (dedup required, order wins as the "shell", but detail must merge lines from both). Fully invoiced order → present ONLY in `salesInvoices`, gone from `salesOrders`.
- **Date field mismatch**: `salesOrder` has `orderDate` (+ `postingDate`); `salesInvoice` has no `orderDate` at all — it has `invoiceDate`, `postingDate`, `dueDate`, `promisedPayDate`. Current code (`service.ts:580`) reads `item.orderDate` directly, which will be `undefined` for invoice-sourced rows.
- **Status enums differ and neither matches today's TS type**: `salesOrder.status` uses `salesOrderEntityBufferStatus` (`Draft`, `In Review`, `Open` — 3 values). `salesInvoice.status` uses `invoiceEntityAggregateStatus` (blank, `Draft`, `In Review`, `Open`, `Paid`, `Canceled`, `Corrective`). The existing `BCOrderStatus` union in `apps/backend/src/modules/business-central/types.ts` (`Open | Released | Pending Approval | Pending Prepayment | Shipped | Invoiced`) doesn't actually match either BC enum's real member names except `Open` — this is a **pre-existing mismatch**, flagged as a finding/risk but **not** in scope to silently fix as part of this feature; called out explicitly so the reader decides.
- **Header fields only on one side**: order-only: `orderDate`, `partialShipping`, `requestedDeliveryDate`, `fullyShipped`. Invoice-only: `invoiceDate`, `dueDate`, `promisedPayDate`, `customerPurchaseOrderReference`, `orderId`, `orderNumber`, `disputeStatusId`, `disputeStatus`, `remainingAmount`.
- **Lines differ**: nav prop names differ (`salesOrderLines` vs `salesInvoiceLines`, different `$expand` path/entity types). `salesOrderLine` carries `shippedQuantity`/`invoicedQuantity`/`shipQuantity`/`invoiceQuantity` (useful for partial-fulfillment display) that `salesInvoiceLine` does not have.
- **Totals can diverge** for the same commercial order (order vs invoice each have their own `totalAmountExcludingTax`/`totalAmountIncludingTax`/`totalTaxAmount` — invoice discounts, partial invoicing, additional charges can make them differ). The merge needs an explicit precedence rule for which total is shown when both an order shell and invoice(s) exist for the same order number.

## Affected Apps

- **backend** — Primary change surface. `apps/backend/src/modules/business-central/service.ts` (`listOrders`, `getOrder`) and `apps/backend/src/modules/business-central/types.ts` (response/type shapes for merged records, header fields, status, dates).
- **storefront** — Conditional. No storefront change is required purely to consume a compatible response shape. However, the storefront already has a real consumer surface for this data (`apps/storefront/src/lib/data/business-central.ts`, `apps/storefront/src/modules/account/components/bc-order-overview/`, `bc-order-filters/`, `apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx`, and the `account/@dashboard/bcorders` pages). If the backend merge introduces new/changed response fields (e.g. a distinct "partially invoiced" status, merged line items with mixed shipped/invoiced quantities, or a note about which total is authoritative), the storefront types and rendering in these files will need corresponding updates so the merge is visible/correct to the customer rather than silently ignored. The implementation planner should confirm exactly which storefront changes are required once the backend response shape is finalized.

## Proposed Structure

Single Story, expected task breakdown:

1. **Backend — merged, paginated `listOrders`**: implement the small-table-first pagination strategy (satisfy the page from `salesOrders`, fill remainder from `salesInvoices`), with dedup by order number so partially invoiced orders appear once.
2. **Backend — merged `getOrder` detail**: change the lookup to resolve by order number across both entity sets (not `id` alone) and merge `salesOrderLines` + `salesInvoiceLines` for partially invoiced orders.
3. **Backend — field mapping fixes**: correct date field usage (`orderDate` vs `invoiceDate`/others) and define an explicit total-amount precedence rule for merged records. Status enum unification is explicitly out of scope (see Open Questions).
4. **Storefront — conditional rendering/type updates**: update `business-central.ts` data layer types and the BC order list/detail/filter components only as needed to reflect any new/changed fields from the backend merge.
5. **Testing**: pagination correctness across a page boundary that spans both entity sets, dedup correctness for partially invoiced orders, merged line items on detail, and slow-tail-page behavior on later offsets.

## Open Questions

- **Status enum unification**: `BCOrderStatus` in `types.ts` doesn't cleanly match either BC status enum. Should this feature introduce a new unified status representation for merged records, or keep passing through the raw source-specific status as-is? Flagged as a risk, not resolved here.
- **Total precedence rule**: when a partially invoiced order has diverging totals between the order shell and its invoice(s), which total is shown as authoritative? Needs a product/business decision before implementation.
- **Storefront UI treatment**: does the customer need an explicit visual indicator of "open" vs "partially invoiced" vs "fully invoiced" status, or is showing the merged line items sufficient? Left to the implementation planner / design to confirm.
- **Multiple invoices per order**: an order can apparently have more than one linked `salesInvoice`. Confirm the merge logic must handle N invoices per order number, not just one.
- **Guardrails on slow tail pages**: the multi-round-trip pagination tradeoff is accepted, but should there be any upper bound (e.g. max BC round-trips per request, timeout, or a documented practical page-depth limit) so a very deep page doesn't degrade the request into an unbounded number of BC calls?

## Dependencies

- **NIMBUS-136** ("Show order list") and **NIMBUS-137** ("Show order detail") — the original stories under this same epic (NIMBUS-125) that implemented today's single-source `listOrders`/`getOrder`. This story is a correctness/completeness follow-up to that existing implementation, not a new feature area.
- **NIMBUS-153** ("Create Medusa module for Business Central connectivity and migrate bc-utility") — the foundational BC integration module this work modifies.
- Explicitly **out of scope**: credit memos, returns, or any other BC entity set beyond `salesOrders` and `salesInvoices`, unless the user says otherwise.
