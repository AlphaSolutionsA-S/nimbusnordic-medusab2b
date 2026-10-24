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
