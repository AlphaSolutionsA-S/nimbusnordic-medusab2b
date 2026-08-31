# Task 02: Message Catalog Scaffolding — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-163 (from develop)
**Depends on:** Task 01 (import path `messages/${locale}.json` must match)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest
- **Test location:** `apps/storefront/src/__tests__/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Create one message catalog JSON file per supported locale (8 total, from `SUPPORTED_LOCALES` in
`country-language-map.ts`), at `apps/storefront/messages/<locale>.json`. These start as
placeholders with a single namespaced key so the loading mechanism (Task 01) and the
translation-consumption pattern (Task 03) have something real to exercise. NIMBUS-165 (string
extraction) will populate these with actual UI keys; NIMBUS-167 (translated content) will populate
the 7 non-English locales with real translations. This task's placeholders are intentionally
minimal — do not attempt to pre-populate real UI strings here, that is NIMBUS-165's scope.

## Code Skeletons

### New File: `apps/storefront/messages/en.json`

```json
{
  "Common": {
    "welcome": "Welcome"
  }
}
```

### New Files (identical structure, placeholder English content pending NIMBUS-167 translation):
`apps/storefront/messages/da.json`, `sv.json`, `no.json`, `pl.json`, `it.json`, `fr.json`, `de.json`

```json
{
  "Common": {
    "welcome": "Welcome"
  }
}
```

### New File: `apps/storefront/src/__tests__/lib/i18n/message-catalogs.test.ts`

```typescript
import { SUPPORTED_LOCALES } from '@/lib/i18n/country-language-map'

describe('message catalogs', () => {
  it.each(SUPPORTED_LOCALES)('has a valid, parseable catalog for locale "%s"', (locale) => {
    const catalog = require(`../../../../messages/${locale}.json`)
    expect(catalog).toHaveProperty('Common.welcome')
  })
})
```

## Impacted Files

- New: `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json` (8 files, identical placeholder
  content).
- New: `apps/storefront/src/__tests__/lib/i18n/message-catalogs.test.ts`.

## Test Cases

### TC-1: Every supported locale has a catalog file
- **Given:** `SUPPORTED_LOCALES` from `country-language-map.ts`
- **When:** the test iterates and `require`s `messages/<locale>.json` for each
- **Then:** none throw a module-not-found error

### TC-2: Every catalog has the placeholder key
- **Given:** any of the 8 catalog files
- **When:** parsed as JSON
- **Then:** `catalog.Common.welcome` is a non-empty string

## Implementation Steps

1. Create `apps/storefront/messages/` directory.
2. Add all 8 locale JSON files with identical placeholder content.
3. Add the test file above.
4. Run `pnpm test message-catalogs`.
5. Run `pnpm lint` (JSON files aren't linted by ESLint, but confirm no import errors elsewhere).
