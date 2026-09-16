# NIMBUS-140: Create Return Overview

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-140

## Objective

Let a B2B storefront customer see the returns they've already submitted — a searchable, filterable, paginated Return Overview page in the account area, backed by a new Business Central `listReturns` capability, mirroring the existing BC Orders overview.

## Analysis

The existing `bc-orders` feature (module service, store route, and storefront `bc-order-overview`/`bc-order-filters`/`bc-order-card`/`resource-pagination` components) is a direct structural template for this work. Key findings from exploring the actual code and the BC OData metadata (`issues/NIMBUS-129/bc metadata/std odata metadata.xml`):

- **BC supports listing returns directly.** The `salesReturnOrders` EntitySet (`Microsoft.NAV.salesReturnOrder`) is listable and filterable, confirming the scope's assumption.
- **Filtering is simpler than orders, not just mirrored.** `salesOrder` has a `customerId` (GUID) field, which is why `listOrders` first resolves `customerNumber -> customerId` via a lookup call. `salesReturnOrder` has **no `customerId` field** — only `sellToCustomerNumber` (string), which is directly filterable. `listReturns` therefore skips the customer-GUID lookup entirely (2 HTTP calls instead of `listOrders`' 4+), a deliberate, metadata-verified simplification.
- **"Related order number" has no dedicated BC field.** `salesReturnOrder` has no explicit "source sales order" property. The closest fit is `externalDocumentNumber` (a general external-reference field). The real BC "create return" action (`createReturnFromSalesOrder`) is still a STUB pending NIMBUS-138, so which field it will populate on the created return is not yet confirmed by a real integration. This plan uses `externalDocumentNumber` now, with an explicit code comment flagging it for revisit once NIMBUS-138 lands.
- **Item count** is computed by expanding `salesReturnOrderLines` on the list query and counting only `lineType === "Item"` lines (excluding comment lines), consistent with how `prepare-bc-return.ts` already distinguishes real item lines elsewhere in this module.
- The storefront side is a close mirror of `bc-order-*`: three new components (`bc-return-card`, `bc-return-filters`, `bc-return-overview`) plus the existing generic `resource-pagination` (reused unchanged), a new `/account/returns` page, and a new **top-level** nav entry (not nested under Orders, per explicit requirement — BC calls this "Sales Return Order" but the nav label is simply "Returns").
- Test infrastructure already exists for both apps (backend Jest + `@swc/jest`, storefront Jest + RTL with an automatic `next-intl` mock resolving against `messages/en.json`) — the Step 2c gate was satisfied without needing to scaffold anything.

## Execution Plan

1. **Backend — module service:** Add `listReturns` to `IBusinessCentralModuleService` and `BusinessCentralModuleService`, querying `salesReturnOrders` filtered by `sellToCustomerNumber`, with `status`/date-range/search filters and `$expand=salesReturnOrderLines` for item counts. Extend `service.spec.ts` with 4 new tests.
2. **Backend — API route:** Add `GET /store/bc-returns`, mirroring `GET /store/bc-orders` exactly (same customer-number resolution, same 400-on-missing-config behavior, same query validation shape). Register its middleware. Add a small validator unit test.
3. **Storefront — types & data layer:** Add `BCReturnListItem`/`BCReturnListParams`/`BCReturnListResponse` to `types/bc-order.ts` and a `listBCReturns` SDK wrapper to `lib/data/business-central.ts`, mirroring `listBCOrders`.
4. **Storefront — components:** Build `bc-return-card`, `bc-return-filters` (status options drawn from BC's actual `salesDocumentStatus` enum: Open, Released, Pending Approval, Pending Prepayment), and `bc-return-overview`, each with tests mirroring the existing `bc-order-*` test suites.
5. **Storefront — page & nav:** Add `/account/returns/page.tsx` + `loading.tsx`, add a top-level "Returns" nav entry (both mobile and desktop nav lists) using the existing `UTurnArrowRight` icon, and add translation keys to all 5 locale files (`en`, `da`, `de`, `fr`, `it`) to preserve locale parity.

## Decisions & Trade-offs

- **No customer-GUID lookup for returns** (deviation from `listOrders`'s pattern) — justified directly by the BC metadata schema difference, not a shortcut. Documented in code comments so a future reader doesn't "fix" it back to match `listOrders`.
- **`relatedOrderNumber` sourced from `externalDocumentNumber`** — best available field given current BC metadata; flagged as an assumption to revisit once NIMBUS-138's real `createReturnFromSalesOrder` integration confirms what field it actually populates. Not blocking for NIMBUS-140 since the list must ship against BC's existing, already-populated return orders regardless of how future returns get created.
- **Detail route wired, not built.** `BcReturnCard` links to `/account/returns/{number}`; no `returns/[id]/page.tsx` is created — that's NIMBUS-141.
- **Search matches only the return's own number** (`contains(number, ...)`), mirroring `listOrders`'s minimal search behavior rather than also matching `externalDocumentNumber` — kept deliberately narrow per the "no speculative features" guardrail; easy to extend later if requested.
- **Graceful BC-error degradation lives in the storefront page**, not the backend route — identical to the existing `bcorders/page.tsx` try/catch pattern, satisfying the SCOPE.md non-functional requirement without adding new backend error-handling surface.

## Verification

- [ ] Backend: `cd apps/backend && pnpm test:integration:modules` — 4 new `listReturns` tests pass (happy path with mixed line types, empty page, 500 error, filter composition), all pre-existing `business-central` module tests still pass.
- [ ] Backend: `cd apps/backend && pnpm test:unit` — 3 new `StoreBCReturnsQuery` validator tests pass.
- [ ] Storefront: `cd apps/storefront && pnpm test` — new tests pass for `listBCReturns` (default/partial/full query params), `BcReturnCard` (link correctness, URL-encoding, field rendering, missing-order fallback), `BcReturnOverview` (error/empty states), `BcReturnFilters` (status options), the `Returns` page (heading), and the extended `AccountNav` test (top-level Returns link in both nav variants).
- [ ] `pnpm build` (root) succeeds with no TypeScript errors across both apps.
- [ ] `pnpm lint` (root) passes with no new lint errors.
- [ ] Manual smoke test: as a B2B customer with an existing BC customer number, `/account/returns` loads, search/filter/pagination work, an empty-returns customer sees the empty state, and a simulated BC outage shows the error state instead of crashing the page.
