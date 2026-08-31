# Task 02: Localize Page Title/Description Generation — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-168 (from develop)
**Depends on:** NIMBUS-163 (translation pattern), Task 01 (same files touched — sequence after
Task 01 to avoid merge overlap)

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

The 3 public `generateMetadata` functions (products, categories, collections) currently build
`title`/`description` with a hardcoded `"Medusa Store"` suffix and, for products, a description
that's just the product title repeated. Per this story's requirement ("Localize page `<title>`/meta
description generation per locale"), the **static portions** (the `"| Medusa Store"` suffix, any
category/collection description template text) should come from the message catalogs
(`MetaDescription` namespace) via `getTranslations` inside `generateMetadata`, resolved to the
locale for `params.countryCode` — `generateMetadata` runs server-side and can call
`getTranslations({ locale })` directly (next-intl's server API supports passing an explicit locale
outside of component rendering, which is exactly this case).

**Product/category/collection titles and descriptions themselves are data from Medusa, not UI
copy** — translating that data is explicitly out of scope for this whole epic (per NIMBUS-159).
This task only localizes the *static template text* around the data (e.g. the `"| Medusa Store"`
suffix), not the product name/description content itself.

## Code Skeletons

### Modified File: `apps/storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx` (excerpt)

```tsx
import { getTranslations } from 'next-intl/server'
import { getLocaleForCountry } from '@/lib/i18n/country-language-map'
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates'
// ...existing imports...

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // ...existing product fetch unchanged...
  const locale = getLocaleForCountry(params.countryCode)
  const t = await getTranslations({ locale, namespace: 'MetaDescription' })
  const title = `${product.title} ${t('storeSuffix')}`

  return {
    title,
    description: product.title,
    alternates: {
      languages: buildLocaleAlternates(`/products/${params.handle}`),
    },
    openGraph: {
      title,
      description: product.title,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}
```

### Added keys: `apps/storefront/messages/en.json` (merge)

```json
{
  "MetaDescription": {
    "storeSuffix": "| Medusa Store"
  }
}
```

## Impacted Files

- `apps/storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx`: replace hardcoded
  `"| Medusa Store"` with the localized suffix as shown.
- `apps/storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx`: same
  replacement pattern for its `"| Medusa Store"` usage.
- `apps/storefront/src/app/[countryCode]/(main)/collections/[handle]/page.tsx`: same, after
  reading its current implementation.
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: add `MetaDescription.storeSuffix`
  (English content for all 8 at this stage; non-English translation flows through NIMBUS-167's
  process if this key is added before or is picked up in a later MT run).

## Test Cases

### TC-1: Product metadata title uses the localized suffix for a non-English locale
- **Given:** `params.countryCode = 'dk'` (locale `da`) and a `MetaDescription.storeSuffix`
  translated value in `da.json`
- **When:** `generateMetadata` runs
- **Then:** the returned `title` ends with the `da` locale's suffix value, not the hardcoded
  English string

### TC-2: Falls back to default locale suffix for an unmapped country
- **Given:** `params.countryCode = 'us'`
- **When:** `generateMetadata` runs
- **Then:** the suffix comes from `DEFAULT_LOCALE`'s (`en`) catalog

### TC-3: Product title/description content itself is unaffected (not translated)
- **Given:** any locale
- **When:** `generateMetadata` runs for the same product
- **Then:** the `product.title`-derived portion of `title`/`description` is identical across
  locales — only the static suffix changes, confirming data content isn't accidentally routed
  through translation

## Implementation Steps

1. Add `MetaDescription.storeSuffix` to all 8 message catalogs.
2. Update the 3 public-page `generateMetadata` functions to resolve locale via
   `getLocaleForCountry(params.countryCode)` and call `getTranslations({ locale, namespace:
   'MetaDescription' })`.
3. Add tests for TC-1–TC-3.
4. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- Sequence after Task 01 (both touch the same 3 page files) to avoid conflicting concurrent edits
  — implement as one combined change per file if dispatched together, rather than two separate
  passes over the same files.
