# NIMBUS-164: Country → Language Mapping Config

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-164

## Objective
Define a single source of truth mapping each of the 8 target countries to its language, and make
sure the underlying Medusa regions/countries and fallback default actually match it.

## Analysis
- The storefront has no i18n-related code today — this task creates the `apps/storefront/src/lib/i18n/`
  directory that NIMBUS-163 will build on.
- Medusa region data is seeded once via `apps/backend/src/migration-scripts/initial-data-seed.ts`,
  which hardcodes the target countries in three separate places (region, tax regions, fulfillment
  geo-zones). Of the 8 target countries, **NO and PL are missing**; **ES is present but not a
  target locale** (left alone — not requested to remove).
- Because the seed script only runs once, an already-seeded environment (e.g. staging) needs a
  separate idempotent script to add the missing countries — the seed script edit alone only helps
  fresh installs.
- `DEFAULT_REGION` in `middleware.ts` defaults to `"us"`, which matches none of the 8 locales;
  changing the code default to `"gb"` doesn't affect environments that set the env var explicitly
  — that requires an ops-side follow-up.

## Execution Plan
1. **Task 01 (storefront):** add `country-language-map.ts` with `COUNTRY_LANGUAGE_MAP`,
   `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, and `getLocaleForCountry()`.
2. **Task 02 (backend):** update the seed script's country lists (region + fulfillment geo-zones)
   to include `no`/`pl`, and add `add-missing-region-countries.ts` for already-seeded environments.
3. **Task 03 (storefront):** change `middleware.ts`'s `DEFAULT_REGION` fallback from `"us"` to
   `"gb"`, and update `.env.template`/`README.md` documentation to match.

Tasks are independent of each other (no cross-task wiring within this issue) and can be
implemented/reviewed in any order, though 01 should land first since NIMBUS-163 depends on it.

## Decisions & Trade-offs
- Config lives in `apps/storefront/src/lib/i18n/`, not the backend — keeps the "developer
  maintained, not admin UI" requirement simple and colocated with where NIMBUS-163 will consume it.
- Left `ES` in the seeded region rather than removing it — removal wasn't requested and isn't this
  story's concern; flagged as a stray fact for the user, not silently fixed.
- The one-off region-update script follows the exact same `migration-scripts/` folder and
  `medusa exec` invocation convention as the existing seed script, rather than introducing a new
  `scripts/` folder or a different execution mechanism.
- Module service method names in the new script (`listFulfillmentSets`, `updateServiceZones`,
  etc.) need verification against the installed Medusa version at implementation time — Medusa v2
  module service APIs shift between minor versions and aren't caught by the type checker if wrong
  (DI-resolved services).

## Verification
- [ ] `getLocaleForCountry` unit tests (TC-1–TC-4 in Task 01) pass.
- [ ] Fresh seed run (`npx medusa exec ./src/migration-scripts/initial-data-seed.ts` against a
      clean DB) produces a region containing all 8 target countries.
- [ ] `add-missing-region-countries.ts` run against a pre-existing (old) seed adds `no`/`pl`
      without duplicating or disturbing the other 7 countries, and is safe to re-run.
- [ ] `middleware.ts` fallback test (TC-1/TC-2 in Task 03) confirms `gb` is the new default and an
      explicit env var still overrides it.
- [ ] `pnpm lint` and `pnpm build` pass at repo root.
