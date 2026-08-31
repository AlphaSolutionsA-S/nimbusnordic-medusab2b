# NIMBUS-163: i18n Foundation & Routing Integration

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-163

## Objective
Wire `next-intl` into the existing `/{countryCode}/...` routing so the storefront can render
translated content per country, with no new URL structure and no regression to region/currency
resolution.

## Analysis
- The storefront's `[countryCode]` segment already exists (driven by `middleware.ts`'s
  region-based redirect), but there is no `[countryCode]/layout.tsx` — only `(main)` and
  `(checkout)` route-group layouts sit beneath it. This gap is exactly where a shared
  locale-resolution layer needs to go.
- `next.config.js` currently has no plugin wrapper, so adding `createNextIntlPlugin()` is a clean
  insertion with no composition conflicts.
- Because this project deliberately avoids next-intl's own `[locale]`-segment routing (language
  stays derived from country, not independently routed — confirmed in the epic scope), the plan
  uses next-intl in "manual locale" mode: locale is computed server-side from `params.countryCode`
  via NIMBUS-164's `getLocaleForCountry`, not inferred by next-intl from the URL.
- This is a **hard dependency on NIMBUS-164 Task 01** (the country→language config file) — Task 01
  here directly imports it.

## Execution Plan
1. **Task 01:** add `next-intl` dependency, wrap `next.config.js`, add `src/i18n/request.ts`
   resolving locale from country code.
2. **Task 02:** scaffold placeholder message catalogs for all 8 locales at
   `apps/storefront/messages/<locale>.json`.
3. **Task 03:** add `src/app/[countryCode]/layout.tsx` wrapping children in
   `NextIntlClientProvider`, and document the `useTranslations`/`getTranslations` consumption
   pattern for later stories (NIMBUS-165 in particular).

## Decisions & Trade-offs
- Chose to add a new `[countryCode]/layout.tsx` rather than duplicating provider wiring inside
  both `(main)/layout.tsx` and `(checkout)/layout.tsx` — one shared layout, no duplication, no
  changes needed to the two existing route-group layouts.
- Root layout's `<html lang="en">` stays hardcoded — dynamic `lang` isn't reachable from the root
  layout under Next.js's layout nesting rules without deeper restructuring, and the SEO-relevant
  mechanism (`hreflang`) is NIMBUS-168's scope, not this story's. Flagged as an open item.
- next-intl's exact manual-locale API must be verified against the installed version at
  implementation time (v3 vs. v4 differ) — the plan calls this out explicitly rather than
  guessing.

## Verification
- [ ] `pnpm build` succeeds with the next-intl plugin wired in.
- [ ] Unit tests for `src/i18n/request.ts` resolve messages correctly for a known and an unmapped
      country code (TC-2/TC-3, Task 01).
- [ ] Message catalog tests confirm all 8 locale JSON files parse and contain the placeholder key
      (Task 02).
- [ ] Layout + provider wiring test confirms a component using `useTranslations`/`getTranslations`
      renders translated text end-to-end (TC-3, Task 03).
- [ ] Manual check: visiting `/dk`, `/gb`, `/se`, `/no`, `/pl`, `/it`, `/fr`, `/de`, and `/us`
      (unmapped) in dev does not regress existing region/currency behavior.
