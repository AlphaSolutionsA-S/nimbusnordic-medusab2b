# 05: Invitation email
**App:** backend (+ storefront import files) · **Layer:** L7, L4, L3, L5 · **Depends on:** 03, 04 · **Parent:** NIMBUS-242

**Goal:** The subscriber on `employee.invited` sends the translated invitation email to the new account's address, with the company name, first name and a login link and no credential.
**Files / areas:** `subscribers/employee-invited.ts` (new); `workflows/employee/{workflows,steps,utils}/` (invitation workflow, recipient read step, builder); shared steps from 03; `apps/storefront/messages/*.json` (`Emails.employeeInvitation`, English text from `issues/NIMBUS-242/feature.md`, drafts for 7 languages).
**Seam contracts:** template `employee-invitation`; source `email:employee-invitation`; keys `Emails.employeeInvitation.{subject,greeting,greetingWithoutName,body,passwordHint,loginLabel}` (`{firstName}`, `{companyName}`); login URL `<first STORE_CORS origin>/<linkCountry>/account`; notification `data` = `{ login_url, locale }`; `to` = customer email read by id.
**Test intent:**
- unit (builder): English matches the decided text; no `password`, `token`, `reset-password` in HTML or data; names and company escaped; empty first name → greeting without name; one link only.
- integration (spec from 04): store invite with a page country assigned to a seeded language → one notification to the invited address with that `data.locale`; Admin invite for a company with `country: "DK"` and `dk` in a region → `dk` language; company country `"Denmark"` → `en`, `/dk/account`; missing key → report row with source label and no email/name/company in it; notification provider throwing → employee still exists and route returned 200.
**Done when:** tests pass; 242's acceptance criteria covered.
**Verify after deploy:** Cloud Email Activity / `notification` row with template `employee-invitation` for one invited test employee: recipient is the invited address, `data.locale` matches the page country's language.
**Also update:** `docs/architecture/store-access.md` (employee creation sends an invitation); `apps/storefront/src/lib/i18n/README.md` (release import of `Emails`); `ai/architecture/decisions.md` consumers of the two rules.

## Deviations

- The link-origin check (first `STORE_CORS` origin, https or local http, no credentials) moved from the reset builder into the shared `transactional-email/utils/storefront-origin.ts` (`emailStorefrontOrigin`), used by both builders; why: a second copy of a security control is a defect. The reset builder's error message is now "Email storefront configuration is invalid" (no test or doc asserted the old text).
- `read-invitation-recipient` throws `NOT_FOUND` when the customer has no email (the column type is nullable; the email+password branch always sets one); why: no email rather than a guessed address.
- "Notification provider throwing" is simulated in the HTTP spec by rejecting the Notification module's `createNotifications` (what core `sendNotificationsStep` calls); why: the provider is internal to the module and not reachable from an HTTP spec.
- The task-04 spec gained `STORE_CORS` in its env, because the real subscriber now runs in its existing cases (`waitSubscribersExecution` wraps it).
- Added a unit case: a text with an unknown placeholder (`{password}`) falls back without a report (plan section 2, item 4).
- `ai/architecture/decisions.md` unchanged: its consumers already read "reset and invitation emails" (language) and "email builders" (texts), so no edit was needed and `AGENTS.md` does not grow (ai:check size issue).
- HTTP specs were written and typecheck, but were not run (no local Postgres); the dispatcher runs them at finalization.
- The seven non-English texts are drafts for Nimbus review in the Admin editor (R12).

## Done-when evidence

- Tests pass: `src/workflows/employee/utils/__tests__/employee-invitation-notification.unit.spec.ts` (all pass, with the reset and transactional-email suites: 6 suites, 78 tests); `integration-tests/http/companies/employee-invitation.spec.ts` "invitation email" block typechecks, not run locally (no Postgres).
- AC "store invite: email at the address entered, naming the company": unit "sends the decided English text to the invited address with a login link and the locale"; HTTP "sends one invitation to the invited address in the page country's language".
- AC "Admin-created employee receives the same email": HTTP "uses the company country's language for an Admin invitation" and "sends English with the dk link when the company country is not a code".
- AC "no password, set-password/reset link or other credential": unit "carries no password, token or reset link in the HTML or the data", "has exactly one link, the login page".
- AC "only the invited address receives the email": HTTP first case (every `employee-invitation` notification's `to` is the invited address); `to` read by customer id in `read-invitation-recipient.ts`.
- AC "a failed email does not undo the invitation": HTTP "keeps the employee and answers 200 when sending the email fails".
- AC "invite form unchanged": not provable in this task: no storefront form change here (task 06).
- Missing key reported with the source and no personal data: unit "reports missing texts under the email source without personal data"; HTTP "reports a missing text under the email source without personal data".
- Names and company escaped; greeting without a name: unit "escapes names, company and texts…", "greets without a name when the first name is …", "uses the translated greeting without a name".
- Also update `docs/architecture/store-access.md`: new "Employee invitation email" section and a note on the shared origin check.
- Also update `apps/storefront/src/lib/i18n/README.md`: release import names `Emails.passwordReset` and `Emails.employeeInvitation`.
- Also update `ai/architecture/decisions.md`: no change needed (consumers already include the invitation email; see Deviations).
- Import files: `apps/storefront/messages/{en,da,de,fr,it,no,pl,sv}.json` gained `Emails.employeeInvitation` (six keys; English is the decided text).
