# Task 01: Country→Language Config File — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-164 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (jsdom)
- **Test location:** `apps/storefront/src/__tests__/` (mirrors source folder structure) — create `apps/storefront/src/__tests__/lib/i18n/country-language-map.test.ts`
- **Naming conventions:** kebab-case files, camelCase functions/vars, PascalCase types, UPPER_SNAKE_CASE constants (per `apps/storefront/copilot-instructions.md`)

## Solution Design

Add a single, developer-maintained source of truth mapping each supported country's ISO 3166-1
alpha-2 code to its language, with an explicit fallback. This is a plain TypeScript module (no
admin UI, no env vars — confirmed during epic scoping). It has no dependency on next-intl or any
other package — NIMBUS-163 will import `getLocaleForCountry`/`SUPPORTED_LOCALES` from here when it
wires up next-intl, but this task must not assume next-intl exists yet.

Directory `apps/storefront/src/lib/i18n/` does not exist yet — this task creates it.

## Code Skeletons

### New File: `apps/storefront/src/lib/i18n/country-language-map.ts`

```typescript
/**
 * Single source of truth mapping a country (ISO 3166-1 alpha-2, lowercase) to its
 * storefront language. Country and language stay coupled 1:1 — see NIMBUS-159.
 * Extend this map when a new country/region is added; no other file should hardcode
 * this mapping.
 */

export const SUPPORTED_LOCALES = [
  'da',
  'en',
  'sv',
  'no',
  'pl',
  'it',
  'fr',
  'de',
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const COUNTRY_LANGUAGE_MAP: Readonly<Record<string, Locale>> = {
  dk: 'da',
  gb: 'en',
  se: 'sv',
  no: 'no',
  pl: 'pl',
  it: 'it',
  fr: 'fr',
  de: 'de',
}

export function getLocaleForCountry(countryCode: string): Locale {
  return COUNTRY_LANGUAGE_MAP[countryCode.toLowerCase()] ?? DEFAULT_LOCALE
}
```

### New File: `apps/storefront/src/__tests__/lib/i18n/country-language-map.test.ts`

```typescript
import {
  COUNTRY_LANGUAGE_MAP,
  DEFAULT_LOCALE,
  getLocaleForCountry,
  SUPPORTED_LOCALES,
} from '@/lib/i18n/country-language-map'

describe('getLocaleForCountry', () => {
  it('resolves a known lowercase country code to its language', () => {
    expect(getLocaleForCountry('dk')).toBe('da')
  })

  it('resolves a known country code regardless of input casing', () => {
    expect(getLocaleForCountry('DE')).toBe('de')
  })

  it('falls back to the default locale for an unmapped country code', () => {
    expect(getLocaleForCountry('us')).toBe(DEFAULT_LOCALE)
  })

  it('maps every supported locale to at least one country', () => {
    const mappedLocales = new Set(Object.values(COUNTRY_LANGUAGE_MAP))
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(mappedLocales.has(locale)).toBe(true)
    })
  })
})
```

## Impacted Files

- New: `apps/storefront/src/lib/i18n/country-language-map.ts`
- New: `apps/storefront/src/__tests__/lib/i18n/country-language-map.test.ts`

No existing files are modified in this task — `middleware.ts`'s `DEFAULT_REGION` fallback is
handled in Task 03, and `next-intl` wiring is NIMBUS-163's responsibility.

## Test Cases

### TC-1: Known country resolves correctly
- **Given:** the country code `dk`
- **When:** `getLocaleForCountry('dk')` is called
- **Then:** it returns `'da'`

### TC-2: Case-insensitive lookup
- **Given:** the country code `DE` (uppercase)
- **When:** `getLocaleForCountry('DE')` is called
- **Then:** it returns `'de'`

### TC-3: Unmapped country falls back to default
- **Given:** a country code not in `COUNTRY_LANGUAGE_MAP` (e.g. `us`)
- **When:** `getLocaleForCountry('us')` is called
- **Then:** it returns `DEFAULT_LOCALE` (`'en'`)

### TC-4: Every supported locale is reachable
- **Given:** `SUPPORTED_LOCALES`
- **When:** cross-referenced against `COUNTRY_LANGUAGE_MAP`'s values
- **Then:** every locale in `SUPPORTED_LOCALES` appears at least once in the map's values

## Implementation Steps

1. Create `apps/storefront/src/lib/i18n/` directory.
2. Add `country-language-map.ts` with the exact contents above.
3. Add the test file above under `src/__tests__/lib/i18n/`.
4. Run `cd apps/storefront && pnpm test country-language-map` and confirm all 4 cases pass.
5. Run `pnpm lint` from repo root — no `any`, strict types, must pass clean.
