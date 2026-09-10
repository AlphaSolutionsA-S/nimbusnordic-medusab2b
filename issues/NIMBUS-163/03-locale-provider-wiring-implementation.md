# Task 03: Shared Locale Layout & Provider Wiring — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-163 (from develop)
**Depends on:** Task 01 (`src/i18n/request.ts`), Task 02 (message catalogs must exist for the
provider to load real content, though this task's own tests can mock messages)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/app/` (new subfolder, mirrors `src/app/`)
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Create `apps/storefront/src/app/[countryCode]/layout.tsx` — a new shared layout that both
`(main)` and `(checkout)` route groups nest under (Next.js resolves nested layouts automatically
by folder position; no changes to the two existing route-group layouts are needed for this to take
effect, since they already render under `[countryCode]/`).

This layout:
1. Reads `params.countryCode`.
2. Resolves the locale via `getLocaleForCountry` (NIMBUS-164).
3. Loads that locale's messages (via `getMessages()` from `next-intl/server`, which reads the
   config produced by Task 01's `src/i18n/request.ts`).
4. Wraps `children` in `NextIntlClientProvider`.

The root layout (`apps/storefront/src/app/layout.tsx`) keeps `<html lang="en">` hardcoded for now
— making the `<html lang>` attribute dynamic per-locale is out of scope for this task (it would
require restructuring the root layout to read the country code, which it structurally can't do
today per Next.js layout nesting rules; `<html lang>` is only cosmetic/SEO-adjacent here, and
`hreflang` — the SEO mechanism that actually matters for locale indexing — is NIMBUS-168's scope).
Flagging this as an open item for NIMBUS-168 to pick up if the team wants `<html lang>` dynamic
too.

Also establish the translation-consumption pattern for other stories (`useTranslations` for client
components, `getTranslations` for server components) by adding one small example usage plus a
short pattern doc, per the story's "document the translation-consumption pattern" requirement.

## Code Skeletons

### New File: `apps/storefront/src/app/[countryCode]/layout.tsx`

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

import { getLocaleForCountry } from '@/lib/i18n/country-language-map'

export default async function CountryLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const locale = getLocaleForCountry(countryCode)
  const messages = await getMessages({ locale })

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
```

> **Worker note:** confirm whether `params` in this Next.js 15 App Router is a `Promise` (it is,
> as of Next.js 15's async `params`/`searchParams` — verify against how the existing
> `(main)/layout.tsx` and page files in this repo already type/await `params`, and match that
> exact convention rather than assuming).

### New File (documentation, per "document the translation-consumption pattern" requirement): `apps/storefront/src/lib/i18n/README.md`

```markdown
# Translation Consumption Pattern

Locale is resolved from the URL's country segment (`/{countryCode}/...`) via
`getLocaleForCountry`, not from a separate locale URL segment. Components consume translations via:

- **Server Components:** `getTranslations('Namespace')` from `next-intl/server`.
- **Client Components:** `useTranslations('Namespace')` from `next-intl`.

Namespaces correspond to top-level keys in `apps/storefront/messages/<locale>.json`, and roughly
one namespace per feature area (e.g. `Checkout`, `Account`, `Nav`). See NIMBUS-165 for the
extraction of existing hardcoded strings into this pattern.

## Example (Server Component)

\`\`\`tsx
import { getTranslations } from 'next-intl/server'

export async function ExampleServerComponent() {
  const t = await getTranslations('Common')
  return <p>{t('welcome')}</p>
}
\`\`\`

## Example (Client Component)

\`\`\`tsx
'use client'
import { useTranslations } from 'next-intl'

export function ExampleClientComponent() {
  const t = useTranslations('Common')
  return <p>{t('welcome')}</p>
}
\`\`\`
```

## Impacted Files

- New: `apps/storefront/src/app/[countryCode]/layout.tsx`.
- New: `apps/storefront/src/lib/i18n/README.md` (pattern documentation).
- No changes to `apps/storefront/src/app/[countryCode]/(main)/layout.tsx` or
  `(checkout)/layout.tsx` — they inherit the new provider automatically via Next.js layout nesting.

## Test Cases

### TC-1: Layout resolves locale and renders provider for a known country
- **Given:** `params` resolving to `{ countryCode: 'dk' }`
- **When:** `CountryLocaleLayout` renders with `children` set to a test element
- **Then:** the rendered tree includes `children`, and `NextIntlClientProvider` receives
  `locale="da"` (assert via a mocked/spied `NextIntlClientProvider` or by rendering a child that
  calls `useLocale()` and asserting it returns `'da'`)

### TC-2: Layout falls back to default locale for an unmapped country
- **Given:** `params` resolving to `{ countryCode: 'us' }`
- **When:** `CountryLocaleLayout` renders
- **Then:** the resolved locale is `'en'` (via `DEFAULT_LOCALE`)

### TC-3: Example server/client components render translated text
- **Given:** the `Common.welcome` key exists in the active locale's catalog
- **When:** a component using `getTranslations('Common')` (server) or `useTranslations('Common')`
  (client) renders `t('welcome')`
- **Then:** it renders the string from the catalog (integration/wiring test proving the whole
  chain — config → layout → provider → hook — works end to end)

## Implementation Steps

1. Add `src/app/[countryCode]/layout.tsx` per the skeleton, confirming the `params` typing
   convention against existing files in this repo.
2. Add the `src/lib/i18n/README.md` pattern doc.
3. Add a minimal example component (can live in the test file only, or as a throwaway fixture
   under `src/__tests__/`) to exercise TC-3 without adding unused production code.
4. Add tests for TC-1–TC-3.
5. Manually verify (`pnpm dev`, visit `/dk`, `/gb`, `/us`) that no runtime errors occur and the
   existing pages still render — this task must not regress `middleware.ts`'s region/currency
   resolution (non-functional requirement from scope.md).
6. Run `pnpm lint` and `pnpm build`.

## Risks

- Guardrail: **must not regress existing region/currency resolution in `middleware.ts`** — this
  task does not touch `middleware.ts` at all, only adds a new layout beneath it, so risk is low,
  but manual verification (step 5) is required per the story's non-functional requirement.
