# Deviation report: Translated password-reset and employee-invitation emails (NIMBUS-162 + NIMBUS-242)

Branch `feature/NIMBUS-162`, merge-base `13e861e`, HEAD `3c9509d` (8 commits: tasks 01–06, fix 01,
consolidation). Reviewed 2026-10-25 by the integration reviewer.

## Deviations from scope and plan

- **Hard constraint holds: `customer_id` branches unchanged (NIMBUS-243).** The store route diff is
  one line (`country_code: body.country_code`) inside the `else` (email + password) branch of
  `api/store/companies/[id]/employees/route.ts`; the `customer_id` branch runs
  `createEmployeesWorkflow` exactly as before. No file under `api/admin/` changed. Acceptable.
- **`pnpm ai:check` fails on size (tasks 01, 02).** The two new `decisions.md` rows push root
  `AGENTS.md` to 33103 bytes (limit 32768). Workers left other Tier 0 text alone and escalated.
  Not a code defect, but the check is red: **needs a human decision** (Open question 1).
- Task 01: the `en` default reuses `DEFAULT_COUNTRY_LOCALE` and `isCountryCode` from
  `modules/storefront-translation/country-languages.ts` (pure module file; `bound-helper-pure` bans
  only services, steps and the workflows SDK). Acceptable; avoids a second constant.
- Task 02: rich-text tags (`<b>`) are read as literal text, not as unusable (escaped by the
  builders). An unfillable built-in copy throws `UNEXPECTED_STATE` (code defect, not a fallback).
  Acceptable; matches plan section 7 ("odd characters shown literally").
- Task 03: the subject is not HTML-escaped; whitespace (CR/LF included) collapses to one space
  (it is a mail header). Builder signature changed to return `{ notification, fallbacks }`
  (internal to the domain). The `when` block got a name (lint). The `/se/` reset spec case gained
  a region (anticipated in plan section 10). Acceptable.
- Task 03/05: the reset builder no longer validates `metadata.country_code` itself; the country
  check lives only in `chooseEmailLanguage` (one home). Acceptable.
- Task 04: added a unit spec for the request schema; the "no event" cases use a control Admin
  invitation instead of a timed wait; the staged-then-cleared path is not exercised because
  `emitEventStep` is the last step (framework behaviour verified in plan section 9). The store
  `POST` body was already over 40 lines (`limit-route-body`, pre-existing; NIMBUS-243 forbids
  touching the branches); this branch adds one line and no `if`. Acceptable.
- Task 04: `country_code?` added to the backend mirror type `types/company/http.ts`
  `StoreCreateEmployee` (unused by code, keeps the declared shape accurate). Acceptable.
- Task 05: the `STORE_CORS` origin check moved from the reset builder into
  `transactional-email/utils/storefront-origin.ts`, shared by both builders; its error message
  changed to "Email storefront configuration is invalid" (nothing asserted the old text).
  `read-invitation-recipient` throws `NOT_FOUND` when the customer has no email. Provider failure is
  simulated by rejecting `createNotifications`. Acceptable.
- Task 06: `createEmployee` (S2) unchanged (it already forwards the body); the country comes from
  `useParams` in the card. Storefront lint not run (environment, see Tests). Acceptable.
- Fix 01: test-only change to `employee-invitation.spec.ts` (employee read through the
  employee–customer link). Acceptable.
- No migrations, no new module, no `medusa-config.ts` change, as planned.

## Consolidation changes

- `EmailLocalization` and `PreparedEmail` (previously duplicated) merged into
  `apps/backend/src/workflows/transactional-email/utils/email-notification.ts`, with one home for the
  subject whitespace-collapse rule (`emailSubject()`).
- Origin-check refusal cases moved to
  `transactional-email/utils/__tests__/storefront-origin.unit.spec.ts`; each builder spec keeps one
  fail-closed case.
- No behaviour change.
- Flagged by the consolidator (verified here): the configured notification provider is
  `@medusajs/medusa/notification-local` (`apps/backend/medusa-config.ts:41-54`), whose `send()`
  logs `to`, `template` and `JSON.stringify(data)` at info level
  (`notification-local/dist/services/local.js:15-18`, 2.21.2). That puts the recipient address and
  the reset URL with its token (pre-existing, accepted in NIMBUS-133 per
  `docs/architecture/store-access.md` "Accepted limits") and now the invited employee's address plus
  `login_url` (no secret) into logs. See Open question 2.

## Findings

1. **Medium, personal data in logs (pre-existing mechanism, new email).**
   `apps/backend/medusa-config.ts:46` — if `notification-local` is what runs in production (rather
   than Cloud's Medusa Emails provider replacing it), every invitation logs the invited address.
   Scope's non-functional rule says personal data never reaches application logs; the branch's own
   code does not log it, but the provider does. NIMBUS-133 accepted this for the reset URL only.
   Not a wiring defect; a decision (Open question 2).
2. **Low, invite fails rather than falling back on an odd route segment.**
   `apps/storefront/src/modules/account/components/invite-employee-card/index.tsx:14,33` sends the
   raw `[countryCode]` route segment. The middleware accepts a segment that merely *contains* a
   region code (`apps/storefront/src/middleware.ts:144-145`, `includes`), so a page such as
   `/dkx/account/company` would send `country_code: "dkx"`, which the strict store schema refuses
   with 400 and no employee is created. The plan says the country is presentation only; here a bad
   country blocks the action instead of giving English. Practically unreachable from normal
   navigation (links use the exact code). Options in Open question 3.
3. **Low, dead type exports.** `DEFAULT_EMAIL_LINK_COUNTRY`, `EmailLanguageInput`,
   `LocalizeEmailStepInput`, `ReadInvitationRecipientInput`, `InvitationRecipientWithCountry`,
   `PreparePasswordResetNotificationInput`, `PrepareEmployeeInvitationNotificationInput` and
   `EmailTexts` are exported but used only in their own file; the backend `StoreCreateEmployee`
   mirror type is unused. Harmless; no action required.
4. Design rows checked and holding:
   - Data model: no tables or migrations; notification `data` is exactly `{ reset_url, locale }` /
     `{ login_url, locale }`; report rows carry only `kind`, `locale`, `key`, `page_path` (fixed
     source label).
   - State table: event staged by `emitEventStep` as the last step of
     `createEmployeeAccountWorkflow` (`create-employee-account.ts:67-78`), payload exactly
     `customer_id`, `company_id`, `country_code` (null from Admin); `customer_id` branch emits nothing.
   - Security matrix: recipient read by id on the server (`read-invitation-recipient.ts`); country
     validated `^[a-z]{2}$` plus region membership; company country read from the company row by the
     route's id; link origin from `STORE_CORS` only; every body text and both URLs escaped after
     filling; subject whitespace collapsed; no credential in the invitation (one link, asserted);
     report step runs after send and swallows its own failure, logging the message only.
   - Business rules: two new homes registered in `ai/architecture/decisions.md`
     (`email-language.ts`, `email-texts.ts`, built-in copies as approved fallback). No second
     implementation found. `email-texts.ts` uses the same ICU parser as `utils/translations/icu.ts`
     but for a different purpose (fill vs. signature compare), not a duplicate rule.
   - Layering: subscriber (L7) runs one workflow; steps read via module service and Query (the
     customer/company read is commented as a deliberate `data-core-read-workflows` exemption);
     utils are pure. No `as unknown as`, no `any` in new production code (`row.messages as
     MessageDocument` in `localize-email.ts:37` is a narrowing of the module's JSON column, not an
     unknown cast).
   - Wiring: `@formatjs/icu-messageformat-parser` is a declared backend dependency (2.11.4) on the
     merge-base, so a fresh clone resolves it. No circular imports, no duplicate routes, no
     uncommitted files (`git status` clean). Storefront and backend `StoreCreateEmployee` types agree.
     No comment cites plan, task or test-case ids.
   - Stale text: searches for the old error message, "Mail content stays English" and the English-only
     reset description find nothing stale; docs `store-access.md`, `country-languages.md` and
     `lib/i18n/README.md` were updated.

## Tests

- Security-path coverage: recipient not redirectable (strict schema rejects `to`; HTTP spec asserts
  every invitation notification goes to the invited address); country presentation-only
  (`../evil`, `SE`, `XX`, unknown → English + `dk`, unit and HTTP); company country from the server
  (strict schema rejects `company_country`); link destination fixed and origin checked
  (`storefront-origin.unit.spec.ts`); markup injection (`<script>`, quotes, `&`, `"><a href=`, CR/LF in
  texts, names and company); no credentials in invitation; no personal data in report rows (unit and
  HTTP); failed report and failed send do not fail the reset / undo the account (HTTP); `customer_id`
  path sends nothing (HTTP). All plan section 7 negative tests exist.
- Not added to `security-boundaries.spec.ts`: no new company-access property was introduced (the guard
  on the store route is unchanged), so none was required.
- Finalization (dispatcher): backend unit 83 suites / 1030 pass; admin 71/71; backend lint 0 errors;
  backend typecheck 22 = baseline; build OK; new/changed HTTP specs 35/35; the 3 failing
  `security-boundaries` cases and the quote specs fail identically on `develop` (pre-existing);
  storefront tests 3 failed = baseline; storefront typecheck 58 = baseline. **Storefront lint and
  build not run** (installed `next` 16.4.2 vs pinned 15.5); task 06's change is three lines and
  typechecks, but lint is unproven (Open question 4).
- Volume: about 1087 test lines added against about 576 production source lines in `apps/*/src`
  (import files and docs excluded). The ratio is driven by the 405-line HTTP spec and table-driven unit
  cases; after consolidation no duplicated cases were found (origin refusals live once).

## Open questions

1. **`pnpm ai:check` fails: root `AGENTS.md` is 33103 bytes (limit 32768).** Options: (a) trim other
   Tier 0 text (e.g. the long consumer list on the "Country language assignment" row, or the
   "Formatting tag" row) by about 340 bytes; (b) merge the two new email rows into one; (c) move part
   of Tier 0 out of the always-loaded block; (d) push with the check red and register a follow-up.
2. **Personal data in production logs via `notification-local`.** Is `notification-local` the
   provider that actually runs on Medusa Cloud, or does Medusa Emails replace it there? If it runs,
   every reset logs the token URL (accepted in NIMBUS-133) and every invitation now logs the invited
   address. Options: (a) accept and document alongside the NIMBUS-133 limit; (b) register a separate
   issue to configure the Cloud email provider or a non-logging provider; (c) block push until
   checked with `mcloud` runtime logs.
3. **Odd route segment makes the invite fail with 400 (Finding 2).** Options: (a) accept (not
   reachable through normal links); (b) small follow-up: send `country_code` only when it matches
   `^[a-z]{2}$` in the card, so the backend falls back to the company country; (c) tighten the
   middleware's `includes` check (separate issue).
4. **Storefront lint and build unverified locally** (dependency install mismatch). Options: (a) run
   `pnpm install` against the lockfile and re-run storefront lint and build before push; (b) push and
   rely on the Medusa Cloud build.
5. **Jira status.** NIMBUS-162 is in Estimation and NIMBUS-242 before Scope approved; neither offers a
   direct move to In Progress, so neither was moved (comments 255281, 255282). Decide the transitions
   to apply before the PR (and whether NIMBUS-242 needs its scope-approved step recorded).

## Verify after deploy

- 03 Reset email on the translated mechanism: Cloud Email Activity / `notification.data.locale` for
  a reset requested from a country assigned Danish shows `da` and a Danish subject.
- 05 Invitation email: Cloud Email Activity / `notification` row with template `employee-invitation`
  for one invited test employee: recipient is the invited address, `data.locale` matches the page
  country's language.
- Release (plan section 10, item 2): import the `Emails` keys (`passwordReset`, `employeeInvitation`)
  from the eight files in every environment (Translations → Import, merge); until then emails use
  built-in English and the keys show in Missing texts with an `email:` source.
- Release (plan section 2, item 1): read `company.country` for a handful of production companies
  (Admin company page or a database read); if names such as "Denmark" appear, Admin invitations fall
  back to English and `dk`: register a follow-up.
- Tasks 01, 02, 04, 06: no `Verify after deploy:` line (nothing user-visible or stored on their own).
