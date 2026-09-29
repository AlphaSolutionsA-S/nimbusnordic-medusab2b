# NIMBUS-141: See Existing Return Status

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-141

> **Status (2026-09-29):** Planned. **Ready for Dispatch: false.** The plan is blocked until
> NIMBUS-140 is implemented and merged, and it is waiting for the user's plan review
> (OQ-1 to OQ-3 below).

## Objective

Let a signed-in B2B customer open one of their company's open Business Central return orders
at `/account/returns/{number}`, and see:

- its BC status;
- its lines, with the quantities requested and received so far;
- the expected credit amount.

The page is reached from the NIMBUS-140 overview and from NIMBUS-138's "return created"
confirmation.

## Analysis

**Architecture:**

```
Storefront (5)  /account/returns/[number]  →  retrieveBCReturn (3)  →  sdk.client.fetch
Backend    (2)  GET /store/bc-returns/:number   (auth: NIMBUS-140's /store/bc-returns* matcher)
Backend    (1)  BusinessCentralModuleService.getReturn  →  BC Abakion customerPortal salesReturnOrders
```

This is a read-only GET that calls the module service directly, with no workflow. That is the
same precedent as `GET /store/bc-orders/:id` and NIMBUS-140's list route.

The planner questions were resolved against the BC TestDK tenant, read-only, on 2026-09-29. We
looked at all 7 open return orders and at BC's own header totals.

- **The endpoint must be Abakion, not standard v2.0.** The standard v2.0 `salesReturnOrderLine`
  has no `variantCode` and no `returnReasonCode` (`$select=variantCode` returns HTTP 400). The
  Abakion `api/abakion/customerPortal/v2.0/companies({id})/salesReturnOrders` lines have both,
  and the headers are identical. The URL is built with the existing `getEnvironmentBaseUrl` and
  `getCompanyId` helpers, the same way NIMBUS-138 reads reservations. A page load is 1 token
  request plus **1** data request.
- **Scoping:** `$filter=number eq '…' and sellToCustomerNumber eq '…'`, `$top=1`.
  - Own return: 1 row. Other customer's number: 0 rows. Unknown number: 0 rows. Escaped quote:
    HTTP 200 with 0 rows.
  - All three "not yours" cases collapse into one 404.
  - `$select` restricts the header to 6 fields, so no addresses and no `externalDocumentNumber`.
- **Expected credit, verified:** for all 7 return orders, Σ line `lineAmount` = BC header
  `Amount`, and Σ line `amountIncludingTax` = BC header `Amount Including VAT`. BC's header
  totals were read from the ODataV4 `salesDocuments` web service. For example, 31502910 is
  1,279.00 / 1,598.75 DKK and 31502905 is 4,143.85 / 4,143.85 SEK.
  - No sales document in the tenant has `pricesIncludingVat = true`, and none has
    `invoiceDiscountAmount > 0`.
  - **Which line types count:** the tenant only has `Item` lines and blank (`_x0020_`) text
    lines. Freight is an `Item` line (`F2` "Small Freight") and is credited. Text lines have
    0 amounts. Summing **all** lines is therefore correct and future-proof.
- **Prices incl. VAT:** when the flag is set, `lineAmount` already contains VAT and the lines
  have no net amount field. The excl.-VAT figure is therefore `null` and the page shows the
  incl.-VAT figure only, as the scope allows.
- **Empty `currencyCode`:** the return orders for LCY customers (4 of 7) send `""`, while v2.0
  `salesOrders` send `"DKK"`. A blank value is resolved to `BUSINESS_CENTRAL_LCY_CODE` (default
  `DKK`), the same rule and environment variable as the existing `resolveCurrencyCode` used by
  company sync. It is then formatted with the existing `convertToLocale`.
- **Text lines:** BC inserts blank-type text lines when it copies posted lines, for example
  "Fakturanr. SIN47206:" or "Leverancenr. 30900312:". They are internal, written in Danish, and
  have no item or quantity, so they are left out of the lines table (OQ-3).
- **Status:** decoded generically (`_xHHHH_` becomes the character), so `Pending_x0020_Approval`
  becomes "Pending Approval". NIMBUS-140's list mapper is switched to the same helper, so list
  and detail show the same text (Q1: raw BC status, no relabelling).
- **Test infrastructure** exists for both apps:
  - Backend: Jest + `@swc/jest`, with module tests in `src/modules/*/__tests__` and unit tests
    `*.unit.spec.ts`.
  - Storefront: Jest + RTL, with an automatic `next-intl` mock that reads `en.json`, and the
    8-locale key-parity test.

## Execution Plan

1. **Backend service (Task 01):**
   - Add `getReturn({ customerNumber, returnNumber })` and the `BCReturnDetail` types.
   - Add helpers: `decodeBCEnumValue`, LCY resolution and rounding.
   - Add the Abakion query and the mapper: lines sorted, text lines dropped, **no line prices**,
     expected credit incl./excl. VAT with the `pricesIncludingVAT` rule.
   - Switch NIMBUS-140's status decoding to the shared helper.
   - Add 6 module tests in a new `get-return.spec.ts`.
2. **Backend route (Task 02):** add `GET /store/bc-returns/:number`.
   - The customer number is resolved from the session only. The route returns 400 when it is not
     configured.
   - Foreign, unknown, processed and over-length (> 20 chars) numbers all get the identical 404.
   - BC errors propagate as a generic 500.
   - Add 5 unit tests.
3. **Storefront data layer (Task 03):** add the `BCReturnDetail*` types and
   `retrieveBCReturn(number)`, which URL-encodes the number, uses `no-store`, and maps 404 to
   `null`. Add 4 tests.
4. **Storefront UI and translations (Task 04):**
   - Add synchronous components `BcReturnLines` and `BcReturnExpectedCredit`, and
     `BcReturnDetailTemplate` (back link, heading, date, status pill, sections).
   - Add all new texts in **8 locales**, hand-written, including the keys Task 05 uses.
   - Add 7 tests, and keep the parity test green.
5. **Storefront page and entry point (Task 05):**
   - Add `returns/[number]/page.tsx`, `loading.tsx` and `not-found.tsx`. `notFound()` is called
     outside the `try/catch`, and a BC failure renders the friendly error state.
   - Add a "View return" link in NIMBUS-138's return-created confirmation.
   - Add 6 tests and a sandbox walkthrough.

**Dependencies:** 01 → 02 → 03 → 04 → 05. Every task is also blocked on the matching NIMBUS-140
task being merged (see `manifest.md`, "External dependencies").

## Decisions & Trade-offs

- **Abakion API instead of v2.0** for the detail, because only it exposes the variant and the
  reason code. NIMBUS-140's list stays on v2.0, which is enough for counting item lines. It
  needs `BUSINESS_CENTRAL_COMPANY_ID`, which NIMBUS-138 already requires.
- **The expected credit is summed from the lines** rather than making a second call to
  `salesDocuments` for BC's header totals. This keeps one data call per page load, and the sums
  were proven equal to BC's totals.
  - Caveat: Σ `lineAmount` is the amount *before* invoice discount. No document in the tenant
    uses invoice discounts, and the incl.-VAT sum is after any discount.
  - The figure is labelled "expected" and carries a disclaimer that the credit note sets the
    final amount.
- **Excl. VAT is `null`** when prices include VAT. No net figure is derived from the tax
  percentage, because BC rounds VAT per document.
- **Blank currency means LCY**, via `BUSINESS_CENTRAL_LCY_CODE` (default `DKK`). The resolution
  is a small module-local helper, because a module must not import the private helper from a
  workflow step. Consolidating it with `resolveCurrencyCode` is a possible follow-up.
- **No per-line prices or amounts anywhere:** not in the backend response, the storefront type
  or the UI (Q4, pending confirmation as OQ-1).
- **The status is shown as the raw decoded BC value** (Q1). The reason is shown as the raw BC
  code (OQ-2).
- **Authentication reuses NIMBUS-140's `/store/bc-returns*` matcher** instead of adding a
  second `authenticate` entry. The route guards the path parameter length at the trust
  boundary.
- **The components are synchronous** (`useTranslations`), so the template can be tested with
  RTL. The components are separate so that NIMBUS-172 can reuse the lines table for posted
  receipts. No speculative open/posted fields are added.
- **The `bcOrderReturn.viewReturnLabel` key and every new namespace** are added in Task 04 at
  stable anchors: inside `bcOrderReturn`, and at the end of `Account`. This avoids depending on
  NIMBUS-140's catalog positions.

## Open Questions (for the user's plan review)

- **OQ-1 (Q4 interpretation, please confirm):** the plan reads "ja" as follows. **No per-line
  unit price, discount or line amount is shown or returned.** The page shows only the whole
  return's expected credit, excl. VAT (when available) and incl. VAT, with its currency. Is that
  the intended meaning?
- **OQ-2 (reason display):** the reason is shown as the BC code, for example `NORMAL`. Showing
  the description would need an extra `CS_EnabledReasonCodes` lookup plus a company-name call
  on every page load. Accept the code for now?
- **OQ-3 (BC text lines):** lines such as "Fakturanr. SIN47206:" (invoice or shipment
  references, in Danish) are hidden. Is that OK, or should they appear as note rows?

## Observations (not fixed; outside this scope)

- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page.tsx`
  calls `notFound()` inside `try/catch`. Because `notFound()` throws, the `catch` swallows it,
  and a missing BC order probably shows "Something went wrong" instead of "Order not found".
  The 141 page avoids this.
- The NIMBUS-140 plan says the Abakion `salesReturnOrder` schema is identical to v2.0. That is
  true for the header, but not for the lines: Abakion adds `variantCode`, `returnReasonCode`
  and `locationCode`. It does not affect NIMBUS-140.
- BC text lines on return orders use the line type `_x0020_`, not `"Comment"` as in NIMBUS-140's
  test fixture. NIMBUS-140 only counts `Item` lines, so this has no effect there.

## Verification

- [ ] Backend `pnpm test:integration:modules`: 6 new `getReturn` tests pass (mapping and
  text-line exclusion, endpoint and scoping, `null`, 500, prices incl. VAT, LCY and rounding).
  NIMBUS-140's `listReturns` tests still pass. The only failure is the known `listOrders`
  baseline (x2).
- [ ] Backend `pnpm test:unit`: 5 new route tests pass (200, 404, over-length 404, 400,
  propagated BC error).
- [ ] Storefront `pnpm test`: the new tests pass for `retrieveBCReturn` (4), `BcReturnLines` (3),
  `BcReturnExpectedCredit` (2), `BcReturnDetailTemplate` (2), the page and not-found (4) and the
  confirmation link (2). `message-catalogs.test.ts` (8-locale parity) passes.
- [ ] `pnpm build` and `pnpm lint` (root) pass.
- [ ] TestDK walkthrough (Task 05, TC-7):
  - Return 31502910 shows 1,279.00 excl. / 1,598.75 incl. DKK, matching BC.
  - "View return" from a new return opens it.
  - A foreign or unknown number shows "Return not found".
  - An unauthenticated API call gets 401.
  - A simulated BC failure shows the error state.
