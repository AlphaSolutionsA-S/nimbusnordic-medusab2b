# Multi-lingual Storefront (Static UI Text)

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Epic
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-159
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-159/
- **Size:** L (T-shirt)
- **Area:** Storefront (Next.js) — internationalization / localization
- **Base Branch:** develop
- **Requested by:** Customer/sales request
- **Requested at:** 2026-08-21T00:00:00Z (Jira issue created)

## Background

The storefront already has **country/region-based URL routing** (`/{countryCode}/...`,
[middleware.ts](apps/storefront/src/middleware.ts)), driven by Medusa Store Regions — each
region maps a set of ISO country codes to currency/pricing. This routing has no language
dimension today: all static UI text is hardcoded in a single language regardless of which
country segment is active (confirmed: no `next-intl`/`i18next`/`react-intl` dependency, no
translation dictionaries). Sales/customers have requested the storefront be made available
in multiple languages to support Nimbus Nordic's international customer base.

**Design decision (confirmed during scoping):** language stays coupled **1:1 with
country/region**, extending the existing routing rather than introducing an independent
language dimension. Each of the 8 target countries renders in its one associated language;
there is no cross-country language switcher.

## Requirements

### Functional

- Storefront static UI text (navigation, buttons, forms, checkout flow, validation/error
  messages, account pages, footer, etc.) must be translatable and rendered according to the
  active country/region's associated language.
- Support the following locales, each bound 1:1 to a country/region: **da (Danish), en
  (English), sv (Swedish), no (Norwegian), pl (Polish), it (Italian), fr (French), de
  (German)** — 8 locales total.
- Extend Medusa Store Regions/countries so each target country resolves to its associated
  language via the existing `/{countryCode}/...` routing and `getCountryCode` /
  `getRegionMap` logic in `middleware.ts`.
- Introduce a **country→language mapping setting**: a developer-maintained code/config file
  in the storefront (not an admin UI, not env vars) that declares the language for each
  supported country code, including an explicit fallback/default entry. This is the single
  source of truth the i18n foundation and routing consult to resolve a country code to a
  language.
- A visitor-facing way to change country/region (which implicitly changes language) must
  exist site-wide. Only country-select components inside checkout/account address forms were
  found during scoping (`modules/checkout/components/country-select`) — no global
  region/language switcher in the site header/footer was found; confirm during planning
  whether one already exists elsewhere or needs to be built.
- A default/fallback region+language must be defined for visitors with no resolvable
  preference (currently `DEFAULT_REGION` env var, set to `"us"` — does not match any of the
  8 target locales, see Open Questions).

### Non-Functional

- SEO: locale-aware URLs and `hreflang` metadata so each language variant is indexable.
- Text-expansion in longer languages (German, French) must not break layouts — needs visual
  QA per locale.
- No significant bundle-size or performance regression from adding translation dictionaries.
- Translation content should be maintainable without requiring a code deploy per text change
  (exact mechanism is an open question below).

## Affected Apps

- **storefront** — introduce an i18n framework, locale-aware routing, a language switcher
  component, and migrate all hardcoded UI strings to translation keys across the 8 locales.
- **backend** — out of scope for this epic (see Dependencies).

## Proposed Structure

Indicative story breakdown for the implementation-planner to refine:

1. **Foundation** — select and set up an i18n framework (translation dictionaries) that
   plugs into the existing country/region routing in `middleware.ts`, mapping each of the 8
   target countries to its language.
2. **Country→language mapping config** — add a code/config file declaring the language for
   each of the 8 target country codes plus a fallback, and confirm/add the corresponding
   Medusa Store Regions/countries. Resolves the "en" locale's country mapping (see Open
   Questions).
3. **String extraction** — audit and extract existing hardcoded UI copy into translation
   keys/dictionaries.
4. **Region switcher** — confirm/build a site-wide way to change country/region (implicitly
   language), beyond the existing checkout/account address country-selects.
5. **Translation content** — source and load translated copy for all 8 locales.
6. **SEO** — locale-specific metadata and `hreflang` tags per country/region URL.
7. **QA** — cross-locale visual/functional regression pass (layout, text overflow, links).

## Open Questions

- Who provides/approves translations for each of the 8 languages — professional translation
  vendor, in-house staff, or machine translation with review?
- Is product/catalog content (names, descriptions sourced from Medusa/BC) addressed in a
  later phase, and does it depend on the foundation built here? (Explicitly excluded from
  this epic per stakeholder decision — storefront static UI text only.)
- **English has no obvious 1:1 country mapping** among the 8 target markets — is `en` tied to
  a specific country (e.g. UK/Ireland) or used as a generic/default "rest of world" region?
  This must be resolved before Medusa regions can be configured.
- Should the resolved country/region+language preference persist (e.g. cookie) across
  visits, or always be re-derived from URL/geo-IP as it is today?
- `DEFAULT_REGION` is currently `"us"`, outside the 8 target locales — what should the
  fallback be once this epic ships (e.g. `en`)?

## Dependencies

- **Email/notification localization** — explicitly descoped from this epic per stakeholder
  decision during scoping. To be tracked as a separate Jira feature request.
- **NIMBUS-26** ("Håndtering af sprog / Language handling") — historical related request from
  2022, closed as *Won't Do*. Not directly reused, but worth reviewing for any still-relevant
  requirements before implementation planning.
