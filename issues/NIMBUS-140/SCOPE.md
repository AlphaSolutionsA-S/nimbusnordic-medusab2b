# Create Return Overview

- **Date:** 2026-09-15
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-140
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-140/
- **Size:** M (T-shirt)
- **Area:** Storefront customer account — Business Central returns integration
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-07-09T07:42:00Z

## Background

Customers can already submit a return request against an order (existing `bc-order-return`
flow, backed by the `POST /store/bc-orders/[id]/returns` route and the `create-bc-return`
workflow). However, there is currently no way for a customer to see the returns they have
already submitted. NIMBUS-140 is the "list" half of that gap: a Return Overview page in the
storefront account area where a customer can see all of their submitted returns.

This issue is part of the "Create return" epic (NIMBUS-126), alongside NIMBUS-138 (BC
connection for returns), NIMBUS-139 (create return form), and NIMBUS-141 (return detail /
status view).

## Requirements

### Functional

- Storefront customers can view a list of the returns they have submitted, in their account
  area.
- The list mirrors the existing `bc-order-overview` pattern (same structure as the order
  list), showing per return:
  - Return number
  - Related order number
  - Status
  - Date requested
  - Item count
- The list supports search, filtering, and pagination, consistent with the existing
  `bc-order-overview` / `bc-order-filters` / `resource-pagination` components.
- Each row links out to a return detail page. The detail page itself is built by NIMBUS-141
  (out of scope here) — NIMBUS-140 wires the link/route so it is ready to point at that page
  once it exists.
- An appropriate empty state is shown when a customer has no returns.
- "Returns" is a new top-level entry in the account navigation (matching Business Central's
  own terminology, "Sales Return Order"), not nested under Orders.

### Non-Functional

- The list must paginate rather than loading a customer's full return history at once,
  consistent with the existing order-overview approach.
- BC API errors/timeouts when listing returns should degrade gracefully (consistent with
  existing error handling in the `bc-orders` routes), not crash the account page.

## Affected Apps

- **backend** — The `IBusinessCentralModuleService` interface currently supports
  `listOrders`, `getOrder`, `createReturnFromSalesOrder`, and `listReturnReasons`, but has
  **no method to list a customer's existing returns**. This needs a new capability (e.g.
  `listReturns`) added to the Business Central module/service, plus a new store API route
  (mirroring `GET /store/bc-orders`) that the storefront can call to fetch a customer's
  returns.
- **storefront** — New account UI mirroring the existing order-overview components (e.g.
  `bc-order-overview`, `bc-order-filters`, `bc-order-card`, `resource-pagination`) but for
  returns, plus a new top-level account route/page and navigation entry ("Returns"), plus the
  outbound link/route to the (future) return detail page from NIMBUS-141.

## Reference Material

Business Central's OData metadata (already captured in the repo at
`issues/NIMBUS-129/bc metadata/std odata metadata.xml`) confirms BC's API supports listing
sales return orders directly — this resolves the open question below about whether BC
supports listing vs. needing local persistence in Medusa.

- **EntitySet `salesReturnOrders`** (EntityType `Microsoft.NAV.salesReturnOrder`) — the
  collection to query for the list (metadata around line 10643, EntityType fields around
  lines 6500-6574). Key fields relevant to a list view: `id` (Guid, key), `number`,
  `externalDocumentNumber`, `documentDate`, `postingDate`, `dueDate`, `sellToCustomerNumber`,
  `sellToCustomerName`, `status` (`Microsoft.NAV.salesDocumentStatus`),
  `lastModifiedDateTime`. Has a navigation property `salesReturnOrderLines`
  (`Collection(Microsoft.NAV.salesReturnOrderLine)`) usable for an item/line count.
- **EntitySet `salesReturnOrderLines`** (EntityType `Microsoft.NAV.salesReturnOrderLine`) —
  around line 9374 (set) / 4259-4293 (type). Fields: `id`, `documentType`, `documentNumber`
  (FK back to the return order's `number`), `sequence`, `lineType`, `lineObjectNumber`,
  `description`, `quantity`, `unitPrice`, `lineAmount`, `returnQtyToReceive`,
  `returnQtyReceived`, `lastModifiedDateTime`.
- The new backend `listReturns` method should query `salesReturnOrders` filtered by customer
  (likely via `sellToCustomerNumber`, mirroring however `listOrders` currently filters by
  customer). The implementation planner should check the existing `listOrders` implementation
  in `apps/backend/src/modules/business-central/` to mirror its customer-filtering and
  pagination approach.

## Proposed Structure

High-level task breakdown for implementation planning:

1. **Backend:** Add a `listReturns`-style capability to the Business Central module service
   and its interface; add a new store API route to list returns for the authenticated
   customer's company.
2. **Storefront:** Build the return-overview list UI (search, filter, pagination) mirroring
   the `bc-order-overview` component structure.
3. **Storefront:** Add an account navigation entry for Returns and wire the route/link to the
   per-return detail page (destination page delivered by NIMBUS-141).
4. **Tests:** Backend tests for the new listing capability/route; storefront component tests
   for the new overview components (per project convention, every new component gets a test
   file).

## Open Questions

- None outstanding. (Previously open: whether BC supports listing return orders directly —
  resolved, see "Reference Material" above, BC's `salesReturnOrders` OData entity set
  supports this. Nav placement — resolved, confirmed as a new top-level "Returns" entry.)

## Dependencies

- **NIMBUS-141** ("see existing return status") — builds the return detail page that this
  list will link to. NIMBUS-140 wires the route/link only; the destination page is out of
  scope here.
- **NIMBUS-138** ("Create BC connection for return") and **NIMBUS-139** ("create return
  form") — sibling stories under the same epic; may affect or share the BC connection setup
  this work depends on.
- **NIMBUS-126** ("Create return") — parent epic.
