# NIMBUS-133 — Progress

## 2026-10-23 — Scope draft prepared
- **Owner:** scoper, following triage of the existing Story “Forget password flow”.
- **Outcome:** Created FEATURE.md and SCOPE.md with proposed recovery outcomes, business rules, draft data/security tables, exclusions and current-code evidence. Full pipeline confirmed because account recovery concerns authentication and spans storefront/backend. No implementation or planning started.
- **Decisions outstanding:** outbound mail service/sender and reset email language; link lifetime/replacement policy and whether recovery must immediately invalidate existing sessions. All proposed scope rules await review.
- **Tracker:** Jira is the source of truth for assignee/status. No scope-approved event or ready-state transition is authorized before actual scope approval.
- **Next owner:** Klaus Petersen for scope decisions and approval; scoper to revise and record the approved scope. Implementation-planner requires a separate subsequent instruction.
- **Handover prompt:** Review issues/NIMBUS-133/SCOPE.md, answer its two open questions, and confirm the proposed audience, rules and data/security boundaries. Do not start implementation planning yet.
- **Verification:** Source/documentation/tracker inspection only. No delivery, reset, session invalidation or deployed result verified. Case files are local working files until committed and reviewed.

## 2026-10-23 — Scope decisions resolved
- **Owner:** scoping follow-up on Klaus Petersen's answers.
- **Outcome:** Updated FEATURE.md and SCOPE.md. Use Medusa Notification on channel `email` with the existing provider setup; adding/provisioning a provider or sender/domain is outside scope. English reset email is the retained default; broader localization stays in NIMBUS-162. Link validity is 15 minutes, single-use, latest link only. Existing sessions follow standard Medusa behaviour without custom revocation or a promise of logout on other devices. No outstanding scope business questions.
- **Reference:** No custom invitation-notification handler was found in source. Installed invitation workflows emit events; the installed configurable-notifications subscriber demonstrates `createNotifications` with channel `email`. This is source evidence of the convention, not proof of invitation email delivery. Secrets must not be sent to the configured local logger.
- **Tracker:** Decision comment 255196 added to NIMBUS-133 without modifying its description. Fetched valid transitions and applied `Scope approved` (611); Jira returned status **Estimation**. Assignee remains Klaus Petersen.
- **Next owner:** Klaus Petersen for estimation/next-stage instruction. Implementation planning and implementation have not started; no commit or push performed.
- **Handover prompt:** Read this entry and SCOPE.md. If implementation planning is requested, verify remaining Medusa security/runtime properties and existing email-provider behaviour before dispatch; do not add mail infrastructure or custom session revocation.
- **Verification:** Documentation-only update and installed-source reference inspection. Jira returned the decision comment and Estimation status. No email sent, runtime flow exercised or deployed result verified; case files remain local and uncommitted.

## 2026-10-23 — Scope publication authorized
- **Owner:** Codex, following Klaus Petersen's instruction to commit and push.
- **Outcome:** Prepared the three scope documents for publication on `feature/NIMBUS-133`; no implementation changes included.
- **Verification:** Reviewed the scope documents and confirmed that the working tree contains only this case folder. Application tests are not applicable to this documentation-only change; staged whitespace validation runs before commit.
- **Next owner:** Klaus Petersen for estimation or a separate implementation-planning instruction.
- **Handover prompt:** Use the agreed SCOPE.md and the preceding decisions entry; implementation planning has not started.

## 2026-10-23 — Implementation plan drafted and risks accepted
- **Owner:** implementation-planner investigation, completed by Codex after the user's follow-up decisions.
- **Outcome:** PLAN.md, manifest.md and three task briefs cover backend recovery/Notification, public translated storefront forms, integration verification/documentation. No application code changed; no Jira children or plan-approved event yet.
- **Klaus's decisions:** "logning af token er ikke bekymring" and "samtidigt genbrug accepteres som risk". These supersede earlier no-token-logging and atomic one-winner requirements in this case. No local-provider guard, special token retention cleanup, custom lock or token store. Sequential single-use/latest-link remains.
- **Evidence:** Installed Medusa 2.21.2 generates 900-second proofs and stores fingerprints. Consumption reads/checks/deletes without proven concurrent atomicity. Notification persists before send; local provider logs data. Both risks are accepted.
- **Verification limits:** PostgreSQL connection returned ECONNREFUSED. Supported validation ordering before core consumption remains UNVERIFIED and must be resolved by the planner before dispatch. No mail delivery, reset or runtime security outcome verified.
- **Next owner:** Klaus for plan review; planner resolves middleware ordering before task-dispatcher handoff. Recommend different-model-family review for authentication work.
- **Handover prompt:** Review PLAN.md/manifest.md. Do not reopen accepted logging/concurrency risks. No implementation before plan gate. New drafts are uncommitted; previous scope publication is commit d12b272 on origin/feature/NIMBUS-133.

## 2026-10-23 — Plan verification completed
- **Owner:** Codex.
- **Outcome:** Closed the middleware-order assumption from installed framework router/sorter source and runnable samples/verify-reset-order.cjs: exact static project matcher precedes parameterized core matcher. This supports validation before token consumption without importing core internals. Three tasks remain the proposed plan.
- **Tracker:** Jira decision comment 255206 records Klaus's logging and concurrent-reuse risk acceptance. No plan-approved event, children or status transition performed.
- **Verification:** The installed RoutesSorter probe passed, returning project-validation then core-consume. This proves ordering, not implemented HTTP validation, mailbox delivery or deployed recovery. PostgreSQL remains unavailable for later integration checks.
- **Next owner:** Klaus for plan review/approval; only then record child tasks and request the separate dispatcher handoff per ai/agents/implementation-planner.md.
- **Handover prompt:** Review PLAN.md, particularly new decisions and data/state/security tables. Accepted token logging/concurrent reuse are non-blocking; no custom provider guard, cleanup, token table or lock is authorized. Application code has not changed.

## 2026-10-23 — Plan approved and tracker tasks created
- **Owner:** Codex, following Klaus Petersen's explicit instruction: "plan godkendt".
- **Outcome:** Marked PLAN.md approved and manifest.md Ready for Dispatch true. All three manifest tasks remain TODO; no application code or dispatcher started.
- **Tracker:** Read NIMBUS-133 as Story, To Do, assigned to Klaus, Customer Portal; no existing subtasks. Created exactly three Sub-tasks under NIMBUS-133, each with Customer Portal: NIMBUS-228 Backend recovery and email, NIMBUS-229 Public translated recovery, NIMBUS-230 Verification and documentation. Recorded actual keys in the manifest. Plan-approved comment 255226 records the decisions, accepted risks, task breakdown and verification limits. Parent status unchanged.
- **Decisions:** Existing Notification email setup, English reset email, 15-minute sequential single-use/latest-link behaviour and default existing sessions remain agreed. Existing token logging/persistence and concurrent reuse risk stay accepted; no new guard, cleanup, token store or lock.
- **Verification:** Jira returned the three created issue keys and approval comment. Documentation-only changes in this stage; no application tests, mailbox delivery or runtime reset exercised. Existing PostgreSQL connectivity is needed for later integration tests.
- **Next owner:** Klaus Petersen for the separate task-dispatcher handoff instruction required by ai/agents/implementation-planner.md. No commit or push performed in this stage.
- **Handover prompt:** The plan is approved and marked ready. Hand off to task-dispatcher only after a separate instruction; then execute the manifest's three tasks in order with their tracker keys. Preserve accepted risks and all prior progress entries.

## 2026-10-23 — Backend recovery implementation ready for review
- **Owner:** task 01 tdd-worker, NIMBUS-228, following dispatcher handoff after approved plan and develop merge.
- **Outcome:** Added exact customer/emailpass recovery schemas before core proof consumption; thin reset subscriber and customer-only workflow reuse core Notification email dispatch with English content. Reset links use deployment-owned STORE_CORS and validated country metadata. Core Auth still owns credentials and proofs; accepted logging/persistence/concurrency risks and default sessions remain unchanged.
- **Verification:** Red unit run failed on absent implementation; final 17 unit tests pass. Real PostgreSQL HTTP checks pass 12 recovery cases across lifecycle and provider-failure runs, plus the new shared missing/login-token/GET negative (1 passed, 86 unrelated cases skipped). Lint succeeds with 0 errors and 13 pre-existing warnings. Whole-backend typecheck remains at the original 22 diagnostics, none in new files. No mailbox delivery or deployed runtime verified.
- **Environment:** Dispatcher supplied a separate temporary local PostgreSQL container; no existing database changed. Installed test-utils needs DB_HOST=localhost to avoid forced SSL. Scope logs are ignored under .tmp/NIMBUS-133-20261023-implementation. A broad security run unintentionally selected by Jest's literal -- handling was stopped; only the changed case was then run with the correct direct name filter.
- **Next owner:** task-dispatcher/code-reviewer for task 01 review and local commit, then storefront task NIMBUS-229. No git commit, push or tracker change performed by this worker.
- **Handover prompt:** Review 01-backend-recovery.md and branch-notes.md, then continue task 02 using the exact body fields and trusted /<country>/reset-password?token=... seam. Task 03 owns current architecture documentation, further cross-app regression and deployment evidence.
