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
