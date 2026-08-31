# Task 01: hreflang Helper & Root Metadata — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-168 (from develop)
**Depends on:** NIMBUS-163 (locale resolution), NIMBUS-164 (country list)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest
- **Test location:** `apps/storefront/src/__tests__/lib/seo/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Exploration found: no `sitemap.ts`/`robots.ts` exists, and only one `generateMetadata` call
(`categories/[...category]/page.tsx`) has any `alternates` field at all — a bare relative
`canonical` path with no `languages` map. There is no shared metadata helper today; each of the 4
`generateMetadata` implementations (`products/[handle]`, `categories/[...category]`,
`collections/[handle]`, `account/@dashboard/orders/details/[id]`) builds its `Metadata` object
independently.

Add a single shared helper, `buildLocaleAlternates(pathWithoutCountryCode)`, that generates the
`alternates.languages` map for all 8 country/region URL variants of a given page path. Each of the
4 existing `generateMetadata` functions calls this helper and spreads its result into their
returned `Metadata` object — a small, additive change to each, not a rewrite.

Per Next.js's `Metadata.alternates.languages` convention, keys are locale identifiers (BCP 47-ish)
and values are absolute URLs. Since language stays 1:1 with country/region (no separate locale
segment), map each of the 8 country codes' associated language to its `/{countryCode}{path}` URL.

The account order-details page (`account/@dashboard/orders/details/[id]/page.tsx`) is
**excluded** from `hreflang` — it's a private, authenticated page, not indexable content; adding
alternate-language SEO tags to it is meaningless. This task applies the helper to the 3 public
pages only.

## Code Skeletons

### New File: `apps/storefront/src/lib/seo/locale-alternates.ts`

```typescript
import { COUNTRY_LANGUAGE_MAP } from '@/lib/i18n/country-language-map'
import { getBaseURL } from '@/lib/util/env' // adjust import to wherever getBaseURL actually lives

export function buildLocaleAlternates(
  pathWithoutCountryCode: string
): Record<string, string> {
  const baseUrl = getBaseURL()
  const normalizedPath = pathWithoutCountryCode.startsWith('/')
    ? pathWithoutCountryCode
    : `/${pathWithoutCountryCode}`

  return Object.entries(COUNTRY_LANGUAGE_MAP).reduce<Record<string, string>>(
    (acc, [countryCode, locale]) => {
      acc[locale] = `${baseUrl}/${countryCode}${normalizedPath}`
      return acc
    },
    {}
  )
}
```

> **Worker note:** confirm the exact import path/name for the base-URL helper — exploration found
> `getBaseURL()` referenced from `apps/storefront/src/app/layout.tsx:8-10`'s
> `metadataBase: new URL(getBaseURL())`; locate its actual defining file (likely under
> `src/lib/util/`) and import from there rather than guessing the path shown above.

### Modified File: `apps/storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx` (excerpt)

```tsx
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates'
// ...existing imports...

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // ...existing product fetch unchanged...
  return {
    title: `${product.title} | Medusa Store`,
    description: `${product.title}`,
    alternates: {
      languages: buildLocaleAlternates(`/products/${params.handle}`),
    },
    openGraph: {
      title: `${product.title} | Medusa Store`,
      description: `${product.title}`,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}
```

### Modified File: `apps/storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx` (excerpt)

```tsx
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates'
// ...existing imports...

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // ...existing title/description logic unchanged...
  return {
    title: `${title} | Medusa Store`,
    description,
    alternates: {
      canonical: `${params.category.join('/')}`,
      languages: buildLocaleAlternates(`/categories/${params.category.join('/')}`),
    },
  }
}
```

## Impacted Files

- New: `apps/storefront/src/lib/seo/locale-alternates.ts`.
- `apps/storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx:64-72`: add
  `alternates.languages` to the returned `Metadata`.
- `apps/storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx:28-34`: add
  `alternates.languages` alongside the existing `alternates.canonical`.
- `apps/storefront/src/app/[countryCode]/(main)/collections/[handle]/page.tsx`: add
  `alternates.languages` (worker must read this file's current `generateMetadata` structure first
  — it wasn't fully excerpted during exploration).

## Test Cases

### TC-1: Helper generates all 8 locale URLs
- **Given:** `buildLocaleAlternates('/products/some-handle')`
- **When:** called
- **Then:** the returned object has exactly 8 entries, one per language in
  `COUNTRY_LANGUAGE_MAP`, each pointing to `{baseUrl}/{countryCode}/products/some-handle`

### TC-2: Product page metadata includes hreflang alternates
- **Given:** a product page's `generateMetadata` call for a known product handle
- **When:** invoked
- **Then:** the returned `Metadata.alternates.languages` object matches
  `buildLocaleAlternates`'s output for that product's path

### TC-3: Category page keeps its existing canonical while adding languages
- **Given:** the categories page's `generateMetadata` call
- **When:** invoked
- **Then:** `alternates.canonical` is unchanged from current behavior, and `alternates.languages`
  is now populated (previously absent)

## Implementation Steps

1. Locate the actual `getBaseURL` definition and confirm its import path.
2. Add `locale-alternates.ts` with the helper.
3. Update the 3 public-page `generateMetadata` functions (products, categories, collections) to
   include `alternates.languages` via the helper.
4. Add tests for TC-1–TC-3.
5. Manually verify via view-source or Next.js's metadata debug output that `<link rel="alternate"
   hreflang="...">` tags render correctly for at least one page.
6. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- Sitemap.xml generation is explicitly excluded from this story per scope.md — do not add
  `sitemap.ts` as part of this task even though it would naturally complement hreflang; it's
  tracked as a separate potential follow-up.
