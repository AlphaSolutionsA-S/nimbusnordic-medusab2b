# Create Return Overview

- **Date:** 2026-09-15
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-140
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-140/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan the implementation of NIMBUS-140 ("Create Return Overview") based
  on the approved `issues/NIMBUS-140/SCOPE.md` in this same folder. Summary: add a storefront
  Returns overview page (new top-level account nav entry) where customers can search, filter,
  and page through their submitted BC returns, mirroring the existing `bc-order-overview` /
  `bc-order-filters` / `bc-order-card` / `resource-pagination` component pattern in
  `apps/storefront/src/modules/account/components/`, showing return number, related order
  number, status, date requested, and item count, with each row linking to a (future) return
  detail route that NIMBUS-141 will implement. This requires new backend support: the
  `IBusinessCentralModuleService` (`apps/backend/src/modules/business-central/`) currently has
  no way to list existing returns — add a `listReturns`-style method plus a new store API
  route (mirroring `GET /store/bc-orders` / `listOrders`). SCOPE.md's "Reference Material"
  section documents the exact BC OData entities to use: `salesReturnOrders`
  (`Microsoft.NAV.salesReturnOrder`) for the list, filtered by `sellToCustomerNumber`, and
  `salesReturnOrderLines` (`Microsoft.NAV.salesReturnOrderLine`) for item/line counts — mirror
  the existing `listOrders` implementation's customer-filtering and pagination approach.
  NIMBUS-141 (return detail) and NIMBUS-139 (return request form) are explicitly out of scope
  here. Please update the existing SCOPE.md if planning surfaces anything that changes scope,
  rather than creating a new one, and produce the task manifest per the implementation-planner
  workflow.
