# NIMBUS-217 progress

## 2026-10-23 — triage

- Outcome: registered as Story NIMBUS-217 (component Customer Portal), linked "relates to" NIMBUS-130, NIMBUS-178 and NIMBUS-216. Case folder with `feature.md` written; not yet committed.
- Proposed flow: full pipeline (`scoper` → `implementation-planner` → `task-dispatcher`): a data-model change on the company module (new field and migration), a change to the order API contract (`/orderapi/shipment-notices`), possibly the BC shipment discovery, and a business rule still to be stated. The order API and BC sync are always full pipeline per `ai/AGENTS.md`.
- Next owner: Klaus (go-ahead, answers to the open questions in `feature.md`), then `scoper`.
- Handover prompt: "Start the scoper on NIMBUS-217. Case folder: issues/NIMBUS-217. Read feature.md (open questions and triage notes)."

## 2026-10-23 — scoper

- Outcome: `scope.md` written (Story, base `develop`) with Klaus's six triage answers as decided rules,
  proposed rules R3 (403 "Customer not registered for shipment notices"), R8–R10, and draft data-model
  and security tables. Jira comment posted on NIMBUS-217 (scope written, open questions); issue left
  in Scoping because the scope is not yet approved. Nothing committed: the working tree is shared with
  the NIMBUS-216 quick-fix on `feature/NIMBUS-216`; `scope.md` and this file are untracked.
- Open for Klaus: Q1 (403 vs generic 404 leaks customer existence to a key holder), Q2 (gate order
  intake too?), Q3 (re-enable behaviour), Q4 (no back-fill), Q5 (go-live with nobody switched on),
  Q6 (change history of the setting).
- Next owner: Klaus (approve or correct the scope and answer Q1–Q6), then the scoper records "scope
  approved" in Jira (move to the ready state), then a separate go-ahead for `implementation-planner`.
- Handover prompt: "Continue the scoper on NIMBUS-217 (issues/NIMBUS-217). Klaus's answers to Q1–Q6:
  <answers>. Update scope.md in place, record scope approved in Jira, and stop before planning."

## 2026-10-23 — scoper (Klaus's answers)

- Outcome: Klaus answered Q1–Q6 ("2 også ordreflow, resten ok"). `scope.md` updated in place: the
  setting now also blocks order intake (`POST /orderapi/orders`); field proposed as
  `company.order_api_enabled`; both endpoints answer a switched-off company with 403 "Customer not
  registered for the order API" (unknown stays 404); the go-live has an operations step where an admin
  switches on today's API companies right after deploy; R7–R9 confirmed; no change history needed.
  New proposed rule R11 (earlier API orders of a switched-off company are untouched). Jira comment
  posted ("agreed rule or decision changed"). Scope NOT yet approved; issue stays in Scoping. Still
  uncommitted (shared working tree with NIMBUS-216).
- Open items: O1 (who identifies today's API companies for go-live), O2 (how the Logic App handles a
  403 on order intake, NIMBUS-178).
- Next owner: Klaus (approve the updated scope; answer or accept O1, O2 as open), then the scoper
  records "scope approved" in Jira; a separate go-ahead for `implementation-planner`.
- Handover prompt: "Klaus approved the NIMBUS-217 scope (issues/NIMBUS-217) <with changes, if any>.
  Record scope approved in Jira and stop before planning."

## 2026-10-23 — scoper (scope approved)

- Outcome: Klaus approved the scope ("yes ok til scope"). `scope.md` status set to Approved. Jira:
  "scope approved" comment with the rules, go-live step and open items; issue transitioned "Scope
  approved" (Scoping → Estimation). Jira summary left unchanged on Klaus's instruction. Still
  uncommitted (shared working tree with the NIMBUS-216 quick-fix); no branch created.
- Open into planning: O1 (who identifies today's order API companies for go-live), O2 (Logic App
  handling of a 403 on order intake, NIMBUS-178).
- Next owner: Klaus (separate go-ahead for planning), then `implementation-planner`. Before planning,
  commit the case folder on `feature/NIMBUS-217` (from `develop`) once the NIMBUS-216 work no longer
  shares the working tree.
- Handover prompt: "Start the implementation-planner on NIMBUS-217. Case folder: issues/NIMBUS-217
  (read PROGRESS.md, then scope.md: rules R1–R15, draft data-model and security tables, open items O1
  and O2). Base branch develop, work branch feature/NIMBUS-217."

## 2026-10-23 — implementation-planner (plan written, awaiting review)

- Outcome: branch `feature/NIMBUS-217` created from `develop` (69155cf); case folder committed.
  `plan.md`, `manifest.md` and task files 01–05 written: company setting, Admin UI, rule home and
  403 on both order API endpoints, shipment job (discovery skip, new close reason
  `company_not_enabled`), Admin retry refusal. Framework assumptions all verified (no UNVERIFIED
  row). `Ready for Dispatch: false`. Jira sub-tasks not created: per `tracker-workflow` they are
  created at "plan approved"; the Atlassian MCP also failed to connect in this session.
- Needs Klaus: decisions 1–5 in `plan.md` section 2 (O1 go-live list, optional auto-enable script,
  O2 Logic App 403 handling, when open tracking closes, R12 vs two wildcard store reads of company
  fields). Competing-model review recommended (authorization and regulated-order flow).
- Next owner: Klaus (review and approve the plan, answer decisions 1–5), then the planner sets
  Ready for Dispatch, creates the five Jira sub-tasks (component Customer Portal) and comments the
  new decisions on NIMBUS-217; a separate go-ahead for `task-dispatcher`.
- Handover prompt: "Continue the implementation-planner on NIMBUS-217 (issues/NIMBUS-217). Klaus's
  answers to plan decisions 1–5: <answers>. Revise plan.md if needed, mark Ready for Dispatch, create
  the Jira sub-tasks and record plan approved; stop before dispatch."

## 2026-10-23 — implementation-planner (Klaus's answers to plan decisions 1–5)

- Outcome: answers recorded in `plan.md` section 2 (not plan approval). 1: not in production, Klaus
  enables companies himself while testing; no go-live aid query; O1 and the go-live gap do not apply
  now (risk downgraded to non-blocking). 2: no auto-enable script. 3: O2 closed, Klaus handles the
  Logic App outside this repo. 4: rows close when next due, agreed. 5: wildcard store reads accepted;
  R12 reads "not writable from the storefront, not returned by the store company endpoints".
  Manifest "Scope items with no task" and the Verify-after-deploy lines of tasks 01, 03, 04 updated.
  `Ready for Dispatch: false`; no Jira sub-tasks or "plan approved" comment yet.
- Next owner: Klaus (approve the plan), then the planner marks it ready, creates the Jira sub-tasks
  and records plan approved; a separate go-ahead for `task-dispatcher`.
- Handover prompt: "Klaus approved the NIMBUS-217 plan (issues/NIMBUS-217). Mark Ready for Dispatch,
  create the Jira sub-tasks and record plan approved; stop before dispatch."
