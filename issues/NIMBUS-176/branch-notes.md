# Branch notes: NIMBUS-176

## 01: configuration integrity

- Service methods (`storefrontTranslation` module, `apps/backend/src/modules/storefront-translation/service.ts`): `getCountryLanguageConfiguration()` → `{assignments, version} | null`; `previewCountryLanguageBootstrap(assignments)` → `{initialized, unavailable_locales}` (read-only dry run); `bootstrapCountryLanguages(assignments)` → `{created, configuration}` (existing document returned unchanged); `assignCountryLanguage({country_code, locale, expected_version, configured_country_codes})` → committed `{assignments, version}`; `getCountryLanguageManagement(configuredCodes)` → exactly the 02 Admin GET shape (retained entries have `configured: false`, `active_locales` sorted); `publishCountryLanguages(configuredCodes)` → exactly the 02 public GET shape.
- Types in `apps/backend/src/types/storefront-translation.ts` (`CountryLanguage*`). Pure rules and bounds in `modules/storefront-translation/country-languages.ts` (`DEFAULT_COUNTRY_LOCALE`, `isCountryCode`, `isCanonicalLocale`, `effectiveCountryLanguages`, `MAX_CONFIGURATION_BYTES`).
- Error mapping for routes: `INVALID_DATA` → 400; `CONFLICT` → 409 (stale version, uninitialized save, missing/inactive target, English/referenced deactivation with message `…assigned to countries: dk, se.`, lock busy); `UNEXPECTED_STATE` from management/publication reads means uninitialized or broken invariant → map to 503 explicitly (the default Medusa handler gives 500).
- The service validates canonical input itself (lowercase 2-letter codes, `Intl.getCanonicalLocales` spelling); routes should canonicalize (e.g. `localeSchema`) before calling, or a non-canonical locale is rejected.
- `configured_country_codes` must come from the Region Query in the workflow; the service never reads Region tables.
- The model is not in `MedusaService({...})`: there are no generated `listCountryLanguageConfigurations`/`update…` methods; use the methods above.
- Activation (`mutateDocument` operation `activate`) now takes the configuration lock with a 5 s `lock_timeout` before the locale lock; the existing activation body/response is unchanged.
- Do not compensate a committed `assignCountryLanguage` in a workflow step (no "restore previous" compensation); a failed later step must not rewrite the CAS document.
- Module spec pattern for real-PG races: `country-language-configuration.spec.ts` (second instance via `initModules`, ordered races by holding a transaction through `MikroOrmWrapper.forkManager().transactional` and passing `{ transactionManager }`).
- Module specs run with `test:integration:modules -- <path>`, not `test:unit`. A stale `.medusa/server` build copy of the old spec also runs when the path pattern is a folder.
- `medusa db:migrate` locally applied the migration but did not exit afterwards; stop it after "Migrations completed".

## 02: contracts and bootstrap

- `GET /admin/country-languages` → 200 `{version, default_locale:"en", countries:[{country_code, locale, source:"explicit"|"default", configured}], active_locales}`; countries sorted by code, retained entries have `configured:false`.
- `POST /admin/country-languages/:country_code`, body exactly `{locale, expected_version}` (strict, positive integer version) → 200 with the same management document (new `version`). Path code must be lower-case alpha-2.
- `GET /store/country-languages` (publishable key required, like every `/store` route) → 200 `{default_locale:"en", countries:[{country_code, locale, source}]}`, configured countries only, no version.
- 200, 409 and 503 responses from these three routes carry `Cache-Control: no-store` (`sendWorkflowResult` in `src/api/utils/workflow-error-response.ts`); middleware 400/401/413/415 responses do not.
- Errors: 400 framework `{type:"invalid_data", message}` (bad body, malformed or unconfigured country); 401 `{message:"Unauthorized"}`; 409 `{type:"conflict", code:"invalid_state_error", message}` with the domain message kept (stale: "changed by someone else"; inactive: `"fr" is not an active language`; not initialized; deactivation: `…assigned to countries: se.`); 413 body over 1 KiB; 415 `{type:"unsupported_media_type"}` for non-JSON; 503 `{type:"unavailable", message:"Country languages are not available"}` for uninitialized or broken publication (both GETs).
- Auth: both Admin routes and `POST /admin/ui-translations/:locale/activation` accept only the dashboard session cookie (`requireAdminSession` in `src/api/middlewares/require-admin-session.ts`); bearer tokens and secret API keys get 401. The Admin SDK (`src/admin/lib/client.ts`, `auth: {type:"session"}`) already works; use `sdk.client.fetch` with a plain object body so it is sent as `application/json`. Activation now also needs JSON and ≤1 KiB; its body and response are unchanged, but its 409s now carry the domain message instead of the framework's generic retry text.
- Operator bootstrap: `pnpm --filter @b2b-starter/backend exec medusa exec ./src/scripts/bootstrap-country-languages.ts` is a dry run (no writes) logging `{mode, configured_country_codes, assignments, report:{initialized, unavailable_locales}}`; add the bare positional `apply` to initialize (`applied.bootstrap` and `applied.publication` readback). Apply fails listing unavailable languages and never overwrites an existing configuration. Legacy map: `LEGACY_COUNTRY_LANGUAGES` in the script.
- Workflows (`src/workflows/storefront-translation/workflows/`): `getCountryLanguageManagementWorkflow`, `assignCountryLanguageWorkflow`, `publishCountryLanguagesWorkflow`, `bootstrapCountryLanguagesWorkflow`; Region membership via `listConfiguredCountryCodesStep` (`region` → `countries.iso_2`).
- Test pitfalls: HTTP specs need `JWT_SECRET=supersecret` in the shell when the local `apps/backend/.env` sets another value (in-app runner reads `.env` first; every bearer admin call then gets 401). `createAdminSession(api)` in `integration-tests/utils/admin.ts` logs in through the real routes and returns `{headers:{cookie}}`.

## 03: admin management

- Hooks in `src/admin/hooks/api/ui-translations.tsx`: `countryLanguageQueryKey` (key space `["country-languages"]`), `useCountryLanguages()` (GET management doc), `useAssignCountryLanguage()` (POST `{country_code, locale, expected_version}`; on success seeds the list cache, then invalidates the country-language and `translationQueryKey.all` keys). `useActivateTranslation` now also invalidates `countryLanguageQueryKey.all`.
- UI: `routes/translations/components/CountryLanguages.tsx`, rendered in `TranslationsWorkspace` between readiness and the editor. Lists are `aria-label` "Countries in regions" / "Retained assignments"; rows are labelled `"<cc>: <locale> (default|set explicitly)"`; edit buttons `Edit language for <cc>`; Drawer select "Storefront language", button "Save language", 409 offers "Reload country languages".
- `conflictAwareErrorMessage(error)` in `src/admin/lib/translations.ts` shows the server's 409 message. The SDK `FetchError` carries the response body's `message` and a numeric `status` (`@medusajs/js-sdk/dist/esm/client.js`).
- The Admin has no translation keys: Admin text is English literals, as in the existing translation components. Tasks 04/05 need no Admin keys.
- `tools.test.tsx`'s `FakeBackend` now serves `/admin/country-languages` (fields `configuredCountries`, `assignments`, `countryVersion`) and the English/referenced deactivation 409s. Any new workspace-level fetch must be added there, or it throws `Unhandled …`.
- The IDE's Jest diagnostics run Babel without the admin config and report false syntax errors on `import type`. Use `test:admin`.

## 04: runtime resolution

- Loader `apps/storefront/src/lib/data/country-languages.ts` (`server-only`, React `cache`): `getCountryLanguageSnapshot(): Promise<CountryLanguageSnapshot>` and `getCountryLanguageForCountry(countryCode: string | null | undefined): Promise<{ locale, availability }>`. Both are request-memoized; call them from S3 (pages, layouts, `generateMetadata`) and pass the snapshot down as props.
- Snapshot shape (types in `lib/i18n/country-language-map.ts`): `{ default_locale: string, countries: readonly { country_code, locale, source: "explicit"|"default" }[], availability: "available"|"stale"|"legacy" }`. `CountryLanguagePublication` is the same without `availability`; nav/footer props use that type.
- Pure helpers in `lib/i18n/country-language-map.ts`: `localeForCountry(snapshot, code)` (unpublished/missing → `default_locale`), `findPublishedCountry(snapshot, code)`, `isCanonicalLocale(tag)`, `isCountryCode(code)`, `parseCountryLanguagePublication(raw)`, `legacyCountryLanguageSnapshot()`.
- For 05: `buildLocaleAlternates` should take the snapshot's `countries` (configured countries only); metadata pages call `getCountryLanguageForCountry(params.countryCode)` (same memoized verdict as the layout). Then delete the legacy exports `SUPPORTED_LOCALES`, `Locale`, `getLocaleForCountry` (marked `@deprecated`) once `formatting-locale.ts`, `locale-alternates.ts` and the three metadata pages stop using them; keep `COUNTRY_LANGUAGE_MAP` (the approved cold fallback, used by `legacyCountryLanguageSnapshot`).
- Middleware now sets `x-storefront-country` (exact first URL segment) and deletes client `x-next-intl-locale`/`x-storefront-country`; `i18n/request.ts` reads that header, never `requestLocale`. Without the header (root 404) the published default applies.
- Loader state is process memory only (no `unstable_cache`): fresh 240 s, 3 s timeout, 10 s failure backoff, one shared in-flight read, last good served as `stale`, legacy map when cold. A test that needs a fresh worker must `jest.resetModules()`/`isolateModules`; React `cache` does not memoize outside RSC in Jest.
- Jest pitfalls: jsdom has no `AbortSignal.timeout` (polyfilled in `__tests__/app/country-code-layout.test.tsx`); a jsdom test that imports the real loader must mock `server-only` and `@/lib/config`. Any test rendering `(main)/layout.tsx` must mock `@/lib/data/country-languages`.
- Missing-text reports accept any canonical tag (`isCanonicalLocale`, ≤64 chars); `refreshUiTranslationsForCountry` invalidates only a published country's locale tag.
- Still stale for 05: `lib/i18n/README.md` (describes `getLocaleForCountry`), Tier 0 `layers.md`/`boundaries.md` (`bound-sf-server-only` and S2 list only `cms.ts` and `ui-translations.ts`; the new loader is `server-only` too), `decisions.md` locale row.

## 05: formatting, SEO and verification

- `buildLocaleAlternates(publication: CountryLanguagePublication, path)` (`lib/seo/locale-alternates.ts`): keys are language[-script]-COUNTRY[-variants] from `Intl.Locale.baseName`, so hreflang for the legacy eight is now `da-DK`, `en-GB`, ... (no longer bare `da`). Product, collection and category `generateMetadata` read `getCountryLanguageForCountry` + `getCountryLanguageSnapshot`.
- `getFormattingLocale` keeps the eight legacy tags in a `Map` (no prototype lookups); any other `Intl.getCanonicalLocales`-valid tag is returned canonical; malformed → `en-GB`. Verified on Node 22.17: `Intl.NumberFormat("xx")` resolves to the host default (here `en-DK`).
- Deleted `SUPPORTED_LOCALES`, `Locale`, `getLocaleForCountry`; nothing in `apps/storefront` references them.
- Playwright journey and security case are NOT run yet: they need a running backend plus `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (see `e2e/visual/README.md`) and they change backend data. Run only against a local or disposable backend: `pnpm --filter @b2b-starter/storefront test:visual -- locale-links region-switcher --project gb-desktop`.
- Medusa sets the session cookie's `SameSite=Lax; Secure` only when the backend's NODE_ENV is production or staging, and no SameSite otherwise (`@medusajs/framework/dist/http/express-loader.js`, `resolveSessionCookieSecurity`); Playwright's `context.cookies()` may report a missing attribute as `Lax`, so read the raw `Set-Cookie` (`loginAdmin` now returns it). Admin route order is `requireAdminSession` then `requireJsonBody`: 401 means the cookie was withheld, 415 that it was sent. Observed against a development backend (fix 03): 401, Chromium withheld the API-context login's cookie from the cross-site form POST; 415 remains possible in a browser that sends it.
- The main layout renders `data-testid="region-switcher"` twice (header and footer); scope to `locator('header')`.
- Full storefront Jest: 2 failing suites, both outside this branch's changes: `main-layout.test.tsx` (known) and `product-tabs/index.test.tsx` ("A React Element from an older version of React", react-markdown resolving a second React).
- `pnpm ai:check` still fails only on `AGENTS.md` size (33,861 bytes after this task's Tier 0 edits).
- New architecture page `docs/architecture/country-languages.md` holds the rollout order and the after-deploy checklist.

## Fix 01: bootstrap apply argument and journey ordering

- `medusa exec` (CLI `exec [file] [args..]`, yargs `.strict()`, `@medusajs/cli/dist/create-cli.js` ~601/~700) rejects any `--option` it does not declare and prints help before the script loads. Positionals arrive as strings in `ExecArgs.args`: probed `apply` → `["apply"]`, none → `[]`.
- The script's `bootstrapMode(args)` returns `"dry-run"` for `[]`, `"apply"` for `["apply"]`, and throws a usage error for anything else (so `--apply` passed some other way never silently dry-runs).
- e2e: `ensureCountryLanguagesInitialized(request, testInfo)` in `country-language-fixture.ts` checks the public publication (publishable key only, no Admin login) and runs the apply bootstrap on 503; it extends the test timeout by 3 min while doing so and, if the CLI fails, polls up to 60 s for a parallel worker's bootstrap to land. `prepareFixture` and the region-switcher label test both call it.

## Fix 02: journey country and fixture cleanup

- Storefront middleware (`src/middleware.ts`, `regionMapCache`) keeps the region map in module memory
  for an hour: a country added to a region while the storefront runs is routed to the default country
  (not-found page, no `lang`). The e2e fixture therefore never changes regions.
- `prepareFixture` returns `FixtureState = { countryCode, activatedLocale, previousLocale }`; the
  journey uses `fixture.countryCode`. Country: `E2E_NINTH_COUNTRY` (must be configured) or the first
  configured country with `source: 'default'`.
- Restore reassigns first, then deactivates when `activatedLocale` (asserted). No API removes an
  explicit entry, so the chosen country stays explicit on the default language after a run; repeat
  runs need `E2E_NINTH_COUNTRY` once no default-source country is left (superseded by fix 03).

## Fix 03: journey retry, label-test race and cross-site form status

- `e2e/visual/project-locales.ts` exports `PROJECT_LOCALES` (used by `playwright.config.ts` for the
  16 projects) and `PROJECT_COUNTRY_CODES` (`dk gb se no pl it fr de`).
- The journey describe runs with `retries: 0` (the config's global `retries: 1` no longer applies to
  it): it changes data, so a retry starts from attempt 1's leftovers and hides its real failure.
- `chooseJourneyCountry` takes the first configured country whose `locale === default_locale`
  (explicit or default source) and never a project country; `E2E_NINTH_COUNTRY` naming a project
  country throws. Repeat runs therefore reuse the previous run's country without the variable.
- The region-switcher label test asserts only the project countries' labels (each must be
  published); the journey's country can lag in the storefront by up to 240 s.
- Security case: the form status is a soft assertion (production-like: 401; otherwise 401 or 415)
  attached as `foreign-form-status.txt`, so the unchanged-document checks always run.

## Fix 04: probe moved, Next control-flow errors rethrown

- The planner's Region Query probe now lives at `issues/NIMBUS-176/samples/verify-region-query.ts`
  (kept as evidence, not compiled); `apps/backend/scripts/` is gone and `medusa build` passes with
  nothing moved aside. The samples JSON still names the old path: it records what was run.
- `getCountryLanguageSnapshot` calls `unstable_rethrow(error)` (`next/navigation`, verified in the
  installed next 15.5.18 `unstable-rethrow.server.js`: rethrows DynamicServerError, redirect/notFound,
  postpone, bailout-to-CSR and hanging-promise errors, also via `error.cause`) before any fallback,
  so a control-flow error sets no `retryAt` and logs nothing. Tests build a real
  `DynamicServerError` from `next/dist/client/components/hooks-server-context`.
