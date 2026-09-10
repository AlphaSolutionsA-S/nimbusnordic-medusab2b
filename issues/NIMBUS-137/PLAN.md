# NIMBUS-137: Show order detail

**Status:** In Progress
**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-137

## Objective

Add a read-only, company-scoped Business Central order detail page under the BC orders area and link it from the list.

## Analysis

- The existing BC list route already resolves company scope server-side via `query.graph` from customer to company and reads `business_central_customer_number` from the company record.
- `IBusinessCentralModuleService` currently only exposes `getOperations()` and `listOrders()`; there is no single-order lookup or line-item lookup yet.
- The store middleware matcher for `/store/bc-orders*` already covers subroutes, so the new detail route can reuse the existing customer auth coverage.
- The storefront already has the `/account/bcorders` list page, a matching account layout, and a clean template pattern for read-only order detail rendering.
- The BC sales-order-lines response shape still needs tenant verification, but the required endpoint and query options are fixed by scope.

## Execution Plan

1. Build backend detail support: extend BC types, add `getOrder()` to the BC service, and create `GET /store/bc-orders/[id]` with company-scoped lookup and 404 on mismatch/no match.
2. Add storefront BC order detail types and a `retrieveBCOrder()` data helper that calls the new store route with the Medusa SDK.
3. Create the storefront detail route under `bcorders/[id]` with loading, not-found, and customer-safe error/populated states plus a read-only detail template.
4. Update `BcOrderCard` to add a `Details` link to the new route.

## Decisions & Trade-offs

- Use `/account/bcorders/[id]` instead of a nested `/details/[id]` path to keep the BC list and detail flow in one route family.
- Keep the backend lookup read-only and scope-enforced server-side; do not accept company/customer scope from the client.
- Return a customer-safe not-found state for backend 404 / cross-company mismatch, and a separate generic error state only for unexpected failures.
- Keep BC line-item field mapping narrow until the tenant response is verified.

## Verification

- [ ] `GET /store/bc-orders/:id` returns 401 when unauthenticated.
- [ ] `GET /store/bc-orders/:id` returns 400 when the company has no BC customer number configured.
- [ ] `GET /store/bc-orders/:id` returns 404 for a valid order id from another company.
- [ ] `GET /store/bc-orders/:id` returns order header data and line items for an in-company order.
- [ ] `/account/bcorders/[id]` renders loading, not-found, error, and populated states safely.
- [ ] `BcOrderCard` shows a `Details` link to the new route.
- [ ] `cd apps/backend && pnpm build` succeeds.
- [ ] `cd apps/storefront && pnpm build` succeeds.
