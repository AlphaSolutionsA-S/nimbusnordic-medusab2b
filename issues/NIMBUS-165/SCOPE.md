# Extract UI Text into Translation Keys

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-165
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-165/
- **Size:** L
- **Area:** Storefront (Next.js) — component migration
- **Base Branch:** develop

## Background

With the i18n foundation (NIMBUS-163) and message-catalog scaffolding in place, all existing
hardcoded UI copy needs to move into translation keys so it can be rendered per-locale.

## Requirements

### Functional

- Audit the storefront for hardcoded UI text: navigation, buttons, forms, checkout flow,
  validation/error messages, account pages, footer, and any other static copy.
- Extract each string into a translation key in the message catalogs established by
  NIMBUS-163, using the source (current, single-language) copy as the initial English/default
  content.
- Update components to read text via the translation-consumption pattern (`useTranslations` /
  `getTranslations`) instead of inline strings.

### Non-Functional

- No visual/behavioral regression — extracted strings must render identically to today until
  translated content (NIMBUS-167) is loaded for other locales.

## Affected Apps

- **storefront** only.

## Proposed Tasks

1. Inventory hardcoded UI strings across `modules/` and `app/`.
2. Add corresponding keys to the message catalogs per component/section.
3. Replace inline strings with translation-key lookups.
4. Spot-check rendered output matches current copy exactly (regression check).

## Open Questions

- None. Scoped as extraction only — no lint/CI safeguard against future hardcoded strings
  (explicitly descoped from this story per stakeholder decision; can be a later improvement).

## Dependencies

- Depends on **NIMBUS-163** (i18n foundation/message-catalog scaffolding).
- Feeds **NIMBUS-167** (translated content) — the keys created here are what gets translated.
- Parent epic: **NIMBUS-159**.
