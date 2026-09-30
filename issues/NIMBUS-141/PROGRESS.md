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

---

## 2026-09-29 - Plan approved, dispatched to implementor

- **Outcome:** The user approved the plan and answered yes to all three open questions:
  - **OQ-1:** no per-line prices are shown.
  - **OQ-2:** the reason is shown as the BC code.
  - **OQ-3:** BC text lines are hidden.
- NIMBUS-140 is merged to develop (merge d63ef11), so `manifest.md` is set to
  `Ready for Dispatch: true`.
- **Handover to:** implementor agent, using the handover prompt in the previous entry.

---

## 2026-09-29 - Implementation complete, waiting for code review

- **Updated by:** implementor agent (run as a sub-agent).
- **Outcome:** Tasks 01 to 05 are implemented on `feature/NIMBUS-141`, which was created from
  develop at d970e9e (contains the NIMBUS-140 merge d63ef11). The changes are **not committed**.
  All tasks and the manifest are marked DONE.
  - Each task's NIMBUS-140 prerequisite check passed.
  - The edits were applied as written in the task files, with no deviations from the code.
  - No `TEMP (NIMBUS-138)` code was touched. No auth was added for `/store/bc-returns/:number`.
    No `.env` file was written. Jira was not changed.
- **Tests run:**
  - Backend module tests (`TEST_TYPE=integration:modules`, throwaway `postgres:16` container, since
    removed): 176 passed, 2 failed. The 2 failures are the known `listOrders` round-trip
    guardrail baseline (src and `.medusa/server` copies). All 6 new `get-return.spec.ts` tests
    pass, and so do NIMBUS-140's `listReturns` tests.
  - Backend unit tests (`TEST_TYPE=unit`): 99 of 99 passed, including the 5 new route tests.
  - Storefront Jest (full suite): 285 passed, 3 failed. The failures are in `main-layout.test.tsx`
    (1) and `product-tabs/index.test.tsx` (2). They fail the same way with all NIMBUS-141
    storefront changes stashed, so they are pre-existing. All 17 new NIMBUS-141 tests pass
    (4 data layer, 3 lines, 2 expected credit, 2 template, 4 page and not-found, 2 confirmation
    link). The 4 existing `bc-order-return` tests and `message-catalogs.test.ts` (8-locale
    parity) also pass.
  - Backend `pnpm lint`: 0 errors (13 pre-existing warnings, none in touched files).
    Backend `pnpm build`: succeeded.
  - Storefront `pnpm lint`: 0 errors (2 pre-existing warnings). `tsc --noEmit` shows no errors in
    touched files; the pre-existing errors elsewhere are ignored by `ignoreBuildErrors`.
  - Storefront `pnpm build`: compiled successfully, then stopped at "Collecting page data"
    because `categories/[...category]` `generateStaticParams` needs a running backend. This is
    unrelated to NIMBUS-141.
- **Open items:**
  - **TC-7 TestDK walkthrough (Task 05) was not run.** It needs a live BC tenant and a signed-in
    B2B customer. All 5 steps are still open as a manual check, including the 401 check for an
    unauthenticated `/store/bc-returns/<number>` call (Task 02, TC-6).
  - Rebase on develop before merging, because of the NIMBUS-138 overlap.
- **Handover to:** user, for code review, the TC-7 walkthrough and the commit.
- **Handover prompt:** Review the uncommitted NIMBUS-141 changes on `feature/NIMBUS-141`. Run
  the Task 05 TC-7 walkthrough against TestDK and record the results here. Then commit
  following the commit-messages convention, rebase on develop, and move NIMBUS-141 to Internal
  Review.

---

## 2026-09-30 - Code review follow-ups

- **Updated by:** Claude, after the code review.
- **Jira:** NIMBUS-141 assigned to Klaus Petersen and moved Estimation → To Do ("Estimate approved") → In Progress ("Start work").
- **Review result:** no must-fix issues. The one should-fix, plus a date fix the user asked for, are done:
  - **401 test:** `integration-tests/http/security/security-boundaries.spec.ts` now checks that `/store/bc-returns` and `/store/bc-returns/1001` return 401 without customer login.
    - Result: 24/24 pass.
    - With the `/store/bc-returns*` matcher narrowed to `/store/bc-returns`, the detail-route case fails (500 instead of 401), so the test does catch a missing login check.
  - **Missing or invalid document date:** the date now shows as "-" instead of "Invalid Date" on both the return detail template and the return list card (`bc-return-card`). Each component has a test for it; the 2 suites, 9 tests, pass.
- **Accepted as they are:**
  - Dates use en-GB and amounts en-US in every locale, as the existing order and return cards do.
  - The BC status is shown in English.
  - A company without a BC customer number sees the generic error message.
- **Handover to:** user. Next steps:
  1. The TestDK walkthrough (Task 05 TC-7).
  2. Commit, then rebase on develop.
  3. Merge, then move the issue to Internal review.
