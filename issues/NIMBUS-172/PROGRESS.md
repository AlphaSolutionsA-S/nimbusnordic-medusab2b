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

## 2026-09-30 — Implementation plan approved

- **Date:** 2026-09-30
- **Updated by:** implementation-planner agent
- **Outcome:** The user approved the implementation plan. The main session relayed the answer:
  "all oq are approved and good choices you made". The implementation plan is ready;
  implementation is the next stage.

  Decisions:
  - **OQ-1:** receipts are grouped into one processed row per non-empty `Return_Order_No`.
    Only receipts with an empty `Return_Order_No` become stand-alone rows.
    - This narrows the approved SCOPE.md wording ("empty or does not match a return order"),
      and the user approved the change.
    - It is recorded in PLAN.md "Resolved Questions". SCOPE.md is not edited, because it has
      uncommitted user changes.
  - **OQ-2:** the Status filter becomes All/Open/Processed, and `state` replaces the BC-status
    `status` param.
  - **OQ-3:** the Open/Processed state badge is primary, and the raw BC status is shown only
    for open returns whose status is not "Open".
  - **OQ-4:** the processed "Items: n" counts distinct received item + variant.

  PLAN.md and the four task files record these decisions, and `manifest.md` is set to Ready for
  Dispatch: true. Nothing is committed and Jira was not touched.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-172 on branch `feature/NIMBUS-172`, which already
  exists and is created from develop, from the approved plan in `issues/NIMBUS-172/`. Read
  `PLAN.md`, `manifest.md` and the four task files.
  - Run the tasks strictly in order: 01 → 02 → 03 → 04.
  - Keep every task green with its app's tests, `pnpm build` and `pnpm lint`. The known
    backend `listOrders` baseline failure (x2) is expected.
  - Run the translation scripts from the scratchpad and do not commit them.
  - Do not touch NIMBUS-138 code, `listOrders` or `getOrder`.
  - Do not discard or overwrite the user's uncommitted edits to
    `issues/NIMBUS-140/PROGRESS.md`, `issues/NIMBUS-172/PROGRESS.md` and
    `issues/NIMBUS-172/SCOPE.md`.
  - Do the TestDK walkthrough in Task 04 step 8, including risk R1 (the `or` filter on
    `PostedReturnReceiptReturnRcptLines`).
  - Update the task statuses in `manifest.md` and append the outcome to this PROGRESS.md.
  - Do not commit unless the user asks.

## 2026-09-30 — Implementation complete (TestDK walkthrough not done)

- **Date:** 2026-09-30
- **Updated by:** implementor agent
- **Outcome:** Tasks 01, 02, 03 and 04 are implemented on `feature/NIMBUS-172`, in order. Each
  task was validated before the next one started. `manifest.md` and the task files are updated:
  01, 02 and 03 are DONE. 04 is "DONE (TestDK walkthrough pending)". Nothing is committed, and
  Jira was not touched.
  - **Backend:**
    - `listReturns` merges open return orders with `PostedReturnReceipt`, adds the `state`
      filter, and reads receipt lines only for the processed rows on the page.
    - `getReturn` resolves open return orders, processed return orders and stand-alone
      receipts.
    - The new pure helpers are in `return-history.ts`.
  - **Storefront:**
    - state badge, All/Open/Processed filter, grouped receipts and external ref on the list card;
    - new `BcReturnReceipts` component, and the detail template for processed returns and
      receipts;
    - the new not-found copy;
    - 5 + 8 new keys and 1 changed key in all 8 catalogs.
- **Validation** (final runs, Windows, PowerShell, pnpm 9.15.0 via corepack):
  - **Test environment:** the shell had no `pnpm` on PATH. I used `corepack pnpm` and put
    corepack shims in the session scratchpad on PATH, so that turbo could find `pnpm`. The
    following values were set in the shell only, the same as NIMBUS-140/141. No `.env` file was
    written.
    - `BUSINESS_CENTRAL_DISCOVERY_URL`: a dummy TestDK-shaped URL for the integration-test guard;
    - a dummy `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`;
    - `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` for a throwaway `postgres:16`
      container (`nimbus172-test-pg`), which is now stopped and removed.
  - `cd apps/backend && pnpm test:integration:modules`: 224 passed, 2 failed (22 suites). The
    2 failures are the known `listOrders` baseline (the src and `.medusa/server` copies):
    `BusinessCentralModuleService.listOrders › stops filling from salesInvoices after the
    round-trip guardrail even if the page stays short` fails with
    `TypeError: Cannot read properties of undefined (reading 'ok')` at `service.ts:1920`.
    - All new and migrated tests pass: `return-history.spec.ts`, `list-returns.spec.ts` and
      `get-return.spec.ts`.
  - `cd apps/backend && pnpm test:unit`: 19 suites, 110 of 110 passed.
  - `cd apps/backend && pnpm build`: backend and admin built successfully.
    - `medusa build` does not report type errors, so I also ran `npx tsc --noEmit -p .`. It
      reports errors only in pre-existing `integration-tests/` files (18 errors in 6 files).
      None are in changed code.
  - `cd apps/storefront && pnpm test`: 161 suites, 362 of 365 passed. The 3 failures are the
    known pre-existing ones, which were also recorded in NIMBUS-140:
    - `product-tabs` (x2): "A React Element from an older version of React was rendered";
    - `main-layout`: "Unable to find an element with the text: Build your own B2B store with
      this starter:".
    - `message-catalogs.test.ts` and all new and changed tests pass.
  - `cd apps/storefront && pnpm build`: the app compiled successfully. It then failed at
    "Collecting page data" (`Failed to collect page data for /[countryCode]/collections/[handle]`
    or `/categories/[...category]`, "fetch failed"), because no Medusa backend is running. This
    is environmental and the same as NIMBUS-140.
    - `next build` skips type validation, so I also ran `npx tsc --noEmit -p .`. It reports
      errors only in pre-existing, untouched files: `account-nav.test.tsx`,
      `profile-card/index.tsx` and `cart-drawer/index.tsx`.
  - Root `pnpm lint`: exit 0, 3 of 3 tasks succeeded, 0 errors. All 13 backend warnings are
    pre-existing and in untouched files.
- **Skipped:**
  - **The TestDK walkthrough (Task 04 step 8) was not done.** That includes R1 (the `or` filter
    on `PostedReturnReceiptReturnRcptLines`) and R2 (the `Type` wire values and the line field
    names).
    - There are no Business Central credentials in this environment: no `.env` file, and no
      `BUSINESS_CENTRAL_CLIENT_SECRET`.
    - No backend or storefront is running.
    - R1 and R2 are therefore covered only by mocked tests.
- **Deviations from the plan:**
  - **Changed test comments.** Three existing test comments said that processed returns give
    null/404. That is no longer true, so I reworded them:
    - `get-return.spec.ts` TC-3: the comment and the test title;
    - `return-detail-route.unit.spec.ts` TC-2;
    - `bcreturn-detail-page.test.tsx` TC-2.
  - **Test fixture.** `get-return.spec.ts` gets an extra shared fixture,
    `EXPECTED_RECEIPTS_31502910`, which TC-7 and TC-8 use.
  - **TC-13 assertion (list lines).** It compares the sorted `or` terms, because the plan
    leaves the term order open.
  - **Line endings.** New and rewritten files use CRLF, to match their siblings in this
    `core.autocrlf=true` checkout.
  - **Catalog diff.** Each catalog shows a few `-` lines in `git diff`. These are the
    trailing-comma changes on the previous last key of a block, plus the intended
    `bcReturnNotFound.message` change. There were no whole-file rewrites.
  - **Translation scripts.** Both translation scripts ran from the session scratchpad and are
    not in the repo.
  - **Unused keys.** `Account.bcStatus.released` is no longer used by the return filter. The
    order filter still uses `Account.bcStatus`. I left the key in place, because the plan does
    not remove it.
- **Handover to:** code-review agent. After that, the user or a teammate with TestDK access runs
  the walkthrough.
- **Handover prompt:** Review the uncommitted NIMBUS-172 changes on `feature/NIMBUS-172`
  against `issues/NIMBUS-172/PLAN.md` and the four task files, using the code-review and
  secure-coding-owasp skills.
  - Focus areas:
    - customer scoping on every `PostedReturnReceipt` query;
    - `$select` excluding names, addresses, phone and e-mail;
    - line queries using only receipt numbers from scoped headers;
    - the external ref rendered only as plain text;
    - the in-memory merge, paging and count in `listReturns`;
    - the `getReturn` resolution order (open → processed return order → stand-alone receipt,
      where a receipt that belongs to a return order gives 404).
  - The known baselines are expected: the backend `listOrders` guardrail test (x2), and the
    storefront `product-tabs` (x2) and `main-layout` tests.
  - Before merging, someone with TestDK credentials must do the Task 04 step 8 walkthrough,
    including R1 and R2. If BC rejects the `or` filter, apply the PLAN.md R1 fallback in
    `fetchPostedReturnReceiptLines`: one request per receipt, in parallel.
  - Do not commit unless the user asks.

## 2026-09-30 — Code review (Alpha checklist)

- **Outcome:** Reviewed the uncommitted NIMBUS-172 diff on `feature/NIMBUS-172` (backend
  `service.ts`, `return-history.ts`, `types.ts`, bc-returns route/validators/middlewares;
  storefront card, filters, detail template, new `bc-return-receipts`, types, data layer,
  8 locale catalogs). No must-fix items. Customer scoping holds: every PostedReturnReceipt
  header query filters on the session's `Sell_to_Customer_No`, lines are only fetched for
  receipt numbers taken from those filtered headers, all literals go through
  `escapeODataString`, and `state` is a strict `z.enum`. Tests cover the new behaviour.
- **should:** `fetchOpenReturnOrders` and the list `fetchPostedReturnReceiptHeaders` call send
  no `$orderby` (the old `documentDate desc` was dropped). If a fetch cap (1000 / 5000) is
  reached, BC decides which rows are cut, so the "older returns are not listed" warning may
  not be true. Fix: add `$orderby=documentDate desc` and `$orderby=Document_Date desc`.
- **should:** every list page load re-reads up to 1000 open orders (with lines) and 5000
  receipt headers (risk R3). Acceptable for now; consider a follow-up for caching if TestDK
  shows it is slow.
- **nit:** `STATE_BADGE_CLASSES` is duplicated in `bc-return-card` and
  `bc-return-detail-template`.
- **nit:** a stand-alone receipt's detail page shows "Return receipt #X" and then
  "Receipt #X" in the receipts section.
- **Still open:** the TestDK walkthrough (Task 04 step 8, risks R1/R2) has not been done.
- **Next owner:** user. Decide whether the implementor should fix the `$orderby` item, then
  do the TestDK walkthrough and commit.

## 2026-09-30 — Review fix: sort capped Business Central reads

- **Outcome:** Fixed the review's `$orderby` should-item, as the user asked. In
  `apps/backend/src/modules/business-central/service.ts`:
  - `fetchOpenReturnOrders` now sends `$orderby=documentDate desc`;
  - `fetchPostedReturnReceiptHeaders` now sends `$orderby=Document_Date desc`. This applies to
    the list query and to both detail-page queries.
  If a cap is reached, the oldest rows are now the ones left out, so the cap warning is true.
  `list-returns.spec.ts` TC-12 now asserts both `$orderby` values.
- **Verification:** the return specs (`list-returns`, `get-return`, `return-history`) were run
  under `TEST_TYPE=integration:modules` with a dummy TestDK-shaped
  `BUSINESS_CENTRAL_DISCOVERY_URL`: 3 suites, 35 of 35 tests passed. ESLint on `service.ts`
  gave 0 errors (the spec file is on eslint's ignore list).
- **Still open:** the TestDK walkthrough (Task 04 step 8, risks R1/R2). Also check that
  `$orderby=Document_Date desc` is accepted by the PostedReturnReceipt web service.
- **Next owner:** user. Do the TestDK walkthrough, then commit.

## 2026-09-30 — Committed and merged to develop

- **Outcome:** Committed on `feature/NIMBUS-172` as `4b20cd3`. Merged into `develop` (no
  fast-forward) as `f898c4d`, after `git pull --ff-only` on develop. The incoming develop
  commits changed issue docs only, so the tested code is unchanged. Not pushed.
- **Still open:** the TestDK walkthrough (Task 04 step 8, risks R1/R2, and whether
  `$orderby=Document_Date desc` is accepted). Jira has not been updated.
- **Next owner:** user. Push develop, do the TestDK walkthrough and update Jira.

## 2026-09-30 — Jira updated, Internal review

- **Outcome:** Added a summary comment to NIMBUS-172 (changes, decisions agreed during
  planning, pending TestDK walkthrough, links to PLAN.md and PROGRESS.md, commits). With the
  user's go-ahead, moved the issue Scoping → Estimation → To Do (Estimate approved) →
  In Progress → Internal review.
- **Handover to:** reviewer (Internal review), including the TestDK walkthrough.
- **Handover prompt:** On `develop`, with the backend and storefront running against TestDK, do
  Task 04 step 8 from `issues/NIMBUS-172/04-storefront-return-detail-implementation.md`.
  Confirm R1 (the `or` filter on `PostedReturnReceiptReturnRcptLines`; the fallback is one
  request per receipt, in parallel), R2 (line `Type` values and field names), and that
  `$orderby=Document_Date desc` is accepted on `PostedReturnReceipt`. Record the evidence here,
  then run the Definition of Done, add the closing comment to NIMBUS-172 and transition it to
  Closed.
