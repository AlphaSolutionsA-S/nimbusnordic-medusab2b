# Branch notes: NIMBUS-162

## 01 Email-language rule

- `apps/backend/src/workflows/transactional-email/utils/email-language.ts` exports
  `chooseEmailLanguage({ requestCountry?, companyCountry?, configuredCountries, assignments })`
  → `{ locale, linkCountry }`, plus `DEFAULT_EMAIL_LINK_COUNTRY` (`"dk"`) and the types
  `EmailLanguageInput`, `EmailLanguage`.
- The `en` default is `DEFAULT_COUNTRY_LOCALE` from `modules/storefront-translation/country-languages.ts`;
  import it from there rather than writing `"en"` again.
- `requestCountry` is `unknown` and taken only as an exact lower-case two-letter code (no trim);
  `companyCountry` is trimmed and lower-cased. Pass `assignments: null` when the configuration is not
  initialized.
- `configuredCountries` should come from `configuredCountryCodes(regions)` in
  `workflows/storefront-translation/utils/country-language-scope.ts` (the existing region read).
- Pitfall: `pnpm ai:check` is at the root `AGENTS.md` size limit (32768 bytes, now 32910 after this
  task's registry row); any further Tier 0 row in later tasks (e.g. task 02's built-in-copy row) needs
  space freed first. Recorded as a deviation for a human decision.
