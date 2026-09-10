# Country → Language Mapping Config

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-164
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-164/
- **Size:** S
- **Area:** Storefront (Next.js) — config / Medusa Store Regions
- **Base Branch:** develop

## Background

The i18n foundation (NIMBUS-163) needs a single source of truth mapping each supported
country to its language. This story defines that mapping and ensures the corresponding
Medusa Store Regions/countries exist.

## Requirements

### Functional

- Add a developer-maintained code/config file (not an admin UI, not env vars — confirmed
  during epic scoping) declaring:

  | Country (ISO 3166-1 alpha-2) | Language |
  |---|---|
  | DK | da (Danish) |
  | GB | en (English) |
  | SE | sv (Swedish) |
  | NO | no (Norwegian) |
  | PL | pl (Polish) |
  | IT | it (Italian) |
  | FR | fr (French) |
  | DE | de (German) |

- Any country not in this table falls back to **English (en)**.
- Confirm Medusa Store Regions/countries exist for all 8 target countries above; add any
  that are missing (via Medusa Admin or seed data, per implementation-planner's discretion).
- Update the `DEFAULT_REGION` fallback (currently `"us"` in `middleware.ts`, see
  `apps/storefront/src/middleware.ts:6`) to align with the new English/GB default.

### Non-Functional

- Mapping must be easy for developers to extend when a new country/language is added later.

## Affected Apps

- **storefront** — config file, `DEFAULT_REGION` update.
- Medusa Admin (data only) — confirm/add regions & countries; no admin UI code changes.

## Proposed Tasks

1. Add the country→language config file with the table above and an explicit fallback entry.
2. Audit existing Medusa Store Regions; add DK/GB/SE/NO/PL/IT/FR/DE countries to regions as
   needed.
3. Update `DEFAULT_REGION` env var / fallback logic to English/GB.

## Open Questions

- None outstanding — "en" country mapping (GB) and fallback (English) resolved during
  scoping.

## Dependencies

- Feeds **NIMBUS-163** (i18n foundation), which consumes this mapping.
- Parent epic: **NIMBUS-159**.
