# Company freshness sync can refresh the wrong company

- **Date:** 2026-08-24
- **Type:** Bug
- **Tracker:** JIRA — [NIMBUS-161](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-161) (relates to NIMBUS-160)
- **Priority:** High
- **Project Folder:** issues/NIMBUS-161/
- **Updated by:** bug reporting skill
- **Outcome:** Bug captured in BUG.md; JIRA issue NIMBUS-161 created and linked (Relates) to NIMBUS-160; folder renamed from the temporary case id to NIMBUS-161.
- **Handover to:** scoper agent
- **Handover prompt:** Determine the detailed scope for fixing the Business Central freshness sync mismatch described in BUG.md — the fix likely lives in `apps/backend/src/api/store/companies/[id]/route.ts` (and possibly `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`), ensuring the sync only ever targets the company identified by `:id`, not whatever company the authenticated customer happens to belong to. Create SCOPE.md in this folder.

# Scope approved

- **Date:** 2026-09-29
- **Type:** Bug
- **Tracker:** JIRA — [NIMBUS-161](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-161)
- **Priority:** Medium (downgraded from High)
- **Project Folder:** issues/NIMBUS-161/
- **Updated by:** Claude Code (scoping with klp@alpha-solutions.dk)
- **Outcome:** SCOPE.md written and approved. Code review found that `GET /store/companies/:id` is already protected by `ensureCompanyAccess`, so the IDOR claim in BUG.md was wrong; BUG.md now carries a correction and the severity is downgraded. What's left is a latent sync-target mismatch. Decisions: option (b), which syncs only when `:id` equals the caller's company and skips otherwise; backend only; work directly on develop.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan the fix described in issues/NIMBUS-161/SCOPE.md. Add an optional expected company id to `syncCompanyFromBusinessCentralWorkflow` / `prepareCompanyBcSyncStep` so the step returns `skipped` without a Business Central call when the customer's company differs. Pass `:id` from `GET /store/companies/:id` and leave the login sync route unchanged. Add test coverage for the mismatch case, keep the NIMBUS-160 freshness tests green, and plan the work directly on `develop`.

# Implementation plan ready

- **Date:** 2026-09-30
- **Updated by:** implementation-planner agent
- **Outcome:** The implementation plan is ready, and implementation is the next stage.
  - Written: `PLAN.md`, `manifest.md`, `01-backend-expected-company-guard-implementation.md` and
    `02-backend-expected-company-guard-tests-implementation.md`.
  - The plan was checked against develop `b9e751c`, which includes NIMBUS-157 (read-only
    projection, POST removed) and NIMBUS-160.
  - The manifest says `Ready for Dispatch: false` until the user approves the plan and answers
    OQ-1 (should a mismatch write a warn log line?).
- **Handover to:** implementor agent, after the user approves.
- **Handover prompt:** Implement NIMBUS-161 from issues/NIMBUS-161/manifest.md and its task
  files, working directly on `develop` with no feature branch.
  - **Task 01:**
    - Add optional `expectedCompanyId` to `PrepareCompanyBcSyncInput` and
      `SyncCompanyFromBusinessCentralInput`, and forward it in the workflow.
    - In `prepareCompanyBcSyncStep`, return `skipped` (with a `logger.warn`) before any Business
      Central call when the resolved company id differs.
    - Pass `expectedCompanyId: id` from `GET /store/companies/:id`.
    - Leave the login sync route unchanged.
  - **Task 02:**
    - Add the workflow-level mismatch and match tests to
      `integration-tests/http/customers/company-sync.spec.ts`.
    - Run that spec and `integration-tests/http/companies/companies.spec.ts` against a throwaway
      postgres:16 container, with the shell-only env vars given in PLAN.md → Verification.
      Never write a `.env` file.
  - Build and lint the backend. Do not commit or change Jira unless the user asks.


# Implementation complete

- **Date:** 2026-09-30
- **Updated by:** implementor agent (Claude Code)
- **Outcome:** Tasks 01 and 02 are DONE and the manifest is updated. The work is on
  `develop` and is not committed.
  - `prepare-company-bc-sync.ts`: new optional `expectedCompanyId`. On a mismatch the step
    writes a `logger.warn` naming both company ids and returns `skipped` before it resolves or
    calls Business Central (OQ-1 = yes).
  - `sync-company-from-business-central.ts`: the input type gains `expectedCompanyId`, which
    is forwarded to the step.
  - `store/companies/[id]/route.ts`: `GET` passes `expectedCompanyId: id`.
  - The login sync route (`sync-business-central/route.ts`) has no diff.
  - `integration-tests/http/customers/company-sync.spec.ts`: new describe block with TC-1
    (mismatch) and TC-2 (match), which run the workflow directly.
- **Deviations from plan:**
  - TC-1 setup uses `ModuleCompanySpendingLimitResetFrequency.MONTHLY` instead of
    `"monthly"`, because the skeleton literal did not typecheck against the enum in
    `ModuleCreateCompany`.
  - The new describe block also calls `jest.restoreAllMocks()` in a `beforeEach`. The
    existing login sync tests never restore their `getCustomer` spies, so TC-1 first saw
    5 leftover calls. The guard itself behaved correctly.
- **Validation:**
  - Integration (throwaway postgres:16, shell-only env vars): `company-sync.spec.ts` passed
    9/9 and `companies.spec.ts` passed 23/23, for 32 passed and 0 failed.
  - Fails without the guard: with the guard block removed temporarily, TC-1 failed (1 failed,
    8 passed; result `updated` instead of `skipped`). The file was then restored
    byte-identically, confirmed with `cmp` and `git diff`.
  - Unit tests: 19 suites and 104 tests passed.
  - `tsc --noEmit`: no errors in changed files. The 18 errors it reports are all in
    integration test files this work did not touch.
  - eslint on the three changed src files: clean. The spec file is excluded by the repo
    ignore pattern.
  - `corepack pnpm --filter @b2b-starter/backend build`: succeeded, with 13 lint warnings
    that are all in files this work did not touch.
- **Open items:**
  - Jira was not transitioned, per the instruction.
  - Nothing is committed.
  - Unrelated finding: the login sync tests leak `jest.spyOn` spies between tests. It was
    not fixed.
- **Handover to:** user (klp@alpha-solutions.dk) for review and commit.
- **Handover prompt:** Review the uncommitted NIMBUS-161 diff on `develop` (4 backend
  files and the issue docs). Commit it with the NIMBUS commit-message convention, then move
  NIMBUS-161 to Internal Review in Jira.
