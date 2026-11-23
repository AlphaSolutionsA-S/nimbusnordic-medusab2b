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
