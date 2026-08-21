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

- **Date:** 2026-08-21
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Produced `PLAN.md`, `manifest.md`, and five dependency-ordered task files (01 model+migration, 02 stamp-on-success, 03 GET freshness route, 04 storefront cache TTL, 05 integration tests). Base branch `develop`. Storefront cache decision revised per stakeholder: `retrieveCompany` gets `revalidate: 120` (≈12 min worst-case staleness) instead of full uncaching. Timestamp is written inside the existing sync workflow's `ready` update, so only successful syncs advance it; the GET route tolerates sync failures and returns last-known data.
- **Handover to:** implementor agent
- **Handover prompt:** `@implementor Implement NIMBUS-160 from issues/NIMBUS-160/manifest.md and the task files 01–05 in that folder, on branch feature/NIMBUS-160 from develop. Follow the dependency order (01 → 02 → 03 → 04, then 05). Keep all Business Central mutations inside the existing sync workflow; the GET route only orchestrates freshness and reads. Preserve stale company data and the prior successful-sync timestamp on failure.`
