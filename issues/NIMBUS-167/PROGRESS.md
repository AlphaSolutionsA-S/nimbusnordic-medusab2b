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
- **Outcome:** Implementation plan is ready; implementation is the next stage. MT provider decided (DeepL, chosen for strength on European-language pairs covering all 7 targets). Depends on NIMBUS-165 being complete (English keys extracted) and a `DEEPL_API_KEY` being provisioned.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-167/manifest.md`'s 2 tasks (01 DeepL translation script, 02 MT output sanity spot-check) per their implementation files in the same folder. Task 01 needs a `DEEPL_API_KEY` provisioned before it can run against the real API; Norwegian must map to DeepL's `nb` code, not `no`.

- **Date:** 2026-09-01
- **Updated by:** user (translated content applied directly, outside the planned DeepL script)
- **Outcome:** User translated all 7 non-English message catalogs by hand/their own tooling and pushed directly to `develop` (commit `1d5676b`). Also corrected `MetaDescription.storeSuffix` in `en.json` from the placeholder `"| Medusa Store"` to `"| Nimbus Nordic"`. The planned DeepL script (Task 01/02) was not built or run — superseded by this direct translation pass.
- Verification performed: ran the full storefront suite. Found `Layout.regionSwitcher.label` (added by NIMBUS-166, after the translation snapshot) missing from all 7 non-English catalogs, failing `message-catalogs.test.ts`'s key-parity check. User asked me to fill it in directly. Added the key (translated "Select your region") to `da/de/fr/it/no/pl/sv.json`, and updated 3 NIMBUS-168 metadata tests that still hardcoded the old `"Medusa Store"` suffix. Full suite (134 suites / 244 tests) now passes. Committed and pushed to `develop` as `e1655f3`.
- **Outstanding:** none — all 8 catalogs have identical key structure and real (non-placeholder) content for every locale.
- **Handover to:** none — story complete.
