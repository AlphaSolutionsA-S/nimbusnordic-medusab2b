# i18n Foundation & Routing Integration

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-163
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-163/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-163/SCOPE.md` (approved) and plan the next-intl integration wired into the storefront's existing country/region routing (`apps/storefront/src/middleware.ts`). Depends on the country→language mapping from NIMBUS-164.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Depends on NIMBUS-164 Task 01 (`country-language-map.ts`) — implement 164 first or as a prerequisite step of this branch.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-163/manifest.md`'s 3 tasks in order (01 next-intl setup, 02 message catalog scaffolding, 03 shared locale layout & provider wiring) per their implementation files in the same folder. Verify the installed next-intl version's manual-locale API before finalizing `src/i18n/request.ts` — the plan flags this as version-sensitive.
