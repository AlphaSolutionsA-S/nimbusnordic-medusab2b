# Ensure Business Central company data is fresh before viewing Company page

- **Date:** 2026-08-21
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-160/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage. Note: an earlier attempt to implement this directly (before creating the tracker issue) was reverted with no leftover changes — no code exists yet for this feature.
- **Handover to:** scoper agent
- **Handover prompt:** `@scoper Please scope NIMBUS-160. Jira issue: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160. Interview me interactively before writing any scope document. Two known open questions to raise during the interview: (1) should the 10-minute freshness check live purely in the backend GET /store/companies/[id] route, or does the storefront also need to track "last synced at"; (2) should a failed sync attempt still count as "attempted" for throttling purposes.`

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope completed after stakeholder interview. The backend Company GET route will orchestrate automatic freshness checks using a persisted successful-sync timestamp. It returns stale data when Business Central sync fails and retains the old timestamp so the next request retries. No manual refresh UI or storefront freshness state is included.
- **Handover to:** implementation-planner agent
- **Handover prompt:** `@implementation-planner Create PLAN.md, a dependency-ordered manifest, and implementation task files for NIMBUS-160 using issues/NIMBUS-160/SCOPE.md. Reuse the existing company Business Central workflow; preserve stale company data and its old successful-sync timestamp when synchronization fails.`
