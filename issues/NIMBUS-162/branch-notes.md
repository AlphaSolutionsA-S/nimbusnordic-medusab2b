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

## 03 Reset email on the translated mechanism

- `workflows/transactional-email/steps/localize-email.ts`: `localizeEmailStep({ requestCountry?, companyCountry?, configuredCountries })`
  → `EmailLocalization` `{ locale, linkCountry, chosen, english }` (active documents only; for `en`
  `chosen` and `english` are the same document). Feed `configuredCountries` from
  `listConfiguredCountryCodesStep()` (no input).
- `workflows/transactional-email/steps/report-email-fallbacks.ts`: `reportEmailFallbacksStep(MissingReport[])`;
  skips an empty list, catches and logs `error.message` only. Call it after `sendNotificationsStep`
  (steps run in declaration order).
- Pattern in `workflows/customer/workflows/send-password-reset.ts`: prepare step returns
  `{ notification, fallbacks }`; `transform` splits them for send and report. Named `when` block
  (lint `when-block-must-have-name`).
- Subject is a header: collapse `\s+` to one space, do not HTML-escape; escape body texts and the URL.
- Integration fixtures: `mutateDocument({ operation: 'import', input: { locale, expected_version: null, mode: 'replace', messages, confirm_removed: false } })`,
  then `activate` at version 1; `bootstrapCountryLanguages({ se: 'sv' })` needs `en` and targets active;
  regions via `Modules.REGION` `createRegions`. Missing rows: `listTranslationMissingKeys({ locale })`.
- HTTP specs can't run locally here: no Postgres on 5432 and `BUSINESS_CENTRAL_DISCOVERY_URL` unset.
- Import files are CRLF with a trailing CRLF; `JSON.stringify(doc, null, 2)` with CRLF round-trips exactly.

## 04 Invitation trigger and store request country

- `workflows/employee/workflows/create-employee-account.ts` exports `EMPLOYEE_INVITED_EVENT`
  (`"employee.invited"`) and type `EmployeeInvitedEventData` `{ customer_id, company_id, country_code: string | null }`;
  the workflow input has `country_code?: string`. Event is staged by `emitEventStep` as the last step.
- Store `StoreCreateEmployee` accepts `country_code` (`^[a-z]{2}$`, optional, still strict); the store route
  passes it through on the email+password branch only. Admin route passes none, so Admin events carry `null`.
- HTTP spec pattern in `integration-tests/http/companies/employee-invitation.spec.ts`: a collector subscribed via
  `eventBus.subscribe(name, fn, { subscriberId })` (unsubscribe in `afterEach`), `TestEventUtils.waitSubscribersExecution`
  for positive cases, and a control Admin invitation for "no event" cases. When task 05 adds the real
  subscriber, `waitSubscribersExecution` will also wait for it (it wraps every listener): its email
  workflow then runs in these specs, so they need whatever fixtures it requires not to throw (a throw is
  caught and logged by the local bus, not failed).
- Not run locally (no Postgres); typechecked only.

## 05 Invitation email

- `subscribers/employee-invited.ts` → `workflows/employee/workflows/send-employee-invitation.ts`
  (`sendEmployeeInvitationWorkflow`, input `EmployeeInvitedEventData`, returns the sent notifications).
- Steps: `employee/steps/read-invitation-recipient.ts` (customer email/first name, company name/country by id;
  throws when the customer has no email) and `prepare-employee-invitation-notification.ts`.
- Builder `employee/utils/employee-invitation-notification.ts`: `buildEmployeeInvitationNotification(recipient, storeCors, localization)`,
  `EMPLOYEE_INVITATION_EMAIL_SOURCE`; it resolves only the greeting it sends (`greeting` with a first name,
  else `greetingWithoutName`) so the built-in copy never lacks a value.
- New shared `transactional-email/utils/storefront-origin.ts` (`emailStorefrontOrigin`), now also used by the reset builder.
- `employee-invitation.spec.ts` now sets `STORE_CORS` and seeds a se/dk region with en/sv/da in its
  "invitation email" block; the real subscriber runs in every case of that spec. Not run locally.

## 06 Storefront invite card sends the page country

- `InviteEmployeeCard` reads `countryCode` with `useParams` and passes it as `country_code` to `createEmployee`;
  `StoreCreateEmployee` (storefront `types/company/http.ts`) has `country_code?: string`. `createEmployee` forwards it unchanged.
- Tests rendering the card must mock `next/navigation` `useParams` (company-page test already does).
- Pitfall: storefront lint cannot run locally right now: installed `next` is 16.4.2 (package.json 15.5.28), so
  `next lint` is gone and direct `eslint` fails to load the config. Finalization needs a clean `pnpm install` first.

## Fix 01 (invitation spec employee lookup)

- `Employee` has no `customer_id` column; employee and customer are joined by the
  `src/links/employee-customer.ts` module link. In a spec, check a customer's employee with
  `query.graph({ entity: "customer", fields: ["employee.id", "employee.company_id"], filters: { email } })`
  (verified against real data in `employee-invitation.spec.ts`).
