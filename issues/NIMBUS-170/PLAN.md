# NIMBUS-170: Merge Business Central Sales Orders and Sales Invoices in Order History

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-170

## Objective

Make the BC order-history feature show every commercial order exactly once — including orders that have become fully invoiced and disappeared from `salesOrders` entirely — by merging `salesOrders` and `salesInvoices` in `listOrders` and `getOrder`.

## Analysis

Confirmed by reading the current implementation (`apps/backend/src/modules/business-central/service.ts`, `types.ts`, `__tests__/service.spec.ts`) and the verified BC OData metadata (`issues/NIMBUS-129/bc metadata/std odata metadata.xml`):

- `listOrders` today queries only `salesOrders`. Once BC fully invoices an order it vanishes from `salesOrders`, so the customer's order history silently loses it. `getOrder` today filters by `id eq params.orderId` against `salesOrders` only — this is fundamentally broken for a merge, because `salesOrder.id` and `salesInvoice.id` are unrelated GUIDs. The only valid cross-entity-set join key is `salesOrder.number == salesInvoice.orderNumber`.
- The storefront's order-detail link (`bc-order-card/index.tsx`) currently routes on `order.id`, and the backend route (`bc-orders/[id]/route.ts`) forwards that value straight into `getOrder({ orderId })`. Once the join key becomes the order number, this link **must** change to use `order.number` — this is a required storefront change, not merely a conditional one, though it is narrowly scoped to one link and one type file.
- The two BC status enums behind `salesOrders`/`salesInvoices` (`salesOrderEntityBufferStatus`: Draft/In Review/Open; `invoiceEntityAggregateStatus`: blank/Draft/In Review/Open/Paid/Canceled/Corrective) are incompatible with each other and with today's `BCOrderStatus` TS union. Unifying them is explicitly out of scope for this story (per the approved scope) — the plan widens `status` to a raw passthrough `string` and adds a separate, additive `invoiceStatus` field (`"open" | "partially_invoiced" | "fully_invoiced"`) to signal merge state without touching the raw-status question.
- **Finding, not fixed:** `service.ts`'s existing `billToPostalCode`/`shipToPostalCode` field names do not match the real BC OData property names (`billToPostCode`/`shipToPostCode` — verified in the metadata). This is a pre-existing bug (order addresses have likely always silently dropped their postal code) that predates this story. It is called out here for visibility but intentionally not fixed — new invoice-mapping code added by this change uses the metadata-correct names since it has no existing convention to preserve.
- BC's OData API has no way to page across two entity sets with one shared `$top`/`$skip`. The accepted design (confirmed against the scope's non-functional requirement) is: `salesOrders`' own `$top`/`$skip` naturally yields fewer rows once a page crosses the end of that table; only then does the code pay for extra BC round trips to fill the remainder from `salesInvoices`, bounded by named guardrail constants (`MAX_INVOICE_FILL_ROUND_TRIPS`, `SALES_ORDER_DEDUP_FETCH_CAP`) so a deep page degrades gracefully (returns a short page) instead of looping unboundedly.
- The pagination `count` returned to the client is an intentional approximation (raw invoice row count, not deduped) to keep the always-on cost of every request low — see Decisions below.
- **Added after initial scoping (confirmed by the user):** besides the merged `lines`, `getOrder`'s response must also expose the original source invoice(s) themselves — e.g. so a split delivery that produced two separate invoices for the same order shows both invoices, not just the merged line items. This lands as a new `BCOrderDetail.invoices: BCOrderInvoiceSummary[]` field (Task 01), populated by `getOrder` (Task 03) at no extra BC round-trip cost, since it reuses the same invoice set already fetched for line-merging. It is detail-only — `listOrders`/`BCOrder` stays cheap and does not carry this.

## Execution Plan

1. **Task 01 (backend, types only):** widen `BCOrder.status` to `string`, add `BCOrderInvoiceStatus`/`invoiceStatus`, add `BCOrderInvoiceSummary`/`BCOrderDetail.invoices`, rename `BCGetOrderParams.orderId` → `orderNumber`. No logic change.
2. **Task 02 (backend):** rewrite `listOrders` to merge `salesOrders` (primary) with `salesInvoices` (fill-in), deduped by order number, with bounded extra round trips on deep pages.
3. **Task 03 (backend):** rewrite `getOrder` to look up by order number across both entity sets in parallel, merge line items for partially-invoiced orders, and populate `invoices` with the source invoice(s); update the one API route caller.
4. **Task 04 (storefront):** point the order-detail link at `order.number` instead of `order.id`; widen the storefront's `BCOrder`/`BCOrderDetail` types to match.

## Decisions & Trade-offs

Each of the scope's open questions got an explicit default call, made because no further product input is expected before implementation. All are easy to revisit later since they are isolated to named constants or single mapping rules:

- **Total precedence (partially invoiced):** the order shell's own totals win over any invoice's totals — the order already reflects the full commercial order while it still exists in `salesOrders`.
- **Multiple invoices per order — list view:** the most recently issued invoice represents a fully-invoiced order's row (cheap, single-pass).
- **Multiple invoices per order — detail view:** all linked invoices' lines are concatenated; totals are summed across them; the order date is taken from the earliest invoice; other header fields from the latest.
- **Status enum unification:** explicitly not done — raw passthrough only, exactly as instructed.
- **Storefront UI treatment of partial/fully invoiced:** no new badge or i18n copy added. `invoiceStatus` is exposed in the type/API for a future story; the primary visibility win (fully-invoiced orders no longer vanish) needs no new UI.
- **Guardrails on slow tail pages:** `SALES_ORDER_DEDUP_FETCH_CAP = 1000` orders, `MAX_INVOICE_FILL_ROUND_TRIPS = 10` × `INVOICE_FILL_BATCH_SIZE = 50` invoices per `listOrders` call; `MAX_ORDER_DETAIL_INVOICES = 50` per `getOrder` call. Exceeding them returns a short page/truncated invoice list rather than failing or hanging.
- **Pagination `count` accuracy:** approximate (raw invoice count, not deduped) — an accepted trade-off for keeping every request's baseline cost fixed and small.
- **Source invoices on the detail (D14):** `getOrder` exposes every linked invoice (id, own document number, date, status, totals) via `BCOrderDetail.invoices`, oldest-to-newest, matching the line-merge order. `[]` when the order has no linked invoices. Detail-only, no extra BC round trip, no new storefront rendering yet (type-only, same as `invoiceStatus`).

## Verification

- [ ] TC: `listOrders` returns unchanged results when a page is fully satisfied by `salesOrders` alone (no extra BC calls beyond the existing 3 + 1 always-on invoices-count call).
- [ ] TC: `listOrders` fills the remainder of a page from `salesInvoices` when `salesOrders` runs out, and a fully-invoiced order appears exactly once.
- [ ] TC: `listOrders` excludes an invoice belonging to an order still open in `salesOrders` from the invoice-only fill (no duplicate row for a partially-invoiced order).
- [ ] TC: `listOrders`' invoice-fill loop respects the round-trip guardrail and terminates even when every batch is fully deduped away.
- [ ] TC: `getOrder` returns `null` when the order number matches neither entity set.
- [ ] TC: `getOrder` returns an open order's lines unchanged when it has no linked invoices.
- [ ] TC: `getOrder` merges `salesOrderLines` + `salesInvoiceLines` for a partially invoiced order, keeping the order shell's totals.
- [ ] TC: `getOrder` builds the full detail (lines, summed totals, earliest order date) from all linked invoices when the order has been fully invoiced.
- [ ] TC: `getOrder`'s `invoices` field lists every linked invoice (id/number/date/status/totals), oldest first, for both a partially-invoiced and a fully-invoiced (multi-invoice split delivery) order; `[]` when there are none.
- [ ] TC: the storefront's order-detail link routes by `order.number` (URL-encoded), not `order.id`.
- [ ] `pnpm build`, `pnpm lint`, and both apps' test suites pass after all four tasks land.
