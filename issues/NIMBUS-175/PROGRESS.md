# Admin translation editor for storefront UI text

- **Date:** 2026-09-30
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-175
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-175/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-175 (Admin translation editor for storefront UI text). Read `issues/NIMBUS-175/FEATURE.md` and the reference screenshot in `issues/NIMBUS-175/mockups/`. Study the current next-intl setup (`apps/storefront/messages/*.json`, `apps/storefront/src/i18n/request.ts`, `apps/storefront/src/lib/i18n/`) and existing admin customizations and custom modules in `apps/backend/src/`. Resolve the open questions with the user — above all whether the storefront reads translations from the DB at runtime or the DB is only an editing workspace whose export is committed back to the repo — plus import merge-vs-replace, how "diff towards file" gets the shipped file contents, label derivation, placeholder validation, and audit/role needs. Evaluate the proposed data model (one row per locale holding the full JSON). Write `issues/NIMBUS-175/SCOPE.md` and append a PROGRESS.md entry handing over to the implementation-planner.
