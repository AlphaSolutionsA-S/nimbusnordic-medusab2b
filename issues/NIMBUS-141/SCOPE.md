# See Existing Return Status (Return Detail Page)

- **Date:** 2026-09-29
- **Status:** Scoped (approved by user 2026-09-29)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-141
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-141/
- **Size:** S
- **Area:** Storefront customer account (Returns), Business Central module
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-07-09T07:42:09Z

## Background

Customers can create a return from a Business Central (BC) order in the portal (NIMBUS-138/139).
NIMBUS-140 adds a Returns overview that lists their open returns. Neither lets a customer open a
single return and see its BC status, the items and quantities it covers, how much has been
received, and how much they can expect to be credited.

NIMBUS-141 is the detail half of the feature. NIMBUS-140's overview already links each row to
`/account/returns/{number}`; this story builds that page. It belongs to the "Create return"
epic (NIMBUS-126).

## Relation to Sibling Issues (avoid duplication)

| Issue | What it owns | What NIMBUS-141 does NOT redo |
|---|---|---|
| NIMBUS-138 / 139 | Creating a return in BC (`CustomerPortalReturns_CreateReturnOrder`) and the return form | No create, edit or cancel. 141 only adds a link from 138's "return created" confirmation. |
| NIMBUS-140 | Returns list (open, unposted `salesReturnOrders`), search/filter/pagination, nav entry, the link to `/account/returns/{number}`, list types, `_x0020_` status decoding | No list, filters or nav. Reuse 140's types and status decoding. |
| NIMBUS-172 | Processed (posted) returns from `PostedReturnReceipt` / `PostedReturnReceiptReturnRcptLines` | No posted data. **NIMBUS-172 should extend this detail page** to show processed returns (decision Q2). |

## Research Findings (BC data)

- **Source:** only the open return order, `salesReturnOrders` with
  `$expand=salesReturnOrderLines`, scoped by `sellToCustomerNumber`. This is the same entity set
  and scoping as NIMBUS-140. BC deletes a return order once it is fully received and credited.
  After that, the page shows the standard not-found state (decision Q2), and NIMBUS-172 takes over.
- **Status enum** `salesDocumentStatus`: `Open`, `Released`, `Pending_x0020_Approval`,
  `Pending_x0020_Prepayment`. These are shown as readable text ("Open", "Released", "Pending
  Approval", "Pending Prepayment"), using the same decoding as NIMBUS-140.
- **Line fields used:** `sequence`, `lineType`, `lineObjectNumber` (item no.), `variantCode`,
  `description`, `unitOfMeasureCode`, `quantity`, `returnQtyReceived`, `returnReasonCode`.
- **Expected credit amount:** neither the standard v2.0 nor the Abakion `salesReturnOrder`
  header exposes a document total. There is no `totalAmountExcludingTax` or
  `totalAmountIncludingTax` field. The header only has `currencyCode` and `pricesIncludingVAT`.
  The expected credit therefore has to be **summed from the lines**:
  - **Incl. VAT** = Σ `amountIncludingTax` over all lines.
  - **Excl. VAT** = Σ `lineAmount` over all lines, which is after the line discount. This is only
    valid when `pricesIncludingVAT` is false. When it is true, `lineAmount` already includes VAT,
    so the excl.-VAT figure must be derived or left out.
  - **Currency** = the header `currencyCode`. An empty value means the company's local currency,
    and the planner must resolve how to display it.
  - Sum all lines that carry amounts, not only `Item` lines, because freight or charge lines can
    be credited too. The planner must verify this, and the exact figures, against a real return
    order in the sandbox.
- **Not shown:** `externalDocumentNumber`, which holds the portal requestId `RET-<hash>`
  (NIMBUS-140 Q1). BC has no field for the source order.

## Requirements

### Functional

- A signed-in B2B customer can open a return at `/account/returns/{number}`, reached from the
  NIMBUS-140 overview or from the NIMBUS-138 "return created" confirmation, and see:
  - the return number and the date it was requested (document date);
  - the **BC status**, shown directly as readable text (for example "Pending Approval"), with no
    customer-friendly relabelling;
  - its lines: description, item number/variant, unit of measure, quantity requested, **quantity
    received so far**, and the return reason. **Line prices are not shown**;
  - the **expected credit amount** for the whole return, with its currency. It is clearly
    labelled as expected, and the page explains that the final amount is set on the credit note.
- Everyone who works for the customer's company can see all of the company's returns. This is
  the same visibility as NIMBUS-140.
- A return number that belongs to another company, does not exist, or has already been
  processed (removed from open return orders) shows a customer-safe "not found" page. The page
  does not disclose whether the return exists.
- A back link to the Returns overview.
- NIMBUS-138's "return created" confirmation links to the new return's detail page, using the
  return number that the create response already returns. There is no link from the order
  detail page.
- If BC is unavailable, the page shows a friendly error state instead of failing the account area.
- All new texts are translated in all 8 storefront locales (`en, da, de, fr, it, no, pl, sv`).

### Non-Functional

- **Security:** authority comes only from the authenticated customer's company, never from the
  URL. Foreign and unknown returns get the same 404 response. BC errors, tokens and internal
  identifiers are never exposed.
- **Performance:** each page load makes one BC data call (header with expanded lines), plus the
  existing token/customer-number resolution.
- **Consistency:** the look and states mirror the BC order detail page `/account/bcorders/[id]`
  (`loading`, `not-found`). Amounts are formatted with the existing storefront money formatting.

## Affected Apps

- **backend** — A new BC module method that fetches one `salesReturnOrder` by number for the
  customer, with its lines, and computes the expected credit totals. A new protected store route
  `GET /store/bc-returns/:number`, next to NIMBUS-140's `GET /store/bc-returns`.
- **storefront** — A new page `/account/returns/[number]` with loading and not-found states, a
  detail template and lines table, an expected-credit summary, the data-layer call and types,
  a link from NIMBUS-138's return confirmation, and translations in 8 locales.

## Proposed Structure

1. **Backend service:** a `getReturn`-style method. Filter `number eq … and
   sellToCustomerNumber eq …` and expand the lines. Map the decoded status, the lines (without
   prices), the expected credit totals (incl./excl. VAT and currency), and `pricesIncludingVAT`
   handling. Add tests.
2. **Backend route:** `GET /store/bc-returns/:number`, with the same customer-number resolution
   and error handling as NIMBUS-140's list route. A return that is not found gives 404. Add tests.
3. **Storefront data layer and types:** `getBCReturn` and the detail types, reusing NIMBUS-140's
   types.
4. **Storefront UI:** the detail page, loading and not-found states, a status badge (raw BC status,
   decoded), a lines table with requested and received quantities, the expected-credit summary
   with an "expected" disclaimer, a back link, and translations in 8 locales. Add tests.
5. **Storefront entry point:** add a link to `/account/returns/{number}` in NIMBUS-138's
   return-created confirmation. Add a test.

## Decisions (user, 2026-09-29)

1. **Status:** show the BC status directly, decoded to readable text. There is no
   customer-friendly mapping for now.
2. **Processed returns:** option A. 141 covers open return orders only. NIMBUS-172 owns processed
   returns and should extend this detail page.
3. **Credit amount:** show the expected credit amount for the return, derived from the return
   order and labelled as expected. The credit memo sets the final amount. Research shows it must
   be summed from the lines (see Research Findings).
4. **Line prices:** not shown; only the expected total from Q3. *The user answered "ja" to "do
   not show line prices". Planning review should confirm that this is the intended meaning.*
5. **Partial receipts:** show only the quantity received per line.
6. **No link to the original order:** accepted.
7. **Visibility:** all employees of the company, the same as NIMBUS-140.
8. **Entry points:** link from NIMBUS-138's "return created" confirmation; no link from the
   order page.

## Open Questions

For the planner to verify, not business questions:

- Verify against a sandbox return order that the line sums (`amountIncludingTax`, `lineAmount`)
  match the totals BC shows on the return order. Check which line types to include and how
  `pricesIncludingVAT = true` affects the excl.-VAT figure. If it cannot be derived reliably,
  show incl. VAT only.
- How to display an empty `currencyCode`, which means the company's local currency.
- Confirm the Q4 interpretation (no line prices) during planning review.

## Dependencies

- **NIMBUS-140** (Ready for Dispatch, not implemented): provides the Returns nav entry, the list
  route and types, status decoding, and the `/account/returns/{number}` link. It must be
  implemented first.
- **NIMBUS-138** (In Progress on develop): creates the returns and owns the confirmation that gets
  the new link. It edits `service.ts`, `types.ts` and `messages/*.json` on develop, so rebase
  before merging and do not touch the `TEMP (NIMBUS-138)` code.
- **NIMBUS-172** (Scoping): owns processed returns and should extend this detail page. Its scope
  should record that.
- **NIMBUS-126** ("Create return"): parent epic.
