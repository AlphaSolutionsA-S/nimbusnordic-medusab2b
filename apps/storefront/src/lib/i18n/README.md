# Translation Consumption Pattern

Locale is resolved from the URL's country segment (`/{countryCode}/...`), not from a separate
locale URL segment: the backend publishes which language each country uses
(`GET /store/country-languages`, set on the Admin **Translations** page) and
`src/lib/data/country-languages.ts` loads that publication once per request
(`getCountryLanguageForCountry`, `getCountryLanguageSnapshot`). Design, cache and outage behaviour:
`docs/architecture/country-languages.md`. Components consume translations via:

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

No code change or deployment is needed (NIMBUS-176):

1. Admin: **Translations → Add language**, as a copy of an existing language or from a file. It
   starts inactive. Translate it, then activate it — in every environment.
2. Admin: in **Country languages** on the same page, set the language for each country that should
   use it. Only active languages and countries in a region can be chosen; countries without a choice
   use English. Storefront workers pick the change up within five minutes.
3. Developer (optional): add a `messages/<locale>.json` file as developer and import material.

A language stays active while any country uses it: reassign those countries before deactivating it.
English cannot be deactivated.

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
`getFormattingLocale(locale)` from `src/lib/i18n/formatting-locale.ts`:

- The original eight languages keep their tags: `da` → `da-DK`, `en` → `en-GB`, `sv` → `sv-SE`,
  `no` → `nb-NO`, `pl` → `pl-PL`, `it` → `it-IT`, `fr` → `fr-FR`, `de` → `de-DE`.
- Any other valid tag is used as is (`nl`, `pt-BR`, `zh-Hant`); a host without that locale's data
  uses Intl's own fallback. A malformed tag gets `en-GB`.
- The currency always comes from the region, never from the language.

## Alternate links (hreflang)

`buildLocaleAlternates(snapshot, path)` from `src/lib/seo/locale-alternates.ts` gives one alternate
per published country, keyed by its language plus the URL country (`da-DK`, `en-GB`, `en-IE`,
`nl-NL`), so countries sharing a language keep their own links. Pass it the request snapshot from
`getCountryLanguageSnapshot()` in `generateMetadata`.
