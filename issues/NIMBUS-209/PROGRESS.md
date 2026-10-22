# Progress

## 2026-10-22 — triage

- Outcome: request registered locally as `feature.md` (slug folder). No duplicate in Jira
  (`project = NIMBUS AND component = "Customer Portal"`, searched for Next.js, OpenNext, upgrade,
  storefront build). Jira issue not yet created: waiting for the human's yes.
- Proposed flow: full pipeline (`scoper` → `implementation-planner` → `task-dispatcher`).
- Next owner: human (approve Jira creation, then approve starting `scoper`).
- Handover prompt: "Create the Jira Story for issues/storefront-nextjs-16-upgrade, rename the folder
  to the key, then start the scoper on it."

## 2026-10-22 — Jira issue created

- Outcome: Klaus approved; Story NIMBUS-209 created (component `Customer Portal`, status Scoping)
  from `feature.md`. Folder renamed from `storefront-nextjs-16-upgrade` to `NIMBUS-209`.
- Next owner: `scoper` (Klaus approved starting it).
- Handover prompt: "Scope NIMBUS-209 from issues/NIMBUS-209/feature.md."

## 2026-10-22 — scoper

- Outcome: `scope.md` written (Story, full pipeline confirmed: checkout cache invalidation, about
  four tasks). Key findings: single-argument `revalidateTag` is deprecated in 16.4.2 and the `"max"`
  form would serve stale carts, so invalidation keeps immediate expiry (`updateTag` in server
  actions); the account `@dashboard`/`@login` slots need `default.tsx`; `next lint` is gone; OpenNext
  1.20.13 supports only Next `>=16.4.1` in the 16 line. Not yet recorded in Jira: the "scope approved"
  comment and transition wait for Klaus's approval.
- Next owner: Klaus (approve the scope and answer the open questions; then a separate go-ahead for
  `implementation-planner`).
- Handover prompt: "Scope for NIMBUS-209 approved: record it in Jira, then (on a separate yes) plan
  issues/NIMBUS-209/."

## 2026-10-22 — scope approved

- Outcome: Klaus approved the scope. Jira comment added (business rules, key decisions, the four open
  questions, still unanswered) and NIMBUS-209 moved to Estimation via "Scope approved".
- Next owner: Klaus (answer the open questions; separate go-ahead for `implementation-planner`).
- Handover prompt: "Plan NIMBUS-209 from issues/NIMBUS-209/scope.md."

## 2026-10-22 — open questions answered

- Outcome: Klaus answered the scope's open questions (recorded as a Jira comment on NIMBUS-209):
  1. Wrangler on Medusa Cloud: accept the risk (OpenNext only warns); covered by a smoke test.
  2. Verification: the Medusa Cloud preview environment of the pull request, before merge to
     `develop`.
  3. React stays at 19.0.5.
  4. The `middleware.ts` deprecation warning is accepted; the `proxy.ts` rename is NIMBUS-210
     (linked "relates to").
- Next owner: `implementation-planner` (Klaus starts it).
- Handover prompt: "Plan NIMBUS-209 from issues/NIMBUS-209/scope.md; the open questions are answered
  in PROGRESS.md."

## 2026-10-22 — implementation-planner

- Outcome: `plan.md`, `manifest.md` and four task files written (01 build, 02 checkout
  searchParams, 03 cache invalidation, 04 ESLint flat config). Jira sub-tasks NIMBUS-211..214
  created under NIMBUS-209 (component Customer Portal). No framework assumption is UNVERIFIED
  (checked against the next@16.4.2, @opennextjs/aws@4.1.12 and next-intl 4.14.1 sources plus a lint
  probe). New finding: under Next.js 16 the checkout page's synchronous `searchParams?.cartId` read
  would send an approving admin to their own cart (task 02). Two decisions wait for Klaus:
  (1) signed-out deep links to account pages: 404 as today, or the login form; (2) the 23
  pre-existing React Compiler lint errors: suppression baseline, warnings, or fix.
  `Ready for Dispatch: false`. The "plan approved" Jira comment is not yet posted.
- Next owner: Klaus (answer the two decisions in plan.md section 2, approve the plan; then a separate
  go-ahead for `task-dispatcher`).
- Handover prompt: "Plan for NIMBUS-209 approved with answers <1>, <2>: record the answers in
  plan.md, set Ready for Dispatch, post the plan-approved comment on NIMBUS-209."

## 2026-10-22 — implementation-planner (decisions answered)

- Outcome: Klaus answered both Critical decisions, and they are recorded in plan.md section 2.
  (1) Signed-out deep account links redirect to `/<countryCode>`. This replaces scope rule R4 for
  deep links and today's 404, as Klaus's decision of 2026-10-22. (2) React Compiler findings go into
  an `eslint-suppressions.json` baseline with the rules kept at error.
- I checked next@16.4.2 for a redirect pitfall and found none. A redirect thrown in a slot the
  layout does not render only becomes a digest, the same mechanism today's built-in `notFound()`
  default relies on, so signed-in users are not redirected. The front page is outside `account`,
  so there is no loop.
- Added: the redirect target is built from the URL-encoded country segment, with an open-redirect
  negative test.
- Updated: plan.md (sections 1, 2, 3D, 4, 7, 8, 9, 10), 01 and 04 task files, manifest, and the
  NIMBUS-211 description. Nothing new blocks dispatch.
- Plan not yet approved: Ready for Dispatch stays false, and no plan-approved comment is posted.
- Next owner: Klaus (approve the plan; separate go-ahead for `task-dispatcher`).
- Handover prompt: "Plan for NIMBUS-209 approved: set Ready for Dispatch, post the plan-approved
  comment on NIMBUS-209."

## 2026-10-22 — plan approved

- Outcome: Klaus approved the plan and gave the go-ahead for dispatch. "Plan approved" comment
  posted on NIMBUS-209 (new decisions and both answers); `Ready for Dispatch: true` in the manifest.
- Next owner: `task-dispatcher`.
- Handover prompt: "Dispatch issues/NIMBUS-209/."

## 2026-10-22 — task-dispatcher (stopped at the implementation gate)

- Outcome: tasks 01–04 done, reviewed and committed locally on `feature/NIMBUS-209` (ed3cf4b,
  137a02f, a0d9438, 2d8147d; consolidation ba0226c). NIMBUS-211..214 closed with comments;
  NIMBUS-215 created for clearing the lint suppressions. Finalization: storefront Jest has the same
  4 pre-existing failures, tsc 8 (= baseline), lint 0 errors, build passes on Next.js 16.4.2
  (Turbopack) against a stub backend. Visual tests not run. `deviation-report.md` written, no
  blocking findings, four open questions. Nothing pushed. NIMBUS-209 left in Estimation (no direct
  transition to in progress).
- Next owner: Klaus (answer the open questions in `deviation-report.md`).
- Handover prompt: "NIMBUS-209 gate answers: <answers>. Resume task-dispatcher at 'After the
  gate' for issues/NIMBUS-209/."

## 2026-10-22 — task-dispatcher (after the gate)

- Outcome: Klaus passed the gate, accepting the proposed answer to each open question, and said to
  push and open the PR. Answers recorded in `deviation-report.md` and on NIMBUS-209; the
  region-switcher warning added to NIMBUS-215. NIMBUS-209 moved Estimation → To Do ("Estimate
  approved") → In Progress. `docs/architecture/store-access.md` and `country-languages.md` updated;
  scope marked Implemented; working files removed by cleanup. PR description written; branch pushed.
  The PR could not be opened: the GitHub CLI (`gh`) is not installed on this machine. NIMBUS-209
  stays In Progress until the PR exists.
- Next owner: Klaus (open the PR against `develop` with the prepared title and description, move
  NIMBUS-209 to review, run the after-deploy checklist on the PR's Medusa Cloud preview, then merge).
- Handover prompt: "Run the NIMBUS-209 PR preview checklist; on success merge to develop and close
  NIMBUS-209 with a closing comment."
