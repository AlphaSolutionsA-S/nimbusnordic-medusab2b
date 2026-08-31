# Translated Content for All Locales

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-167
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-167/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-167/SCOPE.md` (approved) and plan machine-translating the extracted English message catalog (from NIMBUS-165) into the 7 remaining locales, loading it into each locale's catalog. No formal human review step for this story.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready but **not cleared for dispatch** — Task 01 needs an MT provider/API decision (DeepL, Google Cloud Translate, Azure Translator, etc.) that this plan doesn't make unilaterally. Depends on NIMBUS-165 being complete (English keys extracted).
- **Handover to:** implementor agent (after the MT provider question is resolved with the user)
- **Handover prompt:** Once an MT provider is chosen, implement `issues/NIMBUS-167/manifest.md`'s 2 tasks (01 translation script, 02 MT output sanity spot-check) per their implementation files in the same folder.
