# Translation Consumption Pattern

Locale is resolved from the URL's country segment (`/{countryCode}/...`) via
`getLocaleForCountry`, not from a separate locale URL segment. Components consume translations via:

- **Server Components:** `getTranslations('Namespace')` from `next-intl/server`.
- **Client Components:** `useTranslations('Namespace')` from `next-intl`.

Namespaces correspond to top-level keys of each language's message document, and roughly
one namespace per feature area (e.g. `Checkout`, `Account`, `Nav`). See NIMBUS-165 for the
extraction of existing hardcoded strings into this pattern.

## Runtime source of messages (NIMBUS-175)

At runtime the storefront reads UI texts **only from the Medusa database**, through
`GET /store/ui-translations/:locale` (publishable key only). Admins edit them on the Admin
**Translations** page. `src/lib/data/ui-translations.ts` (`getRuntimeMessages`) is the single
loader; `src/i18n/request.ts`, `[countryCode]/layout.tsx`, metadata and the root 404 page all go
through it, memoized per request.

- **`messages/*.json` are developer and import material only.** They are not loaded at runtime.
  Developers add new keys there; an admin imports (merges) the file in every environment before
  the code that uses those keys is released. Tests keep using the files as fixtures.
- **Caching:** each active language is cached in the Next data cache for 300 seconds under the
  tag `ui-translations:<locale>`. After a save, import, activation or missing-text fill the backend
  calls `POST /api/translations/revalidate`, which invalidates that locale's tag. The timed refresh
  is the backup when a callback is lost or reaches only one worker; an open browser picks up
  changes on its next navigation.
- **Failures:** if the backend is unreachable or the row is missing, the process serves the last
  good copy it has seen; if it has none (cold start), next-intl renders the raw keys (for example
  `Common.notFound.headingLabel`). There is no fallback to the JSON files or to English. The
  last-good copy is per process and does not survive restarts or deployments.
- **Inactive languages** are not served. A confirmed deactivation discards the last-good copy, so
  customers mapped to that language see raw keys until it is activated again.
- **Missing texts** are reported to the Admin "Missing texts" list from the server and the browser.

## Refresh and reporting secrets

| Variable | Backend | Storefront | Purpose |
| --- | --- | --- | --- |
| `STOREFRONT_TRANSLATION_REVALIDATE_URL` | yes | — | `https://<storefront>/api/translations/revalidate` |
| `REVALIDATE_SECRET` | yes | yes (existing) | Bearer secret for the refresh callback |
| `TRANSLATION_REPORT_SECRET` | yes | yes | Separate bearer secret for forwarding missing-text reports |
| `TRANSLATION_REPORT_CLIENT_IP_HEADER` | — | optional | A client-IP header the proxy sets and overwrites |

- Generate each secret per environment with a CSPRNG, for example
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never reuse
  the template's example value in a hosted environment, and never give either secret a
  `NEXT_PUBLIC_` prefix.
- Set values through the Medusa Cloud environment-variable workflow (`mcloud`), then redeploy.
- **Rotation:** set the new value on the storefront and backend, then redeploy both. While only one
  side has the new value, refresh callbacks fail (saves still succeed and report
  `refresh: "deferred"`; the 300-second timed refresh applies them) and missing-text reports are
  dropped. Rotate outside busy editing windows.
- Hosted callbacks must use HTTPS; plain HTTP is accepted only for loopback during local work.
- The browser route `/api/translations/missing` is public. It checks origin headers (defence in
  depth only), limits bodies to 32 KiB and 50 reports, and rate-limits to 300 requests per minute
  per process. The 30-per-minute per-client limit applies only when
  `TRANSLATION_REPORT_CLIENT_IP_HEADER` names a header a trusted proxy overwrites. These limits are
  in-memory and per process; the backend's database caps (2,500 entries per language, 20,000 in
  total) are the authoritative bound.

## Adding a language

1. Admin: **Translations → Add language**, as a copy of an existing language or from a file. It
   starts inactive. Translate it, then activate it — in every environment.
2. Developer: add the locale to `SUPPORTED_LOCALES` and map its countries in
   `country-language-map.ts`, add a formatting locale in `formatting-locale.ts` if needed, add a
   `messages/<locale>.json` developer file, and deploy. Mapping a country to a language that is
   missing or inactive in an environment makes customers there see raw keys.

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
