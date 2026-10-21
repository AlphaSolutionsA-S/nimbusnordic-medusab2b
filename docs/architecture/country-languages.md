# Country languages

**Last updated:** 2026-10-21
**Related work:** NIMBUS-176 (builds on NIMBUS-175, database UI translations)

## Overview

Each storefront country (a country in a Medusa region) shows its UI texts in one language. Admins
choose that language on the Admin **Translations** page from the active languages; a country without
a choice uses English. The backend owns the assignments and publishes the result; the storefront only
renders that verdict. URLs (`/{countryCode}/...`), regions and currencies are unchanged: a language
choice never changes prices, currency or which region a country belongs to.

## Components

Backend paths are relative to `apps/backend/src/`, storefront paths to `apps/storefront/src/`.

| Component | Responsibility |
|-----------|----------------|
| `modules/storefront-translation/models/country-language-configuration.ts` | One configuration document (`country_language_configuration`): explicit assignments and a version |
| `modules/storefront-translation/country-languages.ts`, `service.ts` | Assignment rules, the deactivation guard, bootstrap and the published verdict |
| `workflows/storefront-translation/workflows/` | Management read, assignment, publication and bootstrap workflows; region membership from a narrow Region query |
| `api/admin/country-languages/`, `api/store/country-languages/` | Admin list and save; public publication |
| `scripts/bootstrap-country-languages.ts` | Operator bootstrap from the legacy map (dry run by default) |
| `admin/routes/translations/components/CountryLanguages.tsx` | Admin list, edit drawer, conflict and deactivation feedback |
| `lib/data/country-languages.ts` (storefront, `server-only`) | Loads, validates and caches the publication; one snapshot per request |
| `lib/i18n/country-language-map.ts` | Parses the publication and looks a country up; holds the cold-outage legacy map |
| `lib/i18n/formatting-locale.ts`, `lib/seo/locale-alternates.ts` | Number/date formatting tag and hreflang alternates for a language |

## Rules

- One language per country; only an active language can be assigned. A country with no explicit
  assignment uses the default, English.
- New assignments are allowed only for countries in a region. A country removed from its region keeps
  its assignment ("retained"); it disappears from the publication and comes back with the same
  language if it is added again. Retained entries can be reassigned but not created.
- English cannot be deactivated. Any other language cannot be deactivated while a configured or
  retained assignment uses it; the refusal names the countries. Nothing is reassigned automatically.
- Saves carry the version the Admin saw; a stale version is refused (409, "changed by someone else")
  and nothing is written. Saves, bootstrap and language activation are serialized on a database
  transaction lock, so they are consistent across backend instances.
- Without a configuration document the publication fails closed (503) instead of quietly sending every
  country to English; the bootstrap is the explicit step that creates it.

## HTTP contract

| Endpoint | Behaviour |
|----------|-----------|
| `GET /admin/country-languages` | `{version, default_locale, countries:[{country_code, locale, source, configured}], active_locales}`; retained entries have `configured: false` |
| `POST /admin/country-languages/:country_code` | Strict JSON `{locale, expected_version}` (≤ 1 KiB) → the updated management document; 400 invalid or unconfigured country, 409 stale/inactive/uninitialized, 415 non-JSON |
| `GET /store/country-languages` | Publishable key; `{default_locale, countries:[{country_code, locale, source}]}` for configured countries only, no version or actor |

Both Admin routes and `POST /admin/ui-translations/:locale/activation` accept only the dashboard
session cookie; bearer tokens and secret API keys get 401. All three responses above carry
`Cache-Control: no-store`; an uninitialized or broken publication gives 503 on both reads.

## Storefront resolution

- Middleware writes the URL's country into `x-storefront-country` and deletes client-sent
  `x-next-intl-locale`/`x-storefront-country`. `i18n/request.ts`, the country layout, the main layout
  (switcher labels), page metadata and the text-refresh action all read the same request-memoized
  snapshot from `lib/data/country-languages.ts`.
- Each worker reuses a successful publication for at most 240 seconds, then the next request waits
  for one read with a 3-second timeout; concurrent refreshes share one read. A healthy change reaches
  every worker within five minutes, with no forced reload of open pages.
- On failure a worker serves its last good publication (`stale`) for the rest of its life and retries
  after at most 10 seconds. A worker that never loaded one uses the legacy map (`legacy`): the eight
  original countries and languages. Failures are never cached as results, nothing is shared between
  workers and nothing survives a restart.
- Next's own control-flow errors are not failures: the loader passes them on with
  `unstable_rethrow` before its fallback. During `next build` the `no-store` read throws Next's
  dynamic-usage error, so `[countryCode]` routes render per request and no build-time (legacy)
  snapshot is baked into a page. Keep it that way: a `[countryCode]` route must not export an ISR
  `revalidate`, which would store whatever snapshot a regeneration saw.
- UI texts still come from `/store/ui-translations/:locale` with their own 300-second cache
  (`lib/i18n/README.md`); a newly assigned language therefore needs its texts active first.

## Formatting and SEO

- Formatting tag (`getFormattingLocale`): the original eight keep `da-DK`, `en-GB`, `sv-SE`, `nb-NO`,
  `pl-PL`, `it-IT`, `fr-FR` and `de-DE`. Any other valid tag is used as is (canonical spelling, script
  and region kept); Intl falls back to its default on hosts without that locale's data. A malformed
  tag gets `en-GB`. Currency always comes from the region.
- Alternate links (`buildLocaleAlternates`): one per published country, keyed by the language (with
  script and variants) plus the URL country as region, for example `en-GB` and `en-IE` for two
  English countries and `pt-PT` for `pt-BR` assigned to Portugal. A region in the language tag is
  replaced, never doubled; Unicode and private-use extensions are dropped. Product, collection and
  category metadata use the request snapshot, so their title language and alternates match the page.

## Rollout

In order, per environment:

1. Deploy the backend (migration `country_language_configuration`).
2. Run the bootstrap dry run, then apply it:
   `pnpm --filter @b2b-starter/backend exec medusa exec ./src/scripts/bootstrap-country-languages.ts`
   and the same with the bare argument `apply` (not `--apply`: `medusa exec` rejects unknown options).
   Apply refuses when a legacy language is missing or inactive (activate it first) and never
   overwrites an existing configuration.
3. Read back `GET /admin/country-languages` and `GET /store/country-languages`: 200, every configured
   country with the expected language.
4. Deploy the storefront. Until step 2 has run the publication is 503 and storefront workers stay on
   the legacy map, so the order matters for new countries, not for the original eight.
5. For a new language: add and translate it on the Translations page, activate it, then assign it to
   countries. Add `messages/<locale>.json` only as developer material.

## Verify after deploy

Tests do not prove the rollout. After a real Admin save on a test country that was already in a
region when the storefront started (for example `nl` set to `nl`; storefront middleware caches the
region map for an hour, so a country just added to a region is not routed as that country), record:
the stored assignments and version (`GET /admin/country-languages`), the public entry
(`GET /store/country-languages`: country, locale, source), and on that country's product page the
`<html lang>`, a translated text, a formatted price and the `hreflang` alternates, within five minutes
of the save. `<html lang>` is set on the client (`HtmlLangSync`), so read it in a browser after
hydration; in the server HTML check the text and `hreflang` instead.

Before deploying, confirm each Medusa Cloud backend runs with `NODE_ENV` `production` or `staging`:
only then does Medusa set `SameSite=Lax; Secure` on the Admin session cookie. Otherwise the defence
against a foreign form posting to the session-only routes rests on the strict-JSON check (415) alone.

## Limits

- Session storage is the backend's existing store; a missing session on another instance gives 401,
  never an anonymous write. Global logout across instances is not claimed.
- The 240-second freshness and the last-good copy are per storefront process.
- Raw keys show where a country is assigned a language whose texts are missing in that environment.
- Browser checks: `apps/storefront/e2e/visual/locale-links.functional.spec.ts` (ninth-language
  journey and the foreign-origin mutation case) and `region-switcher.functional.spec.ts` need a running
  backend and the environment listed in `e2e/visual/README.md`. Against a development backend the
  foreign-origin form gets 401 (cookie withheld) or 415 (non-JSON body); only a production-like
  backend proves the cookie is withheld.
