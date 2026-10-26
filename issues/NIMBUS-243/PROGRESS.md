# NIMBUS-243 progress

## 2026-10-24 — Registered

- Outcome: bug registered in Jira (Bug, parent epic NIMBUS-206, component Customer Portal) and
  mirrored in `bug.md`. Found by code reading during triage of NIMBUS-242; not yet reproduced
  against a running backend.
- Next owner: triage, to route it. Company authorization is an always-full-pipeline area in
  `ai/AGENTS.md`, though the likely fix (drop `customer_id` from the store validator, since the
  storefront never sends it) is small.
- Handover prompt: "Triage NIMBUS-243 (issues/NIMBUS-243/bug.md): store route
  POST /store/companies/:id/employees accepts any companyless customer_id."

## 2026-10-26 — Scoped

- Outcome: `scope.md` written (Bug, backend; storefront type file only). Human decision recorded
  (Klaus Petersen, 2026-10-26): drop `customer_id` from the store route if nothing breaks. Checked:
  no runtime consumer (storefront, other backend code, Admin UI, order API, repo files, tracker).
  A body with `customer_id` gets 400 from the strict schema; the access guard still runs first, so
  the foreign-company case keeps 403. Jira: scope comment added; status left at Scoping, the
  "Scope approved" transition waits for the human's review of the scope. Not committed.
- Next owner: the human (review the scope, then approve the transition and, separately, the
  hand-off to implementation-planner).
- Handover prompt: "Plan NIMBUS-243 (issues/NIMBUS-243/scope.md): remove `customer_id` from the store
  `StoreCreateEmployee` validator and the existing-customer branch of
  `api/store/companies/[id]/employees/route.ts`; 400 for a body that carries it; retarget the
  employee-invitation.spec.ts store-link test to 400, add a security-boundaries negative case; update
  docs/architecture/store-access.md and the stale types. Integration specs fail locally on login
  (NIMBUS-236): state how they get verified."

## 2026-10-26 — Planned

- Outcome: scope approval recorded in Jira (transition "Scope approved", status Estimation;
  approval comment). `plan.md`, `manifest.md` and two task files written: 01 backend (validator,
  route, backend type, unit + contract tests, store-access doc), 02 storefront type. No UNVERIFIED
  framework rows. New decision: email and password become required in the store schema and the
  refinement goes. Integration cases: run at finalization; failing only with 401 on login means
  "code complete, unverified because NIMBUS-236", not a blocker. Tracker sub-tasks are not created
  yet: they are created when the human approves the plan. `Ready for Dispatch: false`. Not
  committed.
- Next owner: the human (review `plan.md`; on approval the planner sets Ready for Dispatch, creates
  the sub-tasks and comments; then a separate go-ahead for task-dispatcher).
- Handover prompt: "Dispatch NIMBUS-243 (issues/NIMBUS-243/manifest.md) on feature/NIMBUS-243 from
  develop. Integration specs fail locally with 401 on login (NIMBUS-236): follow plan.md section 10."

## 2026-10-26 — Plan approved

- Outcome: Klaus Petersen approved the plan as written (required email and password; NIMBUS-236
  401-only failures recorded as "code complete, unverified"); no second-model review. Jira
  sub-tasks created: NIMBUS-252 (task 01, backend), NIMBUS-253 (task 02, storefront), component
  Customer Portal; "plan approved" comment on NIMBUS-243. Manifest Issue column filled,
  `Ready for Dispatch: true`. Not committed.
- Next owner: the human (separate go-ahead to start task-dispatcher).
- Handover prompt: "Dispatch NIMBUS-243 (issues/NIMBUS-243/manifest.md) on feature/NIMBUS-243 from
  develop. Integration specs fail locally with 401 on login (NIMBUS-236): follow plan.md section 10."

## 2026-10-26 — Implemented, at the gate before push

- Outcome: task-dispatcher ran both tasks on `feature/NIMBUS-243` (from develop 6187799). Task 01
  (NIMBUS-252) committed 4123659, task 02 (NIMBUS-253) committed 222905a; both reviewed and
  approved, sub-tasks Done in Jira. Consolidation: no changes. Integration review approved;
  `deviation-report.md` written, no design findings. Backend unit 1110/1110, lint 0 errors,
  typecheck 22 = baseline, build ok. Storefront 3 baseline test failures only, typecheck 8 =
  baseline, build compiles but needs a running backend for page data. The two touched contract
  specs did not start (no `apps/backend/.env`; BC test-environment guard refused): code complete,
  unverified. NIMBUS-243 left at Estimation (only path to In Progress is "Estimate approved").
  Not pushed.
- Next owner: the human (answer the three open questions in `deviation-report.md`).
- Handover prompt: "Resume task-dispatcher for NIMBUS-243 at 'After the gate' with these answers to
  deviation-report.md open questions: 1. <a/b/c>, 2. <...>, 3. <...>."

## 2026-10-26 — Gate answered, integrated with develop and merged

- **Owner:** task-dispatcher, on Klaus Petersen's gate answers and his decision to push and merge
  into `develop` (relayed by the coordinator).
- **Gate answers:** (1) the two contract cases ship as "code complete, unverified because the local
  integration environment is not set up"; (2) estimate accepted, NIMBUS-243 to In Progress; (3)
  wrap-width nit fixed. Recorded in `deviation-report.md`.
- **After the gate:** gate answers d6412cb; doc re-flow 2e904be (reviewed); documentation writer:
  no further docs; scope marked Implemented f86bcb4; working files removed b206be0. Branch pushed
  to `origin/feature/NIMBUS-243`. No pull request opened: the GitHub CLI is not installed on this
  machine; the PR description is in the dispatcher's run folder. Merged into `develop` with a merge
  commit (develop had gained only a NIMBUS-209 case-folder entry; no conflicts, no code change, so
  the finalization results stand).
- **Verification:** backend unit 83 suites / 1110 tests pass; lint 0 errors; typecheck 22 =
  baseline; build OK. Storefront lint 0 errors; typecheck 8 = baseline; 3 baseline test failures
  (`money`, two `product-tabs`); build compiles, page data needs a running backend. HTTP specs
  `employee-invitation` and `security-boundaries` did not start locally (no `apps/backend/.env`).
- **Tracker:** NIMBUS-252 and NIMBUS-253 Done. NIMBUS-243 still at Estimation: the transition
  through "Estimate approved" was refused by the permission system for the agent; gate comment
  added.
- **Not yet verified (after deploy):** store `POST /store/companies/<own id>/employees` with
  `customer_id` answers 400; the portal invite card still creates an employee; Medusa Cloud logs
  show no unexpected 400s on that route.
- **Next owner:** Klaus Petersen: move NIMBUS-243 through "Estimate approved" (and on to review),
  deploy, run the after-deploy checks, then close NIMBUS-243.
