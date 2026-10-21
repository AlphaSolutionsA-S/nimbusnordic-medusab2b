# Fix brief 03: journey retry, label-test race and the cross-site form status

**App:** Storefront e2e · **Found by:** review of fix briefs 01–02 and the third Playwright run, 2026-10-21

Third run (gb-desktop, local dev backend, NODE_ENV development): the journey passed on its first
attempt (4.2 min) and its cleanup worked (language deactivated, chosen country `es` reassigned to `en`,
which is now an explicit entry). The security case failed; the retry then failed in country selection.

## Defect 1: the journey's retry cannot choose a country

`playwright.config.ts` sets `retries: 1`. Attempt 1's restore leaves the chosen country with an
explicit default-language entry, so the retry's `chooseJourneyCountry` finds no `source: 'default'`
country and throws, hiding attempt 1's real failure (seen in the third run). Fix both:
- Disable retries for the journey describe (`test.describe.configure({ mode: 'serial', retries: 0 })`):
  it changes data and is not idempotent.
- Let `chooseJourneyCountry` also accept a configured country whose current locale equals
  `default_locale` (explicit or default source), and never choose a Playwright project country
  (`dk gb se no pl it fr de`, derive from the config or one shared list), because changing one would
  change texts under the parallel project tests. Keep the `E2E_NINTH_COUNTRY` override but apply the
  same project-country exclusion with a clear message.

## Defect 2: the label test races the journey

`region-switcher.functional.spec.ts` "labels each published country…" compares every publication entry
with the storefront switcher; it can read the publication right after the journey's save or restore,
while the storefront snapshot is still up to 240 s old. Limit its assertions to the Playwright project
countries (the journey never changes those after defect 1). Keep its initialization helper.

## Defect 3: the cross-site form status assumption was wrong

`locale-links.functional.spec.ts` ~201 expects exactly 415 on a non-production backend; the real run got
401: Chromium withheld the session cookie from the cross-site form POST even though the development
backend sets no SameSite attribute (the cookie was set by an API-context login, so the browser's
"Lax-allowing-unsafe" two-minute exception did not apply, or this Chromium no longer applies it). The
assertion aborted before the "nothing stored" checks ran. Fix: on a production-like backend keep exactly
401; otherwise accept 401 (cookie withheld) or 415 (sent, refused by strict JSON), attach which one
happened, and always run the unchanged-version and unchanged-countries checks. Update the spec comment,
README and the task 05 / branch-notes wording that says a development backend gives 415, so they state
what was observed: 401 in this Chromium, 415 possible in browsers that send the cookie.

## Constraints

- Never touch `.vscode/mcp.json`, `apps/backend/scripts/` or the manifest. Do not commit. Do not run
  Playwright or change backend data; the dispatcher runs it.
- Storefront typecheck baseline 8. Run storefront lint, typecheck and
  `npx playwright test --list locale-links region-switcher` (from apps/storefront).
- Append `## Deviations` and `## Done-when evidence`; return `### Files touched` and results.

## Deviations

- No new automated test: the changes are in `e2e/` (no Jest or Vitest config covers it) and the brief
  forbids running Playwright here; real behaviour is proved only by the dispatcher's run.
- One shared list: new `apps/storefront/e2e/visual/project-locales.ts` (`PROJECT_LOCALES`,
  `PROJECT_COUNTRY_CODES`); `playwright.config.ts` now builds its projects from it instead of a local
  `LOCALES` constant (same eight entries, same 16 projects).
- The label test was renamed to "region switcher labels each project country with its published
  language" (it no longer checks every published country) and now also requires each project
  country to be in the publication (`expect(entry).toBeDefined()`), which the old loop did not.
- The form-status assertion is `expect.soft` (production-like: exactly 401; otherwise 401 or 415), so
  the unchanged-version and unchanged-countries checks always run and the test still fails on a wrong
  status. The status and its meaning are attached as `foreign-form-status.txt`.
- Also updated (stale after this fix): the fix 02 branch-notes line saying repeat runs need
  `E2E_NINTH_COUNTRY` (marked superseded); the task 05 evidence line's label-test name; the README
  fixture paragraph's repeat-run note (the previous run's country is now picked again).
- Not updated: `deviation-report.md` line 61 ("expects 415 against a development backend") is the
  integration reviewer's record of that review, not current wording; left for the reviewer. `PLAN.md`
  left as the frozen design.
- Lint: `next lint` does not cover `e2e/` (as in fix 02); the e2e files are checked by typecheck only.

## Done-when evidence

- Defect 1, no retry: `locale-links.functional.spec.ts`, describe "a ninth language assigned in
  Admin": `test.describe.configure({ mode: 'serial', retries: 0 })`. Real behaviour: dispatcher's run.
- Defect 1, country choice: `chooseJourneyCountry` in `country-language-fixture.ts` picks the first
  `configured` country with `locale === default_locale` (explicit or default source) outside
  `PROJECT_COUNTRY_CODES`; `E2E_NINTH_COUNTRY` naming a project country throws "... is a Playwright
  project country (dk, gb, ...). Choose a country in a region that no project runs in."; an
  unconfigured one keeps the existing "not in any region" error. Real behaviour: dispatcher's run.
- Defect 2: `region-switcher.functional.spec.ts` label test loops over `PROJECT_COUNTRY_CODES` only;
  `ensureCountryLanguagesInitialized` call kept. Real behaviour: dispatcher's run.
- Defect 3: `locale-links.functional.spec.ts` security case: soft status assertion (401 on
  production-like; 401 or 415 otherwise), `foreign-form-status.txt` attachment, then the unchanged
  `after.version` and `after.countries` checks (hard). Real behaviour: dispatcher's run.
- Spec comment updated (security case and describe comment); README `E2E_BACKEND_NODE_ENV` and
  `E2E_NINTH_COUNTRY` rows and the fixture paragraph updated; task 05 deviation and evidence wording
  and branch-notes (05 cookie line, fix 02 note, new Fix 03 section) updated.
- Checks: storefront typecheck 8 errors (baseline 8, none in `e2e/` or `playwright.config.ts`);
  `pnpm --filter @b2b-starter/storefront lint` PASS (2 pre-existing warnings);
  `npx playwright test --list locale-links region-switcher` lists 80 tests in 2 files.
