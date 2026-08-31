# Task 02: Extract Layout (Nav/Header/Footer) Strings — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-165 (from develop)
**Depends on:** Task 01 (namespace convention), NIMBUS-163 (translation pattern + message catalogs)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/modules/layout/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Extract hardcoded strings from `apps/storefront/src/modules/layout/templates/nav/index.tsx` (a
Server Component — use `getTranslations`, per the pattern from NIMBUS-163) into the `Layout`
namespace. This is a worked example other Task 02–05 files/areas follow.

Exact strings found during exploration (`nav/index.tsx`):
- Line 31: `"Medusa B2B Starter"` → `Layout.nav.brandName`
- Line 50: `placeholder="Search for products"` → `Layout.nav.searchPlaceholder`
- Line 52: `title="Install a search provider to enable product search"` → `Layout.nav.searchDisabledTooltip`
- Lines 65, 72: `<span>Quote</span>` → `Layout.nav.quoteLabel`

Also extract the `Footer` component's strings — locate `apps/storefront/src/modules/layout/templates/footer`
(referenced in `templates/index.tsx`) and apply the same pattern; exact strings weren't enumerated
during exploration, so the worker must read that file directly before extracting (do not guess
content).

## Code Skeletons

### Modified File: `apps/storefront/src/modules/layout/templates/nav/index.tsx` (excerpt)

```tsx
import { getTranslations } from 'next-intl/server'
// ...existing imports...

export async function NavigationHeader() {
  const t = await getTranslations('Layout.nav')
  // ...existing customer/cart fetching unchanged...

  return (
    <header>
      {/* ...existing structure... */}
      {/* was: <LocalizedClientLink>Medusa B2B Starter</LocalizedClientLink> */}
      <LocalizedClientLink>{t('brandName')}</LocalizedClientLink>

      {/* was: <input placeholder="Search for products" /> */}
      <input placeholder={t('searchPlaceholder')} title={t('searchDisabledTooltip')} />

      {/* was: <span>Quote</span> */}
      <span>{t('quoteLabel')}</span>
    </header>
  )
}
```

### Added keys: `apps/storefront/messages/en.json` (merge into existing file from NIMBUS-163 Task 02)

```json
{
  "Common": {
    "welcome": "Welcome"
  },
  "Layout": {
    "nav": {
      "brandName": "Medusa B2B Starter",
      "searchPlaceholder": "Search for products",
      "searchDisabledTooltip": "Install a search provider to enable product search",
      "quoteLabel": "Quote"
    }
  }
}
```

> **Worker note:** add the equivalent `Layout.nav` block (with the same English placeholder
> content — non-English translation is NIMBUS-167's scope) to all 7 other locale files in
> `apps/storefront/messages/`, so no catalog is missing a key next-intl expects (a missing key
> throws or falls back noisily depending on next-intl config — keep all 8 catalogs structurally
> identical).

## Impacted Files

- `apps/storefront/src/modules/layout/templates/nav/index.tsx`: replace hardcoded strings at
  lines 31, 50, 52, 65, 72 with `t(...)` calls as shown.
- `apps/storefront/src/modules/layout/templates/footer/` (exact file path to be confirmed by the
  worker — read the file first): extract its hardcoded strings into `Layout.footer.*` following
  the same pattern.
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: add the `Layout` namespace with
  identical (English-content) keys to all 8 files.
- `apps/storefront/src/lib/i18n/extraction-checklist.md`: check off `modules/layout`.

## Test Cases

### TC-1: Nav renders extracted strings unchanged
- **Given:** the `en` locale is active
- **When:** `NavigationHeader` renders
- **Then:** the rendered output contains `"Medusa B2B Starter"`, `"Search for products"`, and
  `"Quote"` exactly as before extraction (regression check — no visual/text change)

### TC-2: Missing translation key does not crash render
- **Given:** a message catalog missing a `Layout.nav` key (edge case simulating an incomplete
  catalog)
- **When:** `NavigationHeader` renders
- **Then:** next-intl's configured behavior (error boundary or fallback) is exercised
  intentionally in a test to confirm it fails loudly/predictably rather than silently rendering
  `undefined` — assert against whatever the configured `onError`/`getMessageFallback` in
  `src/i18n/request.ts` (NIMBUS-163 Task 01) actually does

### TC-3: Footer renders extracted strings unchanged
- **Given:** the `en` locale is active
- **When:** the footer component renders
- **Then:** rendered text matches pre-extraction content exactly

## Implementation Steps

1. Read `apps/storefront/src/modules/layout/templates/nav/index.tsx` in full to confirm current
   line numbers (they may have shifted since exploration) and any other hardcoded strings not
   caught above.
2. Apply `getTranslations('Layout.nav')` and replace each hardcoded string.
3. Read the footer component and apply the same pattern under `Layout.footer`.
4. Add the new keys to all 8 message catalog files with identical English placeholder content.
5. Add/update tests for TC-1–TC-3.
6. Manually spot-check `/gb` and `/dk` render identically to pre-extraction (regression
   requirement from scope.md).
7. Check off `modules/layout` in `extraction-checklist.md`.
8. Run `pnpm lint`, `pnpm test`, `pnpm build`.
