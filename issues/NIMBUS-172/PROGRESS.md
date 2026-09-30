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

- **Date:** 2026-09-30
- **Updated by:** scoper agent
- **Outcome:** Draft scope written to `issues/NIMBUS-172/SCOPE.md`; **awaiting user approval**
  (not approved yet). Clarification answers collected from the user by the main session
  (AskUserQuestion) and relayed to the scoper:
  - Partial receipts: grouped under return order (one row per return order, receipts listed
    under it); a partly received return order stays open and shows its receipts.
  - Layout: same list + filter (combined list, status badge, open/processed filter, like
    NIMBUS-170).
  - Received date: `Document_Date`.
  - Detail page: link to detail; extend the NIMBUS-141 detail page for processed returns and
    posted receipts.
  - Sequencing: wait for NIMBUS-140 to be merged to develop, then branch `feature/NIMBUS-172`
    from develop.
  - Priority: Medium; nothing is waiting on this.
  Remaining open items (see SCOPE.md Open Questions): scope approval, list sort order, posted
  receipts with no matching return order, which item details to show per receipt. Jira not
  touched.
- **Handover to:** user (scope approval), then implementation-planner agent
- **Handover prompt (PENDING USER APPROVAL — do not run until the user approves SCOPE.md):**
  Plan the implementation of NIMBUS-172 from the approved `issues/NIMBUS-172/SCOPE.md`, using
  `issues/NIMBUS-172/FEATURE.md` Technical notes for the Business Central ODataV4 sources
  (`PostedReturnReceipt`, `PostedReturnReceiptReturnRcptLines`, filtered by
  `Sell_to_Customer_No`, matched to open return orders via `Return_Order_No`). Confirm NIMBUS-140
  is merged to develop first and base the work on `feature/NIMBUS-172` from develop. Build on the
  NIMBUS-140 return overview and NIMBUS-141 detail page and follow the NIMBUS-170 combined list +
  filter pattern. SCOPE.md already exists: update it with any planning findings rather than
  creating a new one, and resolve or raise its remaining open questions.
