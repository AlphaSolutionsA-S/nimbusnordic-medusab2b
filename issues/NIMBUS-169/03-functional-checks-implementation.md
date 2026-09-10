# Task 03: Functional Checks (Region Switcher, Locale-Correct Links) — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-169 (from develop)
**Depends on:** Task 01 (Playwright infrastructure), NIMBUS-166 (region switcher must exist)

---

## Project Environment

- **App root:** `apps/storefront`
- **Test command:** `cd apps/storefront && pnpm test:visual` (functional specs live alongside
  visual specs in the same Playwright suite/config, per scope.md's "alongside visual checks")
- **Test framework:** Playwright
- **Test location:** `apps/storefront/e2e/visual/` (or a sibling `apps/storefront/e2e/functional/`
  if the worker prefers separating screenshot-assertion specs from behavioral-assertion specs —
  either is acceptable; keep it consistent with whichever the team prefers, document the choice)

## Solution Design

Two functional checks per scope.md, run across the same 8-locale matrix as the visual suite:

1. **Links resolve to the correct locale** — navigate to a page in one locale, click an internal
   link (e.g. a product link from the homepage), and assert the resulting URL retains the same
   `countryCode` segment (i.e. internal navigation doesn't accidentally drop or swap the locale).
2. **Region switcher works from every starting locale** — for each of the 8 starting locales,
   exercise NIMBUS-166's `RegionSwitcher`, select a different region, and assert the browser
   navigates to that region's homepage (`/{newCountryCode}`).

## Code Skeletons

### New File: `apps/storefront/e2e/visual/locale-links.functional.spec.ts`

```typescript
import { expect, test } from '@playwright/test'

test('internal links preserve the active locale', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0]
  await page.goto(`/${countryCode}`)

  const firstProductLink = page.locator('a[href*="/products/"]').first()
  await firstProductLink.click()

  await expect(page).toHaveURL(new RegExp(`^.*/${countryCode}/products/`))
})
```

### New File: `apps/storefront/e2e/visual/region-switcher.functional.spec.ts`

```typescript
import { expect, test } from '@playwright/test'

const OTHER_REGION_BY_STARTING_COUNTRY: Record<string, string> = {
  dk: 'gb',
  gb: 'dk',
  se: 'gb',
  no: 'gb',
  pl: 'gb',
  it: 'gb',
  fr: 'gb',
  de: 'gb',
}

test('region switcher navigates to the selected region homepage', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0]
  const targetCountryCode = OTHER_REGION_BY_STARTING_COUNTRY[countryCode]

  await page.goto(`/${countryCode}`)
  await page.getByLabel(/select your region/i).selectOption(targetCountryCode)

  await expect(page).toHaveURL(new RegExp(`^.*/${targetCountryCode}$`))
})
```

## Impacted Files

- New: `apps/storefront/e2e/visual/locale-links.functional.spec.ts`
- New: `apps/storefront/e2e/visual/region-switcher.functional.spec.ts`

## Test Cases

### TC-1: Internal navigation preserves locale
- **Given:** any of the 8 starting locales
- **When:** an internal product link is clicked from the homepage
- **Then:** the resulting URL still starts with the same `/{countryCode}/` segment

### TC-2: Region switcher works from every starting locale
- **Given:** each of the 8 starting locales in turn
- **When:** a different region is selected via the region switcher
- **Then:** the browser navigates to `/{selectedCountryCode}` (the new region's homepage)

### TC-3: Region switcher is reachable/labeled consistently across locales
- **Given:** any locale
- **When:** looking up the switcher via its accessible label (`getByLabel`)
- **Then:** it's found without needing a locale-specific label string change in the test (the
  `aria-label`'s accessible name should resolve consistently regardless of which locale's
  translated string is active — if this fails, it indicates the test itself needs a
  locale-independent selector, e.g. a `data-testid`, rather than relying on translated label text)

## Implementation Steps

1. Add the two functional spec files.
2. Run `pnpm test:visual` and confirm both pass across all 16 projects.
3. If TC-3 reveals that a translated `aria-label` breaks `getByLabel` lookups in non-English
   locales, add a `data-testid="region-switcher"` to the component (a minimal, low-risk addition
   to `RegionSwitcher` from NIMBUS-166) and switch the test to use that instead — locale-independent
   test selectors are the correct fix here, not hardcoding translated strings per locale in the
   test file.
4. Run `pnpm lint`.

## Risks

- If NIMBUS-166's `RegionSwitcher` uses a real `<select>`'s `aria-label`, translated per locale
  (per NIMBUS-165), Playwright's `getByLabel` with an English-only regex will fail in non-English
  locales. Prefer a `data-testid` selector for this reason, established in Step 3 above if needed.
