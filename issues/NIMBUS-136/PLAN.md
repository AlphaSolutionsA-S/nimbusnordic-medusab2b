# NIMBUS-136: Show order list (BC Orders Page)

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-136

## Objective

Add `/account/bcorders` as a dedicated, company-scoped Business Central order history page with status/date/search filters and default page size 20, while keeping `/account/orders` and its approvals behaviour completely unchanged.

## Analysis

**Existing route and auth pattern** (`apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/`):
The account section uses Next.js 15 parallel slots (`@dashboard` / `@login`). Every child directory becomes a route under `/account/*`. Adding a `bcorders/` directory with `page.tsx` and `loading.tsx` is all that is needed for the new route.

**Company-to-BC customer number resolution** (`apps/backend/src/api/store/approvals/route.ts`):
The approvals route demonstrates the exact `query.graph` traversal pattern — `customer → employee.company.id` — that the BC orders route must follow to derive company scope server-side from `req.auth_context.app_metadata.customer_id`. The `Company` model already carries `business_central_customer_number` (added in NIMBUS-131).

**BC Module service** (`apps/backend/src/modules/business-central/service.ts`):
All OAuth2 / token machinery (private helpers `getDiscoveryUrl`, `getTenantId`, `getClientCredentials`, `requestToken`) already exists. Only a new `listOrders` method needs to be added; it reuses these helpers and calls the BC OData `salesOrders` endpoint with `$filter`, `$top`, `$skip`, `$count=true`, `$orderby`.

**Current BC API middleware** (`apps/backend/src/api/store/business-central/middlewares.ts`):
Authentication on the existing `/store/business-central*` matcher is commented out. The new `/store/bc-orders*` route gets its own dedicated, properly authenticated middleware — the existing BC route is left untouched.

**Storefront data layer** (`apps/storefront/src/lib/data/business-central.ts`):
The file is thin (only `listBusinessCentralOperations`). A `listBCOrders` server action is added following the same pattern as `listOrders` in `orders.ts`.

**Pagination** (`ResourcePagination` component already exists):
The `ResourcePagination` component reads a `pageParam` key from URL search params. BC orders page uses `pageParam="page"`.

**Account nav** (`apps/storefront/src/modules/account/components/account-nav/index.tsx`):
Both mobile and desktop lists need a new `<li>` for `BC Orders → /account/bcorders`, inserted directly after the existing `Orders` item. No `is_admin` gate.

**Out of scope for NIMBUS-136**: BC-backed order detail page is deferred to NIMBUS-137. No "Details" button is rendered on `BcOrderCard`.

## Execution Plan

1. **Task 01 — Backend BC orders endpoint**: Extend `IBusinessCentralModuleService` + `BusinessCentralModuleService` with `listOrders`; add `/store/bc-orders` route, validators, middleware; wire into store middlewares.
2. **Task 02 — Storefront data layer**: Create `types/bc-order.ts`; add `listBCOrders` server action to `lib/data/business-central.ts`.
3. **Task 03 — Storefront UI**: Create `BcOrderCard`, `BcOrderFilters` (client), `BcOrderOverview` components; create `bcorders/page.tsx` and `bcorders/loading.tsx`.
4. **Task 04 — Account nav**: Insert BC Orders links in both mobile and desktop nav lists.

## Decisions & Trade-offs

- **Separate route (`/store/bc-orders`) rather than reusing `/store/business-central/operations`**: The existing operations route has authentication commented out and is not customer-safe. A clean, authenticated, dedicated route avoids touching that route and keeps concerns separate.
- **Auth scope derived server-side only**: Never from client-supplied query/body params, following the established pattern in `approvals/route.ts`.
- **`listOrders` added to the existing BC module service** (rather than a new module): The token acquisition machinery already lives there; adding the method is the minimum change and avoids duplication.
- **No order detail link on `BcOrderCard`**: NIMBUS-137 is the correct place. Deferring prevents a broken link and keeps NIMBUS-136 self-contained.
- **`BCOrderStatus` as a union of string literals** (not an enum): Aligns with the TypeScript style guide in `AGENTS.md` and matches the values BC OData returns.
- **Filters via URL search params** (not hidden state): Preserves shareable/bookmarkable URLs and is consistent with how `ResourcePagination` works.
- **Base branch: `develop`** — per `AGENTS.md` "Default branch: develop".

## Verification

- [ ] `GET /store/bc-orders` returns 401 for unauthenticated requests.
- [ ] `GET /store/bc-orders` returns 400 when company has no `business_central_customer_number`.
- [ ] `GET /store/bc-orders` returns `{ orders, count, offset: 0, limit: 20 }` by default.
- [ ] Status / date / search filters reduce the returned list correctly.
- [ ] Invalid `date_from` format (not YYYY-MM-DD) returns 400 validation error.
- [ ] `cd apps/backend && pnpm build` succeeds.
- [ ] `/account/bcorders` renders with filter controls, populated order list, and pagination.
- [ ] Empty state shows "No company orders found" with filters still visible.
- [ ] Error state shows customer-safe message — no internal details exposed.
- [ ] `ResourcePagination` renders and navigates when `count > 20`.
- [ ] `/account/orders` is entirely unchanged; approvals still appear there.
- [ ] No approvals content appears on `/account/bcorders`.
- [ ] Account nav shows `BC Orders` link (desktop + mobile) pointing to `/account/bcorders`.
- [ ] `BC Orders` nav item is active when browsing `/account/bcorders`.
- [ ] `cd apps/storefront && pnpm build` succeeds.
- [ ] Signed-out users are redirected to account login, not shown the BC orders page.
