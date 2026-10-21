# Fix brief 02: journey country choice and fixture cleanup

**App:** Storefront e2e · **Found by:** second real Playwright run (gate question 1), 2026-10-21

## Defect 1: the journey adds a country to a region while the storefront is running

The journey failed at `locale-links.functional.spec.ts:94`: `html` never got `lang="nl"` (attribute
absent) within 6 minutes, although the Admin save, `GET /admin/country-languages` and
`GET /store/country-languages` all showed `nl → nl`. Cause: `prepareFixture` adds `nl` to the region
during the run, but storefront middleware caches the region map in module memory for an hour
(`apps/storefront/src/middleware.ts` ~15–59, pre-existing, not this branch). `/nl/store` is therefore
treated as an unknown country, routed to the default country, and lands on a not-found page without the
country layout. A real rollout assigns languages to countries already in a region, so the journey must
not depend on a region change the running storefront cannot see.

Fix: stop adding a country to a region in the fixture. Choose the journey's country from the management
document: a configured country (`configured: true`) currently on the default language
(`source: 'default'`), unless `E2E_NINTH_COUNTRY` is set (then require that it is configured, and fail
with a clear message saying the country must be in a region before the storefront starts). Keep
`E2E_NINTH_LOCALE` (default `nl`). Remove `addedToRegion` from the fixture state and its restore. Make
the hreflang and switcher assertions use the chosen country (they already use the constants; turn them
into values returned by the fixture). Update the README and docs text that describe the fixture.

## Defect 2: cleanup leaves the ninth language active after a retry

`restoreFixture` deactivates the language only when the fixture created it. On a retry, a new worker
finds the language already created (inactive), activates it, records `createdLocale: false`, and leaves
it active. Record whether the fixture activated the language (`activatedLocale`) and deactivate it on
restore whenever it did. Restore must reassign the country before deactivating (deactivation of an
assigned language is refused).

## Current local state (do not change it yourself)

Local dev DB after the second run: configuration initialized (version 5); `nl` language exists and is
active (v4); explicit retained entry `nl → en` (nl not in any region); region back to its nine
countries. The dispatcher handles data; you only change code.

## Constraints

- Never touch `.vscode/mcp.json`, `apps/backend/scripts/` or the manifest. Do not commit. Do not run the
  Playwright journey or change backend data; the dispatcher runs it.
- Storefront typecheck baseline 8 (tsconfig includes `e2e/`). Run storefront lint, storefront typecheck
  and `npx playwright test --list locale-links region-switcher` (from apps/storefront).
- Return `### Files touched` and results.

## Deviations

- No new automated test: the fixture lives in `e2e/`, which no Jest or Vitest config covers, and the
  brief forbids running the Playwright journey here. The country choice and the cleanup are proved
  only by the dispatcher's real Playwright run.
- Removed `createdLocale` from `FixtureState`: once restore keys on `activatedLocale` nothing reads it.
  Added `countryCode` (the chosen country) to the state; the journey reads it from the fixture.
  The `NINTH_COUNTRY` export is gone; `E2E_NINTH_COUNTRY` is read only inside the country choice.
- `restoreFixture` now asserts the deactivation response (`deactivate <locale>`), so a refused cleanup
  shows up in the report instead of silently leaving the language active (the cause of defect 2 going
  unnoticed).
- Added: the foreign-origin security case also used `NINTH_COUNTRY`; it now targets the first
  configured country from the management document it already reads, so the attack aims at a
  country the backend would otherwise accept. Its assertions (blocked fetch, 401/415, unchanged
  document) are unchanged.
- Open for the dispatcher: the API has no way to remove an explicit entry, so restore leaves the
  chosen country with an explicit entry for the default language (`source: 'explicit'`). A later run
  then no longer picks that country by default; with one spare region country locally, set
  `E2E_NINTH_COUNTRY=<that country>` for repeat runs (an explicit configured country is accepted).
  Documented in `e2e/visual/README.md`.
- Lint: `pnpm --filter @b2b-starter/storefront lint` (`next lint`) does not cover `e2e/`; a direct
  `npx eslint` on the e2e files fails in this environment ("outdated version of the 'jiti' library",
  ESLint 9.39.4 loading the TypeScript config), so the e2e files were checked by typecheck only.

## Done-when evidence

- Defect 1, no region change in the fixture: `prepareFixture` no longer calls `/admin/regions`;
  `addedToRegion` and its restore are removed (`apps/storefront/e2e/visual/country-language-fixture.ts`).
  Real behaviour: not provable in this task: needs the dispatcher's Playwright run.
- Defect 1, country choice: `chooseJourneyCountry` in the fixture: `E2E_NINTH_COUNTRY` must be
  `configured` or the fixture throws "... is not in any region. Add it to a region before starting
  the storefront."; otherwise the first `configured && source === 'default'` country, or a clear error.
- Defect 1, `E2E_NINTH_LOCALE` kept (default `nl`): unchanged constant `NINTH_LOCALE`.
- Defect 1, assertions use the chosen country: `locale-links.functional.spec.ts` journey reads
  `const { countryCode } = fixture` for the Admin row, both document checks, the shopper URL,
  switcher value, product URL and the `hreflang` `${NINTH_LOCALE}-${countryCode.toUpperCase()}`.
- Defect 2: `FixtureState.activatedLocale` is set when the fixture activates the language (created
  or found inactive); `restoreFixture` reassigns the country first, then deactivates whenever
  `activatedLocale`. Real behaviour: dispatcher's Playwright run.
- Checks: storefront typecheck 8 errors (baseline 8, none in `e2e/`); `pnpm --filter
  @b2b-starter/storefront lint` PASS (2 pre-existing warnings); `npx playwright test --list
  locale-links region-switcher` lists 80 tests in 2 files.
- Also update: `apps/storefront/e2e/visual/README.md` (variable table and fixture paragraph: no
  region change, why, cleanup and the repeat-run note); `docs/architecture/country-languages.md`
  ("Verify after deploy": the test country must be in a region before the storefront starts, with
  the middleware cache reason).
