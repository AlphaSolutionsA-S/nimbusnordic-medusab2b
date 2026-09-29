# Show processed (posted) returns in the return overview

- **Date:** 2026-09-29
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-172
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-172/
- **Size:** M
- **Area:** Storefront account / returns overview, Business Central module
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-29T12:45:00Z

## Description
The return overview in the customer portal (NIMBUS-140) shows only returns that are still open
in Business Central. Once Business Central has received and processed a return, it disappears
from the list. Customers should also see their processed returns, so the overview is a complete
return history.

## Why
Customers lose track of a return the moment it is processed, which leads to support questions.
The same problem was solved for orders in NIMBUS-170 by also showing invoiced orders.

## Acceptance criteria
- [ ] The return overview shows both open and processed returns for the customer's company.
- [ ] A customer only ever sees returns belonging to their own company.
- [ ] Each processed return shows its number, the date it was received, and its items with quantities.
- [ ] A return that has been processed is not shown twice (once as open and once as processed).
- [ ] The customer can tell open and processed returns apart, and can filter on it.
- [ ] Texts are available in all storefront languages.

## Out of scope
- Credit memos / refund amounts for returns.
- Creating or editing returns (NIMBUS-138/139).

## Open questions
- One return order can produce several posted receipts (partial receipts) — show one row per
  receipt, or group receipts under their return order?
- Should processed returns be merged into the same list as open returns (like NIMBUS-170), or
  shown in a separate section?
- Which date to show as "received": `Posting_Date` or `Document_Date`?

## Mockups / references
- NIMBUS-140 return overview (open returns only).
- NIMBUS-170 merged sales orders + invoices in order history (pattern to follow).

## Technical notes
Verified read-only against the TestDK environment on 2026-09-29 with the existing BC app
registration (no extra permissions needed):

- **Source:** ODataV4 web service `PostedReturnReceipt` (headers) and
  `PostedReturnReceiptReturnRcptLines` (lines), same ODataV4 base path and `company='<name>'`
  parameter that NIMBUS-138 uses for `CustomerPortalReturns_CreateReturnOrder`
  (`BusinessCentralService.getODataV4Url`). Not in the Abakion customer-portal API, which only
  exposes open `salesReturnOrders`.
  - `GET {env}/ODataV4/PostedReturnReceipt?company='Nimbus Nordic A/S'&$filter=Sell_to_Customer_No eq '<customerNo>'` → HTTP 200.
  - `GET {env}/ODataV4/PostedReturnReceiptReturnRcptLines?company=...` → HTTP 200.
- **Customer scoping:** `$filter=Sell_to_Customer_No eq '...'` works (41 rows for a test
  customer, all matching).
- **Useful header fields:** `No`, `Sell_to_Customer_No`, `Return_Order_No` (links back to the open
  return order number, e.g. `31500002`), `External_Document_No`, `Posting_Date`, `Document_Date`.
  Header rows also carry names, addresses, phone and e-mail — select only needed fields (`$select`).
- **Useful line fields:** `Document_No` (receipt no.), `Line_No`, `Type`, `No`, `Variant_Code`,
  `Description`, `Quantity`, `Unit_of_Measure_Code`, `Return_Reason_Code`, `Quantity_Invoiced`.
- **De-duplication:** `Return_Order_No` identifies which open return order a receipt belongs to.
  Several receipts can share one `Return_Order_No` (partial receipts), and a partially received
  return order can still be open.
- **External_Document_No:** empty on older data; historic manual returns carry free text like
  `AX 209475`. Portal returns carry the `RET-<hash>` requestId (NIMBUS-138). Do not display it
  as an order number.
