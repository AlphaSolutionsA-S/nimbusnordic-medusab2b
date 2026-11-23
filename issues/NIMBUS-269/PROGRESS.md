# NIMBUS-269 progress

## 2026-11-23 — triage: registered and routed to the full pipeline

- Outcome: Klaus asked on 2026-11-23 to "register in one bug and pick it up". Created Bug
  NIMBUS-269 under epic NIMBUS-206, component `Customer Portal`, priority Medium, linked "relates
  to" NIMBUS-236, NIMBUS-207 and NIMBUS-243. Wrote `bug.md`. No duplicate found; NIMBUS-207 (store
  quote projection) and NIMBUS-243 (existing-account refusal) added the failing contract cases of
  groups 2 and 1 and are related, not duplicates.
- Route: full pipeline, one flow for all seven failures. Group 2 is a store response exposing
  company data, in the company-authorization area that `ai/AGENTS.md` always sends through the
  full pipeline, and resolving it means either narrowing the response or changing the
  `decisions.md` "quotes: name only" rule, a decision only the business can make. Groups 3 and 4
  are not investigated and may be real quote-route contract defects. Splitting would give one bug
  two flows and two folders, against the one-bug request; when signals point both ways the larger
  flow is proposed. The scoper may still hand the test-side groups down to `quick-fix`.
- Case folder not yet committed (triage commits nothing); the flow commits it with the work.
- Next owner: `scoper`.
- Handover prompt: "Scope NIMBUS-269 from `issues/NIMBUS-269/bug.md`: the seven remaining local
  HTTP integration failures; settle the store quote company `id` question with Klaus."

## 2026-11-23 — scoper: scope drafted, awaiting approval

- Outcome: reproduced all 7 failures on develop `bd34b15` (four spec files, throwaway Postgres on
  port 55499, removed afterwards): 7 failed, 117 passed. Wrote `scope.md` with a cause for every
  group: 1 test drift (`Employee.customer_id` lookup, as fixed in NIMBUS-248); 2 and 3a Medusa
  returns each related record's `id` (company, message authors) while the tests and the NIMBUS-207
  rule say name only; 3b test drift (`summary.difference_sum` no longer exists in Medusa 2.21);
  4 test setup drift (unpublished product makes cart creation 400; the message route is never
  reached). No production fault found.
- A probe that temporarily loosened the quote assertions locally (to see whether anything else
  mismatches behind the `id`) was refused by the session's permission classifier and not run;
  the tree is unchanged. Group 3a may hide further mismatches until it re-runs.
- Tracker: no change. The "scope approved" event (comment, move to the ready state) comes after
  Klaus approves.
- Open for Klaus: Q1 accept related-record ids (A, proposed) or strip them (B); Q2 with B also strip
  `customer.employee.company_id`; Q3 with A hand the whole bug down to `quick-fix`.
- Next owner: Klaus (scope gate), then `quick-fix` (answer A) or `implementation-planner` (answer B).
- Handover prompt: "NIMBUS-269 scope is in `issues/NIMBUS-269/scope.md`. Answer Q1–Q3; on
  approval the scoper records the scope in Jira and hands over per Q3."

## 2026-11-23 — scoper: scope approved, handed down to quick-fix

- Outcome: Klaus approved the scope with the proposed answers ("all good", relayed by the pipeline
  coordinator): Q1 A (accept the related-record ids, tests pin the exact ids and keep every
  forbidden-field check), Q2 not applicable, Q3 the whole bug goes to `quick-fix` (bug mode), one
  flow and one folder. `scope.md` records the answers and its body now reads as decided.
- Tracker: "scope approved" comment and "agreed rule or decision changed" comment (NIMBUS-207 rule
  "name only" → related-record ids accepted) on NIMBUS-269; a short pointer comment on NIMBUS-207;
  NIMBUS-269 moved Scoping → Estimation (transition "Scope approved").
- Branch: `feature/NIMBUS-269`, cut from develop at `bee94df` (the draft scope commit); develop
  stays at `bee94df`. Nothing pushed.
- Next owner: `quick-fix` (bug mode), launched by triage.
- Handover prompt: "Fix NIMBUS-269 in bug mode on `feature/NIMBUS-269` from
  `issues/NIMBUS-269/scope.md` (Proposed structure 1–5): correct the four groups of stale test
  assertions and setup, pin the related-record ids in the quote privacy cases, update the
  `decisions.md` note, `docs/architecture/store-access.md` and the `verification.md` baseline,
  and re-run the full `test:integration:http`. No production code change is expected; a failure
  in the Admin quote message route once its setup works is a new finding for Klaus."

## 2026-11-23 — quick-fix: fixed and committed locally

- Outcome: reproduced the seven failures (four files: 7 failed, 117 passed), corrected the four
  spec files (tests only), pinned the related-record ids, updated `decisions.md`,
  `store-access.md` and the `verification.md` baseline. Code review approved. Full
  `test:integration:http`: 489 of 489 pass; unit 1202 and admin 96 pass; modules fail only the known
  BC `listOrders` baseline test. Group 3a showed nothing beyond the ids; the Admin message route
  passed once its setup worked. Details in `change-report.md` (the root-cause analysis is there;
  no separate `analysis.md`).
- Tracker: "quick-fix started" and "quick-fix done" comments on NIMBUS-269. Status left in
  Estimation: the only transition forward is "Estimate approved", a human decision.
- Branch: `feature/NIMBUS-269`, committed locally, not pushed.
- Next owner: Klaus (push and PR go-ahead; Jira status).
- Handover prompt: "NIMBUS-269 is committed on `feature/NIMBUS-269` (see `change-report.md`).
  Decide on the Jira status and give the go-ahead to push and open the PR to develop."
