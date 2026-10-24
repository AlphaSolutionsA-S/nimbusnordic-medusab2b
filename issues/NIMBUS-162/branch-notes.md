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

## 02 Email text rule and escaping

- `utils/email-texts.ts` exports `resolveEmailTexts(input: EmailTextsInput): EmailTexts` (seam as in the
  task); `utils/escape-html.ts` exports `escapeHtml(text)`.
- `keys` are full dotted keys (`Emails.passwordReset.subject`); documents are walked by segment.
- Only literal text and `{name}` with a value present in `values` are usable; plurals, selects,
  `{x, number}` and parse errors make a text unusable (next source, no report). A `#` outside a plural
  is read as literal text. Tags are kept as literal text, so
  builders must escape every text after filling (`texts` are unescaped).
- A built-in copy must fill with the values the builder passes, or the rule throws `MedusaError`
  `UNEXPECTED_STATE`: give an optional value its own key (e.g. greeting without a first name).
- Pass `english: null` when the `en` document is unavailable (no `en` reports); for locale `en` pass the
  English document as both `chosen` and `english` (only `en` is consulted).
- `source` becomes `page_path` on every report; use a fixed label, never a value.
- `AGENTS.md` is now 33103 bytes after this task's registry row (ai:check size failure persists).
