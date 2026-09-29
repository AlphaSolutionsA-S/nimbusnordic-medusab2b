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
