# Translation Consumption Pattern

Locale is resolved from the URL's country segment (`/{countryCode}/...`) via
`getLocaleForCountry`, not from a separate locale URL segment. Components consume translations via:

- **Server Components:** `getTranslations('Namespace')` from `next-intl/server`.
- **Client Components:** `useTranslations('Namespace')` from `next-intl`.

Namespaces correspond to top-level keys in `apps/storefront/messages/<locale>.json`, and roughly
one namespace per feature area (e.g. `Checkout`, `Account`, `Nav`). See NIMBUS-165 for the
extraction of existing hardcoded strings into this pattern.

## Example (Server Component)

```tsx
import { getTranslations } from 'next-intl/server'

export async function ExampleServerComponent() {
  const t = await getTranslations('Common')
  return <p>{t('welcome')}</p>
}
```

## Example (Client Component)

```tsx
'use client'
import { useTranslations } from 'next-intl'

export function ExampleClientComponent() {
  const t = useTranslations('Common')
  return <p>{t('welcome')}</p>
}
```

## Formatting prices and dates

Never hardcode a formatting locale. Get the active next-intl locale (`useLocale()` in
non-async components, `await getLocale()` in async Server Components) and pass it to
`convertToLocale({ ..., locale })`, or to `Intl.*` / `toLocale*String` via
`getFormattingLocale(locale)` from `src/lib/i18n/formatting-locale.ts` (e.g. `da` → `da-DK`,
`en` → `en-GB`).
