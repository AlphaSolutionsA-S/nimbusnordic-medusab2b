# Cross-locale QA

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-169
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-169/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-169/SCOPE.md` (approved) and plan setting up automated visual regression testing (greenfield — no existing tool) covering desktop and mobile across all 8 locales for home/PLP/PDP/cart/checkout/account, plus functional checks on the region switcher (NIMBUS-166) and locale-correct links. This is the epic's final verification pass — depends on NIMBUS-163 through NIMBUS-168 being substantially complete.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Task 01 (Playwright setup) can be dispatched independently/early; Tasks 02–04 need NIMBUS-163–168 substantially complete to test against real translated/localized pages. Task 04 (triage/fix) is scoped as a reactive process, not fixed file edits — see PLAN.md.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-169/manifest.md`'s 4 tasks in order (01 Playwright setup, 02 baseline screenshots, 03 functional checks, 04 triage/fix layout breaks). Task 04's actual scope depends on what Tasks 02/03 find when run against the fully-localized storefront — treat it as a process to follow, not a pre-specified diff.
