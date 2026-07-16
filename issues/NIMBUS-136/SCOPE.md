# NIMBUS-136: Show order list

**Jira:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-136  
**Type:** Story  
**Status at scoping:** Scoping  
**Assignee at scoping:** Klaus Petersen  
**Component:** Customer Portal

## Problem statement

Authenticated Customer Portal users need a reliable `/account/bcorders` page that shows their company's order history from Business Central. The current `/account/orders` page is tied to Medusa Store Orders and approvals content; this story should add a dedicated BC history page without replacing that existing UI.

## Confirmed interview decisions (locked scope)

- **Visibility:** show company-wide orders (all orders for the signed-in customer's company).
- **First delivery data source:** **Business Central orders only**.
- **Statuses:** include **all Business Central statuses**.
- **UI capability:** provide **pagination + filters** (status, date, search).
- **Route split:** keep existing `/account/orders` UI unchanged and add a dedicated BC history route at `/account/bcorders`.
- **Navigation:** add a new account navigation entry for `BC Orders` that points to `/account/bcorders`.
- **Pending approvals:** keep approvals on existing `/account/orders`; do not render approvals on `/account/bcorders`.
- **Order details:** BC-backed order details are **out of scope** for `NIMBUS-136`; tracked by **`NIMBUS-137`**.
- **Default page size:** **20**.

## Goals

- Keep `/[countryCode]/account/orders` unchanged as existing orders/approvals UI.
- Add `/[countryCode]/account/bcorders` as the BC company-order history route.
- Show company-wide Business Central orders for the authenticated user's company.
- Support loading, empty, error, and populated states for the order list area.
- Provide status/date/search filters.
- Provide pagination with a default page size of 20.
- Keep Jira business-facing; keep technical depth in `issues\NIMBUS-136\`.

## Non-goals

- Implementing Business Central-backed order details in this story (handled in `NIMBUS-137`).
- Implementing reorder, return, cancellation, tracking, invoice download, or checkout/admin changes.
- Reworking BC-backed order-details flows (handled in `NIMBUS-137`).

## Current-state findings relevant to revised scope

- `/account/orders` exists and currently renders completed orders plus pending approvals.
- Account navigation currently has `Orders` but no `BC Orders` entry.
- Storefront order data helper (`apps\storefront\src\lib\data\orders.ts`) currently uses Medusa `/store/orders`; this does not meet the confirmed BC-only requirement.
- No customer-facing BC order-list route currently exists in backend code.
- Existing BC operations route under `apps\backend\src\api\store\business-central` is not a customer-safe order-history endpoint and must not be reused as-is.

## Proposed solution (re-scoped)

1. Add a new `/account/bcorders` page for protected BC-backed, company-scoped order list.
2. Ensure backend authorization derives company scope from the authenticated customer context (never from client-provided company/customer IDs).
3. Return list payload that supports:
   - all BC statuses;
   - status/date/search filters;
   - pagination metadata (`count`, `offset`, `limit`) with default `limit = 20`.
4. Update storefront `/account/bcorders` UI to:
   - render filter controls (status/date/search);
   - render paginated list states (loading/empty/error/populated).
5. Add a new account nav item labeled `BC Orders` linking to `/account/bcorders`, while keeping existing `Orders` nav target as `/account/orders`.
6. Keep any BC-backed order-details work out of this issue and explicitly defer to `NIMBUS-137`.

## UX states

### Loading
- Keep account shell/nav visible while list content loads.
- Show content-area loading state for list/filter updates.

### Empty
- Show clear empty copy for "no company orders found" under current filters.
- Keep filter controls visible so users can broaden search.

### Error
- Show customer-safe message with retry action.
- Never expose internal exception details, tokens, customer IDs, or BC internals.

### Populated
- Show company order rows/cards sorted newest first by default unless filter/sort rules define otherwise.
- Include status display for all BC statuses.
- Preserve country/account URL context during pagination/filtering.

## Data/API needs and auth constraints

- **Source of truth:** Business Central order data only (for this issue).
- **Auth model:** customer-authenticated request mapped server-side to employee/company scope.
- **Required capabilities:**
  - company-scoped query;
  - status/date/search filtering;
  - offset/limit pagination with default limit 20;
  - response fields required for list presentation.
- **Security:** no client-controlled authority fields for company/customer scope.

## Acceptance criteria

```gherkin
Feature: Company-wide BC order list

  Background:
    Given I am browsing the storefront in a supported country

  Scenario: Authenticated user sees company-wide BC orders
    Given I am signed in as a customer linked to a company
    When I open `/account/bcorders`
    Then I see orders for my company sourced from Business Central
    And I see all applicable BC statuses in the list

  Scenario: Filters are available
    Given I am signed in as a customer linked to a company
    When I open `/account/bcorders`
    Then I can filter by status, date, and search

  Scenario: Pagination uses default page size 20
    Given my company has more than 20 matching orders
    When I open `/account/bcorders`
    Then I see the first page with up to 20 orders
    And I can navigate to additional pages

  Scenario: Existing orders page keeps approvals, BC page does not
    Given my company has pending approvals
    When I open `/account/orders`
    Then I can still see approvals there according to existing behavior
    When I open `/account/bcorders`
    Then I do not see pending approvals on that page

  Scenario: Account navigation includes BC Orders
    Given I am signed in as a customer
    When I view account navigation
    Then I see an item labeled BC Orders
    And it links to `/account/bcorders`

  Scenario: BC-backed order details are out of scope for this story
    Given I am reviewing NIMBUS-136 scope
    Then BC-backed order detail implementation is deferred to NIMBUS-137
```

## Technical tasks

### Backend tasks

- Introduce or adapt a protected customer route/service for company-scoped BC order listing.
- Implement server-side mapping from authenticated customer to company.
- Implement status/date/search filtering.
- Implement pagination (`offset`, `limit`, `count`) with default `limit = 20`.
- Ensure response contract supports storefront list rendering.
- Add backend validation/tests for auth scope and filter/pagination behavior as project patterns allow.

### Storefront tasks

- Implement `/account/bcorders` storefront data/UI path for BC-backed company orders.
- Add status/date/search filter UI.
- Add pagination UI wired to metadata and default page size 20.
- Keep customer-safe loading/empty/error states.
- Add a `BC Orders` account-nav entry that links to `/account/bcorders`.
- Keep `/account/orders` and its approvals behavior unchanged.

### Validation tasks

- Verify signed-out users still hit account login flow.
- Verify signed-in users only see company-scoped BC orders on `/account/bcorders`.
- Verify status/date/search filters work.
- Verify pagination with default size 20.
- Verify `/account/orders` remains unchanged and keeps approvals behavior.
- Verify `/account/bcorders` does not render pending approvals.
- Verify account nav includes working `BC Orders` link.
- Verify no BC-backed detail implementation was introduced in this issue.

## Risks and dependencies

- BC customer/company mapping and query contract must be stable for list/filter pagination.
- Route split requires clear UX copy so users understand `Orders` vs `BC Orders`.
- `NIMBUS-137` dependency: BC-backed order details are intentionally deferred.

## Open questions (remaining unresolved only)

1. For status/date/search filters, what exact BC field mappings and operator semantics should be used (especially date range and status value keys)?

## Scoping validation performed

- Reviewed current `/account/orders` implementation and related data helpers.
- Reviewed backend BC route surface and auth posture for store endpoints.
- Applied explicit interview decisions to replace prior assumptions.

## Definition of done

- `issues\NIMBUS-136\SCOPE.md` reflects confirmed interview decisions above (not assumptions).
- Implementation plan can proceed with BC-only, company-wide list scope.
- Remaining open questions are limited to unresolved implementation details.
- `issues\NIMBUS-136\PROGRESS.md` includes handover to `implementation-planner`.
