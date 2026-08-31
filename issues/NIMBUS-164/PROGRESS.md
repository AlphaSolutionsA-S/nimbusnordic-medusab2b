# Country → Language Mapping Config

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-164
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-164/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-164/SCOPE.md` (approved) and plan the country→language config file (DK/GB/SE/NO/PL/IT/FR/DE mapped to da/en/sv/no/pl/it/fr/de, fallback English), plus confirming/adding the corresponding Medusa Store Regions and updating `DEFAULT_REGION` in `apps/storefront/src/middleware.ts`.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. No blocking cross-project dependency — this story should land first since NIMBUS-163 and NIMBUS-166 both depend on its Task 01.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-164/manifest.md`'s 3 tasks (01 country-language config file, 02 add missing Medusa regions/countries NO+PL, 03 update DEFAULT_REGION fallback to gb) per their implementation files in the same folder. Verify Medusa module service method names in Task 02's script against the installed `@medusajs/medusa` version before finalizing.
