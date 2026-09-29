# Multi-lingual storefront: remaining English text not translated

- **Date:** 2026-09-29
- **Type:** Bug
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-173
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-173/
- **Updated by:** bug reporting skill
- **Outcome:** Bug captured (parent epic NIMBUS-159, linked Relates NIMBUS-165); scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Read `issues/NIMBUS-173/BUG.md` and scope the fix for the remaining untranslated storefront text. Work out: (1) which findings in sections 1–5 are in scope, and whether catalog-value fixes (`altFallback`, `brandName`) and developer-only errors are included or excluded; (2) how to pass the active locale into `convertToLocale` and the hardcoded `en-GB`/`en-US` date/number formatters; (3) how to localise static `metadata` (convert to `generateMetadata` with `getTranslations`), and what the root `src/app/not-found.tsx` should do without a locale; (4) whether to map raw `err.message` / cart.ts errors and zod messages to translated keys; (5) whether to add a lint guard (e.g. `react/jsx-no-literals`) against new hardcoded strings. Then write `issues/NIMBUS-173/SCOPE.md` and hand over to implementation-planner.
