# Task 01: Install next-intl and Wire Provider — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-163 (from develop)
**Depends on:** NIMBUS-164 Task 01 (`country-language-map.ts` must exist)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (jsdom)
- **Test location:** `apps/storefront/src/__tests__/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Install `next-intl` and wire it into the **existing** `/{countryCode}/...` routing — there is no
new URL segment for locale (confirmed in NIMBUS-159 scoping: language is derived, not
independently routed). This means next-intl is used in its "no i18n routing" / manual-locale mode:
locale is resolved server-side from `params.countryCode` (via `getLocaleForCountry` from
NIMBUS-164) and passed explicitly to `getRequestConfig` / `NextIntlClientProvider`, rather than
using next-intl's own `[locale]` routing middleware (which would conflict with the existing
`middleware.ts` region-based redirect logic).

Key exploration findings this design builds on:
- `apps/storefront/src/app/layout.tsx` — root layout, hardcodes `<html lang="en">`, has no
  `params`. This needs to become locale-aware, but the root layout has no access to
  `params.countryCode` (that only exists one level down, under `[countryCode]/`).
- There is no `[countryCode]/layout.tsx` — only `(main)/layout.tsx` and `(checkout)/layout.tsx`
  route-group layouts exist under `[countryCode]/`.
- `apps/storefront/next.config.js` currently exports a plain object with no plugin wrapper —
  `createNextIntlPlugin()` can wrap it directly with no composition conflicts.

Because two independent route groups — `(main)` and `(checkout)` — both sit under
`[countryCode]/` and both need the same locale resolution + provider wiring, and neither the root
layout nor a shared `[countryCode]/layout.tsx` exists today, this task creates
**`apps/storefront/src/app/[countryCode]/layout.tsx`** as a new shared layout that both route
groups nest under. This is the standard Next.js App Router pattern for sharing logic across
sibling route groups and avoids duplicating the locale-resolution logic in two places.

## Code Skeletons

### New File: `apps/storefront/src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'

import { getLocaleForCountry } from '@/lib/i18n/country-language-map'

export default getRequestConfig(async ({ requestLocale }) => {
  const countryCode = await requestLocale
  const locale = getLocaleForCountry(countryCode ?? '')

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
```

> **Worker note:** `next-intl`'s `getRequestConfig` signature expects `requestLocale` to resolve
> to a *locale*, not a country code, in its default routing mode. Since this project does not use
> next-intl's routing middleware (see Solution Design), `requestLocale` will need to be supplied
> explicitly via `setRequestLocale(locale)` called from the new `[countryCode]/layout.tsx` (Task
> 02) rather than relying on next-intl to infer it from a URL segment. Verify the current
> `next-intl` major version's recommended manual-locale pattern (check `node_modules/next-intl/package.json`
> version and its `README`/docs for "usage without i18n routing") before finalizing this file —
> the exact API (`setRequestLocale` vs. passing `locale` directly to `NextIntlClientProvider`) may
> differ slightly by version.

### Modified File: `apps/storefront/next.config.js`

```javascript
const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
  // ...existing config unchanged...
}

module.exports = withNextIntl(nextConfig)
```

## Impacted Files

- `apps/storefront/package.json`: add `"next-intl"` to `dependencies` (latest stable version
  compatible with Next.js 15 / React 19 — verify via `pnpm info next-intl` at implementation time).
- `apps/storefront/next.config.js`:
  - Add `const createNextIntlPlugin = require('next-intl/plugin')` and
    `const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')` before the config object.
  - Change the final export from `module.exports = nextConfig` to
    `module.exports = withNextIntl(nextConfig)`.
- New: `apps/storefront/src/i18n/request.ts` (above).

## Test Cases

### TC-1: Config loads without throwing
- **Given:** the updated `next.config.js`
- **When:** `next build` runs (or the Jest config, which uses `next/jest`, loads the app)
- **Then:** no next-intl plugin/config errors are thrown

### TC-2: `getRequestConfig` resolves messages for a known country
- **Given:** `requestLocale` resolves to `dk`'s associated locale (`da`) via
  `getLocaleForCountry`
- **When:** the config function in `src/i18n/request.ts` is invoked (unit-test by importing and
  calling it directly with a mocked `requestLocale` promise)
- **Then:** it returns `{ locale: 'da', messages: <parsed da.json> }`

### TC-3: Unmapped country falls back to default locale's messages
- **Given:** `requestLocale` resolves to an unmapped country code (e.g. `us`)
- **When:** the config function runs
- **Then:** it returns `{ locale: 'en', messages: <parsed en.json> }` (uses `DEFAULT_LOCALE`)

## Implementation Steps

1. Add `next-intl` to `apps/storefront/package.json` and run `pnpm install`.
2. Verify the installed `next-intl` version's recommended pattern for manual (non-routed) locale
   resolution — adjust `src/i18n/request.ts` accordingly if the API differs from the skeleton
   above.
3. Update `next.config.js` with the plugin wrapper.
4. Add `src/i18n/request.ts`.
5. Note: `messages/<locale>.json` files referenced by the dynamic import don't exist yet — Task 02
   (this same issue) creates the placeholder catalogs. Do not implement Task 02's files here;
   just ensure the import path matches exactly.
6. Add unit tests for TC-2/TC-3 (these can run before Task 02's placeholder catalogs exist if the
   test mocks the dynamic import, or run them after Task 02 lands — cross-task dependency, see
   manifest).
7. Run `pnpm lint` and `pnpm build`.

## Risks

- **Version-specific API risk:** next-intl's non-routed usage pattern differs across major
  versions (v3 vs. v4). The worker must check the installed version's docs before finalizing
  `request.ts` — do not guess the API shape.
