# NIMBUS-137 Progress

## 2026-07-16 — Scoping complete

**Outcome:** Created implementation-ready scope for Jira story `NIMBUS-137` (`Show order detail`), the story explicitly deferred by `NIMBUS-136` (`Show order list`). Locked the key interview decision — **read-only display only** (no reorder, cancel, return, tracking, or invoice/PDF download) — and grounded the scope in the in-progress `feature/NIMBUS-136` implementation: the existing `GET /store/bc-orders` route, `BusinessCentralModuleService`, `listBCOrders` data helper, and `BcOrderCard`/`BcOrderOverview` components. Documented the proposed single-order BC lookup (backend `getOrder`-style service method + protected route), storefront detail route/template, the "Details" link to be added to `BcOrderCard`, company-scoped/404-on-cross-company authorization requirements, UX states, acceptance criteria, technical tasks, risks, and the two remaining open implementation questions (exact BC line-item field mapping and exact route path segment).

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-137` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-137\SCOPE.md` and produce an implementation plan for the read-only BC order detail story. This story depends on `feature/NIMBUS-136` (BC order list) — investigate its current state in the working tree: `apps\backend\src\api\store\bc-orders\route.ts`, `apps\backend\src\modules\business-central\types.ts`, `apps\backend\src\modules\business-central\service.ts`, `apps\storefront\src\lib\data\business-central.ts`, `apps\storefront\src\types\bc-order.ts`, and `apps\storefront\src\modules\account\components\bc-order-card\index.tsx`. Reuse the same company-scope-resolution auth pattern (see `apps\backend\src\api\store\approvals\route.ts` and `bc-orders\route.ts`) for a new single-order lookup that also enforces the requested order belongs to the caller's company (404, not 403, on mismatch — do not leak existence). Design a storefront detail route (e.g. `apps\storefront\src\app\[countryCode]\(main)\account\@dashboard\bcorders\[id]\page.tsx`) with loading/not-found/error/populated states, a read-only template rendering order header + line items, and a "Details" link added to `BcOrderCard`. Do not implement any reorder/cancel/tracking/invoice-download action — this story is strictly read-only. Keep Jira business-facing and write technical planning only under `issues\NIMBUS-137\`. Do not modify source code during planning.

## 2026-08-14 — BC line endpoint clarified

**Outcome:** Updated `SCOPE.md` to require the supplied Business Central API v2.0 `SalesOrders({salesOrderId})/salesOrderLines()` endpoint, including `$expand=item` and `$orderby=sequence`, with tenant, environment, company, and sales-order identifiers resolved dynamically.

**Next owner:** implementation-planner

**Handover prompt:** Use the fixed sales-order-lines endpoint and query options in the implementation plan; verify only the response field mapping against the BC tenant during implementation.

## 2026-08-14 — Implementation plan drafted

**Outcome:** Created the implementation plan, manifest, and task breakdown for the read-only Business Central order detail story. Confirmed the route family as `/account/bcorders/[id]`, kept the backend lookup company-scoped and read-only, and included loading/not-found/error/populated storefront states.

**Next owner:** implementor

**Handover prompt:** Implement NIMBUS-137 from `issues/NIMBUS-137/manifest.md` and the task files in the same folder. Preserve the locked read-only scope, enforce company-scoped backend lookup with 404 on cross-company mismatch, add the storefront detail route and data helper, and wire the `Details` link into `BcOrderCard`.

## 2026-08-14 — Implementation complete, pending review

**Outcome:** Completed all four NIMBUS-137 implementation tasks. Added a protected, company-scoped `GET /store/bc-orders/:id` endpoint, Business Central order and line-item retrieval, a typed storefront SDK helper that maps only 404 responses to a customer-safe not-found state, a read-only `/account/bcorders/[id]` page with loading/error/not-found/populated states, and a `Details` link from each BC order card. The backend service has focused automated coverage for scoped miss and successful order/line mapping.

**Validation:** Backend focused Jest suite passed (2 tests). `pnpm --dir apps/backend build` completed successfully with 12 pre-existing warnings outside this task. Storefront editor diagnostics are clean for all touched files. Storefront build is blocked before compilation because `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is absent. Direct storefront TypeScript validation reports 8 unrelated existing errors in account-nav tests, profile-card, and cart-drawer; no NIMBUS-137 diagnostics remain.

**Next owner:** reviewer

**Handover prompt:** Review NIMBUS-137 on this branch. Validate the BC line-item field mapping against a real tenant or sandbox response, provide `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, then run `pnpm --dir apps/storefront build` and manually verify authenticated in-company access plus cross-company not-found behavior. Transition Jira NIMBUS-137 to Internal Review when the tracker action is available.

## 2026-08-17 — BC customer identity mapping corrected

**Outcome:** Corrected the Business Central customer identity mapping. The Medusa company `business_central_customer_number` is now used only to find the BC Customer record by its `number`; the resulting BC Customer `id` is used for all existing sales-order filters. Both list and detail lookups return no data when the matching BC Customer cannot be resolved.

**Validation:** Focused `BusinessCentralModuleService` Jest suite passed (3 tests), including list and detail assertions that order filters use the resolved BC Customer ID. `pnpm --dir apps/backend build` completed successfully with 12 unrelated pre-existing warnings.

**Next owner:** reviewer

**Handover prompt:** Verify the `customers()` lookup and `salesOrders.customerNumber` filter against a BC sandbox or tenant. The latter must receive the BC Customer `id`, not the Medusa company’s stored BC customer `number`.

## 2026-08-17 — BC order detail fields expanded

**Outcome:** Added customer name, bill-to address, and ship-to address to the BC order detail response and header. Item lines now carry the expanded item `displayName` and render it with the line description; comment lines render their description across the full item table without quantity or price values.

**Validation:** Focused `BusinessCentralModuleService` Jest suite passed (3 tests). Editor diagnostics are clean for all touched backend and storefront files.

**Next owner:** reviewer

**Handover prompt:** Verify the address field names and `lineType` values against a BC tenant response, including an item line and a comment line.

## 2026-08-17 — BC order-line amount field corrected

**Outcome:** Updated BC order-line mapping to use the tenant-provided `amountExcludingTax` field for the displayed line amount. The previous `lineAmount` field is absent from this tenant's sales-order-line response and caused item amounts to render as zero.

**Validation:** Focused `BusinessCentralModuleService` Jest suite passed (3 tests), including a discounted item case confirming the returned `amountExcludingTax` is used instead of recalculating quantity times unit price.

**Next owner:** reviewer

**Handover prompt:** Verify whether the invoice should display `amountExcludingTax` (current behavior) or `amountIncludingTax` for individual lines in the BC tenant.

## 2026-08-17 - Implementation closed

**Outcome:** Completed and committed the read-only, company-scoped BC order detail flow, including the invoice-style order header, item/comment line handling, and tax-exclusive line and summary amounts.

**Validation:** Focused Business Central service suite passed (3 tests). `pnpm --dir apps/backend build` completed successfully with 12 unrelated pre-existing lint warnings. `git diff --check` passed.

**Next owner:** none

**Handover prompt:** NIMBUS-137 is ready to merge into `develop`; verify the merged commit in the target branch and close the Jira story with its completion comment.

## 2026-08-17 - Merged into local develop

**Outcome:** Cherry-picked the NIMBUS-137 implementation commits into local `develop`, with the completed order detail work ending at commit `0567afd` before this progress update.

**Validation:** The focused Business Central service suite passed (3 tests), backend build completed successfully with only 12 unrelated existing lint warnings, and the diff whitespace check passed.

**Next owner:** release manager

**Handover prompt:** Push local `develop`, add the required Jira completion comment referencing the merge commit, then transition NIMBUS-137 to Done.
