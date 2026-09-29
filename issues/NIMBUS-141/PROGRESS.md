# See Existing Return Status (Return Detail Page)

- **Date:** 2026-09-29
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-141
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-141/
- **Updated by:** scoper agent (run as sub-agent; no interactive interview possible)
- **Outcome:** Draft scope written to `issues/NIMBUS-141/SCOPE.md`. Scope is **not approved**.
  The Jira description is empty, so 8 business questions are open, each with a recommended
  default (status labels; processed-return handling (recommended: open returns only, with
  NIMBUS-172 extending the page); credit info; prices; partial receipts; source-order link;
  visibility; entry points). Jira was not changed. Step 6c (filling the empty Jira
  description) is still to be done after approval.
- **Handover to:** user (answer the Open Questions in SCOPE.md and approve the scope), then the
  scoper, to update the Jira description, then the implementation-planner agent.
- **Handover prompt:** Once the user has answered the Open Questions in
  `issues/NIMBUS-141/SCOPE.md`, approved the scope, and the Jira description has been filled in,
  plan NIMBUS-141 ("See Existing Return Status") from the approved `SCOPE.md` in this folder.
  Update that SCOPE.md rather than creating a new one if planning changes the scope.
  - **What to build:** a return detail page at `/account/returns/[number]`, the destination of
    NIMBUS-140's overview links. It shows the return number, requested date, a customer-friendly
    status (derived from the BC `salesDocumentStatus` plus `returnQtyReceived`), and the item
    lines with requested and received quantities and the return reason.
  - **Backend:** a new BC module method that fetches one `salesReturnOrder` by number, scoped by
    `sellToCustomerNumber`, with `$expand=salesReturnOrderLines`. Expose it through a protected
    `GET /store/bc-returns/:number` route, where a foreign or unknown return gives 404.
  - **Storefront:** the page with loading and not-found states, mirroring
    `/account/bcorders/[id]`, and translations in all 8 locales.
  - **Build on NIMBUS-140:** reuse its types, status decoding and route
    (`issues/NIMBUS-140/PLAN.md`). 140 must be implemented first.
  - **Do not duplicate NIMBUS-172:** posted/processed returns via `PostedReturnReceipt` belong to
    172 unless the user chose Q2 option B.
  - **Constraints:** do not show `externalDocumentNumber`, which holds the portal requestId.
    Rebase on develop and do not touch the `TEMP (NIMBUS-138)` code.

- **Date:** 2026-09-29
- **Updated by:** scoper agent
- **Outcome:** Scope approved. The user answered all 8 open questions, and `SCOPE.md` is updated
  and marked Scoped (approved) — see its "Decisions" section.
  - Show the raw BC status, decoded to readable text.
  - Open return orders only. NIMBUS-172 extends this page for processed returns.
  - Show an expected credit amount, labelled as expected, and no line prices. Confirm the no-line-prices reading in planning review.
  - Show the received quantity per line. No link to the original order. Visible to all company employees.
  - Link from NIMBUS-138's "return created" confirmation.
  - Research finding: the BC return-order header has no total fields, so the expected credit is summed from the lines (Σ `amountIncludingTax`; Σ `lineAmount` excl. VAT when `pricesIncludingVAT` is false), with the header `currencyCode`.

  The empty Jira description was filled in (Background / Goal / Scope, with a link to SCOPE.md).
  The Jira status is unchanged. Nothing was committed.
- **Handover to:** implementation-planner agent (not started; waiting for the user's go-ahead)
- **Handover prompt:** Plan NIMBUS-141 ("See Existing Return Status") from the approved
  `issues/NIMBUS-141/SCOPE.md` in this folder. Update that SCOPE.md rather than creating a new one
  if planning changes the scope.
  - **What to build:** the return detail page `/account/returns/[number]`, the destination of
    NIMBUS-140's overview links.
  - **Backend:** a BC module method that fetches one open `salesReturnOrder` by `number`, scoped by
    `sellToCustomerNumber`, with `$expand=salesReturnOrderLines`. Expose it through a protected
    `GET /store/bc-returns/:number`. A return that is foreign, unknown or already processed gives
    404.
  - **The page shows:**
    - the number and document date;
    - the decoded BC status (reuse NIMBUS-140's `_x0020_` decoding);
    - the lines: description, item/variant, unit of measure, quantity, `returnQtyReceived` and
      return reason, with no prices;
    - an expected-credit summary summed from the lines (Σ `amountIncludingTax` incl. VAT; Σ
      `lineAmount` excl. VAT, only when `pricesIncludingVAT` is false), with the currency from
      `currencyCode`, clearly labelled as expected.
  - **Before designing the totals:** verify the line sums, the line types to include, and the
    empty-currency display against a sandbox return order.
  - **Also build:** loading, not-found and error states that mirror `/account/bcorders/[id]`, a
    back link, and a link from NIMBUS-138's return-created confirmation. Add translations in all
    8 locales and tests for every new component and route.
  - **Build on NIMBUS-140** (`issues/NIMBUS-140/PLAN.md`), which must be implemented first.
  - **Do not duplicate NIMBUS-172:** it owns posted/processed returns. Do not show
    `externalDocumentNumber`. Do not touch the `TEMP (NIMBUS-138)` code. Rebase on develop.

- **Date:** 2026-09-29
- **Updated by:** implementation-planner agent (run as a sub-agent; the plan review goes to the
  user through the calling agent)
- **Outcome:** The implementation plan is ready and waiting for the user's plan review.
  `PLAN.md`, `manifest.md` and five task files (`01`–`05-*-implementation.md`) were written.
  **Ready for Dispatch: false**, for two reasons: NIMBUS-140 (a hard prerequisite) is not
  implemented or merged yet, and the user still needs to approve the plan and answer OQ-1 to
  OQ-3.
  - **Planner questions, resolved read-only against TestDK** (7 open return orders):
    - Σ `lineAmount` / Σ `amountIncludingTax` over all lines equal BC's header Amount / Amount
      Incl. VAT. Freight is an `Item` line; blank `_x0020_` text lines have 0 amounts and are
      hidden.
    - Excl. VAT is `null` when `pricesIncludingVAT` is true. No such document, and no invoice
      discount, exists in the tenant.
    - A blank `currencyCode` (LCY customers) is resolved to `BUSINESS_CENTRAL_LCY_CODE`
      (default DKK).
  - **Detail endpoint:** the Abakion `customerPortal` `salesReturnOrders`. The standard v2.0
    lines lack `variantCode` and `returnReasonCode`.
  - **Open for the user:**
    - OQ-1: confirm that Q4 means no per-line prices.
    - OQ-2: show the reason as the BC code.
    - OQ-3: hide BC text lines.
  - Nothing was committed and Jira was not changed.
- **Handover to:** user (plan review), then the implementor agent, once NIMBUS-140 is merged to
  develop.
- **Handover prompt:** Implement NIMBUS-141 ("See Existing Return Status") from
  `issues/NIMBUS-141/`: `manifest.md`, `PLAN.md` and tasks `01`–`05-*-implementation.md`, in
  order 01 → 05.
  - **Before starting:**
    - Confirm that `manifest.md` says `Ready for Dispatch: true`. That requires NIMBUS-140 to be
      merged to develop and the user to have approved the plan (OQ-1 to OQ-3).
    - Create `feature/NIMBUS-141` from an up-to-date develop.
  - **Per task:**
    - Run the NIMBUS-140 prerequisite check at the top of the task file, and stop if it fails.
    - Apply the edits exactly as written.
    - Run the task's tests, `pnpm build` and `pnpm lint`.
  - **Constraints:**
    - Do not touch `TEMP (NIMBUS-138)` code.
    - Do not add authentication for `/store/bc-returns/:number`; NIMBUS-140's matcher covers it.
    - Keep the 8 locale catalogs key-identical.
    - Preserve line endings: CRLF for `.ts`/`.tsx`, LF for `messages/*.json`.
  - **Finish with the TestDK walkthrough** in Task 05, TC-7, and record the results here.
