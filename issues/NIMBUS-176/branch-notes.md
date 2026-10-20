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
