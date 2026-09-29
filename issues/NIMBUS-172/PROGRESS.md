# Show processed (posted) returns in the return overview

- **Date:** 2026-09-29
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-172
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-172/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage. PostedReturnReceipt access verified
  against TestDK (see FEATURE.md Technical notes). Linked to NIMBUS-140 and NIMBUS-141.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-172 from `issues/NIMBUS-172/FEATURE.md`: extend the
  NIMBUS-140 return overview with posted return receipts from the ODataV4 `PostedReturnReceipt`
  and `PostedReturnReceiptReturnRcptLines` web services, scoped by `Sell_to_Customer_No`,
  de-duplicated against open `salesReturnOrders` via `Return_Order_No`. Resolve the open questions
  (one row per receipt vs grouped per return order, merged vs separate list, which date) with the
  user, and note the dependency on NIMBUS-140 being implemented first. Create SCOPE.md in this
  folder.
