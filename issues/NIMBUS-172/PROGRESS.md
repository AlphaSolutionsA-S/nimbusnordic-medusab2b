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
  `Sell_to_Customer_No`, matched to open return orders via `Return_Order_No`). NIMBUS-140 is merged
  to develop (`d63ef11`); base the work on `feature/NIMBUS-172` from develop. Build on the
  NIMBUS-140 return overview and NIMBUS-141 detail page and follow the NIMBUS-170 combined list +
  filter pattern. SCOPE.md already exists: update it with any planning findings rather than
  creating a new one, and resolve or raise its remaining open questions.

## 2026-09-30 — Correction: NIMBUS-140 already merged

- **Outcome:** NIMBUS-140 was merged to develop on 2026-09-29 20:57 (`d63ef11`, "Merge branch
  'feature/NIMBUS-140' into develop"). The earlier entry treated it as unmerged. SCOPE.md
  Dependencies and Base Branch are updated, so the sequencing blocker is gone and
  `feature/NIMBUS-172` can branch from develop now. Scope is still a draft awaiting user
  approval.
- **Handover to:** user (scope approval), then implementation-planner agent (prompt above).

## 2026-09-30 — Decisions: receipts without a return order, external ref

- **Outcome:** User decided (main session): posted receipts without a (matching) return order
  are shown as their own processed rows, identified by receipt number, with details from the
  receipt header and lines; `External_Document_No` is shown as a separate "External ref" field,
  never as the return number. SCOPE.md updated. Still open: scope approval, sort order, item
  details per receipt.
- **Handover to:** user (remaining questions and scope approval), then implementation-planner.

## 2026-09-30 — Scope approved

- **Updated by:** main session
- **Outcome:** User approved SCOPE.md. Final answers: sort latest activity first; receipt lines
  show item number, description, quantity, unit of measure, variant and return reason. No open
  questions remain. NIMBUS-140 is merged to develop (`d63ef11`), so nothing blocks this work.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan the implementation of NIMBUS-172 from the approved
  `issues/NIMBUS-172/SCOPE.md`, using the `issues/NIMBUS-172/FEATURE.md` Technical notes for the
  Business Central ODataV4 sources (`PostedReturnReceipt`, `PostedReturnReceiptReturnRcptLines`,
  filtered by `Sell_to_Customer_No`, grouped under open return orders via `Return_Order_No`;
  unmatched receipts become their own processed rows). Base on `feature/NIMBUS-172` from
  develop. Build on the merged NIMBUS-140 return overview and NIMBUS-141 detail page and follow
  the NIMBUS-170 combined list + filter pattern. Write PLAN.md, task files and manifest.md in
  this folder.

## 2026-09-30 — Implementation plan written (awaiting plan approval)

- **Date:** 2026-09-30
- **Updated by:** implementation-planner agent
- **Outcome:** The implementation plan is written but **not approved yet**. Files in
  `issues/NIMBUS-172/`:
  - `PLAN.md`;
  - `manifest.md` (Ready for Dispatch: false);
  - `01-backend-return-list-merge-implementation.md`;
  - `02-backend-return-detail-receipts-implementation.md`;
  - `03-storefront-return-list-implementation.md`;
  - `04-storefront-return-detail-implementation.md`.

  The branch `feature/NIMBUS-172` was created from develop. Nothing is committed and Jira was
  not touched. The test infrastructure gate passed, because both apps already have Jest set up.
  SCOPE.md was not changed.

  Open plan-review questions (PLAN.md "Open Questions"):
  - **OQ-1:** receipts whose return order no longer exists are grouped into one processed row
    per return order number. Only receipts with an empty `Return_Order_No` become stand-alone
    rows.
  - **OQ-2:** the Status filter becomes All/Open/Processed, and `state` replaces the BC-status
    `status` param.
  - **OQ-3:** the state badge is primary, and the raw BC status is shown only when it is not
    "Open".
  - **OQ-4:** the processed "Items: n" counts distinct received item + variant.
- **Handover to:** user (plan approval, OQ-1..OQ-4), then the implementor agent.
- **Handover prompt (PENDING USER APPROVAL — do not run until the user approves PLAN.md):**
  Implement NIMBUS-172 on branch `feature/NIMBUS-172` from the approved plan in
  `issues/NIMBUS-172/`, reading `PLAN.md`, `manifest.md` and the four task files.
  - Run the tasks strictly in order: 01 → 02 → 03 → 04.
  - Keep every task green with its app's tests, `pnpm build` and `pnpm lint`. The known
    backend `listOrders` baseline failure (x2) is expected.
  - Run the translation scripts from the scratchpad and do not commit them.
  - Do not touch NIMBUS-138 code, `listOrders` or `getOrder`.
  - Do the TestDK walkthrough in Task 04 step 8, including risk R1 (the `or` filter on
    `PostedReturnReceiptReturnRcptLines`).
  - Update the task statuses in `manifest.md` and append the outcome to this PROGRESS.md.
  - Do not commit unless the user asks.
