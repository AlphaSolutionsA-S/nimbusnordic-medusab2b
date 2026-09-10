# i18n Foundation & Routing Integration

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-163
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions (8 target locales, country=language 1:1 coupling, no independent language switcher).
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-163/
- **Size:** M
- **Area:** Storefront (Next.js) — i18n foundation
- **Base Branch:** develop

## Background

First story under the Multi-lingual Storefront epic. Lays the technical foundation other
stories build on: a translation mechanism wired into the storefront's existing country/region
routing, so the language shown follows the visitor's country segment with no new URL
structure.

## Requirements

### Functional

- Integrate **next-intl** into the Next.js App Router storefront (Server Components-first).
- Resolve the active locale from the existing `/{countryCode}/...` routing and
  `getCountryCode`/`getRegionMap` logic in `middleware.ts` — no separate locale URL segment.
- Consume the country→language mapping produced by NIMBUS-164 as the source of truth for
  country-to-locale resolution.
- Provide message-loading scaffolding (per-locale message files/catalogs) that NIMBUS-165
  (string extraction) and NIMBUS-167 (translated content) will populate.
- Establish the pattern for components to consume translations (e.g. `useTranslations` /
  `getTranslations`) for later stories to follow.

### Non-Functional

- No regression to the existing region/currency resolution behavior in `middleware.ts`.
- No significant bundle-size/performance regression from adding next-intl.

## Affected Apps

- **storefront** only.

## Proposed Tasks

1. Add `next-intl` dependency and provider setup (root layout).
2. Extend `middleware.ts`/layout to resolve locale from the country code via the NIMBUS-164
   mapping.
3. Create initial (placeholder) message catalogs for the 8 target locales.
4. Document the translation-consumption pattern for other stories to follow.

## Open Questions

- None specific to this story. Depends on the "en" country-mapping decision owned by
  NIMBUS-164.

## Dependencies

- **NIMBUS-164** (country→language mapping config) — this story consumes that mapping;
  sequence together or land 164 first.
- Parent epic: **NIMBUS-159**.
