# Region Switcher

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-166
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-166/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-166/SCOPE.md` (approved) and plan a site-wide header region switcher (redirects to the selected region's homepage), kept distinct from the existing checkout/account country-select. Depends on NIMBUS-164's country/language list.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Depends on NIMBUS-164 Task 01 for language labels; does not hard-block on NIMBUS-163/165.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-166/manifest.md`'s 2 tasks (01 region switcher component reusing the existing `NativeSelect` primitive, 02 mobile layout & country-select conflict check) per their implementation files in the same folder.
