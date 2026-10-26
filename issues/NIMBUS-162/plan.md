# Plan: Translated password-reset and employee-invitation emails (NIMBUS-162 + NIMBUS-242)

> Record of NIMBUS-162, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Scope:** `issues/NIMBUS-162/scope.md` (approved 2026-10-24) and `issues/NIMBUS-242/feature.md`
(decided rules, acceptance criteria and English text). Planned together on Klaus Petersen's
instruction (2026-10-24); one branch, `feature/NIMBUS-162` from `develop`. Backend, plus one
storefront change and the import files.

## 1. Summary [High]

The password-reset email becomes translated, and a new invitation email goes to every employee
account created through the shared employee-account workflow, in the same mechanism. The email's
language follows the storefront country it was triggered from, else the company's country (Admin
invitations), else English. Every email text is a translation key under a new `Emails` namespace
in the existing message documents, so Nimbus edits it in the Admin translation editor; each text
falls back to English and then to a built-in English copy in code, and every fallback is reported
to the Admin "Missing texts" list with the email's name as its source.

Three decisions shape it:

- **The invitation is decoupled from the account creation by an event.** The employee-account
  workflow emits `employee.invited` (ids and the page country only); a subscriber runs the
  invitation-email workflow. Medusa emits the event only after the account workflow succeeds, and a
  failing email can never roll the account back (verified in installed source, section 9).
- **Two pure rules carry the logic** (language choice; text fallback and placeholder filling), unit
  tested on plain data. Steps only read and send.
- **Language is recorded on the Notification row** (`data.locale`). Medusa stores `data` but not
  the rendered `content`, so the rendered body (names, company) is not persisted.

**How to review this plan.** This plan is the human review gate: approving it is what allows
dispatch. Section headings carry a review level (Critical, High, Medium); individual rows flagged
`Critical` need a stop. Answer every item in section 2. Read sections 5 to 7 closely (data model,
state tables, security matrix): past misses were found there. The task files hold more depth but are
not required reading. A question is often quicker to settle by asking the planning agent in chat.

## 2. Needs your decision [Critical]

1. **`company.country` format is UNVERIFIED against real data** (no database access from the
   planning session). Code shows Business Central's customer `country` stored as-is (test fixtures
   `"DK"`, upper case); the store company-registration route accepts free text. The rule trims and
   lower-cases it and uses it only when it is a two-letter code in a region; anything else gives
   English and the `dk` link (R6). The design does not depend on the format being right, only the
   usefulness of the Admin fallback does. *Default:* dispatch; read `country` for a handful of
   production companies before release (Admin company page or a database read) and register a
   follow-up if names such as "Denmark" appear.
   **Answer:** Accepted (Klaus Petersen, 2026-10-24): dispatch now; reading a few production values
   stays a release check.
2. **R4 tightens the reset link country.** Today any two-letter code builds `/<code>/reset-password`;
   per R4, a code not in any region now gives English and the `dk` link. *Default:* apply R4.
   **Answer:** Accepted (Klaus Petersen, 2026-10-24).
3. **Invitation without a first name** (Admin can create one). *Default:* a separate greeting key
   without the name ("Hi,"), so the text never shows an empty placeholder.
   **Answer:** Accepted (Klaus Petersen, 2026-10-24).
4. **A text with an unknown placeholder or other ICU syntax** (for example a pasted `{password}`) is
   treated as unusable for the email and the next fallback is used; it is not reported, because the
   key is not missing (the Admin editor already warns about placeholder differences from English).
   *Default:* accept.
   **Answer:** Accepted (Klaus Petersen, 2026-10-24).

Plan approved by Klaus Petersen on 2026-10-24.

## 3. Flows [High]

### A. Password reset email (tasks 01, 02, 03)

1. A customer asks for a reset on `/<country>/forgot-password`; Medusa emits `auth.password_reset`
   with the account's email, the token and `metadata.country_code` (unchanged).
2. The existing subscriber runs the reset-email workflow; non-customer actors still get nothing.
3. The workflow reads the countries in regions, the stored country-language assignments and the
   active message documents for the chosen language and English.
4. The language rule picks the language and link country: request country in a region → its assigned
   language (unassigned → English) and that link country; otherwise English and `dk`.
5. The text rule fills each reset text: chosen language, else English, else built-in English; each
   fallback is listed with source `email:customer-password-reset`.
6. The builder escapes every text, builds the link from `STORE_CORS` and the token, and records
   `locale` and `reset_url` in the notification data.
7. Core `sendNotificationsStep` sends on channel `email` through the existing provider.
8. After sending, the fallbacks are reported through the translation module's existing report
   (existing caps, dismissals and "only while still missing" apply); a failed report is logged
   without personal data and does not fail the workflow.

### B. Invitation from the storefront company page (tasks 04, 05, 06)

1. A company admin submits "Invite employee" on `/<country>/account/company`; the server action
   sends the page's country with the unchanged form fields.
2. The store route (company admin only, strict schema, `country_code` optional) runs the
   employee-account workflow with it.
3. The workflow creates the auth identity, customer and employee as today, then stages
   `employee.invited` with customer id, company id and country.
4. Medusa releases the event only when the workflow succeeded; a failed creation sends nothing.
5. The subscriber runs the invitation-email workflow, which reads the new customer's email and first
   name and the company's name and country.
6. Language and link country: the page country if in a region, else the company country (A4 rule),
   else English and `dk`.
7. Texts, escaping and fallbacks as A5–A6, source `email:employee-invitation`; the email holds the
   company name, the first name and a login link `/<country>/account`, nothing else.
8. Send (A7) to the customer's email only; report fallbacks (A8).
9. If sending fails, the employee account stays; the failure is logged by the event bus.

### C. Invitation from Medusa Admin (tasks 04, 05)

1. Nimbus staff create an employee with email and password on the company page in Admin.
2. The Admin route runs the same workflow without a country (B3–B4).
3. The email follows B5–B9 with the company country as the only country (R6).

### D. Linking an existing customer (no task changes it)

1. Store or Admin route with `customer_id` runs only the employee-creation workflow: no event, no
   email (R7). The store path's missing ownership check is NIMBUS-243, out of this plan.

## 4. What gets built [High]

**01 Email-language rule (NIMBUS-162).** A pure decision function (L5) that takes the request
country, the company country, the countries in regions and the stored assignments, and returns the
email language and the link country. Request country first, company country second, each used only
when it is a two-letter code (company value trimmed and lower-cased) in a region; the language is
that country's assignment or English when unassigned or when assignments are not initialized; with
no usable country, English and `dk`. Registered in the business-rule registry as the home of "email
language and link country".

**02 Email text rule (NIMBUS-162).** A pure decision function (L5) that, given an email's text keys
with their built-in English copies, the chosen language's document (or none), the English document
(or none), the placeholder values and the email's source label, returns one plain text per key and
the list of fallbacks to report. Per key: chosen language, else English, else built-in. A text that
is missing, blank, unparsable or uses a placeholder the email does not supply moves to the next
source; only missing or blank keys are reported (chosen-language key when English is used, English
key when the built-in copy is used; none for a language whose document is unavailable). Also a pure
HTML-escaping helper used by the email builders. Registers the built-in English copies in the
registry as an approved fallback copy of the English `Emails` texts.

**03 Reset email on the mechanism (NIMBUS-162).** Two shared steps (L3) under a new
`transactional-email` workflow domain: one reads the stored assignments and the active documents for
the chosen language and English and applies rules 01; one reports fallbacks through the translation
module and never fails the email. The reset workflow (L4) gains the region-country read (existing
step), the localization step, the builder and the report step; the builder (L5) keeps today's link,
origin checks and English wording, now from keys `Emails.passwordReset.*` with built-in copies,
escapes every text and records `locale` in the notification data. English plus draft translations
of the four reset keys go into the eight import files. Enforces R2–R4, R8–R10, R14, R15.

**04 Invitation trigger and store request country (NIMBUS-242).** The store employee-creation
request (L6 validator, strict) gains an optional `country_code` (two lower-case letters); the route
passes it to the employee-account workflow. The workflow (L4) takes an optional country and, as its
last step, stages the `employee.invited` event with customer id, company id and country (null from
Admin). The Admin route and both `customer_id` branches are unchanged. Enforces R5, R7 and "a failed
email never undoes the invitation".

**05 Invitation email (NIMBUS-242).** A subscriber (L7) on `employee.invited` runs a new
invitation-email workflow (L4): a step (L3) reads the customer's email and first name and the
company's name and country; then the region-country read, the localization step with the company
country as second choice, the builder (L5: keys `Emails.employeeInvitation.*`, built-in copies of
the decided English text, login link `/<link country>/account` from `STORE_CORS`, no credential),
core send and the report step. English plus draft translations of the six invitation keys go into
the eight import files. Enforces R6, R13, R15 and 242's acceptance criteria.

**06 Storefront invite card sends the country (NIMBUS-242).** The invite card (S4) passes the
current page's country to the existing server action (S2), which sends it as `country_code`; the
shared request type gains the optional field. Form fields, labels and behaviour are unchanged.

## 5. Data model [High]

No new tables, columns or migrations.

| Entity or field | Key and meaning | Existing callers | Owner | Written by | Stored / derived | Encrypted | Mutable until | Retention, deletion | Index |
|---|---|---|---|---|---|---|---|---|---|
| `Emails.passwordReset.{subject,intro,linkLabel,expiry}` | Reset texts; no placeholders | none (new) | `storefrontTranslation` | delivery team via import (8 languages); Admin editor | stored in `storefront_translation.messages` | no (public on `/store/ui-translations/:locale`) | always editable | until edited or removed by import | existing |
| `Emails.employeeInvitation.{subject,greeting,greetingWithoutName,body,passwordHint,loginLabel}` | Invitation texts; `{firstName}` in `greeting`, `{companyName}` in `body` | none (new) | same | same | same | no | always | same | existing |
| Built-in English copies | Code copy of the English values above, used only when the English key is missing or unusable | new | code (registry row) | developers | code | no | per release | per release | — |
| `translation_missing_key` row from an email | `locale`, `key`, count, first/last seen, `last_page_path` = `email:customer-password-reset` or `email:employee-invitation`, `dismissed` | Admin Missing texts list (`MissingKeysTable.tsx` shows the path as plain text) | `storefrontTranslation` | email workflows via the module's `reportMissing` | stored | no; never recipient, names, token or link | count and last seen on each report | until the key is filled (existing clear-on-fill) or dismissed | existing (locale, key) |
| `country_code` on `POST /store/companies/:id/employees` | Page country, optional, `^[a-z]{2}$` | storefront `createEmployee` (task 06) | request only | storefront server action | transient | no | — | request lifetime | — |
| `employee.invited` event data | `customer_id`, `company_id`, `country_code` (string or null); no personal data | subscriber (task 05) | event bus | employee-account workflow | transient (in memory or Redis queue) | no | — | until consumed | — |
| `notification.data.locale` | Language actually used | none (new) | Medusa Notification module | email workflows | stored in `notification.data` (JSON) | no | never | existing Medusa retention (no TTL), accepted in NIMBUS-133 | — |
| `notification.data.login_url` / `reset_url` | Link sent (reset URL carries the token, as today) | reset: password-recovery spec | Notification module | email workflows | stored | no | never | as above | — |
| `notification.to` | Recipient: reset event's email; invitation: the created customer's email | existing | Notification module | sendNotificationsStep | stored | no (personal data) | never | as above | existing |
| Rendered subject and HTML | `content` passed to the provider | — | provider | — | **not stored** by the Notification module (verified, section 9) | — | — | — | — |
| `company.country` | Fallback country, read only; format UNVERIFIED (section 2) | BC sync, Admin | `company` | BC sync; store company registration | stored | no | BC sync | existing | — |

Cardinality: one invitation event and at most one invitation notification per created employee
account; one reset notification per reset event (as today).

## 6. Business rules as state tables [High]

**Employee account creation (store and Admin routes, email + password branch)**

| Current state | Event | Outcome | Side effects on other rows and sessions |
|---|---|---|---|
| no account for the email | create succeeds | identity, customer, employee created (as today); `employee.invited` released | invitation workflow runs once; one `notification` row; possible `translation_missing_key` rows |
| no account | create fails at any step | everything compensated (as today) | event cleared, no email |
| account created | email send fails | account and employee stay | notification row status `failure` (Medusa); error logged by the event bus, message only |
| account created | fallback report fails | email already sent | warning logged without personal data |
| existing customer | link by `customer_id` | employee created (as today) | no event, no email (R7) |

Precondition: store route refused unless the caller is admin of company `:id` (unchanged); Admin route
needs an Admin session (unchanged). Actor recorded: none new.

**Email language and link (both emails)**

| Request country | Company country | Assignments | Language | Link country |
|---|---|---|---|---|
| in a region, assigned `da` | any | initialized | `da` | request country |
| in a region, unassigned | any | initialized | `en` | request country |
| in a region | any | not initialized | `en` | request country |
| absent, malformed or not in a region | in a region (after trim and lower-case) | as above | that country's language | company country |
| absent, malformed or not in a region | absent or unusable | any | `en` | `dk` |

Reset emails have no company country. A chosen language with no active document gives English for
every text, without reports.

**Per text** (chosen language L ≠ `en`): L usable → L. L missing/blank, English usable → English,
report L's key. Both missing/blank → built-in, report L's and English's keys. Present but unusable
(unknown placeholder, parse error) → next source, no report for it. For L = `en` only the English
step applies.

## 7. Security-property matrix [Critical]

| Property | Control | Trust root | Failure behaviour | Negative test (task) |
|---|---|---|---|---|
| Recipient cannot be redirected | Reset: `to` = event's entity id (as today). Invite: `to` = email of the customer id in the event, read on the server; event carries no address | Auth event; customer record created by the workflow | no email rather than another address | strict store schema refuses extra fields such as `to`; notification `to` equals the invited address (04, 05) |
| Country is presentation only | Validated `^[a-z]{2}$` and region membership; used for language and link path only | backend validation; Admin assignments | wrong language, never wrong access | `../evil`, `XX`, unknown code → English and `dk` (01, 03, 04) |
| Company-country fallback from the server | Read from the company row by the id the route took from the URL (behind company-admin or Admin auth), never from the body | company module | unusable → English | body cannot supply a company country (strict schema) (04) |
| Link destination fixed | Origin from `STORE_CORS` (existing https/credential checks); path built in code; texts cannot carry URLs into `href` | deployment config | invalid config: no email (existing) | translated label with `"><a href=` stays text; link unchanged (02, 03, 05) |
| Admin text cannot inject markup | Every text escaped after placeholder filling; subject whitespace collapsed to single spaces (no header line breaks) | code | odd characters shown literally | `<script>`, quotes, `&`, CR/LF in texts and in company/first name (02, 03, 05) |
| No credentials in the invitation | Builder receives no password, token or reset link; layout has one link, the login page | code + review | n/a | rendered invite HTML and data contain no password, token or `reset-password` (05) |
| Personal data stays out of logs, events and reports | Event data ids + country; report rows carry key, locale, source label; errors log message only | code review; existing logging rule | generic message logged | report rows after an invite contain no email, name or company (05); event payload keys exactly the three ids/country (04) |
| Report cannot be flooded by emails | Only real fallbacks; existing per-language (2,500) and global (20,000) caps, dismissals | existing module rules | extra reports ignored; email unaffected | covered by existing module tests; email path asserts the cap result is ignored (03) |
| Reset enumeration unchanged | Same route and response; language work happens after the event | existing | unchanged | existing password-recovery spec stays green (03) |
| Invitation cannot be triggered by linking | Event only on the email+password branch | code | no email | `customer_id` path produces no notification (04) |

## 8. Decisions [High for new, Medium for scope]

**New in this plan**

- Trigger is a custom event `employee.invited` staged by `emitEventStep` in the employee-account
  workflow, not a direct send in it: a send inside would roll back the account on email failure.
  Core `customer.created` cannot tell an invitation apart (242 triage). Verified (section 9).
- Event data holds ids and the country only; the email workflow reads email, first name and company
  on the server. Keeps personal data out of the event queue.
- One shared workflow domain `transactional-email` (two pure rules, two steps); each email keeps its
  own workflow and builder in its domain (`customer`, `employee`).
- Language comes from the stored assignments plus the region list, not from the published
  country-language list: publication fails closed when any assigned language is inactive, which
  would stop every email.
- Notification `data.locale` records the language (answers the scope's verification item); the
  rendered content is not stored by Medusa, so no names or company end up in `notification`.
- Fallback reports use the module's `reportMissing` directly from a new step, after sending, and
  never fail the workflow; the internal HTTP route's leading-`/` rule does not apply (verified).
- Placeholders are simple `{name}` arguments only; anything else in a text makes it unusable for the
  email (section 2, item 4).
- A database failure while reading texts fails the email (no email) and is logged by the event bus;
  only missing texts fall back. Sending with unreadable translations would hide an outage.
- Translation key names (section 5) are the seam between code and import files.
- "Does the framework already do this?" Medusa has no localized notification templates (the
  Notification module passes `content` through); core `sendNotificationsStep` and `emitEventStep` are
  reused; no core internal is called.

**From the scope:** R1–R15 as approved (two emails; language from the triggering country; company
fallback; per-text English fallback; built-in English; report every fallback; no new language field;
delivery unchanged; drafts for 8 languages).

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| `emitEventStep` (core-flows 2.21.2) | Staged under the workflow's event group; released only on success, cleared when the workflow fails or reverts; a top-level `.run` always gets an event group id | `core-flows/dist/common/steps/emit-event.js`; `workflows-sdk/dist/helper/workflow-export.js` (`attachOnFinishReleaseEvents`, `eventGroupId ??=`) — verified |
| Subscriber failure does not reach the emitting workflow | Local bus runs subscribers asynchronously in a try/catch; Redis bus runs them in a worker with `attempts: 1` (no retry, so no duplicate email) | `event-bus-local/dist/services/event-bus-local.js` (wrapped subscriber); `event-bus-redis/dist/services/event-bus-redis.js` — verified |
| `sendNotificationsStep` | Calls `createNotifications`; no compensation; a provider failure marks the row `failure` and throws | `core-flows/dist/notification/steps/send-notifications.js`; `notification/dist/services/notification-module-service.js` — verified |
| Notification persistence | Columns `to`, `channel`, `template`, `data` (JSON), `status`, …; no `content` column | `notification/dist/models/notification.js` (2.21.2) — verified |
| `reportMissing(reports)` | Accepts any `page_path` string, truncated to 512; records only for a provisioned locale while the key is absent or blank; dismissed rows skipped; caps apply | `modules/storefront-translation/service.ts`; leading `/` only in `api/internal/.../validators.ts`; Admin renders the path as text — verified |
| `getCountryLanguageConfiguration()` | Returns stored assignments or null while uninitialized | `service.ts` — verified |
| `listStorefrontTranslations({ locale, is_active })` | Generated list method; used the same way by `/store/ui-translations/:locale` | `api/store/ui-translations/[locale]/route.ts` — verified |
| `query.graph` customer `email`, `first_name`; company `name`, `country` | Columns of their own models (not computed) | customer and company data models — verified |
| `TestEventUtils.waitSubscribersExecution` | Waits for a named event's subscribers in integration specs | used in `integration-tests/http/security/password-recovery.spec.ts` — verified |

## 10. Open risks and gates [Medium]

| Risk or gate | Owner | Blocking |
|---|---|---|
| `company.country` format (section 2, item 1) | Klaus Petersen | no (fails safe to English) |
| Release: import the `Emails` keys from the eight files in every environment (Translations → Import, merge); until then emails use built-in English and rows appear in Missing texts | delivery team, at release | no |
| Draft translations need Nimbus review in Admin (R12) | Nimbus | no |
| NIMBUS-243 (store route links any companyless `customer_id`): separate bug, not fixed here; nothing here builds on that branch | Klaus Petersen | no |
| `password-recovery.spec.ts` asserts a `/se/` link without creating a region: with R4 it needs a region fixture | task 03 worker | no |
| Delivery and the translated subject are confirmed only after deploy, in Cloud's Email Activity page (R14) | delivery team | no |
| Typecheck baseline fails today (`verification.md`): per task, at or below baseline | dispatcher | no |
