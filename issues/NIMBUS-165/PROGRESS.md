# Extract UI Text into Translation Keys

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-165
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-165/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-165/SCOPE.md` (approved) and plan the audit/extraction of hardcoded storefront UI strings into translation keys (extraction only, no lint/CI safeguard). Depends on NIMBUS-163's message-catalog scaffolding.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Depends on NIMBUS-163 (message catalogs + translation-consumption pattern) being implemented first.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-165/manifest.md`'s 5 tasks in order (01 namespace convention & checklist, 02 layout strings, 03 checkout strings, 04 account/auth strings, 05 remaining modules sweep). Task 05 covers ~190 remaining `.tsx` files against the tracked checklist — expect to split it across multiple work sessions if needed, using `extraction-checklist.md` as the resumption point.
