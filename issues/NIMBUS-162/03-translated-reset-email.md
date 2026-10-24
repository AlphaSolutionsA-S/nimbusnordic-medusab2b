# 03: Reset email on the translated mechanism
**App:** backend (+ storefront import files) · **Layer:** L3, L4, L5 · **Depends on:** 01, 02 · **Parent:** NIMBUS-162

**Goal:** The reset email is sent in the language of the request country, with per-text fallback and reporting, built on two shared steps that task 05 reuses.
**Files / areas:** `workflows/transactional-email/steps/` (new: localization step, fallback-report step); `workflows/customer/{workflows/send-password-reset.ts,steps/prepare-password-reset-notification.ts,utils/password-reset-notification.ts}`; reuse `workflows/storefront-translation/steps/list-configured-country-codes.ts`; `apps/storefront/messages/*.json` (8 files, `Emails.passwordReset`).
**Seam contracts:** localization step input `{ requestCountry?: unknown; companyCountry?: string | null; configuredCountries: string[] }` → `{ locale; linkCountry; chosen: MessageDocument | null; english: MessageDocument | null }` (active documents only). Report step input `MissingReport[]`; never throws, logs message only, runs after `sendNotificationsStep`. Keys `Emails.passwordReset.{subject,intro,linkLabel,expiry}`; template `customer-password-reset`; source `email:customer-password-reset`; notification `data` = `{ reset_url, locale }`.
**Test intent:**
- unit (builder): English output equals today's wording; Danish texts used when given; every text escaped (`"><a href=`); subject with CR/LF collapsed; link unchanged and from `STORE_CORS`; existing destination and country-safety cases kept.
- integration (extend `integration-tests/http/security/password-recovery.spec.ts`, real Postgres): region with `se`/`dk`, `se` assigned a seeded active language → `data.locale` and link `/se/`; country not in a region → `en` and `/dk/`; key missing in that language → a `translation_missing_key` row with `last_page_path` `email:customer-password-reset` and no email/token in the row; failing `reportMissing` (spy) still yields a `success` notification.
**Done when:** tests pass; existing enumeration and token cases unchanged.
**Verify after deploy:** Cloud Email Activity / `notification.data.locale` for a reset requested from a country assigned Danish shows `da` and a Danish subject.
**Also update:** `password-reset-notification.unit.spec.ts` and `password-recovery.spec.ts` (the `/se/` case needs a region); `docs/architecture/store-access.md` (reset email paragraph, "English email"); `apps/storefront/src/lib/i18n/README.md` (NIMBUS-133 release note "Mail content stays English" → email-keys import step); `docs/architecture/country-languages.md` (emails use the assignments).

## Deviations

- The subject is plain text, not HTML-escaped: it is a mail header, so the builder collapses all whitespace (CR/LF included) to single spaces instead; every body text and the link are HTML-escaped. Escaping would show `&amp;` literally in mail clients.
- The country-safety unit case (`../evil` → `/dk/`) now runs through `chooseEmailLanguage` plus the builder: the builder takes the link country from the localization step and no longer validates `metadata.country_code` itself (one home for the rule, R4).
- Builder signature changed from `(event, storeCors)` → notification to `(event, storeCors, localization)` → `{ notification, fallbacks }`; `preparePasswordResetNotificationStep` input is now `{ event, localization }`. Internal to the customer domain, not a seam contract.
- The `when` block in `send-password-reset.ts` got a name (`send-reset-to-customer`), clearing the `@medusajs/when-block-must-have-name` lint warning on the block this task changed.
- The existing subscriber `/se/` integration case now creates a region with `se` and `dk` (R4 needs region membership), as the plan's risk table anticipated.
- Added integration case: failing `reportMissing` still gives a `success` notification with the chosen locale (also asserts the spy was called). No other cases dropped.
- The HTTP integration spec was NOT run: no local Postgres (nothing listens on 5432) and `BUSINESS_CENTRAL_DISCOVERY_URL` is unset, so `global-setup.ts` aborts. It typechecks; it must run at finalization.
- No `ai/` file changed (task 01/02 rows already cover the rules).

## Done-when evidence

- Tests pass (unit): `apps/backend/src/workflows/customer/utils/__tests__/password-reset-notification.unit.spec.ts`, all 12 cases (English wording identical to today's HTML; Danish texts; fallback reports with source `email:customer-password-reset`; escaping of `"><a href=`, `<script>`, quotes; subject CR/LF collapsed; link from first `STORE_CORS` origin; `../evil`/`redirect_url` ignored → `/dk/`; unusable `STORE_CORS` refused; localhost allowed).
- Tests pass (integration): `integration-tests/http/security/password-recovery.spec.ts` cases "sends the reset email in the language assigned to the request country", "sends English with the dk link for a country outside every region", "reports a text missing in the chosen language under the email source, without personal data", "still sends the email when reporting the fallbacks fails" — not run locally (no Postgres); typecheck only. Runs at finalization.
- Existing enumeration and token cases unchanged: the first seven cases in `password-recovery.spec.ts` are untouched (not run locally, see above).
- Also update `password-reset-notification.unit.spec.ts`: rewritten for the new signature, old cases kept.
- Also update `password-recovery.spec.ts`: `/se/` subscriber case gets a region; `dk` direct case asserts `locale: 'en'`.
- Also update `docs/architecture/store-access.md`: reset email paragraph describes language choice, keys, fallbacks, reporting and `data.locale`.
- Also update `apps/storefront/src/lib/i18n/README.md`: "Mail content stays English" replaced by the `Emails` import step.
- Also update `docs/architecture/country-languages.md`: Rules gain the line that emails use the stored assignments, not the publication.
- Import files: `apps/storefront/messages/{da,de,en,fr,it,no,pl,sv}.json` gain `Emails.passwordReset.{subject,intro,linkLabel,expiry}` (English + drafts).
