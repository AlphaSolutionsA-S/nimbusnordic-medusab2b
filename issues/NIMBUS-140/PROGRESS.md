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

- **Date:** 2026-09-29
- **Updated by:** implementation-planner agent (reconciliation)
- **Outcome:** Reconciled the plan with develop after NIMBUS-138 (real BC return action,
  reservations, shipped-only returns; all committed directly on develop), NIMBUS-170,
  NIMBUS-163..169 (8-locale next-intl), NIMBUS-157 and Medusa 2.21. Updated `PLAN.md`
  (new "Reconciliation" table and open questions), `manifest.md`, and task files 01–05.
  - **Still valid:** `listReturns` is still missing, so the plan duplicates nothing that 138
    built. Also valid: the `sellToCustomerNumber` filter without a GUID lookup, the
    `/store/bc-returns` route (no collision with 138's `/store/bc-orders/return-reasons` and
    `/store/bc-orders/:id/returns`), the storefront list types and `listBCReturns`, and the
    top-level "Returns" nav entry.
  - **Stale and fixed:**
    - Task 01: the `service.ts` import anchor (`BCGetOrderBySalesOrderIdParams` removed,
      `BCOrderLineReservation` added) and the `listReturnReasons` anchor (the stub was replaced
      by the real implementation).
    - Translations: 5 locales became 8, and the `Account` insertion anchor moved because
      `bcOrderLineFulfillment` was added. All catalog edits moved from Task 05 to Task 04, so
      each task's tests pass on their own.
    - Status filter: now `Open`/`Released` only, with XML-encoded statuses (`_x0020_`) decoded
      and a new TC-5.
    - Item-count copy: now `"Items: {count}"` (no ICU plural).
    - German term aligned to 138's "Rücksendung".
    - Documented the known pre-existing `listOrders` guardrail test failure (verified on
      develop).
  - **Endpoint:** standard v2.0 `salesReturnOrders`. The Abakion `customerPortal` API has an
    identical schema and is documented as a one-line fallback.
  - **Ready for Dispatch set to false.** Q1: which BC header field
    `CustomerPortalReturns_CreateReturnOrder` writes `sourceOrderNo` into (default
    `externalDocumentNumber`). Q2: accept unposted returns only (BC deletes fully posted return
    orders), with a follow-up story for posted-return history (recommended), or expand scope.
  - **NIMBUS-138 dependency:** none in code. Rebase before merging, because 138 is still editing
    `service.ts`, `types.ts` and `messages/*.json` on develop. Q1 is best answered through 138's
    BC sandbox and BC-team channel.
- **Handover to:** user (answer Q1/Q2), then implementor agent
- **Handover prompt:** After the user has answered Q1 and Q2 in `issues/NIMBUS-140/PLAN.md`
  (with the recommended answers, no task changes are needed) and `manifest.md` shows
  `Ready for Dispatch: true`, implement NIMBUS-140 ("Create Return Overview") from
  `issues/NIMBUS-140/manifest.md` and task files 01–05 in the same folder. Work on
  `feature/NIMBUS-140` from `develop`, in dependency order 01 → 02 → 03 → 04 → 05. Each task
  contains verbatim skeletons and edit anchors verified against develop on 2026-09-29. Task 04
  adds all message keys for all 8 locales (`en, da, de, fr, it, no, pl, sv`), and Task 05 edits
  no JSON. Do not touch NIMBUS-138's `TEMP (NIMBUS-138)` code or the existing
  `listOrders`/`getOrder`/`createReturnFromSalesOrder`/`listReturnReasons` methods. Preserve
  CRLF line endings in the `.ts`/`.tsx` files. The `listOrders` round-trip-guardrail test
  failure in `service.spec.ts` is pre-existing, so do not fix it. Rebase on develop before
  merging. When all tasks are done, run `pnpm build` and `pnpm lint` from the root,
  `cd apps/backend && pnpm test:integration:modules && pnpm test:unit`, and
  `cd apps/storefront && pnpm test`, per the Verification section of PLAN.md.

- **Date:** 2026-09-29
- **Updated by:** implementation-planner agent (open questions resolved)
- **Outcome:** The user answered Q1 and Q2. `PLAN.md` (new "Resolved Questions" section and
  Decisions), `manifest.md`, and tasks 01, 03 and 04 are updated.
  **Ready for Dispatch is now true.**
  - **Q1** ("for the same customer (with requestId stored in External Document No.)"): returns
    are filtered on `sellToCustomerNumber`, as planned. BC's External Document No. holds the
    portal `requestId` (`RET-<hash>` from `prepare-bc-return.ts`), not an order number. The
    related-order-number field is removed from the backend and storefront types, the mapper, the
    card UI and the tests. The `relatedOrderLabel` key is removed from all 8 locale blocks, which
    stay key-identical. `externalDocumentNumber` is not mapped, not even as a hidden `requestId`,
    because nothing consumes it. TC-1 now asserts that it is not mapped, and card TC-4 guards
    that no related-order element is rendered.
  - **Q2** ("just open"): only unposted `salesReturnOrders` are listed, with no posted-return
    history and no follow-up story. The limitation is recorded for NIMBUS-141: a return
    disappears from the list once BC posts or credits it.
  - The status filter stays `Open`/`Released`.
- **Handover to:** implementor agent (not started; awaiting the user's go-ahead)
- **Handover prompt:** Implement NIMBUS-140 ("Create Return Overview") from
  `issues/NIMBUS-140/manifest.md` (`Ready for Dispatch: true`) and task files 01–05 in the same
  folder. Work on `feature/NIMBUS-140` from `develop`, in dependency order
  01 → 02 → 03 → 04 → 05, following each task's verbatim skeletons and verified anchors.
  - There is **no related order number** anywhere. Do not map or display
    `externalDocumentNumber`, which holds the portal `requestId`.
  - Only open (unposted) BC return orders are listed.
  - Task 04 adds all message keys for all 8 locales. Task 05 edits no JSON.
  - Do not touch NIMBUS-138's `TEMP (NIMBUS-138)` code or the existing BC service methods.
  - Preserve CRLF line endings in `.ts`/`.tsx` files.
  - The `listOrders` round-trip-guardrail test failure is pre-existing; do not fix it.
  - Rebase on develop before merging.
  - Finally, run `pnpm build` and `pnpm lint` from the root,
    `cd apps/backend && pnpm test:integration:modules && pnpm test:unit`, and
    `cd apps/storefront && pnpm test`, per the Verification section of PLAN.md.
