# NIMBUS-172: Show processed (posted) returns in the return overview

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-172

> **Status (2026-09-30):** Planned. **Ready for Dispatch: false.** The plan is waiting for the
> user's review of OQ-1..OQ-4 below.

## Objective

Make the customer portal's return overview a complete return history:

- open Business Central return orders and processed returns (posted return receipts) appear in
  one list with an open/processed filter;
- the NIMBUS-141 detail page can open processed returns and receipts.

## Analysis

**Architecture:**

```
Storefront (03)  /account/returns?state=       -> listBCReturns    -> sdk.client.fetch
Storefront (04)  /account/returns/[number]     -> retrieveBCReturn -> sdk.client.fetch
Backend (route)  GET /store/bc-returns, GET /store/bc-returns/:number  (auth, session customer no.)
Backend (01)     listReturns  = v2.0 salesReturnOrders  +  ODataV4 PostedReturnReceipt (+ lines per page)
Backend (02)     getReturn    = Abakion salesReturnOrders + ODataV4 PostedReturnReceipt (+ lines)
                 pure merge helpers in modules/business-central/return-history.ts
```

These are read-only GET routes that call the module service directly, with no workflow. This
is the same precedent as NIMBUS-140, NIMBUS-141 and `bc-orders`.

What we found in the current code on develop (NIMBUS-140 `d63ef11`, NIMBUS-141 `b9e751c`):

- **List (`listReturns`)** pages v2.0 `salesReturnOrders` inside BC. It uses `$top`/`$skip`/
  `$count` and BC-side filters for status (`Open`/`Released`), date and number search.
  - BC cannot page across two entity sets.
  - NIMBUS-170 solved this for orders by adding invoice-only rows *after* the open orders, but
    the approved scope requires **latest activity first across both sources**.
  - The plan therefore reads both sources up to a cap and merges, filters, sorts and pages in
    memory. The volumes are small: the test customer has 41 receipts and the tenant has 7 open
    return orders.
- **Detail (`getReturn`)** reads only the Abakion `salesReturnOrders` and returns `null` for
  anything else. Because BC deletes a return order once it is processed, the current route
  returns 404 for every processed return.
- **ODataV4 access** already exists: `getODataV4Url(discoveryUrl, token, resource)` (NIMBUS-138)
  adds `?company='<name>'`, at the cost of one company-name call, and needs
  `BUSINESS_CENTRAL_COMPANY_ID`, which 138 and 141 already require. The field names come from
  FEATURE.md "Technical notes", which were verified against TestDK on 2026-09-29.
- **Existing storefront pieces:**
  - The `bc-return-card` shows the raw BC status pill.
  - The `bc-return-filters` status select sends BC values (`Open`/`Released`).
  - The `bc-return-detail-template` always renders the lines and the expected credit.
  - The NIMBUS-141 not-found copy says "Returns that have been fully processed are no longer
    shown here". That text becomes false with this story.
- **Test infrastructure** exists for both apps, so the Step 2c gate is satisfied.
  - Backend: Jest and `@swc/jest`, module specs in `src/modules/*/__tests__`, route unit specs.
  - Storefront: Jest and RTL, with the `next-intl` auto-mock over `en.json` and the 8-locale
    parity test.
- **Test impact:**
  - The 5 existing `listReturns` tests and the 6 existing `getReturn` tests use order-based
    `fetch` mocks. Those break once the requests run in parallel, so they move to URL-routed
    mocks.
  - The `listReturns` tests move out of `service.spec.ts` into `list-returns.spec.ts`.
- **Catalog editing:** all 8 message catalogs are canonical 2-space JSON (CRLF in this
  checkout, `core.autocrlf=true`). Catalog edits are therefore done with a small EOL-preserving
  Node script, so that exactly the planned keys are added in all 8 files.

## Execution Plan

1. **Task 01, backend list:**
   - Types: `BCReturnState`, `BCReturnSource` and `BCPostedReturnReceiptSummary`, plus
     `state`, `source` and `receipts` on `BCReturnListItem`.
   - New pure `return-history.ts`: `buildReturnListRows`, `filterReturnListRows`,
     `countReceiptItems` and `latestReceivedDate`.
   - Rewrite `listReturns`:
     - open return orders (cap 1000) in parallel with the company name, followed by
       `PostedReturnReceipt` (cap 5000, `$select` of 4 fields);
     - merge, filter, sort and page in memory;
     - then read `PostedReturnReceiptReturnRcptLines` only for the processed rows on the page,
       20 receipt numbers per `or` filter, to get their item count.
   - Validator: `status` is replaced by `state: "open" | "processed"`.
   - About 23 tests.
2. **Task 02, backend detail:**
   - `getReturn` resolves an open return order (with its partial receipts), a processed return
     order (receipts grouped by `Return_Order_No`) or a stand-alone receipt (by receipt number,
     empty `Return_Order_No`).
   - Receipt lines are included, without text or zero-quantity lines and without prices.
   - `expectedCredit` becomes nullable.
   - 7 new tests, 6 migrated tests, and 1 route test.
3. **Task 03, storefront list:**
   - Types and the data layer use `state`.
   - The filter becomes All / Open / Processed.
   - The page validates `state`.
   - The card gets a state badge, keeps the BC status only when it is not "Open", lists the
     grouped receipts, and shows the external ref as plain text.
   - 5 keys in 8 locales.
   - About 11 tests.
4. **Task 04, storefront detail:**
   - New `BcReturnReceipts` component.
   - The template shows a heading per source, the state badge, the order sections only for
     open returns, and a receipts section.
   - The not-found copy is replaced.
   - 8 keys in 8 locales, and 1 changed key.
   - About 9 tests.
   - A TestDK walkthrough.

**Dependencies:** 01 → 02 → 03 → 04, run strictly in order because of shared files.

## Decisions & Trade-offs

- **D1, in-memory merge instead of BC-side paging.**
  - This is required by the approved "latest activity first" sort across two sources.
  - Caps: 1000 open return orders and 5000 receipt headers. A `logger.warn` is written when a
    cap is hit.
  - `count` is exact, which is better than NIMBUS-170's approximation.
  - Cost per list call: token, then (open orders ∥ company name → receipt headers), then 0–n
    line calls. That is 3 sequential stages instead of 1.
- **D2, receipt lines are read only for the processed rows on the current page**, and only to
  compute "Items: n". Open rows keep today's count from their order lines. The detail page reads
  the full line fields.
- **D3, processed item count** is the number of distinct item + variant on received `Item`
  lines (quantity > 0), across the return's receipts. That way an item received over two
  partial receipts counts once. Zero-quantity lines are ignored, because BC copies every order
  line into each partial receipt.
- **D4, filter semantics.**
  - `state` replaces the BC-status filter (`Open`/`Released`). The scope asks for
    all/open/processed, and a BC-status filter would be meaningless for processed rows.
  - Date filters apply to the row's activity date.
  - Search matches the row number *or* any receipt number, so a customer can search for the
    receipt number from their paperwork.
- **D5, row identity.**
  - Open rows keep the BC GUID as `id`.
  - Processed rows use `return-order:<no>` and stand-alone receipts use `posted-receipt:<no>`.
  - `number` is always what the detail URL uses: the return order number, or the receipt
    number for stand-alone receipts.
- **D6, status display.**
  - The translated state badge (Open / Processed) is the primary badge in the list and on the
    detail page.
  - For open returns, the raw BC status (NIMBUS-140/141 Q1) is shown as well, but only when it
    says more than "Open", for example "Released" or "Pending Approval".
  - Processed rows have `status: ""`.
- **D7, detail for processed returns.**
  - There are no order lines and there is no expected credit (`expectedCredit: null`), because
    the return order no longer exists and credit memos are out of scope.
  - The "Requested on" date is hidden, because the receipts carry their own "Received on"
    dates.
- **D8, External ref.**
  - `External_Document_No` is shown only as the "External ref" field, as plain React text, and
    is hidden when it is empty.
  - It is never used as a number, a key or a link.
- **D9, security.**
  - The customer number still comes only from the session (the existing route code).
  - Every header query filters on `Sell_to_Customer_No`.
  - Line queries filter only on receipt numbers that come from those scoped headers.
  - `$select` avoids the names, addresses, phone and e-mail fields.
  - A receipt number whose receipt belongs to a return order returns 404 on its own. It is
    shown under its return order instead.
- **D10, not-found copy.** It is replaced in all 8 locales with "This return is unavailable.
  Check the return number and try again.", because processed returns are now shown.

## Open Questions (for the user's plan review)

- **OQ-1, receipts whose return order no longer exists.**
  - SCOPE.md says that a receipt whose return order number "is empty or does not match a return
    order" becomes its own row. It also says that a return order that is no longer open, but
    has receipts, is one processed row with its receipts grouped under it.
  - BC deletes a return order once it is processed. A non-empty `Return_Order_No` that matches
    no open order is therefore the normal processed case.
  - The plan groups such receipts into **one processed row per return order number**. Only
    receipts with an **empty** `Return_Order_No` become stand-alone rows.
  - **Recommended: accept.** The alternative would make every processed return with several
    receipts show up as several rows.
- **OQ-2, filter replaces the BC status filter.**
  - The Status dropdown becomes All / Open / Processed.
  - The old Open / Released BC-status options disappear, and the backend `status` query param
    is replaced by `state`.
  - **Recommended: accept.**
- **OQ-3, status badge text.**
  - The list and the detail page show "Open" / "Processed" as the badge.
  - For open returns, the raw BC status is added only when it is not "Open" (for example
    "Released"), to avoid "Open Open".
  - **Recommended: accept.** The alternative is to always show both.
- **OQ-4, the processed "Items: n" count.** It counts distinct item + variant that were
  actually received (D3). **Recommended: accept.** The alternative is to count every receipt
  line.

## Risks

- **R1, `or` filter on the ODataV4 lines web service.**
  - The plan filters `PostedReturnReceiptReturnRcptLines` with
    `Document_No eq 'a' or Document_No eq 'b'`. BC supports `or` on the same field, but this
    was not checked against TestDK.
  - Task 04 step 8 verifies it in the sandbox.
  - Fallback, a small change in `fetchPostedReturnReceiptLines`: one request per receipt, in
    parallel.
- **R2, unverified field wire values.**
  - `Type` is assumed to be `"Item"` for item lines and `"_x0020_"` for text lines, the same as
    the v2.0 return order lines.
  - `Line_No`, `Quantity`, `Unit_of_Measure_Code` and `Return_Reason_Code` are the names listed
    in FEATURE.md.
  - The sandbox walkthrough confirms these.
- **R3, list latency.** The list adds 2–3 sequential BC stages (see D1). If it feels slow, a
  follow-up could cache the company name. That is not planned here.

## Observations (not fixed; outside this scope)

- `getODataV4Url` fetches the company name on every call. Caching it would save one round
  trip for the NIMBUS-138, NIMBUS-141 and NIMBUS-172 calls.
- NIMBUS-141's observation still stands: `bcorders/[id]/page.tsx` calls `notFound()` inside
  `try/catch`.

## Verification

- [ ] **Backend module tests** (`pnpm test:integration:modules`):
  - `return-history.spec.ts`:
    - grouping, with no duplicates;
    - partly received orders stay open;
    - processed-only return orders;
    - stand-alone receipts;
    - sort order;
    - state, date and search filters;
    - item count;
    - receipt building.
  - `list-returns.spec.ts`:
    - the merged sorted list;
    - customer scoping and `$select` on both sources;
    - lines only for processed rows on the page;
    - no lines call for an open-only page;
    - paging and count;
    - filters;
    - errors;
    - the empty case;
    - status decoding;
    - escaping and chunking.
  - `get-return.spec.ts`:
    - the 6 migrated cases;
    - open with receipts;
    - processed;
    - stand-alone receipt;
    - a receipt that belongs to a return order gives `null`;
    - scoping and `$select`;
    - the lines request;
    - errors.
  - Only the known `listOrders` baseline fails (x2).
- [ ] **Backend unit tests** (`pnpm test:unit`):
  - the validator `state` cases;
  - the route passes a processed detail through with 200;
  - the existing 404/400/500 cases.
- [ ] **Storefront** (`pnpm test`):
  - the data layer forwards `state`;
  - the filter offers All/Open/Processed and pushes `?state=`;
  - the page validates `state`;
  - the card shows the state badge, shows or hides the BC status, lists grouped receipts, shows
    the stand-alone external ref and hides an empty one, and renders the external ref as plain
    text;
  - the receipts component, the template (open with receipts, processed, stand-alone heading)
    and the detail page render a processed return;
  - the not-found page shows the new copy;
  - `message-catalogs.test.ts` passes (8-locale parity).
- [ ] `pnpm build` and `pnpm lint` (root) pass.
- [ ] **TestDK walkthrough** (Task 04 step 8):
  - the combined list is sorted by latest activity;
  - the filter works;
  - a partial receipt shows under its open return;
  - a processed return and a stand-alone receipt open their detail;
  - the external ref is shown or hidden correctly;
  - a foreign or unknown number gives "Return not found";
  - the `or` filter works (R1).
