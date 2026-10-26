# Multi-lingual transactional emails: password reset and employee invitation

**Date:** 2026-10-24
**Status:** Implemented (scope approved by Klaus Petersen on 2026-10-24)
**Type:** Story
**Priority:** Medium (Jira)
**Issue:** [NIMBUS-162](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-162)
**Key:** NIMBUS-162
**Case folder:** issues/NIMBUS-162/
**Base Branch:** develop

## Background

The Customer Portal's screens are translated (NIMBUS-159, NIMBUS-175) and each storefront country
has one language that Nimbus admins assign in Medusa Admin (NIMBUS-176). Emails were left out of
that work. NIMBUS-133 shipped the password-reset email in English only and handed translation to
this issue. The new employee-invitation email is
[NIMBUS-242](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-242) (case folder
`issues/NIMBUS-242/`).

The Jira description of NIMBUS-162 talks about order confirmations and "other notifications". Klaus
Petersen narrowed it on 2026-10-24 to the two emails below. The description is left as written;
the narrowing is recorded as a comment.

### Current behaviour (checked in code, 2026-10-24)

- Password reset: the storefront sends the storefront country with the request
  (`metadata.country_code`, validated as two lower-case letters). The backend uses it only to build
  the link `/<country>/reset-password?token=…`, defaulting to `dk` when missing. Subject and body are
  fixed English text in `apps/backend/src/workflows/customer/utils/password-reset-notification.ts`.
- Employee invitation: the company-admin "Invite employee" form calls
  `POST /store/companies/:id/employees`. The request body (strict schema) carries name, email,
  phone, password, spending limit and admin flag, and no country. Medusa Admin creates employees
  through `POST /admin/companies/:id/employees`. Both routes run the same
  `createEmployeeAccountWorkflow` for a new account. No email is sent today.
- UI text lives in the storefront translation module: one message document per language, edited in
  the Admin translation editor, published on `/store/ui-translations/:locale`. English (`en`) is the
  reference language and cannot be deactivated. Country → language assignments live in
  `country_language_configuration`; a country without an assignment uses English. Text uses
  `{placeholder}` variables. Import files exist for eight languages (da, de, en, fr, it, no, pl, sv).
- Missing texts: the storefront reports a key that is absent or empty in a language to
  `POST /internal/ui-translations/missing-keys` (`{locale, kind: "key", key, page_path}`), which runs
  `reportMissingTranslationsWorkflow` → the module's `reportMissing`. That records a row in
  `translation_missing_key` (count, first/last seen, last page path) only while the language exists
  and the key is still absent or empty, skips dismissed rows, and caps rows per language and in
  total. The Admin Translations page lists the rows; filling the key clears them.
- Delivery: email delivery through Medusa Emails on Medusa Cloud (configuration and sender domain)
  is already taken care of (Klaus Petersen, 2026-10-24). This issue does not change the
  notification setup.
- The company record has a nullable `country` field (synced from Business Central). Its format (ISO
  code or country name) is UNVERIFIED.

## Requirements

### Functional

1. The password-reset email is sent in the language of the storefront country the request came
   from: subject, body text and link label.
2. The employee-invitation email (NIMBUS-242) uses the same mechanism and the same language rule,
   including the company-country fallback for invitations without a storefront country.
3. Email text is held as translation keys in the storefront translation module, so Nimbus admins
   edit it per language in the existing Admin translation editor without a deployment. The page
   layout of the email (HTML structure) and the link stay in code.
4. A missing or empty text in the chosen language falls back, per text, to the English reference
   text. A missing English text falls back to a built-in English default in code.
5. Every fallback is reported to the Admin missing-translations report: the chosen language's key
   when it falls back to English, and the English key when the built-in default is used.
6. The country chooses language and link only. It never decides who receives the email or what
   account the link acts on.
7. A failed or untranslated email, or a failed missing-text report, never blocks or undoes the
   action that triggered it (reset request, employee creation).
8. Delivery uses the existing notification setup unchanged (Medusa Emails on Cloud).
9. The delivery team ships English plus draft translations of the email texts for all eight
   storefront languages in the import files; Nimbus reviews and edits them in the Admin editor.

### Non-functional

- No new language field on customer or employee; no new tables or migrations in this issue.
- Text an admin enters is treated as untrusted when it is put into the email: escaped, never
  able to change the link or add markup.
- Personal data (recipient email, names, company) is never written to application logs or to the
  missing-text report.
- The English text of the reset email stays as close to today's as possible.

## Business rules

| # | Action or state | Outcome |
|---|---|---|
| R1 | Which emails | Exactly two: password reset (NIMBUS-133) and employee invitation (NIMBUS-242). Order confirmations and other notifications are out of scope. (Decided, Klaus Petersen, 2026-10-24) |
| R2 | Language of an email | The effective language of the storefront country it was triggered from, as assigned in Admin (`country_language_configuration`; unassigned country → English). No per-person language preference. (Decided, Klaus Petersen, 2026-10-24) |
| R3 | Reset request with a valid country | Email in that country's effective language; link to that country's reset page. |
| R4 | Reset request with no country, or a country not in any region | English text; link to the `dk` reset page (today's default). (Decided, Klaus Petersen, 2026-10-24) |
| R5 | Invitation from the storefront company page | The storefront sends the country of the page the company admin is on; email in that country's language; any login link uses that country. |
| R6 | Invitation without a storefront country (Medusa Admin, or a storefront request missing it) | The company's country → its effective language → English. If the company has no usable country, English (link country as R4). (Decided, Klaus Petersen, 2026-10-24) |
| R7 | Who gets an invitation | Every new employee account created through the shared employee-account workflow, from the storefront company page or from Medusa Admin. Linking an existing customer (`customer_id`) sends none. (Decided, Klaus Petersen, 2026-10-24; implemented in NIMBUS-242) |
| R8 | Text missing in the chosen language | That text falls back to English; the rest of the email stays in the chosen language. Sending is never refused for a missing translation. |
| R9 | English text itself missing | The built-in English default in code is used. It is an approved fallback copy of the English text, registered as such in the business-rule registry like the cold-outage country map. (Decided, Klaus Petersen, 2026-10-24) |
| R10 | A fallback was used | The missing key is recorded in the Admin missing-translations report for the language that lacked it, with the email's name as the source instead of a page path. Existing rules apply: only while the key is still missing, dismissed keys stay dismissed, caps apply. A failed report never stops the email. (Decided, Klaus Petersen, 2026-10-24) |
| R11 | Who edits email text | Nimbus staff with Medusa Admin access, in the translation editor, like any other UI text. Customers cannot. |
| R12 | Who writes the translations | The delivery team ships English and draft translations for all eight storefront languages; Nimbus reviews and edits them in Admin. English fallback per text is acceptable at go-live. (Proposed by the team, approved by Klaus Petersen, 2026-10-24) |
| R13 | Invitation content | Plain notification: tells the employee they have an account and for which company. No password, no set-password or reset link, no other credential. The employee gets the password from the company admin or uses "Forgot password". (Decided, Klaus Petersen, 2026-10-24; owned by NIMBUS-242) |
| R14 | Delivery | Medusa Emails on Cloud, already set up; no change in this issue. Delivery of a translated email is confirmed only after deploy, in Cloud's Email Activity page. (Decided, Klaus Petersen, 2026-10-24) |
| R15 | Who receives | Only the address of the account the email concerns (reset: the account's email; invitation: the invited address). Country and company never change the recipient. |

Actor recorded: none new. The reset is triggered by whoever submits the request (anonymous); the
invitation by the authenticated company admin or Admin user, as today.

## Data model (draft)

No new tables or columns. The new data are translation texts and missing-text report rows.

| Entity or field | Key and meaning | Owner | Who writes it | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Email texts | Translation keys in each language's message document, e.g. an `emails` group with subject, heading, body and link label per email; `{placeholder}` variables (company name, first name?) | `storefrontTranslation` module | Delivery team via the import files (English + drafts for 8 languages); Nimbus Admin users in the editor | Stored | No (public: the document is readable on `/store/ui-translations/:locale`) | Until edited |
| Built-in English default | Copy of the English email texts in code, used only when the English key is missing | Code (approved fallback, registered in `decisions.md`) | Developers | Code | No | Until changed in code |
| Missing-text report row | Existing `translation_missing_key` row: language, key, count, first/last seen, source (email name in the page-path field, e.g. `email:customer-password-reset`) | `storefrontTranslation` module | Email workflow through the existing report workflow | Stored | No: never the recipient, names, token or link | Until the key is filled or the row is dismissed (existing) |
| Country → language | Existing assignment, unassigned → English | `storefrontTranslation` module | Admin (NIMBUS-176) | Stored; effective language derived | No | Existing |
| Triggering country | Reset: existing `metadata.country_code` on the reset request. Invitation: new optional country on the store employee-creation request (contract change, NIMBUS-242) | Request only | Storefront server action | Transient; may be persisted inside the Notification record | No | Request lifetime |
| Company country (fallback) | `company.country`, nullable; format UNVERIFIED (planner checks against real data whether it matches storefront country codes) | `company` module (synced from Business Central) | BC sync | Stored, read only | No | Existing |
| Resolved email language | Locale actually used for the email | Email-language rule | Derived | Derived; stored in Notification data ? | No | Notification retention |
| Notification record | Recipient, subject, rendered body, data | Medusa Notification module | Email workflows | Stored by Medusa | Yes (recipient email, names; reset link) | Existing Medusa retention, accepted in NIMBUS-133 |

## Security properties (draft)

Personal data is involved (recipient email and names). No change to authentication.

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Recipient cannot be redirected | Recipient comes from the account (reset event's identity; invited address), never from country, company or text | Backend Auth identity / created customer record | Email not sent rather than sent elsewhere |
| Country is presentation only | Country validated as two lower-case letters; used only for language and link path; unknown → English (and `dk` link) | Backend validation; Admin-assigned mapping | Wrong country gives a wrong language, never wrong access |
| Company-country fallback | Read from the company the employee is created in, on the server; never from the request | Company module data (BC-synced) | Unusable value → English |
| Link destination | Link origin from deployment configuration (`STORE_CORS`, as NIMBUS-133); translations cannot set or change URLs | Deployment configuration | Invalid configuration refuses to build the email (existing) |
| Admin-entered text in HTML | Every translated value escaped before insertion; placeholders filled with escaped values | Code | Odd characters shown literally; no markup or script injection |
| No credentials in the invitation | Invitation template has no password, token or reset link | Code + review + test | n/a |
| Personal data in logs and reports | No recipient, name, company, token or link in application logs or in missing-text report rows; errors log message only | Code review; existing logging rule | Generic error logged, no personal data |
| Missing-text report cannot be flooded | Reports come from the backend only for real fallbacks; existing per-language and global caps apply | Existing report rules | Extra reports ignored; email unaffected |
| Enumeration (reset) | Unchanged from NIMBUS-133: same response whether or not the account exists, regardless of language | Existing reset route | Unchanged |

## Affected apps

- **Backend:** the email-language rule (country, else company country, else English), translated
  rendering with fallback, escaping and missing-text reporting, and the reset email moved onto it.
  No notification configuration change.
- **Storefront:** no code for the reset email (it already sends the country). Email texts are added
  to the eight import files in `apps/storefront/messages/` (import material only). The invitation's
  country on the request is NIMBUS-242.
- **CMS:** none.

## Proposed structure

Story. High-level tasks for the planner (about four):

1. The email-language rule: storefront country, else company country, else English, using the
   published country assignments. One pure rule, registered in `ai/architecture/decisions.md` as the
   home for "email language" (with the built-in English default recorded as an approved fallback
   copy). Includes the planner's check of `company.country` against real data.
2. Translated email rendering: read the language's texts, fall back per text to English and then to
   the built-in default, escape values, fill placeholders, and report each fallback through the
   existing missing-text workflow without personal data and without blocking the email.
3. Reset email on the new mechanism: subject and body as translation keys (English text unchanged),
   language from the request country, English plus draft translations for the eight languages in
   the import files.
4. Verification and documentation: tests for language choice, company fallback, unknown/missing
   country, per-text fallback, built-in default, report rows and escaping; update
   `docs/architecture/store-access.md` and `docs/architecture/country-languages.md`; release
   checklist (import keys per environment, after-deploy check of a translated email in Cloud's Email
   Activity page).

Sequencing: NIMBUS-162 goes first and delivers the mechanism plus the translated reset email.
NIMBUS-242 then builds its email translated from the start on that mechanism: its keys, its
trigger in the shared employee-account workflow, the country on the store request and the
company-country input.

Size: up from about three to about four tasks, still backend only. The extra work is the
missing-text reporting and the company-country fallback in the rule; both reuse existing pieces
(the report workflow and the published country assignments).

## Open questions

No business questions remain open. Klaus Petersen answered all of them and approved the scope,
including R12, on 2026-10-24.

Planner verification items (technical, not business):

- `company.country` format against real data (UNVERIFIED): if it is not a storefront country code,
  R6 gives English for Admin-created invitations until it is.
- How the email's source label fits the report's page-path field and the Admin report's display.
- Whether the resolved language is kept in the Notification record.

## Dependencies

- NIMBUS-242 (invitation email): consumes this issue's mechanism; owns the invitation trigger,
  content and the country on the employee-creation request.
- NIMBUS-175/176 (shipped): translation module, editor, missing-text report, country-language
  assignments.
- NIMBUS-133 (shipped): reset email and request contract.
- Release: email keys imported in every environment (as for NIMBUS-133's recovery keys).
- NIMBUS-243 (registered separately): whether the store employee route's `customer_id` must belong
  to the caller. Not part of this scope.

## Documentation

- [docs/architecture/store-access.md](../../docs/architecture/store-access.md) — Translated reset
  email and employee invitation email (updated)
- [docs/architecture/country-languages.md](../../docs/architecture/country-languages.md) — Emails
  read the stored assignments (updated)
- [apps/storefront/src/lib/i18n/README.md](../../apps/storefront/src/lib/i18n/README.md) — Import
  of the `Emails` keys per environment (updated)

AI base files updated: `ai/architecture/decisions.md` (email language rule row, committed by the
pipeline)
