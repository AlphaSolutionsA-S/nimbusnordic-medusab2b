# Progress

## 2026-10-26 — triage

- Outcome: new feature request drafted in `feature.md`; no duplicate in Jira (component Customer
  Portal). Related: NIMBUS-156, NIMBUS-160, NIMBUS-161. Jira issue not yet created (waiting for the
  user's yes). Proposed flow: full pipeline (Business Central sync is always full pipeline).
- Next owner: the user (approve issue creation and the flow), then `scoper`.
- Handover prompt: "Create the Jira issue from `issues/admin-company-bc-sync-now/feature.md`, rename
  the folder to `issues/NIMBUS-<n>/`, then run the scoper on it."

## 2026-10-26 — scoper

- Outcome: Jira Story NIMBUS-254 created (component Customer Portal, priority Medium = MoSCoW
  Should, parent epic NIMBUS-128, relates to NIMBUS-156/160/161); folder renamed from
  `admin-company-bc-sync-now`; `feature.md` Tracker line filled in. `scope.md` written with the
  human's answers of 2026-10-26 (R1–R9) and three open questions (storefront 120 s company cache vs
  "immediately"; blocked/credit limit are display-only today; audit of who ran a sync). Scope comment
  added to Jira. Issue left in status Scoping: the "Scope approved" transition (to Estimation) waits
  for the human's approval of the scope. Case folder not yet committed.
- Next owner: the human (review scope, answer the open questions, approve), then
  `implementation-planner` on a separate go-ahead.
- Handover prompt: "Plan NIMBUS-254 from `issues/NIMBUS-254/scope.md` (read `feature.md` and this
  file first). Add a company-id entry point to the BC company sync sharing the existing field
  mapping, an Admin route to sync one company with outcome updated / nothing to sync / failed, the
  last-synced time in the Admin company read, and the Admin action (disabled with tooltip without a
  BC customer number) plus a last-synced row. Do not change the login or freshness triggers; keep
  `integration-tests/http/customers/company-sync.spec.ts` green. Apply the human's answers to the
  scope's open questions first."

## 2026-10-26 — implementation-planner

- Outcome: the human's answers (2026-10-26: 120 s storefront cache accepted; blocked and credit
  limit display-only, checkout enforcement out of scope; no audit) are recorded in `scope.md`. Jira
  NIMBUS-254 moved with "Scope approved" to Estimation, with an approval comment. Case folder
  registration and scope committed locally on `develop` (509c986, not pushed). Wrote `plan.md`,
  `manifest.md` and three task files: 01 sync by company id (workflow and step), 02 Admin route
  plus last-synced in the Admin read, 03 Admin UI. All framework assumptions verified from installed
  source. One item in Needs your decision: how the integration cases get verified, since they can't
  run in this checkout. The default is the NIMBUS-243 rule. Ready for Dispatch: false. Jira
  sub-tasks and the plan-approved comment wait for plan approval.
- Next owner: Klaus Petersen (review `plan.md` and answer section 2). Then implementation-planner
  sets Ready for Dispatch, creates the sub-tasks and records "plan approved". After that,
  `task-dispatcher` runs on a separate go-ahead.
- Handover prompt: "Run task-dispatcher on `issues/NIMBUS-254/` (manifest `manifest.md`, branch
  `feature/NIMBUS-254` from `develop`). Tasks 01 → 02 → 03 in order. Contract and integration cases
  can't run locally (no `apps/backend/.env`, BC test-environment guard, NIMBUS-236). Apply the
  verification rule in plan section 2: per task run lint, typecheck and the Admin or unit tests. At
  finalization, try `company-sync.spec.ts`, `companies.spec.ts` and `security-boundaries.spec.ts`,
  and record environment or 401-only failures of touched cases as 'code complete, unverified'."

## 2026-10-26 — implementation-planner (plan approved)

- Outcome: Klaus Petersen approved the plan on 2026-10-26, including the section 2 verification
  rule and every decision new in the plan, and asked for no competing-model review. The approval is
  recorded in `plan.md`. Jira sub-tasks were created with component Customer Portal: NIMBUS-258
  (task 01), NIMBUS-259 (task 02), NIMBUS-260 (task 03). They are in the manifest's Issue column.
  The "plan approved" comment is on NIMBUS-254. The manifest says Ready for Dispatch: true. The plan
  files are committed locally on `develop` and not pushed.
- Next owner: the human (separate go-ahead), then `task-dispatcher`.
- Handover prompt: as in the previous entry.

## 2026-10-26 — task-dispatcher (stopped at the implementation gate)

- Outcome: branch `feature/NIMBUS-254` from local `develop` (374c670), not pushed. Tasks 01–03 done
  and reviewed: 8286447 (NIMBUS-258), ec89c92 (NIMBUS-259), e65ed1c (NIMBUS-260); consolidation
  9e764aa. Backend `test:unit` 1114/1114, `test:admin` 79/79, lint 0 errors, typecheck 22 = baseline,
  build passes. `test:integration:http` for the three specs aborts in globalSetup (no BC test
  environment / `.env`): code complete, unverified. `pnpm ai:check` fails (AGENTS.md 162 bytes over
  its limit after the new `decisions.md` row). Integration review approved, no wiring findings;
  `deviation-report.md` has three open questions. Jira: sub-tasks Done with closing comments;
  NIMBUS-254 left in Estimation ("Estimate approved" is a human decision), with a comment.
  `apps/backend/medusa-config.ts` has an uncommitted change not from this branch.
- Next owner: Klaus Petersen (answer the deviation report's open questions).
- Handover prompt: "Resume task-dispatcher on `issues/NIMBUS-254/` at 'After the gate' with these
  answers to `deviation-report.md` open questions 1–3: <answers>."
