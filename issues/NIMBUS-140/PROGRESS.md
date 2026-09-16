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

- **Date:** 2026-09-15
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. 5 task files
  plus a manifest were written to `issues/NIMBUS-140/` (01–02 backend, 03–05 storefront), plus
  `PLAN.md` for architectural review. No SCOPE.md changes were needed — planning confirmed the
  scope as written; one implementation-detail deviation from `listOrders`' pattern was found
  and documented in the task files and PLAN.md (returns filter directly on
  `sellToCustomerNumber` with no customer-GUID lookup, since `salesReturnOrder` has no
  `customerId` field, unlike `salesOrder`), plus a noted assumption that `relatedOrderNumber`
  is sourced from `externalDocumentNumber` pending NIMBUS-138's real BC integration.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-140 ("Create Return Overview") using the manifest and
  5 task files in `issues/NIMBUS-140/` (`manifest.md`, `01-backend-list-returns-service-implementation.md`,
  `02-backend-bc-returns-route-implementation.md`,
  `03-storefront-return-types-data-layer-implementation.md`,
  `04-storefront-return-overview-components-implementation.md`,
  `05-storefront-returns-page-nav-implementation.md`). Follow the tasks strictly in dependency
  order (01 → 02 → 03 → 04 → 05) — each task file contains verbatim code skeletons, exact
  old/new edit anchors, and test cases, so no source exploration should be needed beyond what's
  already specified. Note the cross-task test dependency called out in Task 04 and in
  `manifest.md`: Task 04's component tests assert real translated copy (via the app's automatic
  `next-intl` mock against `messages/en.json`), which only exists once Task 05's message-file
  edits land — run Task 04 and Task 05 together before treating Task 04's test suite as a final
  gate. After all 5 tasks: run `pnpm build` and `pnpm lint` from the repo root, run
  `cd apps/backend && pnpm test:integration:modules && pnpm test:unit`, and run
  `cd apps/storefront && pnpm test`, per PLAN.md's Verification checklist.
