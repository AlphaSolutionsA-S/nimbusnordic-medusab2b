# NIMBUS-137: Show order detail

**Jira:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-137
**Type:** Story
**Status at scoping:** Scoping
**Assignee at scoping:** Klaus Petersen
**Component:** Customer Portal
**Parent epic:** NIMBUS-125 — View order history
**Related story:** NIMBUS-136 — Show order list (`/account/bcorders`), which explicitly deferred order-detail work to this story.

## Problem statement

Authenticated Customer Portal users can see a company-wide Business Central (BC) order list at `/account/bcorders` (NIMBUS-136), but there is no way to open a single order and see its full detail (line items, addresses, totals). This story adds a read-only BC order detail view reachable from the BC order list.

## Confirmed interview decisions (locked scope)

- **Interaction model: read-only display only.** No reorder, cancel, return, tracking, invoice/PDF download, edit, or any other write/action capability is in scope for this story.
- **Data source:** Business Central order data only, consistent with NIMBUS-136 (no Medusa Store Order detail work here).
- **Visibility:** company-wide — any BC order belonging to the authenticated customer's company can be opened, not only orders placed by that specific user (same authorization model as the NIMBUS-136 list).
- **Entry point:** detail view is reached from the existing `/account/bcorders` list (NIMBUS-136 intentionally shipped without a "Details" link, deferring it here).

## Goals

- Add a read-only BC order detail route/page reachable from `/account/bcorders`.
- Show order header information (order number, date, status, currency, totals) and line items (products/quantities/prices) sourced from Business Central.
- Support loading, not-found/error, and populated states.
- Enforce the same company-scoped, server-derived authorization as the BC order list — never trust client-supplied identifiers for scope.
- Keep Jira business-facing; keep technical depth in `issues\NIMBUS-137\`.

## Non-goals

- Any write/action capability: reorder, cancel, return, tracking updates, invoice/PDF download, editing.
- Medusa Store Order detail changes (existing `/account/orders/details/[id]` stays untouched).
- Changes to the BC order list, its filters, or pagination (NIMBUS-136).
- Checkout, cart, or admin-side changes.

## Current-state findings relevant to scope

- `/account/bcorders` (NIMBUS-136, in progress on `feature/NIMBUS-136`) lists company-wide BC orders via a new protected `GET /store/bc-orders` backend route and `listBCOrders` storefront data helper. `BcOrderCard` explicitly renders **no** "Details" link yet — this story adds it.
- Backend BC access pattern (`apps/backend/src/api/store/bc-orders/route.ts`, `apps/backend/src/modules/business-central/service.ts`) resolves the authenticated customer's company `business_central_customer_number` server-side via `query.graph` and calls the BC OData `salesOrders` endpoint — the same pattern should be reused for a single-order lookup, filtering by `customerNumber` (company scope) and the order `id`/`number` so a customer cannot fetch another company's order by guessing an ID.
- `IBusinessCentralModuleService` currently only exposes `getOperations()` and `listOrders()`; a `getOrder`/`retrieveOrder`-style method and BC order-line lookup do not exist yet.
- The BC `salesOrders` OData entity (Business Central API v2.0) exposes a `salesOrderLines` related collection with item/quantity/price fields; exact field names available in this tenant have not been verified against a live/sandboxed response (same caveat NIMBUS-136 flagged for its own field mapping).
- Existing Medusa order detail pattern (`apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page.tsx` + `OrderDetailsTemplate`) is a useful UI/structure reference (header, line items, addresses, totals) but is bound to Medusa's order shape and must not be reused directly for BC data.
- Account nav currently only needs `BC Orders` pointing at the list (NIMBUS-136); this story does not add a new nav entry — it links from within the list.

## Proposed solution

1. **Backend:** extend `IBusinessCentralModuleService` with an order-detail lookup (e.g. `getOrder(params: { customerNumber, orderId })`) that calls BC OData for a single `salesOrders` record filtered by `id` (or `number`) **and** `customerNumber`, expanding/including line items. Add a new protected store route (e.g. `GET /store/bc-orders/:id`) that:
   - Requires customer authentication (reuse existing `authenticate("customer", ...)` middleware pattern).
   - Resolves the authenticated customer's company `business_central_customer_number` server-side exactly as `bc-orders/route.ts` does.
   - Passes both the resolved `customerNumber` and the requested `id` to the BC service so the OData filter enforces company scope — return 404 if the order does not belong to that company (do not leak existence of other companies' orders).
2. **Storefront data layer:** add a `retrieveBCOrder` (or similarly named) server action in `apps/storefront/src/lib/data/business-central.ts` and a `BCOrderDetail` type in `apps/storefront/src/types/bc-order.ts` (header fields + `lines: BCOrderLine[]`).
3. **Storefront UI:** add a read-only detail route under the `bcorders` segment (e.g. `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx`) with its own `loading.tsx`, plus a dedicated presentational component (e.g. `bc-order-detail-template`) rendering order header info and a line-item table/list. No action buttons/links are rendered anywhere on this page.
4. **Link from list to detail:** update `BcOrderCard` (NIMBUS-136) to render a "Details" link to the new route, using the order `id`.
5. Keep all read-only: no forms, no mutation calls, no reorder/cancel/tracking/invoice actions anywhere in this story's UI.

## UX states

### Loading
- Show a page-level spinner (mirroring `bcorders/loading.tsx`) while the detail fetch resolves.

### Not found / error
- If the order does not exist, or does not belong to the caller's company (403/404 from backend), show a customer-safe "Order not found" state — never reveal whether the order exists for a different company.
- On unexpected backend/network errors, show a customer-safe error message with no internal exception details, tokens, customer IDs, or BC internals exposed.

### Populated
- Show order header (number, date, status, currency, totals).
- Show line items (description, quantity, unit price, line amount) in a table/list.
- Purely informational — no interactive controls beyond navigation back to the list.

## Data/API needs and auth constraints

- **Source of truth:** Business Central order data only (single-order lookup + line items).
- **Auth model:** customer-authenticated request mapped server-side to company scope, identical pattern to NIMBUS-136 — company scope and order identity must both be enforced server-side; the client only supplies the order `id` in the URL.
- **Security:** no client-controlled authority fields for company/customer scope; a request for an order ID outside the caller's company must not succeed or leak existence.
- **Required response fields (header):** order number, order date, status, currency code, totals (excl./incl. tax) — matching the fields already surfaced in the BC order list, plus whatever additional header fields (e.g. addresses) the BC tenant exposes.
- **Required response fields (lines):** item/description, quantity, unit price, line amount at minimum.

## Acceptance criteria

```gherkin
Feature: Read-only Business Central order detail

  Background:
    Given I am browsing the storefront in a supported country
    And I am signed in as a customer linked to a company

  Scenario: Open order detail from the BC order list
    Given I am on `/account/bcorders`
    When I select an order's "Details" link
    Then I am taken to that order's detail page
    And I see the order's header information and line items sourced from Business Central

  Scenario: Detail page is read-only
    Given I am viewing a BC order's detail page
    Then I do not see any reorder, cancel, return, tracking, or invoice-download action
    And no control on the page performs a write/mutating action

  Scenario: Company-scoped access is enforced
    Given an order belongs to a different company than mine
    When I request that order's detail page directly by ID
    Then I see a customer-safe "not found" state
    And no order data for the other company is exposed

  Scenario: Error state is customer-safe
    Given the Business Central order-detail request fails unexpectedly
    When I view the order detail page
    Then I see a customer-safe error message
    And no internal exception details, tokens, or BC internals are shown

  Scenario: Loading state is shown while fetching
    Given the order-detail request has not yet resolved
    When I navigate to the detail page
    Then I see a loading indicator until the content is ready
```

## Technical tasks

### Backend tasks
- Extend `apps/backend/src/modules/business-central/types.ts` with `BCOrderLine`, `BCOrderDetail` (or similar), and a `getOrder`-style method signature on `IBusinessCentralModuleService`.
- Implement the single-order BC OData lookup (with expanded/joined line items) in `apps/backend/src/modules/business-central/service.ts`, reusing the existing token/discovery-URL helpers.
- Add a new protected store route (e.g. `apps/backend/src/api/store/bc-orders/[id]/route.ts`) that resolves company scope server-side (same pattern as `bc-orders/route.ts`) and enforces that the requested order belongs to that company before returning data.
- Return 404 (not 403) when the order does not belong to the caller's company, to avoid confirming existence.
- Add backend tests for auth, not-found/cross-company access, and successful detail retrieval, following existing integration-test patterns.

### Storefront tasks
- Add `BCOrderLine` / `BCOrderDetail` types to `apps/storefront/src/types/bc-order.ts`.
- Add a `retrieveBCOrder`-style server action to `apps/storefront/src/lib/data/business-central.ts`.
- Add `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx` (+ `loading.tsx`) rendering a read-only detail template (header + line items).
- Add a "Details" link on `BcOrderCard` (NIMBUS-136 component) pointing at the new route.
- Implement not-found/error/loading states per the UX states above; no action controls anywhere in this UI.

### Validation tasks
- Verify signed-out users hit the account login flow when navigating to a detail URL directly.
- Verify a signed-in user can open any order belonging to their company (not just their own orders), matching the list's company-wide visibility.
- Verify cross-company order IDs return a customer-safe not-found state, not real data.
- Verify no reorder/cancel/tracking/invoice-download control is rendered anywhere on the page.
- Verify loading/error/populated states render correctly.
- Verify `pnpm build` passes for both `apps/backend` and `apps/storefront`.

## Risks and dependencies

- Depends on `feature/NIMBUS-136` (BC order list, auth pattern, and module service) landing first or being available on the working branch, since this story reuses its backend auth pattern and extends `BcOrderCard`.
- Exact BC `salesOrders`/`salesOrderLines` OData field names and availability (e.g. addresses, discounts) are not yet verified against a live/sandbox response — same class of risk NIMBUS-136 flagged for its own field mapping.
- Must not regress NIMBUS-136's list behavior when adding the "Details" link to `BcOrderCard`.

## Open questions (remaining unresolved only)

1. Exact BC field names/shape for `salesOrderLines` (and any header fields beyond what NIMBUS-136 already fetches, e.g. addresses) need verification against a live BC sandbox response during implementation.
2. Exact detail route path segment (`/account/bcorders/[id]` vs. a `/details/[id]` sub-path mirroring the legacy Medusa orders route) — implementation-planner should confirm against Next.js routing conventions already in use.

## Scoping validation performed

- Reviewed `issues\NIMBUS-136\SCOPE.md`, its manifest, and its implementation task files (backend BC orders endpoint, storefront data layer, storefront UI) since NIMBUS-137 is its explicitly deferred continuation.
- Reviewed the in-progress `feature/NIMBUS-136` working tree (`apps/backend/src/api/store/bc-orders/route.ts`, `apps/backend/src/modules/business-central/{types,service}.ts`, `apps/storefront/src/lib/data/business-central.ts`, `apps/storefront/src/modules/account/components/bc-order-*`) to confirm current BC order data shape and the auth/company-scoping pattern to reuse.
- Reviewed the existing Medusa order-detail route (`apps/storefront/.../orders/details/[id]/page.tsx`) as a structural reference only (not a data-shape source).
- Reviewed `apps/backend/src/api/store/approvals/route.ts` to confirm the standard customer-to-company resolution pattern used across this codebase.
- Applied the explicit interview decision (read-only display only) to lock the non-goals against reorder/cancel/tracking/invoice-download actions.

## Definition of done

- `issues\NIMBUS-137\SCOPE.md` reflects the confirmed interview decision (read-only display only) and codebase-grounded findings above.
- Implementation plan can proceed with a read-only, company-scoped BC order detail view linked from the existing BC order list.
- Remaining open questions are limited to unresolved implementation details (exact BC field mapping, exact route path).
- `issues\NIMBUS-137\PROGRESS.md` includes handover to `implementation-planner`.
