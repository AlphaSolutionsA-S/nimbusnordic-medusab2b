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
