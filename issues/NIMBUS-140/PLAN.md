# NIMBUS-140: Create Return Overview

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-140

> **Reconciled 2026-09-29** against develop after NIMBUS-138 (real BC return integration),
> NIMBUS-170, NIMBUS-163..169 (i18n), NIMBUS-157 and the Medusa 2.21 upgrade. See
> "Reconciliation (2026-09-29)" below. Q1 and Q2 were answered by the user on 2026-09-29 (see
> "Resolved Questions"). **Ready for Dispatch: true.**

## Objective

Let a B2B storefront customer see their company's open (unposted) Business Central returns in a searchable, filterable, paginated Return Overview page in the account area. The page is backed by a new Business Central `listReturns` capability and mirrors the existing BC Orders overview.

## Analysis

The existing `bc-orders` feature (module service, store route, and the storefront `bc-order-overview`/`bc-order-filters`/`bc-order-card`/`resource-pagination` components) is the structural template.

- **BC supports listing returns directly.** `salesReturnOrders` (`Microsoft.NAV.salesReturnOrder`) is in the standard v2.0 metadata (`issues/NIMBUS-129/bc metadata/std odata metadata.xml`). The tenant's Abakion customer-portal API (`issues/NIMBUS-138/abakion api metadata.xml`) exposes it too, with an identical schema.
- **Customer filter:** `salesReturnOrder` has no `customerId`, only `sellToCustomerNumber`. `listReturns` filters on it directly, without the customer-GUID lookup that `listOrders` makes. That is 2 HTTP calls instead of 4 or more.
- **No related order number:** neither metadata file has a source-order field. The user confirmed that BC's External Document No. (`externalDocumentNumber`) holds the portal's `requestId` (`RET-<hash>` from `prepare-bc-return.ts`), not an order number. The column is therefore dropped (Q1).
- **Open returns only:** `salesReturnOrders` contains only unposted return orders, because BC deletes a return order once it is fully received and credited. The list shows open returns only (Q2).
- **Item count:** `$expand=salesReturnOrderLines` on the list query, counting `lineType === "Item"`. This is the same line filter as NIMBUS-138's `prepare-bc-return.ts`.
- **Status values:** BC sends enum members XML-encoded (the existing code handles `"_x0020_"` for `customer.blocked`). `Pending_x0020_Approval` is decoded for display. The storefront filter offers only `Open`/`Released`, just as `bc-order-filters` offers only `Open`/`Draft`.
- **Storefront:** three new components (`bc-return-card`, `bc-return-filters`, `bc-return-overview`), the reused `resource-pagination`, a new `/account/returns` page, and a new **top-level** nav entry.
- **Test infrastructure** exists for both apps. Backend: Jest + `@swc/jest`. Storefront: Jest + RTL, with an automatic `next-intl` mock that reads `messages/en.json`, plus an 8-locale key-parity test (`message-catalogs.test.ts`). The Step 2c gate is satisfied.

## Reconciliation (2026-09-29)

| Area | Original plan (2026-09-15) | Current code on develop | Result |
|---|---|---|---|
| BC create-return | `createReturnFromSalesOrder`/`listReturnReasons` were `STUB (NIMBUS-138 task 09)` | Real: ODataV4 action `CustomerPortalReturns_CreateReturnOrder`; reasons from `CS_EnabledReasonCodes`; `TEMP (NIMBUS-138)` debug logging | **Stale anchors.** Task 01 Edit 3 now anchors on the tail of the real `listReturnReasons` (`return [...reasons.values()];`). Do not touch 138 code. |
| `service.ts` imports | Included `BCGetOrderBySalesOrderIdParams` | Removed by 138; `BCOrderLineReservation` added | **Stale.** Task 01 Edit 1 re-anchored. |
| `types.ts` anchors | `BCReturnReason` → interface; interface tail | Unchanged. `BCGetOrderParams.orderNumber` (170) does not affect this work | Valid. |
| List returns capability | New `listReturns` | Does not exist (138 added no list method) | **Still valid, not duplicated.** |
| Related order number | `externalDocumentNumber`, "pending 138's real integration" | External Document No. holds the portal `requestId`, not an order number (user, 2026-09-29) | **Removed** from types, mapper, UI, translations and tests (Q1). |
| Customer filter | `sellToCustomerNumber`, no GUID lookup | Both metadata files confirm this. `listOrders`/`getOrder` still use `customerId` | Valid. |
| Endpoint | `${discoveryUrl}/salesReturnOrders()` | 138 reads reservations from the Abakion `customerPortal` API | Keep v2.0. The Abakion path is a one-line fallback (Task 01). |
| Status filter | Open, Released, Pending Approval, Pending Prepayment | Enum wire values are XML-encoded | **Changed:** Open/Released only; `_x0020_` decoded in the mapper (new TC-5). |
| Route naming | `GET /store/bc-returns` | 138 added `/store/bc-orders/return-reasons` and `POST /store/bc-orders/:id/returns`. No `/store/bc-returns` | **No collision.** Kept. Nesting under `bc-orders` would clash with `[id]`. |
| Storefront types/data | New `BCReturnList*` types and `listBCReturns` | 138 added `BCReturnOrder`, `BCReturnLine`, `listBCReturnReasons`, `createBCReturn`; no list | Valid. The names do not clash; the anchors are unchanged. |
| Account nav | Top-level "Returns" between BC Orders and Claims | Nav unchanged; no returns entry | Valid. |
| Translations | 5 locales (`en, da, de, fr, it`); anchor `bcOrdersPage` as the last `Account` key | **8** locales (`+ no, pl, sv`); 138 added `Account.bcOrderLineFulfillment` after `bcOrdersPage`; parity test enforced; the NIMBUS-167 script was never built | **Stale.** All catalog edits moved to Task 04 with verbatim strings for 8 locales and new anchors. German uses "Rücksendung(en)" to match 138's copy. |
| Item-count copy | `"{count} items"` | The Jest mock does not evaluate ICU plurals | Changed to `"Items: {count}"` (no plural forms needed, including Polish). |
| Task ordering | Task 04's tests red until Task 05's catalog edits | n/a | **Fixed.** Each task is now green on its own. |
| Backend baseline | "all pre-existing tests pass" | One pre-existing `listOrders` guardrail test fails (reported twice because of the `.medusa/server` copy) | Documented as the known baseline. |
| Medusa 2.21 | n/a | `@medusajs/framework/zod`, `validateAndTransformQuery`, `authenticate` unchanged | Valid. |

## Execution Plan

1. **Backend, module service (Task 01):** Add `listReturns` to `IBusinessCentralModuleService` and `BusinessCentralModuleService`. It queries `salesReturnOrders` filtered by `sellToCustomerNumber` with status, date-range and search filters, uses `$expand=salesReturnOrderLines` for item counts, and decodes `_x0020_` in status values. Add 5 tests to `service.spec.ts`.
2. **Backend, API route (Task 02):** Add `GET /store/bc-returns`, mirroring `GET /store/bc-orders`: the same customer-number resolution, the same 400 when the number is not configured, and the same query validator. Register its middleware and add a validator unit test.
3. **Storefront, types and data layer (Task 03):** Add `BCReturnListItem`/`BCReturnListParams`/`BCReturnListResponse` to `types/bc-order.ts`, and `listBCReturns` to `lib/data/business-central.ts`. Add a new data-layer test.
4. **Storefront, components and translations (Task 04):** Build `bc-return-card`, `bc-return-filters` and `bc-return-overview` with tests. Add all new keys to all 8 locale catalogs.
5. **Storefront, page and nav (Task 05):** Add `/account/returns/page.tsx` and `loading.tsx`, plus a top-level "Returns" nav entry in both nav variants using `UTurnArrowRight`, and tests.

## Resolved Questions (user, 2026-09-29)

- **Q1: related order number.** User's answer: "for the same customer (with requestId stored in External Document No.)".
  - Returns are listed for the same customer through the `sellToCustomerNumber` filter, as planned.
  - BC's External Document No. holds the portal's `requestId` (the `RET-<hash>` idempotency key), **not** a sales order number.
  - The related-order-number field is therefore removed everywhere: the backend and storefront types, the mapper, the card UI, the `relatedOrderLabel` key in all 8 locales, and the tests. All 8 catalogs stay key-identical.
  - `externalDocumentNumber` is not mapped at all.
- **Q2: which returns are listed.** User's answer: "just open".
  - Only unposted (open) return orders from `salesReturnOrders` are listed.
  - There is no posted-return history and no follow-up story for now.
  - **Known limitation, for NIMBUS-141:** BC deletes a Sales Return Order once it is fully received and credited (posted). A return therefore **disappears from this list, and from any detail lookup that reads `salesReturnOrders`, once BC posts or credits it.**

## Dependencies

- **NIMBUS-138:** no code dependency on unmerged work, because all 138 code is already committed on develop. Soft dependencies:
  - 138 is still In Progress on develop and edits the same files (`service.ts`, `types.ts`, `messages/*.json`). Rebase `feature/NIMBUS-140` before merging, and leave 138's `TEMP (NIMBUS-138)` code alone.
  - The sandbox walkthrough should confirm that a return created through 138's flow appears in the list under the number 138 returns.
  - 138's open item "subtract earlier returns from returnable quantities (possible via `salesReturnOrders`)" could later reuse `listReturns`. That is out of scope here.
- **NIMBUS-141:** builds the `/account/returns/{number}` detail page that this list links to.

## Decisions & Trade-offs

- **No customer-GUID lookup for returns.** This deviates from `listOrders` because the metadata schema differs; the code comment explains why.
- **Standard v2.0 `salesReturnOrders`**, keeping the same base URL and scoping as `listOrders`/`getOrder`. The Abakion customer-portal path is a documented one-line fallback that adds a `BUSINESS_CENTRAL_COMPANY_ID` dependency.
- **Status filter limited to `Open`/`Released`.** This avoids unverified XML-encoded filter values. Encoded statuses are still decoded for display.
- **`"Items: {count}"`** instead of an ICU plural, so the Jest `next-intl` mock and Polish plural rules need no special handling.
- **Detail route wired, not built.** `/account/returns/{number}` belongs to NIMBUS-141.
- **Search matches only the return number** (`contains(number, …)`), mirroring `listOrders`.
- **Graceful BC-error handling lives in the storefront page** (try/catch, as in `bcorders/page.tsx`).
- **No related-order column; `externalDocumentNumber` is not mapped** (Q1). It holds the portal `requestId`, and showing it as an order number would mislead customers. It is also not kept as a hidden `requestId` on the backend type, because nothing consumes it yet (no speculative fields). NIMBUS-141 can add it if it ever needs to correlate a return with its portal request. This deliberately deviates from SCOPE.md's "related order number" column.
- **Open returns only** (Q2). This is simpler than a NIMBUS-170-style merge with posted documents. The trade-off is that processed returns vanish from the list.
- **No return-success link.** NIMBUS-138's return form could link to `/account/returns` after it creates a return. That is left out to keep this change surgical; it is a possible follow-up.

## Verification

- [ ] Backend: `cd apps/backend && pnpm test:integration:modules`. The 5 new `listReturns` tests pass (mixed line types, empty page, 500 error, filter composition, encoded status with no lines). The only failures are the known pre-existing `listOrders` guardrail test (x2).
- [ ] Backend: `cd apps/backend && pnpm test:unit`. The 3 new `StoreBCReturnsQuery` tests pass.
- [ ] Storefront: `cd apps/storefront && pnpm test`. The new tests pass for `listBCReturns`, `BcReturnCard`, `BcReturnOverview`, `BcReturnFilters` (options `""`/Open/Released), the Returns page, and the extended `AccountNav` test. `message-catalogs.test.ts` passes (8-locale key parity).
- [ ] `pnpm build` and `pnpm lint` (root) pass.
- [ ] Sandbox smoke test as a B2B customer with a BC customer number:
  - `/account/returns` loads, and search, filter and pagination work.
  - A return just created through NIMBUS-138's form appears with its number, date, status and item count, and no related-order column is shown.
  - A customer with no returns sees the empty state.
  - A simulated BC outage shows the error state.
  - The tenant's v2.0 API serves `salesReturnOrders`; if it does not, switch to the Abakion path.
