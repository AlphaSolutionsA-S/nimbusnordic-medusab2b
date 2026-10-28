# NIMBUS-261 progress

## 2026-10-27 — triage

- Outcome: registered as Story NIMBUS-261 (component Customer Portal, status Scoping); intake in
  `feature.md`. No duplicate found; related: NIMBUS-254 (Admin BC company sync). The store
  `business-central/operations` route is disabled (404), so it drops out of scope.
- Routing: full pipeline (Business Central sync, company data, a contract with a vendor, several
  routes and workflows, an open business question).
- Next owner: `scoper`, after the human's go-ahead.
- Handover prompt: "Scope NIMBUS-261 from `issues/NIMBUS-261/feature.md`. Resolve the open
  questions (existing DK orders/returns of Norwegian companies disappearing from the portal; NOK as
  NO currency) and record that the NO custom API and `PostedReturnReceipt*` services must be
  verified by a read-only probe during planning."

## 2026-10-27 — scoper

- Outcome: `scope.md` written (Story, backend only, no migration). Human answers folded in (DK-only
  history of NO companies disappearing: accepted; NO currency NOK; NO custom API and
  `PostedReturnReceipt*` published, still to probe). Jira: comment "scope drafted, waiting for
  approval" with rules, decisions, open questions; status left at Scoping until the human approves.
- New findings: the return-reasons route reads no company today (must start resolving it);
  `company.country` has two writers with different case (BC sync, presumably `NO`; Admin country
  select, lower-case `iso_2`), so the rule compares case-insensitively; country is BC-managed, so a
  company with blank/wrong country whose number exists only in NO stays on DK (open question).
- Next owner: the human (approve the scope and answer the open questions), then
  `implementation-planner` on a separate go-ahead.
- Handover prompt: "Plan NIMBUS-261 from `issues/NIMBUS-261/scope.md`. Start with the read-only
  TestNO probe (custom API, return reasons, `PostedReturnReceipt*`, NO company GUID and ODataV4
  name, sample customer currency) and a check of stored `company.country` values; dispatch is
  blocked until the probe passes."

## 2026-10-27 — scoper (amendment)

- Outcome: `scope.md` amended in place. Human answers: Klaus checks which companies move to NO
  before go-live; an Admin edit of `country` is accepted as the way to fix the environment; a
  missing NO configuration fails only NO calls. New requirement added: record "customer not
  found" on the company (cleared on success), an Admin "Business Central customer" section on the
  custom company page (a section, not a core-zone widget), a read-only check of the customer number
  in DK and NO, and "Use this customer" for a single match. Jira comment 255693 ("agreed rule
  changed"); status still Scoping.
- Decisions for the human: D1, the country set by "Use this customer" (recommended: the country on
  the BC card where the customer was found, set server-side, then sync). D2, storage of the
  not-found state (recommended: three nullable columns on `company`; `company` has no `metadata`
  column, so either option is a generated migration).
- Next owner: the human (approve the scope, decide D1 and D2), then `implementation-planner` on a
  separate go-ahead.
- Handover prompt: "Plan NIMBUS-261 from `issues/NIMBUS-261/scope.md` with the human's D1/D2
  answers. Start with the read-only TestNO probe; dispatch is blocked until it passes."

## 2026-10-27 — scoper (decisions)

- Outcome: Klaus accepted D1 (country from the BC card in the chosen environment, re-read on the
  server) and D2 (three nullable `company` columns, generated migration in the company module).
  Rule change: a number found in both environments can be used from either, so only "found in
  neither" has no action. `scope.md` updated in place (requirements 13–14, business rules,
  Decisions, data model, Resolved). Jira comment added; status still Scoping.
- Next owner: the human (scope approval), then `implementation-planner` on a separate go-ahead.
- Handover prompt: "Plan NIMBUS-261 from `issues/NIMBUS-261/scope.md`. Start with the read-only
  TestNO probe; dispatch is blocked until it passes."

## 2026-10-27 — implementation-planner (draft, awaiting approval)

- Outcome: `plan.md`, `manifest.md` and seven task files (`01`–`07`) written; Jira sub-tasks
  NIMBUS-262 to NIMBUS-268 created (component Customer Portal) and a "plan drafted" comment added
  to NIMBUS-261 (comment 255698). Design: the environment (`DK`/`NO`) becomes a required first
  argument of every BC module method (task 01 passes `DK` everywhere; order API, submission and
  shipment notices stay `DK`); one pure country rule plus an account workflow resolve customer
  number and environment for store routes, return creation and the Admin section; the not-found
  record is three columns written by the sync, which still reports `skipped`.
- Not done: the TestNO probe. No BC credentials, `.env` or `mcloud` in this checkout, so it is
  `UNVERIFIED` and blocks dispatch. Read-only script: `samples/probe-bc-environment.mjs` (needs
  `BUSINESS_CENTRAL_CLIENT_ID/SECRET`, `PROBE_DISCOVERY_URL` for TestNO, `PROBE_COMPANY_ID`,
  `PROBE_CUSTOMER_NUMBER`). Stored `company.country` case also `UNVERIFIED` (no database
  reachable); non-blocking, the rule ignores case.
- New finding: standard BC API calls carry no `companies(...)` segment and rely on BC's default
  company; the probe must confirm that TestNO's default is the Nimbus Nordic NO company. The return
  step accepts only reason `NORMAL` (NIMBUS-138), so NO must have it enabled.
- Needs the human: run the probe; answer plan section 2 items 2 (new columns visible to company
  admins through two existing wildcard store responses; default accept) and 3 (integration tests
  verification rule; default as NIMBUS-254); approve the plan. `Ready for Dispatch` stays false.
  Nothing committed or pushed.
- Next owner: the human, then `implementation-planner` to fold in the probe output and set ready,
  then `task-dispatcher` on a separate go-ahead.
- Handover prompt: "Continue planning NIMBUS-261: here is the TestNO probe output <paste>. Fold it
  into `issues/NIMBUS-261/plan.md` sections 2 and 9, apply my answers to section 2, and mark the
  plan ready if every framework row is verified."

## 2026-10-27 — implementation-planner (probe folded in, awaiting approval)

- Outcome: probe and production counts recorded in `samples/probe-results-2026-10-27.md` (counts,
  status codes and company names/GUIDs only). `plan.md` updated: section 2 item 1 is now answered
  (Klaus: build now; the customer-portal extension is missing in TestNO and gates only the
  verification of the parts that need it and production go-live); flows A8 and B6 describe
  behaviour until the extension is deployed; section 9 rows verified (default company in TestNO, NO
  GUIDs and names, standard API and posted receipts, card country `NO`, NOK, shared credentials);
  section 10 gates: extension in TestNO for verification, extension and probe in ProductionNO plus
  a ProductionDK probe (two companies there: CRONUS and Nimbus) for go-live, TestNO test data
  (205 of 207 cards with blank country), 4 ProductionDK `NO` customers missing in ProductionNO.
  "Numbers unique" replaced by the business rule "same number = same customer; found in both is
  normal; no uniqueness warning" (Klaus, 2026-10-27) in plan sections 3, 4, 5, 8 and task 07.
  Manifest and tasks 01, 03, 04 adjusted. Jira untouched (no new event; the plan-approved comment
  will carry the changes).
- Still open for the human: plan section 2 items 2 (new columns reaching company admins through
  approvals and employee responses; default accept) and 3 (integration-test verification; default
  as NIMBUS-254); plan approval. Two non-blocking `UNVERIFIED` rows remain (extension in NO, stored
  `company.country` case). `Ready for Dispatch` false. Nothing committed.
- Proposed `scope.md` amendment (not applied; the scope is approved and committed, the scoper or the
  human decides):
  - Requirement 14: "Found in both environments (the normal case for a Norwegian customer, who is
    registered in both): both matches are shown, without a warning, and each offers "Use this
    customer". The admin picks one, and the action behaves exactly as in requirement 13."
  - Business rule (line 124): "The BC customer number is used unchanged in either environment. The
    same number always means the same customer; Norwegian customers are normally registered in both
    environments (Klaus Petersen, 2026-10-27)."
  - Security table, "No cross-company read" row: "…unchanged; the same number is the same customer
    in both environments".
  - Resolved list: replace "Customer numbers are unique across DK and NO." with "The same customer
    number is the same customer in DK and NO."
  - Open questions: replace the probe item with "The customer-portal extension is not deployed in
    TestNO/ProductionNO (probe 2026-10-27). Build proceeds; the parts that need it are verified
    after deployment to TestNO, and production go-live of NO routing waits for it in
    ProductionNO."
- Next owner: the human (answer items 2 and 3, approve), then `implementation-planner` to set ready
  and record "plan approved", then `task-dispatcher` on a separate go-ahead.
- Handover prompt: "NIMBUS-261 plan: my answers to section 2 items 2 and 3 are <…>; the plan is
  approved. Record it and mark the manifest ready."

## 2026-10-27 — implementation-planner (plan approved)

- Outcome: Klaus Petersen approved the plan on 2026-10-27 and answered plan section 2: item 2
  accepted (new company columns may reach the company's own admins via the approvals and employee
  responses), item 3 accepted (integration and contract cases written now, run at finalization,
  unrunnable ones reported unverified, as NIMBUS-254). Section 2 marked answered in `plan.md`;
  `manifest.md` set to `Ready for Dispatch: true`. The two remaining `UNVERIFIED` framework rows
  (customer-portal extension in NO, stored `company.country` case) are non-blocking by the human's
  decision; the extension gates verification of the parts that need it and production go-live.
- Scope: the proposed amendment (same number = same customer, "found in both" is normal with no
  warning, extension status) was approved by Klaus and applied to `scope.md` by the scoper.
- Jira: "plan approved" comment on NIMBUS-261 (comment 255699) with the new decisions and each
  open question with its answer; sub-tasks NIMBUS-262 to NIMBUS-268 already exist and are in the
  manifest. Nothing committed or pushed.
- Next owner: `task-dispatcher`, on a separate explicit go-ahead from the human.
- Handover prompt: "Dispatch NIMBUS-261 from `issues/NIMBUS-261/manifest.md` (branch
  `feature/NIMBUS-261` from `develop`)."

## 2026-10-28 — task-dispatcher (at the implementation gate)

- Outcome: all seven tasks implemented, reviewed and committed on `feature/NIMBUS-261` (local, not
  pushed): 20a7ced (NIMBUS-262), 6c0b521 (NIMBUS-263), 90ba42a (NIMBUS-264), ccffd44 (NIMBUS-265,
  after one review rework), b7bb0dd (NIMBUS-266, generated migration), ea11a2e (NIMBUS-267),
  74f5320 (NIMBUS-268); finalization fix 863f0fc; consolidation b928d98. Cross-task review written
  to `deviation-report.md` (no blocking or wiring findings). Jira sub-tasks NIMBUS-262..268 Done
  with closing comments; NIMBUS-261 left in Scoping (its workflow offers only "Estimate approved").
- Verified: unit 618/618, module integration 309/310 (baseline failure), Admin UI 96/96, lint 0
  errors, typecheck 22 = baseline, `medusa build` passes; HTTP integration run against a throwaway
  Postgres: every new non-Admin case passes, 21 new Admin contract cases fail only with 401
  (NIMBUS-236), every other failure also fails on develop 811de63. No run reached Business Central.
- Next owner: Klaus Petersen (answer the deviation report's open questions 1–6), then
  `task-dispatcher` resumes at "After the gate".
- Handover prompt: "Resume the NIMBUS-261 dispatch after the gate: my answers to the deviation
  report's open questions are <…>."
